import { $ } from "../core/dom.js";
import { tzGuess } from "../core/dates.js";
import { state, save } from "../state/store.js";
import { toast } from "../ui/toast.js";
import { sb, getCloudUser } from "./supabase-client.js";

const VAPID = (window.ORBIT_PUSH && window.ORBIT_PUSH.vapidPublic) || "";
const pushConfigured = !!VAPID && !VAPID.includes("YOUR-");

function urlB64ToUint8(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getPushSub() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function renderRemindersUI() {
  const note = $("#reminders-note"), enableBtn = $("#btn-enable-push"), inBox = $("#reminders-in");
  if (!note) return;
  const cloudUser = getCloudUser();
  if (!sb || !cloudUser) {
    enableBtn.hidden = true;
    inBox.hidden = true;
    note.textContent = "Sign in above to enable reminders.";
    return;
  }
  if (!pushConfigured || !("Notification" in window)) {
    enableBtn.hidden = true;
    inBox.hidden = true;
    note.textContent = "Push isn't set up yet (see README) — per-item reminders are saved and will fire once it is.";
    return;
  }
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

export async function enablePush() {
  if (!pushConfigured) return toast("Push not configured yet — see README");
  const cloudUser = getCloudUser();
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
  } catch {
    toast("Couldn't enable notifications");
  }
}

export function initPushUI() {
  $("#btn-enable-push").addEventListener("click", enablePush);
  $("#daily-toggle").addEventListener("click", () => {
    state.reminders.dailyDigest.on = !state.reminders.dailyDigest.on;
    save();
    renderRemindersUI();
  });
  $("#daily-time").addEventListener("change", (e) => {
    state.reminders.dailyDigest.time = e.target.value || "09:00";
    save();
  });
}
