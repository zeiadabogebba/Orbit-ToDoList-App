import { $, $$, esc, icon, clamp, uid } from "../core/dom.js";
import { todayKey, addDays, daysBetween, niceShort } from "../core/dates.js";
import { COLORS } from "../core/constants.js";
import { state, save } from "../state/store.js";
import { openSheet, closeSheets, renderSwatchRow, renderIconGrid, renderRemind, registerPickTarget } from "../ui/sheets.js";
import { registerRenderer, renderActive } from "../ui/render-bus.js";
import { toast } from "../ui/toast.js";
import { celebrate } from "../ui/celebration.js";

const habitState = { editId: null, type: "daily", icon: "flame", color: COLORS[4], every: 40, next: todayKey(), remind: null };

registerPickTarget("sheet-habit", { getItem: () => habitState, colorsSel: "#habit-colors", iconsSel: "#habit-icons", remindSel: "#habit-remind" });

export function getHabitById(id) {
  return state.habits.find((h) => h.id === id) || null;
}

export function streakInfo(h) {
  const log = h.log || {};
  const t = todayKey();
  const doneToday = !!log[t];
  let count = 0;
  let cur = doneToday ? t : addDays(t, -1);
  if (doneToday || log[cur]) { while (log[cur]) { count++; cur = addDays(cur, -1); } }
  const keys = Object.keys(log).filter((k) => log[k]).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) { if (prev && daysBetween(prev, k) === 1) run++; else run = 1; best = Math.max(best, run); prev = k; }
  return { current: count, doneToday, best };
}

