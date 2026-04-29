// notifications.js  –  Email · SMS · WhatsApp helper
const nodemailer = require('nodemailer');
const cfg = require('./config');

// ── Email ─────────────────────────────────────────────────────────────────
let transporter = null;
if (cfg.EMAIL.enabled) {
  transporter = nodemailer.createTransport({
    host: cfg.EMAIL.host,
    port: cfg.EMAIL.port,
    secure: cfg.EMAIL.secure,
    auth: { user: cfg.EMAIL.user, pass: cfg.EMAIL.pass },
  });
}

async function sendEmail({ to, subject, html }) {
  if (!transporter) return { ok: false, reason: 'Email disabled' };
  try {
    await transporter.sendMail({ from: cfg.EMAIL.from, to, subject, html });
    return { ok: true };
  } catch (e) {
    console.error('[Email]', e.message);
    return { ok: false, reason: e.message };
  }
}

// ── Twilio (SMS + WhatsApp) ───────────────────────────────────────────────
let twilioClient = null;
if (cfg.TWILIO.enabled) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(cfg.TWILIO.accountSid, cfg.TWILIO.authToken);
  } catch (e) { console.warn('[Twilio] not loaded:', e.message); }
}

async function sendSMS({ to, body }) {
  if (!twilioClient) return { ok: false, reason: 'SMS disabled' };
  try {
    await twilioClient.messages.create({ from: cfg.TWILIO.fromSms, to, body });
    return { ok: true };
  } catch (e) {
    console.error('[SMS]', e.message);
    return { ok: false, reason: e.message };
  }
}

async function sendWhatsApp({ to, body }) {
  if (!twilioClient) return { ok: false, reason: 'WhatsApp disabled' };
  // "to" should be like "+1234567890" — we prefix whatsapp:
  const waTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  try {
    await twilioClient.messages.create({ from: cfg.TWILIO.fromWhatsApp, to: waTo, body });
    return { ok: true };
  } catch (e) {
    console.error('[WhatsApp]', e.message);
    return { ok: false, reason: e.message };
  }
}

