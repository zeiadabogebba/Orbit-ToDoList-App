import { $ } from "../core/dom.js";
import { COLORS } from "../core/constants.js";
import { uid } from "../core/dom.js";
import { state, save } from "../state/store.js";
import { openSheet, closeSheets, renderSwatchRow, registerPickTarget } from "../ui/sheets.js";
import { renderActive } from "../ui/render-bus.js";
import { toast } from "../ui/toast.js";

const catState = { editId: null, color: COLORS[0], onCreated: null };
let managing = false;

const deletionListeners = [];
export function onCategoryDeleted(fn) {
  deletionListeners.push(fn);
}

registerPickTarget("sheet-cat", { getItem: () => catState, colorsSel: "#cat-colors" });

export function catOf(id) {
  return state.categories.find((c) => c.id === id) || null;
}

export function isManaging() {
  return managing;
}

export function toggleCategoryManaging() {
  managing = !managing;
  renderActive();
}

export function resetCategoryManaging() {
  managing = false;
}

export function openCatSheet(onCreated) {
  catState.editId = null;
  catState.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  catState.onCreated = onCreated || null;
  $("#cat-sheet-title").textContent = "New category";
  $("#cat-save").textContent = "Create category";
  $("#cat-input").value = "";
  $("#cat-edit-extras").hidden = true;
  $("#cat-reorder").hidden = true;
  renderSwatchRow($("#cat-colors"), catState.color);
  updateCatSave();
  openSheet("sheet-cat");
  setTimeout(() => $("#cat-input").focus(), 350);
}

export function openCatEdit(category) {
  catState.editId = category.id;
  catState.color = category.color;
  catState.onCreated = null;
  $("#cat-sheet-title").textContent = "Edit category";
  $("#cat-save").textContent = "Save category";
  $("#cat-input").value = category.name;
  $("#cat-edit-extras").hidden = false;
  $("#cat-reorder").hidden = state.categories.length < 2;
  updateCatReorder();
  renderSwatchRow($("#cat-colors"), catState.color);
  updateCatSave();
  openSheet("sheet-cat");
}

export function updateCatReorder() {
  const i = state.categories.findIndex((c) => c.id === catState.editId);
  $('[data-act="cat-move-left"]').disabled = i <= 0;
  $('[data-act="cat-move-right"]').disabled = i < 0 || i >= state.categories.length - 1;
}

export function moveCat(dir) {
  const i = state.categories.findIndex((c) => c.id === catState.editId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.categories.length) return;
  const [c] = state.categories.splice(i, 1);
  state.categories.splice(j, 0, c);
  save();
  renderActive();
  updateCatReorder();
  toast(dir < 0 ? "Moved earlier" : "Moved later");
}

function updateCatSave() {
  $("#cat-save").disabled = !$("#cat-input").value.trim();
}

function saveCat() {
  const name = $("#cat-input").value.trim();
  if (!name) return;
  let newId = null;
  if (catState.editId) {
    const c = catOf(catState.editId);
    if (c) { c.name = name; c.color = catState.color; }
  } else {
    newId = uid();
    state.categories.push({ id: newId, name, color: catState.color });
  }
  save();
  const onCreated = catState.onCreated;
  closeSheets();
  if (newId && onCreated) onCreated(newId);
  else renderActive();
  toast(catState.editId ? "Category updated" : "Category created");
}

function deleteCat() {
  const id = catState.editId;
  state.categories = state.categories.filter((c) => c.id !== id);
  state.tasks.forEach((t) => { if (t.catId === id) t.catId = null; });
  deletionListeners.forEach((fn) => fn(id));
  save();
  closeSheets();
  renderActive();
  toast("Category deleted");
}

export function initCategoriesUI() {
  $("#cat-input").addEventListener("input", updateCatSave);
  $("#cat-save").addEventListener("click", saveCat);
  $("#cat-delete").addEventListener("click", deleteCat);
}
