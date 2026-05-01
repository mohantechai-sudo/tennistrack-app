# TennisTrack — Project Reference

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + Express 4 |
| Database | SQLite3 (promise-wrapped, single file) |
| Templates | EJS (server-rendered) |
| Auth | express-session (7-day cookie), bcryptjs |
| Email | Nodemailer (Microsoft 365 SMTP) |
| SMS/WhatsApp | Twilio |
| Charts | Chart.js 4 (CDN) |
| Scheduling | node-cron |

**Entry point:** `server.js` — all routes, DB schema creation, middleware, and CRON jobs live here.

---

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | All routes, DB init, middleware, CRON |
| `notifications.js` | Email / SMS / WhatsApp helper functions |
| `config.js` | SMTP, Twilio, session secret (read from env vars) |
| `.env` | Local environment variables (not committed — loaded by `dotenv`) |
| `views/` | EJS templates |
| `public/css/style.css` | Main stylesheet (Wimbledon green palette) |

---

## Environment Variables (config.js)

| Variable | Purpose | Default |
|----------|---------|---------|
| `SESSION_SECRET` | Express session secret | `tennis-secret-2024-change-me` |
| `PORT` | Server port | `3000` |
| `EMAIL_USER` | M365 mailbox address (enables email + verification when set with `EMAIL_PASS`) | — |
| `EMAIL_PASS` | M365 password or app password | — |
| `EMAIL_HOST` | SMTP host | `smtp.office365.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_FROM` | Sender display name + address | `TennisTrack <EMAIL_USER>` |
| `TWILIO_SID` | Twilio account SID | — (disables SMS if unset) |
| `TWILIO_TOKEN` | Twilio auth token | — |
| `TWILIO_FROM_SMS` | Twilio SMS sender number | — |
| `TWILIO_FROM_WHATSAPP` | Twilio WhatsApp sender | `whatsapp:+14155238886` |

Email is **enabled** only when both `EMAIL_USER` and `EMAIL_PASS` are set. When enabled, account verification is required for all new non-admin registrations. STARTTLS on port 587; `secure: false`.

Credentials are loaded from a `.env` file in the project root via `dotenv` (`require('dotenv').config()` is the first line of `server.js`). Never commit `.env` — ensure it is listed in `.gitignore`.

---

## Middleware

| Middleware | Effect |
|------------|--------|
| `requireAuth` | Checks `req.session.userId`; redirects to `/login` if absent |
| `requireAdmin` | Requires `is_admin=1` on user record |
| `requireClubAccess` | User must exist in `club_members` for the club |
| `requireClubAdmin` | User's `club_members.role` must be `owner` or `admin` |

---

## Database Schema

### users
```
id, username (UNIQUE), email (UNIQUE), password (bcrypt),
full_name, phone, whatsapp_enabled (0/1), is_admin (0/1),
email_verified (0/1, DEFAULT 1 for existing rows), created_at
```

### matches
```
id, player1_id, player2_id, winner_id (nullable),
score, format (best_of_3), surface (hard), match_type (singles),
notes, played_at
```

### scheduled_matches
```
id, player1_id, player2_id,
player1_partner_id (nullable), player2_partner_id (nullable),
scheduled_at, venue, surface, format, match_type,
notes, status (scheduled/cancelled), reminder_sent (0/1),
created_by, created_at
```

### match_proposals
```
id, proposer_id, opponent_id,
player1_partner_id (nullable), player2_partner_id (nullable),
match_type (singles/doubles), venue, surface (hard), format (best_of_3),
notes, status (pending/accepted/declined/cancelled), created_at
```
Used by the personal Schedule page "Propose Slots" tab.

### match_proposal_slots
```
id, proposal_id, proposed_at DATETIME, sort_order
```
Multiple datetime options per match_proposal. Opponent picks one to accept.

### notifications
```
id, user_id, type (welcome/match/schedule/reminder/alert/info),
title, message, link, is_read (0/1), created_at
```

### password_reset_tokens
```
id, user_id, token (UNIQUE, 64-char hex), expires_at (1 hour)
```

### email_verification_tokens
```
id, user_id, token (UNIQUE, 64-char hex), expires_at (24 hours)
```
One active token per user. Replaced on each resend request.

