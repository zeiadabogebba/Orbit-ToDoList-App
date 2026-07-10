import { $, $$, esc, icon, uid } from "../core/dom.js";
import { todayKey, addDays, deadlineLabel } from "../core/dates.js";
import { state, save } from "../state/store.js";
import { openSheet, closeSheets, registerPickTarget, renderRemind } from "../ui/sheets.js";
import { registerRenderer, renderActive } from "../ui/render-bus.js";
import { toast } from "../ui/toast.js";
import { celebrate } from "../ui/celebration.js";
import { catOf, isManaging, openCatSheet, openCatEdit, onCategoryDeleted } from "./categories.js";

let filterCat = null;

const taskState = { editId: null, catId: null, deadline: null, time: null, note: "", subtasks: [], remind: null };

registerPickTarget("sheet-task", { getItem: () => taskState, remindSel: "#task-remind" });
onCategoryDeleted((id) => { if (filterCat === id) filterCat = null; });

export function getTaskById(id) {
  return state.tasks.find((t) => t.id === id) || null;
}

export function setTaskFilter(id) {
  filterCat = id;
  renderTasks();
}

export function resetTaskFilter() {
  filterCat = null;
}

export function handleCategoryFilterClick(id) {
  if (isManaging() && id) {
    const category = catOf(id);
    if (category) openCatEdit(category);
    return;
  }
  setTaskFilter(id);
}

