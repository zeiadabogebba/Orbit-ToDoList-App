// Orbit — reminder sender (Supabase Edge Function)
// Triggered every minute by pg_cron (see supabase/reminders-setup.sql).
// Reads each user's synced orbit_state, works out what reminders fall on the
// current minute in their timezone, dedupes via reminders_sent, and sends Web
// Push to their stored subscriptions.
//
// Required function secrets (supabase secrets set ...):
//   VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (e.g. mailto:you@example.com)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:orbit@example.com",
  Deno.env.get("VAPID_PUBLIC")!,
  Deno.env.get("VAPID_PRIVATE")!,
);

const pad = (n: number) => String(n).padStart(2, "0");

// current {date:"YYYY-MM-DD", hm:"HH:MM"} in a given IANA timezone
function nowInTz(tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  let hh = parts.hour === "24" ? "00" : parts.hour;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hm: `${hh}:${parts.minute}` };
}

// wall-clock arithmetic: (dateStr @ hm) minus N hours -> {date, hm}
function minusHours(dateStr: string, hm: string, hours: number) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi) - hours * 3600_000);
  return {
    date: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`,
    hm: `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`,
  };
}

function nextOccurrence(month: number, day: number, todayDate: string) {
  const y = Number(todayDate.slice(0, 4));
  const md = `${pad(month)}-${pad(day)}`;
  const thisYear = `${y}-${md}`;
  return thisYear >= todayDate ? { date: thisYear, year: y } : { date: `${y + 1}-${md}`, year: y + 1 };
}

function buildDigest(st: any, today: string): string {
  const tasks = (st.tasks || []).filter((t: any) => !t.done && t.deadline === today);
  const cds = (st.countdowns || []).filter((c: any) => !c.done && c.date === today);
  const evs = (st.events || []).filter((e: any) => today.slice(5) === `${pad(e.month)}-${pad(e.day)}`);
  const ih = (st.habits || []).filter((h: any) => h.type === "interval" && h.next === today);
  const dh = (st.habits || []).filter((h: any) => h.type === "daily" && !(h.log && h.log[today]));
  const bits: string[] = [];
  if (tasks.length) bits.push(`${tasks.length} task${tasks.length > 1 ? "s" : ""} due`);
  if (ih.length) bits.push(`${ih.length} habit${ih.length > 1 ? "s" : ""} due`);
  if (dh.length) bits.push(`${dh.length} to check in`);
  cds.forEach((c: any) => bits.push(c.title));
  evs.forEach((e: any) => bits.push(e.title));
  return bits.join(" · ");
}

// reminders firing this exact minute for one user's state
function dueReminders(st: any, tz: string) {
  const now = nowInTz(tz);
  const digestTime = (st.reminders?.dailyDigest?.time) || "09:00";
  const out: { key: string; title: string; body: string }[] = [];
  const at = (anchorDate: string, anchorHm: string, remind: number) => minusHours(anchorDate, anchorHm, remind);
  const hit = (f: { date: string; hm: string }) => f.date === now.date && f.hm === now.hm;

  // daily digest
  if (st.reminders?.dailyDigest?.on && digestTime === now.hm) {
    const body = buildDigest(st, now.date);
    if (body) out.push({ key: `digest:${now.date}`, title: "Today on Orbit", body });
  }
  // tasks
  for (const t of st.tasks || []) {
    if (t.done || !t.deadline || t.remind == null) continue;
    const f = at(t.deadline, t.time || digestTime, t.remind);
    if (hit(f)) out.push({ key: `task:${t.id}:${t.deadline}`, title: "Task due", body: t.title });
  }
  // countdowns
  for (const c of st.countdowns || []) {
    if (c.done || c.remind == null) continue;
    const f = at(c.date, digestTime, c.remind);
    if (hit(f)) out.push({ key: `cd:${c.id}:${c.date}`, title: "Countdown", body: c.title });
  }
  // yearly events
  for (const e of st.events || []) {
    if (e.remind == null) continue;
    const occ = nextOccurrence(e.month, e.day, now.date);
    const f = at(occ.date, digestTime, e.remind);
    if (hit(f)) out.push({ key: `ev:${e.id}:${occ.year}`, title: "Coming up", body: e.title });
  }
  // interval habits
  for (const h of st.habits || []) {
    if (h.type !== "interval" || h.remind == null) continue;
    const f = at(h.next, digestTime, h.remind);
    if (hit(f)) out.push({ key: `habit:${h.id}:${h.next}`, title: "Habit due", body: h.name });
  }
  return out;
}

Deno.serve(async () => {
  const [{ data: states }, { data: subs }] = await Promise.all([
    sb.from("orbit_state").select("user_id, data"),
    sb.from("push_subscriptions").select("*"),
  ]);
  const byUser: Record<string, any[]> = {};
  (subs || []).forEach((s) => (byUser[s.user_id] ||= []).push(s));

  let sent = 0;
  for (const row of states || []) {
    const userSubs = byUser[row.user_id];
    if (!userSubs?.length) continue;
    const st = row.data || {};
    const tz = st.reminders?.tz || "UTC";
    for (const n of dueReminders(st, tz)) {
      // dedupe: insert wins only once per (user, key)
      const { error } = await sb.from("reminders_sent").insert({ user_id: row.user_id, key: n.key });
      if (error) continue; // already sent
      const payload = JSON.stringify({ title: n.title, body: n.body, url: "." });
      for (const s of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
});
