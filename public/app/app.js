const API = '';
let token = localStorage.getItem('eco_token');
let currentUser = null;
let selectedWaste = { type: 'Пластик', rate: 12 };

// ── HELPERS ──────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...opts
  });
  return res.json();
}

function showToast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function formatDate(str) {
  const d = new Date(str);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// ── AUTH ──────────────────────────────────────────────
function showLogin() {
  document.getElementById('loginForm').classList.add('active');
  document.getElementById('registerForm').classList.remove('active');
}
function showRegister() {
  document.getElementById('registerForm').classList.add('active');
  document.getElementById('loginForm').classList.remove('active');
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  document.getElementById('loginError').textContent = '';
  if (!email || !password) return (document.getElementById('loginError').textContent = 'Заполните все поля');
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Входим...'; btn.disabled = true;
  const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  btn.textContent = 'Войти →'; btn.disabled = false;
  if (data.error) return (document.getElementById('loginError').textContent = data.error);
  token = data.token;
  localStorage.setItem('eco_token', token);
  initApp();
});

document.getElementById('registerBtn').addEventListener('click', async () => {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  document.getElementById('regError').textContent = '';
  if (!name || !email || !password) return (document.getElementById('regError').textContent = 'Заполните обязательные поля');
  const btn = document.getElementById('registerBtn');
  btn.textContent = 'Создаём...'; btn.disabled = true;
  const data = await api('/api/register', { method: 'POST', body: JSON.stringify({ name, email, phone, password }) });
  btn.textContent = 'Создать аккаунт 🌿'; btn.disabled = false;
  if (data.error) return (document.getElementById('regError').textContent = data.error);
  token = data.token;
  localStorage.setItem('eco_token', token);
  showToast(data.message || 'Добро пожаловать! 🌿');
  initApp();
});

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('eco_token');
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  showLogin();
}

// ── APP INIT ──────────────────────────────────────────
async function initApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  await loadUser();
  await loadTransactions();
  await loadLeaderboard();
  await loadAchievements();
}

async function loadUser() {
  const data = await api('/api/me');
  if (data.error) return logout();
  currentUser = data;
  const trees = Math.round(data.total_kg * 0.1);
  document.getElementById('heroName').textContent = data.name.split(' ')[0];
  document.getElementById('heroBalance').textContent = data.balance.toLocaleString('ru-RU');
  document.getElementById('heroLevel').textContent = data.level;
  document.getElementById('navBalance').textContent = data.balance.toLocaleString('ru-RU') + ' 🪙';
  document.getElementById('statKg').textContent = data.total_kg.toFixed(1);
  document.getElementById('statTrees').textContent = trees;
  document.getElementById('profileName').textContent = data.name;
  document.getElementById('profileLevel').textContent = data.level;
  document.getElementById('profileEmail').textContent = data.email;
  document.getElementById('psBalance').textContent = data.balance.toLocaleString('ru-RU');
  document.getElementById('psKg').textContent = data.total_kg.toFixed(1);
  document.getElementById('psTrees').textContent = trees;
}

async function loadTransactions() {
  const txs = await api('/api/transactions');
  if (!Array.isArray(txs)) return;

  const icons = { 'Пластик':'🧴','Бумага':'📦','Стекло':'🍾','Металл':'🔩','Электроника':'📱','bonus':'🎁','spend':'🛍️' };

  const renderTx = (tx) => {
    const isEarn = tx.coins > 0;
    const icon = icons[tx.waste_type] || icons[tx.type] || '🪙';
    return `<div class="tx-item">
      <div class="tx-icon">${icon}</div>
      <div class="tx-info"><span>${tx.description}</span><small>${formatDate(tx.created_at)}</small></div>
      <div class="tx-amount ${isEarn ? 'plus' : 'minus'}">${isEarn ? '+' : ''}${tx.coins} 🪙</div>
    </div>`;
  };

  document.getElementById('recentTx').innerHTML = txs.slice(0, 5).map(renderTx).join('') || '<p class="tx-empty">Операций пока нет</p>';
  document.getElementById('allTx').innerHTML = txs.map(renderTx).join('') || '<p class="tx-empty">Операций пока нет</p>';
}

