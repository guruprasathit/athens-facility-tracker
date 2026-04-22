import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;

app.use(express.json());

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const getData = (key) => {
  const file = path.join(dataDir, ``${key}.json``);
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return [];
};

const setData = (key, data) => {
  const file = path.join(dataDir, ``${key}.json``);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// Mock auth
app.post('/api/auth', (req, res) => {
  const { action, username, name, password } = req.body;
  if (action === 'register') {
    const users = getData('users');
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const user = { id: Date.now(), username, name, password, role: users.length === 0 ? 'admin' : 'user' };
    users.push(user);
    setData('users', users);
    return res.json({ user: { username, name, role: user.role } });
  }
  if (action === 'login') {
    const users = getData('users');
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    return res.json({ user: { username: user.username, name: user.name, role: user.role } });
  }
  res.status(400).json({ error: 'Invalid action' });
});

app.get('/api/tasks', (req, res) => {
  res.json(getData('tasks'));
});

app.post('/api/tasks', (req, res) => {
  const { tasks } = req.body;
  setData('tasks', tasks);
  res.json({ success: true });
});

app.delete('/api/tasks', (req, res) => {
  setData('tasks', []);
  res.json({ success: true });
});

app.get('/api/logs', (req, res) => {
  res.json(getData('logs'));
});

app.post('/api/logs', (req, res) => {
  const { logs } = req.body;
  setData('logs', logs);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(Local API server running on http://localhost:);
});
