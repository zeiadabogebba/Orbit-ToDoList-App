const SUPA = window.ORBIT_SUPABASE || {};

export const sb =
  window.supabase && typeof SUPA.url === "string" && SUPA.url.startsWith("https://") && !SUPA.url.includes("YOUR-")
    ? window.supabase.createClient(SUPA.url, SUPA.anonKey)
    : null;

let cloudUser = null;

export function getCloudUser() {
  return cloudUser;
}

export function setCloudUser(user) {
  cloudUser = user;
}
