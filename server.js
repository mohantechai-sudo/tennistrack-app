require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cron = require('node-cron');
const notify = require('./notifications');
const cfg = require('./config');

const app = express();
const db = new sqlite3.Database(path.join(__dirname, 'tennis.db'));

const run = (sql, p=[]) => new Promise((res,rej) => db.run(sql,p,function(e){e?rej(e):res(this)}));
const get = (sql, p=[]) => new Promise((res,rej) => db.get(sql,p,(e,r)=>e?rej(e):res(r)));
const all = (sql, p=[]) => new Promise((res,rej) => db.all(sql,p,(e,r)=>e?rej(e):res(r)));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, full_name TEXT, phone TEXT,
    whatsapp_enabled INTEGER DEFAULT 0, is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER NOT NULL, player2_id INTEGER NOT NULL,
    winner_id INTEGER, score TEXT NOT NULL,
    format TEXT DEFAULT 'best_of_3', surface TEXT DEFAULT 'hard',
    notes TEXT, played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS scheduled_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER NOT NULL, player2_id INTEGER NOT NULL,
    scheduled_at DATETIME NOT NULL, venue TEXT, surface TEXT DEFAULT 'hard',
    format TEXT DEFAULT 'best_of_3', notes TEXT,
    status TEXT DEFAULT 'scheduled',
    reminder_sent INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, type TEXT NOT NULL,
    title TEXT NOT NULL, message TEXT NOT NULL,
    link TEXT, is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, description TEXT,
    format TEXT DEFAULT 'round_robin',
    status TEXT DEFAULT 'draft',
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_id, user_id),
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    player1_id INTEGER NOT NULL, player2_id INTEGER NOT NULL,
    winner_id INTEGER, score TEXT NOT NULL,
    surface TEXT DEFAULT 'hard',
    match_type TEXT DEFAULT 'singles',
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS clubs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT,
    plan TEXT DEFAULT 'free',
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS club_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(club_id, user_id),
    FOREIGN KEY (club_id) REFERENCES clubs(id),
    FOREIGN KEY (user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS club_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    club_id INTEGER NOT NULL, email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL, invited_by INTEGER NOT NULL,
    expires_at DATETIME NOT NULL, used INTEGER DEFAULT 0,
    FOREIGN KEY (club_id) REFERENCES clubs(id),
    FOREIGN KEY (invited_by) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL, email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL, invited_by INTEGER NOT NULL,
    expires_at DATETIME NOT NULL, used INTEGER DEFAULT 0,
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (invited_by) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL, name TEXT NOT NULL, color TEXT DEFAULT '#1d4ed8',
    player1_id INTEGER NOT NULL, player2_id INTEGER NOT NULL, created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL, name TEXT NOT NULL, color TEXT DEFAULT '#1d4ed8',
    sort_order INTEGER DEFAULT 0, created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_pool_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_id INTEGER NOT NULL, league_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    UNIQUE(pool_id, user_id),
    FOREIGN KEY (pool_id) REFERENCES league_pools(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL, proposer_id INTEGER NOT NULL, opponent_id INTEGER NOT NULL,
    venue TEXT, surface TEXT DEFAULT 'hard', notes TEXT,
    status TEXT DEFAULT 'pending', accepted_slot_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_proposal_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL, proposed_at DATETIME NOT NULL, sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (proposal_id) REFERENCES league_proposals(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS match_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposer_id INTEGER NOT NULL, opponent_id INTEGER NOT NULL,
    player1_partner_id INTEGER, player2_partner_id INTEGER,
    match_type TEXT DEFAULT 'singles', venue TEXT, surface TEXT DEFAULT 'hard',
    format TEXT DEFAULT 'best_of_3', notes TEXT,
    status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proposer_id) REFERENCES users(id), FOREIGN KEY (opponent_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS match_proposal_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL, proposed_at DATETIME NOT NULL, sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (proposal_id) REFERENCES match_proposals(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#1d4ed8',
    player1_id INTEGER NOT NULL,
    player2_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_pools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#1d4ed8',
    sort_order INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_pool_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pool_id INTEGER NOT NULL,
    league_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    UNIQUE(pool_id, user_id),
    FOREIGN KEY (pool_id) REFERENCES league_pools(id),
    FOREIGN KEY (user_id) REFERENCES users(id))`);
  // Email verification tokens
  db.run(`CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id))`);

  // Migrate existing tables — ignored silently if column already exists
  // DEFAULT 1 so all existing accounts are treated as already verified
  db.run(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE matches ADD COLUMN match_type TEXT DEFAULT 'singles'`, () => {});
  db.run(`ALTER TABLE leagues ADD COLUMN plan TEXT DEFAULT 'free'`, () => {});
  db.run(`ALTER TABLE leagues ADD COLUMN enrollment TEXT DEFAULT 'open'`, () => {});
  db.run(`ALTER TABLE league_matches ADD COLUMN venue TEXT`, () => {});
  db.run(`ALTER TABLE leagues ADD COLUMN category TEXT DEFAULT 'open'`, () => {});
  db.run(`ALTER TABLE scheduled_matches ADD COLUMN match_type TEXT DEFAULT 'singles'`, () => {});
  db.run(`ALTER TABLE scheduled_matches ADD COLUMN player1_partner_id INTEGER`, () => {});
  db.run(`ALTER TABLE scheduled_matches ADD COLUMN player2_partner_id INTEGER`, () => {});
  db.run(`ALTER TABLE league_matches ADD COLUMN match_type TEXT DEFAULT 'singles'`, () => {});
  db.run(`ALTER TABLE league_matches ADD COLUMN player1_partner_id INTEGER`, () => {});
  db.run(`ALTER TABLE league_matches ADD COLUMN player2_partner_id INTEGER`, () => {});
  db.run(`ALTER TABLE league_matches ADD COLUMN venue TEXT`, () => {});
  db.run(`CREATE TABLE IF NOT EXISTS match_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposer_id INTEGER NOT NULL,
    opponent_id INTEGER NOT NULL,
    player1_partner_id INTEGER,
    player2_partner_id INTEGER,
    match_type TEXT DEFAULT 'singles',
    venue TEXT, surface TEXT DEFAULT 'hard',
    format TEXT DEFAULT 'best_of_3', notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proposer_id) REFERENCES users(id),
    FOREIGN KEY (opponent_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS match_proposal_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    proposed_at DATETIME NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (proposal_id) REFERENCES match_proposals(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    proposer_id INTEGER NOT NULL,
    opponent_id INTEGER NOT NULL,
    venue TEXT, surface TEXT DEFAULT 'hard', notes TEXT,
    status TEXT DEFAULT 'pending',
    accepted_slot_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id),
    FOREIGN KEY (proposer_id) REFERENCES users(id),
    FOREIGN KEY (opponent_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS league_proposal_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proposal_id INTEGER NOT NULL,
    proposed_at DATETIME NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (proposal_id) REFERENCES league_proposals(id))`);

  // Default admin account — created once, ignored if already exists
  const DEFAULT_ADMIN_USER = 'admin';
  const DEFAULT_ADMIN_PASS = 'Admin@Tennis1';
  const DEFAULT_ADMIN_EMAIL = 'admin@tennistrack.local';
  const adminHash = bcrypt.hashSync(DEFAULT_ADMIN_PASS, 10);
  db.run(
    `INSERT OR IGNORE INTO users (username, email, password, full_name, is_admin, email_verified) VALUES (?, ?, ?, ?, 1, 1)`,
    [DEFAULT_ADMIN_USER, DEFAULT_ADMIN_EMAIL, adminHash, 'Administrator'],
    function(err) {
      if (!err && this.changes > 0) {
        console.log('');
        console.log('╔══════════════════════════════════════════╗');
        console.log('║        DEFAULT ADMIN ACCOUNT CREATED     ║');
        console.log('╠══════════════════════════════════════════╣');
        console.log(`║  Username : ${DEFAULT_ADMIN_USER.padEnd(29)}║`);
        console.log(`║  Password : ${DEFAULT_ADMIN_PASS.padEnd(29)}║`);
        console.log(`║  Email    : ${DEFAULT_ADMIN_EMAIL.padEnd(29)}║`);
        console.log('╠══════════════════════════════════════════╣');
        console.log('║  Change the password after first login!  ║');
        console.log('╚══════════════════════════════════════════╝');
        console.log('');
      }
    }
  );
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: cfg.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { maxAge: 7*24*60*60*1000 } }));

// Inject unread notification count into every authenticated view
app.use(async (req, res, next) => {
  res.locals.unreadCount = 0;
  res.locals.isAdmin = false;
  if (req.session.userId) {
    try {
      const r = await get('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0', [req.session.userId]);
      res.locals.unreadCount = r ? r.c : 0;
      const u = await get('SELECT is_admin FROM users WHERE id=?', [req.session.userId]);
      res.locals.isAdmin = u && u.is_admin === 1;
    } catch(e){}
  }
  next();
});

const requireAuth = (req,res,next) => { if (!req.session.userId) return res.redirect('/login'); next(); };
const requireAdmin = async (req,res,next) => {
  if (!req.session.userId) return res.redirect('/login');
  const u = await get('SELECT is_admin FROM users WHERE id=?', [req.session.userId]);
  if (!u || !u.is_admin) return res.status(403).send('Admin only.');
  next();
};

// ── SaaS Plan definitions ─────────────────────────────────────────────────
const PLANS = {
  free:    { label:'Free',    price:0,  color:'#6b7280', bg:'#f3f4f6', memberLimit:10,  leagueLimit:3,
             features:['Up to 10 members','3 leagues','Match tracking','Basic stats'] },
  pro:     { label:'Pro',     price:9,  color:'#1d4ed8', bg:'#dbeafe', memberLimit:50,  leagueLimit:999,
             features:['Up to 50 members','Unlimited leagues','Email notifications','Advanced analytics','Schedule reminders'] },
  premium: { label:'Premium', price:29, color:'#7c3aed', bg:'#ede9fe', memberLimit:9999, leagueLimit:999,
             features:['Unlimited members','Unlimited leagues','SMS & WhatsApp alerts','Priority support','Custom branding'] }
};

const LEAGUE_PLANS = {
  free:    { label:'Free',    price:0,  color:'#6b7280', bg:'#f3f4f6', playerLimit:8,
             features:['Up to 8 players','Open enrollment','Match tracking','Basic standings'] },
  pro:     { label:'Pro',     price:5,  color:'#1d4ed8', bg:'#dbeafe', playerLimit:24,
             features:['Up to 24 players','Invite-only mode','Email invites','Advanced analytics'] },
  premium: { label:'Premium', price:15, color:'#7c3aed', bg:'#ede9fe', playerLimit:9999,
             features:['Unlimited players','All enrollment modes','Email invites','Priority support'] }
};

const requireClubAccess = async (req,res,next) => {
  if (!req.session.userId) return res.redirect('/login');
  const m = await get('SELECT * FROM club_members WHERE club_id=? AND user_id=?',[req.params.id,req.session.userId]);
  if (!m) return res.status(403).send('You are not a member of this club.');
  req.clubRole = m.role; next();
};
const requireClubAdmin = async (req,res,next) => {
  if (!req.session.userId) return res.redirect('/login');
  const m = await get('SELECT * FROM club_members WHERE club_id=? AND user_id=?',[req.params.id,req.session.userId]);
  if (!m||!['owner','admin'].includes(m.role)) return res.status(403).send('Club admin access required.');
  req.clubRole = m.role; next();
};

// ── Notification helper ───────────────────────────────────────────────────
async function createNotification(userId, type, title, message, link='') {
  await run('INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)',
    [userId, type, title, message, link]);
}