### leagues
```
id, name, description, format (round_robin),
plan (free/pro/premium), status (draft/active/ended),
enrollment (open/invite_only/closed),
category (open/mens_singles/womens_singles/mixed_singles/
           mens_doubles/womens_doubles/mixed_doubles),
created_by, created_at
```
New leagues default to `status='draft'`. Creator must click "Start League" to go active.

### league_members
```
id, league_id, user_id, joined_at
UNIQUE(league_id, user_id)
```

### league_matches
```
id, league_id, player1_id, player2_id,
player1_partner_id (nullable), player2_partner_id (nullable),
winner_id (nullable), score, surface, match_type, venue, played_at
```

### league_teams
```
id, league_id, name, color (HEX, #1d4ed8),
player1_id, player2_id, created_by, created_at
```

### league_pools
```
id, league_id, name, color (HEX), sort_order, created_by, created_at
```

### league_pool_members
```
id, pool_id, league_id, user_id
UNIQUE(pool_id, user_id)
```

### league_invites
```
id, league_id, email, token (UNIQUE, 48-char hex),
invited_by, expires_at (48 hours), used (0/1)
```

### league_proposals
```
id, league_id, proposer_id, opponent_id,
venue, surface (hard), notes,
status (pending/accepted/declined/cancelled),
accepted_slot_id (nullable — FK to league_proposal_slots),
created_at
```
League-specific match proposals. When accepted, the accepted slot's `proposed_at` becomes the confirmed match time displayed in pool standings.

### league_proposal_slots
```
id, proposal_id, proposed_at DATETIME, sort_order
```
Multiple datetime options per league_proposal.

### clubs
```
id, name, slug (UNIQUE, kebab-XXXX format),
description, plan (free/pro/premium), created_by, created_at
```

### club_members
```
id, club_id, user_id, role (member/admin/owner), joined_at
UNIQUE(club_id, user_id)
```

### club_invites
```
id, club_id, email, token (UNIQUE, 48-char hex),
invited_by, expires_at (48 hours), used (0/1)
```

---

## Plan Tiers

### League Plans (LEAGUE_PLANS)
| Plan | Price | Player Limit | Key Features |
|------|-------|-------------|--------------|
| free | $0 | 8 | Open enrollment, match tracking, basic standings |
| pro | $5/mo | 24 | Invite-only mode, email invites, advanced analytics |
| premium | $15/mo | unlimited | All enrollment modes, email invites, priority support |

### Club Plans (PLANS)
| Plan | Price | Member Limit | Key Features |
|------|-------|-------------|--------------|
| free | $0 | 10 | Match tracking, basic stats |
| pro | $9/mo | 50 | Email notifications, advanced analytics, schedule reminders |
| premium | $29/mo | unlimited | SMS & WhatsApp alerts, priority support, custom branding |

Plan limit is enforced at invite acceptance and join time. Upgrade path: free → pro → premium only.

---

## Routes

### Auth (`/`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Redirect to `/dashboard` or `/login` |
| GET/POST | `/register` | Sign up (first user auto-becomes admin; others redirected to verify-pending when email enabled) |
| GET/POST | `/login` | Log in; blocks unverified users with resend option |
| GET | `/logout` | Destroy session |
| GET/POST | `/forgot-password` | Send password reset email (1-hour token) |
| GET/POST | `/reset-password/:token` | Complete password reset |
| GET | `/verify-pending` | "Check your inbox" page shown after registration; accepts `?email=` and `?resent=1` |
| GET | `/verify-email/:token` | Verifies 24-hour token → sets `email_verified=1` → shows success/error page |
| POST | `/resend-verification` | Deletes old token, issues fresh 24-hour token, resends verification email |

### Dashboard & Profile
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/dashboard` | Stats, recent matches, upcoming matches, 6-month charts, notifications |
| GET/POST | `/profile` | View/update full_name, email, phone, password, WhatsApp toggle |

### Matches (Personal)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/matches` | Paginated list (10/page); filter by surface & result |
| GET/POST | `/matches/new` | Log a match (singles/doubles, score, surface, format, notes) |
| GET | `/matches/:id` | Match detail |
| POST | `/matches/:id/delete` | Admin-only deletion |

