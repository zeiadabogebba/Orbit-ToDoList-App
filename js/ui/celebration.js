import { $ } from "../core/dom.js";
import { toast } from "./toast.js";

export function haptic(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

export function celebrate(msg, count = 30) {
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