// ── CRON: send reminders 1 hour before scheduled matches ─────────────────
cron.schedule('* * * * *', async () => {
  try {
    const upcoming = await all(`
      SELECT sm.*, u1.username as p1name, u1.full_name as p1full, u1.email as p1email, u1.phone as p1phone, u1.whatsapp_enabled as p1wa,
             u2.username as p2name, u2.full_name as p2full, u2.email as p2email, u2.phone as p2phone, u2.whatsapp_enabled as p2wa,
             p1p.username as p1partnername, p2p.username as p2partnername
      FROM scheduled_matches sm
      JOIN users u1 ON sm.player1_id = u1.id
      JOIN users u2 ON sm.player2_id = u2.id
      LEFT JOIN users p1p ON sm.player1_partner_id = p1p.id
      LEFT JOIN users p2p ON sm.player2_partner_id = p2p.id
      WHERE sm.status='scheduled' AND sm.reminder_sent=0
        AND datetime(sm.scheduled_at) <= datetime('now', '+61 minutes')
        AND datetime(sm.scheduled_at) > datetime('now')`, []);
    for (const m of upcoming) {
      const isDoubles = m.match_type === 'doubles';
      const t1 = isDoubles&&m.p1partnername ? `${m.p1name} & ${m.p1partnername}` : m.p1name;
      const t2 = isDoubles&&m.p2partnername ? `${m.p2name} & ${m.p2partnername}` : m.p2name;
      const p1 = { username: m.p1name, full_name: m.p1full, email: m.p1email, phone: m.p1phone, whatsapp_enabled: m.p1wa };
      const p2 = { username: m.p2name, full_name: m.p2full, email: m.p2email, phone: m.p2phone, whatsapp_enabled: m.p2wa };
      await notify.notifyMatchReminder({ player: p1, opponent: p2, scheduledAt: m.scheduled_at, venue: m.venue });
      await notify.notifyMatchReminder({ player: p2, opponent: p1, scheduledAt: m.scheduled_at, venue: m.venue });
      await createNotification(m.player1_id, 'reminder', '⏰ Match in 1 hour', `${isDoubles?t1+' vs ':' vs '}${t2} — ${m.venue||''}`, `/schedule`);
      await createNotification(m.player2_id, 'reminder', '⏰ Match in 1 hour', `${isDoubles?t2+' vs ':' vs '}${t1} — ${m.venue||''}`, `/schedule`);
      if (isDoubles && m.player1_partner_id) await createNotification(m.player1_partner_id, 'reminder', '⏰ Match in 1 hour', `${t1} vs ${t2} — ${m.venue||''}`, `/schedule`);
      if (isDoubles && m.player2_partner_id) await createNotification(m.player2_partner_id, 'reminder', '⏰ Match in 1 hour', `${t2} vs ${t1} — ${m.venue||''}`, `/schedule`);
      await run('UPDATE scheduled_matches SET reminder_sent=1 WHERE id=?', [m.id]);
    }
  } catch(e){ console.error('[CRON]', e.message); }
});

// ── Auth ──────────────────────────────────────────────────────────────────
app.get('/', (req,res) => res.redirect(req.session.userId ? '/dashboard' : '/login'));
app.get('/register', (req,res) => res.render('register', {error:null}));
app.post('/register', async (req,res) => {
  const { username, email, password, full_name, phone } = req.body;
  if (!username||!email||!password) return res.render('register',{error:'All fields required.'});
  try {
    const hash = await bcrypt.hash(password, 10);
    const countRow = await get('SELECT COUNT(*) as c FROM users');
    const isAdmin = (!countRow || countRow.c === 0) ? 1 : 0;
    // Admin accounts skip verification; others require it when M365 email is configured
    const needsVerify = !isAdmin && cfg.EMAIL.enabled;
    const emailVerified = needsVerify ? 0 : 1;
    const r = await run(
      'INSERT INTO users (username,email,password,full_name,phone,is_admin,email_verified) VALUES (?,?,?,?,?,?,?)',
      [username, email, hash, full_name||username, phone||null, isAdmin, emailVerified]);
    await createNotification(r.lastID, 'welcome', '👋 Welcome to TennisTrack!', 'Start by logging your first match or scheduling one.', '/matches/new');
    if (needsVerify) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24*60*60*1000).toISOString();
      await run('INSERT INTO email_verification_tokens (user_id,token,expires_at) VALUES (?,?,?)', [r.lastID, token, expiresAt]);
      const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email/${token}`;
      console.log(`[Register] Sending verification to ${email} — ${verifyUrl}`);
      const result = await notify.sendVerificationEmail({ to: email, username, verifyUrl });
      if (!result.ok) console.warn('[Register] Verification email failed:', result.reason, '— use URL above to verify manually');
      return res.redirect('/verify-pending?email=' + encodeURIComponent(email));
    }
    req.session.userId = r.lastID; req.session.username = username;
    res.redirect('/dashboard');
  } catch(e) { res.render('register',{error: e.message.includes('UNIQUE')?'Username or email taken.':'Registration failed.'}); }
});

app.get('/login', (req,res) => res.render('login',{error:null, unverifiedEmail:null}));
app.post('/login', async (req,res) => {
  const { username, password } = req.body;
  const user = await get('SELECT * FROM users WHERE username=? OR email=?', [username,username]);
  if (!user||!(await bcrypt.compare(password, user.password)))
    return res.render('login',{error:'Invalid credentials.', unverifiedEmail:null});
  if (!user.email_verified)
    return res.render('login',{error:null, unverifiedEmail: user.email});
  req.session.userId = user.id; req.session.username = user.username;
  res.redirect('/dashboard');
});
app.get('/logout', (req,res) => { req.session.destroy(); res.redirect('/login'); });

// ── Email Verification ────────────────────────────────────────────────────
app.get('/verify-pending', (req,res) => {
  res.render('verify_pending', { email: req.query.email||'', resent: req.query.resent==='1' });
});

app.get('/verify-email/:token', async (req,res) => {
  const row = await get(
    `SELECT * FROM email_verification_tokens WHERE token=? AND datetime(expires_at) > datetime('now')`,
    [req.params.token]);
  if (!row) return res.render('verify_email', { success:false, error:'This verification link is invalid or has expired.' });
  const user = await get('SELECT * FROM users WHERE id=?', [row.user_id]);
  await run('UPDATE users SET email_verified=1 WHERE id=?', [row.user_id]);
  await run('DELETE FROM email_verification_tokens WHERE user_id=?', [row.user_id]);
  // Auto sign-in after verification — no need to log in again
  req.session.userId   = user.id;
  req.session.username = user.username;
  res.render('verify_email', { success:true, error:null });
});

app.post('/resend-verification', async (req,res) => {
  const { email } = req.body;
  const user = await get('SELECT * FROM users WHERE email=?', [email]);
  // Silently succeed even if email not found (prevents enumeration)
  if (user && !user.email_verified) {
    await run('DELETE FROM email_verification_tokens WHERE user_id=?', [user.id]);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24*60*60*1000).toISOString();
    await run('INSERT INTO email_verification_tokens (user_id,token,expires_at) VALUES (?,?,?)', [user.id, token, expiresAt]);
    const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email/${token}`;
    await notify.sendVerificationEmail({ to: email, username: user.username, verifyUrl });
  }
  res.redirect('/verify-pending?email=' + encodeURIComponent(email) + '&resent=1');
});

// ── Forgot / Reset Password ───────────────────────────────────────────────
app.get('/forgot-password', (req,res) => res.render('forgot_password', {error:null, success:null}));

app.post('/forgot-password', async (req,res) => {
  const done = () => res.render('forgot_password', {error:null, success:'If that email is registered, a reset link has been sent.'});
  const { email } = req.body;
  if (!email) return done();
  const user = await get('SELECT * FROM users WHERE email=?', [email]);
  if (!user) return done();
  await run('DELETE FROM password_reset_tokens WHERE user_id=?', [user.id]);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60*60*1000).toISOString();
  await run('INSERT INTO password_reset_tokens (user_id,token,expires_at) VALUES (?,?,?)', [user.id, token, expiresAt]);
  const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
  try {
    const result = await notify.sendPasswordResetEmail({to: user.email, username: user.username, resetUrl});
    if (!result.ok) console.log('[Reset] Email failed, reset URL for dev use:', resetUrl);
  } catch(e) {
    console.error('[Reset email]', e.message);
    console.log('[Reset] Reset URL for dev use:', resetUrl);
  }
  done();
});

app.get('/reset-password/:token', async (req,res) => {
  const row = await get(`SELECT * FROM password_reset_tokens WHERE token=? AND datetime(expires_at) > datetime('now')`, [req.params.token]);
  if (!row) return res.render('reset_password', {token:null, error:'This reset link is invalid or has expired.', success:null});
  res.render('reset_password', {token: req.params.token, error:null, success:null});
});

app.post('/reset-password/:token', async (req,res) => {
  const {password, confirm} = req.body;
  const row = await get(`SELECT * FROM password_reset_tokens WHERE token=? AND datetime(expires_at) > datetime('now')`, [req.params.token]);
  if (!row) return res.render('reset_password', {token:null, error:'This reset link is invalid or has expired.', success:null});
  if (!password || password.length < 6) return res.render('reset_password', {token: req.params.token, error:'Password must be at least 6 characters.', success:null});
  if (password !== confirm) return res.render('reset_password', {token: req.params.token, error:'Passwords do not match.', success:null});
  const hash = await bcrypt.hash(password, 10);
  await run('UPDATE users SET password=? WHERE id=?', [hash, row.user_id]);
  await run('DELETE FROM password_reset_tokens WHERE user_id=?', [row.user_id]);
  res.render('reset_password', {token:null, error:null, success:'Password updated! You can now sign in.'});
});

// ── Dashboard ─────────────────────────────────────────────────────────────
app.get('/dashboard', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const matches = await all(`SELECT m.*,u1.username as p1name,u2.username as p2name,uw.username as winnername FROM matches m JOIN users u1 ON m.player1_id=u1.id JOIN users u2 ON m.player2_id=u2.id LEFT JOIN users uw ON m.winner_id=uw.id WHERE m.player1_id=? OR m.player2_id=? ORDER BY m.played_at DESC LIMIT 5`,[uid,uid]);
  const stats = await get(`SELECT COUNT(*) as total, SUM(CASE WHEN winner_id=? THEN 1 ELSE 0 END) as wins FROM matches WHERE player1_id=? OR player2_id=?`,[uid,uid,uid]);
  const opponents = await all(`SELECT u.id,u.username,COUNT(*) as played,SUM(CASE WHEN m.winner_id=? THEN 1 ELSE 0 END) as wins FROM matches m JOIN users u ON (CASE WHEN m.player1_id=? THEN m.player2_id ELSE m.player1_id END)=u.id WHERE m.player1_id=? OR m.player2_id=? GROUP BY u.id ORDER BY played DESC LIMIT 5`,[uid,uid,uid,uid]);
  const upcoming = await all(`SELECT sm.*,u1.username as p1name,u2.username as p2name FROM scheduled_matches sm JOIN users u1 ON sm.player1_id=u1.id JOIN users u2 ON sm.player2_id=u2.id WHERE (sm.player1_id=? OR sm.player2_id=?) AND sm.status='scheduled' AND datetime(sm.scheduled_at)>datetime('now') ORDER BY sm.scheduled_at ASC LIMIT 3`,[uid,uid]);
  const notifications = await all(`SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 5`,[uid]);

  // Chart data
  const monthlyRaw = await all(`SELECT strftime('%Y-%m',played_at) as month,COUNT(*) as total,SUM(CASE WHEN winner_id=? THEN 1 ELSE 0 END) as wins FROM matches WHERE player1_id=? OR player2_id=? GROUP BY month ORDER BY month DESC LIMIT 6`,[uid,uid,uid]);
  const surfaceRaw = await all(`SELECT surface,COUNT(*) as total,SUM(CASE WHEN winner_id=? THEN 1 ELSE 0 END) as wins FROM matches WHERE player1_id=? OR player2_id=? GROUP BY surface`,[uid,uid,uid]);
  const monthLabels=[], monthTotal=[], monthWins=[];
  for (let i=5; i>=0; i--) {
    const d=new Date(); d.setMonth(d.getMonth()-i);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const found=monthlyRaw.find(r=>r.month===key);
    monthLabels.push(d.toLocaleDateString('en-US',{month:'short',year:'2-digit'}));
    monthTotal.push(found?found.total:0);
    monthWins.push(found?found.wins:0);
  }
  const s = stats||{total:0,wins:0};
  const chartData = {
    wins: s.wins||0, losses: Math.max(0,(s.total||0)-(s.wins||0)),
    monthLabels, monthTotal, monthWins,
    surfaces: surfaceRaw.map(r=>r.surface),
    surfaceWins: surfaceRaw.map(r=>r.wins),
    surfaceLosses: surfaceRaw.map(r=>r.total-r.wins)
  };

  res.render('dashboard',{user, matches, stats:s, opponents, uid, upcoming, notifications, chartData});
});

