import { $, esc, icon, uid } from "../core/dom.js";
import { todayKey, daysBetween, dateKey, niceMD, pad2 } from "../core/dates.js";
import { COLORS } from "../core/constants.js";
import { state, save } from "../state/store.js";
import { openSheet, closeSheets, renderSwatchRow, renderIconGrid, renderRemind, registerPickTarget } from "../ui/sheets.js";
import { registerRenderer, renderActive } from "../ui/render-bus.js";
import { toast } from "../ui/toast.js";

const evState = { editId: null, icon: "gift", color: COLORS[9], remind: null };

registerPickTarget("sheet-event", { getItem: () => evState, colorsSel: "#ev-colors", iconsSel: "#ev-icons", remindSel: "#ev-remind" });

function emptyState(iconId, title, text) {
  return `<div class="empty"><div class="e-ico">${icon(iconId)}</div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;
}

export function getEventById(id) {
  return state.events.find((e) => e.id === id) || null;
}

export function nextOccurrenceKey(ev) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const y = now.getFullYear();
  let d = new Date(y, ev.month - 1, ev.day);
  if (d < now) d = new Date(y + 1, ev.month - 1, ev.day);
  return dateKey(d);
}

export function renderEvents() {
  const list = state.events;
  $("#event-list").innerHTML = list.length
    ? list.map(evCard).join("")
    : emptyState("sparkles", "Yearly moments", "Birthdays, anniversaries, renewals — dates that come back every year.");
}

function evCard(ev) {
  const k = nextOccurrenceKey(ev);
  const diff = daysBetween(todayKey(), k);
  const when = diff === 0
    ? `<b>Today</b><small>🎉</small>`
    : `<b>${diff}</b><small>day${diff > 1 ? "s" : ""}</small>`;
  return `<div class="ev-card" style="--c:${ev.color}" data-edit-ev="${ev.id}">
    <div class="ev-icon">${icon(ev.icon)}</div>
    <div class="ev-main"><div class="ev-name">${esc(ev.title)}</div><div class="ev-date">${niceMD(ev.month, ev.day)} · every year</div></div>
    <div class="ev-when ${diff === 0 ? "is-today" : ""}">${when}</div>
  </div>`;
}

export function openEvSheet(ev) {
  evState.editId = ev ? ev.id : null;
  evState.icon = ev ? ev.icon : "gift";
  evState.color = ev ? ev.color : COLORS[9];
  evState.remind = ev && ev.remind != null ? ev.remind : null;
  $("#ev-sheet-title").textContent = ev ? "Edit yearly event" : "New yearly event";
  $("#ev-save").textContent = ev ? "Save event" : "Add event";
  $("#ev-input").value = ev ? ev.title : "";
  $("#ev-date").value = ev ? `${new Date().getFullYear()}-${pad2(ev.month)}-${pad2(ev.day)}` : todayKey();
  $("#ev-edit-extras").hidden = !ev;
  $("#ev-reorder").hidden = !ev || state.events.length < 2;
  if (ev) updateEvReorder();
  renderRemind("#ev-remind", evState.remind);
  renderSwatchRow($("#ev-colors"), evState.color);
  renderIconGrid($("#ev-icons"), evState.icon, evState.color);
  updateEvSave();
  openSheet("sheet-event");
  if (!ev) setTimeout(() => $("#ev-input").focus(), 350);
}

export function openEvSheetById(id) {
  const ev = getEventById(id);
  if (ev) openEvSheet(ev);
}

function updateEvSave() {
  $("#ev-save").disabled = !($("#ev-input").value.trim() && $("#ev-date").value);
}

function saveEv() {
  const title = $("#ev-input").value.trim(), dv = $("#ev-date").value;
  if (!title || !dv) return;
  const [, m, d] = dv.split("-").map(Number);
  if (evState.editId) {
    const ev = getEventById(evState.editId);
    if (ev) { ev.title = title; ev.month = m; ev.day = d; ev.icon = evState.icon; ev.color = evState.color; ev.remind = evState.remind; }
  } else {
    state.events.push({ id: uid(), title, month: m, day: d, icon: evState.icon, color: evState.color, remind: evState.remind, createdAt: Date.now() });
  }
  save();
  closeSheets();
  renderActive();
  toast(evState.editId ? "Event updated" : "Event added");
}

function deleteEv() {
  state.events = state.events.filter((e) => e.id !== evState.editId);
  save();
  closeSheets();
  renderActive();
  toast("Event deleted");
}

export function updateEvReorder() {
  const i = state.events.findIndex((e) => e.id === evState.editId);
  $('[data-act="ev-move-up"]').disabled = i <= 0;
  $('[data-act="ev-move-down"]').disabled = i < 0 || i >= state.events.length - 1;
}

export function moveEv(dir) {
  const i = state.events.findIndex((e) => e.id === evState.editId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.events.length) return;
  const tmp = state.events[i];
  state.events[i] = state.events[j];
  state.events[j] = tmp;
  save();
  renderActive();
  updateEvReorder();
  toast(dir < 0 ? "Moved up" : "Moved down");
}

export function initEventsUI() {
  $("#ev-input").addEventListener("input", updateEvSave);
  $("#ev-date").addEventListener("change", updateEvSave);
  $("#ev-save").addEventListener("click", saveEv);
  $("#ev-delete").addEventListener("click", deleteEv);
}

registerRenderer("events", renderEvents);
