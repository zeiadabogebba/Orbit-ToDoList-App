import { $ } from "../core/dom.js";
import { THEME_KEY } from "../core/constants.js";

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f5f4fd" : "#0b0a18");
}

export function initTheme() {
  applyTheme(document.documentElement.dataset.theme || "dark");
  $("#btn-theme").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}