// ── Matches ───────────────────────────────────────────────────────────────
app.get('/matches', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const page = parseInt(req.query.page)||1, limit=10, offset=(page-1)*limit;
  const surface=req.query.surface||'', result=req.query.result||'';
  let where='WHERE (m.player1_id=? OR m.player2_id=?)';
  let params=[uid,uid];
  if(surface){where+=' AND m.surface=?';params.push(surface);}
  if(result==='win'){where+=' AND m.winner_id=?';params.push(uid);}
  if(result==='loss'){where+=' AND m.winner_id!=? AND m.winner_id IS NOT NULL';params.push(uid);}
  const totalRow = await get(`SELECT COUNT(*) as c FROM matches m ${where}`,params);
  const matches = await all(`SELECT m.*,u1.username as p1name,u2.username as p2name,uw.username as winnername FROM matches m JOIN users u1 ON m.player1_id=u1.id JOIN users u2 ON m.player2_id=u2.id LEFT JOIN users uw ON m.winner_id=uw.id ${where} ORDER BY m.played_at DESC LIMIT ? OFFSET ?`,[...params,limit,offset]);
  res.render('matches',{user,matches,uid,page,total:totalRow?totalRow.c:0,limit,surface,result});
});

app.get('/matches/new', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const players = await all('SELECT id,username,full_name FROM users WHERE id!=?', [uid]);
  res.render('match_new',{user,players,error:null});
});
app.post('/matches/new', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const {opponent_id,score,winner_id,format,surface,match_type,notes,played_at} = req.body;
  if(!opponent_id||!score){
    const user=await get('SELECT * FROM users WHERE id=?',[uid]);
    const players=await all('SELECT id,username,full_name FROM users WHERE id!=?',[uid]);
    return res.render('match_new',{user,players,error:'Opponent and score required.'});
  }
  await run('INSERT INTO matches (player1_id,player2_id,winner_id,score,format,surface,match_type,notes,played_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [uid,parseInt(opponent_id),winner_id?parseInt(winner_id):null,score,format||'best_of_3',surface||'hard',match_type||'singles',notes||'',played_at||new Date().toISOString()]);
  const opp = await get('SELECT * FROM users WHERE id=?', [parseInt(opponent_id)]);
  if(opp) await createNotification(opp.id, 'match', '🎾 New match logged', `${req.session.username} logged a match vs you: ${score}`, '/matches');
  res.redirect('/matches');
});

app.get('/matches/:id', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const match = await get(`SELECT m.*,u1.username as p1name,u1.full_name as p1full,u2.username as p2name,u2.full_name as p2full,uw.username as winnername FROM matches m JOIN users u1 ON m.player1_id=u1.id JOIN users u2 ON m.player2_id=u2.id LEFT JOIN users uw ON m.winner_id=uw.id WHERE m.id=? AND (m.player1_id=? OR m.player2_id=?)`,[req.params.id,uid,uid]);
  if(!match) return res.redirect('/matches');
  res.render('match_detail',{user,match,uid});
});

// ── Admin: delete match ───────────────────────────────────────────────────
app.post('/matches/:id/delete', requireAdmin, async (req,res) => {
  await run('DELETE FROM matches WHERE id=?', [req.params.id]);
  res.redirect('/admin');
});

// ── Schedule ──────────────────────────────────────────────────────────────
async function getProposalsForUser(uid) {
  const incoming = await all(`SELECT mp.*,u1.username as proposer_name,u1.full_name as proposer_full,p1p.username as p1partnername,p2p.username as p2partnername FROM match_proposals mp JOIN users u1 ON mp.proposer_id=u1.id LEFT JOIN users p1p ON mp.player1_partner_id=p1p.id LEFT JOIN users p2p ON mp.player2_partner_id=p2p.id WHERE mp.opponent_id=? AND mp.status='pending' ORDER BY mp.created_at DESC`, [uid]);
  const outgoing = await all(`SELECT mp.*,u2.username as opponent_name,u2.full_name as opponent_full FROM match_proposals mp JOIN users u2 ON mp.opponent_id=u2.id WHERE mp.proposer_id=? AND mp.status IN ('pending','accepted','declined') ORDER BY mp.created_at DESC`, [uid]);
  const allIds = [...incoming.map(p=>p.id),...outgoing.map(p=>p.id)];
  const slots = allIds.length ? await all(`SELECT * FROM match_proposal_slots WHERE proposal_id IN (${allIds.map(()=>'?').join(',')}) ORDER BY sort_order ASC`, allIds) : [];
  const slotMap = {};
  slots.forEach(s=>{ if(!slotMap[s.proposal_id]) slotMap[s.proposal_id]=[]; slotMap[s.proposal_id].push(s); });
  incoming.forEach(p=>{ p.slots=slotMap[p.id]||[]; });
  outgoing.forEach(p=>{ p.slots=slotMap[p.id]||[]; });
  return { incoming, outgoing };
}

app.get('/schedule', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const players = await all('SELECT id,username,full_name FROM users WHERE id!=?', [uid]);
  const scheduled = await all(`SELECT sm.*,u1.username as p1name,u1.full_name as p1full,u2.username as p2name,u2.full_name as p2full,p1p.username as p1partnername,p2p.username as p2partnername FROM scheduled_matches sm JOIN users u1 ON sm.player1_id=u1.id JOIN users u2 ON sm.player2_id=u2.id LEFT JOIN users p1p ON sm.player1_partner_id=p1p.id LEFT JOIN users p2p ON sm.player2_partner_id=p2p.id WHERE (sm.player1_id=? OR sm.player2_id=? OR sm.player1_partner_id=? OR sm.player2_partner_id=?) ORDER BY sm.scheduled_at ASC`,[uid,uid,uid,uid]);
  const { incoming, outgoing } = await getProposalsForUser(uid);
  const success = req.query.success==='proposal_sent'?'Proposal sent! The opponent will be notified.':req.query.success==='accepted'?'Slot accepted — match scheduled!':null;
  res.render('schedule',{user,players,scheduled,uid,incoming,outgoing,error:null,success});
});

app.post('/schedule/new', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const {opponent_id,partner_id,opponent_partner_id,scheduled_at,venue,surface,format,match_type,notes} = req.body;
  const isDoubles = match_type === 'doubles';
  const reRender = async (error) => {
    const user=await get('SELECT * FROM users WHERE id=?',[uid]);
    const players=await all('SELECT id,username,full_name FROM users WHERE id!=?',[uid]);
    const scheduled=await all(`SELECT sm.*,u1.username as p1name,u2.username as p2name,p1p.username as p1partnername,p2p.username as p2partnername FROM scheduled_matches sm JOIN users u1 ON sm.player1_id=u1.id JOIN users u2 ON sm.player2_id=u2.id LEFT JOIN users p1p ON sm.player1_partner_id=p1p.id LEFT JOIN users p2p ON sm.player2_partner_id=p2p.id WHERE (sm.player1_id=? OR sm.player2_id=? OR sm.player1_partner_id=? OR sm.player2_partner_id=?) ORDER BY sm.scheduled_at ASC`,[uid,uid,uid,uid]);
    const {incoming,outgoing}=await getProposalsForUser(uid);
    return res.render('schedule',{user,players,scheduled,uid,incoming,outgoing,error,success:null});
  };
  if(!opponent_id||!scheduled_at) return reRender('Opponent and date/time required.');
  if(isDoubles&&!partner_id) return reRender('Please select your partner for doubles.');
  if(isDoubles&&!opponent_partner_id) return reRender("Please select the opponent's partner for doubles.");
  const p1pid = isDoubles&&partner_id ? parseInt(partner_id) : null;
  const p2pid = isDoubles&&opponent_partner_id ? parseInt(opponent_partner_id) : null;
  const r = await run('INSERT INTO scheduled_matches (player1_id,player2_id,player1_partner_id,player2_partner_id,match_type,scheduled_at,venue,surface,format,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [uid,parseInt(opponent_id),p1pid,p2pid,match_type||'singles',scheduled_at,venue||'',surface||'hard',format||'best_of_3',notes||'',uid]);
  const me = await get('SELECT * FROM users WHERE id=?', [uid]);
  const opp = await get('SELECT * FROM users WHERE id=?', [parseInt(opponent_id)]);
  // In-app notifications
  await createNotification(opp.id,'schedule','📅 Match Scheduled',`${me.full_name||me.username} scheduled a match vs you on ${new Date(scheduled_at).toLocaleDateString()}`,`/schedule`);
  // External notifications
  try { await notify.notifyMatchScheduled({player:me,opponent:opp,scheduledAt:scheduled_at,venue,matchId:r.lastID}); } catch(e){}
  const user=await get('SELECT * FROM users WHERE id=?',[uid]);
  const players=await all('SELECT id,username,full_name FROM users WHERE id!=?',[uid]);
  const scheduled=await all(`SELECT sm.*,u1.username as p1name,u1.full_name as p1full,u2.username as p2name,u2.full_name as p2full,p1p.username as p1partnername,p2p.username as p2partnername FROM scheduled_matches sm JOIN users u1 ON sm.player1_id=u1.id JOIN users u2 ON sm.player2_id=u2.id LEFT JOIN users p1p ON sm.player1_partner_id=p1p.id LEFT JOIN users p2p ON sm.player2_partner_id=p2p.id WHERE (sm.player1_id=? OR sm.player2_id=? OR sm.player1_partner_id=? OR sm.player2_partner_id=?) ORDER BY sm.scheduled_at ASC`,[uid,uid,uid,uid]);
  const {incoming,outgoing}=await getProposalsForUser(uid);
  res.render('schedule',{user,players,scheduled,uid,incoming,outgoing,error:null,success:'Match scheduled! Notifications sent.'});
});

app.post('/schedule/:id/cancel', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const sm = await get('SELECT * FROM scheduled_matches WHERE id=?', [req.params.id]);
  if(!sm||(sm.player1_id!==uid&&sm.player2_id!==uid&&sm.player1_partner_id!==uid&&sm.player2_partner_id!==uid)) return res.redirect('/schedule');
  await run("UPDATE scheduled_matches SET status='cancelled' WHERE id=?", [req.params.id]);
  const p1=await get('SELECT * FROM users WHERE id=?',[sm.player1_id]);
  const p2=await get('SELECT * FROM users WHERE id=?',[sm.player2_id]);
  const other = sm.player1_id===uid ? p2 : p1;
  await createNotification(other.id,'alert','❌ Match Cancelled',`Match vs ${p1.id===uid?p1.username:p2.username} has been cancelled.`,'/schedule');
  try { await notify.notifyMatchCancelled({player:p1,opponent:p2,scheduledAt:sm.scheduled_at}); } catch(e){}
  res.redirect('/schedule');
});

// ── Match Proposals ───────────────────────────────────────────────────────
app.post('/proposals/new', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const { opponent_id, partner_id, opponent_partner_id, match_type, venue, surface, format, notes } = req.body;
  let slots = req.body.slots || [];
  if (!Array.isArray(slots)) slots = [slots];
  slots = slots.filter(Boolean);
  if (!opponent_id || slots.length === 0) return res.redirect('/schedule?err=propose');
  const isDoubles = match_type === 'doubles';
  const p1pid = isDoubles && partner_id ? parseInt(partner_id) : null;
  const p2pid = isDoubles && opponent_partner_id ? parseInt(opponent_partner_id) : null;
  const r = await run(
    'INSERT INTO match_proposals (proposer_id,opponent_id,player1_partner_id,player2_partner_id,match_type,venue,surface,format,notes) VALUES (?,?,?,?,?,?,?,?,?)',
    [uid, parseInt(opponent_id), p1pid, p2pid, match_type||'singles', venue||'', surface||'hard', format||'best_of_3', notes||'']);
  for (let i = 0; i < slots.length; i++) {
    await run('INSERT INTO match_proposal_slots (proposal_id,proposed_at,sort_order) VALUES (?,?,?)', [r.lastID, slots[i], i]);
  }
  const me = await get('SELECT * FROM users WHERE id=?', [uid]);
  const opp = await get('SELECT * FROM users WHERE id=?', [parseInt(opponent_id)]);
  await createNotification(opp.id, 'schedule', '📬 Match Proposal',
    `${me.full_name||me.username} proposed ${slots.length} time slot${slots.length>1?'s':''} for a match — pick one to confirm`, '/schedule');
  res.redirect('/schedule?success=proposal_sent');
});

app.post('/proposals/:id/accept', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const pid = parseInt(req.params.id);
  const slot_id = parseInt(req.body.slot_id);
  const proposal = await get("SELECT * FROM match_proposals WHERE id=? AND opponent_id=? AND status='pending'", [pid, uid]);
  if (!proposal) return res.redirect('/schedule');
  const slot = await get('SELECT * FROM match_proposal_slots WHERE id=? AND proposal_id=?', [slot_id, pid]);
  if (!slot) return res.redirect('/schedule');
  await run(
    'INSERT INTO scheduled_matches (player1_id,player2_id,player1_partner_id,player2_partner_id,match_type,scheduled_at,venue,surface,format,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [proposal.proposer_id, uid, proposal.player1_partner_id, proposal.player2_partner_id,
     proposal.match_type, slot.proposed_at, proposal.venue, proposal.surface, proposal.format, proposal.notes||'', uid]);
  await run("UPDATE match_proposals SET status='accepted' WHERE id=?", [pid]);
  const me = await get('SELECT * FROM users WHERE id=?', [uid]);
  const proposer = await get('SELECT * FROM users WHERE id=?', [proposal.proposer_id]);
  await createNotification(proposer.id, 'schedule', '✅ Proposal Accepted',
    `${me.full_name||me.username} accepted your match proposal for ${new Date(slot.proposed_at).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}`, '/schedule');
  res.redirect('/schedule?success=accepted');
});

