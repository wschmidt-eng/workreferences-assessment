import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Embeddable, anonymous research chart for workreferences.com/insights/research.
// URL options (after #/embed/research?):
//   area=references|dates|titles|arrangement|departure|consistency|results|status   (default: references)
//   period=all|12m|3m|1m   (default: all)
//   tabs=0                 hide the question tabs (lock the widget to one chart)
//   demo=1                 sample data, for previewing the design before real responses arrive

interface Bar {
  id?: string;
  key?: string;
  label: string;
  count: number;
  pct: number;
}
interface Summary {
  n?: number;
  minimum: number;
  ready: boolean;
  demo: boolean;
  period: string;
  updatedAt: string;
  areas: { key: string; title: string; question: string; multi: boolean; options: Bar[] }[];
  results?: Bar[];
  statuses?: Bar[];
}

const PERIOD_LABELS: Record<string, string> = { all: "All time", "12m": "Last 12 months", "3m": "Last 3 months", "1m": "This month" };

function readParams() {
  const hash = window.location.hash;
  const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : window.location.search.slice(1);
  return new URLSearchParams(q);
}

export default function ResearchWidget() {
  const params = useMemo(readParams, []);
  return (
    <ResearchChart
      initialArea={params.get("area") || undefined}
      initialPeriod={params.get("period") || undefined}
      showTabs={params.get("tabs") !== "0"}
      demo={params.get("demo") === "1"}
      postHeight
    />
  );
}

export function ResearchChart({
  initialArea = "references",
  initialPeriod = "all",
  showTabs = true,
  demo = false,
  postHeight = false,
}: {
  initialArea?: string;
  initialPeriod?: string;
  showTabs?: boolean;
  demo?: boolean;
  postHeight?: boolean;
}) {
  const [area, setArea] = useState(initialArea);
  const [period, setPeriod] = useState(initialPeriod);
  const rootRef = useRef<HTMLDivElement>(null);

  const q = useQuery<Summary>({
    queryKey: [`/api/research/summary?period=${period}${demo ? "&demo=1" : ""}`],
    refetchInterval: 5 * 60 * 1000,
  });

  // Tell the host page how tall we are so the iframe can resize (see embed snippet).
  useEffect(() => {
    const el = rootRef.current;
    if (!postHeight || !el || typeof ResizeObserver === "undefined") return;
    const post = () =>
      window.parent?.postMessage({ type: "wr-research-height", height: Math.ceil(el.getBoundingClientRect().height) + 2 }, "*");
    const ro = new ResizeObserver(post);
    ro.observe(el);
    post();
    return () => ro.disconnect();
  }, [postHeight]);

  const data = q.data;
  const tabs = [
    ...(data?.areas ?? []).map((a) => ({ key: a.key, label: a.title })),
    { key: "results", label: "Overall results" },
    { key: "status", label: "Job-search stage" },
  ];

  let heading = "";
  let sub = "";
  let bars: Bar[] = [];
  if (data?.ready) {
    const a = data.areas.find((x) => x.key === area);
    if (a) {
      heading = a.title;
      sub = a.question + (a.multi ? " (People could choose more than one, so totals exceed 100%.)" : "");
      bars = a.options;
    } else if (area === "results") {
      heading = "Overall assessment results";
      sub = "How completed assessments were rated.";
      bars = data.results ?? [];
    } else {
      heading = "Where people are in their job search";
      sub = "Job-search stage at the time of the assessment.";
      bars = data.statuses ?? [];
    }
  }
  const max = Math.max(1, ...bars.map((b) => b.pct));

  return (
    <div ref={rootRef} className="bg-background text-foreground font-sans p-5 sm:p-6 rounded-xl border border-border" data-testid="research-widget">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">WorkReferences research</p>
          <h2 className="font-display text-lg sm:text-xl font-semibold mt-1 leading-snug">
            {data?.ready ? heading : "Free Reference Risk Assessment findings"}
          </h2>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
          aria-label="Time period"
          data-testid="select-period"
        >
          {Object.entries(PERIOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {data?.demo && (
        <p className="mt-3 rounded-md bg-amber-50 text-amber-800 text-xs px-3 py-2" data-testid="text-demo">
          Sample data for preview. Real results replace this automatically.
        </p>
      )}

      {showTabs && data?.ready && (
        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Question">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={area === t.key}
              onClick={() => setArea(t.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                area === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary/50"
              )}
              data-testid={`tab-${t.key}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {q.isLoading ? (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      ) : q.isError || !data ? (
        <p className="mt-6 text-sm text-muted-foreground">Research data is temporarily unavailable.</p>
      ) : !data.ready ? (
        <div className="mt-6 rounded-lg bg-muted/60 p-5 text-sm text-muted-foreground leading-relaxed" data-testid="text-collecting">
          We're collecting responses. To protect everyone's privacy, results appear here once at least {data.minimum} anonymous
          assessments are complete{period !== "all" ? " for this period" : ""}.
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{sub}</p>
          <ul className="mt-4 space-y-2.5" data-testid="list-bars">
            {bars.map((b) => (
              <li key={b.id || b.key || b.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-foreground">{b.label}</span>
                  <span className="tabular-nums font-medium text-foreground shrink-0">{b.pct}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(b.pct / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
        {data?.ready ? `Based on ${data.n?.toLocaleString()} anonymous assessments · ${PERIOD_LABELS[period]} · ` : ""}
        Source:{" "}
        <a href="https://workreferences.com/insights/research" target="_blank" rel="noopener noreferrer" className="underline">
          WorkReferences Free Reference Risk Assessment
        </a>
        . Answers are collected without names or contact details.
      </p>
    </div>
  );
}