### Schedule & Proposals (Personal)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/schedule` | Two-tab page: scheduled matches + sent/incoming proposals |
| POST | `/schedule/new` | Create scheduled match (singles or doubles with partner IDs) |
| POST | `/schedule/:id/cancel` | Cancel scheduled match |
| POST | `/proposals/new` | Create match proposal with up to 4 datetime slots; notifies opponent |
| POST | `/proposals/:id/accept` | Opponent accepts a slot → creates a `scheduled_match`; notifies proposer |
| POST | `/proposals/:id/decline` | Opponent declines; notifies proposer |
| POST | `/proposals/:id/cancel` | Proposer withdraws pending proposal; notifies opponent |

### Notifications
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/notifications` | All user notifications |
| POST | `/notifications/clear` | Mark notification as read/clear |
| GET | `/notifications/count` | Unread count (used in nav badge) |

### Compare
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/compare?opponent=:id` | Head-to-head personal stats vs selected opponent |

### Admin Panel
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/admin` | All users, matches, scheduled matches |
| POST | `/admin/users/:id/edit` | Edit user full_name, email, phone |
| POST | `/admin/users/:id/toggle-admin` | Toggle is_admin |
| POST | `/admin/users/:id/delete` | Delete user |
| POST | `/admin/matches/:id/edit` | Edit score, winner, played_at |
| POST | `/admin/schedule/:id/cancel` | Cancel scheduled match |

### Leagues
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/leagues` | List leagues with member/match counts and join status |
| POST | `/leagues` | Create league (creator auto-joins; status starts as `draft`) |
| GET | `/leagues/:id` | Detail: standings, matches, teams, pools, confirmed proposal dates; also passes `calProposals` for the inline calendar popup |
| GET | `/leagues/:id/dashboard` | Analytics: summary, charts, top performers, venues |
| GET | `/leagues/:id/calendar` | Rich monthly calendar: played matches, confirmed/pending proposals |
| GET/POST | `/leagues/:id/settings` | Creator-only: name, description, enrollment, plan upgrade, invites, bulk upload |
| POST | `/leagues/:id/join` | Join (checks enrollment mode + plan player limit) |
| POST | `/leagues/:id/leave` | Leave league |
| POST | `/leagues/:id/start` | Transition league from `draft` → `active` (creator-only) |
| POST | `/leagues/:id/end` | End league (creator-only, irreversible) |
| POST | `/leagues/:id/match` | Log league match (singles/doubles) — opens as modal on detail page |
| POST | `/leagues/:id/teams` | Create doubles team (name, color, player1_id, player2_id) |
| POST | `/leagues/:id/teams/:tid/delete` | Delete team (creator-only) |
| POST | `/leagues/:id/pools/save` | Save all pools as JSON; if `start_after_save=1` also transitions to active |
| POST | `/leagues/:id/pools/:pid/delete` | Delete a single pool |
| POST | `/leagues/:id/pool-match` | Log a scored match for a pool (team-based, from score modal) |
| POST | `/leagues/:id/pool-schedule` | Schedule a future pool match — creates an accepted `league_proposal` (not a `scheduled_match`) so the confirmed date shows in pool standings |
| GET | `/leagues/:id/player/:pid` | Player stats in league: rank, H2H vs members, surface breakdown |
| POST | `/leagues/:id/upgrade` | Upgrade league plan |
| POST | `/leagues/:id/bulk-upload` | CSV import: email[,name] per line; auto-creates accounts + sends welcome emails |
| POST | `/leagues/:id/invite` | Send 48-hour invite token via email |
| GET/POST | `/league-invite/:token` | Accept league invite |
| POST | `/leagues/:id/members/:uid/remove` | Remove member (creator-only) |
| POST | `/leagues/:id/proposals/new` | Create league match proposal with up to 4 slots; notifies opponent |
| POST | `/leagues/:id/proposals/:pid/accept` | Accept a slot → marks proposal accepted; notifies proposer |
| POST | `/leagues/:id/proposals/:pid/decline` | Decline proposal; notifies proposer |
| POST | `/leagues/:id/proposals/:pid/cancel` | Proposer cancels/withdraws; with `reschedule=1` body redirects to calendar with opponent pre-selected |