async function loadLeaderboard() {
  const board = await api('/api/leaderboard');
  if (!Array.isArray(board)) return;
  const rankClass = ['gold', 'silver', 'bronze'];
  document.getElementById('leaderboard').innerHTML = board.map((u, i) => `
    <div class="lb-item">
      <div class="lb-rank ${rankClass[i] || ''}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
      <div class="lb-name">${u.name}</div>
      <div class="lb-score">${u.balance.toLocaleString('ru-RU')} 🪙</div>
    </div>`).join('');

  const myRank = board.findIndex(u => u.id === currentUser?.id);
  document.getElementById('statRank').textContent = myRank >= 0 ? `#${myRank + 1}` : '—';
}

const ALL_ACHIEVEMENTS = [
  { name: 'Первая сдача', icon: '🌱' },
  { name: 'Переработчик', icon: '♻️' },
  { name: 'Тысячник', icon: '💎' },
  { name: 'Эко-Герой', icon: '🏆' },
  { name: 'Серия x7', icon: '🔥' },
];

async function loadAchievements() {
  const earned = await api('/api/achievements');
  const earnedNames = Array.isArray(earned) ? earned.map(a => a.name) : [];

  const render = ALL_ACHIEVEMENTS.map(a => `
    <div class="ach-item ${earnedNames.includes(a.name) ? '' : 'locked'}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
    </div>`).join('');

  document.getElementById('homeAchieves').innerHTML = render;
  document.getElementById('profileAchieves').innerHTML = render;
}

// ── WASTE ─────────────────────────────────────────────
function selectWasteType(el) {
  document.querySelectorAll('.waste-type-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedWaste = { type: el.dataset.type, rate: parseInt(el.dataset.rate) };
  updateCalc();
}

function changeWeight(delta) {
  const inp = document.getElementById('weightVal');
  let val = parseFloat(inp.value) + delta;
  if (val < 0.1) val = 0.1;
  inp.value = Math.round(val * 10) / 10;
  updateCalc();
}

function updateCalc() {
  const kg = parseFloat(document.getElementById('weightVal').value) || 0;
  document.getElementById('coinsCalc').textContent = Math.round(kg * selectedWaste.rate).toLocaleString('ru-RU');
}

async function submitWaste() {
  const kg = parseFloat(document.getElementById('weightVal').value);
  if (!kg || kg <= 0) return showToast('Укажите вес', true);
  const btn = document.getElementById('submitWasteBtn');
  btn.textContent = 'Отправляем...'; btn.disabled = true;

  const data = await api('/api/waste', { method: 'POST', body: JSON.stringify({ waste_type: selectedWaste.type, kg }) });
  btn.textContent = 'Подтвердить сдачу ✅'; btn.disabled = false;

  if (data.error) return showToast(data.error, true);

  const msg = document.getElementById('wasteSuccess');
  msg.textContent = `✅ Начислено +${data.coins} монет! Баланс: ${data.balance.toLocaleString('ru-RU')} 🪙`;
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 4000);

  if (data.newAchievements?.length) {
    showToast('🏅 Новое достижение: ' + data.newAchievements[0]);
  } else {
    showToast(`+${data.coins} ЭКО Coin начислено! 🪙`);
  }

  await loadUser();
  await loadTransactions();
  await loadAchievements();
  await loadLeaderboard();
}

// ── SPEND ─────────────────────────────────────────────
async function spendCoins(coins, description) {
  if (!currentUser || currentUser.balance < coins) return showToast('Недостаточно монет', true);
  const data = await api('/api/spend', { method: 'POST', body: JSON.stringify({ coins, description }) });
  if (data.error) return showToast(data.error, true);
  showToast(`-${coins} 🪙 · ${description}`);
  const msg = document.getElementById('spendMsg');
  msg.textContent = `✅ Оплачено: ${description}`;
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 3000);
  await loadUser();
  await loadTransactions();
}

// ── TABS ──────────────────────────────────────────────
function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.bnav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-${tab}-content`).classList.remove('hidden');
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  if (tab === 'history') loadTransactions();
  if (tab === 'profile') { loadUser(); loadAchievements(); }
}

// ── PWA SERVICE WORKER ────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── BOOT ──────────────────────────────────────────────
if (token) {
  initApp();
} else {
  document.getElementById('authScreen').classList.remove('hidden');
}
