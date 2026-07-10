import { $ } from "../core/dom.js";
import { LS_KEY } from "../core/constants.js";
import { todayKey } from "../core/dates.js";
import { state, replaceState, save, freshState } from "../state/store.js";
import { closeSheets } from "../ui/sheets.js";
import { renderActive } from "../ui/render-bus.js";
import { toast } from "../ui/toast.js";
import { resetTaskFilter } from "./tasks.js";

export function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orbit-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Backup exported");
}

export function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || parsed.v !== 1) throw new Error("invalid backup");
      replaceState(parsed);
      save();
      closeSheets();
      renderActive();
      toast("Backup imported");
    } catch {
      toast("That file didn't look like an Orbit backup");
    }
  };
  reader.readAsText(file);
}

let wipeTimer = null;

export function onWipe() {
  const btn = $("#btn-wipe");
  if (!btn.classList.contains("armed")) {
    btn.classList.add("armed");
    btn.textContent = "Tap again to erase everything";
    wipeTimer = setTimeout(() => {
      btn.classList.remove("armed");
      btn.textContent = "Erase everything on this device";
    }, 3000);
    return;
  }
  clearTimeout(wipeTimer);
  btn.classList.remove("armed");
  btn.textContent = "Erase everything on this device";
  replaceState(freshState());
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  resetTaskFilter();
  closeSheets();
  renderActive();
  toast("Everything erased");
}

export function initBackupUI() {
  $("#btn-export").addEventListener("click", exportBackup);
  $("#btn-import").addEventListener("click", () => $("#file-import").click());
  $("#file-import").addEventListener("change", (e) => {
    if (e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = "";
  });
  $("#btn-wipe").addEventListener("click", onWipe);
}