### Clubs
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/clubs` | List clubs with member counts and user's role |
| POST | `/clubs` | Create club (creator becomes owner; slug auto-generated) |
| GET | `/clubs/:id` | Club dashboard: activity feed (last 10 member matches) |
| GET/POST | `/clubs/:id/settings` | Admin/owner-only: name, description, plan, invites, member management |
| POST | `/clubs/:id/upgrade` | Upgrade club plan |
| POST | `/clubs/:id/invite` | Send 48-hour invite token via email |
| POST | `/clubs/:id/members/:uid/promote` | Promote member → admin |
| POST | `/clubs/:id/members/:uid/demote` | Demote admin → member |
| POST | `/clubs/:id/members/:uid/remove` | Remove member (cannot remove owner) |
| GET/POST | `/invite/:token` | Accept club invite |

---

## Server-side Helpers

| Function | Purpose |
|----------|---------|
| `getLeagueData(leagueId, uid)` | Fetches league, members, matches, standings, teamStandings, teams, pools, plan, invites; returns `isMember` and `isCreator` flags. Note: `pool.poolMembers` rows contain `{pool_id, id (= user_id from JOIN), username, full_name}` — `id` is the user ID, not the auto-increment PK. |
| `getLeagueProposals(leagueId, uid)` | Fetches all non-cancelled league_proposals for the user; returns `{ incoming, outgoing, accepted, all }` with slots pre-attached. Called from both the calendar route and `GET /leagues/:id` (as `calProposals`). |
| `getProposalsForUser(uid)` | Fetches personal match_proposals (schedule page); returns `{ incoming, outgoing }` with slots attached |
| `createNotification(userId, type, title, message, link)` | Inserts in-app notification row |
| `sendVerificationEmail({ to, username, verifyUrl })` | Sends verification email via Nodemailer (M365); logs URL to console if send fails |

---

## Views (EJS Templates)

| File | Page |
|------|------|
| `layout_top.ejs` | Nav/header partial |
| `layout_bottom.ejs` | Footer partial |
| `login.ejs` | Login form; shows yellow unverified-email warning with inline Resend button when `unverifiedEmail` is set |
| `register.ejs` | Registration form; includes phone field and verification notice |
| `verify_pending.ejs` | "Check your inbox" page after registration; shows resent confirmation banner; Resend button |
| `verify_email.ejs` | Verification result page — success (sign-in link) or expired/invalid error |
| `forgot_password.ejs` | Forgot password form |
| `reset_password.ejs` | Reset password (token) |
| `dashboard.ejs` | Main dashboard with charts |
| `profile.ejs` | User profile editor |
| `matches.ejs` | Match list (paginated, filterable) |
| `match_new.ejs` | Create match form |
| `match_detail.ejs` | Match detail view |
| `schedule.ejs` | Two-tab: Schedule a Match + Propose Slots; shows incoming/outgoing proposals |
| `compare.ejs` | Head-to-head stats |
| `notifications.ejs` | Notifications list |
| `leagues.ejs` | Leagues list + create form; status badge includes Draft |
| `league_detail.ejs` | 7-tab SPA: Overview · Dashboard (stat cards + match history) · Builder (kanban drag-and-drop pool builder with gradient avatar chips, always visible to creator) · Pools (standings + inline schedule/score) · Matches (Pool Fixtures first then Match History; 📅 opens `ldCalModal` popup · ✏️ opens `ldScoreModal` popup) · Calendar (monthly grid + proposals sidebar) · Players (member cards) |
| `league_dashboard.ejs` | League analytics dashboard |
| `league_calendar.ejs` | Rich monthly calendar: played matches + confirmed/pending proposals; New Proposal modal; event detail modal |
| `league_settings.ejs` | League settings (creator-only) |
| `league_invite_accept.ejs` | Accept league invite |
| `league_player_stats.ejs` | Player stats within a league |
| `clubs.ejs` | Clubs list + create form |
| `club_dashboard.ejs` | Club activity feed + stats |
| `club_settings.ejs` | Club settings (admin/owner-only) |
| `club_invite_accept.ejs` | Accept club invite |
| `admin.ejs` | Admin panel |

---

## Notification Channels

### In-App (DB)
Types: `welcome`, `match`, `schedule`, `reminder`, `alert`, `info`

All notifications store a `link` field pointing to the relevant page.

### Email (Nodemailer — Microsoft 365 SMTP)
Sent for: account verification, match scheduled, match reminder, match cancelled, password reset, club invite, league invite, bulk-upload welcome.
- Enabled when both `EMAIL_USER` and `EMAIL_PASS` are set.
- Verification emails logged to console (including verify URL) if send fails, so dev environments without email still work.

### SMS / WhatsApp (Twilio)
Sent for: match scheduled, match reminder, match cancelled.
- SMS: sent if user has `phone` set
- WhatsApp: only if `whatsapp_enabled=1` on the user record

---

## CRON Jobs

**Every minute (`* * * * *`)**
- Scans `scheduled_matches` where `status='scheduled'` and `reminder_sent=0`
- Matches where `scheduled_at` is 60–61 minutes from now get a reminder
- Sends email + SMS + WhatsApp to all players (including doubles partners)
- Sets `reminder_sent=1` and creates in-app notifications

---

## Feature Behaviour Notes

- **First user** to register is automatically made admin (`is_admin=1`).
- **Standings:** Win = 2 pts, Loss = 0 pts. Sorted by points → wins → name.
- **Team standings** (doubles leagues): computed dynamically from match data by grouping player partnerships; not stored.
- **Doubles leagues** (`mens_doubles`, `womens_doubles`, `mixed_doubles`): show team standings, team builder, team→pool drag & drop in pool builder.

### Email Verification
- Triggered on registration when `cfg.EMAIL.enabled` is `true` (both `EMAIL_USER` and `EMAIL_PASS` set).
- New user is inserted with `email_verified=0` and redirected to `/verify-pending`.
- A 24-hour token is stored in `email_verification_tokens`. Clicking the link sets `email_verified=1` and deletes the token.
- **Login blocks** unverified users — shows a yellow warning with the user's email and an inline **Resend** form (`POST /resend-verification`).
- **Resend** deletes the old token and issues a fresh 24-hour one (prevents enumeration: silently succeeds even for unknown emails).
- **Skips verification for**: first admin user, bulk-uploaded players (auto-set `email_verified=1`), and any install where email is not configured (users get `email_verified=1` at insert).
- All pre-existing accounts in the DB have `email_verified=1` via the migration `DEFAULT 1`.
- Verification URL is always logged to the server console so dev environments without SMTP can still test the flow manually.

### League Lifecycle (draft → active → ended)
- New leagues always start as `draft`. Creator builds teams and assigns them to pools using the drag-and-drop pool builder.
- **"Save & Start League"** button in the pool section saves pools and transitions to `active` in one POST (via `start_after_save=1` on the pools/save form).
- The standalone **"🚀 Start League"** header button transitions `draft → active` without saving pools.
- Once `active`, Pools and Matches tabs appear. The Builder tab remains visible to the creator at all times.
- `ended` is irreversible.

### Pool Builder
- **Pool save** replaces all existing pools for the league atomically (delete all → reinsert).
- **Drag & drop**: singles leagues drag player chips; doubles leagues drag team chips (both players added at once). Chips use gradient avatar colors (`BLD_PAL` palette) assigned per-member via `bldColMap`.
- The **Builder tab** (`showBuilder = isCreator`) is always visible to the creator regardless of league status or whether pools already exist. Members never see the Builder tab.
- **`ldSavePools`**: collects `{name, color, players}` per pool column. `color` is read from `col.dataset.color` (defaults to `#1d4ed8`). Chip selector is scoped to `.bld-drop-zone .ld-chip` (not the whole column) to avoid false matches. Shows a confirmation dialog if any pool has fewer than 2 players, but allows saving anyway.

