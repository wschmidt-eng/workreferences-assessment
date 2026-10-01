import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface FunnelStep {
  key: string;
  label: string;
  visits: number;
  ofStart: number;
  dropFromPrev: number;
}

const RANGES = [7, 30, 90, 365];

export function FunnelPanel({ passcode }: { passcode: string }) {
  const [days, setDays] = useState(30);
  const [steps, setSteps] = useState<FunnelStep[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    setSteps(null);
    setError(false);
    apiRequest("GET", `/api/admin/funnel?days=${days}`, undefined, { "x-admin-key": passcode })
      .then((r) => r.json())
      .then((j) => live && setSteps(j.steps))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [days, passcode]);

  const start = steps?.[0]?.visits || 0;
  const resultsVisits = steps?.find((x) => x.key === "results")?.visits || 0;
  const worst = steps
    ?.filter((s) => !["intro", "booking_click", "resume_upload"].includes(s.key) && start > 0)
    .sort((a, b) => b.dropFromPrev - a.dropFromPrev)[0];

  return (
    <section className="mt-10 space-y-3" data-testid="section-funnel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-display font-semibold text-foreground">Assessment funnel</h2>
        <div className="flex gap-1" role="tablist" aria-label="Date range">
          {RANGES.map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={days === d}
              onClick={() => setDays(d)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs",
                days === d ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
              )}
              data-testid={`funnel-range-${d}`}
            >
              {d === 365 ? "1 year" : `${d} days`}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Unique visits that reached each step. Anonymous: no names, contact details or links to submissions.
      </p>
      <div className="rounded-lg border border-border p-4">
        {error ? (
          <p className="text-sm text-muted-foreground">Couldn't load funnel data.</p>
        ) : !steps ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : start === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No visits recorded in this period yet.</p>
        ) : (
          <>
            {worst && worst.dropFromPrev > 0 && (
              <p className="mb-3 text-sm text-foreground" data-testid="text-biggest-drop">
                Biggest drop-off: <span className="font-medium">{worst.label}</span> ({worst.dropFromPrev}% of visitors left here)
              </p>
            )}
            <ul className="space-y-2" data-testid="list-funnel">
              {steps.map((s) => (
                <li key={s.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center text-sm">
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-foreground">{s.label}</span>
                      <span className="tabular-nums text-muted-foreground shrink-0">
                        {s.visits} · {s.ofStart}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, s.ofStart)}%` }} />
                    </div>
                  </div>
                  {s.key === "booking_click" || s.key === "resume_upload" ? (
                    <span className="w-24 text-right tabular-nums text-xs text-muted-foreground">
                      {resultsVisits ? `${Math.round((s.visits / resultsVisits) * 100)}% of results` : ""}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "w-24 text-right tabular-nums text-xs",
                        s.key !== "intro" && s.dropFromPrev >= 20 ? "text-orange-700 font-medium" : "text-muted-foreground"
                      )}
                    >
                      {s.key === "intro" ? "" : `−${s.dropFromPrev}%`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Right column: share of visitors lost since the previous step. Booking and resume upload show the share of people who
              saw their results.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
