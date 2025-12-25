import React, { useState, useEffect } from 'react';
import { Plus, Download, Calendar, Clock, CheckCircle2, Circle, Trash2, Edit2, Database, RefreshCw, Activity, User } from 'lucide-react';
import * as XLSX from 'xlsx';

const App = () => {
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [modal, setModal] = useState(false);
  const [logModal, setLogModal] = useState(false);
  const [loginModal, setLoginModal] = useState(true);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
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
    const newLog = { id: Date.now(), timestamp: new Date().toISOString(), user: user.email, userName: user.name, action: a, taskTitle: t, details: d };
    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    return updatedLogs;
  };

  useEffect(() => { 
    if (user) {
      loadData();
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadData = async () => {
    try {
      setStatus('loading');
      
      const tasksRes = await fetch(`${API_URL}/tasks`);
      const tasksData = await tasksRes.json();
      
      if (tasksData && tasksData.length > 0) {
        setTasks(tasksData);
      } else {
        const sampleTasks = samples();
        await saveTasks(sampleTasks);
        setTasks(sampleTasks);
      }
      
      const logsRes = await fetch(`${API_URL}/logs`);
      const logsData = await logsRes.json();
      
      if (logsData && logsData.length > 0) {
        setLogs(logsData);
      }
      
      setStatus('ready');
    } catch (e) {
      console.error('Error loading data:', e);
      setTasks(samples());
      setStatus('error');
    }
  };

  const saveTasks = async (tasksToSave) => {
    try {
      setStatus('syncing');
      
      await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: tasksToSave })
      });
      
      setStatus('ready');
    } catch (e) {
      console.error('Error saving tasks:', e);
      setStatus('error');
    }
  };

  const saveLogs = async (logsToSave) => {
    try {
      await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToSave })
      });
    } catch (e) {
      console.error('Error saving logs:', e);
    }
  };

  const saveUsers = async (usersToSave) => {
    try {
      await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: usersToSave })
      });
    } catch (e) {
      console.error('Error saving users:', e);
    }
  };

  const loadUsers = async () => {
    try {
      const usersRes = await fetch(`${API_URL}/users`);
      const usersData = await usersRes.json();
      return usersData || [];
    } catch (e) {
      console.error('Error loading users:', e);
      return [];
    }
  };

  const login = async () => {
    setLoginError('');
    
    if (!email || !name) { 
      setLoginError('Please enter both name and email'); 
      return; 
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { 
      setLoginError('Please enter a valid email address'); 
      return; 
    }

    const normalizedEmail = email.toLowerCase().trim();
    const trimmedName = name.trim();
    
    // Load existing users
    const existingUsers = await loadUsers();
    const existingUser = existingUsers.find(u => u.email === normalizedEmail);

    if (isRegistering) {
      // Registration mode
      if (existingUser) {
        setLoginError('This email is already registered. Please sign in instead.');
        return;
      }

      // Create new user
      const newUser = { 
        email: normalizedEmail, 
        name: trimmedName,
        registeredAt: new Date().toISOString()
      };
      
      const updatedUsers = [...existingUsers, newUser];
      await saveUsers(updatedUsers);
      
      setUser(newUser);
      setLoginModal(false);
      
      const loginLog = { 
        id: Date.now(), 
        timestamp: new Date().toISOString(), 
        user: newUser.email, 
        userName: newUser.name, 
        action: 'REGISTERED', 
        taskTitle: '', 
        details: 'New user registered and logged in' 
      };
      setLogs([loginLog]);
      await saveLogs([loginLog]);
      
    } else {
      // Login mode
      if (!existingUser) {
        setLoginError('Email not found. Please register first.');
        return;
      }

      if (existingUser.name !== trimmedName) {
        setLoginError('Name does not match our records for this email.');
        return;
      }

      // Login successful
      setUser(existingUser);
      setLoginModal(false);
      
      const loginLog = { 
        id: Date.now(), 
        timestamp: new Date().toISOString(), 
        user: existingUser.email, 
        userName: existingUser.name, 
        action: 'LOGIN', 
        taskTitle: '', 
        details: 'User logged in' 
      };
      setLogs([loginLog]);
      await saveLogs([loginLog]);
    }

    // Clear form
    setEmail('');
    setName('');
  };

  const logout = () => {
    const l = log('LOGOUT', '', 'User logged out');
    saveLogs(l);
    setTimeout(() => { 
      setUser(null); 
      setLoginModal(true); 
      setTasks([]); 
      setLogs([]);
      setEmail('');
      setName('');
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
      updatedTasks = tasks.map(t => t.id === edit.id ? { ...form, id: edit.id, lastModifiedBy: user.email } : t);
      updatedLogs = log('UPDATED', form.title, 'Task updated');
    } else {
      const newTask = { ...form, id: Date.now(), createdAt: new Date().toISOString(), createdBy: user.email, createdByName: user.name };
      updatedTasks = [...tasks, newTask];
      updatedLogs = log('CREATED', form.title, `Priority: ${form.priority}`);
    }
    
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
    await saveLogs(updatedLogs);
    setModal(false);
  };

  const del = async (id) => {
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
        if (ns === 'in-progress' && !x.startDate) {
          n.startDate = now.toISOString().split('T')[0];
          n.startTime = now.toLocaleTimeString();
        }
        if (ns === 'done') {
          n.completionDate = now.toISOString().split('T')[0];
          n.completionTime = now.toLocaleTimeString();
        }
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

  if (!user) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', width: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Athens Community</h2>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {isRegistering ? 'Create your account' : 'Sign in to continue'}
        </p>
        
        {loginError && (
          <div style={{ background: '#fee2e2', border: '2px solid #ef4444', color: '#dc2626', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {loginError}
          </div>
        )}
        
        <input 
          value={name} 
          onChange={e => setName(e.target.value)} 
          placeholder="Your Full Name" 
          style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }} 
          onKeyPress={e => e.key === 'Enter' && login()}
        />
        <input 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          placeholder="Email Address" 
          type="email"
          style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }} 
          onKeyPress={e => e.key === 'Enter' && login()}
        />
        
        <button 
          onClick={login} 
          style={{ width: '100%', padding: '0.75rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', marginBottom: '1rem' }}
        >
          {isRegistering ? 'Register' : 'Sign In'}
        </button>
        
        <div style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
          {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setLoginError('');
            }} 
            style={{ background: 'none', border: 'none', color: '#667eea', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isRegistering ? 'Sign In' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div><h1 style={{ margin: 0, fontSize: '2rem' }}>Athens Community</h1><p style={{ margin: 0, color: '#6b7280' }}>Facility Management</p></div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ padding: '0.75rem 1rem', background: '#667eea', color: 'white', borderRadius: '50px', fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}><User size={16} />{user.name}</div>
              <div style={{ padding: '0.75rem 1rem', background: status === 'ready' ? '#d1fae5' : status === 'syncing' ? '#fef3c7' : '#fee2e2', color: status === 'ready' ? '#10b981' : status === 'syncing' ? '#f59e0b' : '#ef4444', borderRadius: '8px', fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Database size={16} />{status}</div>
              <button onClick={() => setLogModal(true)} style={{ padding: '0.75rem 1rem', background: 'white', color: '#667eea', border: '2px solid #667eea', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Activity size={16} />Log</button>
              <button onClick={loadData} style={{ padding: '0.75rem 1rem', background: 'white', color: '#667eea', border: '2px solid #667eea', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><RefreshCw size={16} />Refresh</button>
              <button onClick={exp} style={{ padding: '0.75rem 1rem', background: 'white', color: '#667eea', border: '2px solid #667eea', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Download size={16} />Export</button>
              <button onClick={() => open('backlog')} style={{ padding: '0.75rem 1rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Plus size={16} />Add</button>
              <button onClick={clear} style={{ padding: '0.75rem 1rem', background: 'white', color: '#ef4444', border: '2px solid #ef4444', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Trash2 size={16} />Clear</button>
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
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const dueDate = new Date(task.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                    const isOverdue = daysUntilDue < 0 && task.status !== 'done';
                    const isDueToday = daysUntilDue === 0;
                    
                    let dueDateDisplay = '';
                    if (isOverdue) {
                      dueDateDisplay = `${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'} overdue`;
                    } else if (isDueToday) {
                      dueDateDisplay = 'Due today!';
                    } else if (daysUntilDue === 1) {
                      dueDateDisplay = 'Due tomorrow';
                    } else if (daysUntilDue > 1) {
                      dueDateDisplay = `${daysUntilDue} days remaining`;
                    }
                    
                    return (
                    <div key={task.id} style={{ background: 'white', borderRadius: '8px', padding: '1rem', border: '1px solid #e5e7eb', borderLeft: `4px solid ${pri[task.priority].c}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 700, flex: 1 }}>{task.title}</div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => open(task.status, task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><Edit2 size={16} /></button>
                          <button onClick={() => del(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{task.description}</div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: pri[task.priority].b, color: pri[task.priority].c }}>{task.priority.toUpperCase()}</span>
                        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: '#ede9fe', color: '#7c3aed' }}>{task.category}</span>
                      </div>
                      
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                        <Calendar size={12} style={{ display: 'inline', marginRight: '0.25rem' }} />
                        Due: {task.dueDate}
                      </div>
                      
                      {dueDateDisplay && (
                        <div style={{ 
                          fontSize: '0.8rem', 
                          fontWeight: 700, 
                          padding: '0.5rem', 
                          borderRadius: '6px', 
                          marginBottom: '0.75rem',
                          background: isOverdue ? '#fee2e2' : isDueToday ? '#fef3c7' : '#dbeafe',
                          color: isOverdue ? '#ef4444' : isDueToday ? '#f59e0b' : '#3b82f6',
                          border: `2px solid ${isOverdue ? '#ef4444' : isDueToday ? '#f59e0b' : '#3b82f6'}`
                        }}>
                          {isOverdue ? '⚠️ ' : isDueToday ? '⏰ ' : '📅 '}{dueDateDisplay}
                        </div>
                      )}
                      
                      {task.startDate && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', padding: '0.5rem', background: '#f0fdf4', borderRadius: '4px', marginBottom: '0.5rem', border: '1px solid #bbf7d0' }}>
                          <Clock size={10} style={{ display: 'inline', marginRight: '0.25rem', color: '#10b981' }} />
                          Started: {task.startDate}{task.startTime && ` at ${task.startTime}`}
                        </div>
                      )}
                      
                      {task.completionDate && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', padding: '0.5rem', background: '#f0fdf4', borderRadius: '4px', marginBottom: '0.5rem', border: '1px solid #bbf7d0' }}>
                          <CheckCircle2 size={10} style={{ display: 'inline', marginRight: '0.25rem', color: '#10b981' }} />
                          Completed: {task.completionDate}{task.completionTime && ` at ${task.completionTime}`}
                        </div>
                      )}
                      
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', padding: '0.5rem', background: '#f9fafb', borderRadius: '4px', marginBottom: '0.75rem' }}>
                        <User size={10} style={{ display: 'inline', marginRight: '0.25rem' }} />By: {task.createdByName || task.createdBy}
                      </div>
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
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }} />
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="3" style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontFamily: 'inherit' }} />
        <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }}><option value="maintenance">Maintenance</option><option value="landscaping">Landscaping</option><option value="pool">Pool</option><option value="security">Security</option><option value="cleaning">Cleaning</option><option value="repairs">Repairs</option></select>
        <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }} />
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