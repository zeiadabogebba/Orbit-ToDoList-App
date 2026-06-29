/* ============================================================
   Orbit — app logic
   Vanilla JS. Data lives in localStorage. Optional Supabase sync.
   One delegated listener drives everything via data-* attributes.
   ============================================================ */

"use strict";

/* ---------------- tiny helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (id, cls = "") => `<svg class="ic${cls ? " " + cls : ""}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const tzGuess = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };

/* ---------------- date helpers (all keys are local YYYY-MM-DD) ---------------- */
const pad2 = (n) => String(n).padStart(2, "0");
const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayKey = () => dateKey(new Date());
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const niceDate = (k) => { const d = parseKey(k); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const niceShort = (k) => { const d = parseKey(k); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const niceMD = (m, d) => `${d} ${MONTHS[m - 1]}`;

function dueLabel(k) {
  const diff = daysBetween(todayKey(), k);
  if (diff < 0) return { text: diff === -1 ? "Yesterday" : `${-diff}d overdue`, cls: "overdue", icon: "clock" };
  if (diff === 0) return { text: "Today", cls: "today", icon: "clock" };
  if (diff === 1) return { text: "Tomorrow", cls: "soon", icon: "clock" };
  if (diff <= 3) return { text: `in ${diff}d`, cls: "soon", icon: "clock" };
  return { text: niceShort(k), cls: "", icon: "clock" };
}

// "14:30" -> locale-friendly time, e.g. "2:30 PM"
const fmtTime = (hm) => { const [h, m] = hm.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };

// badge for a task's deadline, factoring in an optional time
function deadlineLabel(t) {
  const k = t.deadline; if (!k) return null;
  if (!t.time) return dueLabel(k);
  const dayDiff = daysBetween(todayKey(), k);
  const ts = fmtTime(t.time);
  if (dayDiff < 0) return { text: dayDiff === -1 ? `Yesterday · ${ts}` : `${-dayDiff}d overdue`, cls: "overdue", icon: "clock" };
  if (dayDiff === 0) {
    const now = new Date();
    const [h, m] = t.time.split(":").map(Number);
    const passed = now.getHours() * 60 + now.getMinutes() > h * 60 + m;
    return { text: `${passed ? "Overdue" : "Today"} · ${ts}`, cls: passed ? "overdue" : "today", icon: "clock" };
  }
  if (dayDiff === 1) return { text: `Tomorrow · ${ts}`, cls: "soon", icon: "clock" };
  return { text: `${niceShort(k)} · ${ts}`, cls: dayDiff <= 3 ? "soon" : "", icon: "clock" };
}

/* ---------------- state ---------------- */
const LS_KEY = "orbit-v1";
const THEME_KEY = "orbit-theme";

const COLORS = ["#8b5cf6", "#6d5cff", "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#f59e0b", "#fb923c", "#fb7185", "#ec4899", "#d946ef", "#f43f5e"];
const PICK_ICONS = ["flame", "droplet", "dumbbell", "book", "activity", "bed", "leaf", "coffee", "heart", "star", "music", "target", "brush", "code", "camera", "gift", "cake", "plane", "car", "home", "cart", "grad-cap", "briefcase", "pill", "cup-soda", "pizza", "smartphone", "laptop", "cat", "scissors", "sun", "sparkles", "clock", "bell", "tag"];

const TYPE_TOKEN = { task: "--type-task", cd: "--type-cd", habit: "--type-habit", event: "--type-event" };

function freshState() {
  const c = (name, color) => ({ id: uid(), name, color });
  return {
    v: 1,
    categories: [c("Personal", "#8b5cf6"), c("Work", "#3b82f6"), c("Health", "#10b981"), c("Errands", "#fb923c")],
    tasks: [],
    habits: [],
    countdowns: [],
    events: [],
    reminders: { dailyDigest: { on: false, time: "09:00" }, tz: tzGuess() },
    updatedAt: Date.now(),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return freshState();
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return freshState();
    // be defensive about shape
    s.categories = Array.isArray(s.categories) ? s.categories : [];
    s.tasks = Array.isArray(s.tasks) ? s.tasks : [];
    s.habits = Array.isArray(s.habits) ? s.habits : [];
    s.countdowns = Array.isArray(s.countdowns) ? s.countdowns : [];
    s.events = Array.isArray(s.events) ? s.events : [];
    if (!s.reminders || typeof s.reminders !== "object") s.reminders = { dailyDigest: { on: false, time: "09:00" }, tz: tzGuess() };
    if (!s.reminders.dailyDigest) s.reminders.dailyDigest = { on: false, time: "09:00" };
    if (!s.reminders.tz) s.reminders.tz = tzGuess();
    return s;
  } catch { return freshState(); }
}

let state = load();

function save() {
  state.updatedAt = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  schedulePush();
  updateBadge();
}

/* app-icon badge: count of tasks due/overdue + interval habits due/overdue */
function updateBadge() {
  if (!("setAppBadge" in navigator)) return;
  const t = todayKey();
  const n = state.tasks.filter((x) => !x.done && x.deadline && x.deadline <= t).length
    + state.habits.filter((h) => h.type === "interval" && daysBetween(t, h.next) <= 0).length;
  try { n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch {}
}

function hasData() {
  return state.tasks.length || state.habits.length || state.countdowns.length || state.events.length;
}

/* ---------------- view state ---------------- */
let activeTab = "tasks";
let filterCat = null;            // category id or null (tasks filter)
let manageCats = false;          // category edit mode on the Tasks screen
let calY, calM;                  // calendar view (calM 0-based)
{ const d = new Date(); calY = d.getFullYear(); calM = d.getMonth(); }

let openSheetId = null;

/* per-sheet working state */
let taskState = { editId: null, catId: null, deadline: null, time: null, note: "", subtasks: [], remind: null };
let catState = { editId: null, color: COLORS[0] };
let habitState = { editId: null, type: "daily", icon: "flame", color: COLORS[4], every: 40, next: todayKey(), remind: null };
let cdState = { editId: null, icon: "sparkles", color: COLORS[1], remind: null };
let evState = { editId: null, icon: "gift", color: COLORS[9], remind: null };

// highlight the selected reminder pill in a remind-row
function renderRemind(sel, val) {
  $$(`${sel} [data-remind]`).forEach((b) => {
    const v = b.dataset.remind === "off" ? null : Number(b.dataset.remind);
    b.classList.toggle("sel", v === val);
  });
}
const remindFromData = (d) => (d === "off" ? null : Number(d));
function setRemind(el) {
  const val = remindFromData(el.dataset.remind);
  const id = (el.closest(".sheet") || {}).id;
  if (id === "sheet-task") { taskState.remind = val; renderRemind("#task-remind", val); }
  else if (id === "sheet-countdown") { cdState.remind = val; renderRemind("#cd-remind", val); }
  else if (id === "sheet-event") { evState.remind = val; renderRemind("#ev-remind", val); }
  else if (id === "sheet-habit") { habitState.remind = val; renderRemind("#habit-remind", val); }
}

const catOf = (id) => state.categories.find((c) => c.id === id) || null;

/* ============================================================
   RENDER DISPATCH
   ============================================================ */
function renderActive() {
  if (activeTab === "today") renderToday();
  else if (activeTab === "tasks") renderTasks();
  else if (activeTab === "habits") renderHabits();
  else if (activeTab === "countdowns") renderCountdowns();
  else if (activeTab === "events") renderEvents();
  else if (activeTab === "calendar") renderCalendar();
}

function emptyState(ic, title, text) {
  return `<div class="empty"><div class="e-ico">${icon(ic)}</div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;
}

/* ============================================================
   TODAY (home)
   ============================================================ */
function renderToday() {
  const t = todayKey();
  $("#today-date").textContent = parseKey(t).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  const dueTasks = state.tasks.filter((x) => !x.done && x.deadline && x.deadline <= t)
    .sort((a, b) => a.deadline !== b.deadline ? (a.deadline < b.deadline ? -1 : 1) : ((a.time || "99:99") < (b.time || "99:99") ? -1 : 1));
  const daily = state.habits.filter((h) => h.type === "daily");
  const intervalDue = state.habits.filter((h) => h.type === "interval" && daysBetween(t, h.next) <= 0);
  const soonCd = state.countdowns.filter((cd) => !cd.done).map((cd) => ({ cd, d: daysBetween(t, cd.date) })).filter((x) => x.d >= 0 && x.d <= 7).sort((a, b) => a.d - b.d);
  const soonEv = state.events.map((ev) => ({ ev, d: daysBetween(t, nextOccurrenceKey(ev)) })).filter((x) => x.d >= 0 && x.d <= 7).sort((a, b) => a.d - b.d);

  // progress ring: tasks due today/overdue + daily habits
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
  } else ring.hidden = true;

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

/* ============================================================
   TASKS
   ============================================================ */
function renderTasks() {
  // filter chips
  const fc = $("#cat-filter");
  if (!state.categories.length) manageCats = false;
  let chips = `<button class="cat-chip ${filterCat === null ? "active" : ""}" data-filter="">All</button>`;
  state.categories.forEach((c) => {
    const tag = manageCats ? icon("edit") : `<span class="swatch-dot"></span>`;
    chips += `<button class="cat-chip ${filterCat === c.id && !manageCats ? "active" : ""} ${manageCats ? "editing" : ""}" data-filter="${c.id}" style="--c:${c.color}">${tag}${esc(c.name)}</button>`;
  });
  chips += `<button class="cat-chip add" data-act="new-cat-manage">${icon("plus")}New</button>`;
  if (state.categories.length) chips += `<button class="cat-chip manage ${manageCats ? "on" : ""}" data-act="toggle-manage">${icon(manageCats ? "check" : "edit")}${manageCats ? "Done" : "Edit"}</button>`;
  fc.innerHTML = chips;

  const match = (t) => filterCat === null || t.catId === filterCat;
  const active = state.tasks.filter((t) => !t.done && match(t));
  const done = state.tasks.filter((t) => t.done && match(t));

  // sort active: deadline soonest first (no-deadline last), then by time, then newest
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

  // progress ring + sub
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

function taskRow(t) {
  const c = catOf(t.catId);
  const cv = c ? ` style="--c:${c.color}"` : "";
  const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
  let meta = "";
  if (c) meta += `<span class="task-cat" style="--c:${c.color}"><i></i>${esc(c.name)}</span>`;
  if (t.deadline && !t.done) { const d = deadlineLabel(t); meta += `<span class="deadline-badge ${d.cls}">${icon(d.icon)}${d.text}</span>`; }
  if (subs.length) meta += `<span class="deadline-badge">${icon("check")}${subs.filter((s) => s.done).length}/${subs.length}</span>`;
  const noteHtml = t.note ? `<div class="task-note">${icon("edit")}<span>${esc(t.note)}</span></div>` : "";
  const subHtml = subs.length
    ? `<div class="task-subs">${subs.map((s) => `<button class="subtask ${s.done ? "on" : ""}" data-subtoggle="${t.id}|${s.id}"><span class="sub-box">${icon("check")}</span><span>${esc(s.title)}</span></button>`).join("")}</div>`
    : "";
  return `<div class="task ${t.done ? "done" : ""}"${cv}>
    <button class="task-check" data-toggle="${t.id}" aria-label="${t.done ? "Mark not done" : "Mark done"}">${icon("check")}</button>
    <div class="task-main">
      <div class="task-name">${esc(t.title)}</div>
      ${noteHtml}
      ${meta ? `<div class="task-meta">${meta}</div>` : ""}
      ${subHtml}
    </div>
    <button class="task-edit" data-edit-task="${t.id}" aria-label="Edit task">${icon("edit")}</button>
  </div>`;
}

function toggleSubtask(taskId, subId) {
  const t = state.tasks.find((x) => x.id === taskId);
  if (!t || !Array.isArray(t.subtasks)) return;
  const s = t.subtasks.find((x) => x.id === subId);
  if (!s) return;
  s.done = !s.done;
  save();
  if (s.done) celebrate(null, 18);
  renderActive();
}

function toggleTask(id, btn) {
  const t = state.tasks.find((x) => x.id === id);
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

function openTaskSheet(task) {
  taskState.editId = task ? task.id : null;
  taskState.catId = task ? task.catId : (filterCat || null);
  taskState.deadline = task ? task.deadline || null : null;
  taskState.time = task ? task.time || null : null;
  taskState.note = task ? (task.note || "") : "";
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

function renderSubtaskEditor() {
  $("#subtask-list").innerHTML = taskState.subtasks.map((s, i) =>
    `<div class="subtask-row">
      <button class="sb-check ${s.done ? "on" : ""}" data-sbtoggle="${i}" aria-label="Toggle done">${icon("check")}</button>
      <input type="text" class="field" data-sbedit="${i}" value="${esc(s.title)}" maxlength="80" aria-label="Subtask" />
      <button class="sb-del" data-sbdel="${i}" aria-label="Remove">${icon("x")}</button>
    </div>`).join("");
}
function syncSubtasks() {
  $$("#subtask-list [data-sbedit]").forEach((inp) => { const i = +inp.dataset.sbedit; if (taskState.subtasks[i]) taskState.subtasks[i].title = inp.value; });
}
function addSubtask() {
  const inp = $("#subtask-input");
  const v = inp.value.trim();
  if (!v) return;
  syncSubtasks();
  taskState.subtasks.push({ id: uid(), title: v, done: false });
  inp.value = "";
  renderSubtaskEditor();
  inp.focus();
}

function renderTaskCats() {
  let html = state.categories.map((c) =>
    `<button class="pick-chip ${taskState.catId === c.id ? "sel" : ""}" data-pickcat="${c.id}" style="--c:${c.color}"><i></i>${esc(c.name)}</button>`
  ).join("");
  html += `<button class="pick-chip add" data-act="new-cat-from-task">${icon("plus")}New</button>`;
  $("#task-cats").innerHTML = html;
}

function renderDeadlineRow() {
  const dl = taskState.deadline;
  const t = todayKey(), tm = addDays(todayKey(), 1);
  $$("#sheet-task [data-deadline]").forEach((b) => {
    const k = b.dataset.deadline;
    b.classList.toggle("sel", (k === "none" && !dl) || (k === "today" && dl === t) || (k === "tomorrow" && dl === tm));
  });
  $("#task-deadline").value = dl || "";
  // time + reminder only make sense once there's a deadline date
  $("#task-time-row").hidden = !dl;
  $("#task-remind-wrap").hidden = !dl;
  if (!dl) { taskState.time = null; taskState.remind = null; }
  $("#task-time").value = taskState.time || "";
  renderRemind("#task-remind", taskState.remind);
}

function updateTaskSave() { $("#task-save").disabled = !$("#task-input").value.trim(); }

function saveTask() {
  const title = $("#task-input").value.trim();
  if (!title) return;
  const time = taskState.deadline ? taskState.time : null;
  const note = $("#task-note").value.trim();
  syncSubtasks();
  const subtasks = taskState.subtasks.map((s) => ({ id: s.id, title: s.title.trim(), done: !!s.done })).filter((s) => s.title);
  const remind = taskState.deadline ? taskState.remind : null;
  if (taskState.editId) {
    const t = state.tasks.find((x) => x.id === taskState.editId);
    if (t) { t.title = title; t.catId = taskState.catId; t.deadline = taskState.deadline; t.time = time; t.note = note; t.subtasks = subtasks; t.remind = remind; }
  } else {
    state.tasks.push({ id: uid(), title, catId: taskState.catId, deadline: taskState.deadline, time, note, subtasks, remind, done: false, completedAt: null, createdAt: Date.now() });
  }
  save();
  closeSheets();
  renderActive();
  toast(taskState.editId ? "Task updated" : "Task added");
}

function deleteTask() {
  state.tasks = state.tasks.filter((x) => x.id !== taskState.editId);
  save(); closeSheets(); renderActive(); toast("Task deleted");
}

let clearArmTimer = null;
function clearCompleted() {
  const b = $("#clear-completed");
  const match = (x) => filterCat === null || x.catId === filterCat;
  if (!b.classList.contains("armed")) {
    b.classList.add("armed"); b.textContent = "Clear all?";
    clearArmTimer = setTimeout(() => { b.classList.remove("armed"); b.textContent = "Clear"; }, 3000);
    return;
  }
  clearTimeout(clearArmTimer); b.classList.remove("armed"); b.textContent = "Clear";
  state.tasks = state.tasks.filter((x) => !(x.done && match(x)));
  save(); renderTasks(); toast("Completed cleared");
}

function autoArchiveCompleted() {
  const cutoff = Date.now() - 30 * 864e5;
  const before = state.tasks.length;
  state.tasks = state.tasks.filter((x) => !(x.done && x.completedAt && x.completedAt < cutoff));
  if (state.tasks.length !== before) save();
}

/* ---- categories ---- */
function openCatSheet(returnTo) {
  catState.editId = null;
  catState.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  catState.returnTo = returnTo || null;
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

function openCatEdit(c) {
  catState.editId = c.id;
  catState.color = c.color;
  catState.returnTo = null;
  $("#cat-sheet-title").textContent = "Edit category";
  $("#cat-save").textContent = "Save category";
  $("#cat-input").value = c.name;
  $("#cat-edit-extras").hidden = false;
  $("#cat-reorder").hidden = state.categories.length < 2;
  updateCatReorder();
  renderSwatchRow($("#cat-colors"), catState.color);
  updateCatSave();
  openSheet("sheet-cat");
}

function updateCatReorder() {
  const i = state.categories.findIndex((c) => c.id === catState.editId);
  $('[data-act="cat-move-left"]').disabled = i <= 0;
  $('[data-act="cat-move-right"]').disabled = i < 0 || i >= state.categories.length - 1;
}

function moveCat(dir) {
  const i = state.categories.findIndex((c) => c.id === catState.editId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.categories.length) return;
  const [c] = state.categories.splice(i, 1);
  state.categories.splice(j, 0, c);
  save();
  renderTasks();
  updateCatReorder();
  toast(dir < 0 ? "Moved earlier" : "Moved later");
}

const swap = (arr, i, j) => { const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; };

/* habits reorder — moves within the same type group (daily / interval) */
function updateHabitReorder() {
  const cur = state.habits.findIndex((h) => h.id === habitState.editId);
  const up = $('[data-act="habit-move-up"]'), down = $('[data-act="habit-move-down"]');
  if (cur < 0) { up.disabled = down.disabled = true; return; }
  const type = state.habits[cur].type;
  up.disabled = !state.habits.slice(0, cur).some((h) => h.type === type);
  down.disabled = !state.habits.slice(cur + 1).some((h) => h.type === type);
}
function moveHabit(dir) {
  const cur = state.habits.findIndex((h) => h.id === habitState.editId);
  if (cur < 0) return;
  const type = state.habits[cur].type;
  let j = cur + dir;
  while (j >= 0 && j < state.habits.length && state.habits[j].type !== type) j += dir;
  if (j < 0 || j >= state.habits.length) return;
  swap(state.habits, cur, j);
  save(); renderHabits(); updateHabitReorder();
  toast(dir < 0 ? "Moved up" : "Moved down");
}

function updateCdReorder() {
  const i = state.countdowns.findIndex((c) => c.id === cdState.editId);
  $('[data-act="cd-move-up"]').disabled = i <= 0;
  $('[data-act="cd-move-down"]').disabled = i < 0 || i >= state.countdowns.length - 1;
}
function moveCd(dir) {
  const i = state.countdowns.findIndex((c) => c.id === cdState.editId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.countdowns.length) return;
  swap(state.countdowns, i, j);
  save(); renderCountdowns(); updateCdReorder();
  toast(dir < 0 ? "Moved up" : "Moved down");
}

function updateEvReorder() {
  const i = state.events.findIndex((e) => e.id === evState.editId);
  $('[data-act="ev-move-up"]').disabled = i <= 0;
  $('[data-act="ev-move-down"]').disabled = i < 0 || i >= state.events.length - 1;
}
function moveEv(dir) {
  const i = state.events.findIndex((e) => e.id === evState.editId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.events.length) return;
  swap(state.events, i, j);
  save(); renderEvents(); updateEvReorder();
  toast(dir < 0 ? "Moved up" : "Moved down");
}

function updateCatSave() { $("#cat-save").disabled = !$("#cat-input").value.trim(); }

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
  const back = catState.returnTo;
  closeSheets();
  if (back === "task") {
    if (newId) taskState.catId = newId;
    openTaskSheet(taskState.editId ? state.tasks.find((t) => t.id === taskState.editId) : null);
  } else {
    renderActive();
  }
  toast(catState.editId ? "Category updated" : "Category created");
}

function deleteCat() {
  const id = catState.editId;
  state.categories = state.categories.filter((c) => c.id !== id);
  state.tasks.forEach((t) => { if (t.catId === id) t.catId = null; });
  if (filterCat === id) filterCat = null;
  save(); closeSheets(); renderActive(); toast("Category deleted");
}

/* ============================================================
   HABITS
   ============================================================ */
function streakInfo(h) {
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

function renderHabits() {
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

function checkinHabit(id, btn) {
  const h = state.habits.find((x) => x.id === id);
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

function intervalDone(id) {
  const h = state.habits.find((x) => x.id === id);
  if (!h) return;
  const t = todayKey();
  h.last = t;
  h.next = addDays(t, h.every);
  h.count = (h.count || 0) + 1;
  save(); renderActive();
  celebrate(`Done! Next in ${h.every} days`, 34);
}

/* ---- habit statistics ---- */
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
  let start = h.createdAt ? dateKey(new Date(h.createdAt)) : (keys[0] || todayKey());
  if (keys[0] && keys[0] < start) start = keys[0];
  const span = Math.max(1, daysBetween(start, todayKey()) + 1);
  const rate = Math.round((total / span) * 100);
  let last30 = 0;
  for (let i = 0; i < 30; i++) if (log[addDays(todayKey(), -i)]) last30++;
  return { current: s.current, best, total, breaks, rate, last30, start };
}

function heatmapCells(h) {
  const log = h.log || {};
  const t = todayKey();
  const monIdx = (parseKey(t).getDay() + 6) % 7; // today's weekday, Mon=0
  const weeks = 12;
  let out = "";
  for (let col = 0; col < weeks; col++) {
    for (let row = 0; row < 7; row++) {
      const off = -monIdx - (weeks - 1 - col) * 7 + row;  // day offset from today
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
let statsHabitId = null;
function openHabitStats(h) {
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

function toggleHabitLogDay(data) {
  const [id, key] = data.split("|");
  const h = state.habits.find((x) => x.id === id);
  if (!h || h.type !== "daily" || !key || daysBetween(todayKey(), key) > 0) return;
  h.log = h.log || {};
  if (h.log[key]) delete h.log[key]; else h.log[key] = true;
  save();
  renderActive();
  openHabitStats(h);
  haptic(12);
}
function openHabitSheet(habit) {
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
  // lock type when editing
  $$("#habit-type-seg .seg-btn").forEach((b) => { b.classList.toggle("active", b.dataset.htype === habitState.type); b.disabled = !!habit; });
  syncHabitType();
  renderSwatchRow($("#habit-colors"), habitState.color);
  renderIconGrid($("#habit-icons"), habitState.icon, habitState.color);
  updateHabitSave();
  openSheet("sheet-habit");
  if (!habit) setTimeout(() => $("#habit-input").focus(), 350);
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

function updateHabitSave() { $("#habit-save").disabled = !$("#habit-input").value.trim(); }

function saveHabit() {
  const name = $("#habit-input").value.trim();
  if (!name) return;
  if (habitState.editId) {
    const h = state.habits.find((x) => x.id === habitState.editId);
    if (h) {
      h.name = name; h.icon = habitState.icon; h.color = habitState.color;
      if (h.type === "interval") { h.every = habitState.every; h.next = habitState.next; h.remind = habitState.remind; }
    }
  } else if (habitState.type === "daily") {
    state.habits.push({ id: uid(), type: "daily", name, icon: habitState.icon, color: habitState.color, log: {}, createdAt: Date.now() });
  } else {
    state.habits.push({ id: uid(), type: "interval", name, icon: habitState.icon, color: habitState.color, every: habitState.every, next: habitState.next, last: null, remind: habitState.remind, createdAt: Date.now() });
  }
  save(); closeSheets(); renderActive(); toast(habitState.editId ? "Habit updated" : "Habit created");
}

function deleteHabit() {
  state.habits = state.habits.filter((x) => x.id !== habitState.editId);
  save(); closeSheets(); renderHabits(); toast("Habit deleted");
}

/* ============================================================
   COUNTDOWNS
   ============================================================ */
function renderCountdowns() {
  // manual order (reorder via the edit sheet); newest added last
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

function toggleCountdown(id, btn) {
  const cd = state.countdowns.find((x) => x.id === id);
  if (!cd) return;
  cd.done = !cd.done;
  cd.completedAt = cd.done ? Date.now() : null;
  save();
  if (cd.done) { if (btn) btn.classList.add("burst"); celebrate("Countdown done ✦", 34); }
  renderActive();
}

function openCdSheet(cd) {
  cdState.editId = cd ? cd.id : null;
  cdState.icon = cd ? cd.icon : "sparkles";
  cdState.color = cd ? cd.color : COLORS[1];
  $("#cd-sheet-title").textContent = cd ? "Edit countdown" : "New countdown";
  $("#cd-save").textContent = cd ? "Save countdown" : "Add countdown";
  $("#cd-input").value = cd ? cd.title : "";
  $("#cd-date").value = cd ? cd.date : todayKey();
  $("#cd-edit-extras").hidden = !cd;
  $("#cd-reorder").hidden = !cd || state.countdowns.length < 2;
  if (cd) updateCdReorder();
  cdState.remind = cd && cd.remind != null ? cd.remind : null;
  renderRemind("#cd-remind", cdState.remind);
  renderSwatchRow($("#cd-colors"), cdState.color);
  renderIconGrid($("#cd-icons"), cdState.icon, cdState.color);
  updateCdSave();
  openSheet("sheet-countdown");
  if (!cd) setTimeout(() => $("#cd-input").focus(), 350);
}

function updateCdSave() { $("#cd-save").disabled = !($("#cd-input").value.trim() && $("#cd-date").value); }

function saveCd() {
  const title = $("#cd-input").value.trim(), date = $("#cd-date").value;
  if (!title || !date) return;
  if (cdState.editId) {
    const cd = state.countdowns.find((x) => x.id === cdState.editId);
    if (cd) { cd.title = title; cd.date = date; cd.icon = cdState.icon; cd.color = cdState.color; cd.remind = cdState.remind; }
  } else {
    state.countdowns.push({ id: uid(), title, date, icon: cdState.icon, color: cdState.color, remind: cdState.remind, createdAt: Date.now() });
  }
  save(); closeSheets(); renderActive(); toast(cdState.editId ? "Countdown updated" : "Countdown added");
}

function deleteCd() {
  state.countdowns = state.countdowns.filter((x) => x.id !== cdState.editId);
  save(); closeSheets(); renderCountdowns(); toast("Countdown deleted");
}

/* ============================================================
   YEARLY EVENTS
   ============================================================ */
function nextOccurrenceKey(ev) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  let y = now.getFullYear();
  let d = new Date(y, ev.month - 1, ev.day);
  if (d < now) d = new Date(y + 1, ev.month - 1, ev.day);
  return dateKey(d);
}

function renderEvents() {
  const list = state.events;   // manual order (reorder via the edit sheet)
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

function openEvSheet(ev) {
  evState.editId = ev ? ev.id : null;
  evState.icon = ev ? ev.icon : "gift";
  evState.color = ev ? ev.color : COLORS[9];
  $("#ev-sheet-title").textContent = ev ? "Edit yearly event" : "New yearly event";
  $("#ev-save").textContent = ev ? "Save event" : "Add event";
  $("#ev-input").value = ev ? ev.title : "";
  $("#ev-date").value = ev ? `${new Date().getFullYear()}-${pad2(ev.month)}-${pad2(ev.day)}` : todayKey();
  $("#ev-edit-extras").hidden = !ev;
  $("#ev-reorder").hidden = !ev || state.events.length < 2;
  if (ev) updateEvReorder();
  evState.remind = ev && ev.remind != null ? ev.remind : null;
  renderRemind("#ev-remind", evState.remind);
  renderSwatchRow($("#ev-colors"), evState.color);
  renderIconGrid($("#ev-icons"), evState.icon, evState.color);
  updateEvSave();
  openSheet("sheet-event");
  if (!ev) setTimeout(() => $("#ev-input").focus(), 350);
}

function updateEvSave() { $("#ev-save").disabled = !($("#ev-input").value.trim() && $("#ev-date").value); }

function saveEv() {
  const title = $("#ev-input").value.trim(), dv = $("#ev-date").value;
  if (!title || !dv) return;
  const [, m, d] = dv.split("-").map(Number);
  if (evState.editId) {
    const ev = state.events.find((x) => x.id === evState.editId);
    if (ev) { ev.title = title; ev.month = m; ev.day = d; ev.icon = evState.icon; ev.color = evState.color; ev.remind = evState.remind; }
  } else {
    state.events.push({ id: uid(), title, month: m, day: d, icon: evState.icon, color: evState.color, remind: evState.remind, createdAt: Date.now() });
  }
  save(); closeSheets(); renderActive(); toast(evState.editId ? "Event updated" : "Event added");
}

function deleteEv() {
  state.events = state.events.filter((x) => x.id !== evState.editId);
  save(); closeSheets(); renderEvents(); toast("Event deleted");
}

/* ============================================================
   CALENDAR
   ============================================================ */
function gatherDay(key) {
  const [, m, d] = key.split("-").map(Number);
  const items = [];
  state.tasks.forEach((t) => { if (!t.done && t.deadline === key) { const c = catOf(t.catId); const base = c ? c.name : "Task"; items.push({ type: "task", color: c ? c.color : null, title: t.title, icon: "tasks", sub: t.time ? `${fmtTime(t.time)} · ${base}` : base }); } });
  state.countdowns.forEach((cd) => { if (cd.date === key && !cd.done) items.push({ type: "cd", color: cd.color, title: cd.title, icon: cd.icon, sub: "Countdown" }); });
  state.events.forEach((ev) => { if (ev.month === m && ev.day === d) items.push({ type: "event", color: ev.color, title: ev.title, icon: ev.icon, sub: "Yearly event" }); });
  state.habits.forEach((h) => { if (h.type === "interval" && h.next === key) items.push({ type: "habit", color: h.color, title: h.name, icon: h.icon, sub: `Every ${h.every} days` }); });
  return items;
}

function renderCalendar() {
  $("#cal-month-label").textContent = new Date(calY, calM, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const first = new Date(calY, calM, 1);
  const offset = (first.getDay() + 6) % 7;            // Monday-first
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

function openDaySheet(key) {
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

/* ============================================================
   PICKERS
   ============================================================ */
function renderSwatchRow(el, sel) {
  el.innerHTML = COLORS.map((c) => `<button class="swatch ${c === sel ? "sel" : ""}" data-swatch="${c}" style="--c:${c}" aria-label="colour ${c}"></button>`).join("");
}
function renderIconGrid(el, sel, color) {
  el.innerHTML = PICK_ICONS.map((ic) => `<button class="icon-opt ${ic === sel ? "sel" : ""}" data-iconpick="${ic}" style="--c:${color}" aria-label="${ic}">${icon(ic)}</button>`).join("");
}

/* route a colour / icon pick to whichever sheet is open */
const SHEET_PICK = {
  "sheet-cat": { st: () => catState, colors: "#cat-colors", icons: null },
  "sheet-habit": { st: () => habitState, colors: "#habit-colors", icons: "#habit-icons" },
  "sheet-countdown": { st: () => cdState, colors: "#cd-colors", icons: "#cd-icons" },
  "sheet-event": { st: () => evState, colors: "#ev-colors", icons: "#ev-icons" },
};
function pickColor(color) {
  const cfg = SHEET_PICK[openSheetId]; if (!cfg) return;
  cfg.st().color = color;
  renderSwatchRow($(cfg.colors), color);
  if (cfg.icons) renderIconGrid($(cfg.icons), cfg.st().icon, color);
}
function pickIcon(ic) {
  const cfg = SHEET_PICK[openSheetId]; if (!cfg || !cfg.icons) return;
  cfg.st().icon = ic;
  renderIconGrid($(cfg.icons), ic, cfg.st().color);
}

/* ============================================================
   NAV / SHEETS / TABS
   ============================================================ */
function setTab(tab) {
  activeTab = tab;
  manageCats = false;
  $$(".screen").forEach((s) => { s.hidden = s.dataset.screen !== tab; });
  $$(".dock-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const fab = $("#fab");
  const labels = { today: "Task", tasks: "Task", habits: "Habit", countdowns: "Add", events: "Add" };
  if (tab === "calendar") { fab.classList.add("hide"); }
  else { fab.classList.remove("hide"); $("#fab-label").textContent = labels[tab]; }
  renderActive();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fabAdd() {
  if (activeTab === "today" || activeTab === "tasks") openTaskSheet(null);
  else if (activeTab === "habits") openHabitSheet(null);
  else if (activeTab === "countdowns") openCdSheet(null);
  else if (activeTab === "events") openEvSheet(null);
}

function openSheet(id) {
  closeSheets(true);
  openSheetId = id;
  const bd = $("#backdrop");
  bd.hidden = false;
  const sheet = $("#" + id);
  requestAnimationFrame(() => sheet.classList.add("open"));
}
function closeSheets(silent) {
  $$(".sheet.open").forEach((s) => s.classList.remove("open"));
  if (!silent) $("#backdrop").hidden = true;
  openSheetId = silent ? openSheetId : null;
}

/* ---------------- haptics + celebration ---------------- */
function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch {} }
function celebrate(msg, count = 30) {
  if (msg) toast(msg);
  haptic(count >= 60 ? [12, 40, 12] : 14);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const wrap = $("#confetti");
  const colors = ["#6d5cff", "#b14cff", "#ff4d9d", "#ff8a4c", "#34d399", "#27c8f0", "#facc15"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw";
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--dur", (1.6 + Math.random() * 1.2) + "s");
    p.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
    p.style.animationDelay = (Math.random() * 0.3) + "s";
    wrap.appendChild(p);
    setTimeout(() => p.remove(), 3400);
  }
}

/* ---------------- toast ---------------- */
let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  $("#toast-msg").textContent = msg;
  $("#toast-action").hidden = true;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); setTimeout(() => (el.hidden = true), 350); }, 2600);
}

/* ---------------- theme ---------------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "light" ? "#f5f4fd" : "#0b0a18");
}
applyTheme(document.documentElement.dataset.theme || "dark");
$("#btn-theme").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

/* ============================================================
   EXPORT / IMPORT / WIPE
   ============================================================ */
function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `orbit-backup-${todayKey()}.json`; a.click();
  URL.revokeObjectURL(url);
  toast("Backup exported");
}
function importBackup(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const s = JSON.parse(r.result);
      if (!s || s.v !== 1) throw 0;
      state = s; save(); closeSheets(); renderActive();
      toast("Backup imported");
    } catch { toast("That file didn't look like an Orbit backup"); }
  };
  r.readAsText(file);
}

let wipeTimer = null;
function onWipe() {
  const b = $("#btn-wipe");
  if (!b.classList.contains("armed")) {
    b.classList.add("armed"); b.textContent = "Tap again to erase everything";
    wipeTimer = setTimeout(() => { b.classList.remove("armed"); b.textContent = "Erase everything on this device"; }, 3000);
    return;
  }
  clearTimeout(wipeTimer); b.classList.remove("armed"); b.textContent = "Erase everything on this device";
  state = freshState(); localStorage.setItem(LS_KEY, JSON.stringify(state));
  filterCat = null; closeSheets(); renderActive(); toast("Everything erased");
}

/* ============================================================
   CLOUD SYNC (Supabase, optional) — one JSONB row per user
   ============================================================ */
const SUPA = window.ORBIT_SUPABASE || {};
const sb = window.supabase && typeof SUPA.url === "string" && SUPA.url.startsWith("https://") && !SUPA.url.includes("YOUR-")
  ? window.supabase.createClient(SUPA.url, SUPA.anonKey) : null;

let cloudUser = null;
let pushTimer = null;

function setSyncMsg(m) { const el = $("#sync-status"); if (el) el.textContent = m; }
function renderSyncUI() {
  const note = $("#sync-note");
  if (!sb) { $("#sync-out").hidden = true; $("#sync-in").hidden = true; note.textContent = "Add your Supabase keys in js/config.js to enable backup & multi-device sync."; renderRemindersUI(); return; }
  $("#sync-out").hidden = !!cloudUser;
  $("#sync-in").hidden = !cloudUser;
  note.textContent = cloudUser ? `Signed in as ${cloudUser.email}` : "Sign in with an email code to back up & sync across devices.";
  renderRemindersUI();
}

/* ---- web push / reminders ---- */
const VAPID = (window.ORBIT_PUSH && window.ORBIT_PUSH.vapidPublic) || "";
const pushConfigured = !!VAPID && !VAPID.includes("YOUR-");

function urlB64ToUint8(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64); const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
async function getPushSub() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch { return null; }
}
async function renderRemindersUI() {
  const note = $("#reminders-note"), enableBtn = $("#btn-enable-push"), inBox = $("#reminders-in");
  if (!note) return;
  if (!sb || !cloudUser) { enableBtn.hidden = true; inBox.hidden = true; note.textContent = "Sign in above to enable reminders."; return; }
  if (!pushConfigured || !("Notification" in window)) { enableBtn.hidden = true; inBox.hidden = true; note.textContent = "Push isn't set up yet (see README) — per-item reminders are saved and will fire once it is."; return; }
  const subbed = Notification.permission === "granted" && !!(await getPushSub());
  enableBtn.hidden = subbed;
  inBox.hidden = !subbed;
  if (subbed) {
    const r = state.reminders.dailyDigest;
    $("#daily-toggle").classList.toggle("on", !!r.on);
    $("#daily-toggle").setAttribute("aria-checked", r.on ? "true" : "false");
    $("#daily-time-row").hidden = !r.on;
    $("#daily-time").value = r.time || "09:00";
    note.textContent = "Reminders are on for this device.";
  } else {
    note.textContent = "Turn on notifications to get reminders on this device.";
  }
}
async function enablePush() {
  if (!pushConfigured) return toast("Push not configured yet — see README");
  if (!cloudUser) return toast("Sign in first");
  let perm = Notification.permission;
  if (perm !== "granted") perm = await Notification.requestPermission();
  if (perm !== "granted") return toast("Notifications not allowed");
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID) });
    const j = sub.toJSON();
    const tz = tzGuess();
    await sb.from("push_subscriptions").upsert(
      { user_id: cloudUser.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, tz, updated_at: new Date().toISOString() },
      { onConflict: "endpoint" }
    );
    state.reminders.tz = tz;
    state.reminders.dailyDigest.on = true;
    save();
    renderRemindersUI();
    toast("Notifications enabled ✦");
  } catch { toast("Couldn't enable notifications"); }
}
function schedulePush() { if (!sb || !cloudUser) return; clearTimeout(pushTimer); pushTimer = setTimeout(cloudPush, 1500); }
async function cloudPush() {
  if (!sb || !cloudUser) return false;
  setSyncMsg("Syncing…");
  const { error } = await sb.from("orbit_state").upsert({ user_id: cloudUser.id, data: state, updated_at: new Date().toISOString() });
  setSyncMsg(error ? (navigator.onLine ? "Sync failed — will retry" : "Offline — will sync later") : "Synced just now");
  return !error;
}
async function cloudPull() {
  if (!sb || !cloudUser) return;
  setSyncMsg("Syncing…");
  const { data, error } = await sb.from("orbit_state").select("data").eq("user_id", cloudUser.id).maybeSingle();
  if (error) { setSyncMsg("Couldn't reach the cloud — using local data"); return; }
  const remote = data && data.data;
  if (remote && (!hasData() || (remote.updatedAt || 0) > (state.updatedAt || 0))) {
    state = remote; localStorage.setItem(LS_KEY, JSON.stringify(state));
    filterCat = null; renderActive(); setSyncMsg("Synced — loaded latest");
  } else { cloudPush(); }
}
if (sb) {
  sb.auth.getSession().then(({ data }) => { cloudUser = data.session ? data.session.user : null; renderSyncUI(); if (cloudUser) cloudPull(); });
  sb.auth.onAuthStateChange((_e, session) => { const was = cloudUser && cloudUser.id; cloudUser = session ? session.user : null; renderSyncUI(); if (cloudUser && cloudUser.id !== was) cloudPull(); });

  $("#btn-send-code").addEventListener("click", async () => {
    const email = $("#sync-email").value.trim(); if (!email) return;
    const btn = $("#btn-send-code"); btn.disabled = true; btn.textContent = "Sending…";
    const { error } = await sb.auth.signInWithOtp({ email });
    btn.disabled = false; btn.textContent = "Send sign-in code";
    if (error) return toast("Couldn't send code: " + error.message);
    $("#sync-code-row").hidden = false; $("#sync-code").focus(); toast("Code sent — check your email");
  });
  $("#btn-verify-code").addEventListener("click", async () => {
    const email = $("#sync-email").value.trim(), token = $("#sync-code").value.trim();
    if (!email || !token) return;
    const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
    if (error) return toast("That code didn't work — try again");
    $("#sync-code-row").hidden = true; $("#sync-code").value = ""; toast("Signed in — syncing");
  });
  $("#btn-signout").addEventListener("click", async () => {
    clearTimeout(pushTimer);
    const ok = await cloudPush();
    if (!ok) return toast("Couldn't back up latest changes — check your connection");
    await sb.auth.signOut();
    state = freshState(); localStorage.removeItem(LS_KEY); filterCat = null;
    closeSheets(); renderActive(); toast("Signed out — this device was wiped. Data is safe in the cloud.");
  });
  $("#btn-sync-now").addEventListener("click", () => cloudPull());
  window.addEventListener("online", schedulePush);
}

/* ============================================================
   EVENTS — direct wiring
   ============================================================ */
$("#btn-settings").addEventListener("click", () => { renderSyncUI(); openSheet("sheet-settings"); });
$("#fab").addEventListener("click", fabAdd);
$("#backdrop").addEventListener("click", () => closeSheets());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheets(); });

// task sheet
$("#task-input").addEventListener("input", updateTaskSave);
$("#task-save").addEventListener("click", saveTask);
$("#task-delete").addEventListener("click", deleteTask);
$("#task-deadline").addEventListener("change", (e) => { taskState.deadline = e.target.value || null; renderDeadlineRow(); });
$("#task-time").addEventListener("change", (e) => { taskState.time = e.target.value || null; });
$("#subtask-add-btn").addEventListener("click", addSubtask);
$("#subtask-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } });
$("#clear-completed").addEventListener("click", clearCompleted);
// cat sheet
$("#cat-input").addEventListener("input", updateCatSave);
$("#cat-save").addEventListener("click", saveCat);
$("#cat-delete").addEventListener("click", deleteCat);
// habit sheet
$("#habit-input").addEventListener("input", updateHabitSave);
$("#habit-save").addEventListener("click", saveHabit);
$("#habit-delete").addEventListener("click", deleteHabit);
$("#stats-edit").addEventListener("click", () => { const h = state.habits.find((x) => x.id === statsHabitId); if (h) openHabitSheet(h); });
$("#habit-next").addEventListener("change", (e) => { habitState.next = e.target.value || todayKey(); });
// countdown sheet
$("#cd-input").addEventListener("input", updateCdSave);
$("#cd-date").addEventListener("change", updateCdSave);
$("#cd-save").addEventListener("click", saveCd);
$("#cd-delete").addEventListener("click", deleteCd);
// event sheet
$("#ev-input").addEventListener("input", updateEvSave);
$("#ev-date").addEventListener("change", updateEvSave);
$("#ev-save").addEventListener("click", saveEv);
$("#ev-delete").addEventListener("click", deleteEv);
// settings
$("#btn-enable-push").addEventListener("click", enablePush);
$("#daily-toggle").addEventListener("click", () => { state.reminders.dailyDigest.on = !state.reminders.dailyDigest.on; save(); renderRemindersUI(); });
$("#daily-time").addEventListener("change", (e) => { state.reminders.dailyDigest.time = e.target.value || "09:00"; save(); });
$("#btn-export").addEventListener("click", exportBackup);
$("#btn-import").addEventListener("click", () => $("#file-import").click());
$("#file-import").addEventListener("change", (e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; });
$("#btn-wipe").addEventListener("click", onWipe);
// calendar nav
$("#cal-prev").addEventListener("click", () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCalendar(); });
$("#cal-next").addEventListener("click", () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCalendar(); });
$("#cal-month-label").addEventListener("click", () => { const d = new Date(); calY = d.getFullYear(); calM = d.getMonth(); renderCalendar(); });

/* ---------------- global delegation ---------------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-tab],[data-act],[data-toggle],[data-subtoggle],[data-sbtoggle],[data-sbdel],[data-edit-task],[data-filter],[data-pickcat],[data-deadline],[data-remind],[data-swatch],[data-iconpick],[data-checkin],[data-habit-log],[data-intdone],[data-edit-habit],[data-habit-stats],[data-cd-toggle],[data-edit-cd],[data-edit-ev],[data-htype],[data-step],[data-day]");
  if (!el) return;

  if (el.dataset.tab) return setTab(el.dataset.tab);
  if (el.dataset.act) {
    switch (el.dataset.act) {
      case "close-sheet": return closeSheets();
      case "new-cat-manage": return openCatSheet(null);
      case "new-cat-from-task": return openCatSheet("task");
      case "toggle-manage": manageCats = !manageCats; renderTasks(); return;
      case "cat-move-left": return moveCat(-1);
      case "cat-move-right": return moveCat(1);
      case "habit-move-up": return moveHabit(-1);
      case "habit-move-down": return moveHabit(1);
      case "cd-move-up": return moveCd(-1);
      case "cd-move-down": return moveCd(1);
      case "ev-move-up": return moveEv(-1);
      case "ev-move-down": return moveEv(1);
      case "clear-time": taskState.time = null; $("#task-time").value = ""; return;
    }
    return;
  }
  // tasks
  if (el.dataset.toggle) return toggleTask(el.dataset.toggle, el);
  if (el.dataset.subtoggle) { const [tid, sid] = el.dataset.subtoggle.split("|"); return toggleSubtask(tid, sid); }
  // subtask editor (in task sheet)
  if (el.dataset.sbtoggle !== undefined) { const i = +el.dataset.sbtoggle; syncSubtasks(); if (taskState.subtasks[i]) taskState.subtasks[i].done = !taskState.subtasks[i].done; renderSubtaskEditor(); return; }
  if (el.dataset.sbdel !== undefined) { const i = +el.dataset.sbdel; syncSubtasks(); taskState.subtasks.splice(i, 1); renderSubtaskEditor(); return; }
  if (el.dataset.editTask) { const t = state.tasks.find((x) => x.id === el.dataset.editTask); if (t) openTaskSheet(t); return; }
  if (el.dataset.filter !== undefined) {
    const id = el.dataset.filter || null;
    if (manageCats && id) { const c = catOf(id); if (c) openCatEdit(c); return; }
    filterCat = id; renderTasks(); return;
  }
  if (el.dataset.pickcat) { taskState.catId = taskState.catId === el.dataset.pickcat ? null : el.dataset.pickcat; renderTaskCats(); return; }
  if (el.dataset.deadline) {
    const v = el.dataset.deadline;
    taskState.deadline = v === "none" ? null : v === "today" ? todayKey() : addDays(todayKey(), 1);
    renderDeadlineRow(); return;
  }
  if (el.dataset.remind !== undefined) return setRemind(el);
  // pickers
  if (el.dataset.swatch) return pickColor(el.dataset.swatch);
  if (el.dataset.iconpick) return pickIcon(el.dataset.iconpick);
  // habits
  if (el.dataset.checkin) return checkinHabit(el.dataset.checkin, el);
  if (el.dataset.habitLog) return toggleHabitLogDay(el.dataset.habitLog);
  if (el.dataset.intdone) return intervalDone(el.dataset.intdone);
  if (el.dataset.editHabit) { const h = state.habits.find((x) => x.id === el.dataset.editHabit); if (h) openHabitSheet(h); return; }
  if (el.dataset.habitStats) { const h = state.habits.find((x) => x.id === el.dataset.habitStats); if (h) openHabitStats(h); return; }
  if (el.dataset.htype) {
    if (el.disabled) return;
    habitState.type = el.dataset.htype;
    $$("#habit-type-seg .seg-btn").forEach((b) => b.classList.toggle("active", b === el));
    syncHabitType(); return;
  }
  if (el.dataset.step) {
    habitState.every = clamp(habitState.every + Number(el.dataset.step), 1, 365);
    $("#habit-interval-val").textContent = habitState.every; return;
  }
  // countdowns / events
  if (el.dataset.cdToggle) return toggleCountdown(el.dataset.cdToggle, el);
  if (el.dataset.editCd) { const cd = state.countdowns.find((x) => x.id === el.dataset.editCd); if (cd) openCdSheet(cd); return; }
  if (el.dataset.editEv) { const ev = state.events.find((x) => x.id === el.dataset.editEv); if (ev) openEvSheet(ev); return; }
  // calendar day
  if (el.dataset.day) return openDaySheet(el.dataset.day);
});

/* completed section toggle */
$("#completed-toggle").addEventListener("click", () => {
  const t = $("#completed-toggle");
  t.setAttribute("aria-expanded", t.getAttribute("aria-expanded") === "true" ? "false" : "true");
});

/* ---------------- boot ---------------- */
autoArchiveCompleted();
setTab("today");
renderSyncUI();
updateBadge();

(function firstRun() {
  if (!hasData()) setTimeout(() => toast("Welcome to Orbit ✦ tap + to add your first task"), 800);
})();

/* PWA service worker (https / localhost only) */
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
