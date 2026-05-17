// api/notify.js — Athens Community Facility Tracker
// Cron: runs daily at 08:00 UTC for all overdue tasks.
// Manual: GET /api/notify?taskId=X  sends immediately to that task's assignedEmail (bypasses dedup).
//
// Required env var: RESEND_API_KEY (from resend.com — free tier 3 000 emails/month)
// Optional env var: NOTIFY_FROM_EMAIL  e.g. "Athens Tracker <alerts@yourdomain.com>"
import { get, set } from './_storage.js';

const FROM = process.env.NOTIFY_FROM_EMAIL || 'Athens Tracker <onboarding@resend.dev>';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const SEND_DELAY_MS = 500; // stay within Resend's 2 req/s rate limit

function commentsHtml(comments) {
  if (!Array.isArray(comments) || comments.length === 0) return '';
  const rows = comments.map(c => {
    const ts = c.timestamp ? new Date(c.timestamp).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
    return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:6px">
      <div style="font-size:11px;font-weight:700;color:#374151;margin-bottom:3px">${c.userName || c.user || 'User'}</div>
      <div style="font-size:13px;color:#4b5563;line-height:1.5">${c.text}</div>
      ${ts ? `<div style="font-size:11px;color:#9ca3af;margin-top:5px">${ts}</div>` : ''}
    </div>`;
  }).join('');
  return `<div style="margin-top:16px;padding-top:14px;border-top:1px solid #e5e7eb">
    <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">💬 Comments (${comments.length})</div>
    ${rows}
  </div>`;
}

function pdfBacklogEmailHtml(taskCount, customMessage) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px">
      <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px">Athens Community Facility Tracker</div>
      <h1 style="margin:0;color:white;font-size:22px;font-weight:700">&#128196; Backlog Report</h1>
    </div>
    <div style="padding:28px 32px">
      ${customMessage ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin-bottom:24px;color:#1e40af;font-size:14px;line-height:1.6">${customMessage}</div>` : ''}
      <p style="margin:0 0 16px;color:#374151;font-size:15px">Please find attached the backlog report for <strong>${taskCount} task${taskCount !== 1 ? 's' : ''}</strong> currently awaiting action.</p>
      <p style="margin:0 0 20px;color:#6b7280;font-size:13px">Open the attached PDF to view full task details including descriptions, priorities, categories, due dates, and photos.</p>
      <p style="margin:0;color:#6b7280;font-size:13px">Please log in to the Athens Community Facility Tracker to review and update these tasks.</p>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
      This notification was sent by an administrator of the Athens Community Facility Tracker.
    </div>
  </div>
</body>
</html>`;
}

function taskNotifyEmailHtml(task, cidRefs, customMessage, subject) {
  const priorityColor = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' }[task.priority] || '#6b7280';
  const categoryLabel = task.category ? task.category.charAt(0).toUpperCase() + task.category.slice(1).replace(/-/g, ' ') : '';
  const imageSection = cidRefs.length > 0 ? `
    <div style="margin-top:16px">
      <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">📷 Photos (${cidRefs.length})</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${cidRefs.map((cid, i) => `<img src="cid:${cid}" alt="Photo ${i + 1}" style="max-width:180px;max-height:180px;border-radius:8px;border:1px solid #e5e7eb;object-fit:cover" />`).join('')}
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px">
      <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px">Athens Community Facility Tracker</div>
      <h1 style="margin:0;color:white;font-size:22px;font-weight:700">📋 Backlog Task</h1>
    </div>
    <div style="padding:28px 32px">
      ${customMessage ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin-bottom:24px;color:#1e40af;font-size:14px;line-height:1.6">${customMessage}</div>` : ''}
      <div style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px">
        <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:8px">${task.title}</div>
        ${task.description ? `<div style="color:#6b7280;font-size:14px;margin-bottom:12px">${task.description}</div>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <span style="background:${priorityColor}22;color:${priorityColor};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${(task.priority || '').toUpperCase()}</span>
          ${categoryLabel ? `<span style="background:#ede9fe;color:#7c3aed;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${categoryLabel}</span>` : ''}
          <span style="background:#dbeafe;color:#3b82f6;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">Due: ${task.dueDate || '—'}</span>
          <span style="background:#f3f4f6;color:#374151;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">BACKLOG</span>
        </div>
        ${imageSection}
        ${commentsHtml(task.comments)}
      </div>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Please log in to the Athens Community Facility Tracker to review and update this task.</p>
      <div style="background:#fff7ed;border:2px solid #fb923c;border-radius:10px;padding:14px 18px;text-align:center">
        <strong style="color:#c2410c;font-size:14px">Please reply to <a href="mailto:athens-ec@caaoa.in?subject=Re%3A%20${encodeURIComponent(subject || '')}" style="color:#c2410c">athens-ec@caaoa.in</a> within 24 hours.</strong>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
      This notification was sent by an administrator of the Athens Community Facility Tracker.
    </div>
  </div>
</body>
</html>`;
}

function backlogEmailHtml(backlogTasks, customMessage) {
  const priorityColor = { low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
  const rows = backlogTasks.map(task => {
    const pc = priorityColor[task.priority] || '#6b7280';
    const cat = task.category ? task.category.charAt(0).toUpperCase() + task.category.slice(1).replace(/-/g, ' ') : '';
    return `
      <tr>
        <td style="padding:10px 14px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6">${task.title}${task.description ? `<div style="font-weight:400;color:#6b7280;font-size:12px;margin-top:2px">${task.description}</div>` : ''}${Array.isArray(task.comments) && task.comments.length > 0 ? `<div style="margin-top:6px;font-size:11px;color:#6b7280;font-weight:400">💬 ${task.comments.length} comment${task.comments.length > 1 ? 's' : ''}: ${task.comments.map(c => `<span style="color:#374151;font-weight:600">${c.userName||c.user}:</span> ${c.text}`).join(' · ')}</div>` : ''}</td>
        <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #f3f4f6"><span style="background:${pc}22;color:${pc};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap">${(task.priority||'').toUpperCase()}</span></td>
        <td style="padding:10px 14px;color:#7c3aed;font-size:12px;font-weight:600;border-bottom:1px solid #f3f4f6">${cat}</td>
        <td style="padding:10px 14px;color:#6b7280;font-size:12px;border-bottom:1px solid #f3f4f6;white-space:nowrap">${task.dueDate || '—'}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,sans-serif">
  <div style="max-width:640px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px">
      <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px">Athens Community Facility Tracker</div>
      <h1 style="margin:0;color:white;font-size:22px;font-weight:700">📋 Backlog Task Summary</h1>
    </div>
    <div style="padding:28px 32px">
      ${customMessage ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin-bottom:24px;color:#1e40af;font-size:14px;line-height:1.6">${customMessage}</div>` : ''}
      <p style="margin:0 0 16px;color:#374151;font-size:14px">The following <strong>${backlogTasks.length} task${backlogTasks.length !== 1 ? 's' : ''}</strong> are currently in the backlog and require attention:</p>
      <div style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb">Task</th>
              <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb">Priority</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb">Category</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb">Due Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p style="margin:20px 0 16px;color:#6b7280;font-size:13px">Please log in to the Athens Community Facility Tracker to review and update these tasks.</p>
      <div style="background:#fff7ed;border:2px solid #fb923c;border-radius:10px;padding:14px 18px;text-align:center">
        <strong style="color:#c2410c;font-size:14px">Please reply to <a href="mailto:athens-ec@caaoa.in" style="color:#c2410c">athens-ec@caaoa.in</a> within 24 hours.</strong>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
      This notification was sent by an administrator of the Athens Community Facility Tracker.
    </div>
  </div>
</body>
</html>`;
}

function emailHtml(task, subject) {
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
        ${commentsHtml(task.comments)}
      </div>
      <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Please log in to the Athens Community Facility Tracker to update or complete this task.</p>
      <div style="background:#fff7ed;border:2px solid #fb923c;border-radius:10px;padding:14px 18px;text-align:center">
        <strong style="color:#c2410c;font-size:14px">Please reply to <a href="mailto:athens-ec@caaoa.in?subject=Re%3A%20${encodeURIComponent(subject || '')}" style="color:#c2410c">athens-ec@caaoa.in</a> within 24 hours.</strong>
      </div>
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
    body: JSON.stringify({ from: FROM, to: task.assignedEmail, subject, html: emailHtml(task, subject) }),
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

  // ── Bulk backlog notify (POST) — one email per task per recipient ─────────────
  if (req.method === 'POST') {
    const { emails, cc: ccEmails, message, tasks: payloadTasks, pdfBase64, taskCount } = req.body || {};
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails array is required' });
    }

    // ── PDF attachment mode: send one email per recipient with the PDF attached ──
    if (pdfBase64) {
      const count = typeof taskCount === 'number' ? taskCount : 0;
      const subject = `[Athens Tracker] Backlog Report — ${count} task${count !== 1 ? 's' : ''}`;
      const html = pdfBacklogEmailHtml(count, message || '');
      const attachment = {
        filename: `Athens_Backlog_${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBase64,
        content_type: 'application/pdf',
      };
      let sent = 0;
      const results = [];
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: FROM, to: email, subject, html, attachments: [attachment] }),
          });
          if (r.ok) {
            sent++;
            results.push({ email, status: 'sent' });
          } else {
            const b = await r.json().catch(() => ({}));
            results.push({ email, status: 'failed', error: b.message || r.statusText });
          }
        } catch (err) {
          results.push({ email, status: 'error', error: err.message });
        }
        if (i < emails.length - 1) await sleep(SEND_DELAY_MS);
      }
      return res.status(200).json({ sent, total: emails.length, taskCount: count, recipientCount: emails.length, results });
    }

    if (!Array.isArray(payloadTasks) || payloadTasks.length === 0) {
      return res.status(400).json({ error: 'tasks array is required' });
    }
    // Fetch all task images from KV in parallel across all tasks at once
    const allTaskImages = await Promise.all(
      payloadTasks.map(task => Promise.all([
        get(`img:${task.id}:0`), get(`img:${task.id}:1`), get(`img:${task.id}:2`),
      ]))
    );

    let sent = 0;
    const results = [];
    for (let ti = 0; ti < payloadTasks.length; ti++) {
      const task = payloadTasks[ti];
      const taskImages = allTaskImages[ti].filter(img => img && img.dataUrl);

      // Build CID attachments — strip the data URL prefix to get raw base64
      const attachments = taskImages.map((img, i) => {
        const match = img.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        const content_type = match ? match[1] : 'image/jpeg';
        const content = match ? match[2] : img.dataUrl;
        const cid = `task${task.id}_photo${i}`;
        return { filename: img.name || `photo${i + 1}.jpg`, content, content_type, content_id: cid };
      });
      const cidRefs = attachments.map(a => a.content_id);

      const subject = `[Athens Tracker] Backlog: ${task.title}`;
      const html = taskNotifyEmailHtml(task, cidRefs, message || '', subject);

      // If cc is provided, send one email with to (array) + cc instead of looping per recipient
      if (Array.isArray(ccEmails) && ccEmails.length > 0) {
        try {
          const payload = { from: FROM, to: emails, cc: ccEmails, subject, html };
          if (attachments.length > 0) payload.attachments = attachments;
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (r.ok) {
            sent += emails.length + ccEmails.length;
            emails.forEach(e => results.push({ taskId: task.id, taskTitle: task.title, email: e, status: 'sent' }));
            ccEmails.forEach(cc => results.push({ taskId: task.id, taskTitle: task.title, email: cc, status: 'sent (cc)' }));
          } else {
            const b = await r.json().catch(() => ({}));
            emails.forEach(e => results.push({ taskId: task.id, taskTitle: task.title, email: e, status: 'failed', error: b.message || r.statusText }));
          }
        } catch (err) {
          emails.forEach(e => results.push({ taskId: task.id, taskTitle: task.title, email: e, status: 'error', error: err.message }));
        }
      } else {
        for (let ei = 0; ei < emails.length; ei++) {
          const email = emails[ei];
          try {
            const payload = { from: FROM, to: email, subject, html };
            if (attachments.length > 0) payload.attachments = attachments;
            const r = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (r.ok) { sent++; results.push({ taskId: task.id, taskTitle: task.title, email, status: 'sent' }); }
            else { const b = await r.json().catch(() => ({})); results.push({ taskId: task.id, taskTitle: task.title, email, status: 'failed', error: b.message || r.statusText }); }
          } catch (err) {
            results.push({ taskId: task.id, taskTitle: task.title, email, status: 'error', error: err.message });
          }
          if (ei < emails.length - 1 || ti < payloadTasks.length - 1) await sleep(SEND_DELAY_MS);
        }
      }
    }
    return res.status(200).json({ sent, total: payloadTasks.length * emails.length, taskCount: payloadTasks.length, recipientCount: emails.length, results });
  }

  const tasks = (await get('tasks')) || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const getTaskEmails = (task) =>
    task.assignedEmails?.length > 0 ? task.assignedEmails : (task.assignedEmail ? [task.assignedEmail] : []);

  // ── Manual single-task send (/api/notify?taskId=X) ───────────────────────────
  const { taskId } = req.query || {};
  if (taskId) {
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const emails = getTaskEmails(task);
    if (emails.length === 0) return res.status(400).json({ error: 'Task has no assigned email' });
    if (task.status === 'done') return res.status(400).json({ error: 'Task is already done' });

    const results = [];
    let sent = 0;
    for (let i = 0; i < emails.length; i++) {
      try {
        const emailRes = await sendEmail(apiKey, { ...task, assignedEmail: emails[i] });
        if (emailRes.ok) { sent++; results.push({ email: emails[i], status: 'sent' }); }
        else { const b = await emailRes.json().catch(() => ({})); results.push({ email: emails[i], status: 'failed', error: b.message || emailRes.statusText }); }
      } catch (err) {
        results.push({ email: emails[i], status: 'error', error: err.message });
      }
      if (i < emails.length - 1) await sleep(SEND_DELAY_MS);
    }
    return res.status(200).json({ success: sent > 0, sent, total: emails.length, task: task.title, results });
  }

  // ── Daily cron: all overdue tasks ─────────────────────────────────────────────
  const overdue = tasks.filter(t => {
    if (t.status === 'done') return false;
    const emails = getTaskEmails(t);
    if (emails.length === 0) return false;
    const due = new Date(t.dueDate + 'T00:00:00');
    return due < today;
  });

  const results = [];
  for (const task of overdue) {
    const emails = getTaskEmails(task);
    for (let ei = 0; ei < emails.length; ei++) {
      const email = emails[ei];
      const notifKey = `notif:${task.id}:${email}:${todayStr}`;
      const alreadySent = await get(notifKey);
      if (alreadySent) {
        results.push({ taskId: task.id, email, status: 'already_sent' });
        continue;
      }
      try {
        const emailRes = await sendEmail(apiKey, { ...task, assignedEmail: email });
        if (emailRes.ok) {
          await set(notifKey, { sentAt: new Date().toISOString(), email });
          results.push({ taskId: task.id, email, status: 'sent' });
        } else {
          const body = await emailRes.json().catch(() => ({}));
          results.push({ taskId: task.id, email, status: 'failed', error: body.message || emailRes.statusText });
        }
      } catch (err) {
        results.push({ taskId: task.id, email, status: 'error', error: err.message });
      }
      if (ei < emails.length - 1) await sleep(SEND_DELAY_MS);
    }
  }

  return res.status(200).json({
    date: todayStr,
    overdueCount: overdue.length,
    sent: results.filter(r => r.status === 'sent').length,
    results,
  });
}
