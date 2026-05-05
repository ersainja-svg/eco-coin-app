const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'eco_coin_secret_key_2026';
const DATA_FILE = path.join(__dirname, 'data.json');

// ── SIMPLE JSON STORAGE ─────────────────────────────────────
let store = { users: [], transactions: [], achievements: [], nextId: { u: 1, t: 1, a: 1 } };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) { console.log('Fresh start'); }
}

function saveData() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(store), 'utf8'); } catch (e) {}
}

loadData();

function nextId(type) {
  if (!store.nextId) store.nextId = { u: 1, t: 1, a: 1 };
  return store.nextId[type]++;
}

function getLevel(balance) {
  if (balance >= 5000) return 'Эко-Легенда 🏆';
  if (balance >= 2000) return 'Эко-Чемпион 🥇';
  if (balance >= 1000) return 'Эко-Герой 🌟';
  if (balance >= 500)  return 'Переработчик ♻️';
  if (balance >= 100)  return 'Эко-Активист 🌿';
  return 'Новичок 🌱';
}

app.use(cors());
app.use(express.json());

// ── STATIC FILES ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── AUTH MIDDLEWARE ───────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Неверный токен' }); }
}

// ── API ROUTES ────────────────────────────────────────────────

app.post('/api/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Заполните все поля' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  if (store.users.find(u => u.email === email))
    return res.status(400).json({ error: 'Email уже используется' });

  const id = nextId('u');
  const hash = bcrypt.hashSync(password, 10);
  const user = { id, name, email, phone: phone || '', password: hash, balance: 50, total_kg: 0, avatar: '🧑', created_at: new Date().toISOString() };
  store.users.push(user);

  const txId = nextId('t');
  store.transactions.push({ id: txId, user_id: id, type: 'bonus', waste_type: null, kg: null, coins: 50, description: 'Приветственный бонус 🎉', created_at: new Date().toISOString() });
  saveData();

  const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token, message: 'Добро пожаловать! +50 монет 🎉' });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = store.users.find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Неверный email или пароль' });
  const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token });
});

app.get('/api/me', auth, (req, res) => {
  const user = store.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Не найден' });
  const { password, ...safe } = user;
  safe.level = getLevel(safe.balance);
  res.json(safe);
});

app.get('/api/transactions', auth, (req, res) => {
  const txs = store.transactions.filter(t => t.user_id === req.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20);
  res.json(txs);
});

app.post('/api/waste', auth, (req, res) => {
  const { waste_type, kg } = req.body;
  const rates = { 'Пластик': 12, 'Бумага': 8, 'Стекло': 6, 'Металл': 15, 'Электроника': 20 };
  const rate = rates[waste_type];
  if (!rate || !kg || kg <= 0) return res.status(400).json({ error: 'Неверные данные' });

  const coins = Math.round(kg * rate);
  const user = store.users.find(u => u.id === req.user.id);
  user.balance += coins;
  user.total_kg = (user.total_kg || 0) + parseFloat(kg);

  store.transactions.push({ id: nextId('t'), user_id: user.id, type: 'earn', waste_type, kg, coins, description: `${waste_type} — ${kg} кг`, created_at: new Date().toISOString() });

  const earned = store.achievements.filter(a => a.user_id === user.id).map(a => a.name);
  const newAchievements = [];

  const maybeAdd = (cond, name, icon) => {
    if (cond && !earned.includes(name)) {
      store.achievements.push({ id: nextId('a'), user_id: user.id, name, icon, created_at: new Date().toISOString() });
      newAchievements.push(name + ' ' + icon);
    }
  };
  maybeAdd(true, 'Первая сдача', '🌱');
  maybeAdd(user.total_kg >= 10, 'Переработчик', '♻️');
  maybeAdd(user.balance >= 1000, 'Тысячник', '💎');
  maybeAdd(user.balance >= 5000, 'Эко-Герой', '🏆');

  saveData();
  res.json({ success: true, coins, balance: user.balance, newAchievements });
});

app.post('/api/spend', auth, (req, res) => {
  const { coins, description } = req.body;
  const user = store.users.find(u => u.id === req.user.id);
  if (!user || user.balance < coins) return res.status(400).json({ error: 'Недостаточно монет' });
  user.balance -= coins;
  store.transactions.push({ id: nextId('t'), user_id: user.id, type: 'spend', coins: -coins, description, created_at: new Date().toISOString() });
  saveData();
  res.json({ success: true, balance: user.balance });
});