app.post('/proposals/:id/decline', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const pid = parseInt(req.params.id);
  const proposal = await get("SELECT * FROM match_proposals WHERE id=? AND opponent_id=? AND status='pending'", [pid, uid]);
  if (!proposal) return res.redirect('/schedule');
  await run("UPDATE match_proposals SET status='declined' WHERE id=?", [pid]);
  const me = await get('SELECT * FROM users WHERE id=?', [uid]);
  await createNotification(proposal.proposer_id, 'alert', '❌ Proposal Declined',
    `${me.full_name||me.username} declined your match proposal`, '/schedule');
  res.redirect('/schedule');
});

app.post('/proposals/:id/cancel', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const pid = parseInt(req.params.id);
  const proposal = await get("SELECT * FROM match_proposals WHERE id=? AND proposer_id=? AND status='pending'", [pid, uid]);
  if (!proposal) return res.redirect('/schedule');
  await run("UPDATE match_proposals SET status='cancelled' WHERE id=?", [pid]);
  const me = await get('SELECT * FROM users WHERE id=?', [uid]);
  await createNotification(proposal.opponent_id, 'info', '📬 Proposal Withdrawn',
    `${me.full_name||me.username} withdrew their match proposal`, '/schedule');
  res.redirect('/schedule');
});

// ── Notifications ─────────────────────────────────────────────────────────
app.get('/notifications', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const notifications = await all('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC', [uid]);
  await run('UPDATE notifications SET is_read=1 WHERE user_id=?', [uid]);
  res.render('notifications',{user,notifications});
});
app.post('/notifications/clear', requireAuth, async (req,res) => {
  await run('DELETE FROM notifications WHERE user_id=?', [req.session.userId]);
  res.redirect('/notifications');
});
app.get('/notifications/count', requireAuth, async (req,res) => {
  const r = await get('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0', [req.session.userId]);
  res.json({count: r?r.c:0});
});

// ── Compare ───────────────────────────────────────────────────────────────
app.get('/compare', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const opponents = await all(`SELECT DISTINCT u.id,u.username,u.full_name FROM matches m JOIN users u ON (CASE WHEN m.player1_id=? THEN m.player2_id ELSE m.player1_id END)=u.id WHERE m.player1_id=? OR m.player2_id=?`,[uid,uid,uid]);
  const oppId = req.query.opponent?parseInt(req.query.opponent):null;
  let compareData=null;
  if(oppId){
    const opponent=await get('SELECT * FROM users WHERE id=?',[oppId]);
    const h2h=await all(`SELECT m.*,u1.username as p1name,u2.username as p2name,uw.username as winnername FROM matches m JOIN users u1 ON m.player1_id=u1.id JOIN users u2 ON m.player2_id=u2.id LEFT JOIN users uw ON m.winner_id=uw.id WHERE (m.player1_id=? AND m.player2_id=?) OR (m.player1_id=? AND m.player2_id=?) ORDER BY m.played_at DESC`,[uid,oppId,oppId,uid]);
    const myWins=h2h.filter(m=>m.winner_id===uid).length;
    const oppWins=h2h.filter(m=>m.winner_id===oppId).length;
    const bySurface={};
    h2h.forEach(m=>{if(!bySurface[m.surface])bySurface[m.surface]={myWins:0,oppWins:0,total:0};bySurface[m.surface].total++;if(m.winner_id===uid)bySurface[m.surface].myWins++;else if(m.winner_id===oppId)bySurface[m.surface].oppWins++;});
    compareData={opponent,h2h,myWins,oppWins,bySurface,total:h2h.length};
  }
  res.render('compare',{user,opponents,compareData,uid,selectedOpp:oppId});
});

// ── Admin panel ───────────────────────────────────────────────────────────
app.get('/admin', requireAdmin, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const users = await all('SELECT id,username,full_name,email,phone,is_admin,created_at FROM users WHERE is_admin=0 ORDER BY created_at DESC');
  const matches = await all(`SELECT m.*,u1.username as p1name,u2.username as p2name,uw.username as winnername FROM matches m JOIN users u1 ON m.player1_id=u1.id JOIN users u2 ON m.player2_id=u2.id LEFT JOIN users uw ON m.winner_id=uw.id ORDER BY m.played_at DESC LIMIT 50`);
  const scheduled = await all(`SELECT sm.*,u1.username as p1name,u2.username as p2name FROM scheduled_matches sm JOIN users u1 ON sm.player1_id=u1.id JOIN users u2 ON sm.player2_id=u2.id ORDER BY sm.scheduled_at DESC LIMIT 50`);
  res.render('admin',{user,users,matches,scheduled,uid});
});
app.post('/admin/users/:id/edit', requireAdmin, async (req,res) => {
  const { full_name, email, phone } = req.body;
  await run('UPDATE users SET full_name=?,email=?,phone=? WHERE id=?',
    [full_name||'', email||'', phone||null, req.params.id]);
  res.redirect('/admin');
});

app.post('/admin/matches/:id/edit', requireAdmin, async (req,res) => {
  const { score, winner_id, played_at } = req.body;
  await run('UPDATE matches SET score=?,winner_id=?,played_at=? WHERE id=?',
    [score, winner_id||null, played_at||new Date().toISOString(), req.params.id]);
  res.redirect('/admin');
});

app.post('/admin/users/:id/toggle-admin', requireAdmin, async (req,res) => {
  const u = await get('SELECT is_admin FROM users WHERE id=?', [req.params.id]);
  if(u) await run('UPDATE users SET is_admin=? WHERE id=?', [u.is_admin?0:1, req.params.id]);
  res.redirect('/admin');
});
app.post('/admin/users/:id/delete', requireAdmin, async (req,res) => {
  await run('DELETE FROM users WHERE id=?', [req.params.id]);
  res.redirect('/admin');
});
app.post('/admin/schedule/:id/cancel', requireAdmin, async (req,res) => {
  await run("UPDATE scheduled_matches SET status='cancelled' WHERE id=?", [req.params.id]);
  res.redirect('/admin');
});

// ── Profile ───────────────────────────────────────────────────────────────
app.get('/profile', requireAuth, async (req,res) => {
  const user = await get('SELECT * FROM users WHERE id=?', [req.session.userId]);
  res.render('profile',{user,success:null,error:null});
});
app.post('/profile', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const {full_name,email,password,phone,whatsapp_enabled} = req.body;
  try {
    const wa = whatsapp_enabled ? 1 : 0;
    if(password&&password.length>=6){
      const hash=await bcrypt.hash(password,10);
      await run('UPDATE users SET full_name=?,email=?,password=?,phone=?,whatsapp_enabled=? WHERE id=?',[full_name,email,hash,phone||null,wa,uid]);
    } else {
      await run('UPDATE users SET full_name=?,email=?,phone=?,whatsapp_enabled=? WHERE id=?',[full_name,email,phone||null,wa,uid]);
    }
    const user=await get('SELECT * FROM users WHERE id=?',[uid]);
    res.render('profile',{user,success:'Profile updated!',error:null});
  } catch(e){
    const user=await get('SELECT * FROM users WHERE id=?',[uid]);
    res.render('profile',{user,success:null,error:'Update failed.'});
  }
});

// ── Leagues ───────────────────────────────────────────────────────────────
async function getLeagueData(leagueId, uid) {
  const league = await get(`SELECT l.*,u.username as creator_name FROM leagues l JOIN users u ON l.created_by=u.id WHERE l.id=?`, [leagueId]);
  if (!league) return null;
  const members = await all(`SELECT u.id,u.username,u.full_name FROM league_members lm JOIN users u ON lm.user_id=u.id WHERE lm.league_id=? ORDER BY lm.joined_at ASC`, [leagueId]);
  const lmatches = await all(`SELECT lm.*,u1.username as p1name,u2.username as p2name,uw.username as winnername,p1p.username as p1partnername,p2p.username as p2partnername FROM league_matches lm JOIN users u1 ON lm.player1_id=u1.id JOIN users u2 ON lm.player2_id=u2.id LEFT JOIN users uw ON lm.winner_id=uw.id LEFT JOIN users p1p ON lm.player1_partner_id=p1p.id LEFT JOIN users p2p ON lm.player2_partner_id=p2p.id WHERE lm.league_id=? ORDER BY lm.played_at DESC`, [leagueId]);
  const standings = members.map(m => {
    const played = lmatches.filter(lm => lm.player1_id===m.id||lm.player2_id===m.id||lm.player1_partner_id===m.id||lm.player2_partner_id===m.id);
    const wins = played.filter(lm => {
      if (!lm.winner_id) return false;
      const onT1 = lm.player1_id===m.id || lm.player1_partner_id===m.id;
      const onT2 = lm.player2_id===m.id || lm.player2_partner_id===m.id;
      const t1won = lm.winner_id===lm.player1_id || lm.winner_id===lm.player1_partner_id;
      const t2won = lm.winner_id===lm.player2_id || lm.winner_id===lm.player2_partner_id;
      return (onT1&&t1won)||(onT2&&t2won);
    }).length;
    const losses = played.filter(lm => {
      if (!lm.winner_id) return false;
      const onT1 = lm.player1_id===m.id || lm.player1_partner_id===m.id;
      const onT2 = lm.player2_id===m.id || lm.player2_partner_id===m.id;
      const t1won = lm.winner_id===lm.player1_id || lm.winner_id===lm.player1_partner_id;
      const t2won = lm.winner_id===lm.player2_id || lm.winner_id===lm.player2_partner_id;
      return (onT1&&t2won)||(onT2&&t1won);
    }).length;
    return {...m, played: played.length, wins, losses, points: wins*2};
  }).sort((a,b) => b.points-a.points || b.wins-a.wins);

  // Team standings for doubles categories
  const doublesCategories = ['mens_doubles','womens_doubles','mixed_doubles'];
  let teamStandings = null;
  if (doublesCategories.includes(league.category||'')) {
    const teamsMap = {};
    const memberById = Object.fromEntries(members.map(m => [m.id, m]));
    lmatches.forEach(lm => {
      const t1ids = [lm.player1_id, lm.player1_partner_id].filter(Boolean).sort((a,b)=>a-b);
      const t2ids = [lm.player2_id, lm.player2_partner_id].filter(Boolean).sort((a,b)=>a-b);
      [{ ids: t1ids, partnerIds: t2ids, side: 1 }, { ids: t2ids, partnerIds: t1ids, side: 2 }].forEach(({ ids, side }) => {
        const key = ids.join('_');
        if (!teamsMap[key]) {
          const names = ids.map(id => memberById[id]?.full_name || memberById[id]?.username || `#${id}`);
          const usernames = ids.map(id => memberById[id]?.username || `#${id}`);
          teamsMap[key] = { key, ids, names, usernames, played: 0, wins: 0, losses: 0, points: 0 };
        }
        const t1won = lm.winner_id && (lm.winner_id===lm.player1_id || lm.winner_id===lm.player1_partner_id);
        const t2won = lm.winner_id && (lm.winner_id===lm.player2_id || lm.winner_id===lm.player2_partner_id);
        const myWin  = side===1 ? t1won : t2won;
        const myLoss = side===1 ? t2won : t1won;
        teamsMap[key].played++;
        if (myWin)  { teamsMap[key].wins++;   teamsMap[key].points += 2; }
        if (myLoss) { teamsMap[key].losses++; }
      });
    });
    teamStandings = Object.values(teamsMap).sort((a,b) => b.points-a.points || b.wins-a.wins);
  }

  const plan = LEAGUE_PLANS[league.plan] || LEAGUE_PLANS.free;
  const invites = await all(`SELECT li.*,u.username as inviter FROM league_invites li JOIN users u ON li.invited_by=u.id WHERE li.league_id=? AND li.used=0 AND datetime(li.expires_at)>datetime('now') ORDER BY li.expires_at DESC`, [leagueId]);
  const teams = await all(`SELECT lt.*,u1.username as p1name,u1.full_name as p1full,u2.username as p2name,u2.full_name as p2full FROM league_teams lt JOIN users u1 ON lt.player1_id=u1.id JOIN users u2 ON lt.player2_id=u2.id WHERE lt.league_id=? ORDER BY lt.created_at ASC`, [leagueId]);
  let pools = [];
  try {
    const poolRows = await all(`SELECT lp.* FROM league_pools lp WHERE lp.league_id=? ORDER BY lp.sort_order ASC, lp.created_at ASC`, [leagueId]);
    const poolMemberRows = await all(`SELECT lpm.pool_id, u.id, u.username, u.full_name FROM league_pool_members lpm JOIN users u ON lpm.user_id=u.id WHERE lpm.league_id=?`, [leagueId]);
    pools = poolRows.map(p => ({ ...p, poolMembers: poolMemberRows.filter(m => m.pool_id === p.id) }));
  } catch(e) {}
  return { league, members, lmatches, standings, teamStandings, teams, pools, plan, invites,
    isMember: members.some(m => m.id===uid),
    isCreator: league.created_by===uid };
}

