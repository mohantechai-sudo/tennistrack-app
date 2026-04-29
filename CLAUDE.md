# TennisTrack — Project Reference

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js + Express 4 |
| Database | SQLite3 (promise-wrapped, single file) |
| Templates | EJS (server-rendered) |
| Auth | express-session (7-day cookie), bcryptjs |
| Email | Nodemailer (Gmail SMTP) |
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
| `views/` | EJS templates |
| `public/css/style.css` | Main stylesheet (Wimbledon green palette) |

---

## Environment Variables (config.js)

| Variable | Purpose | Default |
|----------|---------|---------|
| `SESSION_SECRET` | Express session secret | `tennis-secret-2024-change-me` |
| `PORT` | Server port | `3000` |
| `EMAIL_USER` | Gmail SMTP username | — (disables email if unset) |
| `EMAIL_PASS` | Gmail SMTP password | — |
| `TWILIO_SID` | Twilio account SID | — (disables SMS if unset) |
| `TWILIO_TOKEN` | Twilio auth token | — |
| `TWILIO_FROM_SMS` | Twilio SMS sender number | — |
| `TWILIO_FROM_WHATSAPP` | Twilio WhatsApp sender | `whatsapp:+14155238886` |

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
full_name, phone, whatsapp_enabled (0/1), is_admin (0/1), created_at
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
| GET/POST | `/register` | Sign up (first user auto-becomes admin) |
| GET/POST | `/login` | Log in |
| GET | `/logout` | Destroy session |
| GET/POST | `/forgot-password` | Send password reset email (1-hour token) |
| GET/POST | `/reset-password/:token` | Complete password reset |

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

---

## Views (EJS Templates)

| File | Page |
|------|------|
| `layout_top.ejs` | Nav/header partial |
| `layout_bottom.ejs` | Footer partial |
| `login.ejs` | Login form |
| `register.ejs` | Registration form |
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
| `league_detail.ejs` | Standings, matches, teams, pool builder, active pool standings (P1/P2 format + confirmed-date display), Log Match modal, inline Calendar Popup modal (full calendar + proposal sub-modals, IIFE-wrapped JS), Fixtures modal (all pool matchups with schedule/score actions) |
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

### Email (Nodemailer)
Sent for: match scheduled, match reminder, match cancelled, password reset, club invite, league invite, bulk-upload welcome.

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

### League Lifecycle (draft → active → ended)
- New leagues always start as `draft`. Creator builds teams and assigns them to pools using the drag-and-drop pool builder.
- **"Save & Start League"** button in the pool section saves pools and transitions to `active` in one POST (via `start_after_save=1` on the pools/save form).
- The standalone **"🚀 Start League"** header button transitions `draft → active` without saving pools.
- Once `active`, pool standings tables appear (replacing the builder). Pools are locked; the builder is hidden unless the creator is active with zero pools (fallback to allow late setup).
- `ended` is irreversible.

### Pool Builder
- **Pool save** replaces all existing pools for the league atomically (delete all → reinsert).
- **Drag & drop**: singles leagues drag player chips; doubles leagues drag team chips (both players added at once).
- In **draft**, creator sees the interactive builder. Members see a read-only view if pools exist.
- In **active**, creator sees the builder only if no pools exist yet (late-setup fallback).

### Active Pool Standings
- Each pool shown as a card with a standings table: #, Team/Player, P, W, L, Pts, Actions.
- **Team display**: Doubles teams shown as **"P1 / P2"** (slash-separated player names) with the team name as a smaller subtitle.
- **Actions column** (creator only):
  - **📅 (Schedule)**: opens the inline Calendar Popup modal pre-filled with the opposing team's player as the proposal opponent.
  - **🏆 (Score)**: opens the Score modal to report a played result via `POST /leagues/:id/pool-match`.
  - If an accepted `league_proposal` exists for a team, the 📅 button is **replaced** by a confirmed-match block showing: `"P1/P2 vs P3/P4"`, `"📅 Wed, Apr 30 · 2:00 PM"`, and `"Confirmed"` label. The 🏆 button always remains.
- Singles pool standings show "—" in the Actions column, replaced by confirmed date if a proposal exists.
- **`POST /leagues/:id/pool-schedule`**: now creates a `league_proposal` with `status='accepted'` (not a `scheduled_match`) so the confirmed date appears in pool standings. Cancels any prior pending/accepted proposal between the same two teams first.

