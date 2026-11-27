'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const tls = require('node:tls');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const HTML_DIR = path.join(__dirname, 'html');
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const codePepper = process.env.EMAIL_CODE_PEPPER || crypto.randomBytes(32).toString('hex');
const verificationCodes = new Map();
const ipRequests = new Map();

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 8192) {
        reject(new Error('请求内容过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (error) { reject(new Error('请求格式不正确')); }
    });
    req.on('error', reject);
  });
}

function validEmail(value) {
  return typeof value === 'string' && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value) && value.length <= 254;
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashCode(email, code) {
  return crypto.createHmac('sha256', codePepper).update(`${email}:${code}`).digest('hex');
}

function smtpClient() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({host: 'smtp.163.com', port: 465, servername: 'smtp.163.com'});
    let buffer = '';
    let lines = [];
    const waiters = [];
    let connected = false;

    function fail(error) {
      while (waiters.length) waiters.shift().reject(error);
    }

    function nextResponse() {
      return new Promise((resolveResponse, rejectResponse) => {
        waiters.push({resolve: resolveResponse, reject: rejectResponse});
      });
    }

    socket.setTimeout(20000, () => {
      socket.destroy(new Error('连接邮件服务器超时'));
    });
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let index;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        lines.push(line);
        if (/^\d{3} /.test(line) && waiters.length) {
          const response = lines.join('\n');
          lines = [];
          waiters.shift().resolve(response);
        }
      }
    });
    socket.on('error', error => { if (!connected) reject(error); fail(error); });
    socket.on('close', () => fail(new Error('邮件服务器连接已关闭')));
    socket.on('secureConnect', () => {
      connected = true;
      resolve({
      async command(command, expected, hide = false) {
        const pending = nextResponse();
        socket.write(`${command}\r\n`);
        const response = await pending;
        const code = Number(response.slice(0, 3));
        if (code !== expected) throw new Error(hide ? '邮箱身份验证失败' : `邮件服务器返回异常 (${code})`);
        return response;
      },
      async ready() {
        const response = await nextResponse();
        if (!response.startsWith('220 ')) throw new Error('邮件服务暂不可用');
      },
      end() { socket.end(); },
      destroy() { socket.destroy(); }
      });
    });
  });
}

async function sendVerificationEmail(recipient, code) {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASS;
  if (!user || !password) throw new Error('邮件服务尚未配置');

  const client = await smtpClient();
  try {
    await client.ready();
    await client.command('EHLO mobank.local', 250);
    await client.command('AUTH LOGIN', 334);
    await client.command(Buffer.from(user).toString('base64'), 334, true);
    await client.command(Buffer.from(password).toString('base64'), 235, true);
    await client.command(`MAIL FROM:<${user}>`, 250);
    await client.command(`RCPT TO:<${recipient}>`, 250);
    await client.command('DATA', 354);

    const subject = `=?UTF-8?B?${Buffer.from('模拟银行注册验证码').toString('base64')}?=`;
    const fromName = `=?UTF-8?B?${Buffer.from('模拟银行').toString('base64')}?=`;
    const html = `<!doctype html><html><body style="margin:0;background:#f5f6f0;font-family:Arial,'Microsoft YaHei',sans-serif"><div style="max-width:520px;margin:35px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e3e8e1"><div style="background:#175c49;color:#fff;padding:24px 30px"><strong style="font-size:20px">模拟银行 MOBank</strong></div><div style="padding:32px 30px;color:#17251f"><p style="margin-top:0">你好，</p><p>你正在注册模拟银行账号，本次验证码为：</p><div style="font-size:34px;letter-spacing:10px;font-weight:bold;color:#175c49;background:#e4f1e9;border-radius:12px;padding:20px;text-align:center">${code}</div><p style="color:#718078;font-size:13px;line-height:1.8">验证码 10 分钟内有效。请勿将验证码告诉他人。如果这不是你的操作，请忽略本邮件。</p></div><div style="padding:16px 30px;background:#f7f8f4;color:#8a958e;font-size:11px">此邮件由系统自动发送，请勿直接回复。模拟银行仅用于课堂教育，不提供真实金融服务。</div></div></body></html>`;
    const message = [
      `From: ${fromName} <${user}>`,
      `To: <${recipient}>`,
      `Subject: ${subject}`,
      `Message-ID: <${crypto.randomUUID()}@mobank.local>`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n'),
      ''
    ].join('\r\n').replace(/^\./gm, '..');

    await client.command(`${message}\r\n.`, 250);
    await client.command('QUIT', 221);
    client.end();
  } catch (error) {
    client.destroy();
    throw error;
  }
}