function emptyState(iconId, title, text) {
  return `<div class="empty"><div class="e-ico">${icon(iconId)}</div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;
}

export function renderTasks() {
  const filterBar = $("#cat-filter");
  const managing = isManaging();
  let chips = `<button class="cat-chip ${filterCat === null ? "active" : ""}" data-filter="">All</button>`;
  state.categories.forEach((c) => {
    const tag = managing ? icon("edit") : `<span class="swatch-dot"></span>`;
    chips += `<button class="cat-chip ${filterCat === c.id && !managing ? "active" : ""} ${managing ? "editing" : ""}" data-filter="${c.id}" style="--c:${c.color}">${tag}${esc(c.name)}</button>`;
  });
  chips += `<button class="cat-chip add" data-act="new-cat-manage">${icon("plus")}New</button>`;
  if (state.categories.length) chips += `<button class="cat-chip manage ${managing ? "on" : ""}" data-act="toggle-manage">${icon(managing ? "check" : "edit")}${managing ? "Done" : "Edit"}</button>`;
  filterBar.innerHTML = chips;

  const matchesFilter = (t) => filterCat === null || t.catId === filterCat;
  const active = state.tasks.filter((t) => !t.done && matchesFilter(t));
  const done = state.tasks.filter((t) => t.done && matchesFilter(t));

  active.sort((a, b) => {
    if (a.deadline && b.deadline) {
      if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
      const ta = a.time || "99:99", tb = b.time || "99:99";
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return b.createdAt - a.createdAt;
  });
  done.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  const total = active.length + done.length;
  const ring = $("#tasks-progress");
  if (total) {
    const frac = done.length / total;
    ring.style.setProperty("--p", frac.toFixed(3));
    ring.style.setProperty("--c", "var(--type-habit)");
    ring.innerHTML = `<b>${Math.round(frac * 100)}%</b>`;
    ring.hidden = false;
    $("#tasks-sub").textContent = `${done.length} of ${total} done`;
  } else {
    ring.hidden = true;
    $("#tasks-sub").textContent = "Let's get things done";
  }

  const list = $("#task-list");
  list.innerHTML = active.length
    ? active.map(taskRow).join("")
    : emptyState("tasks", filterCat ? "Nothing here" : "All clear", filterCat ? "No tasks in this category yet." : "Tap + to add your first task and start your orbit.");

  const block = $("#completed-block");
  if (done.length) {
    block.hidden = false;
    $("#completed-count").textContent = done.length;
    $("#task-completed").innerHTML = done.map(taskRow).join("");
  } else {
    block.hidden = true;
  }
}

export function taskRow(t) {
  const c = catOf(t.catId);
  const colorVar = c ? ` style="--c:${c.color}"` : "";
  const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
  let meta = "";
  if (c) meta += `<span class="task-cat" style="--c:${c.color}"><i></i>${esc(c.name)}</span>`;
  if (t.deadline && !t.done) {
    const label = deadlineLabel(t);
    meta += `<span class="deadline-badge ${label.cls}">${icon(label.icon)}${label.text}</span>`;
  }
  if (subtasks.length) meta += `<span class="deadline-badge">${icon("check")}${subtasks.filter((s) => s.done).length}/${subtasks.length}</span>`;
  const noteHtml = t.note ? `<div class="task-note">${icon("edit")}<span>${esc(t.note)}</span></div>` : "";
  const subtaskHtml = subtasks.length
    ? `<div class="task-subs">${subtasks.map((s) => `<button class="subtask ${s.done ? "on" : ""}" data-subtoggle="${t.id}|${s.id}"><span class="sub-box">${icon("check")}</span><span>${esc(s.title)}</span></button>`).join("")}</div>`
    : "";
  return `<div class="task ${t.done ? "done" : ""}"${colorVar}>
    <button class="task-check" data-toggle="${t.id}" aria-label="${t.done ? "Mark not done" : "Mark done"}">${icon("check")}</button>
    <div class="task-main">
      <div class="task-name">${esc(t.title)}</div>
      ${noteHtml}
      ${meta ? `<div class="task-meta">${meta}</div>` : ""}
      ${subtaskHtml}
    </div>
    <button class="task-edit" data-edit-task="${t.id}" aria-label="Edit task">${icon("edit")}</button>
  </div>`;
}

export function toggleSubtask(taskId, subId) {
  const t = getTaskById(taskId);
  if (!t || !Array.isArray(t.subtasks)) return;
  const sub = t.subtasks.find((s) => s.id === subId);
  if (!sub) return;
  sub.done = !sub.done;
  save();
  if (sub.done) celebrate(null, 18);
  renderActive();
}

export function toggleTask(id, btn) {
  const t = getTaskById(id);
  if (!t) return;
  const wasTodayDue = !t.done && t.deadline && t.deadline <= todayKey();
  t.done = !t.done;
  t.completedAt = t.done ? Date.now() : null;
  if (t.done && btn) btn.classList.add("burst");
  save();
  if (t.done) {
    const remaining = state.tasks.some((x) => !x.done && x.deadline && x.deadline <= todayKey());
    if (wasTodayDue && !remaining) celebrate("All done for today! 🎉", 70);
    else celebrate("Nice — task done ✦", 34);
  }
  renderActive();
}

export function openTaskSheet(task) {
  taskState.editId = task ? task.id : null;
  taskState.catId = task ? task.catId : filterCat || null;
  taskState.deadline = task ? task.deadline || null : null;
  taskState.time = task ? task.time || null : null;
  taskState.note = task ? task.note || "" : "";
  taskState.subtasks = task && Array.isArray(task.subtasks) ? task.subtasks.map((s) => ({ ...s })) : [];
  taskState.remind = task && task.remind != null ? task.remind : null;
  $("#task-title").textContent = task ? "Edit task" : "New task";
  $("#task-input").value = task ? task.title : "";
  $("#task-note").value = taskState.note;
  $("#subtask-input").value = "";
  $("#task-save").textContent = task ? "Save task" : "Add task";
  $("#task-edit-extras").hidden = !task;
  renderTaskCats();
  renderDeadlineRow();
  renderSubtaskEditor();
  updateTaskSave();
  openSheet("sheet-task");
  if (!task) setTimeout(() => $("#task-input").focus(), 350);
}

export function openTaskSheetById(id) {
  const t = getTaskById(id);
  if (t) openTaskSheet(t);
}

export function openNewCategoryFromTask() {
  openCatSheet((newId) => {
    taskState.catId = newId;
    openTaskSheet(taskState.editId ? getTaskById(taskState.editId) : null);
  });
}

function renderSubtaskEditor() {
  $("#subtask-list").innerHTML = taskState.subtasks.map((s, i) =>
    `<div class="subtask-row">
      <button class="sb-check ${s.done ? "on" : ""}" data-sbtoggle="${i}" aria-label="Toggle done">${icon("check")}</button>
      <input type="text" class="field" data-sbedit="${i}" value="${esc(s.title)}" maxlength="80" aria-label="Subtask" />
      <button class="sb-del" data-sbdel="${i}" aria-label="Remove">${icon("x")}</button>
    </div>`
  ).join("");
}

function syncSubtasks() {
  $$("#subtask-list [data-sbedit]").forEach((input) => {
    const i = +input.dataset.sbedit;
    if (taskState.subtasks[i]) taskState.subtasks[i].title = input.value;
  });
}

export function addSubtask() {
  const input = $("#subtask-input");
  const value = input.value.trim();
  if (!value) return;
  syncSubtasks();
  taskState.subtasks.push({ id: uid(), title: value, done: false });
  input.value = "";
  renderSubtaskEditor();
  input.focus();
}

export function toggleSubtaskEditorDone(index) {
  syncSubtasks();
  if (taskState.subtasks[index]) taskState.subtasks[index].done = !taskState.subtasks[index].done;
  renderSubtaskEditor();
}

export function removeSubtaskEditorRow(index) {
  syncSubtasks();
  taskState.subtasks.splice(index, 1);
  renderSubtaskEditor();
}

function renderTaskCats() {
  let html = state.categories.map((c) =>
    `<button class="pick-chip ${taskState.catId === c.id ? "sel" : ""}" data-pickcat="${c.id}" style="--c:${c.color}"><i></i>${esc(c.name)}</button>`
  ).join("");
  html += `<button class="pick-chip add" data-act="new-cat-from-task">${icon("plus")}New</button>`;
  $("#task-cats").innerHTML = html;
}

export function pickTaskCategory(catId) {
  taskState.catId = taskState.catId === catId ? null : catId;
  renderTaskCats();
}

function renderDeadlineRow() {
  const dl = taskState.deadline;
  const t = todayKey(), tomorrow = addDays(todayKey(), 1);
  $$("#sheet-task [data-deadline]").forEach((b) => {
    const k = b.dataset.deadline;
    b.classList.toggle("sel", (k === "none" && !dl) || (k === "today" && dl === t) || (k === "tomorrow" && dl === tomorrow));
  });
  $("#task-deadline").value = dl || "";
  $("#task-time-row").hidden = !dl;
  $("#task-remind-wrap").hidden = !dl;
  if (!dl) { taskState.time = null; taskState.remind = null; }
  $("#task-time").value = taskState.time || "";
  renderRemind("#task-remind", taskState.remind);
}

export function setTaskDeadlineQuick(kind) {
  taskState.deadline = kind === "none" ? null : kind === "today" ? todayKey() : addDays(todayKey(), 1);
  renderDeadlineRow();
}

export function clearTaskTime() {
  taskState.time = null;
  $("#task-time").value = "";
}

function updateTaskSave() {
  $("#task-save").disabled = !$("#task-input").value.trim();
}

export function saveTask() {
  const title = $("#task-input").value.trim();
  if (!title) return;
  const time = taskState.deadline ? taskState.time : null;
  const note = $("#task-note").value.trim();
  syncSubtasks();
  const subtasks = taskState.subtasks.map((s) => ({ id: s.id, title: s.title.trim(), done: !!s.done })).filter((s) => s.title);
  const remind = taskState.deadline ? taskState.remind : null;
  if (taskState.editId) {
    const t = getTaskById(taskState.editId);
    if (t) { t.title = title; t.catId = taskState.catId; t.deadline = taskState.deadline; t.time = time; t.note = note; t.subtasks = subtasks; t.remind = remind; }
  } else {
    state.tasks.push({ id: uid(), title, catId: taskState.catId, deadline: taskState.deadline, time, note, subtasks, remind, done: false, completedAt: null, createdAt: Date.now() });
  }
  save();
  closeSheets();
  renderActive();
  toast(taskState.editId ? "Task updated" : "Task added");
}

export function deleteTask() {
  state.tasks = state.tasks.filter((t) => t.id !== taskState.editId);
  save();
  closeSheets();
  renderActive();
  toast("Task deleted");
}

let clearArmTimer = null;

export function clearCompleted() {
  const btn = $("#clear-completed");
  const matchesFilter = (t) => filterCat === null || t.catId === filterCat;
  if (!btn.classList.contains("armed")) {
    btn.classList.add("armed");
    btn.textContent = "Clear all?";
    clearArmTimer = setTimeout(() => { btn.classList.remove("armed"); btn.textContent = "Clear"; }, 3000);
    return;
  }
  clearTimeout(clearArmTimer);
  btn.classList.remove("armed");
  btn.textContent = "Clear";
  state.tasks = state.tasks.filter((t) => !(t.done && matchesFilter(t)));
  save();
  renderTasks();
  toast("Completed cleared");
}

export function autoArchiveCompleted() {
  const cutoff = Date.now() - 30 * 864e5;
  const before = state.tasks.length;
  state.tasks = state.tasks.filter((t) => !(t.done && t.completedAt && t.completedAt < cutoff));
  if (state.tasks.length !== before) save();
}

export function initTasksUI() {
  $("#task-input").addEventListener("input", updateTaskSave);
  $("#task-save").addEventListener("click", saveTask);
  $("#task-delete").addEventListener("click", deleteTask);
  $("#task-deadline").addEventListener("change", (e) => { taskState.deadline = e.target.value || null; renderDeadlineRow(); });
  $("#task-time").addEventListener("change", (e) => { taskState.time = e.target.value || null; });
  $("#subtask-add-btn").addEventListener("click", addSubtask);
  $("#subtask-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } });
  $("#clear-completed").addEventListener("click", clearCompleted);
  $("#completed-toggle").addEventListener("click", () => {
    const t = $("#completed-toggle");
    t.setAttribute("aria-expanded", t.getAttribute("aria-expanded") === "true" ? "false" : "true");
  });
}

registerRenderer("tasks", renderTasks);
