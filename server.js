import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '10mb' }));

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

// GET /api/images?id=taskId — returns { images: [dataUrl|null, ...] } (3 slots)
app.get('/api/images', (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });
  const slots = [0,1,2].map(i => getData('img_' + id + '_' + i) || null);
  const oldImg = getData('img_' + id) || null;
  const images = [
    slots[0]?.dataUrl || (!slots[1] && !slots[2] && oldImg?.dataUrl ? oldImg.dataUrl : null),
    slots[1]?.dataUrl || null,
    slots[2]?.dataUrl || null,
  ];
  res.json({ images });
});

// POST /api/images  body: { taskId, index, dataUrl, name }
app.post('/api/images', (req, res) => {
  const { taskId, index, dataUrl, name } = req.body;
  if (!taskId || !dataUrl || index == null) return res.status(400).json({ error: 'taskId, index and dataUrl required' });
  setData('img_' + taskId + '_' + index, { dataUrl, name: name || '' });
  res.json({ success: true });
});

// DELETE /api/images?id=taskId[&index=N]
app.delete('/api/images', (req, res) => {
  const { id, index } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });
  if (index != null) {
    const f = path.join(dataDir, 'img_' + id + '_' + index + '.json');
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } else {
    [0,1,2].forEach(i => {
      const f = path.join(dataDir, 'img_' + id + '_' + i + '.json');
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
    const oldF = path.join(dataDir, 'img_' + id + '.json');
    if (fs.existsSync(oldF)) fs.unlinkSync(oldF);
  }
  res.json({ success: true });
});

// GET /api/notify — local dev stub (emails not sent; requires RESEND_API_KEY in prod)
app.get('/api/notify', (req, res) => {
  res.json({ message: 'Notify endpoint is only active in production (Vercel). Set RESEND_API_KEY to enable email alerts.' });
});