function checkIpRate(ip) {
  const now = Date.now();
  const recent = (ipRequests.get(ip) || []).filter(time => now - time < 60 * 60 * 1000);
  if (recent.length >= 10) return false;
  recent.push(now);
  ipRequests.set(ip, recent);
  return true;
}

async function handleSendCode(req, res) {
  const body = await readJson(req);
  const email = cleanEmail(body.email);
  if (!validEmail(email)) return json(res, 400, {ok: false, message: '请输入正确的邮箱地址'});
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!checkIpRate(ip)) return json(res, 429, {ok: false, message: '发送次数较多，请稍后再试'});
  const existing = verificationCodes.get(email);
  if (existing && Date.now() - existing.sentAt < RESEND_INTERVAL_MS) {
    const seconds = Math.ceil((RESEND_INTERVAL_MS - (Date.now() - existing.sentAt)) / 1000);
    return json(res, 429, {ok: false, message: `请在 ${seconds} 秒后重新发送`, retryAfter: seconds});
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await sendVerificationEmail(email, code);
  verificationCodes.set(email, {hash: hashCode(email, code), expiresAt: Date.now() + CODE_TTL_MS, sentAt: Date.now(), attempts: 0});
  json(res, 200, {ok: true, message: '验证码已发送，请查收邮件', expiresIn: 600, resendAfter: 60});
}

function handleVerifyCode(body, res) {
  const email = cleanEmail(body.email);
  const code = String(body.code || '').trim();
  const record = verificationCodes.get(email);
  if (!record || record.expiresAt < Date.now()) {
    verificationCodes.delete(email);
    return json(res, 400, {ok: false, message: '验证码已过期，请重新获取'});
  }
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    verificationCodes.delete(email);
    return json(res, 429, {ok: false, message: '错误次数过多，请重新获取验证码'});
  }
  record.attempts += 1;
  const actual = Buffer.from(hashCode(email, code));
  const expected = Buffer.from(record.hash);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return json(res, 400, {ok: false, message: '验证码不正确，请重新输入'});
  }
  verificationCodes.delete(email);
  json(res, 200, {ok: true, message: '邮箱验证成功'});
}

const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};

function serveStatic(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, {ok: false, message: '不支持的请求方式'});
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch (error) { return json(res, 400, {ok: false, message: '地址格式不正确'}); }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const baseDir = path.extname(relative).toLowerCase() === '.html' ? HTML_DIR : PUBLIC_DIR;
  const file = path.resolve(baseDir, relative);
  if (file !== baseDir && !file.startsWith(`${baseDir}${path.sep}`)) return json(res, 403, {ok: false, message: '禁止访问'});
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return json(res, 404, {ok: false, message: '页面不存在'});
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net https://tessdata.projectnaptha.com; worker-src 'self' blob: https://cdn.jsdelivr.net; frame-ancestors 'none'"
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health') return json(res, 200, {ok: true, mailConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)});
    if (url.pathname === '/api/auth/send-code' && req.method === 'POST') return await handleSendCode(req, res);
    if (url.pathname === '/api/auth/verify-code' && req.method === 'POST') return handleVerifyCode(await readJson(req), res);
    if (url.pathname.startsWith('/api/')) return json(res, 404, {ok: false, message: '接口不存在'});
    serveStatic(req, res, url.pathname);
  } catch (error) {
    if (res.headersSent) return res.end();
    const safeMessage = /尚未配置|超时|身份验证失败|请求格式|请求内容/.test(error.message) ? error.message : '邮件发送失败，请稍后重试或检查邮箱地址';
    json(res, error.message.includes('尚未配置') ? 503 : 500, {ok: false, message: safeMessage});
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MOBank server listening on 0.0.0.0:${PORT}`);
});

setInterval(() => {
  const now = Date.now();
  for (const [email, record] of verificationCodes) if (record.expiresAt < now) verificationCodes.delete(email);
  for (const [ip, requests] of ipRequests) {
    const recent = requests.filter(time => now - time < 60 * 60 * 1000);
    if (recent.length) ipRequests.set(ip, recent); else ipRequests.delete(ip);
  }
}, 10 * 60 * 1000).unref();
