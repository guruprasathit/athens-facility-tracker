// api/notify.js — Athens Community Facility Tracker
// Cron: runs daily at 08:00 UTC for all overdue tasks.
// Manual: GET /api/notify?taskId=X  sends immediately to that task's assignedEmail (bypasses dedup).
//
// Required env var: RESEND_API_KEY (from resend.com — free tier 3 000 emails/month)
// Optional env var: NOTIFY_FROM_EMAIL  e.g. "Athens Tracker <alerts@yourdomain.com>"
import { get, set } from './_storage.js';

const FROM = process.env.NOTIFY_FROM_EMAIL || 'Athens Tracker <onboarding@resend.dev>';

function emailHtml(task, label) {
  const priorityColor = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' }[task.priority] || '#6b7280';
  const categoryLabel = task.category ? task.category.charAt(0).toUpperCase() + task.category.slice(1).replace(/-/g, ' ') : '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate + 'T00:00:00');
  const diffDays = Math.ceil((today - due) / 86400000);
  const isOverdue = diffDays > 0 && task.status !== 'done';
  const headerText = isOverdue ? `⚠️ Task Overdue Alert` : `📋 Task Reminder`;
  const bodyText = isOverdue
    ? `The following task assigned to you is <strong style="color:#ef4444">${diffDays} day${diffDays === 1 ? '' : 's'} overdue</strong> and still open:`
    : `This is a reminder about the following task assigned to you:`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px">
      <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px">Athens Community Facility Tracker</div>
      <h1 style="margin:0;color:white;font-size:22px;font-weight:700">${headerText}</h1>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 20px;color:#374151;font-size:15px">${bodyText}</p>
      <div style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px">
        <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:8px">${task.title}</div>
        ${task.description ? `<div style="color:#6b7280;font-size:14px;margin-bottom:12px">${task.description}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <span style="background:${priorityColor}22;color:${priorityColor};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${(task.priority || '').toUpperCase()}</span>
          ${categoryLabel ? `<span style="background:#ede9fe;color:#7c3aed;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${categoryLabel}</span>` : ''}
          <span style="background:${isOverdue ? '#fee2e2' : '#dbeafe'};color:${isOverdue ? '#ef4444' : '#3b82f6'};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">Due: ${task.dueDate}</span>
          <span style="background:#f3f4f6;color:#374151;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">Status: ${(task.status || '').replace('-', ' ').toUpperCase()}</span>
        </div>
      </div>
      <p style="margin:0;color:#6b7280;font-size:13px">Please log in to the Athens Community Facility Tracker to update or complete this task.</p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
      This is an automated alert from the Athens Community Facility Tracker.
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(apiKey, task) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate + 'T00:00:00');
  const diffDays = Math.ceil((today - due) / 86400000);
  const isOverdue = diffDays > 0 && task.status !== 'done';
  const subject = isOverdue
    ? `[Overdue ${diffDays}d] ${task.title} — Athens Community Facility Tracker`
    : `[Reminder] ${task.title} — Athens Community Facility Tracker`;

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: task.assignedEmail, subject, html: emailHtml(task) }),
  });
  return emailRes;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY environment variable is not set' });
  }

  const tasks = (await get('tasks')) || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // ── Manual single-task send (/api/notify?taskId=X) ───────────────────────────
  const { taskId } = req.query || {};
  if (taskId) {
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!task.assignedEmail) return res.status(400).json({ error: 'Task has no assigned email' });
    if (task.status === 'done') return res.status(400).json({ error: 'Task is already done' });

    try {
      const emailRes = await sendEmail(apiKey, task);
      if (emailRes.ok) {
        return res.status(200).json({ success: true, email: task.assignedEmail, task: task.title });
      }
      const body = await emailRes.json().catch(() => ({}));
      return res.status(502).json({ error: body.message || 'Failed to send email' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Daily cron: all overdue tasks ─────────────────────────────────────────────
  const overdue = tasks.filter(t => {
    if (!t.assignedEmail || t.status === 'done') return false;
    const due = new Date(t.dueDate + 'T00:00:00');
    return due < today;
  });

  const results = [];
  for (const task of overdue) {
    const notifKey = `notif:${task.id}:${todayStr}`;
    const alreadySent = await get(notifKey);
    if (alreadySent) {
      results.push({ taskId: task.id, email: task.assignedEmail, status: 'already_sent' });
      continue;
    }
    try {
      const emailRes = await sendEmail(apiKey, task);
      if (emailRes.ok) {
        await set(notifKey, { sentAt: new Date().toISOString(), email: task.assignedEmail });
        results.push({ taskId: task.id, email: task.assignedEmail, status: 'sent' });
      } else {
        const body = await emailRes.json().catch(() => ({}));
        results.push({ taskId: task.id, email: task.assignedEmail, status: 'failed', error: body.message || emailRes.statusText });
      }
    } catch (err) {
      results.push({ taskId: task.id, email: task.assignedEmail, status: 'error', error: err.message });
    }
  }

  return res.status(200).json({
    date: todayStr,
    overdueCount: overdue.length,
    sent: results.filter(r => r.status === 'sent').length,
    results,
  });
}