app.get('/leagues', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const leagues = await all(`SELECT l.*,u.username as creator_name,(SELECT COUNT(*) FROM league_members WHERE league_id=l.id) as member_count,(SELECT COUNT(*) FROM league_matches WHERE league_id=l.id) as match_count,(SELECT COUNT(*) FROM league_members WHERE league_id=l.id AND user_id=?) as is_member FROM leagues l JOIN users u ON l.created_by=u.id ORDER BY l.created_at DESC`, [uid]);
  res.render('leagues',{user,leagues,uid,activeCat:req.query.cat||'all',error:null,success:null});
});

app.post('/leagues', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const {name,description,format,category} = req.body;
  if (!name||!name.trim()) {
    const user=await get('SELECT * FROM users WHERE id=?',[uid]);
    const leagues=await all(`SELECT l.*,u.username as creator_name,(SELECT COUNT(*) FROM league_members WHERE league_id=l.id) as member_count,(SELECT COUNT(*) FROM league_matches WHERE league_id=l.id) as match_count,(SELECT COUNT(*) FROM league_members WHERE league_id=l.id AND user_id=?) as is_member FROM leagues l JOIN users u ON l.created_by=u.id ORDER BY l.created_at DESC`,[uid]);
    return res.render('leagues',{user,leagues,uid,activeCat:'all',error:'League name is required.',success:null});
  }
  const r = await run('INSERT INTO leagues (name,description,format,category,created_by) VALUES (?,?,?,?,?)',[name.trim(),description||'',format||'round_robin',category||'open',uid]);
  await run('INSERT INTO league_members (league_id,user_id) VALUES (?,?)',[r.lastID,uid]);
  res.redirect(`/leagues/${r.lastID}`);
});

// ── League Dashboard ─────────────────────────────────────────────────────
app.get('/leagues/:id/dashboard', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const lid = parseInt(req.params.id);
  const data = await getLeagueData(lid, uid);
  if (!data) return res.redirect('/leagues');
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);

  const { lmatches, members, standings, teamStandings, league } = data;

  // Summary stats
  const totalMatches = lmatches.length;
  const decidedMatches = lmatches.filter(m => m.winner_id).length;
  const activePlayers = new Set([
    ...lmatches.map(m => m.player1_id),
    ...lmatches.map(m => m.player2_id),
    ...lmatches.filter(m => m.player1_partner_id).map(m => m.player1_partner_id),
    ...lmatches.filter(m => m.player2_partner_id).map(m => m.player2_partner_id),
  ]).size;
  const totalPoints = decidedMatches * 2;

  // Match type split
  const singlesCount = lmatches.filter(m => m.match_type !== 'doubles').length;
  const doublesCount = lmatches.filter(m => m.match_type === 'doubles').length;

  // Surface breakdown
  const surfaceMap = {};
  lmatches.forEach(m => { const s = m.surface||'hard'; surfaceMap[s] = (surfaceMap[s]||0) + 1; });
  const surfaceLabels = Object.keys(surfaceMap);
  const surfaceCounts = Object.values(surfaceMap);

  // Monthly activity (last 6 months)
  const monthLabels = [], monthCounts = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthLabels.push(d.toLocaleDateString('en-US', { month:'short', year:'2-digit' }));
    monthCounts.push(lmatches.filter(m => (m.played_at||'').startsWith(key)).length);
  }

  // Top performers
  const qualified = standings.filter(s => s.played >= 1).sort((a,b) => b.wins-a.wins);
  const topWins     = qualified.slice(0, 3);
  const topWinRate  = [...standings].filter(s => s.played >= 2)
    .sort((a,b) => (b.wins/b.played) - (a.wins/a.played)).slice(0, 3)
    .map(s => ({ ...s, winRate: Math.round((s.wins/s.played)*100) }));
  const topActive   = [...standings].sort((a,b) => b.played-a.played).slice(0, 3);

  // Venue breakdown
  const venueMap = {};
  lmatches.filter(m => m.venue).forEach(m => { venueMap[m.venue] = (venueMap[m.venue]||0) + 1; });
  const topVenues = Object.entries(venueMap).sort((a,b) => b[1]-a[1]).slice(0, 5);

  // Recent matches (last 8)
  const recentMatches = lmatches.slice(0, 8);

  const chartData = { surfaceLabels, surfaceCounts, monthLabels, monthCounts, singlesCount, doublesCount };

  res.render('league_dashboard', {
    user, uid, ...data, totalMatches, decidedMatches, activePlayers, totalPoints,
    singlesCount, doublesCount, topWins, topWinRate, topActive,
    topVenues, recentMatches, chartData
  });
});

// ── League Calendar & Proposals ───────────────────────────────────────────
async function getLeagueProposals(leagueId, uid) {
  const rows = await all(`
    SELECT lp.*, s.proposed_at as accepted_at,
      u1.username as proposer_name, u1.full_name as proposer_full,
      u2.username as opponent_name, u2.full_name as opponent_full
    FROM league_proposals lp
    JOIN users u1 ON lp.proposer_id=u1.id
    JOIN users u2 ON lp.opponent_id=u2.id
    LEFT JOIN league_proposal_slots s ON lp.accepted_slot_id=s.id
    WHERE lp.league_id=? AND (lp.proposer_id=? OR lp.opponent_id=?) AND lp.status!='cancelled'
    ORDER BY lp.created_at DESC`, [leagueId, uid, uid]);
  const pids = rows.map(r => r.id);
  const slots = pids.length ? await all(
    `SELECT * FROM league_proposal_slots WHERE proposal_id IN (${pids.map(()=>'?').join(',')}) ORDER BY sort_order ASC`, pids) : [];
  const slotMap = {};
  slots.forEach(s => { if (!slotMap[s.proposal_id]) slotMap[s.proposal_id]=[]; slotMap[s.proposal_id].push(s); });
  rows.forEach(r => { r.slots = slotMap[r.id]||[]; });
  return {
    incoming: rows.filter(r => r.opponent_id===uid && r.status==='pending'),
    outgoing: rows.filter(r => r.proposer_id===uid && r.status==='pending'),
    accepted: rows.filter(r => r.status==='accepted'),
    all: rows
  };
}

app.get('/leagues/:id/calendar', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const lid = parseInt(req.params.id);
  const data = await getLeagueData(lid, uid);
  if (!data || !data.isMember) return res.redirect(`/leagues/${lid}`);
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const proposals = await getLeagueProposals(lid, uid);
  res.render('league_calendar', {
    ...data, user, uid, proposals,
    success: req.query.success||null, error: req.query.error||null,
    rescheduleOpponent: req.query.reschedule||null,
    proposeOpponent: req.query.propose||null
  });
});

app.post('/leagues/:id/proposals/new', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const lid = parseInt(req.params.id);
  const data = await getLeagueData(lid, uid);
  if (!data || !data.isMember) return res.redirect(`/leagues/${lid}`);
  const { opponent_id, venue, surface, notes } = req.body;
  let slots = req.body.slots||[]; if (!Array.isArray(slots)) slots=[slots]; slots=slots.filter(Boolean);
  if (!opponent_id||slots.length===0) return res.redirect(`/leagues/${lid}/calendar?error=Select an opponent and add at least one time slot.`);
  const r = await run('INSERT INTO league_proposals (league_id,proposer_id,opponent_id,venue,surface,notes) VALUES (?,?,?,?,?,?)',
    [lid, uid, parseInt(opponent_id), venue||'', surface||'hard', notes||'']);
  for (let i=0; i<slots.length; i++) await run('INSERT INTO league_proposal_slots (proposal_id,proposed_at,sort_order) VALUES (?,?,?)',[r.lastID,slots[i],i]);
  const me = await get('SELECT * FROM users WHERE id=?',[uid]);
  const opp = await get('SELECT * FROM users WHERE id=?',[parseInt(opponent_id)]);
  await createNotification(opp.id,'schedule','📬 League Match Proposal',
    `${me.full_name||me.username} proposed ${slots.length} time slot${slots.length!==1?'s':''} for a league match — pick one to confirm`,`/leagues/${lid}/calendar`);
  res.redirect(`/leagues/${lid}/calendar?success=Proposal sent to ${opp.full_name||opp.username}!`);
});

app.post('/leagues/:id/proposals/:pid/accept', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const lid = parseInt(req.params.id);
  const pid = parseInt(req.params.pid);
  const slot_id = parseInt(req.body.slot_id);
  const proposal = await get("SELECT * FROM league_proposals WHERE id=? AND league_id=? AND opponent_id=? AND status='pending'",[pid,lid,uid]);
  if (!proposal) return res.redirect(`/leagues/${lid}/calendar`);
  const slot = await get('SELECT * FROM league_proposal_slots WHERE id=? AND proposal_id=?',[slot_id,pid]);
  if (!slot) return res.redirect(`/leagues/${lid}/calendar`);
  await run("UPDATE league_proposals SET status='accepted',accepted_slot_id=? WHERE id=?",[slot_id,pid]);
  const me = await get('SELECT * FROM users WHERE id=?',[uid]);
  const proposer = await get('SELECT * FROM users WHERE id=?',[proposal.proposer_id]);
  const dateLabel = new Date(slot.proposed_at).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  await createNotification(proposer.id,'schedule','✅ Match Confirmed',
    `${me.full_name||me.username} accepted your proposal — confirmed for ${dateLabel}`,`/leagues/${lid}/calendar`);
  res.redirect(`/leagues/${lid}/calendar?success=Match confirmed for ${dateLabel}!`);
});

app.post('/leagues/:id/proposals/:pid/decline', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const lid = parseInt(req.params.id);
  const pid = parseInt(req.params.pid);
  const proposal = await get("SELECT * FROM league_proposals WHERE id=? AND league_id=? AND opponent_id=? AND status='pending'",[pid,lid,uid]);
  if (!proposal) return res.redirect(`/leagues/${lid}/calendar`);
  await run("UPDATE league_proposals SET status='declined' WHERE id=?",[pid]);
  const me = await get('SELECT * FROM users WHERE id=?',[uid]);
  await createNotification(proposal.proposer_id,'alert','❌ Proposal Declined',
    `${me.full_name||me.username} declined your match proposal`,`/leagues/${lid}/calendar`);
  res.redirect(`/leagues/${lid}/calendar`);
});

app.post('/leagues/:id/proposals/:pid/cancel', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const lid = parseInt(req.params.id);
  const pid = parseInt(req.params.pid);
  const proposal = await get("SELECT * FROM league_proposals WHERE id=? AND league_id=? AND proposer_id=? AND status IN ('pending','accepted')",[pid,lid,uid]);
  if (!proposal) return res.redirect(`/leagues/${lid}/calendar`);
  const wasAccepted = proposal.status==='accepted';
  await run("UPDATE league_proposals SET status='cancelled' WHERE id=?",[pid]);
  const me = await get('SELECT * FROM users WHERE id=?',[uid]);
  await createNotification(proposal.opponent_id,'info','📅 Match Update',
    `${me.full_name||me.username} ${wasAccepted?'cancelled the confirmed match':'withdrew their match proposal'}`,`/leagues/${lid}/calendar`);
  const redir = req.body.reschedule==='1'?`/leagues/${lid}/calendar?reschedule=${proposal.opponent_id}`:`/leagues/${lid}/calendar`;
  res.redirect(redir);
});

