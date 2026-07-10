import { $ } from "../core/dom.js";
import { LS_KEY } from "../core/constants.js";
import { state, replaceState, freshState, hasData } from "../state/store.js";
import { openSheet, closeSheets } from "../ui/sheets.js";
import { renderActive } from "../ui/render-bus.js";
import { toast } from "../ui/toast.js";
import { resetTaskFilter } from "../features/tasks.js";
import { sb, getCloudUser, setCloudUser } from "./supabase-client.js";
import { renderRemindersUI } from "./push.js";

let pushTimer = null;

function setSyncMsg(msg) {
  const el = $("#sync-status");
  if (el) el.textContent = msg;
}

export function renderSyncUI() {
  const note = $("#sync-note");
  const cloudUser = getCloudUser();
  if (!sb) {
    $("#sync-out").hidden = true;
    $("#sync-in").hidden = true;
    note.textContent = "Add your Supabase keys in js/config.js to enable backup & multi-device sync.";
    renderRemindersUI();
    return;
  }
  $("#sync-out").hidden = !!cloudUser;
  $("#sync-in").hidden = !cloudUser;
  note.textContent = cloudUser ? `Signed in as ${cloudUser.email}` : "Sign in with an email code to back up & sync across devices.";
  renderRemindersUI();
}

export function schedulePush() {
  if (!sb || !getCloudUser()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(cloudPush, 1500);
}

export async function cloudPush() {
  const cloudUser = getCloudUser();
  if (!sb || !cloudUser) return false;
  setSyncMsg("Syncing…");
  const { error } = await sb.from("orbit_state").upsert({ user_id: cloudUser.id, data: state, updated_at: new Date().toISOString() });
  setSyncMsg(error ? (navigator.onLine ? "Sync failed — will retry" : "Offline — will sync later") : "Synced just now");
  return !error;
}

export async function cloudPull() {
  const cloudUser = getCloudUser();
  if (!sb || !cloudUser) return;
  setSyncMsg("Syncing…");
  const { data, error } = await sb.from("orbit_state").select("data").eq("user_id", cloudUser.id).maybeSingle();
  if (error) { setSyncMsg("Couldn't reach the cloud — using local data"); return; }
  const remote = data && data.data;
  if (remote && (!hasData() || (remote.updatedAt || 0) > (state.updatedAt || 0))) {
    replaceState(remote);
    localStorage.setItem(LS_KEY, JSON.stringify(remote));
    resetTaskFilter();
    renderActive();
    setSyncMsg("Synced — loaded latest");
  } else {
    cloudPush();
  }
}

export function initCloudSync() {
  $("#btn-settings").addEventListener("click", () => { renderSyncUI(); openSheet("sheet-settings"); });
  if (!sb) return;

  sb.auth.getSession().then(({ data }) => {
    setCloudUser(data.session ? data.session.user : null);
    renderSyncUI();
    if (getCloudUser()) cloudPull();
  });
  sb.auth.onAuthStateChange((_event, session) => {
    const previousId = getCloudUser() && getCloudUser().id;
    setCloudUser(session ? session.user : null);
    renderSyncUI();
    if (getCloudUser() && getCloudUser().id !== previousId) cloudPull();
  });

  $("#btn-send-code").addEventListener("click", async () => {
    const email = $("#sync-email").value.trim();
    if (!email) return;
    const btn = $("#btn-send-code");
    btn.disabled = true;
    btn.textContent = "Sending…";
    const { error } = await sb.auth.signInWithOtp({ email });
    btn.disabled = false;
    btn.textContent = "Send sign-in code";
    if (error) return toast("Couldn't send code: " + error.message);
    $("#sync-code-row").hidden = false;
    $("#sync-code").focus();
    toast("Code sent — check your email");
  });

  $("#btn-verify-code").addEventListener("click", async () => {
    const email = $("#sync-email").value.trim(), token = $("#sync-code").value.trim();
    if (!email || !token) return;
    const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
    if (error) return toast("That code didn't work — try again");
    $("#sync-code-row").hidden = true;
    $("#sync-code").value = "";
    toast("Signed in — syncing");
  });

  $("#btn-signout").addEventListener("click", async () => {
    clearTimeout(pushTimer);
    const ok = await cloudPush();
    if (!ok) return toast("Couldn't back up latest changes — check your connection");
    await sb.auth.signOut();
    replaceState(freshState());
    localStorage.removeItem(LS_KEY);
    resetTaskFilter();
    closeSheets();
    renderActive();
    toast("Signed out — this device was wiped. Data is safe in the cloud.");
  });

  $("#btn-sync-now").addEventListener("click", () => cloudPull());
  window.addEventListener("online", schedulePush);
}
