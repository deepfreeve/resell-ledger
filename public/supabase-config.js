// Supabase publishable keys are designed to be used in browser apps.
// Row Level Security in supabase/schema.sql protects each user's records.
window.CACHE_SUPABASE_URL = "https://owtmgkmrmabmyhblooii.supabase.co";
window.CACHE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dj9hFIORAwC-tqMLI0xuHw_c08daUKr";
const capacitorNative = /^(capacitor|ionic):$/.test(window.location.protocol)
  || window.location.origin === "https://localhost"
  || window.Capacitor?.isNativePlatform?.() === true;
window.CACHE_API_ORIGIN = capacitorNative ? "https://usecache.org" : window.location.origin;
