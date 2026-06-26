# Orbit ✦

Your orbit of **tasks, habits, streaks, countdowns and yearly moments** — all on one screen,
all on your device. A local-first PWA you can install to your iPhone home screen and use like a
native app, fully offline.

**Live app:** https://YOUR-APP.vercel.app <!-- replace with your Vercel URL -->

---

## Features

| Section | What it does |
|---|---|
| **Tasks** | Add tasks with an optional deadline. Tick one off and it slides into a **Completed** section on the same screen. Tasks are sorted by soonest deadline, with `Today` / `Tomorrow` / overdue badges. |
| **Categories** | Colour-coded, user-defined categories. Filter the task list by category; double-tap a filter chip to rename, recolour or delete it. |
| **Habits — daily** | Check in each day you do the habit. The streak counter climbs while you keep it up; **miss a day and it resets**. A 7-day strip shows your recent week. |
| **Habits — every N days** | "Do this every 40 days" style habits (e.g. *Groom*). A ring counts down to the next due date and tells you when it's due / overdue. Mark it done to start the next cycle. |
| **Countdowns** | Big day-counters to one-off events — a trip, a release, a birthday. |
| **Yearly** | Dates that come back **every year** (birthdays, anniversaries, renewals). Always shows the days until the next occurrence. |
| **Calendar** | A month grid that maps **everything**: task deadlines, countdowns, interval-habit due dates and yearly events, each with a colour-coded dot. Tap any day to see what's on it. |

Plus: **dark / light** themes (auto-detected, instant toggle, no flash), offline support,
JSON backup export/import, and optional cloud sync across devices.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vanilla HTML / CSS / JS — no framework, no build step | State-driven single-screen app; `innerHTML` render functions do the job a framework would, shipping exactly the bytes written. |
| Typography | **Sora** (display) + **Plus Jakarta Sans** (body) | Geometric, modern pairing; `tabular-nums` keeps streak counts and countdowns aligned. |
| Icons | Inline SVG sprite, ~50 thin-line glyphs | Zero network requests; coloured via `currentColor` so every icon inherits its item's colour and adapts to both themes. |
| Data | `localStorage` (device) + Supabase Postgres `jsonb` (cloud) | Local-first — the network is never on the critical path. |
| Auth | Supabase email OTP | A typed code avoids iOS magic-links opening in Safari instead of the installed PWA. |
| Hosting | Vercel (static) | No server to cold-start, time out or pay for. |

## How it's built

### State & rendering
The whole app is one JSON object — `categories`, `tasks`, `habits`, `countdowns`, `events` and a
timestamp. Every interaction mutates state, persists to `localStorage`, and re-renders only the
active screen from template strings. **All clicks route through a single delegated listener** on
`document` (`data-*` attributes), so re-rendered HTML never needs listeners re-attached.

### Design system — "Vibrant Gradient"
Colours flow through CSS custom properties defined twice (deep-indigo dark, lavender-white light).
A signature indigo→violet→pink→coral gradient runs through the brand mark, the FAB, the active dock
pill and progress rings. Motion is spring-based (`cubic-bezier`) and **transform/opacity only**;
`backdrop-filter` is restricted to fixed surfaces (top bar, dock, sheets) for GPU cost; entry
animations stagger; `prefers-reduced-motion` collapses all of it. Touch targets are ≥ 44px and the
layout respects iOS safe-area insets.

### Dates
Everything keys off local `YYYY-MM-DD` strings. Streaks walk the daily log backwards from today;
interval habits store `next` (and re-derive it from `every` when marked done); yearly events store
only month + day and compute the next occurrence each render.

### Offline & PWA
`manifest.webmanifest` makes it installable (standalone, home-screen icon); `sw.js` precaches the
app shell (cache-first → instant offline startup), serves `config.js` network-first (so key changes
apply immediately) and falls back to the cached shell for navigations. Ship an update by bumping the
`CACHE` string in `sw.js`.

### Cloud sync
The whole state syncs as **one `jsonb` document per user** in an `orbit_state` table. Each local
change schedules a debounced push (~1.5 s); on sign-in the app keeps whichever copy has the newer
`updatedAt` (last-write-wins, empty local always defers to cloud). The client computes everything —
the server is a backup drive, not a brain — so one upsert replaces a row-level sync protocol.

---

## Setup

### Run locally
It's fully static. Serve the folder over HTTP (a service worker won't register on `file://`):

```bash
npx serve .        # or: python -m http.server
```

### Enable cloud sync (optional)
1. Create a Supabase project. In **Project Settings → API**, copy the URL and the **anon/publishable** key into `js/config.js`.
2. Create the table and lock it down with Row Level Security (this is the entire security model — the publishable key grants a stranger access to *nothing*):

```sql
create table orbit_state (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table orbit_state enable row level security;

create policy "own row" on orbit_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

3. (Email OTP) In **Authentication → Providers → Email**, enable email sign-in. Optionally set up Gmail SMTP as the sender.

### Deploy
Push to a repo and import it into Vercel as a static project (no build command, output = repo root).

---

## Structure

```
├── index.html              entry + inline SVG icon sprite + all bottom sheets
├── sw.js                   service worker (root — scope rule)
├── manifest.webmanifest    PWA identity
├── css/styles.css          theme tokens, styling, motion
├── js/app.js               state, rendering, sync engine
├── js/config.js            Supabase URL + publishable key
└── icons/                  PWA icons (gradient orbit mark)
```

> Orbit v1 · your data lives on your device — export a backup once in a while.
