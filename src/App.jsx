import React, { useState, useEffect } from 'react';
import { Plus, Download, Calendar, Clock, CheckCircle2, Circle, Trash2, Edit2, Database, RefreshCw, Activity, User } from 'lucide-react';
import * as XLSX from 'xlsx';

const App = () => {
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [modal, setModal] = useState(false);
  const [logModal, setLogModal] = useState(false);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [edit, setEdit] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loginError, setLoginError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', startDate: '', status: 'backlog', category: 'maintenance' });

  const API_URL = '/api';

  const pri = { low: { c: '#10b981', b: '#d1fae5' }, medium: { c: '#f59e0b', b: '#fef3c7' }, high: { c: '#ef4444', b: '#fee2e2' }, critical: { c: '#dc2626', b: '#fee2e2' } };
  const cols = [{ id: 'backlog', t: 'Backlog', I: Circle }, { id: 'in-progress', t: 'In Progress', I: Clock }, { id: 'done', t: 'Done', I: CheckCircle2 }];

  const samples = () => {
    const d = (o) => { const x = new Date(); x.setDate(x.getDate() + o); return x.toISOString().split('T')[0]; };
    return [
      { id: 1, title: 'HVAC Inspection', description: 'Annual check', priority: 'high', dueDate: d(9), startDate: d(7), status: 'in-progress', category: 'maintenance', createdAt: new Date().toISOString(), createdBy: 'system' },
      { id: 2, title: 'Pool Chlorine', description: 'Refill', priority: 'critical', dueDate: d(4), status: 'backlog', category: 'pool', createdAt: new Date().toISOString(), createdBy: 'system' },
      { id: 3, title: 'Landscaping', description: 'Trim hedges', priority: 'low', dueDate: d(14), status: 'backlog', category: 'landscaping', createdAt: new Date().toISOString(), createdBy: 'system' },
      { id: 4, title: 'Gym Repair', description: 'Fix treadmill', priority: 'medium', dueDate: d(-3), status: 'done', category: 'maintenance', createdAt: new Date().toISOString(), createdBy: 'system' },
      { id: 5, title: 'Security Cameras', description: 'Check all', priority: 'high', dueDate: d(0), status: 'in-progress', category: 'security', createdAt: new Date().toISOString(), createdBy: 'system' }
    ];
  };

  const log = (a, t, d = '') => {
    const newLog = { id: Date.now(), timestamp: new Date().toISOString(), user: user.username, userName: user.name, action: a, taskTitle: t, details: d };
    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    return updatedLogs;
  };

  useEffect(() => {
    if (user) {
      loadData(true);
      const interval = setInterval(() => loadData(false), 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadData = async (isInitial = false) => {
    try {
      setStatus('loading');
      const tasksRes = await fetch(`${API_URL}/tasks`);
      const tasksData = await tasksRes.json();

      if (tasksData && tasksData.length > 0) {
        // KV has real tasks — always use them
        setTasks(tasksData);
      } else if (isInitial) {
        // Only load samples on FIRST load if KV is empty
        // Do NOT save samples to KV — just show them locally
        setTasks(samples());
      }
      // If not initial and KV returns empty — keep existing tasks in state
      // This prevents auto-refresh from wiping user-added tasks

      const logsRes = await fetch(`${API_URL}/logs`);
      const logsData = await logsRes.json();
      if (logsData && logsData.length > 0) setLogs(logsData);
      setStatus('ready');
    } catch (e) {
      console.error('Error loading data:', e);
      if (isInitial) setTasks(samples());
      setStatus('error');
    }
  };

  const saveTasks = async (tasksToSave) => {
    try {
      setStatus('syncing');
      localStorage.setItem('tasks', JSON.stringify(tasksToSave));
      setStatus('ready');
    } catch (e) { console.error('Error saving tasks:', e); setStatus('error'); }
  };

  const saveLogs = async (logsToSave) => {
    try {
      await fetch(`${API_URL}/logs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logs: logsToSave }) });
    } catch (e) { console.error('Error saving logs:', e); }
  };

  const login = async () => {
    setLoginError('');

    // ── Validation (no email format check) ──
    if (!username.trim()) { setLoginError('Please enter your username.'); return; }
    if (!password.trim()) { setLoginError('Please enter your password.'); return; }

    if (isRegistering) {
      if (!name.trim()) { setLoginError('Please enter your full name.'); return; }
      if (password.length < 6) { setLoginError('Password must be at least 6 characters.'); return; }
      if (password !== confirmPassword) { setLoginError('Passwords do not match.'); return; }
    }

    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isRegistering ? 'register' : 'login',
          username: username.toLowerCase().trim(),
          name: name.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      const loggedInUser = data.user;
      setUser(loggedInUser);

      // Log the login/register action
      const existingLogsRes = await fetch(`${API_URL}/logs`);
      const existingLogs = await existingLogsRes.json() || [];
      const loginLog = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        user: loggedInUser.username,
        userName: loggedInUser.name,
        action: isRegistering ? 'REGISTERED' : 'LOGIN',
        taskTitle: '',
        details: isRegistering ? `New user registered (${loggedInUser.role})` : 'User logged in',
      };
      const updatedLogs = [loginLog, ...existingLogs];
      setLogs(updatedLogs);
      await saveLogs(updatedLogs);

    } catch (e) {
      console.error('Login error:', e);
      setLoginError('Connection error. Please try again.');
    }

    // Clear form fields
    setUsername('');
    setName('');
    setPassword('');
    setConfirmPassword('');
  };

  const logout = () => {
    const l = log('LOGOUT', '', 'User logged out');
    saveLogs(l);
    setTimeout(() => {
      setUser(null);
      setTasks([]);
      setLogs([]);
      setUsername('');
      setName('');
      setPassword('');
      setConfirmPassword('');
      setLoginError('');
      setIsRegistering(false);
    }, 500);
  };

  const open = (s = 'backlog', t = null) => {
    if (t) { setEdit(t); setForm(t); } else { setEdit(null); setForm({ title: '', description: '', priority: 'medium', dueDate: '', startDate: '', status: s, category: 'maintenance' }); }
    setModal(true);
  };

  const saveTask = async () => {
    if (!form.title || !form.dueDate) { alert('Fill Title and Due Date'); return; }
    let updatedTasks, updatedLogs;
    if (edit) {
      updatedTasks = tasks.map(t => t.id === edit.id ? { ...form, id: edit.id, lastModifiedBy: user.username } : t);
      updatedLogs = log('UPDATED', form.title, 'Task updated');
    } else {
      const newTask = { ...form, id: Date.now(), createdAt: new Date().toISOString(), createdBy: user.username, createdByName: user.name };
      updatedTasks = [...tasks, newTask];
      updatedLogs = log('CREATED', form.title, `Priority: ${form.priority}`);
    }
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
    await saveLogs(updatedLogs);
    setModal(false);
  };

  const del = async (id) => {
    if (user.role !== 'admin') { alert('Only admins can delete tasks.'); return; }
    const t = tasks.find(x => x.id === id);
    if (!t || !confirm('Delete?')) return;
    const updatedTasks = tasks.filter(x => x.id !== id);
    const updatedLogs = log('DELETED', t.title, '');
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
    await saveLogs(updatedLogs);
  };

  const move = async (id, ns) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const now = new Date();
    const updatedTasks = tasks.map(x => {
      if (x.id === id) {
        const n = { ...x, status: ns };
        if (ns === 'in-progress' && !x.startDate) { n.startDate = now.toISOString().split('T')[0]; n.startTime = now.toLocaleTimeString(); }
        if (ns === 'done') { n.completionDate = now.toISOString().split('T')[0]; n.completionTime = now.toLocaleTimeString(); }
        return n;
      }
      return x;
    });
    const updatedLogs = log(ns === 'done' ? 'COMPLETED' : 'MOVED', t.title, `To ${ns}`);
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
    await saveLogs(updatedLogs);
  };

  const clear = async () => {
    if (user.role !== 'admin') { alert('Only admins can clear all tasks.'); return; }
    if (confirm('Delete all tasks?')) {
      const updatedLogs = log('SYSTEM', 'All tasks cleared', '');
      setTasks([]);
      await fetch(`${API_URL}/tasks`, { method: 'DELETE' });
      await saveLogs(updatedLogs);
    }
  };

  const exp = () => {
    const td = tasks.map(t => ({ Title: t.title, Desc: t.description, Priority: t.priority, Status: t.status, Due: t.dueDate, Created: t.createdBy }));
    const ld = logs.map(l => ({ Time: new Date(l.timestamp).toLocaleString(), User: l.userName, Action: l.action, Task: l.taskTitle, Details: l.details }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(td), 'Tasks');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ld), 'Logs');
    XLSX.writeFile(wb, `Athens_${new Date().toISOString().split('T')[0]}.xlsx`);
    const updatedLogs = log('EXPORTED', '', 'Data exported');
    saveLogs(updatedLogs);
  };

  const stats = { t: tasks.length, o: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'done').length, d: tasks.filter(t => t.status === 'done').length };

  // ── LOGIN SCREEN ─────────────────────────────────────────────────────────────
  if (!user) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Rajdhani:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .login-root { min-height: 100vh; background: #0a0f1e; display: flex; align-items: center; justify-content: center; font-family: 'Rajdhani', sans-serif; position: relative; overflow: hidden; }
        .login-root::before { content: ''; position: absolute; width: 600px; height: 600px; border-radius: 50%; border: 1px solid rgba(212,175,55,0.08); top: 50%; left: 50%; transform: translate(-50%,-50%); animation: pulse 6s ease-in-out infinite; }
        .login-root::after { content: ''; position: absolute; width: 900px; height: 900px; border-radius: 50%; border: 1px solid rgba(212,175,55,0.04); top: 50%; left: 50%; transform: translate(-50%,-50%); animation: pulse 6s ease-in-out infinite 1.5s; }
        @keyframes pulse { 0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.03)} }
        .login-card { position: relative; z-index: 10; width: 100%; max-width: 420px; margin: 20px; background: linear-gradient(160deg,#0d1630 0%,#111827 100%); border: 1px solid rgba(212,175,55,0.25); border-radius: 4px; padding: 48px 40px 40px; box-shadow: 0 0 0 1px rgba(212,175,55,0.05),0 25px 60px rgba(0,0,0,0.6),inset 0 1px 0 rgba(212,175,55,0.1); animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)} }
        .login-card::before { content:''; position:absolute; top:0; left:10%; right:10%; height:2px; background:linear-gradient(90deg,transparent,#d4af37,#f0c93a,#d4af37,transparent); border-radius:0 0 2px 2px; }
        .login-logo { text-align:center; margin-bottom:32px; }
        .login-logo-icon { width:52px; height:52px; margin:0 auto 14px; background:linear-gradient(135deg,#d4af37,#f0c93a); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; box-shadow:0 4px 20px rgba(212,175,55,0.3); }
        .login-title { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; color:#f0c93a; letter-spacing:0.5px; }
        .login-subtitle { font-size:13px; color:rgba(255,255,255,0.4); margin-top:4px; letter-spacing:1.5px; text-transform:uppercase; font-weight:500; }
        .login-divider { display:flex; align-items:center; gap:12px; margin-bottom:28px; }
        .login-divider span { flex:1; height:1px; background:rgba(212,175,55,0.15); }
        .login-divider p { font-size:11px; color:rgba(255,255,255,0.25); letter-spacing:2px; text-transform:uppercase; }
        .field { margin-bottom:18px; }
        .field label { display:block; font-size:11px; font-weight:600; letter-spacing:1.8px; text-transform:uppercase; color:rgba(212,175,55,0.7); margin-bottom:8px; }
        .field-wrap { position:relative; }
        .field input { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(212,175,55,0.2); border-radius:3px; padding:12px 16px; font-family:'Rajdhani',sans-serif; font-size:15px; font-weight:500; color:#fff; outline:none; transition:border-color .2s,background .2s,box-shadow .2s; letter-spacing:0.3px; }
        .field input::placeholder { color:rgba(255,255,255,0.2); font-weight:400; }
        .field input:focus { border-color:rgba(212,175,55,0.6); background:rgba(212,175,55,0.05); box-shadow:0 0 0 3px rgba(212,175,55,0.08); }
        .field input.has-toggle { padding-right:44px; }
        .toggle-btn { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:rgba(255,255,255,0.3); font-size:16px; padding:4px; line-height:1; transition:color .2s; }
        .toggle-btn:hover { color:rgba(212,175,55,0.7); }
        .error-box { background:rgba(220,38,38,0.1); border:1px solid rgba(220,38,38,0.3); border-radius:3px; padding:10px 14px; margin-bottom:18px; font-size:13px; color:#fca5a5; letter-spacing:0.3px; animation:shake .3s ease; }
        @keyframes shake { 0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)} }
        .info-box { background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.25); border-radius:3px; padding:10px 14px; margin-bottom:18px; font-size:12px; color:#93c5fd; letter-spacing:0.3px; }
        .submit-btn { width:100%; padding:14px; background:linear-gradient(135deg,#c9a227,#f0c93a,#c9a227); background-size:200% 100%; background-position:100% 0; border:none; border-radius:3px; font-family:'Rajdhani',sans-serif; font-size:14px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:#0a0f1e; cursor:pointer; transition:background-position .4s,transform .15s,box-shadow .2s; box-shadow:0 4px 20px rgba(212,175,55,0.25); margin-top:8px; }
        .submit-btn:hover:not(:disabled) { background-position:0 0; box-shadow:0 6px 28px rgba(212,175,55,0.4); transform:translateY(-1px); }
        .submit-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(10,15,30,0.3); border-top-color:#0a0f1e; border-radius:50%; animation:spin .7s linear infinite; vertical-align:middle; margin-right:8px; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .switch-link { text-align:center; margin-top:20px; font-size:13px; color:rgba(255,255,255,0.3); }
        .switch-link button { background:none; border:none; color:#f0c93a; font-weight:600; cursor:pointer; font-family:'Rajdhani',sans-serif; font-size:13px; text-decoration:underline; }
        .login-footer { text-align:center; margin-top:24px; font-size:11px; color:rgba(255,255,255,0.2); letter-spacing:1px; text-transform:uppercase; }
        .login-footer strong { color:rgba(212,175,55,0.4); }
      `}</style>
      <div className="login-root">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon">🏛️</div>
            <div className="login-title">Athens Community</div>
            <div className="login-subtitle">Facility Tracker</div>
          </div>

          <div className="login-divider">
            <span /><p>{isRegistering ? 'Register' : 'Sign In'}</p><span />
          </div>

          {loginError && <div className="error-box">⚠ {loginError}</div>}

          {isRegistering && (
            <div className="info-box">
              ℹ️ The first registered user becomes the <strong>Admin</strong>. Admins can delete and clear tasks.
            </div>
          )}

          {isRegistering && (
            <div className="field">
              <label>Full Name</label>
              <div className="field-wrap">
                <input
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={e => { setName(e.target.value); setLoginError(''); }}
                  onKeyPress={e => e.key === 'Enter' && login()}
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="field">
            <label>Username</label>
            <div className="field-wrap">
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={e => { setUsername(e.target.value); setLoginError(''); }}
                onKeyPress={e => e.key === 'Enter' && login()}
                autoFocus={!isRegistering}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="field">
            <label>Password</label>
            <div className="field-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="has-toggle"
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); setLoginError(''); }}
                onKeyPress={e => e.key === 'Enter' && login()}
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
              />
              <button type="button" className="toggle-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {isRegistering && (
            <div className="field">
              <label>Confirm Password</label>
              <div className="field-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setLoginError(''); }}
                  onKeyPress={e => e.key === 'Enter' && login()}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          <button className="submit-btn" onClick={login}>
            {isRegistering ? 'Create Account' : 'Sign In'}
          </button>

          <div className="switch-link">
            {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); setPassword(''); setConfirmPassword(''); }}>
              {isRegistering ? 'Sign In' : 'Register'}
            </button>
          </div>

          <div className="login-footer"><strong>CAAOA</strong> · Casagrand Athens</div>
        </div>
      </div>
    </>
  );

  // ── MAIN APP ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div><h1 style={{ margin: 0, fontSize: '2rem' }}>Athens Community</h1><p style={{ margin: 0, color: '#6b7280' }}>Facility Management</p></div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ padding: '0.75rem 1rem', background: '#667eea', color: 'white', borderRadius: '50px', fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <User size={16} />{user.name}
                {user.role === 'admin' && <span style={{ background: '#fbbf24', color: '#92400e', fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.25rem' }}>ADMIN</span>}
              </div>
              <div style={{ padding: '0.75rem 1rem', background: status === 'ready' ? '#d1fae5' : status === 'syncing' ? '#fef3c7' : '#fee2e2', color: status === 'ready' ? '#10b981' : status === 'syncing' ? '#f59e0b' : '#ef4444', borderRadius: '8px', fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Database size={16} />{status}</div>
              <button onClick={() => setLogModal(true)} style={{ padding: '0.75rem 1rem', background: 'white', color: '#667eea', border: '2px solid #667eea', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Activity size={16} />Log</button>
              <button onClick={() => loadData(false)} style={{ padding: '0.75rem 1rem', background: 'white', color: '#667eea', border: '2px solid #667eea', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><RefreshCw size={16} />Refresh</button>
              <button onClick={exp} style={{ padding: '0.75rem 1rem', background: 'white', color: '#667eea', border: '2px solid #667eea', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Download size={16} />Export</button>
              <button onClick={() => open('backlog')} style={{ padding: '0.75rem 1rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Plus size={16} />Add</button>
              {user.role === 'admin' && <button onClick={clear} style={{ padding: '0.75rem 1rem', background: 'white', color: '#ef4444', border: '2px solid #ef4444', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Trash2 size={16} />Clear</button>}
              <button onClick={logout} style={{ padding: '0.75rem 1rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Logout</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', paddingTop: '1rem', borderTop: '2px solid #f3f4f6' }}>
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '12px' }}><div style={{ fontSize: '2rem', fontWeight: 700, color: '#667eea' }}>{stats.t}</div><div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total</div></div>
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '12px' }}><div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>{stats.o}</div><div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Overdue</div></div>
            <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: '12px' }}><div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>{stats.d}</div><div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Done</div></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {cols.map(col => {
            const Icon = col.I;
            return (
              <div key={col.id} style={{ background: 'white', borderRadius: '16px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '2px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Icon size={24} style={{ color: '#667eea' }} /><h3 style={{ margin: 0 }}>{col.t}</h3></div>
                  <div style={{ background: '#667eea', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '20px', fontWeight: 700 }}>{tasks.filter(t => t.status === col.id).length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '200px', marginBottom: '1rem' }}>
                  {tasks.filter(t => t.status === col.id).map(task => {
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const dueDate = new Date(task.dueDate); dueDate.setHours(0, 0, 0, 0);
                    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysUntilDue < 0 && task.status !== 'done';
                    const isDueToday = daysUntilDue === 0;
                    let dueDateDisplay = '';
                    if (isOverdue) dueDateDisplay = `${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'} overdue`;
                    else if (isDueToday) dueDateDisplay = 'Due today!';
                    else if (daysUntilDue === 1) dueDateDisplay = 'Due tomorrow';
                    else if (daysUntilDue > 1) dueDateDisplay = `${daysUntilDue} days remaining`;
                    return (
                      <div key={task.id} style={{ background: 'white', borderRadius: '8px', padding: '1rem', border: '1px solid #e5e7eb', borderLeft: `4px solid ${pri[task.priority].c}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: 700, flex: 1 }}>{task.title}</div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => open(task.status, task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><Edit2 size={16} /></button>
                            {user.role === 'admin' && <button onClick={() => del(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><Trash2 size={16} /></button>}
                          </div>
                        </div>
                        <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{task.description}</div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: pri[task.priority].b, color: pri[task.priority].c }}>{task.priority.toUpperCase()}</span>
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: '#ede9fe', color: '#7c3aed' }}>{task.category}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}><Calendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />Due: {task.dueDate}</div>
                        {dueDateDisplay && (
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.5rem', borderRadius: '6px', marginBottom: '0.75rem', background: isOverdue ? '#fee2e2' : isDueToday ? '#fef3c7' : '#dbeafe', color: isOverdue ? '#ef4444' : isDueToday ? '#f59e0b' : '#3b82f6', border: `2px solid ${isOverdue ? '#ef4444' : isDueToday ? '#f59e0b' : '#3b82f6'}` }}>
                            {isOverdue ? '⚠️ ' : isDueToday ? '⏰ ' : '📅 '}{dueDateDisplay}
                          </div>
                        )}
                        {task.startDate && <div style={{ fontSize: '0.75rem', color: '#6b7280', padding: '0.5rem', background: '#f0fdf4', borderRadius: '4px', marginBottom: '0.5rem', border: '1px solid #bbf7d0' }}><Clock size={10} style={{ display: 'inline', marginRight: '0.25rem', color: '#10b981' }} />Started: {task.startDate}{task.startTime && ` at ${task.startTime}`}</div>}
                        {task.completionDate && <div style={{ fontSize: '0.75rem', color: '#6b7280', padding: '0.5rem', background: '#f0fdf4', borderRadius: '4px', marginBottom: '0.5rem', border: '1px solid #bbf7d0' }}><CheckCircle2 size={10} style={{ display: 'inline', marginRight: '0.25rem', color: '#10b981' }} />Completed: {task.completionDate}{task.completionTime && ` at ${task.completionTime}`}</div>}
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', padding: '0.5rem', background: '#f9fafb', borderRadius: '4px', marginBottom: '0.75rem' }}><User size={10} style={{ display: 'inline', marginRight: '0.25rem' }} />By: {task.createdByName || task.createdBy}</div>
                        {task.status !== 'done' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {task.status === 'backlog' && <button onClick={() => move(task.id, 'in-progress')} style={{ flex: 1, padding: '0.5rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Start</button>}
                            {task.status === 'in-progress' && <><button onClick={() => move(task.id, 'backlog')} style={{ flex: 1, padding: '0.5rem', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Back</button><button onClick={() => move(task.id, 'done')} style={{ flex: 1, padding: '0.5rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Done</button></>}
                          </div>
                        )}
                        {task.status === 'done' && <button onClick={() => move(task.id, 'in-progress')} style={{ width: '100%', padding: '0.5rem', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Reopen</button>}
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => open(col.id)} style={{ width: '100%', padding: '0.75rem', border: '2px dashed #d1d5db', background: 'transparent', borderRadius: '8px', color: '#9ca3af', fontWeight: 600, cursor: 'pointer' }}>+ Add to {col.t}</button>
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>{edit ? 'Edit' : 'Add'} Task</h3>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box' }} />
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="3" style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }}><option value="maintenance">Maintenance</option><option value="landscaping">Landscaping</option><option value="pool">Pool</option><option value="security">Security</option><option value="cleaning">Cleaning</option><option value="repairs">Repairs</option></select>
            <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveTask} style={{ flex: 1, padding: '0.75rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {logModal && (
        <div onClick={() => setLogModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '700px', maxHeight: '80vh', overflow: 'auto', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity size={24} />Activity Log</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {logs.map(l => {
                const colors = { CREATED: '#10b981', UPDATED: '#3b82f6', DELETED: '#ef4444', COMPLETED: '#059669', MOVED: '#f59e0b', LOGIN: '#7c3aed', LOGOUT: '#6b7280', EXPORTED: '#0284c7', SYSTEM: '#6b7280', REGISTERED: '#8b5cf6' };
                return (
                  <div key={l.id} style={{ padding: '1rem', background: '#f9fafb', borderRadius: '8px', borderLeft: `4px solid ${colors[l.action] || '#6b7280'}` }}>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>{new Date(l.timestamp).toLocaleString()}</div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{l.userName} - {l.action}</div>
                    {l.taskTitle && <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Task: {l.taskTitle}</div>}
                    {l.details && <div style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>{l.details}</div>}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setLogModal(false)} style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
