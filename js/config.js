/* Orbit cloud sync configuration.
   Fill these in from your Supabase project: Dashboard → Project Settings → API.
   The anon/publishable key is SAFE to ship publicly — Row Level Security is what
   protects your data, not key secrecy. Leave the placeholders to run local-only. */

window.ORBIT_SUPABASE = {
  url: "https://atxnlxyfrzwdajsmgezd.supabase.co",        // e.g. https://abcdefghijkl.supabase.co
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0eG5seHlmcnp3ZGFqc21nZXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MTczOTgsImV4cCI6MjA5Nzk5MzM5OH0.DxcG_0szOEJq80YS1ptY6lFI17ZpV3uXVMzkxg3lhkA",        // the long "anon" / "publishable" key
};

/* Web Push (reminders). Generate VAPID keys with `npx web-push generate-vapid-keys`
   and paste the PUBLIC key here. The PRIVATE key goes in Supabase secrets, never here.
   Leave the placeholder to keep reminders off until the backend is set up. */
window.ORBIT_PUSH = {
  vapidPublic: "BCqbffR0u6Xbbj-ZgR4cyYe2qyAD1sIY6QWyQ3nZoR4OpY2E8sK5V3pKJCkHs9zmi_ur15tO0Gzl-lcxsxeuVR8",
};
