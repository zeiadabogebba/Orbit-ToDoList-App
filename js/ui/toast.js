import { $ } from "../core/dom.js";

let toastTimer = null;

export function toast(msg) {
  const el = $("#toast");
  $("#toast-msg").textContent = msg;
  $("#toast-action").hidden = true;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => (el.hidden = true), 350);
  }, 2600);
}
