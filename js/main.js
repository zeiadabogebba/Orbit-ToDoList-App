import { onChange, hasData } from "./state/store.js";
import { toast } from "./ui/toast.js";
import { initTheme } from "./ui/theme.js";
import { initSheetsGlobal } from "./ui/sheets.js";
import { initTabs, setTab } from "./ui/tabs.js";
import { initDelegatedEvents } from "./ui/delegated-events.js";
import { initCategoriesUI } from "./features/categories.js";
import { initTasksUI, autoArchiveCompleted } from "./features/tasks.js";
import { initHabitsUI } from "./features/habits.js";
import { initHabitStatsUI } from "./features/habit-stats.js";
import { initCountdownsUI } from "./features/countdowns.js";
import { initEventsUI } from "./features/events.js";
import { initCalendarUI } from "./features/calendar.js";
import "./features/today.js";
import { initBackupUI } from "./features/backup.js";
import { updateBadge } from "./features/badge.js";
import { initCloudSync, schedulePush } from "./sync/cloud-sync.js";
import { initPushUI } from "./sync/push.js";

onChange(schedulePush);
onChange(updateBadge);

initTheme();
initSheetsGlobal();
initTabs();
initCategoriesUI();
initTasksUI();
initHabitsUI();
initHabitStatsUI();
initCountdownsUI();
initEventsUI();
initCalendarUI();
initBackupUI();
initCloudSync();
initPushUI();
initDelegatedEvents();

autoArchiveCompleted();
setTab("today");
updateBadge();

if (!hasData()) setTimeout(() => toast("Welcome to Orbit ✦ tap + to add your first task"), 800);

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
