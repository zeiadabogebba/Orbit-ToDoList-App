import { $, esc, icon, uid } from "../core/dom.js";
import { todayKey, daysBetween, niceDate } from "../core/dates.js";
import { COLORS } from "../core/constants.js";
import { state, save } from "../state/store.js";
import { openSheet, closeSheets, renderSwatchRow, renderIconGrid, renderRemind, registerPickTarget } from "../ui/sheets.js";
import { registerRenderer, renderActive } from "../ui/render-bus.js";
import { toast } from "../ui/toast.js";
import { celebrate } from "../ui/celebration.js";

const cdState = { editId: null, icon: "sparkles", color: COLORS[1], remind: null };

registerPickTarget("sheet-countdown", { getItem: () => cdState, colorsSel: "#cd-colors", iconsSel: "#cd-icons", remindSel: "#cd-remind" });

function emptyState(iconId, title, text) {
  return `<div class="empty"><div class="e-ico">${icon(iconId)}</div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;
}

export function getCountdownById(id) {
  return state.countdowns.find((c) => c.id === id) || null;
}

export function renderCountdowns() {
  const active = state.countdowns.filter((c) => !c.done);
  const done = state.countdowns.filter((c) => c.done);
  let html = "";
  if (active.length) html += active.map(cdCard).join("");
  else if (!done.length) html += emptyState("hourglass", "Nothing to count down", "Add a trip, a birthday, a release — anything you're waiting for.");
  if (done.length) html += `<h3 class="group-label" style="margin:18px 0 0">Done</h3>` + done.map(cdCard).join("");
  $("#countdown-list").innerHTML = html;
}

function cdCard(cd) {
  const diff = daysBetween(todayKey(), cd.date);
  let when;
  if (cd.done) when = `<div class="cd-when done-when"><b>Done</b></div>`;
  else if (diff > 0) when = `<div class="cd-when"><b>${diff}</b><small>day${diff > 1 ? "s" : ""} left</small></div>`;
  else if (diff === 0) when = `<div class="cd-when is-today"><b>Today</b><small>🎉</small></div>`;
  else when = `<div class="cd-when passed"><b>${-diff}d</b><small>ago</small></div>`;
  return `<div class="cd-card ${cd.done ? "done" : ""}" style="--c:${cd.color}" data-edit-cd="${cd.id}">
    <div class="cd-icon">${icon(cd.icon)}</div>
    <div class="cd-main"><div class="cd-title">${esc(cd.title)}</div><div class="cd-date">${niceDate(cd.date)}</div></div>
    ${when}
    <button class="cd-check ${cd.done ? "on" : ""}" data-cd-toggle="${cd.id}" aria-label="${cd.done ? "Mark not done" : "Mark done"}">${icon("check")}</button>
  </div>`;
}

export function toggleCountdown(id, btn) {
  const cd = getCountdownById(id);
  if (!cd) return;
  cd.done = !cd.done;
  cd.completedAt = cd.done ? Date.now() : null;
  save();
  if (cd.done) { if (btn) btn.classList.add("burst"); celebrate("Countdown done ✦", 34); }
  renderActive();
}

export function openCdSheet(cd) {
  cdState.editId = cd ? cd.id : null;
  cdState.icon = cd ? cd.icon : "sparkles";
  cdState.color = cd ? cd.color : COLORS[1];
  cdState.remind = cd && cd.remind != null ? cd.remind : null;
  $("#cd-sheet-title").textContent = cd ? "Edit countdown" : "New countdown";
  $("#cd-save").textContent = cd ? "Save countdown" : "Add countdown";
  $("#cd-input").value = cd ? cd.title : "";
  $("#cd-date").value = cd ? cd.date : todayKey();
  $("#cd-edit-extras").hidden = !cd;
  $("#cd-reorder").hidden = !cd || state.countdowns.length < 2;
  if (cd) updateCdReorder();
  renderRemind("#cd-remind", cdState.remind);
  renderSwatchRow($("#cd-colors"), cdState.color);
  renderIconGrid($("#cd-icons"), cdState.icon, cdState.color);
  updateCdSave();
  openSheet("sheet-countdown");
  if (!cd) setTimeout(() => $("#cd-input").focus(), 350);
}

export function openCdSheetById(id) {
  const cd = getCountdownById(id);
  if (cd) openCdSheet(cd);
}

function updateCdSave() {
  $("#cd-save").disabled = !($("#cd-input").value.trim() && $("#cd-date").value);
}

function saveCd() {
  const title = $("#cd-input").value.trim(), date = $("#cd-date").value;
  if (!title || !date) return;
  if (cdState.editId) {
    const cd = getCountdownById(cdState.editId);
    if (cd) { cd.title = title; cd.date = date; cd.icon = cdState.icon; cd.color = cdState.color; cd.remind = cdState.remind; }
  } else {
    state.countdowns.push({ id: uid(), title, date, icon: cdState.icon, color: cdState.color, remind: cdState.remind, createdAt: Date.now() });
  }
  save();
  closeSheets();
  renderActive();
  toast(cdState.editId ? "Countdown updated" : "Countdown added");
}

function deleteCd() {
  state.countdowns = state.countdowns.filter((c) => c.id !== cdState.editId);
  save();
  closeSheets();
  renderActive();
  toast("Countdown deleted");
}

export function updateCdReorder() {
  const i = state.countdowns.findIndex((c) => c.id === cdState.editId);
  $('[data-act="cd-move-up"]').disabled = i <= 0;
  $('[data-act="cd-move-down"]').disabled = i < 0 || i >= state.countdowns.length - 1;
}

export function moveCd(dir) {
  const i = state.countdowns.findIndex((c) => c.id === cdState.editId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.countdowns.length) return;
  const tmp = state.countdowns[i];
  state.countdowns[i] = state.countdowns[j];
  state.countdowns[j] = tmp;
  save();
  renderActive();
  updateCdReorder();
  toast(dir < 0 ? "Moved up" : "Moved down");
}

export function initCountdownsUI() {
  $("#cd-input").addEventListener("input", updateCdSave);
  $("#cd-date").addEventListener("change", updateCdSave);
  $("#cd-save").addEventListener("click", saveCd);
  $("#cd-delete").addEventListener("click", deleteCd);
}

registerRenderer("countdowns", renderCountdowns);
