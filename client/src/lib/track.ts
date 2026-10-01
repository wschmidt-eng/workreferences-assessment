import { API_BASE } from "@/lib/queryClient";

// Anonymous funnel tracking. A random id held in memory for this page visit:
// never stored, and never linked to a name, email, phone or assessment.
let currentVisit = "";
function visitId(): string {
  if (!currentVisit) {
    currentVisit = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(
      /[^a-z0-9-]/gi,
      ""
    );
  }
  return currentVisit;
}

const sent = new Set<string>();

export function track(step: string) {
  if (sent.has(step)) return;
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