### Active Pool Standings
- Each pool shown as a card with a standings table: #, Team/Player, P, W, L, Pts, Actions.
- **Team display**: Doubles teams shown as **"P1 / P2"** (slash-separated player names) with the team name as a smaller subtitle.
- **Actions column** (creator only):
  - **📅 (Schedule)**: opens the `ldCalModal` calendar popup (via `ldCalLink()`) pre-filled with the opposing team/player.
  - **🏆 (Score)**: opens the `ldScoreModal` popup to report a played result via `POST /leagues/:id/pool-match`.
  - If an accepted `league_proposal` exists for a team, the 📅 button is **replaced** by a confirmed-match block showing: `"P1/P2 vs P3/P4"`, `"📅 Wed, Apr 30 · 2:00 PM"`, and `"Confirmed"` label. The 🏆 button always remains.
- Singles pool standings show "—" in the Actions column, replaced by confirmed date if a proposal exists.
- **`POST /leagues/:id/pool-schedule`**: now creates a `league_proposal` with `status='accepted'` (not a `scheduled_match`) so the confirmed date appears in pool standings. Cancels any prior pending/accepted proposal between the same two teams first.

### League Detail SPA — Tab Structure

`league_detail.ejs` is a 7-tab single-page app. Tabs are shown/hidden via `display:none`; active tab persisted in `location.hash`.

