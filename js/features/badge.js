import { state } from "../state/store.js";
import { todayKey, daysBetween } from "../core/dates.js";

export function updateBadge() {
  if (!("setAppBadge" in navigator)) return;
  const t = todayKey();
  const count =
    state.tasks.filter((x) => !x.done && x.deadline && x.deadline <= t).length +
    state.habits.filter((h) => h.type === "interval" && daysBetween(t, h.next) <= 0).length;
  try {
    count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
  } catch {}
}
