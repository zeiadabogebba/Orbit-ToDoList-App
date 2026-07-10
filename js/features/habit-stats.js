import { $, esc, icon } from "../core/dom.js";
import { todayKey, addDays, daysBetween, parseKey, dateKey, niceShort, MONTHS } from "../core/dates.js";
import { state, save } from "../state/store.js";
import { openSheet } from "../ui/sheets.js";
import { renderActive } from "../ui/render-bus.js";
import { haptic } from "../ui/celebration.js";
import { getHabitById, streakInfo, openHabitSheetById } from "./habits.js";

let statsHabitId = null;

function dailyStats(h) {
  const log = h.log || {};
  const keys = Object.keys(log).filter((k) => log[k]).sort();
  const total = keys.length;
  let runs = 0, best = 0, run = 0, prev = null;
  for (const k of keys) {
    if (prev && daysBetween(prev, k) === 1) run++; else { run = 1; runs++; }
    if (run > best) best = run;
    prev = k;
  }
  const s = streakInfo(h);
  const breaks = Math.max(0, runs - 1);
  let startKey = h.createdAt ? dateKey(new Date(h.createdAt)) : (keys[0] || todayKey());
  if (keys[0] && keys[0] < startKey) startKey = keys[0];
  const span = Math.max(1, daysBetween(startKey, todayKey()) + 1);
  const rate = Math.round((total / span) * 100);
  let last30 = 0;
  for (let i = 0; i < 30; i++) if (log[addDays(todayKey(), -i)]) last30++;
  return { current: s.current, best, total, breaks, rate, last30, start: startKey };
}

function heatmapCells(h) {
  const log = h.log || {};
  const t = todayKey();
  const monIdx = (parseKey(t).getDay() + 6) % 7;
  const weeks = 12;
  let out = "";
  for (let col = 0; col < weeks; col++) {
    for (let row = 0; row < 7; row++) {
      const off = -monIdx - (weeks - 1 - col) * 7 + row;
      const k = addDays(t, off);
      out += `<i class="${off > 0 ? "fut" : log[k] ? "on" : ""}" title="${k}"></i>`;
    }
  }
  return out;
}

function habitLogStrip(h) {
  const log = h.log || {};
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let out = "";
  for (let i = 0; i < 60; i++) {
    const k = addDays(todayKey(), -i);
    const d = parseKey(k);
    const label = i === 0 ? "Today" : weekdays[d.getDay()];
    const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    out += `<button class="habit-log-day ${log[k] ? "on" : ""} ${i === 0 ? "today" : ""}" data-habit-log="${h.id}|${k}" aria-pressed="${log[k] ? "true" : "false"}" aria-label="${log[k] ? "Remove" : "Log"} ${esc(h.name)} for ${date}">
      <span>${label}</span><b>${date}</b>
    </button>`;
  }
  return out;
}

export function openHabitStats(h) {
  statsHabitId = h.id;
  let body;
  if (h.type === "daily") {
    const d = dailyStats(h);
    const tile = (n, l) => `<div class="stat"><b>${n}</b><small>${l}</small></div>`;
    body = `
      <div class="stats-head" style="--c:${h.color}">
        <div class="stats-ico">${icon(h.icon)}</div>
        <div><h4>${esc(h.name)}</h4><span>Daily streak · since ${niceShort(d.start)}</span></div>
      </div>
      <div class="stat-grid">
        ${tile(d.current, "Current streak")}
        ${tile(d.best, "Best streak")}
        ${tile(d.total, "Total check-ins")}
        ${tile(d.breaks, "Times broken")}
        ${tile(d.rate + "%", "Consistency")}
        ${tile(d.last30, "Last 30 days")}
      </div>
      <label class="field-label">Log missed days</label>
      <div class="habit-log-strip" style="--c:${h.color}" aria-label="Past habit days">${habitLogStrip(h)}</div>
      <label class="field-label">Last 12 weeks</label>
      <div class="heatmap" style="--c:${h.color}">${heatmapCells(h)}</div>`;
  } else {
    const diff = daysBetween(todayKey(), h.next);
    const status = diff < 0 ? `Overdue by ${-diff} day${-diff > 1 ? "s" : ""}` : diff === 0 ? "Due today" : `Due in ${diff} day${diff > 1 ? "s" : ""}`;
    const tile = (n, l) => `<div class="stat"><b>${n}</b><small>${l}</small></div>`;
    body = `
      <div class="stats-head" style="--c:${h.color}">
        <div class="stats-ico">${icon(h.icon)}</div>
        <div><h4>${esc(h.name)}</h4><span>Every ${h.every} days · ${esc(status)}</span></div>
      </div>
      <div class="stat-grid two">
        ${tile(h.every, "Every N days")}
        ${tile(h.count || 0, "Completed")}
        ${tile(h.last ? niceShort(h.last) : "—", "Last done")}
        ${tile(niceShort(h.next), "Next due")}
      </div>`;
  }
  $("#stats-body").innerHTML = body;
  openSheet("sheet-habit-stats");
}

export function openHabitStatsById(id) {
  const h = getHabitById(id);
  if (h) openHabitStats(h);
}

export function toggleHabitLogDay(data) {
  const [id, key] = data.split("|");
  const h = getHabitById(id);
  if (!h || h.type !== "daily" || !key || daysBetween(todayKey(), key) > 0) return;
  h.log = h.log || {};
  if (h.log[key]) delete h.log[key]; else h.log[key] = true;
  save();
  renderActive();
  openHabitStats(h);
  haptic(12);
}

export function initHabitStatsUI() {
  $("#stats-edit").addEventListener("click", () => {
    if (statsHabitId) openHabitSheetById(statsHabitId);
  });
}