| Tab | `data-tab` | Visible to | Content |
|-----|-----------|-----------|---------|
| 📊 Overview | `overview` | everyone | Standings table (team standings for doubles) · last 5 matches · draft status card |
| 📈 Dashboard | `dashboard` | everyone | Stat cards (matches, players, rank, W/L, top surface) · full match history |
| 🏗️ Builder | `builder` | creator only (`showBuilder = isCreator`) | Teams section (doubles leagues) · drag-and-drop pool builder · Save / Save & Start buttons |
| 🏊 Pools | `pools` | active + hasPools | Per-pool standings cards (P, W, L, Pts) · inline fixture rows with 📅 schedule and 🏆 score buttons |
| 🎾 Matches | `matches` | active | Pool Fixtures (top, only when `hasPools`) then full Match History · per-pool round-robin fixture table with dedicated 📅 Schedule and ✏️ Score columns · creator actions open modal popups |
| 📅 Calendar | `calendar` | members/creator + active | Monthly JS-rendered grid from `_calEvts` JSON · proposals sidebar (incoming, confirmed, outgoing) · new proposal form |
| 👥 Players | `players` | everyone | Member cards grid: avatar, name, rank, W/L; links to `/leagues/:id/player/:pid` |

**Tab visibility flags** (computed in EJS scriptlet):
```
showBuilder   = isCreator                     // always visible to creator
showPools     = isActive && hasPools
showFixtures  = isActive                      // Matches tab visible for ALL active leagues (no pool requirement)
showCalendar  = (isMember || isCreator) && isActive
```

### Matches Tab (Fixtures)
- **Layout**: Pool Fixtures section (only when `hasPools`) rendered first, followed by Match History below.
- **Pool Fixtures table** columns: **#**, **Match** (team name or P1/P2 format), **Date/Status**, **Score**, **📅 Schedule** (creator only), **✏️ Score** (creator only).
- Status: ✅ Played date · 📅 confirmed datetime · "— Not scheduled".
- **Creator actions on unplayed fixtures**:
  - **📅** column button → calls `ldCalLink(opponentId, label1, label2)` → opens the `ldCalModal` calendar popup with opponent pre-selected.
  - **✏️** column button → calls `ldOpenScore(lid, t1id, t2id, p1id, p2id, label1, label2)` → opens the `ldScoreModal` popup.
  - Both columns show "—" for already-played fixtures.
- **Empty state**: if a pool has fewer than 2 members, shows a message with a "Go to Builder" button instead of the fixtures table.
- Visible to any active league (`showFixtures = isActive`), even without pools (pool fixtures section is skipped if `!hasPools`).

### Personal Match Proposals (Schedule Page)
- The Schedule page has two tabs: **📅 Schedule** (direct scheduling) and **📬 Propose Slots** (multi-slot proposal).
- Proposer offers up to 4 datetime options; opponent visits their Schedule page and clicks a slot to accept → a `scheduled_match` is created automatically.
- Proposer can withdraw pending proposals. Declined/cancelled proposals notify the other party via in-app notification.

### League Calendar & Proposals
- **Calendar tab** (on league detail page): the 📅 Calendar tab renders a full monthly grid inline — no modal, no iframe, no page navigation. Visible to members/creator of active leagues.
  - All event data is serialised as `_calEvts` JSON at page load from `lmatches` + `calProposals` (passed from `GET /leagues/:id` via `getLeagueProposals(lid, uid)`).
  - Month navigation (`ldCalNav`) re-renders the grid from pre-loaded data — no AJAX.
- **Standalone calendar page** (`/leagues/:id/calendar`): same data and layout, rendered as a full page.
- **Calendar sidebar** (on both): incoming proposals (slot-by-slot Accept buttons) · confirmed upcoming matches (with Cancel for proposer) · sent proposals (with Withdraw).
- **New Proposal form** always visible in the sidebar; opponent select shows all members (or pre-filtered to a specific opponent when opened from pool standings/fixtures).
- Color coding: 🟢 `#536D33` played · 🔵 `#1d4ed8` confirmed · 🟣 `#7c3aed` incoming pending · 🟡 `#d97706` outgoing pending.
- **Reschedule flow**: cancel accepted proposal with `reschedule=1` → server redirects to `/calendar?reschedule=opponent_id` → New Proposal modal auto-opens with opponent pre-selected.
- `getLeagueProposals()` used by the standalone calendar route, the Calendar tab (via `calProposals`), and (accepted only) the pool standings confirmed-date logic.

