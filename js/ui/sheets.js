import { $, $$, icon } from "../core/dom.js";
import { COLORS, PICK_ICONS } from "../core/constants.js";

let openSheetId = null;

export function openSheet(id) {
  closeSheets(true);
  openSheetId = id;
  $("#backdrop").hidden = false;
  const sheet = $("#" + id);
  requestAnimationFrame(() => sheet.classList.add("open"));
}

export function closeSheets(silent) {
  $$(".sheet.open").forEach((s) => s.classList.remove("open"));
  if (!silent) $("#backdrop").hidden = true;
  openSheetId = silent ? openSheetId : null;
}

export function initSheetsGlobal() {
  $("#backdrop").addEventListener("click", () => closeSheets());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheets(); });
}

export function renderSwatchRow(el, selected) {
  el.innerHTML = COLORS.map((c) => `<button class="swatch ${c === selected ? "sel" : ""}" data-swatch="${c}" style="--c:${c}" aria-label="colour ${c}"></button>`).join("");
}

export function renderIconGrid(el, selected, color) {
  el.innerHTML = PICK_ICONS.map((ic) => `<button class="icon-opt ${ic === selected ? "sel" : ""}" data-iconpick="${ic}" style="--c:${color}" aria-label="${ic}">${icon(ic)}</button>`).join("");
}

export function renderRemind(sel, val) {
  $$(`${sel} [data-remind]`).forEach((b) => {
    const v = b.dataset.remind === "off" ? null : Number(b.dataset.remind);
    b.classList.toggle("sel", v === val);
  });
}

const pickTargets = {};

export function registerPickTarget(sheetId, config) {
  pickTargets[sheetId] = config;
}

export function pickColor(color) {
  const target = pickTargets[openSheetId];
  if (!target || !target.colorsSel) return;
  const item = target.getItem();
  item.color = color;
  renderSwatchRow($(target.colorsSel), color);
  if (target.iconsSel) renderIconGrid($(target.iconsSel), item.icon, color);
}

export function pickIcon(iconId) {
  const target = pickTargets[openSheetId];
  if (!target || !target.iconsSel) return;
  const item = target.getItem();
  item.icon = iconId;
  renderIconGrid($(target.iconsSel), iconId, item.color);
}

export function setRemind(el) {
  const target = pickTargets[openSheetId];
  if (!target || !target.remindSel) return;
  const value = el.dataset.remind === "off" ? null : Number(el.dataset.remind);
  target.getItem().remind = value;
  renderRemind(target.remindSel, value);
}
