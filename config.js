module.exports = {
  SESSION_SECRET: process.env.SESSION_SECRET || "tennis-secret-2024-change-me",
  PORT: process.env.PORT || 3000,

  EMAIL: {
    enabled: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    host: process.env.EMAIL_HOST || "smtp.office365.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // STARTTLS on port 587
    user: process.env.EMAIL_USER || "noreply@sporttrackr.com",
    pass: process.env.EMAIL_PASS || "pzgsvbptkydqymsf",
    from: process.env.EMAIL_FROM || `TennisTrack <${process.env.EMAIL_USER}>`,
  },

  TWILIO: {
    enabled: process.env.TWILIO_SID ? true : false,
    accountSid: process.env.TWILIO_SID || "",
    authToken: process.env.TWILIO_TOKEN || "",
    fromSms: process.env.TWILIO_FROM_SMS || "",
    fromWhatsApp: process.env.TWILIO_FROM_WHATSAPP || "whatsapp:+14155238886",
  },
};
