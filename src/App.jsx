import React, { useState, useEffect } from 'react';
import { Plus, Download, Calendar, Clock, CheckCircle2, Circle, Trash2, Edit2, Database, RefreshCw, Activity, User, Mail, X, AlertTriangle, MessageSquare, Send, Tag, Search, Filter, XCircle, FileText, Image, BellOff, Bell } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = '/api';

const PRIORITY = {
  low:      { color: '#10b981', bg: '#d1fae5' },
  medium:   { color: '#f59e0b', bg: '#fef3c7' },
  high:     { color: '#ef4444', bg: '#fee2e2' },
  critical: { color: '#dc2626', bg: '#fee2e2' },
};

const CATEGORIES = [
  { value: '',          label: 'Select category…',          color: '#6b7280', bg: '#f3f4f6' },
  { value: 'revenue',  label: 'Revenue',                   color: '#059669', bg: '#d1fae5' },
  { value: 'security', label: 'Security',                  color: '#dc2626', bg: '#fee2e2' },
  { value: 'meeting',  label: 'Meeting',                   color: '#7c3aed', bg: '#ede9fe' },
  { value: 'community-events',    label: 'Community Events',        color: '#0891b2', bg: '#cffafe' },
  { value: 'cleanliness',        label: 'Cleanliness',             color: '#16a34a', bg: '#dcfce7' },
  { value: 'ifm',                label: 'IFM',                     color: '#9333ea', bg: '#f3e8ff' },
  { value: 'eb-monitoring',      label: 'EB Monitoring',           color: '#ca8a04', bg: '#fef9c3' },
  { value: 'wtp',                label: 'WTP',                     color: '#0369a1', bg: '#e0f2fe' },
  { value: 'water-sewerage',     label: 'Water & Sewerage Tankers',color: '#0e7490', bg: '#ccfbf1' },
  { value: 'parking',            label: 'Parking',                 color: '#b45309', bg: '#fef3c7' },
  { value: 'lifts',              label: 'Lifts',                   color: '#be185d', bg: '#fce7f3' },
  { value: 'cams',              label: 'CAMS',                    color: '#475569', bg: '#f1f5f9' },
  { value: 'clubhouse',        label: 'Clubhouse',               color: '#b45309', bg: '#fef3c7' },
  { value: 'light',            label: 'Light',                   color: '#a16207', bg: '#fefce8' },
  { value: 'acs',              label: "AC's",                    color: '#0369a1', bg: '#e0f2fe' },
  { value: 'rules-regulations',label: 'Rules and Regulations',   color: '#7c2d12', bg: '#ffedd5' },
  { value: 'mygate',           label: 'Mygate',                  color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'ev-carwash',       label: 'EV & Carwash Bay',        color: '#15803d', bg: '#dcfce7' },
  { value: 'vendors',          label: 'Vendors',                 color: '#92400e', bg: '#fef3c7' },
  { value: 'association',      label: 'Association',             color: '#1e3a5f', bg: '#dbeafe' },
];

const COLS = [
  { id: 'backlog',      label: 'Backlog',     Icon: Circle },
  { id: 'in-progress',  label: 'In Progress', Icon: Clock },
  { id: 'done',         label: 'Done',        Icon: CheckCircle2 },
];

const BLANK_FORM = {
  title: '', description: '', priority: 'medium', dueDate: '',
  status: 'backlog', category: '', taskRole: 'EC Member',
  assigneeName: '', assigneeEmail: '', assigneeEmails: [], reporterName: '',
  images: [],
};

const MAX_COMMENTS = 5;
const MAX_IMAGES = 3;

// ── Image compression ─────────────────────────────────────────────────────────

function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchNextTaskId() {
  const res = await fetch(`${API_URL}/counter`, { method: 'POST' });
  const data = await res.json();
  return data.taskId;
}

async function sendAssignEmail(taskId, email) {
  try {
    const url = email ? `${API_URL}/notify?action=assign&taskId=${taskId}&email=${encodeURIComponent(email)}` : `${API_URL}/notify?action=assign&taskId=${taskId}`;
    const res = await fetch(url);
    return res.ok;
  } catch { return false; }
}

