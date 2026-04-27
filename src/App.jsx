import React, { useState, useEffect, useRef } from 'react';
import { Plus, Download, Calendar, Clock, CheckCircle2, Circle, Trash2, Edit2, Database, RefreshCw, Activity, User, Paperclip, X, ZoomIn, Image, Mail, Send, MessageSquare, FileText, Shield } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

const App = () => {
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [modal, setModal] = useState(false);
  const [logModal, setLogModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [notifyEmails, setNotifyEmails] = useState('');
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState(null);

  const LABELS = [
    { key: 'common-area', label: 'Common Area', color: '#0ea5e9' },
    { key: 'block-a',     label: 'Block A',     color: '#f97316' },
    { key: 'block-b',     label: 'Block B',     color: '#10b981' },
    { key: 'block-c',     label: 'Block C',     color: '#8b5cf6' },
    { key: 'block-d',     label: 'Block D',     color: '#ef4444' },
    { key: 'block-e',     label: 'Block E',     color: '#f59e0b' },
    { key: 'block-f',     label: 'Block F',     color: '#ec4899' },
    { key: 'clubhouse',       label: 'Clubhouse',        color: '#6366f1' },
    { key: 'stilt-parking',   label: 'Stilt Parking',    color: '#0d9488' },
    { key: 'basement-parking',label: 'Basement Parking', color: '#78716c' },
  ];
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [edit, setEdit] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', startDate: '', status: 'backlog', category: 'maintenance', label: '', assignedEmail: '' });
  const [lightbox, setLightbox] = useState(null);
  const [images, setImages] = useState({});   // { [taskId]: (string|null)[] } — 3-slot array
  const [commentInputs, setCommentInputs] = useState({});  // { [taskId]: string }
  const fileRef0 = useRef(null);
  const fileRef1 = useRef(null);
  const fileRef2 = useRef(null);
  const fileRefs = [fileRef0, fileRef1, fileRef2];

  const API_URL = '/api';

  const compressImage = (file) => new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('File must be an image')); return; }
    if (file.size > 10 * 1024 * 1024) { reject(new Error('Image must be under 10 MB')); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 700;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.72), name: file.name });
      };
      img.onerror = () => reject(new Error('Could not read image — format may not be supported'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  const handleImageSelect = async (e, slot) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { dataUrl, name } = await compressImage(file);
      setForm(f => {
        const imgs  = [...(f._images  || [null,null,null])];
        const names = [...(f._imageNames || ['','',''])];
        const rems  = [...(f._removeImages || [false,false,false])];
        imgs[slot] = dataUrl; names[slot] = name; rems[slot] = false;
        return { ...f, _images: imgs, _imageNames: names, _removeImages: rems };
      });
    } catch (err) { alert(err.message); }
    e.target.value = '';
  };

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
        setTasks(tasksData);
        // Fetch images for ALL tasks that have them — visible to every user
        const withImages = tasksData.filter(t => t.imageCount > 0 || t.hasImage);
        if (withImages.length > 0) {
          const results = await Promise.allSettled(
            withImages.map(t => fetch(`${API_URL}/images?id=${t.id}`).then(r => r.json()))
          );
          const imgMap = {};
          withImages.forEach((t, i) => {
            if (results[i].status === 'fulfilled' && Array.isArray(results[i].value?.images)) {
              const slots = results[i].value.images;
              if (slots.some(Boolean)) imgMap[t.id] = slots;
            }
          });
          setImages(prev => ({ ...prev, ...imgMap }));
        }
      } else if (isInitial) {
        setTasks(samples());
      }

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
      const res = await fetch(`${API_URL}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: tasksToSave }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      setStatus('ready');
    } catch (e) {
      console.error('Error saving tasks:', e);
      setStatus('error');
      alert(`Failed to save: ${e.message}. Your changes are visible locally but may not persist after refresh.`);
    }
  };

  const saveLogs = async (logsToSave) => {
    try {
      await fetch(`${API_URL}/logs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logs: logsToSave }) });
    } catch (e) { console.error('Error saving logs:', e); }
  };

  const forgotPassword = async () => {
    setLoginError('');
    setLoginSuccess('');
    if (!username.trim()) { setLoginError('Please enter your email.'); return; }
    if (!password || password.length < 6) { setLoginError('New password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setLoginError('Passwords do not match.'); return; }
    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', email: username.toLowerCase().trim(), newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || 'Reset failed. Please try again.'); return; }
      setIsForgotPassword(false);
      setPassword('');
      setConfirmPassword('');
      setLoginSuccess('Password reset successfully. Please sign in.');
    } catch {
      setLoginError('Connection error. Please try again.');
    }
  };

  const login = async () => {
    setLoginError('');
    setLoginSuccess('');

    if (!username.trim()) { setLoginError('Please enter your email.'); return; }
    if (!password.trim()) { setLoginError('Please enter your password.'); return; }

    if (isRegistering) {
      if (!name.trim()) { setLoginError('Please enter your full name.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username.trim())) { setLoginError('Please enter a valid email address.'); return; }
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
      setImages({});
      setUsername('');
      setName('');
      setPassword('');
      setConfirmPassword('');
      setLoginError('');
      setLoginSuccess('');
      setIsRegistering(false);
      setIsForgotPassword(false);
    }, 500);
  };

  const BLANK_IMGS = { _images: [null,null,null], _imageNames: ['','',''], _removeImages: [false,false,false] };

  const open = (s = 'backlog', t = null) => {
    if (t) {
      const { image: _img, imageName: _name, ...taskFields } = t;
      setEdit(t);
      setForm({ ...taskFields, ...BLANK_IMGS });
    } else {
      setEdit(null);
      setForm({ title: '', description: '', priority: 'medium', dueDate: '', startDate: '', status: s, category: 'maintenance', label: '', assignedEmail: '', ...BLANK_IMGS });
    }
    setModal(true);
  };

  const saveTask = async () => {
    if (!form.title || !form.dueDate) { alert('Fill Title and Due Date'); return; }

    const { _images, _imageNames, _removeImages, image: _oi, imageName: _on, ...taskFields } = form;
    const newImgs  = _images       || [null,null,null];
    const newNames = _imageNames   || ['','',''];
    const remImgs  = _removeImages || [false,false,false];

    let updatedTasks, updatedLogs, taskId;

    const countImages = (tid) => {
      let c = 0;
      for (let i = 0; i < 3; i++) {
        const existing = !!(images[tid]?.[i]);
        if (newImgs[i] || (!remImgs[i] && existing)) c++;
      }
      return c;
    };

    if (edit) {
      taskId = edit.id;
      updatedTasks = tasks.map(t => t.id === taskId
        ? { ...taskFields, id: taskId, imageCount: countImages(taskId), lastModifiedBy: user.username }
        : t);
      updatedLogs = log('UPDATED', form.title, 'Task updated');
    } else {
      taskId = Date.now();
      const imageCount = newImgs.filter(Boolean).length;
      updatedTasks = [...tasks, { ...taskFields, id: taskId, imageCount, createdAt: new Date().toISOString(), createdBy: user.username, createdByName: user.name }];
      updatedLogs = log('CREATED', form.title, `Priority: ${form.priority}`);
    }

    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
    await saveLogs(updatedLogs);

    // Upload / remove each image slot independently in KV
    const localSlots = [...(images[taskId] || [null,null,null])];
    for (let i = 0; i < 3; i++) {
      if (newImgs[i]) {
        try {
          const r = await fetch(`${API_URL}/images`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, index: i, dataUrl: newImgs[i], name: newNames[i] || '' }),
          });
          if (r.ok) localSlots[i] = newImgs[i];
        } catch (e) { console.error(`Image slot ${i} upload failed:`, e); }
      } else if (remImgs[i]) {
        try {
          await fetch(`${API_URL}/images?id=${taskId}&index=${i}`, { method: 'DELETE' });
          localSlots[i] = null;
        } catch (e) { console.error(`Image slot ${i} delete failed:`, e); }
      }
    }
    if (localSlots.some(Boolean)) setImages(prev => ({ ...prev, [taskId]: localSlots }));
    else setImages(prev => { const n = { ...prev }; delete n[taskId]; return n; });

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
    if (t.imageCount > 0 || t.hasImage || t.image) {
      try { await fetch(`${API_URL}/images?id=${id}`, { method: 'DELETE' }); } catch {}
      setImages(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  };

  const sendAlert = async (task) => {
    try {
      const res = await fetch(`${API_URL}/notify?taskId=${task.id}`);
      const data = await res.json();
      if (res.ok) alert(`✅ Alert sent to ${data.email}`);
      else alert(`❌ Failed: ${data.error}`);
    } catch (err) { alert(`❌ Error: ${err.message}`); }
  };

  const addComment = async (taskId) => {
    const text = (commentInputs[taskId] || '').trim();
    if (!text) return;
    const task = tasks.find(x => x.id === taskId);
    if (!task) return;
    const existing = task.comments || [];
    if (existing.length >= 5) { alert('Maximum 5 comments per task.'); return; }
    const comment = { id: Date.now(), text, timestamp: new Date().toISOString(), user: user.username, userName: user.name };
    const updatedTasks = tasks.map(x => x.id === taskId ? { ...x, comments: [...existing, comment] } : x);
    setTasks(updatedTasks);
    setCommentInputs(prev => ({ ...prev, [taskId]: '' }));
    await saveTasks(updatedTasks);
  };

  const nextAthensId = () => {
    const nums = tasks
      .map(x => x.athensId && x.athensId.startsWith('ATHENS-') ? parseInt(x.athensId.slice(7), 10) : 0)
      .filter(n => !isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `ATHENS-${String(next).padStart(4, '0')}`;
  };

  const move = async (id, ns) => {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    const now = new Date();
    const updatedTasks = tasks.map(x => {
      if (x.id === id) {
        const n = { ...x, status: ns };
        if (!x.athensId && (ns === 'in-progress' || ns === 'done')) n.athensId = nextAthensId();
        if (ns === 'in-progress' && !x.startDate) {
          n.startDate = now.toISOString().split('T')[0];
          n.startTime = now.toLocaleTimeString();
        }
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
    const td = tasks.map(t => ({
      'Athens ID': t.athensId || '',
      Title: t.title,
      Description: t.description,
      Priority: t.priority,
      Category: t.category,
      Label: t.label || '',
      Status: t.status,
      'Due Date': t.dueDate,
      'Start Date': t.startDate || '',
      'Start Time': t.startTime || '',
      'Completion Date': t.completionDate || '',
      'Completion Time': t.completionTime || '',
      'Created By': t.createdByName || t.createdBy,
      'Assigned Email': t.assignedEmail || '',
      'Created At': t.createdAt ? new Date(t.createdAt).toLocaleString() : '',
    }));
    const ld = logs.map(l => ({ Time: new Date(l.timestamp).toLocaleString(), User: l.userName, Action: l.action, Task: l.taskTitle, Details: l.details }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(td), 'Tasks');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ld), 'Logs');
    XLSX.writeFile(wb, `Athens_${new Date().toISOString().split('T')[0]}.xlsx`);
    const updatedLogs = log('EXPORTED', '', 'Data exported');
    saveLogs(updatedLogs);
  };

  const exportPdf = async () => {
    setPdfGenerating(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210, pageH = 297, margin = 14, contentW = pageW - margin * 2;
      let y = 0;

      const checkPage = (needed = 20) => {
        if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
      };

      const hexToRgb = hex => {
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return [r,g,b];
      };

      // ── Cover header ──────────────────────────────────────────────────────────
      doc.setFillColor(102, 126, 234);
      doc.rect(0, 0, pageW, 42, 'F');
      doc.setFillColor(118, 75, 162);
      doc.rect(0, 30, pageW, 12, 'F');
      doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold');
      doc.setFontSize(22);
      doc.text('Athens Community', margin, 16);
      doc.setFontSize(11);
      doc.setFont('helvetica','normal');
      doc.text('Facility Management Report', margin, 25);
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleString()}  |  By: ${user.name}`, margin, 37);
      y = 52;

      // ── Summary boxes ─────────────────────────────────────────────────────────
      const bkTasks = tasks.filter(t => t.status === 'backlog');
      const ipTasks = tasks.filter(t => t.status === 'in-progress');
      const dnTasks = tasks.filter(t => t.status === 'done');
      const boxW = (contentW - 8) / 3;
      const summaries = [
        { label: 'Backlog', count: bkTasks.length, r:107,g:114,b:128 },
        { label: 'In Progress', count: ipTasks.length, r:102,g:126,b:234 },
        { label: 'Done', count: dnTasks.length, r:16,g:185,b:129 },
      ];
      summaries.forEach(({ label, count, r, g, b }, i) => {
        const bx = margin + i * (boxW + 4);
        doc.setFillColor(r,g,b);
        doc.rect(bx, y, boxW, 18, 'F');
        doc.setTextColor(255,255,255);
        doc.setFont('helvetica','bold');
        doc.setFontSize(18);
        doc.text(String(count), bx + boxW/2, y + 11, { align:'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica','normal');
        doc.text(label, bx + boxW/2, y + 16, { align:'center' });
      });
      y += 26;

      const pColors = { low:[16,185,129], medium:[245,158,11], high:[239,68,68], critical:[220,38,38] };
      const sections = [
        { label:'BACKLOG', tasks: bkTasks, hR:107,hG:114,hB:128 },
        { label:'IN PROGRESS', tasks: ipTasks, hR:102,hG:126,hB:234 },
        { label:'DONE', tasks: dnTasks, hR:16,hG:185,hB:129 },
      ];

      for (const section of sections) {
        if (!section.tasks.length) continue;

        checkPage(18);
        // Section header bar
        doc.setFillColor(section.hR, section.hG, section.hB);
        doc.rect(margin, y, contentW, 9, 'F');
        doc.setTextColor(255,255,255);
        doc.setFont('helvetica','bold');
        doc.setFontSize(9);
        doc.text(`${section.label}  (${section.tasks.length} task${section.tasks.length !== 1 ? 's' : ''})`, margin + 4, y + 6.2);
        y += 13;

        for (const task of section.tasks) {
          const taskImgs = (() => {
            const slots = Array.isArray(images[task.id])
              ? images[task.id]
              : ((images[task.id] || task.image) ? [images[task.id] || task.image, null, null] : null);
            return (slots || []).filter(Boolean);
          })();

          const descLines = task.description
            ? doc.splitTextToSize(task.description, contentW - 14).slice(0,3)
            : [];
          const hasImgs = taskImgs.length > 0;
          const imgH = hasImgs ? (taskImgs.length === 1 ? 58 : 45) : 0;
          const commentLines = (task.comments || []).slice(0,3);
          const cardH = 8 + (task.athensId ? 5 : 0) + 7 + (descLines.length * 4) + 7 + (hasImgs ? imgH + 4 : 0) + (commentLines.length * 8) + 5;

          checkPage(cardH + 4);

          // Card background + left priority stripe
          const [pcR,pcG,pcB] = pColors[task.priority] || [107,114,128];
          doc.setFillColor(249,250,251);
          doc.setDrawColor(229,231,235);
          doc.rect(margin, y, contentW, cardH, 'FD');
          doc.setFillColor(pcR,pcG,pcB);
          doc.rect(margin, y, 3.5, cardH, 'F');

          let cy = y + 7;

          // Title
          doc.setTextColor(17,24,39);
          doc.setFont('helvetica','bold');
          doc.setFontSize(10);
          const titleLines = doc.splitTextToSize(task.title, contentW - 20);
          doc.text(titleLines[0], margin + 7, cy);
          cy += 5;

          // Athens ID
          if (task.athensId) {
            doc.setFont('helvetica','normal');
            doc.setFontSize(7);
            doc.setTextColor(102,126,234);
            doc.text(task.athensId, margin + 7, cy);
            cy += 5;
          }

          // Priority / Category / Label badges
          let bx = margin + 7;
          const drawBadge = (text, bgR, bgG, bgB, fgR=255, fgG=255, fgB=255) => {
            doc.setFont('helvetica','bold');
            doc.setFontSize(6.5);
            const tw = doc.getTextWidth(text);
            const bw = tw + 5;
            doc.setFillColor(bgR,bgG,bgB);
            doc.roundedRect(bx, cy - 3, bw, 5, 1, 1, 'F');
            doc.setTextColor(fgR,fgG,fgB);
            doc.text(text, bx + 2.5, cy + 0.8);
            bx += bw + 3;
          };
          drawBadge(task.priority.toUpperCase(), pcR, pcG, pcB);
          drawBadge(task.category, 124, 58, 237);
          if (task.label) {
            const lm = LABELS.find(l => l.key === task.label);
            if (lm) { const [lr,lg,lb] = hexToRgb(lm.color); drawBadge(lm.label, lr, lg, lb); }
          }
          cy += 7;

          // Description
          if (descLines.length) {
            doc.setTextColor(107,114,128);
            doc.setFont('helvetica','normal');
            doc.setFontSize(7.5);
            doc.text(descLines, margin + 7, cy);
            cy += descLines.length * 4;
          }

          // Dates row
          doc.setFont('helvetica','normal');
          doc.setFontSize(7);
          doc.setTextColor(107,114,128);
          let dateStr = `Due: ${task.dueDate}`;
          if (task.startDate) dateStr += `   Started: ${task.startDate}`;
          if (task.completionDate) dateStr += `   Completed: ${task.completionDate}`;
          if (task.assignedEmail) dateStr += `   Assigned: ${task.assignedEmail}`;
          doc.text(dateStr, margin + 7, cy);
          cy += 7;

          // Images
          if (hasImgs) {
            const gap = 3;
            const iw = taskImgs.length === 1 ? Math.min(contentW - 14, 90) : (contentW - 14 - gap * (taskImgs.length - 1)) / taskImgs.length;
            let ix = margin + 7;
            for (const src of taskImgs) {
              try {
                doc.addImage(src, 'JPEG', ix, cy, iw, imgH, undefined, 'FAST');
              } catch(_) {}
              ix += iw + gap;
            }
            cy += imgH + 4;
          }

          // Comments
          if (commentLines.length) {
            doc.setFont('helvetica','bold');
            doc.setFontSize(6.5);
            doc.setTextColor(55,65,81);
            doc.text('Comments:', margin + 7, cy);
            cy += 5;
            commentLines.forEach(c => {
              doc.setFont('helvetica','normal');
              doc.setFontSize(6.5);
              doc.setTextColor(75,85,99);
              const cLines = doc.splitTextToSize(`${c.userName || c.user}: ${c.text}`, contentW - 18);
              doc.text(cLines[0], margin + 9, cy);
              cy += 4.5;
            });
          }

          y += cardH + 3;
        }
        y += 5;
      }

      // Page numbers
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica','normal');
        doc.setFontSize(7);
        doc.setTextColor(156,163,175);
        doc.text(`Athens Community Facility Tracker  •  Page ${p} of ${totalPages}`, pageW / 2, pageH - 6, { align:'center' });
      }

      doc.save(`Athens_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      const updatedLogs = log('EXPORTED', '', 'PDF report downloaded');
      saveLogs(updatedLogs);
    } catch (e) {
      console.error('PDF export error:', e);
      alert('PDF generation failed: ' + e.message);
    }
    setPdfGenerating(false);
  };

  const makeBacklogPdfBase64 = async (bkTasks) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210, pageH = 297, margin = 14, contentW = pageW - margin * 2;
    let y = 0;
    const checkPage = (needed = 20) => { if (y + needed > pageH - margin) { doc.addPage(); y = margin; } };
    const hexToRgb = hex => [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];

    doc.setFillColor(102, 126, 234); doc.rect(0, 0, pageW, 42, 'F');
    doc.setFillColor(118, 75, 162); doc.rect(0, 30, pageW, 12, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(22);
    doc.text('Athens Community', margin, 16);
    doc.setFontSize(11); doc.setFont('helvetica','normal');
    doc.text('Backlog Tasks Report', margin, 25);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}  |  By: ${user.name}`, margin, 37);
    y = 52;

    doc.setFillColor(107, 114, 128); doc.rect(margin, y, contentW, 18, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(18);
    doc.text(String(bkTasks.length), margin + contentW/2, y + 11, { align:'center' });
    doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text('Backlog Tasks', margin + contentW/2, y + 16, { align:'center' });
    y += 26;

    const pColors = { low:[16,185,129], medium:[245,158,11], high:[239,68,68], critical:[220,38,38] };
    checkPage(18);
    doc.setFillColor(107, 114, 128); doc.rect(margin, y, contentW, 9, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9);
    doc.text(`BACKLOG  (${bkTasks.length} task${bkTasks.length !== 1 ? 's' : ''})`, margin + 4, y + 6.2);
    y += 13;

    for (const task of bkTasks) {
      const taskImgs = (() => {
        const slots = Array.isArray(images[task.id]) ? images[task.id] : ((images[task.id] || task.image) ? [images[task.id] || task.image, null, null] : null);
        return (slots || []).filter(Boolean);
      })();
      const descLines = task.description ? doc.splitTextToSize(task.description, contentW - 14).slice(0,3) : [];
      const hasImgs = taskImgs.length > 0;
      const imgH = hasImgs ? (taskImgs.length === 1 ? 58 : 45) : 0;
      const commentLines = (task.comments || []).slice(0,3);
      const cardH = 8 + (task.athensId ? 5 : 0) + 7 + (descLines.length * 4) + 7 + (hasImgs ? imgH + 4 : 0) + (commentLines.length * 8) + 5;
      checkPage(cardH + 4);

      const [pcR,pcG,pcB] = pColors[task.priority] || [107,114,128];
      doc.setFillColor(249,250,251); doc.setDrawColor(229,231,235); doc.rect(margin, y, contentW, cardH, 'FD');
      doc.setFillColor(pcR,pcG,pcB); doc.rect(margin, y, 3.5, cardH, 'F');
      let cy = y + 7;

      doc.setTextColor(17,24,39); doc.setFont('helvetica','bold'); doc.setFontSize(10);
      doc.text(doc.splitTextToSize(task.title, contentW - 20)[0], margin + 7, cy); cy += 5;
      if (task.athensId) { doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(102,126,234); doc.text(task.athensId, margin + 7, cy); cy += 5; }

      let bx = margin + 7;
      const drawBadge = (text, bgR, bgG, bgB) => {
        doc.setFont('helvetica','bold'); doc.setFontSize(6.5);
        const bw = doc.getTextWidth(text) + 5;
        doc.setFillColor(bgR,bgG,bgB); doc.roundedRect(bx, cy - 3, bw, 5, 1, 1, 'F');
        doc.setTextColor(255,255,255); doc.text(text, bx + 2.5, cy + 0.8); bx += bw + 3;
      };
      drawBadge(task.priority.toUpperCase(), pcR, pcG, pcB);
      drawBadge(task.category, 124, 58, 237);
      if (task.label) { const lm = LABELS.find(l => l.key === task.label); if (lm) { const [lr,lg,lb] = hexToRgb(lm.color); drawBadge(lm.label, lr, lg, lb); } }
      cy += 7;

      if (descLines.length) { doc.setTextColor(107,114,128); doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.text(descLines, margin + 7, cy); cy += descLines.length * 4; }

      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(107,114,128);
      let dateStr = `Due: ${task.dueDate}`;
      if (task.startDate) dateStr += `   Started: ${task.startDate}`;
      if (task.assignedEmail) dateStr += `   Assigned: ${task.assignedEmail}`;
      doc.text(dateStr, margin + 7, cy); cy += 7;

      if (hasImgs) {
        const gap = 3;
        const iw = taskImgs.length === 1 ? Math.min(contentW - 14, 90) : (contentW - 14 - gap * (taskImgs.length - 1)) / taskImgs.length;
        let ix = margin + 7;
        for (const src of taskImgs) { try { doc.addImage(src, 'JPEG', ix, cy, iw, imgH, undefined, 'FAST'); } catch(_) {} ix += iw + gap; }
        cy += imgH + 4;
      }

      if (commentLines.length) {
        doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(55,65,81); doc.text('Comments:', margin + 7, cy); cy += 5;
        commentLines.forEach(c => { doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(75,85,99); doc.text(doc.splitTextToSize(`${c.userName || c.user}: ${c.text}`, contentW - 18)[0], margin + 9, cy); cy += 4.5; });
      }
      y += cardH + 3;
    }

    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p); doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(156,163,175);
      doc.text(`Athens Community Facility Tracker  •  Page ${p} of ${totalPages}`, pageW / 2, pageH - 6, { align:'center' });
    }
    return doc.output('datauristring').split(',')[1];
  };

  const sendBacklogNotify = async () => {
    const emailList = notifyEmails
      .split(/[\n,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (emailList.length === 0) { alert('Please enter at least one valid email address.'); return; }
    const backlogTasks = tasks.filter(t => t.status === 'backlog');
    if (backlogTasks.length === 0) { alert('There are no backlog tasks to notify about.'); return; }
    setNotifySending(true);
    setNotifyResult(null);
    try {
      const pdfBase64 = await makeBacklogPdfBase64(backlogTasks);
      const pdfFilename = `Athens_Backlog_${new Date().toISOString().split('T')[0]}.pdf`;
      const res = await fetch(`${API_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emailList, message: notifyMessage, pdfBase64, pdfFilename }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotifyResult({ success: true, ...data });
        const updatedLogs = log('NOTIFY', '', `Backlog notification sent to ${emailList.length} recipient(s)`);
        saveLogs(updatedLogs);
      } else {
        setNotifyResult({ success: false, error: data.error || 'Unknown error' });
      }
    } catch (err) {
      setNotifyResult({ success: false, error: err.message });
    }
    setNotifySending(false);
  };

  const stats = { t: tasks.length, o: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== 'done').length, d: tasks.filter(t => t.status === 'done').length };

  const categoryMeta = [
    { key: 'maintenance',  label: 'Maintenance',   color: '#3b82f6' },
    { key: 'pool',         label: 'Pool',           color: '#06b6d4' },
    { key: 'landscaping',  label: 'Landscaping',    color: '#10b981' },
    { key: 'security',     label: 'Security',       color: '#f59e0b' },
    { key: 'cleaning',     label: 'Cleaning',       color: '#8b5cf6' },
    { key: 'repairs',      label: 'Repairs',        color: '#ef4444' },
    { key: 'electrical',   label: 'Electrical',     color: '#f97316' },
    { key: 'plumbing',     label: 'Plumbing',       color: '#0ea5e9' },
    { key: 'parking',      label: 'Parking',        color: '#6b7280' },
    { key: 'gym',          label: 'Gym / Fitness',  color: '#ec4899' },
    { key: 'common-areas', label: 'Common Areas',   color: '#14b8a6' },
    { key: 'pest-control', label: 'Pest Control',   color: '#a16207' },
    { key: 'elevators',    label: 'Elevators',      color: '#7c3aed' },
    { key: 'admin',        label: 'Administration', color: '#64748b' },
  ];
  const catData = categoryMeta
    .map(({ key, label, color }) => ({ label, color, count: tasks.filter(t => t.category === key).length }))
    .filter(d => d.count > 0);
  const maxCatCount = Math.max(...catData.map(d => d.count), 1);

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
        .forgot-link { text-align:right; margin-top:-10px; margin-bottom:16px; }
        .forgot-link button { background:none; border:none; color:rgba(212,175,55,0.6); font-size:12px; cursor:pointer; font-family:'Rajdhani',sans-serif; letter-spacing:0.5px; }
        .forgot-link button:hover { color:#f0c93a; }
        .success-box { background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); border-radius:3px; padding:10px 14px; margin-bottom:18px; font-size:13px; color:#6ee7b7; letter-spacing:0.3px; }
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
            <span /><p>{isForgotPassword ? 'Reset Password' : isRegistering ? 'Register' : 'Sign In'}</p><span />
          </div>

          {loginError && <div className="error-box">⚠ {loginError}</div>}
          {loginSuccess && <div className="success-box">✓ {loginSuccess}</div>}

          {isForgotPassword ? (
            <>
              <div className="field">
                <label>Email</label>
                <div className="field-wrap">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setLoginError(''); }}
                    onKeyPress={e => e.key === 'Enter' && forgotPassword()}
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="field">
                <label>New Password</label>
                <div className="field-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="has-toggle"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setLoginError(''); }}
                    onKeyPress={e => e.key === 'Enter' && forgotPassword()}
                    autoComplete="new-password"
                  />
                  <button type="button" className="toggle-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Confirm New Password</label>
                <div className="field-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setLoginError(''); }}
                    onKeyPress={e => e.key === 'Enter' && forgotPassword()}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <button className="submit-btn" onClick={forgotPassword}>Reset Password</button>
              <div className="switch-link">
                <button onClick={() => { setIsForgotPassword(false); setLoginError(''); setPassword(''); setConfirmPassword(''); setUsername(''); }}>
                  Back to Sign In
                </button>
              </div>
            </>
          ) : (
            <>
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
                <label>Email</label>
                <div className="field-wrap">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setLoginError(''); setLoginSuccess(''); }}
                    onKeyPress={e => e.key === 'Enter' && login()}
                    autoFocus={!isRegistering}
                    autoComplete="email"
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

              {!isRegistering && (
                <div className="forgot-link">
                  <button onClick={() => { setIsForgotPassword(true); setLoginError(''); setLoginSuccess(''); setPassword(''); setConfirmPassword(''); }}>
                    Forgot password?
                  </button>
                </div>
              )}

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
                <button onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); setLoginSuccess(''); setPassword(''); setConfirmPassword(''); }}>
                  {isRegistering ? 'Sign In' : 'Register'}
                </button>
              </div>
            </>
          )}

          <div className="login-footer"><strong>CAAOA</strong> · Casagrand Athens</div>
        </div>
      </div>
    </>
  );

  // ── MAIN APP ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>

        {/* ── Header & Stats ── */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div><h1 style={{ margin: 0, fontSize: '2rem' }}>Athens Community</h1><p style={{ margin: 0, color: '#6b7280' }}>Tracker Facility Management</p></div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ padding: '0.75rem 1rem', background: '#667eea', color: 'white', borderRadius: '50px', fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <User size={16} />{user.name}
                {user.role === 'admin' && <span style={{ background: '#fbbf24', color: '#92400e', fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.25rem' }}>ADMIN</span>}
              </div>
              <div style={{ padding: '0.75rem 1rem', background: status === 'ready' ? '#d1fae5' : status === 'syncing' ? '#fef3c7' : '#fee2e2', color: status === 'ready' ? '#10b981' : status === 'syncing' ? '#f59e0b' : '#ef4444', borderRadius: '8px', fontWeight: 600, display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Database size={16} />{status}</div>
              {user?.role === 'admin' && <button onClick={() => setLogModal(true)} style={{ padding: '0.75rem 1rem', background: 'white', color: '#667eea', border: '2px solid #667eea', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Activity size={16} />Log</button>}
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

        {/* ── Tab Bar ── */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button onClick={() => setActiveTab('dashboard')} style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', border: 'none', background: activeTab === 'dashboard' ? 'white' : 'rgba(255,255,255,0.25)', color: activeTab === 'dashboard' ? '#667eea' : 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: activeTab === 'dashboard' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle2 size={16} />Dashboard
          </button>
          {user.role === 'admin' && (
            <button onClick={() => setActiveTab('admin')} style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', border: 'none', background: activeTab === 'admin' ? 'white' : 'rgba(255,255,255,0.25)', color: activeTab === 'admin' ? '#667eea' : 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: activeTab === 'admin' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Shield size={16} />Admin Report
            </button>
          )}
          {user.role === 'admin' && (
            <button onClick={() => { setActiveTab('notify'); setNotifyResult(null); }} style={{ padding: '0.65rem 1.5rem', borderRadius: '10px', border: 'none', background: activeTab === 'notify' ? 'white' : 'rgba(255,255,255,0.25)', color: activeTab === 'notify' ? '#667eea' : 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', boxShadow: activeTab === 'notify' ? '0 2px 8px rgba(0,0,0,0.12)' : 'none', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Mail size={16} />Notify Backlog
            </button>
          )}
        </div>

        {/* ── Admin Report Tab ── */}
        {activeTab === 'admin' && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '2.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', borderRadius: '10px', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={22} color="white" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#111827' }}>PDF Report</h2>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Download all tasks with images as a PDF document</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', margin: '2rem 0' }}>
              {[
                { label: 'Backlog', count: tasks.filter(t=>t.status==='backlog').length, color:'#6b7280', bg:'#f3f4f6' },
                { label: 'In Progress', count: tasks.filter(t=>t.status==='in-progress').length, color:'#667eea', bg:'#ede9fe' },
                { label: 'Done', count: tasks.filter(t=>t.status==='done').length, color:'#10b981', bg:'#d1fae5' },
              ].map(({ label, count, color, bg }) => (
                <div key={label} style={{ padding: '1.25rem', background: bg, borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: 800, color }}>{count}</div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '1.25rem', marginBottom: '2rem', border: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700, color: '#374151', marginBottom: '0.5rem', fontSize: '0.9rem' }}>What's included in the PDF:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#6b7280', fontSize: '0.875rem', lineHeight: '1.9' }}>
                <li>Cover page with report summary (Backlog / In Progress / Done counts)</li>
                <li>All tasks grouped by status with priority colour coding</li>
                <li>Task details: title, ID, category, label, description, due dates</li>
                <li>Embedded photos (up to 3 per task)</li>
                <li>Comments (up to 3 per task)</li>
                <li>Page numbers on every page</li>
              </ul>
            </div>

            <button
              onClick={exportPdf}
              disabled={pdfGenerating || tasks.length === 0}
              style={{ padding: '0.9rem 2.5rem', background: pdfGenerating ? '#9ca3af' : 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '1rem', cursor: pdfGenerating || tasks.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', boxShadow: '0 4px 14px rgba(102,126,234,0.4)', transition: 'opacity 0.2s' }}>
              <FileText size={18} />
              {pdfGenerating ? 'Generating PDF…' : `Download PDF Report (${tasks.length} task${tasks.length !== 1 ? 's' : ''})`}
            </button>
            {tasks.length === 0 && <p style={{ marginTop: '0.75rem', color: '#9ca3af', fontSize: '0.8rem' }}>No tasks to export.</p>}
          </div>
        )}

        {/* ── Notify Backlog Tab ── */}
        {activeTab === 'notify' && (() => {
          const backlogTasks = tasks.filter(t => t.status === 'backlog');
          return (
            <div style={{ background: 'white', borderRadius: '16px', padding: '2.5rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
                <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', borderRadius: '10px', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={22} color="white" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#111827' }}>Notify Backlog</h2>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Send all backlog tasks to one or more recipients with a custom message</p>
                </div>
              </div>

              {/* Backlog task preview */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Circle size={14} style={{ color: '#667eea' }} />
                  Backlog Tasks ({backlogTasks.length})
                </div>
                {backlogTasks.length === 0 ? (
                  <div style={{ padding: '1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center' }}>
                    No tasks currently in the backlog.
                  </div>
                ) : (
                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '4px' }}>
                    {backlogTasks.map(t => {
                      const pc = pri[t.priority] || pri.medium;
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.9rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderLeft: `4px solid ${pc.c}`, borderRadius: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', flex: 1 }}>{t.title}</span>
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: pc.b, color: pc.c, flexShrink: 0 }}>{t.priority.toUpperCase()}</span>
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: '#ede9fe', color: '#7c3aed', flexShrink: 0 }}>{t.category}</span>
                          <span style={{ fontSize: '0.7rem', color: '#9ca3af', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Calendar size={10} />{t.dueDate}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recipient email(s) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
                  Recipient Email(s)
                  <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '0.5rem' }}>separate multiple addresses with commas or new lines</span>
                </label>
                <textarea
                  value={notifyEmails}
                  onChange={e => setNotifyEmails(e.target.value)}
                  placeholder={'manager@example.com\ncommittee@example.com, vendor@example.com'}
                  rows={3}
                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '10px', fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = '#667eea'; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }}
                />
              </div>

              {/* Custom message */}
              <div style={{ marginBottom: '1.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem' }}>
                  Message
                  <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: '0.5rem' }}>optional note included at the top of the email</span>
                </label>
                <textarea
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  placeholder="Please review the outstanding backlog tasks and take action where necessary…"
                  rows={4}
                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '10px', fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = '#667eea'; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }}
                />
              </div>

              {/* Result banner */}
              {notifyResult && (
                <div style={{ padding: '0.9rem 1.1rem', borderRadius: '10px', marginBottom: '1.25rem', background: notifyResult.success ? '#d1fae5' : '#fee2e2', border: `1px solid ${notifyResult.success ? '#6ee7b7' : '#fca5a5'}`, color: notifyResult.success ? '#065f46' : '#991b1b', fontSize: '0.875rem', fontWeight: 600 }}>
                  {notifyResult.success
                    ? `Emails sent — ${notifyResult.sent} of ${notifyResult.total} recipients received the notification.`
                    : `Failed to send: ${notifyResult.error}`}
                </div>
              )}

              <button
                onClick={sendBacklogNotify}
                disabled={notifySending || backlogTasks.length === 0}
                style={{ padding: '0.9rem 2.5rem', background: notifySending ? '#9ca3af' : 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '1rem', cursor: notifySending || backlogTasks.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', boxShadow: '0 4px 14px rgba(102,126,234,0.4)', transition: 'opacity 0.2s' }}>
                <Send size={18} />
                {notifySending ? 'Sending…' : `Send to Recipients (${backlogTasks.length} task${backlogTasks.length !== 1 ? 's' : ''})`}
              </button>
            </div>
          );
        })()}

        {/* ── Tasks by Category Dashboard ── */}
        {activeTab === 'dashboard' && <>
        {catData.length > 0 && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem 2rem', marginBottom: '2rem' }}>
            <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Tasks by Category</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {catData.map(({ label, color, count }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '90px', fontSize: '0.8rem', color: '#374151', textAlign: 'right', flexShrink: 0 }}>{label}</div>
                  <div style={{ flex: 1, background: '#f3f4f6', borderRadius: '4px', height: '22px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(count / maxCatCount) * 100}%`,
                      background: color,
                      height: '100%',
                      borderRadius: '4px',
                      transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                      minWidth: '4px',
                    }} />
                  </div>
                  <div style={{ width: '20px', fontSize: '0.85rem', fontWeight: 700, color: '#111827', flexShrink: 0 }}>{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Category Filter Bar ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', alignSelf: 'center', marginRight: '0.25rem' }}>CATEGORY</span>
          <button onClick={() => setCategoryFilter('all')} style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', border: '2px solid', borderColor: categoryFilter === 'all' ? '#667eea' : '#e5e7eb', background: categoryFilter === 'all' ? '#667eea' : 'white', color: categoryFilter === 'all' ? 'white' : '#6b7280', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>All</button>
          {categoryMeta.filter(({ key }) => tasks.some(t => t.category === key)).map(({ key, label, color }) => (
            <button key={key} onClick={() => setCategoryFilter(k => k === key ? 'all' : key)} style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', border: '2px solid', borderColor: categoryFilter === key ? color : '#e5e7eb', background: categoryFilter === key ? color : 'white', color: categoryFilter === key ? 'white' : '#6b7280', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' }}>{label}</button>
          ))}
        </div>

        {/* ── Label Filter Bar ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', alignSelf: 'center', marginRight: '0.25rem' }}>LABEL</span>
          <button onClick={() => setLabelFilter('all')} style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', border: '2px solid', borderColor: labelFilter === 'all' ? '#374151' : '#e5e7eb', background: labelFilter === 'all' ? '#374151' : 'white', color: labelFilter === 'all' ? 'white' : '#6b7280', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>All</button>
          {LABELS.filter(({ key }) => tasks.some(t => t.label === key)).map(({ key, label, color }) => (
            <button key={key} onClick={() => setLabelFilter(k => k === key ? 'all' : key)} style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', border: '2px solid', borderColor: labelFilter === key ? color : '#e5e7eb', background: labelFilter === key ? color : 'white', color: labelFilter === key ? 'white' : '#6b7280', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' }}>{label}</button>
          ))}
        </div>

        {/* ── Kanban Board ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {cols.map(col => {
            const Icon = col.I;
            return (
              <div key={col.id} style={{ background: 'white', borderRadius: '16px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '2px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><Icon size={24} style={{ color: '#667eea' }} /><h3 style={{ margin: 0 }}>{col.t}</h3></div>
                  <div style={{ background: '#667eea', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '20px', fontWeight: 700 }}>{tasks.filter(t => t.status === col.id && (categoryFilter === 'all' || t.category === categoryFilter) && (labelFilter === 'all' || t.label === labelFilter)).length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '200px', marginBottom: '1rem' }}>
                  {tasks.filter(t => t.status === col.id && (categoryFilter === 'all' || t.category === categoryFilter) && (labelFilter === 'all' || t.label === labelFilter)).map(task => {
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <div style={{ fontWeight: 700, flex: 1 }}>{task.title}</div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => open(task.status, task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><Edit2 size={16} /></button>
                            {task.assignedEmail && task.status !== 'done' && <button onClick={() => sendAlert(task)} title={`Send alert to ${task.assignedEmail}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667eea' }}><Send size={16} /></button>}
                            {user.role === 'admin' && <button onClick={() => del(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><Trash2 size={16} /></button>}
                          </div>
                        </div>
                        {task.athensId && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#667eea', marginBottom: '0.35rem', letterSpacing: '0.03em' }}>{task.athensId}</div>}
                        <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>{task.description}</div>
                        {task.assignedEmail && <div style={{ fontSize: '0.75rem', color: '#667eea', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Mail size={11} />{task.assignedEmail}</div>}
                        {(() => {
                          // Support both new (array) and old (string) image formats
                          const slots = Array.isArray(images[task.id])
                            ? images[task.id]
                            : (images[task.id] || task.image) ? [images[task.id] || task.image, null, null] : null;
                          const visible = slots?.filter(Boolean);
                          if (!visible?.length) return null;
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: visible.length === 1 ? '1fr' : visible.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr', gap: '4px', marginBottom: '0.75rem' }}>
                              {visible.map((src, idx) => (
                                <div key={idx} style={{ position: 'relative', cursor: 'pointer', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e5e7eb' }}
                                  onClick={() => setLightbox({ src, title: task.title, all: visible, idx })}>
                                  <img src={src} alt={`photo ${idx+1}`} style={{ width: '100%', height: visible.length === 1 ? '120px' : '80px', objectFit: 'cover', display: 'block' }} />
                                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background='rgba(0,0,0,0.3)'; e.currentTarget.querySelector('svg').style.opacity='1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background='rgba(0,0,0,0)'; e.currentTarget.querySelector('svg').style.opacity='0'; }}>
                                    <ZoomIn size={20} style={{ color: 'white', opacity: 0, transition: 'opacity 0.2s' }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: pri[task.priority].b, color: pri[task.priority].c }}>{task.priority.toUpperCase()}</span>
                          <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: '#ede9fe', color: '#7c3aed' }}>{task.category}</span>
                          {task.label && (() => { const lm = LABELS.find(l => l.key === task.label); return lm ? <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: lm.color + '22', color: lm.color }}>{lm.label}</span> : null; })()}
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
                        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MessageSquare size={12} />Comments ({(task.comments || []).length}/5)
                          </div>
                          {(task.comments || []).map(c => (
                            <div key={c.id} style={{ fontSize: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.5rem', marginBottom: '0.4rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                <span style={{ fontWeight: 600, color: '#374151' }}>{c.userName || c.user}</span>
                                <span style={{ color: '#9ca3af' }}>{new Date(c.timestamp).toLocaleString()}</span>
                              </div>
                              <div style={{ color: '#4b5563' }}>{c.text}</div>
                            </div>
                          ))}
                          {(task.comments || []).length < 5 && (
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                              <input
                                value={commentInputs[task.id] || ''}
                                onChange={e => setCommentInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') addComment(task.id); }}
                                placeholder="Add a comment…"
                                style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none' }}
                              />
                              <button onClick={() => addComment(task.id)} style={{ padding: '0.4rem 0.6rem', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Post</button>
                            </div>
                          )}
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
        </>}
      </div>

      {modal && (
        <div onClick={() => setModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px', padding: '2rem', margin: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>{edit ? 'Edit' : 'Add'} Task</h3>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title" style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box' }} />
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows="3" style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }}>
              {categoryMeta.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select value={form.label || ''} onChange={e => setForm({ ...form, label: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px' }}>
              <option value="">-- No Label --</option>
              {LABELS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
            <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box' }} />
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Mail size={13} />Assign to Email <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional — receives overdue alerts)</span></div>
              <input type="email" value={form.assignedEmail || ''} onChange={e => setForm({ ...form, assignedEmail: e.target.value })} placeholder="e.g. manager@example.com" style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', boxSizing: 'border-box' }} />
            </div>

            {/* ── Photo Attachments (up to 3) ── */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Paperclip size={13} />Photo Attachments <span style={{ fontWeight: 400, color: '#9ca3af' }}>(up to 3)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {[0,1,2].map(slot => {
                  const newUrl = form._images?.[slot];
                  const removing = form._removeImages?.[slot];
                  const existingUrl = removing ? null : (edit ? images[edit.id]?.[slot] : null);
                  const displayUrl = newUrl || existingUrl;
                  return (
                    <div key={slot}>
                      {displayUrl ? (
                        <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '2px solid #e5e7eb' }}>
                          <img src={displayUrl} alt={`photo ${slot+1}`} style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block' }} />
                          <button onClick={() => setForm(f => {
                            const imgs = [...(f._images||[null,null,null])];
                            const rems = [...(f._removeImages||[false,false,false])];
                            if (imgs[slot]) { imgs[slot] = null; }
                            else { rems[slot] = true; }
                            return { ...f, _images: imgs, _removeImages: rems };
                          })} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                            <X size={10} />
                          </button>
                          <div style={{ fontSize: '0.65rem', color: '#9ca3af', textAlign: 'center', padding: '2px' }}>Photo {slot+1}</div>
                        </div>
                      ) : (
                        <div onClick={() => fileRefs[slot].current?.click()}
                          style={{ border: '2px dashed #d1d5db', borderRadius: '8px', height: '110px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#d1d5db', transition: 'border-color 0.2s, color 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor='#667eea'; e.currentTarget.style.color='#667eea'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor='#d1d5db'; e.currentTarget.style.color='#d1d5db'; }}>
                          <Image size={20} />
                          <div style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: 600 }}>Photo {slot+1}</div>
                        </div>
                      )}
                      <input ref={fileRefs[slot]} type="file" accept="image/*" onChange={e => handleImageSelect(e, slot)} style={{ display: 'none' }} />
                    </div>
                  );
                })}
              </div>
            </div>

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

      {/* ── Image Lightbox ── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src={lightbox.src} alt={lightbox.title} style={{ maxWidth: '88vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: '8px', display: 'block' }} />
            <div style={{ color: 'white', textAlign: 'center', marginTop: '0.75rem', fontWeight: 600, fontSize: '0.95rem' }}>
              {lightbox.title}{lightbox.all?.length > 1 ? ` · ${lightbox.idx + 1}/${lightbox.all.length}` : ''}
            </div>
            {lightbox.all?.length > 1 && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                {lightbox.all.map((s, i) => (
                  <img key={i} src={s} onClick={() => setLightbox(lb => ({ ...lb, src: s, idx: i }))}
                    style={{ width: '56px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: i === lightbox.idx ? '2px solid #667eea' : '2px solid transparent', opacity: i === lightbox.idx ? 1 : 0.6 }} />
                ))}
              </div>
            )}
            <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: '-12px', right: '-12px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}><X size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
