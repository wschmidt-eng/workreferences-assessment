import { API_BASE } from "@/lib/queryClient";

// Anonymous funnel tracking. Each browser gets a random id that changes every
// day, so reloads and repeat visits on the same day count once. The id is never
// linked to a name, email, phone or assessment. Automated browsers and browsers
// that have logged in to the admin view are not counted.

const VISITOR_KEY = "wr-visit";
export const ADMIN_FLAG_KEY = "wr-admin";

let memoryVisit = "";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function randomId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(
    /[^a-z0-9-]/gi,
    ""
  );
}

function visitId(): string {
  try {
    const raw = localStorage.getItem(VISITOR_KEY);
    if (raw) {
      const [day, id] = raw.split("|");
      if (day === today() && id) return id;
    }
    const id = randomId();
    localStorage.setItem(VISITOR_KEY, `${today()}|${id}`);
    return id;
  } catch {
    // Storage unavailable (private mode or the preview frame): count this page view only.
    if (!memoryVisit) memoryVisit = randomId();
    return memoryVisit;
  }
}

function excluded(): boolean {
  try {
    if (navigator.webdriver) return true;
    if (/bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|bingpreview/i.test(navigator.userAgent)) return true;
  } catch {}
  try {
    if (localStorage.getItem(ADMIN_FLAG_KEY) === "1") return true;
  } catch {}
  return false;
}

/** Call after a successful admin login so this browser stops being counted. */
export function markAdminBrowser() {
  try {
    localStorage.setItem(ADMIN_FLAG_KEY, "1");
  } catch {}
}

/** Where the visitor came from, as a broad category only. */
export function trafficSource(): string {
  let utm = "";
  let src = "";
  try {
    const qs = new URLSearchParams(window.location.search);
    const hq = window.location.hash.includes("?") ? new URLSearchParams(window.location.hash.split("?")[1]) : null;
    src = (hq?.get("src") || qs.get("src") || "").toLowerCase();
    utm = `${qs.get("utm_source") || hq?.get("utm_source") || ""} ${qs.get("utm_medium") || hq?.get("utm_medium") || ""}`.toLowerCase();
  } catch {}
  if (src === "website") return "website";
  if (/email|newsletter|mail/.test(utm)) return "email";
  if (/facebook|instagram|linkedin|twitter|x\b|tiktok|reddit|youtube|social|pinterest/.test(utm)) return "social";
  if (/google|bing|cpc|ppc|ads/.test(utm)) return "search";
  let host = "";
  try {
    host = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : "";
  } catch {}
  if (!host) return utm.trim() ? "other" : "direct";
  if (host.endsWith("workreferences.com") && !host.startsWith("assessment.")) return "website";
  if (host.startsWith("assessment.")) return "direct";
  if (/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave)\./.test(host)) return "search";
  if (/(facebook|fb|instagram|linkedin|lnkd|t\.co|twitter|x\.com|reddit|tiktok|youtube|pinterest)/.test(host)) return "social";
  if (/(mail|outlook|proton)/.test(host)) return "email";
  return "other";
}

const sent = new Set<string>();

export function track(step: string) {
  if (sent.has(step) || excluded()) return;
  const v = visitId();
  if (!v) return;
  sent.add(step);
  fetch(`${API_BASE}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ v, s: step }),
    keepalive: true,
  }).catch(() => {});
}