app.get('/leagues/:id', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const lid = parseInt(req.params.id);
  const data = await getLeagueData(lid, uid);
  if (!data) return res.redirect('/leagues');
  let acceptedProposals = [];
  let calProposals = {incoming:[],outgoing:[],accepted:[],all:[]};
  try {
    acceptedProposals = await all(
      `SELECT lp.*, s.proposed_at as scheduled_at FROM league_proposals lp
       JOIN league_proposal_slots s ON lp.accepted_slot_id=s.id
       WHERE lp.league_id=? AND lp.status='accepted'`, [lid]);
  } catch(e) {}
  try { calProposals = await getLeagueProposals(lid, uid); } catch(e) {}
  res.render('league_detail',{user,uid,...data,acceptedProposals,calProposals,joinErr:req.query.err||null,error:null,success:null});
});

app.post('/leagues/:id/join', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const league = await get('SELECT * FROM leagues WHERE id=?',[req.params.id]);
  if (!league||league.status!=='active') return res.redirect('/leagues');
  const enrollment = league.enrollment||'open';
  if (enrollment==='closed') return res.redirect(`/leagues/${league.id}?err=closed`);
  if (enrollment==='invite_only') return res.redirect(`/leagues/${league.id}?err=invite_only`);
  const plan = LEAGUE_PLANS[league.plan]||LEAGUE_PLANS.free;
  const mc = await get('SELECT COUNT(*) as c FROM league_members WHERE league_id=?',[league.id]);
  if ((mc?.c||0) >= plan.playerLimit) return res.redirect(`/leagues/${league.id}?err=limit`);
  try { await run('INSERT INTO league_members (league_id,user_id) VALUES (?,?)',[league.id,uid]); } catch(e){}
  res.redirect(`/leagues/${league.id}`);
});

app.post('/leagues/:id/leave', requireAuth, async (req,res) => {
  await run('DELETE FROM league_members WHERE league_id=? AND user_id=?',[req.params.id,req.session.userId]);
  res.redirect('/leagues');
});

app.post('/leagues/:id/match', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const {opponent_id,partner_id,opponent_partner_id,score,winner_id,surface,match_type,played_at,venue} = req.body;
  const lid = parseInt(req.params.id);
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const data = await getLeagueData(lid, uid);
  if (!data) return res.redirect('/leagues');
  if (!data.isMember) return res.redirect(`/leagues/${lid}`);
  const cat = data.league.category||'open';
  const doublesCategories = ['mens_doubles','womens_doubles','mixed_doubles'];
  const singlesCategories = ['mens_singles','womens_singles'];
  const resolvedType = doublesCategories.includes(cat) ? 'doubles' : singlesCategories.includes(cat) ? 'singles' : (match_type||'singles');
  const isDoubles = resolvedType === 'doubles';
  const _emptyCalProposals = {incoming:[],outgoing:[],accepted:[],all:[]};
  if (!opponent_id||!score) return res.render('league_detail',{user,uid,...data,acceptedProposals:[],calProposals:_emptyCalProposals,joinErr:null,error:'Opponent and score are required.',success:null});
  if (isDoubles&&!partner_id) return res.render('league_detail',{user,uid,...data,acceptedProposals:[],calProposals:_emptyCalProposals,joinErr:null,error:'Please select your partner.',success:null});
  if (isDoubles&&!opponent_partner_id) return res.render('league_detail',{user,uid,...data,acceptedProposals:[],calProposals:_emptyCalProposals,joinErr:null,error:"Please select the opponent's partner.",success:null});
  const oid = parseInt(opponent_id);
  const p1pid = isDoubles&&partner_id ? parseInt(partner_id) : null;
  const p2pid = isDoubles&&opponent_partner_id ? parseInt(opponent_partner_id) : null;
  if (!data.members.some(m=>m.id===oid)) return res.render('league_detail',{user,uid,...data,acceptedProposals:[],calProposals:_emptyCalProposals,joinErr:null,error:'Opponent is not a league member.',success:null});
  // winner_id: '_opp' marker means opponent team won → use oid
  const resolvedWinner = winner_id ? (winner_id==='_opp' ? oid : parseInt(winner_id)||null) : null;
  await run('INSERT INTO league_matches (league_id,player1_id,player2_id,player1_partner_id,player2_partner_id,winner_id,score,surface,match_type,played_at,venue) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [lid,uid,oid,p1pid,p2pid,resolvedWinner,score,surface||'hard',resolvedType,played_at||new Date().toISOString(),venue||null]);
  const fresh = await getLeagueData(lid, uid);
  let _ap = [], _cp = {incoming:[],outgoing:[],accepted:[],all:[]};
  try { _ap = await all(`SELECT lp.*,s.proposed_at as scheduled_at FROM league_proposals lp JOIN league_proposal_slots s ON lp.accepted_slot_id=s.id WHERE lp.league_id=? AND lp.status='accepted'`,[lid]); } catch(e){}
  try { _cp = await getLeagueProposals(lid, uid); } catch(e){}
  res.render('league_detail',{user,uid,...fresh,acceptedProposals:_ap,calProposals:_cp,joinErr:null,error:null,success:'Match logged!'});
});

// ── League Teams ──────────────────────────────────────────────────────────
app.post('/leagues/:id/teams', requireAuth, async (req,res) => {
  const lid = parseInt(req.params.id);
  const uid = req.session.userId;
  const { name, color, player1_id, player2_id } = req.body;
  const data = await getLeagueData(lid, uid);
  if (!data || !data.isCreator) return res.redirect(`/leagues/${lid}`);
  const p1 = parseInt(player1_id), p2 = parseInt(player2_id);
  if (!p1 || !p2 || p1 === p2) {
    const user = await get('SELECT * FROM users WHERE id=?', [uid]);
    return res.render('league_detail', {user, uid, ...data, acceptedProposals:[], calProposals:{incoming:[],outgoing:[],accepted:[],all:[]}, joinErr:null, error:'Select two different players to form a team.', success:null});
  }
  await run('INSERT INTO league_teams (league_id,name,color,player1_id,player2_id,created_by) VALUES (?,?,?,?,?,?)',
    [lid, (name||'').trim()||'Team', color||'#1d4ed8', p1, p2, uid]);
  res.redirect(`/leagues/${lid}#teams`);
});

app.post('/leagues/:id/teams/:tid/delete', requireAuth, async (req,res) => {
  const lid = parseInt(req.params.id);
  const uid = req.session.userId;
  const data = await getLeagueData(lid, uid);
  if (!data || !data.isCreator) return res.redirect(`/leagues/${lid}`);
  await run('DELETE FROM league_teams WHERE id=? AND league_id=?', [req.params.tid, lid]);
  res.redirect(`/leagues/${lid}#teams`);
});

// ── League Pools ───────────────────────────────────────────────────────────
app.post('/leagues/:id/pools/save', requireAuth, async (req,res) => {
  const lid = parseInt(req.params.id);
  const uid = req.session.userId;
  const data = await getLeagueData(lid, uid);
  if (!data || !data.isCreator) return res.redirect(`/leagues/${lid}`);
  let poolsData;
  try { poolsData = JSON.parse(req.body.pools_json || '[]'); } catch(e) { poolsData = []; }
  // Wipe existing pools for this league and re-create
  const existing = await all('SELECT id FROM league_pools WHERE league_id=?', [lid]);
  for (const ep of existing) await run('DELETE FROM league_pool_members WHERE pool_id=?', [ep.id]);
  await run('DELETE FROM league_pools WHERE league_id=?', [lid]);
  for (let i = 0; i < poolsData.length; i++) {
    const p = poolsData[i];
    if (!p.name || !Array.isArray(p.players)) continue;
    const r = await run('INSERT INTO league_pools (league_id,name,color,sort_order,created_by) VALUES (?,?,?,?,?)',
      [lid, p.name.trim()||`Pool ${i+1}`, p.color||'#1d4ed8', i, uid]);
    for (const pid of p.players) {
      await run('INSERT OR IGNORE INTO league_pool_members (pool_id,league_id,user_id) VALUES (?,?,?)',
        [r.lastID, lid, parseInt(pid)]);
    }
  }
  if (req.body.start_after_save === '1' && data.league.status === 'draft') {
    await run("UPDATE leagues SET status='active' WHERE id=?", [lid]);
  }
  res.redirect(`/leagues/${lid}#pools`);
});

app.post('/leagues/:id/pools/:pid/delete', requireAuth, async (req,res) => {
  const lid = parseInt(req.params.id);
  const uid = req.session.userId;
  const data = await getLeagueData(lid, uid);
  if (!data || !data.isCreator) return res.redirect(`/leagues/${lid}`);
  await run('DELETE FROM league_pool_members WHERE pool_id=?', [req.params.pid]);
  await run('DELETE FROM league_pools WHERE id=? AND league_id=?', [req.params.pid, lid]);
  res.redirect(`/leagues/${lid}#pools`);
});

// ── League Player Stats (SAS) ─────────────────────────────────────────────
app.get('/leagues/:id/player/:pid', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const lid = parseInt(req.params.id);
  const pid = parseInt(req.params.pid);
  const data = await getLeagueData(lid, uid);
  if (!data) return res.redirect('/leagues');
  if (!data.members.some(m => m.id === pid)) return res.redirect(`/leagues/${lid}`);
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);
  const player = await get('SELECT id,username,full_name FROM users WHERE id=?', [pid]);
  if (!player) return res.redirect(`/leagues/${lid}`);

  const playerMatches = await all(`
    SELECT lm.*,
      u1.username as p1name, u1.full_name as p1full,
      u2.username as p2name, u2.full_name as p2full,
      uw.username as winnername,
      p1p.username as p1partnername,
      p2p.username as p2partnername
    FROM league_matches lm
    JOIN users u1 ON lm.player1_id=u1.id
    JOIN users u2 ON lm.player2_id=u2.id
    LEFT JOIN users uw ON lm.winner_id=uw.id
    LEFT JOIN users p1p ON lm.player1_partner_id=p1p.id
    LEFT JOIN users p2p ON lm.player2_partner_id=p2p.id
    WHERE lm.league_id=? AND (lm.player1_id=? OR lm.player2_id=? OR lm.player1_partner_id=? OR lm.player2_partner_id=?)
    ORDER BY lm.played_at DESC
  `, [lid, pid, pid, pid, pid]);

  let wins = 0, losses = 0;
  const surfaceStats = {};
  const h2hMap = {};
  data.members.filter(m => m.id !== pid).forEach(m => {
    h2hMap[m.id] = { id: m.id, username: m.username, full_name: m.full_name, wins: 0, losses: 0, total: 0 };
  });

  playerMatches.forEach(m => {
    const onT1 = m.player1_id===pid || m.player1_partner_id===pid;
    const t1won = m.winner_id && (m.winner_id===m.player1_id || m.winner_id===m.player1_partner_id);
    const t2won = m.winner_id && (m.winner_id===m.player2_id || m.winner_id===m.player2_partner_id);
    const pidWon = m.winner_id && ((onT1&&t1won)||(!onT1&&t2won));
    const pidLost = m.winner_id && !pidWon;
    if (pidWon) wins++;
    else if (pidLost) losses++;

    const s = m.surface || 'hard';
    if (!surfaceStats[s]) surfaceStats[s] = { wins: 0, losses: 0, total: 0 };
    surfaceStats[s].total++;
    if (pidWon) surfaceStats[s].wins++;
    else if (pidLost) surfaceStats[s].losses++;

    const oppIds = onT1
      ? [m.player2_id, m.player2_partner_id].filter(Boolean)
      : [m.player1_id, m.player1_partner_id].filter(Boolean);
    oppIds.forEach(oppId => {
      if (!h2hMap[oppId]) return;
      h2hMap[oppId].total++;
      if (pidWon) h2hMap[oppId].wins++;
      else if (pidLost) h2hMap[oppId].losses++;
    });
  });

  const rank = data.standings.findIndex(s => s.id === pid) + 1;
  const standing = data.standings.find(s => s.id === pid) || { played: 0, wins: 0, losses: 0, points: 0 };
  const h2h = Object.values(h2hMap).filter(x => x.total > 0).sort((a,b) => b.total-a.total);

  res.render('league_player_stats', {
    user, uid, league: data.league, plan: data.plan, members: data.members,
    player, playerMatches, wins, losses,
    total: wins + losses + (playerMatches.length - wins - losses),
    played: playerMatches.length,
    winRate: playerMatches.length > 0 ? Math.round((wins / playerMatches.length) * 100) : 0,
    points: wins * 2, surfaceStats, h2h, rank, standing
  });
});

app.post('/leagues/:id/end', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const league = await get('SELECT * FROM leagues WHERE id=? AND created_by=?',[req.params.id,uid]);
  if (league) await run("UPDATE leagues SET status='ended' WHERE id=?",[league.id]);
  res.redirect(`/leagues/${req.params.id}`);
});

