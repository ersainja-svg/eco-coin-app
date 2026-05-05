const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = 'eco_coin_secret_key_2026';
const db = new Database(path.join(__dirname, 'eco.db'));

// Init DB
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT NOT NULL,
    balance INTEGER DEFAULT 0,
    total_kg REAL DEFAULT 0,
    level TEXT DEFAULT 'Новичок',
    avatar TEXT DEFAULT '🧑',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    waste_type TEXT,
    kg REAL,
    coins INTEGER NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Неверный токен' });
  }
}

function getLevel(balance) {
  if (balance >= 5000) return 'Эко-Легенда 🏆';
  if (balance >= 2000) return 'Эко-Чемпион 🥇';
  if (balance >= 1000) return 'Эко-Герой 🌟';
  if (balance >= 500) return 'Переработчик ♻️';
  if (balance >= 100) return 'Эко-Активист 🌿';
  return 'Новичок 🌱';
}

// === AUTH ROUTES ===

// Register
app.post('/api/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    const stmt = db.prepare('INSERT INTO users (name, email, phone, password) VALUES (?,?,?,?)');
    const result = stmt.run(name, email, phone || '', hash);
    // Welcome bonus
    db.prepare('UPDATE users SET balance = 50 WHERE id = ?').run(result.lastInsertRowid);
    db.prepare('INSERT INTO transactions (user_id, type, coins, description) VALUES (?,?,?,?)').run(
      result.lastInsertRowid, 'bonus', 50, 'Приветственный бонус 🎉'
    );
    const token = jwt.sign({ id: result.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, message: 'Добро пожаловать! +50 монет в подарок 🎉' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email уже используется' });
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Неверный email или пароль' });
  const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token });
});

// === USER ROUTES ===

// Get profile
app.get('/api/me', auth, (req, res) => {
  const user = db.prepare('SELECT id,name,email,phone,balance,total_kg,level,avatar,created_at FROM users WHERE id=?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  user.level = getLevel(user.balance);
  res.json(user);
});

// Get transactions
app.get('/api/transactions', auth, (req, res) => {
  const txs = db.prepare('SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(req.user.id);
  res.json(txs);
});

// Submit waste
app.post('/api/waste', auth, (req, res) => {
  const { waste_type, kg } = req.body;
  const rates = { 'Пластик': 12, 'Бумага': 8, 'Стекло': 6, 'Металл': 15, 'Электроника': 20 };
  const rate = rates[waste_type];
  if (!rate || !kg || kg <= 0) return res.status(400).json({ error: 'Неверные данные' });

  const coins = Math.round(kg * rate);
  db.prepare('UPDATE users SET balance = balance + ?, total_kg = total_kg + ? WHERE id=?').run(coins, kg, req.user.id);
  db.prepare('INSERT INTO transactions (user_id, type, waste_type, kg, coins, description) VALUES (?,?,?,?,?,?)').run(
    req.user.id, 'earn', waste_type, kg, coins, `${waste_type} — ${kg} кг`
  );

  // Check achievements
  const user = db.prepare('SELECT balance, total_kg FROM users WHERE id=?').get(req.user.id);
  const achieves = db.prepare('SELECT name FROM achievements WHERE user_id=?').all(req.user.id).map(a => a.name);
  const newAchieves = [];
  if (!achieves.includes('Первая сдача')) {
    db.prepare('INSERT INTO achievements (user_id, name, icon) VALUES (?,?,?)').run(req.user.id, 'Первая сдача', '🌱');
    newAchieves.push('Первая сдача 🌱');
  }
  if (user.total_kg >= 10 && !achieves.includes('Переработчик')) {
    db.prepare('INSERT INTO achievements (user_id, name, icon) VALUES (?,?,?)').run(req.user.id, 'Переработчик', '♻️');
    newAchieves.push('Переработчик ♻️');
  }
  if (user.balance >= 1000 && !achieves.includes('Тысячник')) {
    db.prepare('INSERT INTO achievements (user_id, name, icon) VALUES (?,?,?)').run(req.user.id, 'Тысячник', '💎');
    newAchieves.push('Тысячник 💎');
  }

  res.json({ success: true, coins, balance: user.balance, newAchievements: newAchieves });
});

// Spend coins (partner offer)
app.post('/api/spend', auth, (req, res) => {
  const { coins, description } = req.body;
  const user = db.prepare('SELECT balance FROM users WHERE id=?').get(req.user.id);
  if (user.balance < coins) return res.status(400).json({ error: 'Недостаточно монет' });
  db.prepare('UPDATE users SET balance = balance - ? WHERE id=?').run(coins, req.user.id);
  db.prepare('INSERT INTO transactions (user_id, type, coins, description) VALUES (?,?,?,?)').run(
    req.user.id, 'spend', -coins, description
  );
  res.json({ success: true, balance: user.balance - coins });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const users = db.prepare('SELECT id, name, balance, total_kg, avatar FROM users ORDER BY balance DESC LIMIT 10').all();
  res.json(users);
});

// Get achievements
app.get('/api/achievements', auth, (req, res) => {
  const all = db.prepare('SELECT * FROM achievements WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(all);
});

// Fallback to index.html
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`🌿 ЭКО Coin сервер запущен: http://localhost:${PORT}`));