// ── High-level notification helpers ──────────────────────────────────────
async function notifyMatchScheduled({ player, opponent, scheduledAt, venue, matchId }) {
  const dateStr = new Date(scheduledAt).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const msg = `🎾 Match scheduled!\n${player.full_name||player.username} vs ${opponent.full_name||opponent.username}\n📅 ${dateStr}${venue ? '\n📍 '+venue : ''}\n\nGood luck!`;

  const emailHtml = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#14532d;padding:24px;text-align:center;">
        <div style="font-size:32px;">🎾</div>
        <h1 style="color:#86efac;margin:8px 0 0;font-size:20px;">Match Scheduled!</h1>
      </div>
      <div style="padding:24px;">
        <p style="font-size:16px;color:#1f2937;"><strong>${player.full_name||player.username}</strong> vs <strong>${opponent.full_name||opponent.username}</strong></p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">📅 Date &amp; Time</td><td style="padding:8px 0;font-size:13px;font-weight:600;">${dateStr}</td></tr>
          ${venue ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">📍 Venue</td><td style="padding:8px 0;font-size:13px;font-weight:600;">${venue}</td></tr>` : ''}
        </table>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-top:20px;text-align:center;">
          <p style="color:#166534;font-size:14px;margin:0;">Good luck in your match! 🏆</p>
        </div>
      </div>
    </div>`;

  const results = [];
  if (player.email) results.push(await sendEmail({ to: player.email, subject: `Match Scheduled: vs ${opponent.username}`, html: emailHtml }));
  if (player.phone) {
    results.push(await sendSMS({ to: player.phone, body: msg }));
    if (player.whatsapp_enabled) results.push(await sendWhatsApp({ to: player.phone, body: msg }));
  }
  if (opponent.email) results.push(await sendEmail({ to: opponent.email, subject: `Match Scheduled: vs ${player.username}`, html: emailHtml }));
  if (opponent.phone) {
    results.push(await sendSMS({ to: opponent.phone, body: msg }));
    if (opponent.whatsapp_enabled) results.push(await sendWhatsApp({ to: opponent.phone, body: msg }));
  }
  return results;
}

async function notifyMatchReminder({ player, opponent, scheduledAt, venue }) {
  const dateStr = new Date(scheduledAt).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', weekday: 'long' });
  const msg = `⏰ Reminder: Your match vs ${opponent.full_name||opponent.username} is in 1 hour!\n📅 ${dateStr}${venue ? '\n📍 '+venue : ''}\nGet ready! 🎾`;
  const emailHtml = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#92400e;padding:24px;text-align:center;">
        <div style="font-size:32px;">⏰</div>
        <h1 style="color:#fef3c7;margin:8px 0 0;font-size:20px;">Match Reminder — 1 Hour!</h1>
      </div>
      <div style="padding:24px;">
        <p style="font-size:16px;color:#1f2937;">Your match vs <strong>${opponent.full_name||opponent.username}</strong> starts in <strong>1 hour</strong>.</p>
        <p style="color:#6b7280;font-size:13px;">📅 ${dateStr}${venue ? ' &nbsp;|&nbsp; 📍 '+venue : ''}</p>
      </div>
    </div>`;
  const results = [];
  if (player.email) results.push(await sendEmail({ to: player.email, subject: `⏰ Match in 1 hour: vs ${opponent.username}`, html: emailHtml }));
  if (player.phone) {
    results.push(await sendSMS({ to: player.phone, body: msg }));
    if (player.whatsapp_enabled) results.push(await sendWhatsApp({ to: player.phone, body: msg }));
  }
  return results;
}

async function notifyMatchCancelled({ player, opponent, scheduledAt }) {
  const dateStr = new Date(scheduledAt).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const msg = `❌ Match cancelled\nYour match vs ${opponent.full_name||opponent.username} on ${dateStr} has been cancelled.`;
  const emailHtml = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #fecaca;border-radius:12px;overflow:hidden;">
      <div style="background:#991b1b;padding:24px;text-align:center;">
        <div style="font-size:32px;">❌</div>
        <h1 style="color:#fff;margin:8px 0 0;font-size:20px;">Match Cancelled</h1>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;color:#1f2937;">Your match vs <strong>${opponent.full_name||opponent.username}</strong> scheduled for <strong>${dateStr}</strong> has been cancelled.</p>
      </div>
    </div>`;
  const results = [];
  if (player.email) results.push(await sendEmail({ to: player.email, subject: `Match Cancelled: vs ${opponent.username}`, html: emailHtml }));
  if (player.phone) {
    results.push(await sendSMS({ to: player.phone, body: msg }));
    if (player.whatsapp_enabled) results.push(await sendWhatsApp({ to: player.phone, body: msg }));
  }
  return results;
}

async function sendPasswordResetEmail({ to, username, resetUrl }) {
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#14532d;padding:24px;text-align:center;">
        <div style="font-size:32px;">🎾</div>
        <h1 style="color:#86efac;margin:8px 0 0;font-size:20px;">Password Reset</h1>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;color:#1f2937;">Hi <strong>${username}</strong>,</p>
        <p style="font-size:14px;color:#374151;">We received a request to reset your TennisTrack password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${resetUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">Reset Password</a>
        </div>
        <p style="font-size:12px;color:#9ca3af;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
        <p style="font-size:12px;color:#9ca3af;word-break:break-all;">Or copy this link: ${resetUrl}</p>
      </div>
    </div>`;
  return sendEmail({ to, subject: 'Reset your TennisTrack password', html });
}

async function sendClubInviteEmail({ to, clubName, inviterName, inviteUrl }) {
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#14532d;padding:24px;text-align:center;">
        <div style="font-size:32px;">🏢</div>
        <h1 style="color:#86efac;margin:8px 0 0;font-size:20px;">You're invited to join a club!</h1>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;color:#1f2937;"><strong>@${inviterName}</strong> has invited you to join <strong>${clubName}</strong> on TennisTrack.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${inviteUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">Accept Invite</a>
        </div>
        <p style="font-size:12px;color:#9ca3af;">This invite expires in 48 hours. If you did not expect this email, you can ignore it.</p>
        <p style="font-size:12px;color:#9ca3af;word-break:break-all;">Or copy: ${inviteUrl}</p>
      </div>
    </div>`;
  return sendEmail({ to, subject: `You're invited to join ${clubName} on TennisTrack`, html });
}

async function sendLeagueInviteEmail({ to, leagueName, inviterName, inviteUrl }) {
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#1d4ed8;padding:24px;text-align:center;">
        <div style="font-size:32px;">🏅</div>
        <h1 style="color:#bfdbfe;margin:8px 0 0;font-size:20px;">You're invited to a league!</h1>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;color:#1f2937;"><strong>@${inviterName}</strong> has invited you to join <strong>${leagueName}</strong> on TennisTrack.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${inviteUrl}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">Accept Invite &amp; Join League</a>
        </div>
        <p style="font-size:12px;color:#9ca3af;">This invite expires in 48 hours. If you did not expect this email, you can ignore it.</p>
        <p style="font-size:12px;color:#9ca3af;word-break:break-all;">Or copy: ${inviteUrl}</p>
      </div>
    </div>`;
  return sendEmail({ to, subject: `You're invited to join ${leagueName} on TennisTrack`, html });
}

async function sendPlayerWelcomeEmail({ to, fullName, username, tempPassword, leagueName, loginUrl }) {
  const html = `
    <div style="font-family:sans-serif;max-width:500px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#14532d;padding:24px;text-align:center;">
        <div style="font-size:32px;">🎾</div>
        <h1 style="color:#86efac;margin:8px 0 0;font-size:20px;">Welcome to TennisTrack!</h1>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;color:#1f2937;">Hi <strong>${fullName}</strong>,</p>
        <p style="font-size:14px;color:#374151;">You've been added to <strong>${leagueName}</strong> on TennisTrack. Your account has been created — use the details below to sign in.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:4px 0;color:#6b7280;">Username</td><td style="padding:4px 0;font-weight:700;color:#1f2937;">${username}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280;">Password</td><td style="padding:4px 0;font-weight:700;color:#1f2937;font-family:monospace;">${tempPassword}</td></tr>
          </table>
        </div>
        <p style="font-size:13px;color:#6b7280;">Please change your password after signing in for the first time.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${loginUrl}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">Sign In to TennisTrack</a>
        </div>
      </div>
    </div>`;
  return sendEmail({ to, subject: `Your TennisTrack account for ${leagueName}`, html });
}

module.exports = { sendEmail, sendSMS, sendWhatsApp, notifyMatchScheduled, notifyMatchReminder, notifyMatchCancelled, sendPasswordResetEmail, sendClubInviteEmail, sendLeagueInviteEmail, sendPlayerWelcomeEmail };