function categoryMeta(value) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[0];
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Login ──────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [communityRole, setCommunityRole] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = (newMode) => { setMode(newMode); setError(''); setSuccess(''); setPassword(''); setConfirm(''); setCommunityRole(''); };

  const submit = async () => {
    setError(''); setSuccess('');
    if (!email.trim()) return setError('Please enter your email address.');

    if (mode === 'forgot') {
      if (!password.trim()) return setError('Please enter a new password.');
      if (password.length < 6) return setError('Password must be at least 6 characters.');
      if (password !== confirm) return setError('Passwords do not match.');
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset-password', username: email.toLowerCase().trim(), newPassword: password }),
        });
        const data = await res.json();
        if (!res.ok) return setError(data.error || 'Something went wrong.');
        setSuccess('Password reset successfully! You can now sign in.');
        setTimeout(() => reset('login'), 2000);
      } catch { setError('Connection error. Please try again.'); }
      finally { setLoading(false); }
      return;
    }

    if (!password.trim()) return setError('Please enter your password.');
    if (mode === 'register') {
      if (!fullName.trim()) return setError('Please enter your full name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address.');
      if (!communityRole) return setError('Please select your role.');
      if (password.length < 6) return setError('Password must be at least 6 characters.');
      if (password !== confirm) return setError('Passwords do not match.');
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode === 'register' ? 'register' : 'login', username: email.toLowerCase().trim(), name: fullName.trim(), password, communityRole }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Something went wrong.');
      onLogin(data.user);
    } catch { setError('Connection error. Please try again.'); }
    finally { setLoading(false); }
  };

  const sel = { width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb', borderRadius: 8, fontSize: '14px', outline: 'none', marginBottom: 0, background: 'white', color: '#111827' };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .lr{min-height:100vh;background:url('/login-bg.jpg') center center / cover no-repeat;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;position:relative;overflow:hidden;}.lr::before{content:'';position:absolute;inset:0;background:rgba(5,8,20,0.55);z-index:0;}
        .lc{position:relative;z-index:1;width:100%;max-width:400px;margin:20px;background:white;border-radius:16px;padding:40px;box-shadow:0 20px 60px rgba(0,0,0,0.3);}
        .lh{text-align:center;margin-bottom:32px;}
        .li{width:56px;height:56px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;}
        .lt{font-size:22px;font-weight:700;color:#111827;}.ls{font-size:13px;color:#6b7280;margin-top:4px;}
        .lf{margin-bottom:16px;}.lf label{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;}
        .lf input,.lf select{width:100%;padding:10px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;outline:none;transition:border-color .2s;box-sizing:border-box;}
        .lf input:focus,.lf select:focus{border-color:#3b82f6;}.pw{position:relative;}.pw input{padding-right:40px;}
        .pt{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;color:#9ca3af;}
        .eb{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#dc2626;}
        .ok{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#15803d;}
        .sb{width:100%;padding:12px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:8px;}
        .sb:disabled{opacity:.6;cursor:not-allowed;}
        .sl{text-align:center;margin-top:16px;font-size:13px;color:#6b7280;}.sl button{background:none;border:none;color:#3b82f6;font-weight:600;cursor:pointer;font-size:13px;}
        .fp{text-align:right;margin-top:-8px;margin-bottom:16px;}.fp button{background:none;border:none;color:#3b82f6;font-size:12px;cursor:pointer;font-weight:500;}
      `}</style>
      <div className="lr">
        <div className="lc">
          <div className="lh">
            <div className="li">📋</div>
            <div className="lt">Athens EC Tasks</div>
            <div className="ls">{mode === 'forgot' ? 'Reset Password' : 'Tasks Dashboard'}</div>
          </div>
          {error && <div className="eb">{error}</div>}
          {success && <div className="ok">{success}</div>}
          {mode === 'register' && (
            <div className="lf"><label>Full Name</label>
              <input type="text" placeholder="Your full name" value={fullName} onChange={e => { setFullName(e.target.value); setError(''); }} autoFocus />
            </div>
          )}
          <div className="lf"><label>Email ID</label>
            <input type="email" placeholder="yourname@email.com" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} onKeyPress={e => e.key === 'Enter' && submit()} autoFocus={mode !== 'register'} />
          </div>
          {mode === 'register' && (
            <div className="lf"><label>Role</label>
              <select value={communityRole} onChange={e => { setCommunityRole(e.target.value); setError(''); }} style={sel}>
                <option value="">Select your role…</option>
                <option value="EC Member">EC Member</option>
                <option value="Sub-committee Member">Sub-committee Member</option>
              </select>
            </div>
          )}
          <div className="lf"><label>{mode === 'forgot' ? 'New Password' : 'Password'}</label>
            <div className="pw">
              <input type={showPass ? 'text' : 'password'} placeholder={mode === 'forgot' ? 'Enter new password' : 'Enter password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }} onKeyPress={e => e.key === 'Enter' && submit()} />
              <button type="button" className="pt" onClick={() => setShowPass(v => !v)}>{showPass ? '🙈' : '👁'}</button>
            </div>
          </div>
          {mode === 'login' && (
            <div className="fp"><button onClick={() => reset('forgot')}>Forgot Password?</button></div>
          )}
          {(mode === 'register' || mode === 'forgot') && (
            <div className="lf"><label>Confirm Password</label>
              <input type={showPass ? 'text' : 'password'} placeholder="Confirm password" value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} onKeyPress={e => e.key === 'Enter' && submit()} />
            </div>
          )}
          <button className="sb" onClick={submit} disabled={loading}>
            {loading ? 'Please wait…' : mode === 'register' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Sign In'}
          </button>
          <div className="sl">
            {mode === 'forgot' ? (
              <><span>Remembered it? </span><button onClick={() => reset('login')}>Sign In</button></>
            ) : mode === 'register' ? (
              <><span>Already have an account? </span><button onClick={() => reset('login')}>Sign In</button></>
            ) : (
              <><span>Don't have an account? </span><button onClick={() => reset('register')}>Register</button></>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Due-date badge ─────────────────────────────────────────────────────────────

function DueBadge({ dueDate, status }) {
  if (!dueDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = Math.ceil((due - today) / 86400000);
  const overdue = diff < 0 && status !== 'done';
  const dueToday = diff === 0 && status !== 'done';
  let label = '', bg = '#dbeafe', color = '#3b82f6', border = '#3b82f6';
  if (overdue)       { label = `⚠️ ${Math.abs(diff)}d overdue`;  bg = '#fee2e2'; color = '#ef4444'; border = '#ef4444'; }
  else if (dueToday) { label = '⏰ Due today!';                   bg = '#fef3c7'; color = '#f59e0b'; border = '#f59e0b'; }
  else if (diff === 1) { label = '📅 Due tomorrow'; }
  else if (diff > 1)   { label = `📅 ${diff}d remaining`; }
  if (!label) return null;
  return <div style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 8px', borderRadius: 6, marginBottom: 8, background: bg, color, border: `2px solid ${border}` }}>{label}</div>;
}

// ── Comments section ───────────────────────────────────────────────────────────

function CommentsSection({ task, user, members = [], onAddComment }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [mentionDropdown, setMentionDropdown] = useState([]);
  const comments = task.comments || [];
  const atLimit = comments.length >= MAX_COMMENTS;

  const handleInput = (val) => {
    setText(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0) {
      const afterAt = val.slice(lastAt + 1);
      if (!afterAt.includes(' ')) {
        const q = afterAt.toLowerCase();
        const suggestions = members.filter(m =>
          m.username !== user.username &&
          (m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q))
        );
        setMentionDropdown(suggestions);
        return;
      }
    }
    setMentionDropdown([]);
  };

  const selectMention = (member) => {
    const lastAt = text.lastIndexOf('@');
    const before = text.slice(0, lastAt);
    setText(`${before}@${member.username} `);
    setMentionDropdown([]);
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAddComment(task.id, trimmed);
    setText('');
    setMentionDropdown([]);
  };

  return (
    <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 10, paddingTop: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#6b7280', fontSize: '0.78rem', fontWeight: 600, padding: '2px 0', width: '100%' }}
      >
        <MessageSquare size={13} />
        Comments ({comments.length}/{MAX_COMMENTS})
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          {comments.length === 0 && (
            <div style={{ fontSize: '0.78rem', color: '#d1d5db', textAlign: 'center', padding: '8px 0' }}>No comments yet.</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ marginBottom: 8, padding: '8px 10px', background: '#f9fafb', borderRadius: 8, borderLeft: '3px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>{c.author}</span>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{timeAgo(c.timestamp)}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.4 }}>
                {c.text.split(/(@\S+@\S+\.\S+)/g).map((part, i) =>
                  /^@\S+@\S+\.\S+$/.test(part)
                    ? <span key={i} style={{ color: '#2563eb', fontWeight: 600 }}>{part}</span>
                    : part
                )}
              </div>
            </div>
          ))}

          {!atLimit ? (
            <div style={{ position: 'relative', marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={text}
                  onChange={e => handleInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setMentionDropdown([]);
                    if (e.key === 'Enter' && mentionDropdown.length === 0) submit();
                  }}
                  onBlur={() => setTimeout(() => setMentionDropdown([]), 150)}
                  placeholder="Add a comment… type @ to mention"
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
                />
                <button
                  onClick={submit}
                  disabled={!text.trim()}
                  style={{ padding: '6px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: text.trim() ? 1 : 0.4 }}
                >
                  <Send size={13} />
                </button>
              </div>
              {mentionDropdown.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 9999, marginTop: 4, overflow: 'hidden', maxHeight: 180, overflowY: 'auto' }}>
                  <div style={{ padding: '0.3rem 0.7rem', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', borderBottom: '1px solid #f3f4f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tag member</div>
                  {mentionDropdown.map(m => (
                    <div
                      key={m.username}
                      onMouseDown={e => { e.preventDefault(); selectMention(m); }}
                      style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: 'white' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}
                    >
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>@</span>
                      <span style={{ fontWeight: 700, color: '#111827' }}>{m.name}</span>
                      <span style={{ color: '#93c5fd', fontWeight: 400, fontSize: '0.75rem' }}>{m.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', padding: '4px 0' }}>
              Maximum {MAX_COMMENTS} comments reached.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Task Card ──────────────────────────────────────────────────────────────────

function TaskCard({ task, user, onEdit, onDelete, onMove, onAddComment, onAlert, members, scIndex }) {
  const p = PRIORITY[task.priority] || PRIORITY.medium;
  const cat = categoryMeta(task.category);
  const [lightbox, setLightbox] = useState(null);
  const [alerting, setAlerting] = useState(false);

  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '1rem', border: '1px solid #e5e7eb', borderLeft: `4px solid ${p.color}`, marginBottom: '0.75rem' }}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.05em' }}>{task.id}</div>
            {scIndex != null && (
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.05em' }}>SC-{String(scIndex).padStart(3, '0')}</div>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{task.title}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => onEdit(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}><Edit2 size={15} /></button>
          {user.role === 'admin' && <button onClick={() => onDelete(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}><Trash2 size={15} /></button>}
        </div>
      </div>

      {task.description && <div style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: 8 }}>{task.description}</div>}

      {/* Badges row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: p.bg, color: p.color }}>{(task.priority || '').toUpperCase()}</span>
        {task.category && (
          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: cat.bg, color: cat.color, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Tag size={9} />{cat.label}
          </span>
        )}
        {task.taskRole && (
          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700, background: task.taskRole === 'Sub-committee Member' ? '#fef3c7' : '#dbeafe', color: task.taskRole === 'Sub-committee Member' ? '#92400e' : '#1e40af' }}>
            {task.taskRole === 'Sub-committee Member' ? 'Sub-committee' : 'EC Member'}
          </span>
        )}
      </div>

      <DueBadge dueDate={task.dueDate} status={task.status} />

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
        {task.dueDate && (
          <div style={{ fontSize: '0.75rem', color: '#6b7280', padding: '4px 8px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={10} /><strong>Due:</strong> {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
        )}
        {(task.startedAt || task.startDate) && (
          <div style={{ fontSize: '0.75rem', color: '#059669', padding: '4px 8px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} /><strong>Started:</strong> {task.startedAt ? formatDateTime(task.startedAt) : `${task.startDate}${task.startTime ? ` at ${task.startTime}` : ''}`}
          </div>
        )}
        {(task.completedAt || task.completionDate) && (
          <div style={{ fontSize: '0.75rem', color: '#1d4ed8', padding: '4px 8px', background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={10} /><strong>Completed:</strong> {task.completedAt ? formatDateTime(task.completedAt) : `${task.completionDate}${task.completionTime ? ` at ${task.completionTime}` : ''}`}
          </div>
        )}
      </div>

      {/* People */}
      {task.reporterName && (
        <div style={{ fontSize: '0.75rem', color: '#6b7280', padding: '4px 8px', background: '#f9fafb', borderRadius: 6, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <User size={10} />Reporter: <strong>{task.reporterName}</strong>
        </div>
      )}
      {(() => {
        const emails = task.assigneeEmails?.length > 0 ? task.assigneeEmails : (task.assigneeEmail ? [task.assigneeEmail] : []);
        if (!emails.length) return null;
        return (
          <div style={{ fontSize: '0.75rem', color: '#1d4ed8', padding: '4px 8px', background: '#eff6ff', borderRadius: 6, marginBottom: 8, border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <User size={10} />Assigned:&nbsp;
            {emails.map((e, i) => <strong key={e}>{e}{i < emails.length - 1 ? ', ' : ''}</strong>)}
          </div>
        );
      })()}

      {/* Move buttons */}
      {task.status !== 'done' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {task.status === 'backlog' && (
            <button onClick={() => onMove(task.id, 'in-progress')} style={{ flex: 1, padding: '6px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Start</button>
          )}
          {task.status === 'in-progress' && (
            <>
              <button onClick={() => onMove(task.id, 'backlog')} style={{ flex: 1, padding: '6px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Back</button>
              <button onClick={() => onMove(task.id, 'done')} style={{ flex: 1, padding: '6px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Done</button>
            </>
          )}
        </div>
      )}
      {task.status === 'done' && (
        <button onClick={() => onMove(task.id, 'in-progress')} style={{ width: '100%', padding: '6px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', marginTop: 4 }}>Reopen</button>
      )}

      {/* Alert button — visible if task has assignees */}
      {(() => {
        const emails = task.assigneeEmails?.length > 0 ? task.assigneeEmails : (task.assigneeEmail ? [task.assigneeEmail] : []);
        if (!emails.length || !onAlert) return null;
        return (
          <button
            onClick={async () => {
              setAlerting(true);
              await onAlert(task);
              setAlerting(false);
            }}
            disabled={alerting}
            style={{ width: '100%', marginTop: 6, padding: '6px', background: alerting ? '#e5e7eb' : '#fef3c7', color: alerting ? '#9ca3af' : '#92400e', border: '1px solid #fde68a', borderRadius: 6, fontWeight: 600, cursor: alerting ? 'not-allowed' : 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            <AlertTriangle size={13} />
            {alerting ? 'Sending…' : `Alert ${emails.length} assignee${emails.length > 1 ? 's' : ''}`}
          </button>
        );
      })()}

      {/* Images */}
      {(task.images || []).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, marginTop: 6 }}>
          {task.images.map((src, i) => (
            <img key={i} src={src} alt="" onClick={() => setLightbox(src)}
              style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'zoom-in' }} />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
          <img src={lightbox} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 10, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'white', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>
      )}

      {/* Comments */}
      <CommentsSection task={task} user={user} members={members} onAddComment={onAddComment} />
    </div>
  );
}

// ── External Email Input ───────────────────────────────────────────────────────

function ExternalEmailInput({ assigneeEmails, onAdd, inp }) {
  const [value, setValue] = useState('');
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const isAlreadyAdded = assigneeEmails.includes(value.trim().toLowerCase());

  const add = () => {
    const email = value.trim().toLowerCase();
    if (!isValid || isAlreadyAdded) return;
    onAdd(email);
    setValue('');
  };

  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <Mail size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          style={{ ...inp, paddingLeft: 32, marginBottom: 0 }}
          type="email"
          value={value}
          placeholder="external@email.com"
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
      </div>
      <button
        type="button"
        onClick={add}
        disabled={!isValid || isAlreadyAdded}
        style={{ padding: '0 14px', background: isValid && !isAlreadyAdded ? '#3b82f6' : '#e5e7eb', color: isValid && !isAlreadyAdded ? 'white' : '#9ca3af', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem', cursor: isValid && !isAlreadyAdded ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}
      >
        + Add
      </button>
    </div>
  );
}

// ── Task Modal ─────────────────────────────────────────────────────────────────

function TaskModal({ form, setForm, onSave, onClose, isEdit, members = [], user }) {
  const isSubcommitteeMember = user?.communityRole === 'Sub-committee Member';
  const inp = { width: '100%', padding: '9px 12px', border: '2px solid #e5e7eb', borderRadius: 8, fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12, outline: 'none' };
  const lbl = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };

  const handleImageUpload = async e => {
    const files = Array.from(e.target.files);
    const current = form.images || [];
    const slots = MAX_IMAGES - current.length;
    if (slots <= 0) return;
    const compressed = await Promise.all(files.slice(0, slots).map(compressImage));
    setForm(f => ({ ...f, images: [...(f.images || []), ...compressed] }));
    e.target.value = '';
  };

  const removeImage = idx => setForm(f => ({ ...f, images: (f.images || []).filter((_, i) => i !== idx) }));

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 520, padding: '2rem', margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827' }}>{isEdit ? 'Edit Task' : 'New Task'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
        </div>

        <label style={lbl}>Title *</label>
        <input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" />

        <label style={lbl}>Description</label>
        <textarea style={{ ...inp, resize: 'vertical' }} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />

        {/* Category */}
        <label style={lbl}>Category</label>
        <select style={inp} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <label style={lbl}>Task For</label>
        {isSubcommitteeMember ? (
          <div style={{ ...inp, background: '#f9fafb', color: '#6b7280', cursor: 'not-allowed', marginBottom: 12 }}>Sub-committee Member</div>
        ) : (
          <select style={inp} value={form.taskRole} onChange={e => setForm(f => ({ ...f, taskRole: e.target.value }))}>
            <option value="EC Member">EC Member</option>
            <option value="Sub-committee Member">Sub-committee Member</option>
          </select>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: isEdit ? 'auto' : '1 / -1' }}>
            <label style={lbl}>Priority</label>
            <select style={{ ...inp, marginBottom: 0 }} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          {isEdit && (
            <div>
              <label style={lbl}>Status</label>
              <select style={{ ...inp, marginBottom: 0 }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="backlog">Backlog</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={lbl}>Due Date *</label>
          <input style={inp} type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
        </div>

        <div style={{ borderTop: '2px solid #f3f4f6', paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={13} /> People
          </div>
          <label style={lbl}>Reporter Name</label>
          <input style={inp} value={form.reporterName} onChange={e => setForm(f => ({ ...f, reporterName: e.target.value }))} placeholder="Reported by" />

          <label style={lbl}>Assign To (select multiple)</label>
          {/* Selected tags */}
          {(form.assigneeEmails || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {(form.assigneeEmails || []).map(email => {
                const m = members.find(x => x.username === email);
                return (
                  <span key={email} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 20, padding: '3px 8px 3px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
                    {m ? m.name : email}
                    <button type="button" onClick={() => setForm(f => ({ ...f, assigneeEmails: f.assigneeEmails.filter(e => e !== email) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', padding: 0, lineHeight: 1 }}>
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {/* Member list to click */}
          {members.length > 0 && (
            <div style={{ border: '2px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
              {['EC Member', 'Sub-committee Member'].map(roleGroup => {
                const group = members.filter(m => m.communityRole === roleGroup);
                if (!group.length) return null;
                return (
                  <div key={roleGroup}>
                    <div style={{ padding: '4px 10px', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', background: '#f9fafb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{roleGroup}</div>
                    {group.map(m => {
                      const selected = (form.assigneeEmails || []).includes(m.username);
                      return (
                        <div
                          key={m.username}
                          onClick={() => setForm(f => ({
                            ...f,
                            assigneeEmails: selected
                              ? f.assigneeEmails.filter(e => e !== m.username)
                              : [...(f.assigneeEmails || []), m.username]
                          }))}
                          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: selected ? '#eff6ff' : 'white', borderTop: '1px solid #f3f4f6' }}
                          onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f9fafb'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = selected ? '#eff6ff' : 'white'; }}
                        >
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${selected ? '#3b82f6' : '#d1d5db'}`, background: selected ? '#3b82f6' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {selected && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{m.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto' }}>{m.username}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          {/* External email input — always shown */}
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Add External Email
          </div>
          <ExternalEmailInput
            assigneeEmails={form.assigneeEmails || []}
            onAdd={email => setForm(f => ({ ...f, assigneeEmails: [...new Set([...(f.assigneeEmails || []), email])] }))}
            inp={inp}
          />
          {(form.assigneeEmails || []).length > 0 && (
            <div style={{ fontSize: '12px', color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 10px', marginBottom: 12 }}>
              📧 Email will be sent to: {(form.assigneeEmails || []).map(e => {
                const m = members.find(x => x.username === e);
                return m ? m.name : e;
              }).join(', ')}
            </div>
          )}
        </div>

        {/* Images */}
        <div style={{ borderTop: '2px solid #f3f4f6', paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Image size={13} /> Images ({(form.images || []).length}/{MAX_IMAGES})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(form.images || []).map((src, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid #e5e7eb', display: 'block' }} />
                <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: -7, right: -7, background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 14, lineHeight: '20px', textAlign: 'center', padding: 0 }}>×</button>
              </div>
            ))}
            {(form.images || []).length < MAX_IMAGES && (
              <label style={{ width: 80, height: 80, border: '2px dashed #d1d5db', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9ca3af', gap: 4, flexShrink: 0 }}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageUpload} />
                <Image size={20} />
                <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Add</span>
              </label>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onSave} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
            {isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Log Modal ──────────────────────────────────────────────────────────────────

function LogModal({ logs, onClose }) {
  const colors = { CREATED: '#10b981', UPDATED: '#3b82f6', DELETED: '#ef4444', COMPLETED: '#059669', MOVED: '#f59e0b', LOGIN: '#7c3aed', LOGOUT: '#6b7280', EXPORTED: '#0284c7', SYSTEM: '#6b7280', REGISTERED: '#8b5cf6', COMMENTED: '#06b6d4' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '80vh', overflow: 'auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', fontWeight: 700 }}><Activity size={20} />Activity Log</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.length === 0 && <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No activity yet.</div>}
          {logs.map(l => (
            <div key={l.id} style={{ padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: 8, borderLeft: `4px solid ${colors[l.action] || '#6b7280'}` }}>
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: 2 }}>{new Date(l.timestamp).toLocaleString()}</div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{l.userName} — {l.action}</div>
              {l.taskTitle && <div style={{ fontSize: '0.83rem', color: '#6b7280' }}>Task: {l.taskTitle}</div>}
              {l.details && <div style={{ fontSize: '0.83rem', color: '#6b7280', fontStyle: 'italic' }}>{l.details}</div>}
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width: '100%', padding: '10px', marginTop: 16, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
}

// ── Users Modal ────────────────────────────────────────────────────────────────

function UsersModal({ members: initialMembers, currentUser, onClose }) {
  const [members, setMembers] = useState(initialMembers);
  const [editing, setEditing] = useState({}); // { username: selectedRole }
  const [saving, setSaving] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const now = new Date();
  const isActive = lastSeen => lastSeen && (now - new Date(lastSeen)) < 10 * 60 * 1000;
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never logged in';
    const diff = (now - new Date(lastSeen)) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min${Math.floor(diff / 60) > 1 ? 's' : ''} ago`;
    const hrs = diff / 3600;
    if (hrs < 24) return `${Math.floor(hrs)} hr${Math.floor(hrs) > 1 ? 's' : ''} ago`;
    const days = hrs / 24;
    const t = new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days < 2) return `Yesterday at ${t}`;
    if (days < 7) return `${Math.floor(days)} days ago at ${t}`;
    return new Date(lastSeen).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const saveRole = async (username) => {
    const newCommunityRole = editing[username];
    setSaving(username);
    try {
      const res = await fetch(`${API_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-role', username: currentUser.username, targetUsername: username, newCommunityRole }),
      });
      const data = await res.json();
      if (!res.ok) { setFeedback({ type: 'error', msg: data.error || 'Update failed.' }); }
      else {
        setMembers(prev => prev.map(m => m.username === username ? { ...m, communityRole: newCommunityRole } : m));
        setEditing(prev => { const n = { ...prev }; delete n[username]; return n; });
        setFeedback({ type: 'success', msg: 'Role updated successfully.' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch { setFeedback({ type: 'error', msg: 'Connection error. Please try again.' }); }
    finally { setSaving(null); }
  };

  const UserRow = ({ m }) => {
    const isEditing = editing[m.username] !== undefined;
    return (
      <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
              {m.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>{m.name}</div>
              <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{m.communityRole}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {m.username === currentUser.username && (
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#dbeafe', color: '#1d4ed8' }}>You</span>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              {isActive(m.lastSeen) ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#d1fae5', color: '#065f46' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />Online now
                </span>
              ) : (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#9ca3af' }}>Offline</span>
              )}
              <span style={{ fontSize: '0.68rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatLastSeen(m.lastSeen)}</span>
            </div>
            {m.username !== currentUser.username && !isEditing && (
              <button onClick={() => setEditing(prev => ({ ...prev, [m.username]: m.communityRole }))}
                style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 9px', borderRadius: 6, background: 'white', color: '#7c3aed', border: '1.5px solid #7c3aed', cursor: 'pointer' }}>
                Edit Role
              </button>
            )}
          </div>
        </div>
        {isEditing && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <select
              value={editing[m.username]}
              onChange={e => setEditing(prev => ({ ...prev, [m.username]: e.target.value }))}
              style={{ flex: 1, padding: '7px 10px', border: '2px solid #7c3aed', borderRadius: 8, fontSize: '0.83rem', outline: 'none', background: 'white' }}
            >
              <option value="EC Member">EC Member</option>
              <option value="Sub-committee Member">Sub-committee Member</option>
            </select>
            <button onClick={() => saveRole(m.username)} disabled={saving === m.username}
              style={{ padding: '7px 14px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.83rem', opacity: saving === m.username ? 0.6 : 1 }}>
              {saving === m.username ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(prev => { const n = { ...prev }; delete n[m.username]; return n; })}
              style={{ padding: '7px 10px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.83rem' }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  };

  const sortByLastSeen = arr => [...arr].sort((a, b) => {
    if (!a.lastSeen && !b.lastSeen) return 0;
    if (!a.lastSeen) return 1;
    if (!b.lastSeen) return -1;
    return new Date(b.lastSeen) - new Date(a.lastSeen);
  });
  const ecMembers = sortByLastSeen(members.filter(m => m.communityRole === 'EC Member'));
  const subMembers = sortByLastSeen(members.filter(m => m.communityRole === 'Sub-committee Member'));

  const Section = ({ title, list }) => list.length === 0 ? null : (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{title} ({list.length})</div>
      {list.map(m => <UserRow key={m.username} m={m} />)}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '85vh', overflow: 'auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', fontWeight: 700, margin: 0 }}><User size={20} />Registered Users</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
        </div>
        {feedback && (
          <div style={{ padding: '8px 14px', borderRadius: 8, marginBottom: 14, fontSize: '0.83rem', fontWeight: 600, background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2', color: feedback.type === 'success' ? '#15803d' : '#dc2626', border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}` }}>
            {feedback.msg}
          </div>
        )}
        {members.length === 0 ? (
          <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>No registered users yet.</div>
        ) : (
          <>
            <Section title="EC Members" list={ecMembers} />
            <Section title="Sub-committee Members" list={subMembers} />
          </>
        )}
        <div style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
          Online now = active within the last 10 minutes
        </div>
        <button onClick={onClose} style={{ width: '100%', padding: '10px', marginTop: 16, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [modal, setModal] = useState(false);
  const [logModal, setLogModal] = useState(false);
  const [usersModal, setUsersModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [toast, setToast] = useState(null);
  const [overdueAlertsEnabled, setOverdueAlertsEnabled] = useState(true);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };
  const [filters, setFilters] = useState({ search: '', category: '', priority: '', assignee: '' });

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadData = async (isInitial = false) => {
    try {
      setStatus('loading');
      const [tr, lr] = await Promise.all([fetch(`${API_URL}/tasks`), fetch(`${API_URL}/logs`)]);
      const tasksData = await tr.json();
      const logsData  = await lr.json();
      if (Array.isArray(tasksData) && (tasksData.length > 0 || !isInitial)) setTasks(tasksData);
      else if (isInitial) setTasks(sampleTasks());
      if (Array.isArray(logsData) && logsData.length > 0) setLogs(logsData);
      setStatus('ready');
    } catch {
      if (isInitial) setTasks(sampleTasks());
      setStatus('error');
    }
  };

  useEffect(() => {
    if (user) {
      loadData(true);
      const iv = setInterval(() => loadData(false), 30000);
      return () => clearInterval(iv);
    }
  }, [user]);

  const sampleTasks = () => {
    const d = o => { const x = new Date(); x.setDate(x.getDate() + o); return x.toISOString().split('T')[0]; };
    return [
      { id: 'CAAOA-0001', title: 'Quarterly EC Review', description: 'Review Q2 financials', priority: 'high', category: 'revenue', dueDate: d(5), status: 'backlog', reporterName: 'Admin', assigneeName: '', assigneeEmail: '', comments: [], createdAt: new Date().toISOString(), createdBy: 'system' },
      { id: 'CAAOA-0002', title: 'Update Member Notices', description: 'Send AGM notices to all members', priority: 'critical', category: 'meeting', dueDate: d(2), status: 'in-progress', reporterName: 'Admin', assigneeName: 'Guruprasath', assigneeEmail: '', startDate: d(0), startTime: new Date().toLocaleTimeString(), comments: [], createdAt: new Date().toISOString(), createdBy: 'system' },
      { id: 'CAAOA-0003', title: 'Prepare Budget Report', description: 'Annual budget presentation', priority: 'medium', category: 'revenue', dueDate: d(14), status: 'backlog', reporterName: 'Admin', assigneeName: '', assigneeEmail: '', comments: [], createdAt: new Date().toISOString(), createdBy: 'system' },
      { id: 'CAAOA-0004', title: 'Vendor Invoice Check', description: 'Verify outstanding invoices', priority: 'low', category: 'community-events', dueDate: d(-2), status: 'done', reporterName: 'Admin', assigneeName: '', assigneeEmail: '', completionDate: d(-1), completionTime: '14:30:00', comments: [], createdAt: new Date().toISOString(), createdBy: 'system' },
    ];
  };

  // ── API helpers ──────────────────────────────────────────────────────────────

  const saveTasks = async t => {
    setStatus('syncing');
    try { await fetch(`${API_URL}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: t }) }); setStatus('ready'); }
    catch { setStatus('error'); }
  };

  const saveLogs = async l => {
    try { await fetch(`${API_URL}/logs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logs: l }) }); } catch {}
  };

  const addLog = (action, taskTitle, details = '') => {
    const entry = { id: Date.now(), timestamp: new Date().toISOString(), user: user.username, userName: user.name, action, taskTitle, details };
    const updated = [entry, ...logs];
    setLogs(updated);
    return updated;
  };

  // ── Auth ─────────────────────────────────────────────────────────────────────

  const handleLogin = async loggedInUser => {
    setUser(loggedInUser);
    try {
      const mr = await fetch(`${API_URL}/members`);
      if (mr.ok) { const md = await mr.json(); if (Array.isArray(md)) setMembers(md); }
    } catch {}
    try {
      const sr = await fetch(`${API_URL}/settings`);
      if (sr.ok) { const sd = await sr.json(); setOverdueAlertsEnabled(sd.overdueAlertsEnabled !== false); }
    } catch {}
    try {
      const lr = await fetch(`${API_URL}/logs`);
      const existing = await lr.json() || [];
      const entry = { id: Date.now(), timestamp: new Date().toISOString(), user: loggedInUser.username, userName: loggedInUser.name, action: 'LOGIN', taskTitle: '', details: 'User logged in' };
      const updated = [entry, ...existing];
      setLogs(updated);
      await saveLogs(updated);
    } catch {}
  };

  const logout = () => { const l = addLog('LOGOUT', '', 'User logged out'); saveLogs(l); setTimeout(() => { setUser(null); setTasks([]); setLogs([]); }, 300); };

  const toggleOverdueAlerts = async () => {
    const newVal = !overdueAlertsEnabled;
    setOverdueAlertsEnabled(newVal);
    try {
      await fetch(`${API_URL}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overdueAlertsEnabled: newVal }) });
      showToast(`Overdue mail alerts ${newVal ? 'enabled' : 'disabled'}.`, 'success');
    } catch { setOverdueAlertsEnabled(!newVal); showToast('Failed to update setting.', 'error'); }
  };

  // ── Task CRUD ─────────────────────────────────────────────────────────────────

  const openNew = (defaultStatus = 'backlog') => {
    setEdit(null);
    setForm({ ...BLANK_FORM, status: defaultStatus, reporterName: user.name, taskRole: user.communityRole === 'Sub-committee Member' ? 'Sub-committee Member' : 'EC Member' });
    setModal(true);
  };

  const openEdit = task => {
    setEdit(task);
    const existingEmails = task.assigneeEmails?.length > 0 ? task.assigneeEmails : (task.assigneeEmail ? [task.assigneeEmail] : []);
    setForm({ title: task.title || '', description: task.description || '', priority: task.priority || 'medium', dueDate: task.dueDate || '', status: task.status || 'backlog', category: task.category || '', taskRole: task.taskRole || 'EC Member', assigneeName: task.assigneeName || '', assigneeEmail: task.assigneeEmail || '', assigneeEmails: existingEmails, reporterName: task.reporterName || '', images: task.images || [] });
    setModal(true);
  };

  const saveTask = async () => {
    if (!form.title.trim()) return alert('Title is required.');
    if (!form.dueDate) return alert('Due date is required.');

    const now = new Date();
    let updatedTasks, updatedLogs, taskId;
    const assigneeEmails = form.assigneeEmails || [];
    const prevEmails = edit?.assigneeEmails?.length > 0 ? edit.assigneeEmails : (edit?.assigneeEmail ? [edit.assigneeEmail] : []);
    const primaryEmail = assigneeEmails[0] || '';
    const primaryMember = members.find(m => m.username === primaryEmail);
    const formWithAssign = { ...form, assigneeEmails, assigneeEmail: primaryEmail, assigneeName: primaryMember?.name || form.assigneeName || '' };

    if (edit) {
      taskId = edit.id;
      updatedTasks = tasks.map(t => {
        if (t.id !== taskId) return t;
        const n = { ...t, ...formWithAssign, id: taskId, comments: t.comments || [], lastModifiedBy: user.username, lastModifiedAt: now.toISOString() };
        if (formWithAssign.status === 'in-progress' && !t.startedAt) { n.startedAt = now.toISOString(); }
        if (formWithAssign.status === 'done' && !t.completedAt) { n.completedAt = now.toISOString(); }
        if (formWithAssign.status !== 'done') { n.completedAt = null; }
        return n;
      });
      updatedLogs = addLog('UPDATED', form.title, assigneeEmails.length ? `Assigned to ${assigneeEmails.join(', ')}` : '');
    } else {
      taskId = await fetchNextTaskId();
      const newTask = { ...formWithAssign, id: taskId, comments: [], createdAt: now.toISOString(), createdBy: user.username, createdByName: user.name };
      if (formWithAssign.status === 'in-progress') { newTask.startDate = now.toISOString().split('T')[0]; newTask.startTime = now.toLocaleTimeString(); }
      if (formWithAssign.status === 'done') { newTask.completionDate = now.toISOString().split('T')[0]; newTask.completionTime = now.toLocaleTimeString(); }
      updatedTasks = [...tasks, newTask];
      updatedLogs = addLog('CREATED', form.title, `${taskId}${assigneeEmails.length ? ` · Assigned to ${assigneeEmails.join(', ')}` : ` · Priority: ${form.priority}`}`);
    }

    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
    await saveLogs(updatedLogs);
    const newEmails = assigneeEmails.filter(e => !prevEmails.includes(e));
    if (newEmails.length > 0) {
      const results = await Promise.all(newEmails.map(email => sendAssignEmail(taskId, email)));
      const sent = newEmails.filter((_, i) => results[i]);
      if (sent.length > 0) showToast(`✅ Email sent to ${sent.join(', ')}`, 'success');
      else showToast('❌ Failed to send assignment emails', 'error');
    }
    setModal(false);
  };

  const deleteTask = async id => {
    if (user.role !== 'admin') return alert('Only admins can delete tasks.');
    const task = tasks.find(t => t.id === id);
    if (!task || !confirm(`Delete "${task.title}"?`)) return;
    const updated = tasks.filter(t => t.id !== id);
    const l = addLog('DELETED', task.title, '');
    setTasks(updated);
    await saveTasks(updated);
    await saveLogs(l);
  };

  const moveTask = async (id, newStatus) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const now = new Date();
    const updated = tasks.map(t => {
      if (t.id !== id) return t;
      const n = { ...t, status: newStatus };
      if (newStatus === 'in-progress' && !t.startedAt) { n.startedAt = now.toISOString(); }
      if (newStatus === 'done') { n.completedAt = now.toISOString(); }
      if (newStatus === 'backlog' || newStatus === 'in-progress') { n.completedAt = null; }
      return n;
    });
    const l = addLog(newStatus === 'done' ? 'COMPLETED' : 'MOVED', task.title, `→ ${newStatus}`);
    setTasks(updated);
    await saveTasks(updated);
    await saveLogs(l);
  };

  const sendAlert = async (task) => {
    const emails = task.assigneeEmails?.length > 0 ? task.assigneeEmails : (task.assigneeEmail ? [task.assigneeEmail] : []);
    if (!emails.length) return;
    const results = await Promise.all(emails.map(email => sendAssignEmail(task.id, email)));
    const sent = emails.filter((_, i) => results[i]);
    if (sent.length > 0) showToast(`✅ Alert sent to ${sent.join(', ')}`, 'success');
    else showToast('❌ Failed to send alert', 'error');
  };

  const addComment = async (taskId, text) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const comments = task.comments || [];
    if (comments.length >= MAX_COMMENTS) return;
    const comment = { id: Date.now(), author: user.name, text, timestamp: new Date().toISOString() };
    const updated = tasks.map(t => t.id === taskId ? { ...t, comments: [...comments, comment] } : t);
    const l = addLog('COMMENTED', task.title, `"${text.substring(0, 60)}${text.length > 60 ? '…' : ''}"`);
    setTasks(updated);
    await saveTasks(updated);
    await saveLogs(l);
    // Send email to @mentioned members
    const mentions = [...text.matchAll(/@([^\s@]+@[^\s@]+\.[^\s@]+)/g)].map(m => m[1]);
    if (mentions.length > 0) {
      fetch(`${API_URL}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: mentions,
          message: `💬 ${user.name} mentioned you in a comment on task "${task.title}":\n\n"${text}"`,
          tasks: [{ ...task, comments: [...comments, comment] }]
        })
      }).catch(() => {});
    }
  };

  const clearAll = async () => {
    if (user.role !== 'admin') return alert('Only admins can clear all tasks.');
    if (!confirm('Delete ALL tasks?')) return;
    const l = addLog('SYSTEM', '', 'All tasks cleared');
    setTasks([]);
    await fetch(`${API_URL}/tasks`, { method: 'DELETE' });
    await saveLogs(l);
  };

  const exportXLSX = () => {
    const td = tasks.map(t => ({ 'Task ID': t.id, Title: t.title, Description: t.description, Category: categoryMeta(t.category).label, Priority: t.priority, Status: t.status, 'Due Date': t.dueDate, Reporter: t.reporterName, Assignee: t.assigneeName, 'Assignee Email': t.assigneeEmail, 'Start Date': t.startDate, 'Completion Date': t.completionDate, 'Comments': (t.comments || []).map(c => `${c.author}: ${c.text}`).join(' | '), 'Created By': t.createdByName }));
    const ld = logs.map(l => ({ Time: new Date(l.timestamp).toLocaleString(), User: l.userName, Action: l.action, Task: l.taskTitle, Details: l.details }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(td), 'Tasks');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ld), 'Logs');
    XLSX.writeFile(wb, `AthensEC_${new Date().toISOString().split('T')[0]}.xlsx`);
    const l = addLog('EXPORTED', '', 'Data exported to Excel');
    saveLogs(l);
  };

  // ── PDF Report ───────────────────────────────────────────────────────────────

  const generateReport = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const W = 210;

    // ── Cover header ──────────────────────────────────────────────────────────
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, W, 48, 'F');
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 44, W, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Athens EC Tasks Dashboard', 14, 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Executive Committee Task Report', 14, 30);
    doc.setFontSize(9);
    doc.text(`Generated: ${dateStr} at ${timeStr}   |   Generated by: ${user.name}`, 14, 40);

    // ── Summary stats ─────────────────────────────────────────────────────────
    const total    = tasks.length;
    const backlog  = tasks.filter(t => t.status === 'backlog').length;
    const inProg   = tasks.filter(t => t.status === 'in-progress').length;
    const done     = tasks.filter(t => t.status === 'done').length;
    const today    = new Date(); today.setHours(0,0,0,0);
    const overdue  = tasks.filter(t => t.dueDate && new Date(t.dueDate + 'T00:00:00') < today && t.status !== 'done').length;
    const assigned = tasks.filter(t => t.assigneeName).length;

    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Summary', 14, 60);

    autoTable(doc, {
      startY: 64,
      head: [['Total Tasks', 'Backlog', 'In Progress', 'Done', 'Overdue', 'Assigned']],
      body: [[total, backlog, inProg, done, overdue, assigned]],
      styles: { fontSize: 10, halign: 'center' },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { halign: 'center' },
      columnStyles: { 4: { textColor: overdue > 0 ? [220, 38, 38] : [17, 24, 39], fontStyle: overdue > 0 ? 'bold' : 'normal' } },
      margin: { left: 14, right: 14 },
    });

    // ── Tasks by category ─────────────────────────────────────────────────────
    const afterSummary = doc.lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Tasks by Category', 14, afterSummary);

    const catCounts = {};
    tasks.forEach(t => {
      const label = categoryMeta(t.category).label || 'Uncategorised';
      catCounts[label] = (catCounts[label] || 0) + 1;
    });
    const catRows = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => [cat, count, `${Math.round((count / total) * 100)}%`]);

    autoTable(doc, {
      startY: afterSummary + 4,
      head: [['Category', 'Tasks', 'Share']],
      body: catRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    });

    // ── Tasks by priority ─────────────────────────────────────────────────────
    const afterCat = doc.lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Tasks by Priority', 14, afterCat);

    const priColors = { critical: [220, 38, 38], high: [239, 68, 68], medium: [245, 158, 11], low: [16, 185, 129] };
    const priOrder  = ['critical', 'high', 'medium', 'low'];
    const priRows   = priOrder.map(p => {
      const count = tasks.filter(t => t.priority === p).length;
      return [p.charAt(0).toUpperCase() + p.slice(1), count, `${Math.round((count / (total || 1)) * 100)}%`];
    });

    autoTable(doc, {
      startY: afterCat + 4,
      head: [['Priority', 'Tasks', 'Share']],
      body: priRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const p = priOrder[data.row.index];
          if (priColors[p]) { data.cell.styles.textColor = priColors[p]; data.cell.styles.fontStyle = 'bold'; }
        }
      },
      margin: { left: 14, right: 14 },
    });

    // ── Overdue tasks ─────────────────────────────────────────────────────────
    const overdueList = tasks.filter(t => t.dueDate && new Date(t.dueDate + 'T00:00:00') < today && t.status !== 'done');
    if (overdueList.length > 0) {
      const afterPri = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38);
      doc.text(`Overdue Tasks (${overdueList.length})`, 14, afterPri);
      doc.setTextColor(17, 24, 39);

      autoTable(doc, {
        startY: afterPri + 4,
        head: [['Task ID', 'Title', 'Priority', 'Due Date', 'Assignee']],
        body: overdueList.map(t => [t.id, t.title, t.priority?.toUpperCase() || '-', t.dueDate, t.assigneeName || '-']),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
        margin: { left: 14, right: 14 },
      });
    }

    // ── Full task list (new page) ─────────────────────────────────────────────
    doc.addPage();
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, W, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Full Task List', 14, 12);
    doc.setTextColor(17, 24, 39);

    autoTable(doc, {
      startY: 22,
      head: [['Task ID', 'Title', 'Category', 'Priority', 'Status', 'Reporter', 'Assignee', 'Due Date']],
      body: tasks.map(t => [
        t.id,
        t.title.length > 30 ? t.title.substring(0, 28) + '…' : t.title,
        categoryMeta(t.category).label || '-',
        t.priority?.toUpperCase() || '-',
        (t.status || '-').replace('-', ' ').toUpperCase(),
        t.reporterName || '-',
        t.assigneeName || '-',
        t.dueDate || '-',
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 42 },
        2: { cellWidth: 28 },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 18, halign: 'center' },
      },
      margin: { left: 7, right: 7 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const p = (data.cell.raw || '').toLowerCase();
          if (priColors[p]) data.cell.styles.textColor = priColors[p];
        }
        if (data.section === 'body' && data.column.index === 4) {
          const s = data.cell.raw || '';
          if (s === 'DONE') data.cell.styles.textColor = [16, 185, 129];
          if (s === 'IN PROGRESS') data.cell.styles.textColor = [59, 130, 246];
        }
      },
    });

    // ── Footer on each page ───────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.setFont('helvetica', 'normal');
      doc.text(`Athens EC Tasks Dashboard  |  Confidential  |  Page ${i} of ${pageCount}`, W / 2, 290, { align: 'center' });
    }

    doc.save(`AthensEC_Report_${now.toISOString().split('T')[0]}.pdf`);
    const l = addLog('EXPORTED', '', 'PDF report generated');
    saveLogs(l);
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const isSubcommittee = user?.communityRole === 'Sub-committee Member';
  const statTasks = isSubcommittee ? tasks.filter(t => t.taskRole === 'Sub-committee Member') : tasks;

  const stats = {
    total:   statTasks.length,
    overdue: statTasks.filter(t => t.dueDate && new Date(t.dueDate + 'T00:00:00') < new Date().setHours(0,0,0,0) && t.status !== 'done').length,
    done:    statTasks.filter(t => t.status === 'done').length,
    assigned: statTasks.filter(t => t.assigneeEmail).length,
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const sc = { ready: { bg: '#d1fae5', color: '#10b981' }, syncing: { bg: '#fef3c7', color: '#f59e0b' }, loading: { bg: '#dbeafe', color: '#3b82f6' }, error: { bg: '#fee2e2', color: '#ef4444' } }[status] || { bg: '#d1fae5', color: '#10b981' };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1e3a5f 0%,#0f2342 100%)', padding: '1.5rem', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: '1.25rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#111827' }}>{isSubcommittee ? 'Sub-committee Tasks' : 'Athens EC Tasks Dashboard'}</h1>
              <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>{isSubcommittee ? 'Sub-committee Task Management' : 'Executive Committee Task Management'}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ padding: '6px 12px', background: '#eff6ff', color: '#1d4ed8', borderRadius: 50, fontWeight: 600, fontSize: '0.85rem', display: 'flex', gap: 6, alignItems: 'center' }}>
                <User size={14} />{user.name}
                {user.role === 'admin' && <span style={{ background: '#fbbf24', color: '#92400e', fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>ADMIN</span>}
              </div>
              {!isSubcommittee && <div style={{ padding: '6px 12px', background: sc.bg, color: sc.color, borderRadius: 8, fontWeight: 600, fontSize: '0.82rem', display: 'flex', gap: 4, alignItems: 'center' }}><Database size={13} />{status}</div>}
              {!isSubcommittee && <button onClick={() => setLogModal(true)} style={{ padding: '6px 12px', background: 'white', color: '#3b82f6', border: '2px solid #3b82f6', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.83rem' }}><Activity size={14} />Log</button>}
              {user.role === 'admin' && <button onClick={() => setUsersModal(true)} style={{ padding: '6px 12px', background: 'white', color: '#7c3aed', border: '2px solid #7c3aed', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.83rem' }}><User size={14} />Users</button>}
              {user.role === 'admin' && (
                <button onClick={toggleOverdueAlerts} title={overdueAlertsEnabled ? 'Overdue mail alerts ON — click to disable' : 'Overdue mail alerts OFF — click to enable'}
                  style={{ padding: '6px 12px', background: overdueAlertsEnabled ? '#fef3c7' : 'white', color: overdueAlertsEnabled ? '#b45309' : '#9ca3af', border: `2px solid ${overdueAlertsEnabled ? '#fcd34d' : '#d1d5db'}`, borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.83rem' }}>
                  {overdueAlertsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                  {overdueAlertsEnabled ? 'Alerts ON' : 'Alerts OFF'}
                </button>
              )}
              {!isSubcommittee && <button onClick={() => loadData(false)} style={{ padding: '6px 12px', background: 'white', color: '#3b82f6', border: '2px solid #3b82f6', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.83rem' }}><RefreshCw size={14} />Refresh</button>}
              {!isSubcommittee && <button onClick={exportXLSX} style={{ padding: '6px 12px', background: 'white', color: '#3b82f6', border: '2px solid #3b82f6', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.83rem' }}><Download size={14} />Export</button>}
              {user.role === 'admin' && <button onClick={generateReport} style={{ padding: '6px 12px', background: 'linear-gradient(135deg,#1e3a5f,#0f2342)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.83rem' }}><FileText size={14} />Report</button>}
              <button onClick={() => openNew()} style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.83rem' }}><Plus size={14} />New Task</button>
              {user.role === 'admin' && <button onClick={clearAll} style={{ padding: '6px 12px', background: 'white', color: '#ef4444', border: '2px solid #ef4444', borderRadius: 8, fontWeight: 600, cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center', fontSize: '0.83rem' }}><Trash2 size={14} />Clear</button>}
              <button onClick={logout} style={{ padding: '6px 12px', background: '#6b7280', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.83rem' }}>Logout</button>
            </div>
          </div>

          {/* ── Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 12, paddingTop: '1rem', borderTop: '2px solid #f3f4f6' }}>
            {[
              { label: 'Total',    value: stats.total,    color: '#3b82f6' },
              { label: 'Overdue',  value: stats.overdue,  color: '#ef4444', icon: stats.overdue > 0 ? <AlertTriangle size={14} /> : null },
              { label: 'Done',     value: stats.done,     color: '#10b981' },
              { label: 'Assigned', value: stats.assigned, color: '#7c3aed' },
            ].map(s => (
              <div key={s.label} style={{ padding: '0.875rem 1rem', background: '#f9fafb', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{s.value}{s.icon}</div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filter Bar ── */}
        {(() => {
          const visibleTasks = isSubcommittee ? tasks.filter(t => t.taskRole === 'Sub-committee Member') : tasks;
          const availableCategories = isSubcommittee
            ? CATEGORIES.filter(c => c.value && visibleTasks.some(t => t.category === c.value))
            : CATEGORIES.filter(c => c.value);
          const assignees = [...new Set(visibleTasks.map(t => t.assigneeName).filter(Boolean))].sort();
          const activeCount = Object.values(filters).filter(Boolean).length;
          const selStyle = { padding: '7px 10px', border: '2px solid #e5e7eb', borderRadius: 8, fontSize: '0.82rem', background: 'white', outline: 'none', cursor: 'pointer', color: '#374151' };
          return (
            <div style={{ background: 'white', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Filter size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
              <div style={{ position: 'relative', flex: '1 1 180px' }}>
                <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                <input
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                  placeholder="Search tasks…"
                  style={{ ...selStyle, width: '100%', paddingLeft: 28, boxSizing: 'border-box' }}
                />
              </div>
              <select style={{ ...selStyle, flex: '1 1 140px' }} value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
                <option value="">All Categories</option>
                {availableCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <select style={{ ...selStyle, flex: '1 1 120px' }} value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}>
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              {!isSubcommittee && (
                <select style={{ ...selStyle, flex: '1 1 140px' }} value={filters.assignee} onChange={e => setFilters(f => ({ ...f, assignee: e.target.value }))}>
                  <option value="">All Assignees</option>
                  {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {activeCount > 0 && (
                <button
                  onClick={() => setFilters({ search: '', category: '', priority: '', assignee: '' })}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: '#fef2f2', color: '#ef4444', border: '2px solid #fecaca', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', flexShrink: 0 }}
                >
                  <XCircle size={14} /> Clear ({activeCount})
                </button>
              )}
            </div>
          );
        })()}

        {/* ── Kanban Board ── */}
        {(() => {
          const scIndexMap = isSubcommittee
            ? Object.fromEntries(
                [...tasks]
                  .filter(t => t.taskRole === 'Sub-committee Member')
                  .sort((a, b) => a.id.localeCompare(b.id))
                  .map((t, i) => [t.id, i + 1])
              )
            : null;
          return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px,1fr))', gap: '1.25rem' }}>
          {COLS.map(col => {
            const visibleTasks = user.communityRole === 'Sub-committee Member'
              ? tasks.filter(t => t.taskRole === 'Sub-committee Member')
              : tasks;
            const allColTasks = visibleTasks.filter(t => t.status === col.id);
            const colTasks = allColTasks.filter(t => {
              if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase()) && !(t.description || '').toLowerCase().includes(filters.search.toLowerCase()) && !t.id.toLowerCase().includes(filters.search.toLowerCase())) return false;
              if (filters.category && t.category !== filters.category) return false;
              if (filters.priority && t.priority !== filters.priority) return false;
              if (filters.assignee && t.assigneeName !== filters.assignee) return false;
              return true;
            });
            const ColIcon = col.Icon;
            return (
              <div key={col.id} style={{ background: 'white', borderRadius: 16, padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.875rem', borderBottom: '2px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <ColIcon size={20} style={{ color: '#3b82f6' }} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{col.label}</span>
                  </div>
                  <span style={{ background: '#3b82f6', color: 'white', padding: '2px 10px', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem' }}>
                    {colTasks.length}{colTasks.length !== allColTasks.length ? `/${allColTasks.length}` : ''}
                  </span>
                </div>
                <div style={{ minHeight: 120 }}>
                  {colTasks.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#d1d5db', padding: '2rem 0', fontSize: '0.85rem' }}>
                      {allColTasks.length > 0 ? '🔍 No tasks match filters' : 'No tasks here'}
                    </div>
                  )}
                  {colTasks.map(task => (
                    <TaskCard key={task.id} task={task} user={user} onEdit={openEdit} onDelete={deleteTask} onMove={moveTask} onAddComment={addComment} onAlert={sendAlert} members={members} scIndex={scIndexMap?.[task.id]} />
                  ))}
                </div>
                <button onClick={() => openNew(col.id)} style={{ width: '100%', padding: '8px', border: '2px dashed #d1d5db', background: 'transparent', borderRadius: 8, color: '#9ca3af', fontWeight: 600, cursor: 'pointer', fontSize: '0.83rem', marginTop: 4 }}>
                  + Add to {col.label}
                </button>
              </div>
            );
          })}
        </div>
          );
        })()}
      </div>

      {modal && <TaskModal form={form} setForm={setForm} onSave={saveTask} onClose={() => setModal(false)} isEdit={!!edit} members={members} user={user} />}
      {logModal && <LogModal logs={logs} onClose={() => setLogModal(false)} />}
      {usersModal && <UsersModal members={members} currentUser={user} onClose={() => setUsersModal(false)} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '14px 20px', borderRadius: 10, background: toast.type === 'success' ? '#064e3b' : '#7f1d1d', color: 'white', fontWeight: 600, fontSize: '0.9rem', boxShadow: '0 4px 20px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 380 }}>
          {toast.msg}
          <button onClick={() => setToast(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
        </div>
      )}
    </div>
  );
}