function emptyState(iconId, title, text) {
  return `<div class="empty"><div class="e-ico">${icon(iconId)}</div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;
}

export function renderHabits() {
  const daily = state.habits.filter((h) => h.type === "daily");
  const interval = state.habits.filter((h) => h.type === "interval");

  $("#daily-label").hidden = !daily.length;
  $("#interval-label").hidden = !interval.length;
  $("#habit-daily").innerHTML = daily.map(dailyCard).join("");
  $("#habit-interval").innerHTML = interval.map(intervalCard).join("");

  const empty = $("#habits-empty");
  if (!state.habits.length) { empty.hidden = false; empty.innerHTML = emptyState("flame", "Build a habit", "Track daily streaks or things you do every few days. Tap + to start."); }
  else empty.hidden = true;
}

function dailyCard(h) {
  const s = streakInfo(h);
  const t = todayKey();
  let dots = "";
  for (let i = 6; i >= 0; i--) { const k = addDays(t, -i); dots += `<span class="wd ${h.log && h.log[k] ? "on" : ""} ${i === 0 ? "today" : ""}"></span>`; }
  return `<div class="habit-card" style="--c:${h.color}" data-habit-stats="${h.id}">
    <div class="habit-top">
      <div class="habit-icon">${icon(h.icon)}</div>
      <div class="streak ${s.current ? "lit" : ""}"><b>${icon("flame")}${s.current}</b><small>day streak</small></div>
    </div>
    <div class="habit-namerow">
      <div class="habit-name">${esc(h.name)}</div>
      <button class="habit-edit" data-edit-habit="${h.id}" aria-label="Edit ${esc(h.name)}">${icon("edit")}</button>
    </div>
    <div class="week-dots">${dots}</div>
    <button class="check-day ${s.doneToday ? "done" : ""}" data-checkin="${h.id}">${icon(s.doneToday ? "check" : "plus")}${s.doneToday ? "Done today" : "Check in"}</button>
  </div>`;
}

function intervalCard(h) {
  const diff = daysBetween(todayKey(), h.next);
  const p = clamp(1 - diff / h.every, 0, 1);
  let center, statusCls = "", statusTxt;
  if (diff < 0) { center = `<b>${-diff}</b><small>over</small>`; statusCls = "over"; statusTxt = `Overdue by ${-diff} day${-diff > 1 ? "s" : ""}`; }
  else if (diff === 0) { center = icon("bell"); statusCls = "due"; statusTxt = "Due today"; }
  else { center = `<b>${diff}</b><small>days</small>`; statusTxt = `Due ${diff === 1 ? "tomorrow" : `in ${diff} days`} · ${niceShort(h.next)}`; }
  return `<div class="int-card" style="--c:${h.color}" data-habit-stats="${h.id}">
    <div class="int-ring" style="--p:${(diff < 0 ? 1 : p).toFixed(3)};--c:${h.color}">${center}</div>
    <div class="int-main">
      <div class="int-name">${icon(h.icon)}${esc(h.name)}</div>
      <div class="int-status ${statusCls}">${statusTxt}</div>
    </div>
    <button class="int-edit" data-edit-habit="${h.id}" aria-label="Edit">${icon("edit")}</button>
    <button class="int-done" data-intdone="${h.id}">Done</button>
  </div>`;
}

export function checkinHabit(id, btn) {
  const h = getHabitById(id);
  if (!h || h.type !== "daily") return;
  h.log = h.log || {};
  const t = todayKey();
  if (h.log[t]) delete h.log[t]; else { h.log[t] = true; if (btn) btn.classList.add("burst"); }
  save();
  const s = streakInfo(h);
  if (h.log[t]) {
    if ([10, 30, 100].includes(s.current)) celebrate(`🔥 ${s.current}-day streak!`, 70);
    else celebrate(s.current > 1 ? `🔥 ${s.current} day streak!` : "Checked in ✦", 34);
  }
  renderActive();
}

export function intervalDone(id) {
  const h = getHabitById(id);
  if (!h) return;
  const t = todayKey();
  h.last = t;
  h.next = addDays(t, h.every);
  h.count = (h.count || 0) + 1;
  save();
  renderActive();
  celebrate(`Done! Next in ${h.every} days`, 34);
}

export function openHabitSheet(habit) {
  habitState.editId = habit ? habit.id : null;
  habitState.type = habit ? habit.type : "daily";
  habitState.icon = habit ? habit.icon : "flame";
  habitState.color = habit ? habit.color : COLORS[4];
  habitState.every = habit && habit.every ? habit.every : 40;
  habitState.next = habit && habit.next ? habit.next : todayKey();
  habitState.remind = habit && habit.remind != null ? habit.remind : null;
  $("#habit-sheet-title").textContent = habit ? "Edit habit" : "New habit";
  $("#habit-save").textContent = habit ? "Save habit" : "Create habit";
  $("#habit-input").value = habit ? habit.name : "";
  $("#habit-edit-extras").hidden = !habit;
  const sameType = habit ? state.habits.filter((h) => h.type === habit.type).length : 0;
  $("#habit-reorder").hidden = !habit || sameType < 2;
  if (habit) updateHabitReorder();
  $$("#habit-type-seg .seg-btn").forEach((b) => { b.classList.toggle("active", b.dataset.htype === habitState.type); b.disabled = !!habit; });
  syncHabitType();
  renderSwatchRow($("#habit-colors"), habitState.color);
  renderIconGrid($("#habit-icons"), habitState.icon, habitState.color);
  updateHabitSave();
  openSheet("sheet-habit");
  if (!habit) setTimeout(() => $("#habit-input").focus(), 350);
}

export function openHabitSheetById(id) {
  const h = getHabitById(id);
  if (h) openHabitSheet(h);
}

function syncHabitType() {
  const interval = habitState.type === "interval";
  $("#habit-interval-fields").hidden = !interval;
  $("#habit-type-hint").textContent = interval
    ? "Reminds you on a cycle — e.g. every 40 days. Mark it done to start the next cycle."
    : "Check in each day you do it. Miss a day and the streak resets.";
  $("#habit-interval-val").textContent = habitState.every;
  $("#habit-next").value = habitState.next;
  renderRemind("#habit-remind", habitState.remind);
  if (!habitState.editId) $("#habit-save").textContent = "Create habit";
}

export function setHabitType(el) {
  if (el.disabled) return;
  habitState.type = el.dataset.htype;
  $$("#habit-type-seg .seg-btn").forEach((b) => b.classList.toggle("active", b === el));
  syncHabitType();
}

export function stepHabitInterval(delta) {
  habitState.every = clamp(habitState.every + delta, 1, 365);
  $("#habit-interval-val").textContent = habitState.every;
}

function updateHabitSave() {
  $("#habit-save").disabled = !$("#habit-input").value.trim();
}

function saveHabit() {
  const name = $("#habit-input").value.trim();
  if (!name) return;
  if (habitState.editId) {
    const h = getHabitById(habitState.editId);
    if (h) {
      h.name = name; h.icon = habitState.icon; h.color = habitState.color;
      if (h.type === "interval") { h.every = habitState.every; h.next = habitState.next; h.remind = habitState.remind; }
    }
  } else if (habitState.type === "daily") {
    state.habits.push({ id: uid(), type: "daily", name, icon: habitState.icon, color: habitState.color, log: {}, createdAt: Date.now() });
  } else {
    state.habits.push({ id: uid(), type: "interval", name, icon: habitState.icon, color: habitState.color, every: habitState.every, next: habitState.next, last: null, remind: habitState.remind, createdAt: Date.now() });
  }
  save();
  closeSheets();
  renderActive();
  toast(habitState.editId ? "Habit updated" : "Habit created");
}

function deleteHabit() {
  state.habits = state.habits.filter((h) => h.id !== habitState.editId);
  save();
  closeSheets();
  renderActive();
  toast("Habit deleted");
}

export function updateHabitReorder() {
  const cur = state.habits.findIndex((h) => h.id === habitState.editId);
  const up = $('[data-act="habit-move-up"]'), down = $('[data-act="habit-move-down"]');
  if (cur < 0) { up.disabled = down.disabled = true; return; }
  const type = state.habits[cur].type;
  up.disabled = !state.habits.slice(0, cur).some((h) => h.type === type);
  down.disabled = !state.habits.slice(cur + 1).some((h) => h.type === type);
}

export function moveHabit(dir) {
  const cur = state.habits.findIndex((h) => h.id === habitState.editId);
  if (cur < 0) return;
  const type = state.habits[cur].type;
  let j = cur + dir;
  while (j >= 0 && j < state.habits.length && state.habits[j].type !== type) j += dir;
  if (j < 0 || j >= state.habits.length) return;
  const tmp = state.habits[cur];
  state.habits[cur] = state.habits[j];
  state.habits[j] = tmp;
  save();
  renderActive();
  updateHabitReorder();
  toast(dir < 0 ? "Moved up" : "Moved down");
}

export function initHabitsUI() {
  $("#habit-input").addEventListener("input", updateHabitSave);
  $("#habit-save").addEventListener("click", saveHabit);
  $("#habit-delete").addEventListener("click", deleteHabit);
  $("#habit-next").addEventListener("change", (e) => { habitState.next = e.target.value || todayKey(); });
}

registerRenderer("habits", renderHabits);
