import { closeSheets, pickColor, pickIcon, setRemind } from "./sheets.js";
import { setTab } from "./tabs.js";
import { openCatSheet, moveCat, toggleCategoryManaging } from "../features/categories.js";
import {
  toggleTask, toggleSubtask, toggleSubtaskEditorDone, removeSubtaskEditorRow,
  openTaskSheetById, handleCategoryFilterClick, pickTaskCategory,
  setTaskDeadlineQuick, clearTaskTime, openNewCategoryFromTask,
} from "../features/tasks.js";
import { checkinHabit, intervalDone, openHabitSheetById, setHabitType, stepHabitInterval, moveHabit } from "../features/habits.js";
import { openHabitStatsById, toggleHabitLogDay } from "../features/habit-stats.js";
import { toggleCountdown, openCdSheetById, moveCd } from "../features/countdowns.js";
import { openEvSheetById, moveEv } from "../features/events.js";
import { openDaySheet } from "../features/calendar.js";

const SELECTOR = [
  "[data-tab]", "[data-act]", "[data-toggle]", "[data-subtoggle]", "[data-sbtoggle]", "[data-sbdel]",
  "[data-edit-task]", "[data-filter]", "[data-pickcat]", "[data-deadline]", "[data-remind]",
  "[data-swatch]", "[data-iconpick]", "[data-checkin]", "[data-habit-log]", "[data-intdone]",
  "[data-edit-habit]", "[data-habit-stats]", "[data-cd-toggle]", "[data-edit-cd]", "[data-edit-ev]",
  "[data-htype]", "[data-step]", "[data-day]",
].join(",");

const ACTIONS = {
  "close-sheet": () => closeSheets(),
  "new-cat-manage": () => openCatSheet(),
  "new-cat-from-task": () => openNewCategoryFromTask(),
  "toggle-manage": () => toggleCategoryManaging(),
  "cat-move-left": () => moveCat(-1),
  "cat-move-right": () => moveCat(1),
  "habit-move-up": () => moveHabit(-1),
  "habit-move-down": () => moveHabit(1),
  "cd-move-up": () => moveCd(-1),
  "cd-move-down": () => moveCd(1),
  "ev-move-up": () => moveEv(-1),
  "ev-move-down": () => moveEv(1),
  "clear-time": () => clearTaskTime(),
};

export function initDelegatedEvents() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest(SELECTOR);
    if (!el) return;

    if (el.dataset.tab) return setTab(el.dataset.tab);
    if (el.dataset.act) return ACTIONS[el.dataset.act]?.();

    if (el.dataset.toggle) return toggleTask(el.dataset.toggle, el);
    if (el.dataset.subtoggle) { const [tid, sid] = el.dataset.subtoggle.split("|"); return toggleSubtask(tid, sid); }
    if (el.dataset.sbtoggle !== undefined) return toggleSubtaskEditorDone(+el.dataset.sbtoggle);
    if (el.dataset.sbdel !== undefined) return removeSubtaskEditorRow(+el.dataset.sbdel);
    if (el.dataset.editTask) return openTaskSheetById(el.dataset.editTask);
    if (el.dataset.filter !== undefined) return handleCategoryFilterClick(el.dataset.filter || null);
    if (el.dataset.pickcat) return pickTaskCategory(el.dataset.pickcat);
    if (el.dataset.deadline) return setTaskDeadlineQuick(el.dataset.deadline);
    if (el.dataset.remind !== undefined) return setRemind(el);

    if (el.dataset.swatch) return pickColor(el.dataset.swatch);
    if (el.dataset.iconpick) return pickIcon(el.dataset.iconpick);

    if (el.dataset.checkin) return checkinHabit(el.dataset.checkin, el);
    if (el.dataset.habitLog) return toggleHabitLogDay(el.dataset.habitLog);
    if (el.dataset.intdone) return intervalDone(el.dataset.intdone);
    if (el.dataset.editHabit) return openHabitSheetById(el.dataset.editHabit);
    if (el.dataset.habitStats) return openHabitStatsById(el.dataset.habitStats);
    if (el.dataset.htype) return setHabitType(el);
    if (el.dataset.step) return stepHabitInterval(Number(el.dataset.step));

    if (el.dataset.cdToggle) return toggleCountdown(el.dataset.cdToggle, el);
    if (el.dataset.editCd) return openCdSheetById(el.dataset.editCd);
    if (el.dataset.editEv) return openEvSheetById(el.dataset.editEv);

    if (el.dataset.day) return openDaySheet(el.dataset.day);
  });
}
