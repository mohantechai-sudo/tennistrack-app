// ─────────────────────────────────────────────────────────────────────────────
// config.js  –  Fill in your real credentials before running
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  SESSION_SECRET: 'tennis-secret-2024-change-me',
  PORT: process.env.PORT || 3000,

  // ── Email (SMTP) ──────────────────────────────────────────────────────────
  // Works with Gmail (use an App Password), Outlook, SendGrid, etc.
  EMAIL: {
    enabled: true,                          // set false to disable email
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'your_email@gmail.com',           // ← YOUR email
    pass: 'your_app_password',              // ← Gmail App Password (not login pw)
    from: '"TennisTrack 🎾" <your_email@gmail.com>',
  },

  // ── Twilio (SMS / WhatsApp) ───────────────────────────────────────────────
  // Sign up free at twilio.com — WhatsApp sandbox available instantly
  TWILIO: {
    enabled: true,                          // set false to disable SMS/WA
    accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',  // ← from twilio.com console
    authToken:  'your_auth_token',                    // ← from twilio.com console
    fromSms:    '+15017122661',             // ← your Twilio phone number
    fromWhatsApp: 'whatsapp:+14155238886', // ← Twilio WhatsApp sandbox number
  },
};