app.post('/leagues/:id/start', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const league = await get('SELECT * FROM leagues WHERE id=? AND created_by=?',[req.params.id,uid]);
  if (league && league.status==='draft') await run("UPDATE leagues SET status='active' WHERE id=?",[league.id]);
  res.redirect(`/leagues/${req.params.id}`);
});

app.post('/leagues/:id/pool-match', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const lid = parseInt(req.params.id);
  const data = await getLeagueData(lid, uid);
  if (!data || !data.isCreator) return res.redirect(`/leagues/${lid}`);
  const { team1_id, team2_id, winner_team_id, score, surface, venue, played_at } = req.body;
  const t1 = data.teams.find(t => t.id===parseInt(team1_id));
  const t2 = data.teams.find(t => t.id===parseInt(team2_id));
  if (!t1 || !t2 || !score) return res.redirect(`/leagues/${lid}#pools`);
  let resolvedWinner = null;
  if (winner_team_id) {
    const wt = data.teams.find(t => t.id===parseInt(winner_team_id));
    if (wt) resolvedWinner = wt.player1_id;
  }
  await run('INSERT INTO league_matches (league_id,player1_id,player2_id,player1_partner_id,player2_partner_id,winner_id,score,surface,match_type,played_at,venue) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [lid,t1.player1_id,t2.player1_id,t1.player2_id,t2.player2_id,resolvedWinner,score,surface||'grass','doubles',played_at||new Date().toISOString(),venue||null]);
  res.redirect(`/leagues/${lid}#pools`);
});

app.post('/leagues/:id/pool-schedule', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const lid = parseInt(req.params.id);
  const data = await getLeagueData(lid, uid);
  if (!data || !data.isCreator) return res.redirect(`/leagues/${lid}`);
  const { team1_id, team2_id, scheduled_at, venue, surface } = req.body;
  const t1 = data.teams.find(t => t.id===parseInt(team1_id));
  const t2 = data.teams.find(t => t.id===parseInt(team2_id));
  if (!t1 || !t2 || !scheduled_at) return res.redirect(`/leagues/${lid}#pools`);
  // Cancel any existing pending/accepted proposal between these two teams so there is only one active confirmed date per matchup
  await run(`UPDATE league_proposals SET status='cancelled' WHERE league_id=? AND status IN ('pending','accepted')
    AND ((proposer_id=? AND opponent_id=?) OR (proposer_id=? AND opponent_id=?))`,
    [lid, t1.player1_id, t2.player1_id, t2.player1_id, t1.player1_id]);
  // Create an already-accepted league_proposal so it shows in pool standings and calendar
  const pr = await run('INSERT INTO league_proposals (league_id,proposer_id,opponent_id,venue,surface,notes,status) VALUES (?,?,?,?,?,?,?)',
    [lid, t1.player1_id, t2.player1_id, venue||'', surface||'hard', '', 'pending']);
  const sl = await run('INSERT INTO league_proposal_slots (proposal_id,proposed_at,sort_order) VALUES (?,?,0)', [pr.lastID, scheduled_at]);
  await run('UPDATE league_proposals SET status=?,accepted_slot_id=? WHERE id=?', ['accepted', sl.lastID, pr.lastID]);
  res.redirect(`/leagues/${lid}#pools`);
});

// ── League Settings (SaaS) ────────────────────────────────────────────────
app.get('/leagues/:id/settings', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const data = await getLeagueData(parseInt(req.params.id), uid);
  if (!data || !data.isCreator) return res.redirect(`/leagues/${req.params.id}`);
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const invites = await all(`SELECT li.*,u.username as inviter FROM league_invites li JOIN users u ON li.invited_by=u.id WHERE li.league_id=? AND li.used=0 AND datetime(li.expires_at)>datetime('now') ORDER BY li.expires_at DESC`,[data.league.id]);
  res.render('league_settings',{user,uid,...data,LEAGUE_PLANS,error:null,success:null,invites,uploadResult:null});
});

app.post('/leagues/:id/settings', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const {name,description,enrollment} = req.body;
  const league = await get('SELECT * FROM leagues WHERE id=? AND created_by=?',[req.params.id,uid]);
  if (!league) return res.redirect('/leagues');
  if (name&&name.trim()) {
    await run('UPDATE leagues SET name=?,description=?,enrollment=? WHERE id=?',
      [name.trim(),description||'',enrollment||'open',league.id]);
  }
  const data = await getLeagueData(league.id, uid);
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const invites = await all(`SELECT li.*,u.username as inviter FROM league_invites li JOIN users u ON li.invited_by=u.id WHERE li.league_id=? AND li.used=0 AND datetime(li.expires_at)>datetime('now') ORDER BY li.expires_at DESC`,[league.id]);
  res.render('league_settings',{user,uid,...data,LEAGUE_PLANS,error:null,success:'Settings saved!',invites,uploadResult:null});
});

app.post('/leagues/:id/upgrade', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const {plan} = req.body;
  if (!LEAGUE_PLANS[plan]) return res.redirect(`/leagues/${req.params.id}/settings`);
  const league = await get('SELECT * FROM leagues WHERE id=? AND created_by=?',[req.params.id,uid]);
  if (!league) return res.redirect('/leagues');
  const data = await getLeagueData(league.id, uid);
  if (data && LEAGUE_PLANS[plan].playerLimit < data.members.length && LEAGUE_PLANS[plan].playerLimit !== 9999)
    return res.redirect(`/leagues/${league.id}/settings?err=limit`);
  await run('UPDATE leagues SET plan=? WHERE id=?',[plan,league.id]);
  await createNotification(uid,'info',`✅ League plan updated to ${LEAGUE_PLANS[plan].label}`,
    `${league.name} is now on the ${LEAGUE_PLANS[plan].label} plan.`,`/leagues/${league.id}`);
  const freshData = await getLeagueData(league.id, uid);
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const invitesUp = await all(`SELECT li.*,u.username as inviter FROM league_invites li JOIN users u ON li.invited_by=u.id WHERE li.league_id=? AND li.used=0 AND datetime(li.expires_at)>datetime('now') ORDER BY li.expires_at DESC`,[league.id]);
  res.render('league_settings',{user,uid,...freshData,LEAGUE_PLANS,error:null,success:`Upgraded to ${LEAGUE_PLANS[plan].label} plan!`,invites:invitesUp,uploadResult:null});
});

// ── League bulk player upload ─────────────────────────────────────────────
app.post('/leagues/:id/bulk-upload', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const data = await getLeagueData(parseInt(req.params.id), uid);
  if (!data || !data.isCreator) return res.redirect('/leagues');
  const user = await get('SELECT * FROM users WHERE id=?', [uid]);

  const reSettings = async (error, success=null, uploadResult=null) => {
    const fresh = await getLeagueData(data.league.id, uid);
    const invites = await all(`SELECT li.*,u.username as inviter FROM league_invites li JOIN users u ON li.invited_by=u.id WHERE li.league_id=? AND li.used=0 AND datetime(li.expires_at)>datetime('now') ORDER BY li.expires_at DESC`, [data.league.id]);
    return res.render('league_settings', { user, uid, ...fresh, LEAGUE_PLANS, error, success, invites, uploadResult: uploadResult||null });
  };

  const raw = (req.body.csv_data || '').trim();
  if (!raw) return reSettings('No data provided. Paste at least one email per line.');

  const plan = data.plan;
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let added = 0, created = 0, skipped = 0, errors = [];
  const details = [];

  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    const email = parts.find(p => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
    const name  = parts.find(p => p && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) || null;

    if (!email) { errors.push(`Skipped: "${line}" — no valid email found`); continue; }

    // Check plan limit before each addition
    const mc = await get('SELECT COUNT(*) as c FROM league_members WHERE league_id=?', [data.league.id]);
    if ((mc?.c||0) >= plan.playerLimit) {
      errors.push(`Limit reached (${plan.playerLimit} players on ${plan.label} plan). Remaining rows skipped.`);
      break;
    }

    let player = await get('SELECT id,username,full_name,email FROM users WHERE email=?', [email]);

    if (!player) {
      // Auto-create account for new player
      const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      let username = base;
      let suffix = 1;
      while (await get('SELECT id FROM users WHERE username=?', [username])) {
        username = `${base}${suffix++}`;
      }
      const fullName = name || username;
      const tempPassword = crypto.randomBytes(5).toString('hex'); // 10-char readable password
      const hash = await bcrypt.hash(tempPassword, 10);
      const nr = await run('INSERT INTO users (username,email,password,full_name,email_verified) VALUES (?,?,?,?,1)',
        [username, email, hash, fullName]);
      player = { id: nr.lastID, username, full_name: fullName, email };
      const loginUrl = `${req.protocol}://${req.get('host')}/login`;
      try {
        await notify.sendPlayerWelcomeEmail({ to: email, fullName, username, tempPassword, leagueName: data.league.name, loginUrl });
      } catch(e) {
        console.log(`[Bulk upload] New player ${username} / ${email} — temp password: ${tempPassword}`);
      }
      created++;
      details.push({ email, status: 'created', name: fullName });
    } else {
      const isMember = !!(await get('SELECT 1 FROM league_members WHERE league_id=? AND user_id=?', [data.league.id, player.id]));
      if (isMember) {
        skipped++;
        details.push({ email, status: 'already_enrolled', name: player.full_name||player.username });
        continue;
      }
      added++;
      details.push({ email, status: 'added', name: player.full_name||player.username });
    }

    await run('INSERT OR IGNORE INTO league_members (league_id,user_id) VALUES (?,?)', [data.league.id, player.id]);
    await createNotification(player.id, 'info', `🏅 Added to ${data.league.name}`,
      `${req.session.username} enrolled you in ${data.league.name}.`, `/leagues/${data.league.id}`);
  }

  const summary = [
    added   > 0 ? `${added} added`   : null,
    created > 0 ? `${created} created` : null,
    skipped > 0 ? `${skipped} skipped` : null
  ].filter(Boolean).join(', ');
  return reSettings(errors.length ? errors.join(' | ') : null,
    `Upload complete: ${summary}.`,
    { added, created, skipped, errors, details });
});

app.post('/leagues/:id/invite', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const {email} = req.body;
  const data = await getLeagueData(parseInt(req.params.id), uid);
  if (!data || !data.isCreator) return res.redirect('/leagues');
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const reSettings = async (error, success=null) => {
    const fresh = await getLeagueData(data.league.id, uid);
    const invites = await all(`SELECT li.*,u.username as inviter FROM league_invites li JOIN users u ON li.invited_by=u.id WHERE li.league_id=? AND li.used=0 AND datetime(li.expires_at)>datetime('now') ORDER BY li.expires_at DESC`,[data.league.id]);
    return res.render('league_settings',{user,uid,...fresh,LEAGUE_PLANS,error,success,invites,uploadResult:null});
  };
  if (!email||!email.trim()) return reSettings('Email address is required.');
  if (data.members.length >= data.plan.playerLimit) return reSettings('Player limit reached. Upgrade your plan to invite more players.');
  const existing = await get('SELECT id FROM users WHERE email=?',[email.trim()]);
  if (existing && data.members.some(m=>m.id===existing.id)) return reSettings('That player is already a member.');
  await run('DELETE FROM league_invites WHERE league_id=? AND email=?',[data.league.id,email.trim()]);
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now()+48*60*60*1000).toISOString();
  await run('INSERT INTO league_invites (league_id,email,token,invited_by,expires_at) VALUES (?,?,?,?,?)',
    [data.league.id,email.trim(),token,uid,expires]);
  const inviteUrl = `${req.protocol}://${req.get('host')}/league-invite/${token}`;
  try { await notify.sendLeagueInviteEmail({to:email.trim(), leagueName:data.league.name, inviterName:req.session.username, inviteUrl}); }
  catch(e) { console.log('[League invite] URL:', inviteUrl); }
  return reSettings(null, `Invite sent to ${email.trim()}`);
});

app.post('/leagues/:id/members/:uid/remove', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const league = await get('SELECT * FROM leagues WHERE id=? AND created_by=?',[req.params.id,uid]);
  if (!league) return res.redirect('/leagues');
  const targetId = parseInt(req.params.uid);
  if (targetId !== uid) await run('DELETE FROM league_members WHERE league_id=? AND user_id=?',[league.id,targetId]);
  res.redirect(`/leagues/${league.id}/settings`);
});