### Log Match Modal (League Detail)
- The "📝 Log Match" button in the league header opens a modal overlay (visible to members of active leagues).
- The modal contains the full match logging form: opponent/partner selection, score, surface, date/time, venue, winner. POSTs to `POST /leagues/:id/match`.

### Fixtures List (League Detail)
- The **"📋 Fixtures"** button appears in the league header when the league is active and has at least one pool (visible to members and creator).
- Opens a modal listing every round-robin matchup per pool, grouped by pool with colour-coded pool header.
- Each fixture row shows: **#**, **Match** (P1/P2 vs P3/P4 with team name subtitles), **Venue** (from played match or accepted proposal, or "TBD"), **Actions**.
- Status badges: ✅ score (played) · 📅 date (scheduled/confirmed) · nothing (unplayed).
- Actions for unplayed fixtures: **📅** closes fixtures modal and opens the Calendar Popup pre-filled with the opponent · **🏆** (creator, doubles only) closes fixtures and opens Score modal pre-filled with the correct pair.
- Fixture pair data passed to score modal includes only the two relevant teams so dropdowns pre-select correctly.

### Personal Match Proposals (Schedule Page)
- The Schedule page has two tabs: **📅 Schedule** (direct scheduling) and **📬 Propose Slots** (multi-slot proposal).
- Proposer offers up to 4 datetime options; opponent visits their Schedule page and clicks a slot to accept → a `scheduled_match` is created automatically.
- Proposer can withdraw pending proposals. Declined/cancelled proposals notify the other party via in-app notification.

### League Calendar & Proposals
- **Standalone page**: Accessible via **📅 Calendar** button on the league detail header (members only). Full-page view with the same features as the popup.
- **Inline Calendar Popup** (on league detail page): opened by the pool standings 📅 button and the Fixtures modal 📅 button. Full monthly grid calendar rendered inside a fixed popup modal — no iframe, no page navigation.
  - Data: `GET /leagues/:id` now also calls `getLeagueProposals(lid, uid)` and passes `calProposals`; the EJS scriptlet builds `_calEvts` from `lmatches` + `calProposals`.
  - Nested sub-modals for Event Detail (z-index 1200) and New Proposal (z-index 1200) appear above the calendar popup (z-index 1100). Escape key closes in layers (sub-modal first, then calendar).
  - All calendar JS is IIFE-wrapped (`ldcXxx` prefix) to avoid conflicts with the page's existing `closeModals()` and other functions.
- **New Proposal modal opponent dropdown** (both standalone and popup):
  - Doubles leagues: shows **team names** (`"Team Name (P1 & P2)"`) with `player1_id` as the option value.
  - When opened from pool standings or fixtures (via `?propose=PLAYER_ID` or `proposeOpp` arg): dropdown is filtered to show **only** the specific opposing team.
  - When opened manually via "+ New Proposal": shows all teams/members.
- Color coding: 🟢 `#536D33` played · 🔵 `#1d4ed8` confirmed · 🟣 `#7c3aed` incoming pending · 🟡 `#d97706` outgoing pending.
- Hover any future day cell → `+` button → opens New Proposal modal with that date pre-filled at 10:00.
- Click any event pill → Event Detail modal with contextual actions (Accept/Decline, Withdraw, Reschedule/Cancel).
- **Reschedule flow**: cancel accepted proposal with `reschedule=1` → server redirects to `/calendar?reschedule=opponent_id` → New Proposal modal auto-opens with opponent pre-selected.
- Sidebar: incoming proposals (slot-by-slot accept buttons), upcoming confirmed matches, sent proposals.
- `getLeagueProposals()` used by the standalone calendar route, the inline popup (via `calProposals`), and (accepted only) the pool standings confirmed-date logic.

### Theming
- CSS uses a **Wimbledon green** palette as CSS custom properties: `--green-500: #536D33` as the primary brand colour, with a full scale from `--green-50` to `--green-900`.

### General
- **Bulk upload:** CSV format is one `email` or `email,Full Name` per line. Skips existing users. Auto-generates temp passwords and sends welcome emails.
- **Invite tokens:** 48 hours for clubs and leagues; 1 hour for password reset. `crypto.randomBytes(32).toString('hex')` format.
- **Slug generation:** Club slugs are `kebab-case-name-XXXX` (4-char random hex suffix for uniqueness).
- **Chart data:** Dashboard charts cover the last 6 calendar months. League dashboard adds surface breakdown and venue breakdown.
