# Orbit ✦

**Orbit** is a local-first productivity PWA that replaces the usual pile of separate apps —
a to-do list, a habit tracker, a countdown app, a birthday reminder — with one screen. Tasks,
habit streaks, countdowns, recurring yearly events, and a calendar that maps all of them,
installable to a phone's home screen and fully usable offline.

It's built as a deliberate exercise in shipping a polished, production-grade product **without**
a framework, a bundler, or a backend-by-default: the app works completely offline on-device,
and gains cross-device sync and push notifications only if you opt in and connect a Supabase
project.

**Live app:** https://orbit-to-do-list.vercel.app/

---

## What it does

| Area | Behaviour |
|---|---|
| **Today** | A daily landing view aggregating what's actually due — tasks, habit check-ins, and anything within a week — instead of making you check five screens each morning. |
| **Tasks** | Deadlines with optional time, subtasks, notes, colour-coded categories, and per-item reminders. Completed items collapse into their own section and auto-archive after 30 days. |
| **Habits** | Two models: **daily streaks** (miss a day, the streak resets) and **interval habits** ("every 40 days") with a countdown ring. A stats view shows current/best streak, consistency %, a 12-week heatmap, and lets you retroactively log a day you forgot. |
| **Countdowns & Yearly events** | Day-counters for one-off events, and recurring yearly dates (birthdays, renewals) that always show days-to-next-occurrence. |
| **Calendar** | One month grid showing every deadline, countdown, interval-habit due date, and yearly event as colour-coded dots. |
| **Reminders** | Per-item "remind me N hours/days before," plus a daily digest — delivered as real Web Push notifications via a serverless scheduler (see below). |

All of it works with **zero backend** — state lives in `localStorage` and the app is fully
functional offline the moment it's installed. Signing in adds encrypted cross-device sync and
push delivery on top, without changing how the app behaves offline.

---

## Architecture

The frontend is vanilla JavaScript loaded as native **ES modules** — no Webpack, Vite, or
Rollup. Every `import`/`export` in the codebase runs unmodified in the browser; "build" is
`git push`. This was a deliberate trade-off: the app is UI-plus-local-state, not a large SPA
with heavy tooling needs, so a bundler would add a toolchain to maintain in exchange for
optimisations (tree-shaking, code-splitting) that don't matter much at this scale. Native
modules still give proper separation of concerns — the win a bundler is usually reached for.

```
js/
├── main.js              application entry — wires every module together, ~35 lines
├── core/                 framework-free primitives (DOM helpers, date math, constants)
├── state/store.js         the single source of truth: load → mutate → save → notify
├── ui/                    chrome shared by every screen (sheets, theming, toasts, dispatch)
├── features/              one file per domain: tasks, habits, countdowns, events, calendar…
└── sync/                  Supabase auth, cloud sync, and push-subscription management
```

Each feature module owns its slice of state, its render function, and the DOM listeners for
its own sheet — there is no God object and no file holding "the app." `main.js`'s only job is
importing every module and calling its `initXyzUI()` once; it contains no business logic.

**Two small internal patterns keep 20+ modules decoupled without a framework:**

- **A render bus** (`ui/render-bus.js`) — a ~15-line pub/sub. Each feature module registers
  its render function against a tab name; navigating just calls `renderActive()`. This is what
  lets `features/today.js` re-render whichever screen is visible after a background action,
  without importing (and coupling to) every other feature module.
- **A pick-target registry** (`ui/sheets.js`) — colour swatches, icon grids, and reminder-offset
  pills are shared UI across four different entity sheets (tasks, habits, countdowns, events).
  Rather than hard-coding four call sites, each feature registers *what it wants picked* against
  its own sheet id; the picker itself stays generic and doesn't know any feature exists.

All user interaction — across every screen and sheet — flows through **one delegated click
listener** (`ui/delegated-events.js`) keyed off `data-*` attributes, dispatching to the relevant
feature's exported handler. Re-rendered HTML never needs its listeners re-attached, and the
click-routing logic lives in exactly one place.

