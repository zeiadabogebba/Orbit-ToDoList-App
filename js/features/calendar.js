import { $, esc, icon } from "../core/dom.js";
import { todayKey, parseKey, pad2, fmtTime } from "../core/dates.js";
import { TYPE_TOKEN } from "../core/constants.js";
import { state } from "../state/store.js";
import { openSheet } from "../ui/sheets.js";
import { registerRenderer } from "../ui/render-bus.js";
import { catOf } from "./categories.js";

let calY, calM;
{
  const d = new Date();
  calY = d.getFullYear();
  calM = d.getMonth();
}

function gatherDay(key) {
  const [, m, d] = key.split("-").map(Number);
  const items = [];
  state.tasks.forEach((t) => {
    if (!t.done && t.deadline === key) {
      const c = catOf(t.catId);
      const base = c ? c.name : "Task";
      items.push({ type: "task", color: c ? c.color : null, title: t.title, icon: "tasks", sub: t.time ? `${fmtTime(t.time)} · ${base}` : base });
    }
  });
  state.countdowns.forEach((cd) => { if (cd.date === key && !cd.done) items.push({ type: "cd", color: cd.color, title: cd.title, icon: cd.icon, sub: "Countdown" }); });
  state.events.forEach((ev) => { if (ev.month === m && ev.day === d) items.push({ type: "event", color: ev.color, title: ev.title, icon: ev.icon, sub: "Yearly event" }); });
  state.habits.forEach((h) => { if (h.type === "interval" && h.next === key) items.push({ type: "habit", color: h.color, title: h.name, icon: h.icon, sub: `Every ${h.every} days` }); });
  return items;
}

export function renderCalendar() {
  $("#cal-month-label").textContent = new Date(calY, calM, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const first = new Date(calY, calM, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(calY, calM + 1, 0).getDate();
  const t = todayKey();
  let cells = "";
  for (let i = 0; i < offset; i++) cells += `<div class="cal-cell blank"></div>`;
  for (let d = 1; d <= days; d++) {
    const key = `${calY}-${pad2(calM + 1)}-${pad2(d)}`;
    const items = gatherDay(key);
    const types = [];
    ["task", "cd", "habit", "event"].forEach((ty) => { if (items.some((it) => it.type === ty)) types.push(ty); });
    const dots = types.map((ty) => `<i style="--c:var(${TYPE_TOKEN[ty]})"></i>`).join("");
    cells += `<button class="cal-cell ${key === t ? "today" : ""} ${types.length ? "has" : ""}" data-day="${key}">
      <span class="cal-daynum">${d}</span>
      <span class="cal-dots">${dots}</span>
    </button>`;
  }
  $("#cal-grid").innerHTML = cells;
}

export function openDaySheet(key) {
  const items = gatherDay(key);
  $("#day-title").textContent = parseKey(key).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  $("#day-items").innerHTML = items.length
    ? items.map((it) => `<div class="day-row" style="--c:${it.color || `var(${TYPE_TOKEN[it.type]})`}">
        <div class="day-ico">${icon(it.icon)}</div>
        <div class="day-text"><b>${esc(it.title)}</b><small>${esc(it.sub)}</small></div>
      </div>`).join("")
    : `<p class="about" style="margin-top:6px">Nothing scheduled on this day.</p>`;
  openSheet("sheet-day");
}

export function initCalendarUI() {
  $("#cal-prev").addEventListener("click", () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCalendar(); });
  $("#cal-next").addEventListener("click", () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCalendar(); });
  $("#cal-month-label").addEventListener("click", () => { const d = new Date(); calY = d.getFullYear(); calM = d.getMonth(); renderCalendar(); });
}

registerRenderer("calendar", renderCalendar);
