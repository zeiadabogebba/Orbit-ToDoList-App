import { LS_KEY } from "../core/constants.js";
import { uid } from "../core/dom.js";
import { tzGuess } from "../core/dates.js";

export function freshState() {
  const category = (name, color) => ({ id: uid(), name, color });
  return {
    v: 1,
    categories: [category("Personal", "#8b5cf6"), category("Work", "#3b82f6"), category("Health", "#10b981"), category("Errands", "#fb923c")],
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
    s.categories = Array.isArray(s.categories) ? s.categories : [];
    s.tasks = Array.isArray(s.tasks) ? s.tasks : [];
    s.habits = Array.isArray(s.habits) ? s.habits : [];
    s.countdowns = Array.isArray(s.countdowns) ? s.countdowns : [];
    s.events = Array.isArray(s.events) ? s.events : [];
    if (!s.reminders || typeof s.reminders !== "object") s.reminders = { dailyDigest: { on: false, time: "09:00" }, tz: tzGuess() };
    if (!s.reminders.dailyDigest) s.reminders.dailyDigest = { on: false, time: "09:00" };
    if (!s.reminders.tz) s.reminders.tz = tzGuess();
    return s;
  } catch {
    return freshState();
  }
}

export let state = load();

const changeListeners = [];
export function onChange(fn) {
  changeListeners.push(fn);
}

export function save() {
  state.updatedAt = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  changeListeners.forEach((fn) => fn(state));
}

export function replaceState(next) {
  state = next;
}

export function hasData() {
  return state.tasks.length || state.habits.length || state.countdowns.length || state.events.length;
}
