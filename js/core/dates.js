export const pad2 = (n) => String(n).padStart(2, "0");
export const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const todayKey = () => dateKey(new Date());
export const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
export const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const niceDate = (k) => { const d = parseKey(k); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const niceShort = (k) => { const d = parseKey(k); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const niceMD = (m, d) => `${d} ${MONTHS[m - 1]}`;

export const tzGuess = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
};

export const fmtTime = (hm) => {
  const [h, m] = hm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export function dueLabel(k) {
  const diff = daysBetween(todayKey(), k);
  if (diff < 0) return { text: diff === -1 ? "Yesterday" : `${-diff}d overdue`, cls: "overdue", icon: "clock" };
  if (diff === 0) return { text: "Today", cls: "today", icon: "clock" };
  if (diff === 1) return { text: "Tomorrow", cls: "soon", icon: "clock" };
  if (diff <= 3) return { text: `in ${diff}d`, cls: "soon", icon: "clock" };
  return { text: niceShort(k), cls: "", icon: "clock" };
}

export function deadlineLabel(t) {
  const k = t.deadline;
  if (!k) return null;
  if (!t.time) return dueLabel(k);
  const dayDiff = daysBetween(todayKey(), k);
  const ts = fmtTime(t.time);
  if (dayDiff < 0) return { text: dayDiff === -1 ? `Yesterday · ${ts}` : `${-dayDiff}d overdue`, cls: "overdue", icon: "clock" };
  if (dayDiff === 0) {
    const now = new Date();
    const [h, m] = t.time.split(":").map(Number);
    const passed = now.getHours() * 60 + now.getMinutes() > h * 60 + m;
    return { text: `${passed ? "Overdue" : "Today"} · ${ts}`, cls: passed ? "overdue" : "today", icon: "clock" };
  }
  if (dayDiff === 1) return { text: `Tomorrow · ${ts}`, cls: "soon", icon: "clock" };
  return { text: `${niceShort(k)} · ${ts}`, cls: dayDiff <= 3 ? "soon" : "", icon: "clock" };
}
