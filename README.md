# TennisTrack

A full-featured tennis club management web app built with Node.js, Express, SQLite, and EJS. Tracks matches, manages leagues, schedules games, and sends real-time notifications — all in a clean green-themed responsive UI.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Setup & Installation](#setup--installation)
- [Configuration](#configuration)
- [Pages & Routes](#pages--routes)
- [Email & Notifications](#email--notifications)
- [Leagues](#leagues)
- [Admin Panel](#admin-panel)
- [Production Deployment](#production-deployment)

---

## Features

### Authentication
| Feature | Details |
|---|---|
| Register | Username, email, password (bcrypt hashed), full name, phone |
| Login | Accepts username **or** email |
| Forgot Password | Sends a secure reset link via email (1-hour expiry, single-use token) |
| Reset Password | Token-validated form; token deleted after use |
| Sessions | 7-day persistent session via express-session |
| First user auto-admin | The very first registered account gets admin rights automatically |

### Dashboard
- **Stats cards** — total matches, wins, losses, win rate
- **Win/Loss doughnut chart** — visual split of results (Chart.js)
- **Monthly activity bar chart** — wins vs played for last 6 months
- **Surface performance chart** — horizontal bar showing wins/losses per surface (hard, clay, grass, indoor)
- **Upcoming matches** — next 3 scheduled matches at a glance
- **Recent matches** — last 5 with outcome badges
- **Head-to-head bars** — win % vs top opponents
- **Recent notifications** — last 3 alerts

### Match History
- Paginated list (10 per page)
- Filter by surface and result (win / loss)
- Click any match for full detail view
- Match detail shows: score, surface, format, match type (singles/doubles), notes, and quick Compare link

### Log Match
- Select opponent, enter score, pick surface, format, match type
- **Match types**: Singles or Doubles
- Set winner or mark as no result
- Optional date override and notes
- Notifies opponent via in-app notification

### Match Types
- **Singles** — 1 vs 1
- **Doubles** — 2 vs 2; partner + 2 opponents selected at log time

### Schedule
- Pick opponent (singles) or full team of 4 (doubles)
- **Singles/Doubles toggle** — switches form between single opponent and three partner selectors
- Set date/time, venue, surface, format
- Email + SMS + WhatsApp notifications sent to all players on scheduling
- Automatic **1-hour reminder** via CRON (email + SMS/WhatsApp + in-app)
- Any team member can cancel a scheduled match

### Leagues
Full competition management for five categories:

| Category | Icon | Match type auto-set |
|---|---|---|
| Men's Singles | 👨 | Singles (locked) |
| Men's Doubles | 👬 | Doubles (locked) |
| Women's Singles | 👩 | Singles (locked) |
| Women's Doubles | 👭 | Doubles (locked) |
| Mixed Doubles | 👫 | Doubles (locked) |
| Open | 🎾 | User chooses |

- **Create** a league (name, category, format, description)
- **Format**: Round Robin or Knockout
- **Browse** by category with filter tabs
- **Join / Leave** any active league
- **Standings table** — auto-calculated: 2 pts per win, both partners credited in doubles
- **Log match** within a league:
  - Singles: one opponent selector
  - Doubles: Your partner + Opponent 1 + Opponent 2
  - Winner: individual name (singles) or "My team / Opponent team" (doubles)
- **Match history** — shows team pairs for doubles (e.g. "Alice & Bob vs Carol & Dave")
- **End league** — creator only; locks the league from new matches

### Notifications
- In-app notification center with unread badge in sidebar
- Types: welcome, match logged, match scheduled, match reminder, match cancelled, alert
- Mark all read on open; bulk clear all
- Real-time unread count injected into every page

### Compare
- Head-to-head record vs any opponent you've played
- Overall W/L/total + win % per surface (hard, clay, grass, indoor)
- Full match-by-match history sorted by date

### Profile
- Update full name, email, phone
- Change password (requires re-entry of new password; bcrypt re-hashed)
- Toggle WhatsApp notifications on/off

### Admin Panel
- View all users, matches, and scheduled matches
- Toggle admin role for any user
- Delete users
- Delete matches
- Cancel scheduled matches

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Web framework | Express 4 |
| Templating | EJS |
| Database | SQLite 3 (file-based, zero config) |
| Auth | bcryptjs + express-session |
| Email | Nodemailer (SMTP — works with Gmail App Passwords) |
| SMS / WhatsApp | Twilio |
| Charts | Chart.js 4 (CDN, no install) |
| Scheduling | node-cron |
| Styling | Custom CSS (green theme, CSS variables, responsive grid) |

---

## Project Structure

```
tennis-app-v3-final/
├── server.js              # Main app — routes, auth, DB, CRON
├── config.js              # SMTP, Twilio, session secret, port
├── notifications.js       # Email / SMS / WhatsApp helpers
├── package.json
├── tennis.db              # SQLite database (auto-created)
├── public/
│   └── css/
│       └── style.css      # All styles (green theme)
└── views/
    ├── layout_top.ejs         # Sidebar + topbar shell (open)
    ├── layout_bottom.ejs      # Shell close + JS
    ├── login.ejs
    ├── register.ejs
    ├── forgot_password.ejs
    ├── reset_password.ejs
    ├── dashboard.ejs          # Stats + Chart.js charts
    ├── matches.ejs            # Paginated match history
    ├── match_new.ejs          # Log match form
    ├── match_detail.ejs       # Single match detail
    ├── schedule.ejs           # Schedule + doubles form
    ├── compare.ejs            # Head-to-head comparison
    ├── leagues.ejs            # League list + create form
    ├── league_detail.ejs      # League detail, standings, log match
    ├── notifications.ejs      # Notification center
    ├── profile.ejs            # User profile settings
    └── admin.ejs              # Admin control panel
```

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | auto-increment |
| username | TEXT UNIQUE | |
| email | TEXT UNIQUE | |
| password | TEXT | bcrypt hash |
| full_name | TEXT | |
| phone | TEXT | E.164 format, e.g. +1234567890 |
| whatsapp_enabled | INTEGER | 0 or 1 |
| is_admin | INTEGER | 0 or 1; first user auto-set to 1 |
| created_at | DATETIME | |

### `matches`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| player1_id | INTEGER FK | |
| player2_id | INTEGER FK | |
| winner_id | INTEGER FK | nullable |
| score | TEXT | e.g. "6-3, 7-5" |
| format | TEXT | best_of_3 / best_of_5 / best_of_1 / practice |
| surface | TEXT | hard / clay / grass / indoor |
| match_type | TEXT | singles / doubles |
| notes | TEXT | |
| played_at | DATETIME | |

### `scheduled_matches`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| player1_id | INTEGER FK | team 1 captain |
| player1_partner_id | INTEGER FK | nullable; doubles only |
| player2_id | INTEGER FK | team 2 captain |
| player2_partner_id | INTEGER FK | nullable; doubles only |
| match_type | TEXT | singles / doubles |
| scheduled_at | DATETIME | |
| venue | TEXT | |
| surface | TEXT | |
| format | TEXT | |
| notes | TEXT | |
| status | TEXT | scheduled / cancelled |
| reminder_sent | INTEGER | 0 or 1 |
| created_by | INTEGER FK | |
| created_at | DATETIME | |

### `leagues`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| description | TEXT | |
| format | TEXT | round_robin / knockout |
| category | TEXT | mens_singles / mens_doubles / womens_singles / womens_doubles / mixed_doubles / open |
| status | TEXT | active / ended |
| created_by | INTEGER FK | |
| created_at | DATETIME | |

### `league_members`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| league_id | INTEGER FK | |
| user_id | INTEGER FK | |
| joined_at | DATETIME | |
| — | UNIQUE | (league_id, user_id) |

### `league_matches`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| league_id | INTEGER FK | |
| player1_id | INTEGER FK | team 1 captain |
| player1_partner_id | INTEGER FK | nullable |
| player2_id | INTEGER FK | team 2 captain |
| player2_partner_id | INTEGER FK | nullable |
| winner_id | INTEGER FK | team captain of winning side; nullable |
| score | TEXT | |
| surface | TEXT | |
| match_type | TEXT | singles / doubles |
| played_at | DATETIME | |

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| user_id | INTEGER FK | |
| type | TEXT | welcome / match / schedule / reminder / alert / info |
| title | TEXT | |
| message | TEXT | |
| link | TEXT | |
| is_read | INTEGER | 0 or 1 |
| created_at | DATETIME | |

### `password_reset_tokens`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| user_id | INTEGER FK | |
| token | TEXT UNIQUE | 64-char random hex |
| expires_at | DATETIME | 1 hour from creation |

---

## Setup & Installation

```bash
# 1. Clone / download the project
cd tennis-app-v3-final

# 2. Install dependencies
npm install

# 3. Configure credentials (see Configuration section below)
# Edit config.js

# 4. Start the server
npm start

# For auto-reload during development:
npx nodemon server.js

# 5. Open in browser
# http://localhost:3000
```

The SQLite database (`tennis.db`) is created automatically on first run. All table migrations run on every startup and are safely no-ops if the schema already exists.

---

## Configuration

Edit **`config.js`** before running in production:

```js
module.exports = {
  SESSION_SECRET: 'change-this-to-a-random-secret',
  PORT: process.env.PORT || 3000,

  EMAIL: {
    enabled: true,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'your_gmail@gmail.com',       // Your Gmail address
    pass: 'your_16_char_app_password',  // Gmail App Password (not login password)
    from: '"TennisTrack" <your_gmail@gmail.com>',
  },

  TWILIO: {
    enabled: false,                     // Set true to enable SMS/WhatsApp
    accountSid: 'ACxxxxxxxxxxxxxxxx',
    authToken:  'your_auth_token',
    fromSms:    '+15017122661',         // Your Twilio phone number
    fromWhatsApp: 'whatsapp:+14155238886',
  },
};
```

### Gmail App Password setup
1. Enable 2-Step Verification on your Google account
2. Go to **myaccount.google.com → Security → App passwords**
3. Create a password for "Mail"
4. Paste the 16-character password into `config.js`

### Password reset dev fallback
If email credentials are not set up, the reset URL is printed to the **server console** so you can still test the full flow during development.

---

## Pages & Routes

### Public (no login required)
| Method | Route | Description |
|---|---|---|
| GET | `/login` | Sign-in page |
| POST | `/login` | Authenticate user |
| GET | `/register` | Registration page |
| POST | `/register` | Create account |
| GET | `/forgot-password` | Request password reset |
| POST | `/forgot-password` | Send reset email |
| GET | `/reset-password/:token` | Reset form (token validated) |
| POST | `/reset-password/:token` | Save new password |
| GET | `/logout` | Destroy session |

### Authenticated
| Method | Route | Description |
|---|---|---|
| GET | `/dashboard` | Stats, charts, recent activity |
| GET | `/matches` | Paginated match history |
| GET | `/matches/new` | Log match form |
| POST | `/matches/new` | Save match |
| GET | `/matches/:id` | Match detail |
| GET | `/schedule` | View & create scheduled matches |
| POST | `/schedule/new` | Schedule a match |
| POST | `/schedule/:id/cancel` | Cancel a scheduled match |
| GET | `/compare` | Head-to-head comparison |
| GET | `/leagues` | League list (filterable by category) |
| POST | `/leagues` | Create a league |
| GET | `/leagues/:id` | League detail + standings |
| POST | `/leagues/:id/join` | Join a league |
| POST | `/leagues/:id/leave` | Leave a league |
| POST | `/leagues/:id/match` | Log a league match |
| POST | `/leagues/:id/end` | End a league (creator only) |
| GET | `/notifications` | Notification center |
| POST | `/notifications/clear` | Delete all notifications |
| GET | `/notifications/count` | JSON unread count (polling) |
| GET | `/profile` | Profile settings |
| POST | `/profile` | Save profile changes |

### Admin only
| Method | Route | Description |
|---|---|---|
| GET | `/admin` | Admin panel |
| POST | `/admin/users/:id/toggle-admin` | Toggle admin role |
| POST | `/admin/users/:id/delete` | Delete user |
| POST | `/matches/:id/delete` | Delete any match |
| POST | `/admin/schedule/:id/cancel` | Cancel any scheduled match |

---

## Email & Notifications

Three delivery channels are supported, all configured in `config.js`:

| Channel | Trigger | Config key |
|---|---|---|
| In-app | Every event | Always on |
| Email (SMTP) | Schedule, reminder, cancel, password reset | `EMAIL.enabled` |
| SMS | Schedule, reminder, cancel | `TWILIO.enabled` |
| WhatsApp | Schedule, reminder, cancel | `TWILIO.enabled` + user opt-in |

**CRON job** runs every minute and sends reminders to all players (including doubles partners) when a match is within 61 minutes of starting. `reminder_sent` flag prevents duplicate sends.

---

## Leagues

### How standings work
- **Round Robin**: each win = 2 points. Sorted by points → wins.
- **Doubles**: both partners on the winning team receive credit (standings count all matches where you appear as player or partner).
- **Knockout**: matches are logged manually; standings reflect cumulative points the same way.

### Category and match type
When a league has a typed category (e.g. Men's Doubles), the match type is **locked automatically** — you cannot log a singles match in a doubles league. For "Open" leagues the player chooses at log time.

### Doubles team selection in league matches
When logging a match in a doubles league:
1. **Your partner** — picked from league members
2. **Opponent 1** — team 2 captain
3. **Opponent 2** — team 2 partner
4. **Winner** — "My team won" or "Opponent team won" (server maps this to a captain ID)

---

## Admin Panel

The first registered user is automatically made admin. Admins can:
- See all users, all matches, all scheduled matches
- Promote / demote any user to admin
- Delete any user (cascades in UI; DB rows remain with NULL FK references)
- Delete any match
- Cancel any scheduled match

To grant admin to an existing user manually, update the DB:
```sql
UPDATE users SET is_admin = 1 WHERE username = 'your_username';
```

---

## Production Deployment

```bash
# Set environment variables
export PORT=8080
export NODE_ENV=production

# Use a process manager
npm install -g pm2
pm2 start server.js --name tennistrack
pm2 save
pm2 startup
```

**Nginx reverse proxy (recommended):**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Checklist before going live:**
- [ ] Set a strong `SESSION_SECRET` in `config.js`
- [ ] Fill in real SMTP credentials (Gmail App Password or SendGrid)
- [ ] Set `TWILIO.enabled: false` if SMS/WhatsApp are not needed
- [ ] Set up HTTPS (Let's Encrypt via Certbot)
- [ ] Schedule regular backups of `tennis.db`
- [ ] Set `PORT` via environment variable rather than hardcoding