app.get('/api/leaderboard', (_, res) => {
  const top = store.users
    .map(({ id, name, balance, total_kg, avatar }) => ({ id, name, balance, total_kg, avatar }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);
  res.json(top);
});

app.get('/api/achievements', auth, (req, res) => {
  res.json(store.achievements.filter(a => a.user_id === req.user.id));
});

// ── QR MACHINE ENDPOINTS ──────────────────────────────────────

// Generate QR token (called by machine/admin)
app.post('/api/machine/generate', (req, res) => {
  const { waste_type, kg, machine_id, secret } = req.body;
  if (secret !== (process.env.MACHINE_SECRET || 'eco_machine_2026'))
    return res.status(403).json({ error: 'Forbidden' });
  const rates = { 'Пластик': 12, 'Бумага': 8, 'Стекло': 6, 'Металл': 15, 'Электроника': 20 };
  if (!rates[waste_type] || !kg || kg <= 0) return res.status(400).json({ error: 'Bad data' });
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const coins = Math.round(kg * rates[waste_type]);
  if (!store.qrTokens) store.qrTokens = [];
  store.qrTokens.push({ token, waste_type, kg: parseFloat(kg), coins, machine_id: machine_id || 'M1', used: false, expires: Date.now() + 600000, created_at: new Date().toISOString() });
  saveData();
  res.json({ success: true, token, qr_data: `ECOCOIN:${token}`, coins, waste_type, kg });
});

// Scan QR (called by user app after scanning)
app.post('/api/scan-qr', auth, (req, res) => {
  const { qr_data } = req.body;
  if (!qr_data || !qr_data.startsWith('ECOCOIN:')) return res.status(400).json({ error: 'Неверный QR-код' });
  const token = qr_data.replace('ECOCOIN:', '');
  if (!store.qrTokens) store.qrTokens = [];
  const qr = store.qrTokens.find(q => q.token === token);
  if (!qr) return res.status(400).json({ error: 'QR-код не найден' });
  if (qr.used) return res.status(400).json({ error: 'QR-код уже использован' });
  if (Date.now() > qr.expires) return res.status(400).json({ error: 'QR-код просрочен (10 мин)' });
  qr.used = true; qr.used_by = req.user.id; qr.used_at = new Date().toISOString();
  const user = store.users.find(u => u.id === req.user.id);
  user.balance += qr.coins;
  user.total_kg = (user.total_kg || 0) + qr.kg;
  store.transactions.push({ id: nextId('t'), user_id: user.id, type: 'earn', waste_type: qr.waste_type, kg: qr.kg, coins: qr.coins, description: `${qr.waste_type} — ${qr.kg} кг (автомат ${qr.machine_id})`, created_at: new Date().toISOString() });
  const earned = store.achievements.filter(a => a.user_id === user.id).map(a => a.name);
  const newAch = [];
  const add = (c, n, i) => { if (c && !earned.includes(n)) { store.achievements.push({ id: nextId('a'), user_id: user.id, name: n, icon: i, created_at: new Date().toISOString() }); newAch.push(n + ' ' + i); } };
  add(true, 'Первая сдача', '🌱'); add(user.total_kg >= 10, 'Переработчик', '♻️'); add(user.balance >= 1000, 'Тысячник', '💎'); add(user.balance >= 5000, 'Эко-Герой', '🏆');
  saveData();
  res.json({ success: true, coins: qr.coins, balance: user.balance, waste_type: qr.waste_type, kg: qr.kg, newAchievements: newAch });
});

// Demo QR (testing without machine)
app.get('/api/demo-qr', auth, (req, res) => {
  const types = ['Пластик','Бумага','Стекло','Металл'];
  const waste_type = types[Math.floor(Math.random() * types.length)];
  const kg = Math.round((Math.random() * 4 + 0.5) * 10) / 10;
  const rates = { 'Пластик': 12, 'Бумага': 8, 'Стекло': 6, 'Металл': 15, 'Электроника': 20 };
  const coins = Math.round(kg * rates[waste_type]);
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  if (!store.qrTokens) store.qrTokens = [];
  store.qrTokens.push({ token, waste_type, kg, coins, machine_id: 'DEMO', used: false, expires: Date.now() + 600000, created_at: new Date().toISOString() });
  saveData();
  res.json({ qr_data: `ECOCOIN:${token}`, waste_type, kg, coins });
});

// ── ROUTES ────────────────────────────────────────────────────
app.get('/app', (_, res) => res.sendFile(path.join(__dirname, 'public', 'app', 'index.html')));
app.get('/app/*', (req, res) => {
  const file = path.join(__dirname, 'public', 'app', req.params[0]);
  if (fs.existsSync(file)) return res.sendFile(file);
  res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
});
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));


app.listen(PORT, () => console.log(`🌿 ЭКО Coin: http://localhost:${PORT}`));
