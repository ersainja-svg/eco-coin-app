const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'eco_coin_secret_key_2026';
const DB_PATH = path.join(__dirname, 'eco.db');

let db;

// Init sql.js and load/create DB
async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  saveDb();
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Helper: run a query and return rows as objects
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
  return db;
}

function getLastId() {
  return query('SELECT last_insert_rowid() as id')[0].id;
}

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
app.post('/api/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });

  const existing = query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(400).json({ error: 'Email уже используется' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    run('INSERT INTO users (name, email, phone, password) VALUES (?,?,?,?)', [name, email, phone || '', hash]);
    const id = getLastId();
    run('UPDATE users SET balance = 50 WHERE id = ?', [id]);
    run('INSERT INTO transactions (user_id, type, coins, description) VALUES (?,?,?,?)', [id, 'bonus', 50, 'Приветственный бонус 🎉']);
    const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, message: 'Добро пожаловать! +50 монет в подарок 🎉' });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера: ' + e.message });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const users = query('SELECT * FROM users WHERE email = ?', [email]);
  const user = users[0];
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Неверный email или пароль' });
  const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ success: true, token });
});

// === USER ROUTES ===
app.get('/api/me', auth, (req, res) => {
  const users = query('SELECT id,name,email,phone,balance,total_kg,avatar,created_at FROM users WHERE id=?', [req.user.id]);
  if (!users.length) return res.status(404).json({ error: 'Не найден' });
  const user = users[0];
  user.level = getLevel(user.balance);
  res.json(user);
});

app.get('/api/transactions', auth, (req, res) => {
  const txs = query('SELECT * FROM transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 20', [req.user.id]);
  res.json(txs);
});

app.post('/api/waste', auth, (req, res) => {
  const { waste_type, kg } = req.body;
  const rates = { 'Пластик': 12, 'Бумага': 8, 'Стекло': 6, 'Металл': 15, 'Электроника': 20 };
  const rate = rates[waste_type];
  if (!rate || !kg || kg <= 0) return res.status(400).json({ error: 'Неверные данные' });

  const coins = Math.round(kg * rate);
  run('UPDATE users SET balance = balance + ?, total_kg = total_kg + ? WHERE id=?', [coins, kg, req.user.id]);
  run('INSERT INTO transactions (user_id, type, waste_type, kg, coins, description) VALUES (?,?,?,?,?,?)',
    [req.user.id, 'earn', waste_type, kg, coins, `${waste_type} — ${kg} кг`]);

  const users = query('SELECT balance, total_kg FROM users WHERE id=?', [req.user.id]);
  const user = users[0];
  const earned = query('SELECT name FROM achievements WHERE user_id=?', [req.user.id]).map(a => a.name);
  const newAchieves = [];

  if (!earned.includes('Первая сдача')) {
    run('INSERT INTO achievements (user_id, name, icon) VALUES (?,?,?)', [req.user.id, 'Первая сдача', '🌱']);
    newAchieves.push('Первая сдача 🌱');
  }
  if (user.total_kg >= 10 && !earned.includes('Переработчик')) {
    run('INSERT INTO achievements (user_id, name, icon) VALUES (?,?,?)', [req.user.id, 'Переработчик', '♻️']);
    newAchieves.push('Переработчик ♻️');
  }
  if (user.balance >= 1000 && !earned.includes('Тысячник')) {
    run('INSERT INTO achievements (user_id, name, icon) VALUES (?,?,?)', [req.user.id, 'Тысячник', '💎']);
    newAchieves.push('Тысячник 💎');
  }

  res.json({ success: true, coins, balance: user.balance, newAchievements: newAchieves });
});

app.post('/api/spend', auth, (req, res) => {
  const { coins, description } = req.body;
  const users = query('SELECT balance FROM users WHERE id=?', [req.user.id]);
  if (!users.length || users[0].balance < coins)
    return res.status(400).json({ error: 'Недостаточно монет' });
  run('UPDATE users SET balance = balance - ? WHERE id=?', [coins, req.user.id]);
  run('INSERT INTO transactions (user_id, type, coins, description) VALUES (?,?,?,?)',
    [req.user.id, 'spend', -coins, description]);
  res.json({ success: true, balance: users[0].balance - coins });
});

app.get('/api/leaderboard', (req, res) => {
  const users = query('SELECT id, name, balance, total_kg, avatar FROM users ORDER BY balance DESC LIMIT 10');
  res.json(users);
});

app.get('/api/achievements', auth, (req, res) => {
  const all = query('SELECT * FROM achievements WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
  res.json(all);
});

app.get('/app', (_, res) => res.sendFile(path.join(__dirname, 'public', 'app', 'index.html')));
app.get('/app/*', (req, res) => {
  const file = path.join(__dirname, 'public', 'app', req.params[0]);
  if (require('fs').existsSync(file)) return res.sendFile(file);
  res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
});
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start
initDb().then(() => {
  app.listen(PORT, () => console.log(`🌿 ЭКО Coin запущен: http://localhost:${PORT}`));
}).catch(err => {
  console.error('DB init error:', err);
  process.exit(1);
});
