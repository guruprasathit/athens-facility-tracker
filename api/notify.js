// api/notify.js — Athens EC Tasks Dashboard
//
// GET  /api/notify?action=assign&taskId=X  → assignment email to task.assigneeEmail (on task save)
// GET  /api/notify?taskId=X                → manual overdue reminder for a specific task
// GET  /api/notify                          → daily cron — overdue alerts for all assigned tasks
// POST /api/notify                          → bulk summary email to a list of addresses
//
// Required env var : RESEND_API_KEY  (resend.com — free tier 3,000 emails/month)
// Optional env var : NOTIFY_FROM_EMAIL  e.g. "Athens EC <alerts@yourdomain.com>"

import { get, set } from './_storage.js';

const FROM = process.env.NOTIFY_FROM_EMAIL || 'Athens EC Tasks <onboarding@resend.dev>';

// ── Email templates ────────────────────────────────────────────────────────────

function assignmentEmailHtml(task) {
  const pc = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' }[task.priority] || '#6b7280';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1e3a5f,#0f2342);padding:28px 32px">
      <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px">Athens EC Tasks Dashboard</div>
      <h1 style="margin:0;color:white;font-size:20px;font-weight:700">📋 You have been assigned a task</h1>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 20px;color:#374151;font-size:15px">Hi <strong>${task.assigneeName || 'there'}</strong>, a task has been assigned to you:</p>
      <div style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px">
        <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:8px">${task.title}</div>
        ${task.description ? `<div style="color:#6b7280;font-size:14px;margin-bottom:12px">${task.description}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
          <span style="background:${pc}22;color:${pc};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${(task.priority || '').toUpperCase()}</span>
          <span style="background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">Due: ${task.dueDate || '—'}</span>
        </div>
        ${task.reporterName ? `<div style="font-size:13px;color:#6b7280;margin-top:8px">Reported by: <strong>${task.reporterName}</strong></div>` : ''}
      </div>
      <p style="margin:0;color:#6b7280;font-size:13px">Please log in to the Athens EC Tasks Dashboard to start working on this task.</p>
    </div>
    <div style="background:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
      This is an automated notification from the Athens EC Tasks Dashboard.
    </div>
  </div>
</body>
</html>`;
}

function overdueEmailHtml(task) {
  const pc = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' }[task.priority] || '#6b7280';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(task.dueDate + 'T00:00:00');
  const diffDays = Math.ceil((today - due) / 86400000);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px 32px">
      <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px">Athens EC Tasks Dashboard</div>
      <h1 style="margin:0;color:white;font-size:20px;font-weight:700">⚠️ Overdue Task Alert</h1>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 20px;color:#374151;font-size:15px">Hi <strong>${task.assigneeName || 'there'}</strong>, the following task assigned to you is <strong style="color:#ef4444">${diffDays} day${diffDays === 1 ? '' : 's'} overdue</strong>:</p>
      <div style="background:#fef2f2;border:2px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:24px">
        <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:8px">${task.title}</div>
        ${task.description ? `<div style="color:#6b7280;font-size:14px;margin-bottom:12px">${task.description}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="background:${pc}22;color:${pc};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${(task.priority || '').toUpperCase()}</span>
          <span style="background:#fee2e2;color:#ef4444;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">Was due: ${task.dueDate}</span>
          <span style="background:#f3f4f6;color:#374151;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">Status: ${(task.status || '').replace('-', ' ').toUpperCase()}</span>
        </div>
      </div>
      <p style="margin:0;color:#6b7280;font-size:13px">Please log in to the Athens EC Tasks Dashboard and update or complete this task immediately.</p>
    </div>
    <div style="background:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
      This is an automated alert from the Athens EC Tasks Dashboard.
    </div>
  </div>
</body>
</html>`;
}

function summaryEmailHtml(tasks, message) {
  const pc = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
  const rows = tasks.map(t => `
    <tr>
      <td style="padding:10px 14px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6">${t.title}${t.description ? `<div style="font-weight:400;color:#6b7280;font-size:12px;margin-top:2px">${t.description}</div>` : ''}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #f3f4f6"><span style="background:${pc[t.priority] || '#6b7280'}22;color:${pc[t.priority] || '#6b7280'};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700">${(t.priority || '').toUpperCase()}</span></td>
      <td style="padding:10px 14px;color:#6b7280;font-size:12px;border-bottom:1px solid #f3f4f6">${t.assigneeName || '—'}</td>
      <td style="padding:10px 14px;color:#6b7280;font-size:12px;border-bottom:1px solid #f3f4f6;white-space:nowrap">${t.dueDate || '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif">
  <div style="max-width:640px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#1e3a5f,#0f2342);padding:28px 32px">
      <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px">Athens EC Tasks Dashboard</div>
      <h1 style="margin:0;color:white;font-size:20px;font-weight:700">📋 Task Summary</h1>
    </div>
    <div style="padding:28px 32px">
      ${message ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin-bottom:24px;color:#1e40af;font-size:14px">${message}</div>` : ''}
      <p style="margin:0 0 16px;color:#374151;font-size:14px">The following <strong>${tasks.length} task${tasks.length !== 1 ? 's' : ''}</strong> require attention:</p>
      <div style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb">Task</th>
              <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb">Priority</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb">Assignee</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb">Due Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    <div style="background:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
      Sent by the Athens EC Tasks Dashboard.
    </div>
  </div>
</body>
</html>`;
}

// ── Resend helper ──────────────────────────────────────────────────────────────

async function sendEmail(apiKey, to, subject, html) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

  const tasks = (await get('tasks')) || [];
  const { action, taskId } = req.query || {};

  // ── 1. Assignment email (/api/notify?action=assign&taskId=X[&email=X]) ─────────
  if (action === 'assign' && taskId) {
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Collect all emails to notify — specific email param, or all assigneeEmails, or fallback to assigneeEmail
    const specificEmail = req.query.email;
    const allEmails = specificEmail
      ? [specificEmail]
      : (task.assigneeEmails?.length > 0 ? task.assigneeEmails : (task.assigneeEmail ? [task.assigneeEmail] : []));

    if (allEmails.length === 0) return res.status(400).json({ error: 'Task has no assignee email' });

    try {
      const subject = `[Athens EC Tasks] Task Assigned: ${task.title}`;
      const results = await Promise.all(allEmails.map(email => sendEmail(apiKey, email, subject, assignmentEmailHtml({ ...task, assigneeName: task.assigneeName || email }))));
      const sent = allEmails.filter((_, i) => results[i].ok);
      if (sent.length > 0) return res.status(200).json({ success: true, emails: sent });
      return res.status(502).json({ error: 'Failed to send assignment emails' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── 2. Manual overdue send for single task (/api/notify?taskId=X) ────────────
  if (taskId) {
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!task.assigneeEmail) return res.status(400).json({ error: 'Task has no assignee email' });
    if (task.status === 'done') return res.status(400).json({ error: 'Task is already done' });

    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const due = new Date(task.dueDate + 'T00:00:00');
      const diffDays = Math.ceil((today - due) / 86400000);
      const subject = diffDays > 0
        ? `[Overdue ${diffDays}d] ${task.title} — Athens EC Tasks`
        : `[Reminder] ${task.title} — Athens EC Tasks`;
      const r = await sendEmail(apiKey, task.assigneeEmail, subject, overdueEmailHtml(task));
      if (r.ok) return res.status(200).json({ success: true, email: task.assigneeEmail });
      const body = await r.json().catch(() => ({}));
      return res.status(502).json({ error: body.message || 'Failed to send email' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── 3. Bulk summary email (POST /api/notify) ──────────────────────────────────
  if (req.method === 'POST') {
    const { emails = [], message } = req.body || {};
    if (!Array.isArray(emails) || emails.length === 0) return res.status(400).json({ error: 'emails array is required' });
    const pendingTasks = tasks.filter(t => t.status !== 'done');
    if (pendingTasks.length === 0) return res.status(400).json({ error: 'No pending tasks to notify about' });

    const html = summaryEmailHtml(pendingTasks, message || '');
    const subject = `[Athens EC Tasks] Summary — ${pendingTasks.length} task${pendingTasks.length !== 1 ? 's' : ''} pending`;
    let sent = 0;
    const results = [];
    for (const email of emails) {
      try {
        const r = await sendEmail(apiKey, email, subject, html);
        if (r.ok) { sent++; results.push({ email, status: 'sent' }); }
        else { const b = await r.json().catch(() => ({})); results.push({ email, status: 'failed', error: b.message || r.statusText }); }
      } catch (err) { results.push({ email, status: 'error', error: err.message }); }
    }
    return res.status(200).json({ sent, total: emails.length, results });
  }

  // ── 4. Daily cron — overdue alerts (GET /api/notify) ─────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const overdue = tasks.filter(t => {
    if (!t.assigneeEmail || t.status === 'done' || !t.dueDate) return false;
    return new Date(t.dueDate + 'T00:00:00') < today;
  });

  const results = [];
  for (const task of overdue) {
    const notifKey = `notif:${task.id}:${todayStr}`;
    const alreadySent = await get(notifKey);
    if (alreadySent) { results.push({ taskId: task.id, email: task.assigneeEmail, status: 'already_sent' }); continue; }

    try {
      const due = new Date(task.dueDate + 'T00:00:00');
      const diffDays = Math.ceil((today - due) / 86400000);
      const subject = `[Overdue ${diffDays}d] ${task.title} — Athens EC Tasks`;
      const r = await sendEmail(apiKey, task.assigneeEmail, subject, overdueEmailHtml(task));
      if (r.ok) {
        await set(notifKey, { sentAt: new Date().toISOString(), email: task.assigneeEmail });
        results.push({ taskId: task.id, email: task.assigneeEmail, status: 'sent' });
      } else {
        const body = await r.json().catch(() => ({}));
        results.push({ taskId: task.id, email: task.assigneeEmail, status: 'failed', error: body.message });
      }
    } catch (err) {
      results.push({ taskId: task.id, email: task.assigneeEmail, status: 'error', error: err.message });
    }
  }

  return res.status(200).json({ date: todayStr, overdueCount: overdue.length, sent: results.filter(r => r.status === 'sent').length, results });
}