### `ldCalModal` — Calendar Proposal Popup
Triggered by `ldCalLink(opponentId, label1, label2)` from Pool Fixtures 📅 buttons and Pool Standings 📅 buttons.
- **Layout**: wide modal (max 920px) — live monthly calendar grid (left) + proposal form (right, 340px).
- **Calendar left pane**: renders from `_calEvts` with month nav (‹/›/Today). Past dates dimmed and non-clickable. Clicking a future date fills the next empty slot input with `dateStr + 'T10:00'` and flashes it green.
- **Proposal form right pane**: opponent `<select>` (auto-selected to the clicked opponent), 4 datetime-local slot inputs, venue text input, submit button POSTs to `/leagues/:id/proposals/new`.
- **Opponent dropdown**: uses `_calTeams` (doubles leagues — team name + "P1 / P2" display, `player1_id` as value) or `_calMembers` (singles — username/full_name + `@handle`). Controlled by `_calIsDoubles` flag.
- **JS data**: `_calIsDoubles`, `_calTeams`, `_calMembers`, `_calLeagueId` serialized with `<%- JSON.stringify(...) %>` in the page `<script>` block.
- **Key functions**: `ldCalLink()` (open + pre-select), `ldModalCalRender()` (draw grid to `#calModalGrid`), `ldModalCalNav(dir)` (month nav), `ldModalDayClick(dateStr)` (fill slot), `ldModalClearSlots()` (reset slots on open).

### `ldScoreModal` — Score Entry Popup
Triggered by `ldOpenScore(lid, t1id, t2id, p1id, p2id, label1, label2, sub1, sub2)` from Pool Fixtures ✏️ buttons and Pool Standings 🏆 buttons.
- `sub1`/`sub2` are player-name strings (`"P1 / P2"`) for doubles teams; empty for singles. Shown as a subtitle in the modal header and appended to winner options.
- **Score input** (`#ldScoreInput`): live validation as user types — parses each set (`X-Y`), renders coloured set pills (green ▲ / red ▼), shows set-count summary, and auto-selects the winner dropdown when one side leads.
- **Quick-add chips**: 14 common set scores (6-0 … 6-7 both ways) — click to append a set; max 5 sets enforced.
- **Winner select** (`#ldScore_winnerSel`): options show `"Team (P1 / P2)"` for doubles, plain name for singles; auto-selected by `ldScoreValidate()`.
- **Form submit guard**: `DOMContentLoaded` listener on `ldScoreForm` calls `ldScoreValidate()` and blocks submit if score format is invalid (empty score = walkover, always allowed).
- Hidden inputs: `#ldScore_t1`, `#ldScore_t2` for team IDs (falls back to player IDs for singles).
- Form (`id="ldScoreForm"`) action set dynamically to `/leagues/${lid}/pool-match`.
- Guarded by `<% if(isCreator&&isActive){%>` in EJS.

### Theming
- CSS uses a **Wimbledon green** palette as CSS custom properties: `--green-500: #536D33` as the primary brand colour, with a full scale from `--green-50` to `--green-900`.

### Player Name Display Format
- Doubles pairs are displayed as **`P1/P2`** (slash-separated) throughout all league views — league_detail.ejs standings, match history, builder chips, pool standings sub-labels, and league_player_stats.ejs match history.
- Never use ` & ` between player names in league contexts.

### General
- **Bulk upload:** CSV format is one `email` or `email,Full Name` per line. Skips existing users. Auto-generates temp passwords and sends welcome emails.
- **Invite tokens:** 48 hours for clubs and leagues; 1 hour for password reset. `crypto.randomBytes(32).toString('hex')` format.
- **Slug generation:** Club slugs are `kebab-case-name-XXXX` (4-char random hex suffix for uniqueness).
- **Chart data:** Dashboard charts cover the last 6 calendar months. League dashboard adds surface breakdown and venue breakdown.
- **EJS `const`/`let` TDZ**: EJS compiles all scriptlet blocks into one JS function. Never use a `const` or `let` variable before the line it is declared — even inside loops — or it will throw `ReferenceError: Cannot access 'x' before initialization`. Declare all computed variables at the top scriptlet block.