---

## Engineering highlights

**Reminders without a server.** Rather than running a persistent Node process, Orbit schedules
a Postgres `pg_cron` job that invokes a Supabase Edge Function every minute. The function pulls
every user's synced state, computes — per reminder, in *that user's* IANA timezone — whether it
lands on the current minute, and sends Web Push (VAPID) to their registered devices. A
composite-key `insert` into a dedupe table doubles as the concurrency guard: the insert only
succeeds once per `(user, reminder key)`, so a reminder can never double-fire even if the cron
tick overlaps a slow run. No queue, no scheduler service, no persistent process — the entire
"backend" is one stateless function plus a cron trigger.

**Sync as a dumb replicated store, not a query engine.** State syncs as a single JSONB
document per user (`upsert`, last-write-wins by `updatedAt`) instead of a normalised relational
schema. The client already computes every derived value locally, so the server's only job is
to hold a copy — this sidesteps the merge-conflict and partial-sync complexity a row-level sync
protocol would need, at the cost of not being suitable for concurrent multi-writer editing
(a reasonable trade for a single-user personal app).

**Row Level Security *is* the security model.** The Supabase anon key is safe to ship in
client-side code — every table policy binds rows to `auth.uid()`, so the publishable key alone
grants a stranger access to nothing. No secrets live in the frontend; the Edge Function's
service-role key and VAPID private key exist only as server-side secrets.

**Offline-first by construction.** The service worker precaches the full module graph
(cache-first, instant repeat loads), serves `config.js` network-first so a rotated key propagates
immediately, and applies stale-while-revalidate to the Google Fonts / Supabase CDN requests. An
inline pre-paint script applies the saved theme before first paint to avoid a flash of the wrong
theme — a one-line fix that's easy to skip and very visible when you do.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vanilla JS, native ES modules, no bundler | See *Architecture* above — the app's complexity is in state/UI logic, not in needing a build pipeline. |
| Typography | Sora (display) + Plus Jakarta Sans (body) | `tabular-nums` keeps streak counts and countdowns visually aligned as they change. |
| Icons | Inline SVG sprite (~50 glyphs) | Zero network requests; every icon inherits colour via `currentColor`, adapting automatically to both themes. |
| Local data | `localStorage` | The network is never on the critical path — the app is fully usable before any request resolves. |
| Cloud data | Supabase Postgres (`jsonb`) + Row Level Security | Optional sync layer; see *Engineering highlights*. |
| Auth | Supabase email OTP | A typed code (not a magic link) avoids iOS opening the link in Safari instead of the installed PWA. |
| Push | Web Push (VAPID) + Supabase Edge Function + `pg_cron` | Serverless, timezone-aware, no persistent process. |
| Hosting | Vercel (static) | Nothing to cold-start, time out, or pay for. |

---

## Getting started

The app is fully static — no install step, no build:

```bash
npx serve .        # or: python -m http.server
```

Cloud sync and push notifications are optional and off by default. To enable them, add your Supabase keys to `js/config.js` . Deploying is a static import into Vercel — no build command, output is the repo root.

---

## Structure

```
├── index.html                    entry, inline SVG icon sprite, all bottom sheets
├── sw.js                         service worker (offline shell, push handlers)
├── manifest.webmanifest          PWA identity
├── css/styles.css                theme tokens, layout, motion
├── js/
│   ├── main.js                   entry point — wiring only
│   ├── core/                     DOM helpers, date math, shared constants
│   ├── state/store.js            load / save / change-notify
│   ├── ui/                       sheets, theming, toasts, celebrations, tab + click routing
│   ├── features/                 tasks, habits, countdowns, events, calendar, today, backup, badge
│   └── sync/                     Supabase client, cloud sync, push subscriptions
├── icons/                        PWA icons
└── supabase/                     reminders backend: Edge Function, SQL, setup guide
```

> Orbit v1 · local-first — your data lives on your device even when everything above it is optional.
