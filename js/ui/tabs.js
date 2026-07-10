import { $, $$ } from "../core/dom.js";
import { renderActive, setActiveTabSource } from "./render-bus.js";
import { openTaskSheet } from "../features/tasks.js";
import { openHabitSheet } from "../features/habits.js";
import { openCdSheet } from "../features/countdowns.js";
import { openEvSheet } from "../features/events.js";
import { resetCategoryManaging } from "../features/categories.js";

let activeTab = "today";
setActiveTabSource(() => activeTab);

export function setTab(tab) {
  activeTab = tab;
  resetCategoryManaging();
  $$(".screen").forEach((s) => { s.hidden = s.dataset.screen !== tab; });
  $$(".dock-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const fab = $("#fab");
  const labels = { today: "Task", tasks: "Task", habits: "Habit", countdowns: "Add", events: "Add" };
  if (tab === "calendar") fab.classList.add("hide");
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

export function initTabs() {
  $("#fab").addEventListener("click", fabAdd);
}