// ── League invite acceptance ───────────────────────────────────────────────
app.get('/league-invite/:token', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const invite = await get(`SELECT li.*,l.name as league_name,l.plan,l.category,l.id as league_id,u.username as inviter FROM league_invites li JOIN leagues l ON li.league_id=l.id JOIN users u ON li.invited_by=u.id WHERE li.token=? AND li.used=0 AND datetime(li.expires_at)>datetime('now')`,[req.params.token]);
  if (!invite) return res.render('league_invite_accept',{user,invite:null,error:'This invite link is invalid or has expired.',success:null,LEAGUE_PLANS});
  const already = await get('SELECT 1 FROM league_members WHERE league_id=? AND user_id=?',[invite.league_id,uid]);
  if (already) return res.redirect(`/leagues/${invite.league_id}`);
  res.render('league_invite_accept',{user,invite,error:null,success:null,LEAGUE_PLANS});
});

app.post('/league-invite/:token', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const invite = await get(`SELECT li.*,l.name as league_name,l.plan FROM league_invites li JOIN leagues l ON li.league_id=l.id WHERE li.token=? AND li.used=0 AND datetime(li.expires_at)>datetime('now')`,[req.params.token]);
  if (!invite) return res.redirect('/leagues');
  const mc = await get('SELECT COUNT(*) as c FROM league_members WHERE league_id=?',[invite.league_id]);
  const plan = LEAGUE_PLANS[invite.plan]||LEAGUE_PLANS.free;
  if ((mc?.c||0) >= plan.playerLimit) {
    const user = await get('SELECT * FROM users WHERE id=?',[uid]);
    return res.render('league_invite_accept',{user,invite,error:`This league has reached its player limit on the ${plan.label} plan.`,success:null,LEAGUE_PLANS});
  }
  try { await run('INSERT INTO league_members (league_id,user_id) VALUES (?,?)',[invite.league_id,uid]); } catch(e){}
  await run('UPDATE league_invites SET used=1 WHERE token=?',[req.params.token]);
  await createNotification(uid,'info',`🏅 Joined ${invite.league_name}`,
    `You are now enrolled in ${invite.league_name}.`,`/leagues/${invite.league_id}`);
  res.redirect(`/leagues/${invite.league_id}`);
});

// ── Clubs (SaaS) ──────────────────────────────────────────────────────────
function makeSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + crypto.randomBytes(2).toString('hex');
}
async function getClubData(clubId, uid) {
  const club = await get(`SELECT c.*,u.username as owner_name FROM clubs c JOIN users u ON c.created_by=u.id WHERE c.id=?`,[clubId]);
  if (!club) return null;
  const members = await all(`SELECT u.id,u.username,u.full_name,u.email,cm.role,cm.joined_at FROM club_members cm JOIN users u ON cm.user_id=u.id WHERE cm.club_id=? ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, cm.joined_at ASC`,[clubId]);
  const myRole = members.find(m=>m.id===uid)?.role||null;
  const plan = PLANS[club.plan]||PLANS.free;
  return {club, members, myRole, plan, isMember:!!myRole, isAdmin:myRole==='owner'||myRole==='admin', isOwner:myRole==='owner'};
}

app.get('/clubs', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const clubs = await all(`SELECT c.*,u.username as owner_name,(SELECT COUNT(*) FROM club_members WHERE club_id=c.id) as member_count,(SELECT role FROM club_members WHERE club_id=c.id AND user_id=?) as my_role FROM clubs c JOIN users u ON c.created_by=u.id ORDER BY c.created_at DESC`,[uid]);
  res.render('clubs',{user,clubs,uid,PLANS,error:null,success:null});
});

app.post('/clubs', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const {name,description} = req.body;
  const reRender = async (error) => {
    const user=await get('SELECT * FROM users WHERE id=?',[uid]);
    const clubs=await all(`SELECT c.*,u.username as owner_name,(SELECT COUNT(*) FROM club_members WHERE club_id=c.id) as member_count,(SELECT role FROM club_members WHERE club_id=c.id AND user_id=?) as my_role FROM clubs c JOIN users u ON c.created_by=u.id ORDER BY c.created_at DESC`,[uid]);
    return res.render('clubs',{user,clubs,uid,PLANS,error,success:null});
  };
  if (!name||!name.trim()) return reRender('Club name is required.');
  const slug = makeSlug(name.trim());
  const r = await run('INSERT INTO clubs (name,slug,description,created_by) VALUES (?,?,?,?)',[name.trim(),slug,description||'',uid]);
  await run('INSERT INTO club_members (club_id,user_id,role) VALUES (?,?,?)',[r.lastID,uid,'owner']);
  await createNotification(uid,'info','🏢 Club created',`Welcome to ${name.trim()}! Invite players from the club settings.`,`/clubs/${r.lastID}`);
  res.redirect(`/clubs/${r.lastID}`);
});

app.get('/clubs/:id', requireClubAccess, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const data = await getClubData(parseInt(req.params.id), uid);
  if (!data) return res.redirect('/clubs');
  const memberIds = data.members.map(m=>m.id);
  const idList = memberIds.length ? memberIds.join(',') : '0';
  const activity = await all(`SELECT m.*,u1.username as p1name,u2.username as p2name,uw.username as winnername FROM matches m JOIN users u1 ON m.player1_id=u1.id JOIN users u2 ON m.player2_id=u2.id LEFT JOIN users uw ON m.winner_id=uw.id WHERE m.player1_id IN (${idList}) OR m.player2_id IN (${idList}) ORDER BY m.played_at DESC LIMIT 10`);
  const stats = { matches: activity.length, members: data.members.length };
  res.render('club_dashboard',{user,uid,...data,activity,stats});
});

app.get('/clubs/:id/settings', requireClubAdmin, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const data = await getClubData(parseInt(req.params.id), uid);
  if (!data) return res.redirect('/clubs');
  const invites = await all(`SELECT ci.*,u.username as inviter FROM club_invites ci JOIN users u ON ci.invited_by=u.id WHERE ci.club_id=? AND ci.used=0 AND datetime(ci.expires_at)>datetime('now') ORDER BY ci.expires_at DESC`,[data.club.id]);
  res.render('club_settings',{user,uid,...data,invites,PLANS,error:null,success:null});
});

app.post('/clubs/:id/settings', requireClubAdmin, async (req,res) => {
  const {name,description} = req.body;
  if (name&&name.trim()) await run('UPDATE clubs SET name=?,description=? WHERE id=?',[name.trim(),description||'',req.params.id]);
  res.redirect(`/clubs/${req.params.id}/settings`);
});

app.post('/clubs/:id/upgrade', requireClubAdmin, async (req,res) => {
  const {plan} = req.body;
  if (!PLANS[plan]) return res.redirect(`/clubs/${req.params.id}/settings`);
  const data = await getClubData(parseInt(req.params.id), req.session.userId);
  if (data && PLANS[plan].memberLimit < data.members.length) return res.redirect(`/clubs/${req.params.id}/settings?err=limit`);
  await run('UPDATE clubs SET plan=? WHERE id=?',[plan,req.params.id]);
  await createNotification(req.session.userId,'info',`✅ Plan updated to ${PLANS[plan].label}`,`Your club is now on the ${PLANS[plan].label} plan.`,`/clubs/${req.params.id}`);
  res.redirect(`/clubs/${req.params.id}/settings`);
});

app.post('/clubs/:id/invite', requireClubAdmin, async (req,res) => {
  const uid = req.session.userId;
  const {email} = req.body;
  const data = await getClubData(parseInt(req.params.id), uid);
  if (!data) return res.redirect('/clubs');
  const reSettings = async (error, success=null) => {
    const user=await get('SELECT * FROM users WHERE id=?',[uid]);
    const invites=await all(`SELECT ci.*,u.username as inviter FROM club_invites ci JOIN users u ON ci.invited_by=u.id WHERE ci.club_id=? AND ci.used=0 AND datetime(ci.expires_at)>datetime('now') ORDER BY ci.expires_at DESC`,[data.club.id]);
    return res.render('club_settings',{user,uid,...data,invites,PLANS,error,success});
  };
  if (!email||!email.trim()) return reSettings('Email address is required.');
  if (data.members.length >= (PLANS[data.club.plan]||PLANS.free).memberLimit) return reSettings('Member limit reached for your plan. Upgrade to invite more players.');
  const existing = await get('SELECT id FROM users WHERE email=?',[email.trim()]);
  if (existing && data.members.some(m=>m.id===existing.id)) return reSettings('That player is already a member.');
  await run('DELETE FROM club_invites WHERE club_id=? AND email=?',[data.club.id,email.trim()]);
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now()+48*60*60*1000).toISOString();
  await run('INSERT INTO club_invites (club_id,email,token,invited_by,expires_at) VALUES (?,?,?,?,?)',[data.club.id,email.trim(),token,uid,expires]);
  const inviteUrl = `${req.protocol}://${req.get('host')}/invite/${token}`;
  try { await notify.sendClubInviteEmail({to:email.trim(), clubName:data.club.name, inviterName:req.session.username, inviteUrl}); }
  catch(e) { console.log('[Club invite] URL:', inviteUrl); }
  return reSettings(null,`Invite sent to ${email.trim()}`);
});

app.post('/clubs/:id/members/:uid/remove', requireClubAdmin, async (req,res) => {
  const targetId = parseInt(req.params.uid);
  const target = await get('SELECT * FROM club_members WHERE club_id=? AND user_id=?',[req.params.id,targetId]);
  if (target && target.role!=='owner') await run('DELETE FROM club_members WHERE club_id=? AND user_id=?',[req.params.id,targetId]);
  res.redirect(`/clubs/${req.params.id}/settings`);
});

app.post('/clubs/:id/members/:uid/promote', requireClubAdmin, async (req,res) => {
  const target = await get('SELECT * FROM club_members WHERE club_id=? AND user_id=?',[req.params.id,req.params.uid]);
  if (target && target.role==='member') await run(`UPDATE club_members SET role='admin' WHERE club_id=? AND user_id=?`,[req.params.id,req.params.uid]);
  res.redirect(`/clubs/${req.params.id}/settings`);
});

app.post('/clubs/:id/members/:uid/demote', requireClubAdmin, async (req,res) => {
  const target = await get('SELECT * FROM club_members WHERE club_id=? AND user_id=?',[req.params.id,req.params.uid]);
  if (target && target.role==='admin') await run(`UPDATE club_members SET role='member' WHERE club_id=? AND user_id=?`,[req.params.id,req.params.uid]);
  res.redirect(`/clubs/${req.params.id}/settings`);
});

// ── Club invite acceptance ─────────────────────────────────────────────────
app.get('/invite/:token', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const user = await get('SELECT * FROM users WHERE id=?',[uid]);
  const invite = await get(`SELECT ci.*,c.name as club_name,c.plan,c.id as club_id,u.username as inviter FROM club_invites ci JOIN clubs c ON ci.club_id=c.id JOIN users u ON ci.invited_by=u.id WHERE ci.token=? AND ci.used=0 AND datetime(ci.expires_at)>datetime('now')`,[req.params.token]);
  if (!invite) return res.render('club_invite_accept',{user,invite:null,error:'This invite link is invalid or has expired.',success:null});
  const already = await get('SELECT 1 FROM club_members WHERE club_id=? AND user_id=?',[invite.club_id,uid]);
  if (already) return res.redirect(`/clubs/${invite.club_id}`);
  res.render('club_invite_accept',{user,invite,error:null,success:null});
});

app.post('/invite/:token', requireAuth, async (req,res) => {
  const uid = req.session.userId;
  const invite = await get(`SELECT ci.*,c.name as club_name,c.plan FROM club_invites ci JOIN clubs c ON ci.club_id=c.id WHERE ci.token=? AND ci.used=0 AND datetime(ci.expires_at)>datetime('now')`,[req.params.token]);
  if (!invite) return res.redirect('/clubs');
  const memberCount = await get('SELECT COUNT(*) as c FROM club_members WHERE club_id=?',[invite.club_id]);
  const plan = PLANS[invite.plan]||PLANS.free;
  if ((memberCount?.c||0) >= plan.memberLimit) {
    const user=await get('SELECT * FROM users WHERE id=?',[uid]);
    return res.render('club_invite_accept',{user,invite,error:`This club has reached its member limit (${plan.memberLimit} on the ${plan.label} plan). Ask the club owner to upgrade.`,success:null});
  }
  try { await run('INSERT INTO club_members (club_id,user_id,role) VALUES (?,?,?)',[invite.club_id,uid,'member']); } catch(e){}
  await run('UPDATE club_invites SET used=1 WHERE token=?',[req.params.token]);
  await createNotification(uid,'info',`🏢 Joined ${invite.club_name}`,`You are now a member of ${invite.club_name}.`,`/clubs/${invite.club_id}`);
  res.redirect(`/clubs/${invite.club_id}`);
});

app.listen(cfg.PORT, () => console.log(`🎾 TennisTrack running at http://localhost:${cfg.PORT}`));
