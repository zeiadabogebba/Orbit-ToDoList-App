import { $, esc, icon } from "../core/dom.js";
import { todayKey, daysBetween, niceShort, niceMD, parseKey } from "../core/dates.js";
import { state } from "../state/store.js";
import { registerRenderer } from "../ui/render-bus.js";
import { taskRow } from "./tasks.js";
import { streakInfo } from "./habits.js";
import { nextOccurrenceKey } from "./events.js";

function emptyState(iconId, title, text) {
  return `<div class="empty"><div class="e-ico">${icon(iconId)}</div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;
}

export function renderToday() {
  const t = todayKey();
  $("#today-date").textContent = parseKey(t).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  const dueTasks = state.tasks.filter((x) => !x.done && x.deadline && x.deadline <= t)
    .sort((a, b) => a.deadline !== b.deadline ? (a.deadline < b.deadline ? -1 : 1) : ((a.time || "99:99") < (b.time || "99:99") ? -1 : 1));
  const daily = state.habits.filter((h) => h.type === "daily");
  const intervalDue = state.habits.filter((h) => h.type === "interval" && daysBetween(t, h.next) <= 0);
  const soonCd = state.countdowns.filter((cd) => !cd.done).map((cd) => ({ cd, d: daysBetween(t, cd.date) })).filter((x) => x.d >= 0 && x.d <= 7).sort((a, b) => a.d - b.d);
  const soonEv = state.events.map((ev) => ({ ev, d: daysBetween(t, nextOccurrenceKey(ev)) })).filter((x) => x.d >= 0 && x.d <= 7).sort((a, b) => a.d - b.d);

  const taskDue = state.tasks.filter((x) => x.deadline && x.deadline <= t);
  const totalRing = taskDue.length + daily.length;
  const doneRing = taskDue.filter((x) => x.done).length + daily.filter((h) => h.log && h.log[t]).length;
  const ring = $("#today-ring");
  if (totalRing) {
    const frac = doneRing / totalRing;
    ring.style.setProperty("--p", frac.toFixed(3));
    ring.style.setProperty("--c", "var(--type-habit)");
    ring.innerHTML = `<b>${Math.round(frac * 100)}%</b>`;
    ring.hidden = false;
  } else {
    ring.hidden = true;
  }

  const group = (label, inner) => `<h3 class="group-label">${label}</h3><div class="stack">${inner}</div>`;
  let html = "";
  if (dueTasks.length) html += group("Tasks due", dueTasks.map(taskRow).join(""));
  const habitRows = daily.map(todayDailyRow).concat(intervalDue.map(todayIntervalRow));
  if (habitRows.length) html += group("Habits", habitRows.join(""));
  const upRows = soonCd.map((x) => comingRow(x.cd, niceShort(x.cd.date), x.d, x.cd.id)).concat(soonEv.map((x) => comingRow(x.ev, `${niceMD(x.ev.month, x.ev.day)} · yearly`, x.d)));
  if (upRows.length) html += group("Coming up", upRows.join(""));
  if (!html) html = emptyState("today", "All clear", "Nothing needs you today. Enjoy the calm ✦");
  $("#today-body").innerHTML = html;
}

function todayDailyRow(h) {
  const s = streakInfo(h);
  return `<div class="today-row ${s.doneToday ? "done" : ""}" style="--c:${h.color}">
    <div class="t-ico">${icon(h.icon)}</div>
    <div class="t-main"><b>${esc(h.name)}</b><small>${s.current} day streak</small></div>
    <button class="t-check ${s.doneToday ? "on" : ""}" data-checkin="${h.id}" aria-label="Check in">${icon("check")}</button>
  </div>`;
}

function todayIntervalRow(h) {
  const diff = daysBetween(todayKey(), h.next);
  return `<div class="today-row" style="--c:${h.color}">
    <div class="t-ico">${icon(h.icon)}</div>
    <div class="t-main"><b>${esc(h.name)}</b><small class="${diff < 0 ? "over" : ""}">${diff < 0 ? `Overdue by ${-diff} day${-diff > 1 ? "s" : ""}` : "Due today"}</small></div>
    <button class="t-do" data-intdone="${h.id}">Done</button>
  </div>`;
}

function comingRow(item, sub, d, cdId) {
  const when = d === 0 ? `<b>Today</b>` : `<b>${d}</b><small>day${d > 1 ? "s" : ""}</small>`;
  const check = cdId ? `<button class="t-check" data-cd-toggle="${cdId}" aria-label="Mark done">${icon("check")}</button>` : "";
  return `<div class="today-row" style="--c:${item.color}">
    <div class="t-ico">${icon(item.icon)}</div>
    <div class="t-main"><b>${esc(item.title)}</b><small>${sub}</small></div>
    <div class="t-when ${d === 0 ? "is-today" : ""}">${when}</div>
    ${check}
  </div>`;
}

registerRenderer("today", renderToday);
