(() => {
  'use strict';

  const STORAGE_KEY = 'mobank_campus_v1';
  const SESSION_KEY = 'mobank_session_v1';
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const money = (value) => Number(value || 0).toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const shortDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('zh-CN', {month:'2-digit', day:'2-digit'});
  const fullDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('zh-CN', {year:'numeric', month:'long', day:'numeric'});
  const dateOffset = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const makeCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  function seedData() {
    return {
      banks: [{id:'bank_demo', name:'知行模拟银行', school:'知行实验学校 · 六年级', code:'MO2026', ownerId:'user_teacher', createdAt:'2026-09-01'}],
      branches: [
        {id:'branch_zhixing', bankId:'bank_demo', name:'知行班', code:'ZX2026', active:true, createdAt:'2026-09-01'},
        {id:'branch_nanguang', bankId:'bank_demo', name:'南光班', code:'NG2026', active:true, createdAt:'2026-09-03'},
        {id:'branch_qinghe', bankId:'bank_demo', name:'青禾班', code:'QH2026', active:false, createdAt:'2026-10-12'}
      ],
      users: [
        {id:'user_teacher', username:'teacher', password:'123456', name:'林老师', role:'teacher', bankId:'bank_demo', active:true},
        {id:'user_teller', username:'teller', password:'123456', name:'陈小柜', role:'teller', bankId:'bank_demo', active:true},
        {id:'user_student', username:'student', password:'123456', name:'周小满', role:'student', bankId:'bank_demo', branchId:'branch_zhixing', active:true},
        {id:'user_student2', username:'xiaoyu', password:'123456', name:'李雨桐', role:'student', bankId:'bank_demo', branchId:'branch_zhixing', active:true},
        {id:'user_student3', username:'chenxi', password:'123456', name:'陈曦', role:'student', bankId:'bank_demo', branchId:'branch_nanguang', active:true}
      ],
      transactions: [
        {id:'tx1', bankId:'bank_demo', branchId:'branch_zhixing', studentId:'user_student', date:dateOffset(-1), uploadDate:today(), type:'deposit', amount:120, summary:'本周储蓄', note:'零花钱储蓄计划', source:'ai', ocrText:'存入 120.00 元\n本周储蓄', imageName:'', image:'', createdBy:'user_student'},
        {id:'tx2', bankId:'bank_demo', branchId:'branch_zhixing', studentId:'user_student', date:dateOffset(-4), uploadDate:dateOffset(-4), type:'expense', amount:25.5, summary:'班级图书角', note:'购买共享图书', source:'ai', ocrText:'支出 25.50 元\n图书角', imageName:'', image:'', createdBy:'user_student'},
        {id:'tx3', bankId:'bank_demo', branchId:'branch_zhixing', studentId:'user_student', date:dateOffset(-7), uploadDate:dateOffset(-7), type:'deposit', amount:80, summary:'劳动奖励', note:'完成本周值日', source:'manual', ocrText:'', imageName:'', image:'', createdBy:'user_teller'},
        {id:'tx4', bankId:'bank_demo', branchId:'branch_zhixing', studentId:'user_student', date:dateOffset(-10), uploadDate:dateOffset(-10), type:'deposit', amount:200, summary:'月初存入', note:'', source:'ai', ocrText:'存款 200 元', imageName:'', image:'', createdBy:'user_student'},
        {id:'tx5', bankId:'bank_demo', branchId:'branch_zhixing', studentId:'user_student', date:dateOffset(-13), uploadDate:dateOffset(-13), type:'expense', amount:18, summary:'学习用品', note:'购买笔记本', source:'manual', ocrText:'', imageName:'', image:'', createdBy:'user_student'},
        {id:'tx6', bankId:'bank_demo', branchId:'branch_zhixing', studentId:'user_student2', date:dateOffset(-2), uploadDate:dateOffset(-2), type:'deposit', amount:150, summary:'储蓄存入', note:'', source:'ai', ocrText:'存入 150 元', imageName:'', image:'', createdBy:'user_teller'},
        {id:'tx7', bankId:'bank_demo', branchId:'branch_nanguang', studentId:'user_student3', date:dateOffset(-3), uploadDate:dateOffset(-3), type:'deposit', amount:90, summary:'劳动收入', note:'', source:'manual', ocrText:'', imageName:'', image:'', createdBy:'user_student3'},
        {id:'tx8', bankId:'bank_demo', branchId:'branch_zhixing', studentId:'user_student2', date:dateOffset(-5), uploadDate:dateOffset(-5), type:'expense', amount:32, summary:'美术材料', note:'', source:'manual', ocrText:'', imageName:'', image:'', createdBy:'user_student2'}
      ]
    };
  }

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.banks && saved.users && saved.transactions) {
        saved.banks.forEach(bank => {if (!bank.code) bank.code = makeCode();});
        return saved;
      }
    } catch (error) { /* Use a clean demo workspace if local data is unavailable. */ }
    const data = seedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  let db = loadData();
  let currentUser = null;
  let currentView = 'dashboard';
  let studentFilter = 'all';
  let txFilters = {search:'', type:'all', branch:'all'};
  let pendingReceipt = null;
  let ocrRunning = false;
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
    catch (error) { toast('浏览器存储空间不足，请导出数据后清理部分图片', 'error'); }
  };
  const bankOf = (user = currentUser) => db.banks.find(b => b.id === user?.bankId);
  const branchOf = (id) => db.branches.find(b => b.id === id);
  const userOf = (id) => db.users.find(u => u.id === id);
  const roleName = (role) => ({teacher:'总行管理员', teller:'支行服务员', student:'普通学生'}[role] || role);
  const myBranches = () => db.branches.filter(b => b.bankId === currentUser.bankId && (currentUser.role !== 'student' || b.id === currentUser.branchId));
  const visibleStudents = () => db.users.filter(u => u.bankId === currentUser.bankId && u.role !== 'teacher' && (currentUser.role !== 'student' || u.id === currentUser.id));
  const visibleTransactions = () => db.transactions.filter(t => t.bankId === currentUser.bankId && (currentUser.role !== 'student' || t.studentId === currentUser.id));
  const balanceOf = (studentId) => db.transactions.filter(t => t.studentId === studentId).reduce((sum, t) => sum + (t.type === 'deposit' ? Number(t.amount) : -Number(t.amount)), 0);
  const branchBalance = (branchId) => db.transactions.filter(t => t.branchId === branchId).reduce((sum, t) => sum + (t.type === 'deposit' ? Number(t.amount) : -Number(t.amount)), 0);
  const initials = (name) => esc(String(name || '用户').slice(-2));

  function syncRegistrationRole(role) {
    $('#teacher-fields').classList.toggle('hidden', role !== 'teacher');
    $('#student-fields').classList.toggle('hidden', role !== 'student');
    $('#teller-fields').classList.toggle('hidden', role !== 'teller');
  }

  function toast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icon(type === 'error' ? 'close' : 'check')}</span><div>${esc(message)}</div>`;
    $('#toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3600);
  }

  function switchAuth(mode) {
    const login = mode === 'login';
    $('#login-form').classList.toggle('hidden', !login);
    $('#register-form').classList.toggle('hidden', login);
    $$('[data-action="auth-tab"]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    $('#auth-title').textContent = login ? '欢迎回来' : '创建你的账号';
    $('#auth-subtitle').textContent = login ? '登录你的模拟银行，继续今天的工作' : '选择身份，开启校园银行之旅';
    if (!login) {
      const role = $('input[name="registerRole"]:checked')?.value || 'teacher';
      syncRegistrationRole(role);
      $$('input[name="registerRole"]').forEach(input => input.closest('.role-option').classList.toggle('active', input.checked));
    }
  }

  function login(username, password) {
    const user = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!user || user.password !== password) return $('#login-message').textContent = '账号或密码不正确，请重试';
    if (!user.active) return $('#login-message').textContent = '该账号已停用，请联系总行管理员';
    const branch = user.branchId ? branchOf(user.branchId) : null;
    if (branch && !branch.active) return $('#login-message').textContent = '所在班级暂未开放，请联系老师';
    currentUser = user;
    sessionStorage.setItem(SESSION_KEY, user.id);
    currentView = 'dashboard';
    $('#login-message').textContent = '';
    renderApp();
    toast(`欢迎回来，${user.name}`);
  }

  function startEmailCountdown(seconds) {
    const button = $('#send-email-code');
    if (!button) return;
    const endAt = Date.now() + seconds * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      button.disabled = remaining > 0;
      button.textContent = remaining > 0 ? `${remaining} 秒后重发` : '获取验证码';
      if (!remaining) clearInterval(timer);
    };
    const timer = setInterval(tick, 1000);
    tick();
  }

  async function sendEmailCode() {
    const form = $('#register-form');
    const emailInput = form.elements.email;
    const email = emailInput.value.trim().toLowerCase();
    const message = $('#register-message');
    if (!email || !emailInput.checkValidity()) return message.textContent = '请先输入正确的邮箱地址';
    const button = $('#send-email-code');
    button.disabled = true;
    button.textContent = '发送中...';
    message.textContent = '';
    try {
      const response = await fetch('/api/auth/send-code', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email})
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        message.textContent = result.message || '验证码发送失败，请稍后重试';
        if (result.retryAfter) startEmailCountdown(result.retryAfter);
        else {button.disabled = false;button.textContent = '获取验证码';}
        return;
      }
      toast(`验证码已发送至 ${email}`);
      startEmailCountdown(result.resendAfter || 60);
      form.elements.emailCode.focus();
    } catch (error) {
      message.textContent = '暂时无法连接邮件服务，请检查网络后重试';
      button.disabled = false;
      button.textContent = '获取验证码';
    }
  }

  async function register(form) {
    const fd = new FormData(form);
    const role = fd.get('registerRole');
    const name = String(fd.get('name') || '').trim();
    const username = String(fd.get('username') || '').trim();
    const password = String(fd.get('password') || '');
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const emailCode = String(fd.get('emailCode') || '').trim();
    const message = $('#register-message');
    if (!name || username.length < 3 || password.length < 6) return message.textContent = '请完整填写信息，账号至少 3 位、密码至少 6 位';
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return message.textContent = '该登录账号已被使用，请换一个';
    if (!email || !/^\d{6}$/.test(emailCode)) return message.textContent = '请输入邮箱地址和 6 位数字验证码';

    let bankName = '', schoolName = '', branch = null, joinBank = null;
    if (role === 'teacher') {
      bankName = String(fd.get('bankName') || '').trim();
      schoolName = String(fd.get('schoolName') || '').trim();
      if (!bankName || !schoolName) return message.textContent = '请填写银行名称和学校';
    } else if (role === 'student') {
      const code = String(fd.get('branchCode') || '').trim().toUpperCase();
      branch = db.branches.find(b => b.code.toUpperCase() === code);
      if (!branch) return message.textContent = '班级码无效，请向老师确认后重试';
      if (!branch.active) return message.textContent = '该班级暂未开放加入，请联系老师';
    } else {
      const code = String(fd.get('bankCode') || '').trim().toUpperCase();
      joinBank = db.banks.find(b => String(b.code).toUpperCase() === code);
      if (!joinBank) return message.textContent = '银行码无效，请向老师确认后重试';
    }

    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = '正在验证邮箱...';
    message.textContent = '';
    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({email, code: emailCode})
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        message.textContent = result.message || '邮箱验证失败，请重试';
        return;
      }
      if (role === 'teacher') {
        const bankId = uid('bank');
        let bankCode = makeCode();
        while (db.banks.some(b => b.code === bankCode)) bankCode = makeCode();
        const user = {id:uid('user'), username, password, email, name, role:'teacher', bankId, active:true};
        db.banks.push({id:bankId, name:bankName, school:schoolName, code:bankCode, ownerId:user.id, createdAt:today()});
        db.users.push(user);
        db.branches.push({id:uid('branch'), bankId, name:'中心班', code:makeCode(), active:true, createdAt:today()});
        currentUser = user;
      } else if (role === 'student') {
        const user = {id:uid('user'), username, password, email, name, role:'student', bankId:branch.bankId, branchId:branch.id, active:true};
        db.users.push(user);
        currentUser = user;
      } else {
        const user = {id:uid('user'), username, password, email, name, role:'teller', bankId:joinBank.id, active:true};
        db.users.push(user);
        currentUser = user;
      }
      save();
      sessionStorage.setItem(SESSION_KEY, currentUser.id);
      form.reset();
      message.textContent = '';
      currentView = 'dashboard';
      renderApp();
      toast('邮箱验证成功，欢迎加入模拟银行');
    } catch (error) {
      message.textContent = '暂时无法连接验证服务，请稍后重试';
    } finally {
      submit.disabled = false;
      submit.innerHTML = `创建账号 ${icon('arrow')}`;
    }
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    currentUser = null;
    currentView = 'dashboard';
    $('#app').classList.add('hidden');
    $('#landing').classList.remove('hidden');
    $('#login-form').reset();
    switchAuth('login');
    window.scrollTo({top:0});
  }

  const pageTitles = {
    dashboard:['工作台','掌握银行动态，处理今日事务'], branches:['班级管理','开设班级、维护班级码与开放状态'],
    students:['成员管理','查看本行学生与支行服务员'], transactions:['收支明细','集中查看与管理电子存折记录'],
    passbook:['我的电子存折','每一笔收支，都是成长的脚印'], ai:['AI 凭证识别','拍照上传，让纸质存折变成电子表格'], reports:['数据报表','汇总经营数据，导出课堂成果']
  };

  function navItems() {
    if (currentUser.role === 'student') return [
      ['dashboard','home','个人中心'], ['passbook','book','电子存折'], ['ai','scan','AI 凭证识别'], ['reports','chart','我的报表']
    ];
    const items = [['dashboard','home','工作台']];
    if (currentUser.role === 'teacher') items.push(['branches','branch','班级管理']);
    items.push(['students','users',currentUser.role === 'teacher' ? '成员管理' : '银行成员'], ['transactions','book','收支明细'], ['ai','scan','AI 凭证识别'], ['reports','chart','数据报表']);
    return items;
  }

  function renderApp() {
    if (!currentUser) return;
    $('#landing').classList.add('hidden');
    $('#app').classList.remove('hidden');
    const bank = bankOf();
    const branch = branchOf(currentUser.branchId);
    const page = currentUser.role === 'student' && currentView === 'dashboard' ? ['个人中心','查看我的存折与收支记录'] : (pageTitles[currentView] || pageTitles.dashboard);
    $('#app').innerHTML = `
      <div class="app-shell">
        <aside class="sidebar" id="sidebar">
          <a class="brand" href="#" data-action="nav" data-view="dashboard"><span class="brand-mark">${icon('bank')}</span><span><strong>模拟银行</strong><small>MOBANK · CAMPUS</small></span></a>
          <div class="bank-switcher"><span>${icon('bank')}</span><div><strong>${esc(bank?.name)}</strong><small>${currentUser.role === 'teacher' ? `银行码 ${esc(bank?.code)}` : currentUser.role === 'teller' ? '支行服务台' : esc(branch?.name || '个人中心')}</small></div></div>
          <p class="side-label">工作空间</p>
          <nav class="side-nav">${navItems().map(([view, ico, label]) => `<button class="${currentView === view ? 'active' : ''}" data-action="nav" data-view="${view}">${icon(ico)}<span>${label}</span>${view === 'transactions' ? `<span class="nav-count">${visibleTransactions().length}</span>` : ''}</button>`).join('')}</nav>
          <div class="sidebar-bottom">
            <div class="side-help">${icon('help')}<strong>需要一点帮助？</strong><p>${currentUser.role === 'teacher' ? '学生使用班级码加入，支行服务员使用银行码加入。' : currentUser.role === 'student' ? '上传清晰的存折照片，AI 会帮你提取收支信息。' : '你可以协助本银行各班级学生录入与核对存折。'}</p></div>
            <div class="side-user"><span class="user-avatar">${initials(currentUser.name)}</span><div><strong>${esc(currentUser.name)}</strong><small>${roleName(currentUser.role)}</small></div><button class="icon-btn" data-action="logout" title="退出登录">${icon('logout')}</button></div>
          </div>
        </aside>
        <main class="app-main">
          <header class="topbar"><div class="topbar-left"><button class="icon-btn mobile-menu" data-action="mobile-menu">${icon('menu')}</button><div><h1>${page[0]}</h1><p>${page[1]}</p></div></div><div class="topbar-right"><span class="today-badge">${icon('clock')}${fullDate(today())}</span><span class="role-badge">${roleName(currentUser.role)}</span></div></header>
          <div class="content" id="page-content">${renderPage()}</div>
        </main>
      </div>`;
    window.scrollTo({top:0});
  }

  function renderPage() {
    switch (currentView) {
      case 'branches': return renderBranches();
      case 'students': return renderStudents();
      case 'transactions': return renderTransactions();
      case 'passbook': return renderPassbook();
      case 'ai': return renderAIPage();
      case 'reports': return renderReports();
      default: return renderDashboard();
    }
  }

  function refreshPage() {
    const content = $('#page-content');
    if (content) content.innerHTML = renderPage();
    const nav = $('.side-nav');
    if (nav) $$('.side-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
  }

  function statCard(label, value, iconName, tone, foot, suffix = '') {
    return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${tone}">${icon(iconName)}</span></div><div class="stat-value num">${value}<small>${suffix}</small></div><div class="stat-foot">${foot}</div></article>`;
  }

  function renderDashboard() {
    const txs = visibleTransactions();
    const income = txs.filter(t => t.type === 'deposit').reduce((s,t) => s + Number(t.amount), 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0);
    const students = visibleStudents().filter(u => u.role === 'student');
    const hour = new Date().getHours();
    const greeting = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    if (currentUser.role === 'student') return `
      <div class="welcome-row"><div><h2>${greeting}，${esc(currentUser.name)}</h2><p>今天也为自己的小目标，存下一点进步吧。</p></div><div class="welcome-actions"><button class="btn btn-ghost" data-action="export">${icon('download')}导出存折</button><button class="btn btn-primary" data-action="new-transaction">${icon('plus')}记一笔</button></div></div>
      <section class="balance-hero"><div class="balance-main"><div class="balance-label">${icon('wallet')}我的存折余额</div><div class="balance-value num"><small>¥</small>${money(income - expense)}</div><div class="balance-caption">${esc(branchOf(currentUser.branchId)?.name)} · 账号 ${esc(currentUser.username.toUpperCase())}</div></div><div class="balance-stat income"><span>累计存入</span><strong class="num">+ ¥${money(income)}</strong><small>${txs.filter(t=>t.type==='deposit').length} 笔收入</small></div><div class="balance-stat expense"><span>累计支出</span><strong class="num">− ¥${money(expense)}</strong><small>${txs.filter(t=>t.type==='expense').length} 笔支出</small></div></section>
      <div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h3>最近收支</h3><p>你的每一笔记录都保存在这里</p></div><button class="btn btn-ghost btn-sm" data-action="nav" data-view="passbook">全部记录 ${icon('arrow')}</button></div>${txs.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>摘要</th><th>日期</th><th>金额</th><th>凭证</th></tr></thead><tbody>${[...txs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(t => txRow(t, true)).join('')}</tbody></table></div>` : emptyState('book','还没有收支记录','上传第一张凭证，开始你的电子存折')}</section>
      <aside class="panel"><div class="panel-head"><div><h3>快捷操作</h3><p>常用功能，一步直达</p></div></div><div class="panel-body"><div class="quick-actions"><button class="quick-action" data-action="new-transaction"><span>${icon('scan')}</span><strong>AI 记一笔</strong><small>上传存折凭证</small></button><button class="quick-action" data-action="nav" data-view="passbook"><span>${icon('book')}</span><strong>查看存折</strong><small>全部收支明细</small></button><button class="quick-action" data-action="export"><span>${icon('download')}</span><strong>导出表格</strong><small>保存 Excel 文件</small></button><button class="quick-action" data-action="nav" data-view="reports"><span>${icon('chart')}</span><strong>收支报表</strong><small>看看钱去哪了</small></button></div><div class="notice">${icon('spark')}<span>拍照时保持光线充足、文字清晰，AI 识别会更准确。</span></div></div></aside></div>
      <p class="local-note">${icon('shield')} 数据保存在当前浏览器中，仅用于课堂模拟</p>`;

    const activeBranches = myBranches().filter(b => b.active).length;
    return `
      <div class="welcome-row"><div><h2>${greeting}，${esc(currentUser.name)}</h2><p>${currentUser.role === 'teacher' ? `这是 ${esc(bankOf()?.name)} 今天的经营概况。` : `欢迎回到 ${esc(bankOf()?.name)} 支行服务台，一起做好今日服务。`}</p></div><div class="welcome-actions"><button class="btn btn-ghost" data-action="export">${icon('download')}导出数据</button>${currentUser.role === 'teacher' ? `<button class="btn btn-primary" data-action="create-branch">${icon('plus')}开设班级</button>` : `<button class="btn btn-primary" data-action="new-transaction">${icon('plus')}为学生记账</button>`}</div></div>
      <section class="stat-grid">
        ${statCard(currentUser.role === 'teacher' ? '班级总数' : '本银行成员', currentUser.role === 'teacher' ? myBranches().length : visibleStudents().length, currentUser.role === 'teacher' ? 'branch' : 'users', '', `<span class="trend-up">${currentUser.role === 'teacher' ? activeBranches : visibleStudents().filter(u=>u.active).length}</span> 个正常${currentUser.role === 'teacher' ? '开放' : '使用'}`)}
        ${statCard('学生人数', students.length, 'users', 'blue', `含 <span class="trend-up">${visibleStudents().filter(u=>u.role==='teller').length}</span> 名支行服务员`)}
        ${statCard('累计存入', `¥${money(income)}`, 'wallet', '', `共 ${txs.filter(t=>t.type==='deposit').length} 笔收入记录`)}
        ${statCard('累计支出', `¥${money(expense)}`, 'chart', 'amber', `共 ${txs.filter(t=>t.type==='expense').length} 笔支出记录`)}
      </section>
      <div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h3>${currentUser.role === 'teacher' ? '班级概览' : '最近收支'}</h3><p>${currentUser.role === 'teacher' ? '各班级学生与结余情况' : '本银行最新电子存折记录'}</p></div><button class="btn btn-ghost btn-sm" data-action="nav" data-view="${currentUser.role === 'teacher' ? 'branches' : 'transactions'}">查看全部 ${icon('arrow')}</button></div>
      ${currentUser.role === 'teacher' ? `<div class="branch-mini-list">${myBranches().slice(0,5).map(b => {const count=db.users.filter(u=>u.branchId===b.id&&u.role==='student').length;return `<div class="branch-mini"><span class="branch-symbol">${icon('branch')}</span><div class="branch-mini-info"><strong>${esc(b.name)}</strong><small><span class="status-dot ${b.active?'':'off'}"></span>${b.active?'开放中':'已暂停'} · ${count} 名学生</small></div><div class="branch-mini-amount"><strong class="num">¥${money(branchBalance(b.id))}</strong><small>存折结余</small></div></div>`}).join('')}</div>` : `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>摘要</th><th>日期</th><th>金额</th><th>凭证</th></tr></thead><tbody>${[...txs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(t=>txRow(t,true)).join('')}</tbody></table></div>`}</section>
      <aside class="panel"><div class="panel-head"><div><h3>快捷操作</h3><p>高效完成日常管理</p></div></div><div class="panel-body"><div class="quick-actions">${currentUser.role === 'teacher' ? `<button class="quick-action" data-action="create-branch"><span>${icon('plus')}</span><strong>开设班级</strong><small>生成专属班级码</small></button><button class="quick-action" data-action="create-student"><span>${icon('users')}</span><strong>添加成员</strong><small>创建学生账号</small></button>` : `<button class="quick-action" data-action="new-transaction"><span>${icon('scan')}</span><strong>为学生记账</strong><small>AI 识别凭证</small></button><button class="quick-action" data-action="create-student"><span>${icon('users')}</span><strong>添加学生</strong><small>创建班级成员账号</small></button>`}<button class="quick-action" data-action="nav" data-view="transactions"><span>${icon('book')}</span><strong>收支明细</strong><small>查看所有记录</small></button><button class="quick-action" data-action="export"><span>${icon('download')}</span><strong>导出报表</strong><small>生成 Excel 文件</small></button></div><div class="notice">${icon('shield')}<span>学生使用班级码加入，支行服务员使用银行码加入，请注意区分。</span></div></div></aside></div>
      <p class="local-note">${icon('shield')} 数据保存在当前浏览器中，仅用于课堂模拟</p>`;
  }

  function txRow(t, compact = false) {
    const student = userOf(t.studentId);
    const canDelete = currentUser.role !== 'student' || t.studentId === currentUser.id;
    return `<tr><td><div class="tx-title"><span class="tx-icon ${t.type === 'expense' ? 'expense' : ''}">${icon(t.type === 'expense' ? 'upload' : 'download')}</span><div><strong>${esc(t.summary)}</strong><small>${esc(t.note || (t.type === 'expense' ? '支出' : '存入'))}</small></div></div></td>
      ${!compact && currentUser.role !== 'student' ? `<td><div class="student-cell"><span class="user-avatar">${initials(student?.name)}</span><div><strong>${esc(student?.name || '未知学生')}</strong><small>${esc(branchOf(t.branchId)?.name || '')}</small></div></div></td>` : ''}
      <td><span class="num">${shortDate(t.date)}</span><small style="display:block;color:var(--muted);font-size:9px">上传 ${shortDate(t.uploadDate)}</small></td>
      <td><span class="amount ${t.type} num">${t.type === 'expense' ? '−' : '+'} ¥${money(t.amount)}</span></td>
      ${!compact ? `<td>${t.source === 'ai' ? `<span class="ai-badge">${icon('spark')}AI 识别</span>` : '<span class="ai-badge manual">手动校对</span>'}</td>` : ''}
      <td>${t.image ? `<img class="receipt-thumb" src="${t.image}" alt="查看${esc(t.summary)}的原始凭证" data-action="view-receipt" data-id="${t.id}">` : `<button class="receipt-none" data-action="view-receipt" data-id="${t.id}" title="查看记录详情">${icon('image')}</button>`}</td>
      ${!compact ? `<td><div class="row-actions"><button class="icon-btn" data-action="view-receipt" data-id="${t.id}" title="查看详情">${icon('eye')}</button>${canDelete ? `<button class="icon-btn" data-action="delete-transaction" data-id="${t.id}" title="删除">${icon('trash')}</button>` : ''}</div></td>` : ''}</tr>`;
  }

  function emptyState(ico, title, text) {
    return `<div class="empty-state"><span>${icon(ico)}</span><h4>${title}</h4><p>${text}</p></div>`;
  }

  function filteredTransactions() {
    const q = txFilters.search.toLowerCase();
    return visibleTransactions().filter(t => {
      const student = userOf(t.studentId);
      return (!q || `${t.summary}${t.note}${student?.name}${t.ocrText}`.toLowerCase().includes(q)) && (txFilters.type === 'all' || t.type === txFilters.type) && (txFilters.branch === 'all' || t.branchId === txFilters.branch);
    }).sort((a,b) => b.date.localeCompare(a.date) || b.uploadDate.localeCompare(a.uploadDate));
  }

  function transactionTable(txs) {
    if (!txs.length) return emptyState('search','没有找到匹配的记录','试试调整搜索词或筛选条件');
    const compact = false;
    return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>摘要</th>${currentUser.role !== 'student' ? '<th>所属学生 / 班级</th>' : ''}<th>交易 / 上传日期</th><th>金额</th><th>录入方式</th><th>原始凭证</th><th style="text-align:right">操作</th></tr></thead><tbody>${txs.map(t => txRow(t, compact)).join('')}</tbody></table></div>`;
  }

  function tableToolbar() {
    return `<div class="table-toolbar"><div class="table-toolbar-left"><div class="search-box">${icon('search')}<input id="tx-search" value="${esc(txFilters.search)}" placeholder="搜索摘要或学生姓名"></div><select id="tx-type" aria-label="收支类型"><option value="all">全部收支</option><option value="deposit" ${txFilters.type==='deposit'?'selected':''}>仅看存入</option><option value="expense" ${txFilters.type==='expense'?'selected':''}>仅看支出</option></select>${currentUser.role === 'teacher' && currentView !== 'passbook' ? `<select id="tx-branch" aria-label="所属班级"><option value="all">全部班级</option>${myBranches().map(b=>`<option value="${b.id}" ${txFilters.branch===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select>` : ''}</div><div class="table-toolbar-right"><span class="muted" style="font-size:10px">共 ${filteredTransactions().length} 笔</span><button class="btn btn-ghost btn-sm" data-action="export">${icon('download')}导出 Excel</button></div></div>`;
  }

  function renderTransactions() {
    return `<div class="page-head"><div><h2>收支明细</h2><p>共 ${visibleTransactions().length} 笔电子存折记录，每一张原始凭证都可追溯。</p></div><div class="page-head-actions"><button class="btn btn-primary" data-action="new-transaction">${icon('plus')}录入凭证</button></div></div><section class="panel">${tableToolbar()}${transactionTable(filteredTransactions())}</section><p class="local-note">${icon('shield')} 上传日期与交易日期分别记录，便于核对补录凭证</p>`;
  }

  function renderPassbook() {
    const txs = visibleTransactions();
    const income = txs.filter(t=>t.type==='deposit').reduce((s,t)=>s+Number(t.amount),0);
    const expense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    return `<div class="page-head"><div><h2>我的电子存折</h2><p>${esc(branchOf(currentUser.branchId)?.name)} · ${esc(currentUser.name)} · 共 ${txs.length} 笔记录</p></div><div class="page-head-actions"><button class="btn btn-ghost" data-action="export">${icon('download')}导出 Excel</button><button class="btn btn-primary" data-action="new-transaction">${icon('plus')}记一笔</button></div></div><section class="balance-hero"><div class="balance-main"><div class="balance-label">${icon('wallet')}当前余额</div><div class="balance-value num"><small>¥</small>${money(income-expense)}</div><div class="balance-caption">MOBANK DIGITAL PASSBOOK</div></div><div class="balance-stat income"><span>累计存入</span><strong class="num">+ ¥${money(income)}</strong><small>坚持储蓄，积少成多</small></div><div class="balance-stat expense"><span>累计支出</span><strong class="num">− ¥${money(expense)}</strong><small>合理规划每一笔支出</small></div></section><section class="panel">${tableToolbar()}${transactionTable(filteredTransactions())}</section>`;
  }

  function renderBranches() {
    const bank = bankOf();
    return `<div class="page-head"><div><h2>班级管理</h2><p>每个班级都有独立班级码，学生凭码进入个人中心。</p></div><div class="page-head-actions"><button class="btn btn-primary" data-action="create-branch">${icon('plus')}开设新班级</button></div></div><section class="report-banner"><div><h3>银行码：<span class="text-green num" style="letter-spacing:3px">${esc(bank?.code)}</span></h3><p>支行服务员使用银行码加入，可协助管理本银行的班级与学生存折。</p></div><div class="page-head-actions"><button class="btn btn-ghost" data-action="copy-code" data-code="${esc(bank?.code)}">${icon('copy')}复制银行码</button><button class="icon-btn" data-action="refresh-bank-code" title="更换银行码">${icon('refresh')}</button></div></section><div class="branch-grid">${myBranches().map(b => {
      const members = db.users.filter(u=>u.branchId===b.id&&u.role==='student');
      return `<article class="branch-card"><div class="branch-card-top"><span class="branch-symbol">${icon('users')}</span><span class="status-badge ${b.active?'':'off'}"><span class="status-dot ${b.active?'':'off'}"></span>${b.active?'开放中':'已暂停'}</span></div><h3>${esc(b.name)}</h3><span class="branch-id">CLASS · ${esc(b.id.slice(-8).toUpperCase())}</span><div class="auth-code-box"><div><small>班级码</small><strong>${esc(b.code)}</strong></div><button class="icon-btn" data-action="copy-code" data-code="${esc(b.code)}" title="复制班级码">${icon('copy')}</button></div><div class="branch-stats"><div><strong>${members.length}</strong><small>学生</small></div><div><strong>${db.transactions.filter(t=>t.branchId===b.id).length}</strong><small>存折记录</small></div><div><strong class="num">¥${money(branchBalance(b.id))}</strong><small>存折结余</small></div></div><div class="branch-card-foot"><span>创建于 ${shortDate(b.createdAt)}</span><div><button class="icon-btn" data-action="refresh-code" data-id="${b.id}" title="更换班级码">${icon('refresh')}</button><button class="icon-btn" data-action="edit-branch" data-id="${b.id}" title="编辑班级">${icon('edit')}</button><button class="icon-btn" data-action="toggle-branch" data-id="${b.id}" title="${b.active?'暂停开放':'恢复开放'}">${icon(b.active?'close':'check')}</button></div></div></article>`;
    }).join('')}</div><div class="notice" style="margin-top:20px">${icon('shield')}<span>更换班级码或银行码后，旧码立即失效，已加入的成员不受影响。暂停班级后，该班学生暂时无法登录。</span></div>`;
  }

  function renderStudents() {
    const all = visibleStudents();
    const users = all.filter(u => studentFilter === 'all' || u.role === studentFilter);
    return `<div class="page-head"><div><h2>${currentUser.role === 'teacher' ? '银行成员' : '银行成员'}</h2><p>管理学生与支行服务员账号，查看个人存折余额。</p></div><div class="page-head-actions"><button class="btn btn-primary" data-action="create-student">${icon('plus')}添加成员</button></div></div><div class="filter-pills"><button class="${studentFilter==='all'?'active':''}" data-action="student-filter" data-filter="all">全部成员 ${all.length}</button><button class="${studentFilter==='student'?'active':''}" data-action="student-filter" data-filter="student">普通学生 ${all.filter(u=>u.role==='student').length}</button><button class="${studentFilter==='teller'?'active':''}" data-action="student-filter" data-filter="teller">支行服务员 ${all.filter(u=>u.role==='teller').length}</button></div><section class="panel">${users.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>成员</th><th>登录账号</th>${currentUser.role==='teacher'?'<th>所属班级</th>':''}<th>角色</th><th>存折余额</th><th>交易笔数</th><th>状态</th><th style="text-align:right">操作</th></tr></thead><tbody>${users.map(u=>`<tr><td><div class="student-cell"><span class="user-avatar">${initials(u.name)}</span><div><strong>${esc(u.name)}</strong><small>加入于 ${shortDate(u.createdAt || '2026-09-01')}</small></div></div></td><td class="num">${esc(u.username)}</td>${currentUser.role==='teacher'?`<td>${esc(branchOf(u.branchId)?.name || '未分配')}</td>`:''}<td><span class="type-badge ${u.role}">${roleName(u.role)}</span></td><td><strong class="amount ${balanceOf(u.id)<0?'expense':'deposit'} num">¥${money(balanceOf(u.id))}</strong></td><td>${db.transactions.filter(t=>t.studentId===u.id).length} 笔</td><td><span class="status-badge ${u.active?'':'off'}"><span class="status-dot ${u.active?'':'off'}"></span>${u.active?'正常':'停用'}</span></td><td><div class="row-actions"><button class="icon-btn" data-action="view-student" data-id="${u.id}" title="查看存折">${icon('eye')}</button><button class="icon-btn" data-action="toggle-user" data-id="${u.id}" title="${u.active?'停用':'启用'}账号">${icon(u.active?'close':'check')}</button></div></td></tr>`).join('')}</tbody></table></div>` : emptyState('users','暂无此类成员','点击右上角添加成员')}</section><p class="local-note">${icon('shield')} 学生使用班级码，支行服务员使用银行码自行注册加入</p>`;
  }

  function renderAIPage() {
    const aiTxs = visibleTransactions().filter(t=>t.source==='ai');
    return `<div class="page-head"><div><h2>AI 凭证识别</h2><p>上传存折、收条或记账凭证照片，自动提取日期、摘要和金额。</p></div></div><div class="ai-intro"><section class="ai-upload-card"><span>${icon('spark')}</span><h3>让纸质存折，轻松变电子表格</h3><p>无需逐字输入。AI 在浏览器中读取凭证文字，你只需核对结果，就能保存到电子存折并导出 Excel。</p><button class="btn" data-action="new-transaction">${icon('upload')}上传凭证开始识别</button></section><section class="ai-steps"><h3>简单三步，完成记账</h3><div class="ai-step"><span>1</span><div><strong>上传清晰图片</strong><p>支持 JPG、PNG、WEBP，单张不超过 5 MB</p></div></div><div class="ai-step"><span>2</span><div><strong>核对 AI 识别结果</strong><p>检查收支类型、交易日期、摘要与金额</p></div></div><div class="ai-step"><span>3</span><div><strong>保存并导出</strong><p>原始图片与电子记录关联，随时导出 Excel</p></div></div></section></div><section class="panel"><div class="panel-head"><div><h3>最近 AI 识别记录</h3><p>识别结果经过人工核对后保存</p></div><span class="ai-badge">${icon('spark')}共 ${aiTxs.length} 条</span></div>${aiTxs.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>摘要</th>${currentUser.role!=='student'?'<th>所属学生 / 班级</th>':''}<th>交易 / 上传日期</th><th>金额</th><th>录入方式</th><th>原始凭证</th><th style="text-align:right">操作</th></tr></thead><tbody>${aiTxs.slice().reverse().slice(0,8).map(t=>txRow(t)).join('')}</tbody></table></div>` : emptyState('scan','还没有 AI 识别记录','上传第一张凭证，体验智能记账')}</section><div class="notice">${icon('help')}<span>AI 首次识别需要联网加载中英文识别模型。识别结果可能有偏差，请务必核对金额后保存；识别失败时仍可手动填写。</span></div>`;
  }

  function renderReports() {
    const txs = visibleTransactions();
    const income = txs.filter(t=>t.type==='deposit').reduce((s,t)=>s+Number(t.amount),0);
    const expense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    const net = income-expense;
    const groups = currentUser.role === 'student' ? [{id:currentUser.branchId,name:'我的存折'}] : myBranches();
    return `<div class="page-head"><div><h2>${currentUser.role==='student'?'我的收支报表':'经营数据报表'}</h2><p>汇总当前权限范围内的电子存折数据。</p></div><div class="page-head-actions"><button class="btn btn-primary" data-action="export">${icon('download')}导出 Excel</button></div></div><section class="report-banner"><div><h3>一份可带走的课堂成长档案</h3><p>导出的表格包含交易日期、上传日期、学生、班级、收支、摘要、原始图片文件名及 AI 识别原文。</p></div><span>${icon('download')}</span></section><section class="stat-grid">${statCard('当前结余',`¥${money(net)}`,'wallet','',`累计 ${txs.length} 笔记录`)}${statCard('累计存入',`¥${money(income)}`,'download','blue',`${txs.filter(t=>t.type==='deposit').length} 笔存入`)}${statCard('累计支出',`¥${money(expense)}`,'upload','amber',`${txs.filter(t=>t.type==='expense').length} 笔支出`)}${statCard('AI 识别率',txs.length?`${Math.round(txs.filter(t=>t.source==='ai').length/txs.length*100)}%`:'0%','spark','gray',`${txs.filter(t=>t.source==='ai').length} 条 AI 辅助记录`)}</section><section class="panel"><div class="panel-head"><div><h3>${currentUser.role==='student'?'月度摘要':'班级数据汇总'}</h3><p>数据实时来源于电子存折</p></div></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>${currentUser.role==='student'?'统计范围':'班级'}</th><th>学生数</th><th>交易笔数</th><th>累计存入</th><th>累计支出</th><th>当前结余</th></tr></thead><tbody>${groups.map(g=>{const gt=txs.filter(t=>t.branchId===g.id);const gi=gt.filter(t=>t.type==='deposit').reduce((s,t)=>s+Number(t.amount),0);const ge=gt.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);return `<tr><td><strong>${esc(g.name)}</strong></td><td>${db.users.filter(u=>u.branchId===g.id&&u.role==='student'&&(currentUser.role!=='student'||u.id===currentUser.id)).length}</td><td>${gt.length}</td><td class="amount deposit">+ ¥${money(gi)}</td><td class="amount expense">− ¥${money(ge)}</td><td><strong>¥${money(gi-ge)}</strong></td></tr>`}).join('')}</tbody></table></div></section><p class="local-note">${icon('shield')} 导出文件采用 Excel 兼容格式，可使用 Excel 或 WPS 打开</p>`;
  }

  function openModal(title, subtitle, body, size = '') {
    $('#modal-root').innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><div><h3 id="modal-title">${title}</h3>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></header>${body}</section></div>`;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('.modal input:not([type=hidden]), .modal button')?.focus(), 50);
  }

  function closeModal() {
    $('#modal-root').innerHTML = '';
    document.body.style.overflow = '';
    pendingReceipt = null;
    ocrRunning = false;
  }

  let confirmCallback = null;
  function confirmAction(title, text, callback, confirmText = '确认') {
    confirmCallback = callback;
    openModal('请确认操作','此操作会立即生效',`<div class="modal-body"><div class="confirm-icon">${icon('help')}</div><div class="confirm-text"><h3>${title}</h3><p>${text}</p></div></div><div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="confirm-yes">${confirmText}</button></div>`);
  }

  function openBranchModal(id = '') {
    const branch = branchOf(id);
    openModal(branch?'编辑班级':'开设新班级',branch?'更新班级名称与开放信息':'系统将自动生成学生加入所需的班级码',`<form id="branch-form" data-id="${id}"><div class="modal-body modal-form"><label>班级名称<input name="name" value="${esc(branch?.name || '')}" placeholder="例如：六年级一班" maxlength="20" required></label>${branch?'':`<div class="notice">${icon('shield')}<span>开设后可将班级码分享给学生，学生验证邮箱后即可进入个人中心。</span></div>`}</div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-action="close-modal">取消</button><button type="submit" class="btn btn-primary">${branch?'保存修改':'确认开设'}</button></div></form>`);
  }

  function saveBranch(form) {
    const name = String(new FormData(form).get('name') || '').trim();
    if (!name) return;
    if (form.dataset.id) {
      const branch = branchOf(form.dataset.id);
      if (branch) branch.name = name;
      toast('班级信息已更新');
    } else {
      let code = makeCode();
      while (db.branches.some(b=>b.code===code)) code=makeCode();
      db.branches.push({id:uid('branch'),bankId:currentUser.bankId,name,code,active:true,createdAt:today()});
      toast(`「${name}」开设成功`);
    }
    save(); closeModal(); refreshPage();
  }

  function openStudentModal() {
    const branches = myBranches().filter(b=>b.active);
    if (!branches.length) return toast('请先开设一个正常开放的班级','error');
    openModal('添加银行成员','学生使用班级码自行注册，支行服务员使用银行码加入',`<form id="student-form"><div class="modal-body modal-form"><div class="form-grid two"><label>姓名<input name="name" placeholder="学生姓名" required></label><label>登录账号<input name="username" placeholder="至少 3 位" minlength="3" required></label></div><div class="form-grid two"><label>初始密码<input name="password" type="password" value="123456" minlength="6" required></label><label>成员角色<select name="role"><option value="student">普通学生</option><option value="teller">支行服务员</option></select></label></div><label>所属班级<select name="branchId" required>${branches.map(b=>`<option value="${b.id}">${esc(b.name)} · ${esc(b.code)}</option>`).join('')}</select></label></div><div class="modal-foot"><button type="button" class="btn btn-ghost" data-action="close-modal">取消</button><button type="submit" class="btn btn-primary">创建账号</button></div></form>`);
  }

  function saveStudent(form) {
    const fd = new FormData(form);
    const username = String(fd.get('username')||'').trim();
    if (db.users.some(u=>u.username.toLowerCase()===username.toLowerCase())) return toast('登录账号已存在，请更换','error');
    const user = {id:uid('user'),name:String(fd.get('name')).trim(),username,password:String(fd.get('password')),role:fd.get('role')==='teller'?'teller':'student',branchId:String(fd.get('branchId')),bankId:currentUser.bankId,active:true,createdAt:today()};
    db.users.push(user); save(); closeModal(); refreshPage(); toast(`已创建 ${user.name} 的${roleName(user.role)}账号`);
  }

  function viewReceipt(id) {
    const tx = db.transactions.find(t=>t.id===id && visibleTransactions().some(v=>v.id===id));
    if (!tx) return toast('无法查看该记录','error');
    const student = userOf(tx.studentId);
    openModal('存折记录详情',`${esc(tx.summary)} · ${fullDate(tx.date)}`,`<div class="modal-body"><div class="receipt-view"><div>${tx.image?`<img src="${tx.image}" alt="原始存折凭证">`:`<div class="receipt-preview" style="height:260px"><div class="placeholder">${icon('image')}<p>演示记录未附图片<br>新录入的记录会保存原始凭证</p></div></div>`}</div><div class="receipt-meta"><div class="meta-row"><small>所属学生 / 班级</small><strong>${esc(student?.name)} · ${esc(branchOf(tx.branchId)?.name)}</strong></div><div class="meta-row"><small>交易金额</small><strong class="amount ${tx.type}">${tx.type==='deposit'?'+':'−'} ¥${money(tx.amount)}</strong></div><div class="meta-row"><small>交易日期 / 上传日期</small><strong>${fullDate(tx.date)}<br>${fullDate(tx.uploadDate)}</strong></div><div class="meta-row"><small>摘要与备注</small><strong>${esc(tx.summary)}</strong><p class="muted" style="font-size:10px;margin:4px 0 0">${esc(tx.note||'无备注')}</p></div><div class="meta-row"><small>录入方式</small>${tx.source==='ai'?`<span class="ai-badge">${icon('spark')}AI 识别并人工校对</span>`:'<span class="ai-badge manual">手动填写</span>'}</div>${tx.ocrText?`<div><small class="muted">AI 识别原文</small><div class="ocr-raw">${esc(tx.ocrText)}</div></div>`:''}</div></div></div><div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button></div>`,'modal-lg');
  }

  function viewStudent(id) {
    const student = visibleStudents().find(u=>u.id===id);
    if (!student) return;
    const txs = db.transactions.filter(t=>t.studentId===id).sort((a,b)=>b.date.localeCompare(a.date));
    const income = txs.filter(t=>t.type==='deposit').reduce((s,t)=>s+Number(t.amount),0);
    const expense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    openModal(`${esc(student.name)}的电子存折`,`${esc(branchOf(student.branchId)?.name)} · ${roleName(student.role)}`,`<div class="modal-body"><div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:15px">${statCard('当前余额',`¥${money(income-expense)}`,'wallet','','')}${statCard('累计存入',`¥${money(income)}`,'download','blue','')}${statCard('累计支出',`¥${money(expense)}`,'upload','amber','')}</div>${txs.length?`<div class="data-table-wrap" style="max-height:330px;overflow:auto"><table class="data-table"><thead><tr><th>摘要</th><th>日期</th><th>金额</th><th>凭证</th></tr></thead><tbody>${txs.map(t=>txRow(t,true)).join('')}</tbody></table></div>`:emptyState('book','暂无存折记录','可以通过 AI 凭证识别为学生记账')}</div><div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">关闭</button><button class="btn btn-primary" data-action="export-student" data-id="${id}">${icon('download')}导出该生存折</button></div>`,'modal-lg');
  }

  function openTransactionModal(studentId = '') {
    const students = db.users.filter(u=>u.role==='student' && u.active && u.bankId===currentUser.bankId && (currentUser.role!=='student' || u.id===currentUser.id));
    if (!students.length) return toast('暂无可用学生账号，请先添加学生','error');
    pendingReceipt = null;
    const fixedStudent = currentUser.role==='student';
    openModal('上传存折凭证','上传图片后自动运行 AI 识别，核对信息再保存',`<form id="transaction-form"><div class="modal-body"><div class="ocr-layout"><div><label class="upload-zone" id="upload-zone"><input type="file" id="receipt-file" accept="image/jpeg,image/png,image/webp"><span>${icon('upload')}</span><strong>点击上传凭证图片</strong><small>JPG / PNG / WEBP · 不超过 5 MB</small></label><div id="receipt-preview" class="receipt-preview hidden"></div><button type="button" class="btn btn-ghost btn-sm upload-mini hidden" id="reupload-btn" data-action="reupload">${icon('refresh')}重新选择图片</button><div id="ocr-progress" class="ocr-progress hidden"><div class="ocr-progress-head"><span id="ocr-status">准备识别...</span><strong id="ocr-percent">0%</strong></div><div class="progress-track"><span id="ocr-bar"></span></div><div id="ocr-raw" class="ocr-result-text"></div></div></div><div class="ocr-fields"><h4>${icon('spark')}电子存折信息 <span class="ocr-confidence" id="ocr-state">等待上传</span></h4><label>所属学生${fixedStudent?`<input type="hidden" name="studentId" value="${currentUser.id}"><input value="${esc(currentUser.name)} · ${esc(branchOf(currentUser.branchId)?.name)}" disabled>`:`<select name="studentId" required>${students.map(s=>`<option value="${s.id}" ${s.id===studentId?'selected':''}>${esc(s.name)} · ${esc(branchOf(s.branchId)?.name)}</option>`).join('')}</select>`}</label><div class="form-grid two"><label>收支类型<select name="type" id="ocr-type"><option value="deposit">存入</option><option value="expense">支出</option></select></label><label>金额（元）<input name="amount" id="ocr-amount" type="number" min="0.01" step="0.01" placeholder="0.00" required></label></div><label>交易摘要<input name="summary" id="ocr-summary" maxlength="40" placeholder="例如：本周储蓄" required></label><div class="form-grid two"><label>交易日期<input name="date" id="ocr-date" type="date" value="${today()}" max="${today()}" required></label><label>上传日期<input name="uploadDate" type="date" value="${today()}" readonly></label></div><label>备注（选填）<textarea name="note" maxlength="120" placeholder="补充用途或储蓄目标"></textarea></label><div class="notice">${icon('help')}<span>AI 结果仅供辅助，请对照原图核对，尤其是金额和日期。</span></div></div></div></div><div class="modal-foot"><span id="receipt-required" class="muted" style="font-size:10px;margin-right:auto;align-self:center">请先上传一张凭证图片</span><button type="button" class="btn btn-ghost" data-action="close-modal">取消</button><button type="submit" class="btn btn-primary" id="save-transaction" disabled>${icon('check')}保存到电子存折</button></div></form>`,'modal-xl');
  }

  async function compressImage(file) {
    const data = await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const max = 1400;
        const scale = Math.min(1,max/Math.max(img.width,img.height));
        const canvas = document.createElement('canvas');
        canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
        canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/jpeg',.84));
      };
      img.onerror=()=>resolve(data);img.src=data;
    });
  }

  let tesseractPromise = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractPromise) return tesseractPromise;
    tesseractPromise = new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload=()=>resolve(window.Tesseract);
      script.onerror=()=>reject(new Error('AI 模型加载失败，请检查网络后重试，或手动填写凭证信息'));
      document.head.appendChild(script);
    });
    return tesseractPromise;
  }

  function parseReceiptText(raw) {
    const text = raw.replace(/[，]/g,',').replace(/[：]/g,':').trim();
    const lines = text.split(/\n+/).map(s=>s.trim()).filter(Boolean);
    const dateMatch = text.match(/(20\d{2})[年.\-/](\d{1,2})[月.\-/](\d{1,2})/);
    let date = today();
    if (dateMatch) {
      const candidate = `${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}`;
      if (!Number.isNaN(Date.parse(`${candidate}T00:00:00`)) && candidate <= today()) date=candidate;
    }
    const withoutDates = text.replace(/20\d{2}[年.\-/]\d{1,2}[月.\-/]\d{1,2}日?/g,' ');
    const amountMatches = [...withoutDates.matchAll(/(?:[¥￥]\s*)?(\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:元|块|RMB|CNY)/gi)];
    let amount = amountMatches.length ? amountMatches[amountMatches.length-1][1].replace(/,/g,'') : '';
    if (!amount) {
      const currency = withoutDates.match(/[¥￥]\s*(\d{1,7}(?:,\d{3})*(?:\.\d{1,2})?)/);
      if (currency) amount=currency[1].replace(/,/g,'');
    }
    const isExpense = /支出|消费|付款|购买|取现|借出|学费|餐费/.test(text);
    const keywordMap = [[/图书|书店/,'图书购买'],[/食堂|餐费|午餐/,'校园餐饮'],[/文具|笔记本|学习用品/,'学习用品'],[/利息/,'储蓄利息'],[/劳动|值日|奖励/,'劳动奖励'],[/储蓄|存款|存入/,'储蓄存入']];
    const matched = keywordMap.find(([regex])=>regex.test(text));
    let summary = matched ? matched[1] : (isExpense?'凭证支出':'凭证存入');
    return {date,amount,summary,type:isExpense?'expense':'deposit',raw:text};
  }

  async function handleReceipt(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('请上传 JPG、PNG 或 WEBP 图片','error');
    if (file.size>5*1024*1024) return toast('图片不能超过 5 MB，请压缩后重试','error');
    try {
      const image = await compressImage(file);
      pendingReceipt = {image,imageName:file.name,rawText:'',confidence:0};
      $('#upload-zone')?.classList.add('hidden');
      const preview=$('#receipt-preview');
      if(preview){preview.classList.remove('hidden');preview.innerHTML=`<img src="${image}" alt="待识别存折凭证">`;}
      $('#reupload-btn')?.classList.remove('hidden');
      $('#save-transaction')?.removeAttribute('disabled');
      if($('#receipt-required')) $('#receipt-required').textContent=file.name;
      if($('#ocr-state')) $('#ocr-state').textContent='AI 识别中';
      if($('#ocr-progress')) $('#ocr-progress').classList.remove('hidden');
      if($('#ocr-status')) $('#ocr-status').textContent='正在加载 AI 识别模型';
      ocrRunning=true;
      const receiptRef=pendingReceipt;
      const Tesseract=await loadTesseract();
      if(!ocrRunning||pendingReceipt!==receiptRef)return;
      const result=await Tesseract.recognize(image,'chi_sim+eng',{logger:m=>{
        if(!ocrRunning||pendingReceipt!==receiptRef)return;
        if(m.status==='recognizing text'){
          const p=Math.round((m.progress||0)*100);
          if($('#ocr-status'))$('#ocr-status').textContent='AI 正在识别凭证文字';
          if($('#ocr-percent'))$('#ocr-percent').textContent=`${p}%`;
          if($('#ocr-bar'))$('#ocr-bar').style.width=`${p}%`;
        }
      }});
      if(!ocrRunning||pendingReceipt!==receiptRef)return;
      const raw=result?.data?.text||'';
      const parsed=parseReceiptText(raw);
      pendingReceipt.rawText=raw;
      pendingReceipt.confidence=Math.round(result?.data?.confidence||0);
      if($('#ocr-amount')&&parsed.amount)$('#ocr-amount').value=parsed.amount;
      if($('#ocr-summary'))$('#ocr-summary').value=parsed.summary;
      if($('#ocr-date'))$('#ocr-date').value=parsed.date;
      if($('#ocr-type'))$('#ocr-type').value=parsed.type;
      if($('#ocr-raw'))$('#ocr-raw').textContent=raw?`识别原文：${raw}`:'未读取到明确文字，请对照原图手动填写。';
      if($('#ocr-status'))$('#ocr-status').textContent='识别完成，请核对信息';
      if($('#ocr-percent'))$('#ocr-percent').textContent='100%';
      if($('#ocr-bar'))$('#ocr-bar').style.width='100%';
      if($('#ocr-state'))$('#ocr-state').textContent=raw?`置信度 ${pendingReceipt.confidence}%`:'请手动填写';
      ocrRunning=false;
    } catch(error) {
      ocrRunning=false;
      if($('#ocr-status'))$('#ocr-status').textContent='AI 暂不可用，可手动填写';
      if($('#ocr-state'))$('#ocr-state').textContent='手动校对模式';
      if($('#ocr-raw'))$('#ocr-raw').textContent=error.message||'识别失败，请检查图片与网络';
      toast(error.message||'图片处理失败，请重试','error');
    }
  }

  function saveTransaction(form) {
    if(!pendingReceipt?.image)return toast('请先上传凭证图片','error');
    const fd=new FormData(form);
    const student=db.users.find(u=>u.id===fd.get('studentId')&&u.role==='student');
    const amount=Number(fd.get('amount'));
    if(!student||student.bankId!==currentUser.bankId)return toast('请选择有效的学生账号','error');
    if(currentUser.role==='student'&&student.id!==currentUser.id)return toast('只能记录自己的电子存折','error');
    if(!amount||amount<=0)return toast('请输入正确金额','error');
    const tx={id:uid('tx'),bankId:student.bankId,branchId:student.branchId,studentId:student.id,date:String(fd.get('date')),uploadDate:String(fd.get('uploadDate')),type:fd.get('type')==='expense'?'expense':'deposit',amount:Math.round(amount*100)/100,summary:String(fd.get('summary')||'').trim(),note:String(fd.get('note')||'').trim(),source:pendingReceipt.rawText?'ai':'manual',ocrText:pendingReceipt.rawText,imageName:pendingReceipt.imageName,image:pendingReceipt.image,createdBy:currentUser.id,createdAt:new Date().toISOString()};
    if(!tx.date||!tx.summary)return toast('请完整填写交易日期和摘要','error');
    db.transactions.push(tx);save();closeModal();refreshPage();toast(`已保存 ${student.name} 的一笔${tx.type==='deposit'?'存入':'支出'}记录`);
  }

  function exportExcel(studentId = '') {
    const source=studentId?db.transactions.filter(t=>t.studentId===studentId):filteredTransactions();
    if(!source.length)return toast('当前没有可导出的记录','error');
    const student=studentId?userOf(studentId):null;
    const rows=source.map((t,i)=>{const u=userOf(t.studentId);return [i+1,t.date,t.uploadDate,u?.name||'',u?.username||'',branchOf(t.branchId)?.name||'',t.type==='deposit'?'存入':'支出',Number(t.amount).toFixed(2),t.summary,t.note,t.source==='ai'?'AI 识别并校对':'手动填写',t.imageName||'未附文件名',t.ocrText||''];});
    const headers=['序号','交易日期','上传日期','学生姓名','登录账号','所属班级','收支类型','金额（元）','摘要','备注','录入方式','原始图片文件名','AI 识别原文'];
    const cell=(v,header=false)=>`<${header?'th':'td'} style="border:1px solid #d9e0d8;padding:7px;${header?'background:#175c49;color:#fff;font-weight:bold;':''}">${esc(v)}</${header?'th':'td'}>`;
    const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>电子存折</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table><tr><th colspan="${headers.length}" style="font-size:18px;background:#e4f1e9;padding:12px">${esc(bankOf()?.name)} · ${esc(student?.name||'电子存折明细')}</th></tr><tr>${headers.map(h=>cell(h,true)).join('')}</tr>${rows.map(r=>`<tr>${r.map(v=>cell(v)).join('')}</tr>`).join('')}</table></body></html>`;
    const blob=new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`模拟银行_${student?.name||bankOf()?.name||'电子存折'}_${today()}.xls`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`已导出 ${rows.length} 条存折记录`);
  }

  async function copyCode(code) {
    try { await navigator.clipboard.writeText(code); }
    catch(error) {
      const input=document.createElement('textarea');input.value=code;document.body.appendChild(input);input.select();document.execCommand('copy');input.remove();
    }
    toast(`加入码 ${code} 已复制`);
  }

  document.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-action]');
    if(!trigger)return;
    const action=trigger.dataset.action;
    if(action!=='backdrop-close'||event.target===trigger)event.preventDefault();
    switch(action){
      case 'focus-login': $('#auth-panel').scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>$('#login-form input')?.focus(),400);break;
      case 'auth-tab': switchAuth(trigger.dataset.mode);break;
      case 'toggle-password': {const input=trigger.parentElement.querySelector('input');input.type=input.type==='password'?'text':'password';break;}
      case 'demo-login': login(trigger.dataset.user,'123456');break;
      case 'send-email-code': sendEmailCode();break;
      case 'logout': logout();break;
      case 'nav': currentView=trigger.dataset.view;renderApp();break;
      case 'mobile-menu': $('#sidebar')?.classList.toggle('mobile-open');break;
      case 'close-modal': closeModal();break;
      case 'backdrop-close': if(event.target===trigger)closeModal();break;
      case 'create-branch': if(currentUser.role==='teacher')openBranchModal();break;
      case 'edit-branch': openBranchModal(trigger.dataset.id);break;
      case 'copy-code': copyCode(trigger.dataset.code);break;
      case 'refresh-code': {const b=branchOf(trigger.dataset.id);if(b)confirmAction('更换班级码？',`更换后，${esc(b.name)}的旧班级码 ${esc(b.code)} 将立即失效。已加入学生不受影响。`,()=>{let code=makeCode();while(db.branches.some(x=>x.code===code))code=makeCode();b.code=code;save();refreshPage();toast(`新班级码为 ${code}`);},'确认更换');break;}
      case 'refresh-bank-code': {const bank=bankOf();if(bank)confirmAction('更换银行码？',`更换后，旧银行码 ${esc(bank.code)} 将立即失效，已加入的支行服务员不受影响。`,()=>{let code=makeCode();while(db.banks.some(x=>x.code===code))code=makeCode();bank.code=code;save();renderApp();toast(`新银行码为 ${code}`);},'确认更换');break;}
      case 'toggle-branch': {const b=branchOf(trigger.dataset.id);if(b)confirmAction(b.active?'暂停该班级？':'恢复该班级？',b.active?`暂停后，${esc(b.name)}的成员将无法登录，已有存折记录会保留。`:`恢复后，${esc(b.name)}的成员可以正常登录并记录收支。`,()=>{b.active=!b.active;save();refreshPage();toast(b.active?'班级已恢复开放':'班级已暂停开放');},b.active?'确认暂停':'确认恢复');break;}
      case 'create-student': openStudentModal();break;
      case 'student-filter': studentFilter=trigger.dataset.filter;refreshPage();break;
      case 'view-student': viewStudent(trigger.dataset.id);break;
      case 'toggle-user': {const u=visibleStudents().find(x=>x.id===trigger.dataset.id);if(u)confirmAction(u.active?'停用该账号？':'启用该账号？',u.active?`${esc(u.name)}将无法登录，电子存折数据仍会保留。`:`${esc(u.name)}将恢复正常登录。`,()=>{u.active=!u.active;save();refreshPage();toast(u.active?'账号已启用':'账号已停用');},u.active?'确认停用':'确认启用');break;}
      case 'new-transaction': openTransactionModal();break;
      case 'view-receipt': viewReceipt(trigger.dataset.id);break;
      case 'delete-transaction': {const tx=visibleTransactions().find(t=>t.id===trigger.dataset.id);if(tx)confirmAction('删除这笔存折记录？',`将删除「${esc(tx.summary)}」¥${money(tx.amount)} 及关联的原始图片，删除后无法恢复。`,()=>{db.transactions=db.transactions.filter(t=>t.id!==tx.id);save();refreshPage();toast('存折记录已删除');},'确认删除');break;}
      case 'export': exportExcel();break;
      case 'export-student': {const id=trigger.dataset.id;closeModal();exportExcel(id);break;}
      case 'reupload': $('#receipt-file')?.click();break;
      case 'confirm-yes': {const callback=confirmCallback;confirmCallback=null;closeModal();if(callback)callback();break;}
    }
  });

  document.addEventListener('submit',event=>{
    event.preventDefault();
    const form=event.target;
    if(form.id==='login-form'){const fd=new FormData(form);login(String(fd.get('username')||''),String(fd.get('password')||''));}
    if(form.id==='register-form')register(form);
    if(form.id==='branch-form')saveBranch(form);
    if(form.id==='student-form')saveStudent(form);
    if(form.id==='transaction-form')saveTransaction(form);
  });

  document.addEventListener('change',event=>{
    const el=event.target;
    if(el.name==='registerRole'){
      syncRegistrationRole(el.value);
      $$('input[name="registerRole"]').forEach(input=>input.closest('.role-option').classList.toggle('active',input.checked));
    }
    if(el.id==='receipt-file')handleReceipt(el.files[0]);
    if(el.id==='tx-type'){txFilters.type=el.value;refreshPage();}
    if(el.id==='tx-branch'){txFilters.branch=el.value;refreshPage();}
  });

  let searchTimer=null;
  document.addEventListener('input',event=>{
    if(event.target.id!=='tx-search')return;
    const value=event.target.value;
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{txFilters.search=value;refreshPage();const input=$('#tx-search');if(input){input.focus();input.setSelectionRange(value.length,value.length);}},220);
  });

  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#modal-root').children.length)closeModal();});

  const sessionId=sessionStorage.getItem(SESSION_KEY);
  const sessionUser=db.users.find(u=>u.id===sessionId&&u.active);
  if(sessionUser&&(!sessionUser.branchId||branchOf(sessionUser.branchId)?.active)){
    currentUser=sessionUser;renderApp();
  }else{
    sessionStorage.removeItem(SESSION_KEY);switchAuth('login');
  }
})();
