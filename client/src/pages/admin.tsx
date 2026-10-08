import { useState } from "react";
import { ResearchChart } from "@/pages/research-widget";
import { FunnelPanel } from "@/components/funnel-panel";
import { Link } from "wouter";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, API_BASE } from "@/lib/queryClient";
import { markAdminBrowser } from "@/lib/track";
import { computeResult, RESULT_COPY, RISK_AREAS, type AreaAnswers, type Position } from "@shared/riskAreas";
import { FlagChip } from "@/pages/free-assessment";
import { cn } from "@/lib/utils";
import { Loader2, Download, ChevronDown, Lock, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PendingDelete = { kind: "row"; id: string; name: string; hasResume: boolean } | { kind: "coaching"; count: number };

interface Row {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobSearchStatus: string;
  targetRole: string;
  data: string;
  status: string;
  overallScore: number | null;
  resultCategory: string | null;
  resumeFileName: string | null;
  hasResume: boolean;
  createdAt: number;
}

export default function Admin() {
  const [key, setKey] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [coachingCount, setCoachingCount] = useState(0);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadCoachingCount() {
    try {
      const res = await apiRequest("GET", `/api/admin/coaching-records`, undefined, { "x-admin-key": key });
      setCoachingCount((await res.json()).count || 0);
    } catch {}
  }

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      if (pending.kind === "row") {
        await apiRequest("DELETE", `/api/admin/risk-assessments/${pending.id}`, undefined, { "x-admin-key": key });
        setRows((rs) => (rs || []).filter((r) => r.id !== pending.id));
        setOpen(null);
      } else {
        await apiRequest("DELETE", `/api/admin/coaching-records`, undefined, { "x-admin-key": key });
        setCoachingCount(0);
      }
      setPending(null);
    } catch {
      setError("Couldn't delete that. Please refresh and try again.");
      setPending(null);
    } finally {
      setDeleting(false);
    }
  }

  async function downloadResume(id: string, name: string) {
    try {
      const res = await apiRequest("GET", `/api/admin/risk-assessments/${id}/resume`, undefined, { "x-admin-key": key });
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setError("Couldn't download that file.");
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("GET", `/api/admin/risk-assessments`, undefined, { "x-admin-key": key });
      setRows(await res.json());
      markAdminBrowser();
      loadCoachingCount();
    } catch {
      setError("That passcode didn't work.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="WorkReferences home">
            <Wordmark />
          </Link>
          <span className="text-xs text-muted-foreground">Consultant view</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {!rows ? (
          <form
            className="max-w-sm mx-auto mt-10 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <div className="flex items-center gap-2 text-foreground">
              <Lock className="h-4 w-4 text-primary" />
              <h1 className="text-base font-display font-semibold">Assessment submissions</h1>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key">Consultant passcode</Label>
              <Input id="key" type="password" value={key} onChange={(e) => setKey(e.target.value)} data-testid="input-admin-key" />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button type="submit" disabled={!key || loading} className="w-full" data-testid="button-admin-login">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} View submissions
            </Button>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-display font-semibold text-foreground">Assessment submissions</h1>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Refresh
              </Button>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No submissions yet.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((r) => {
                  let data: { answers?: AreaAnswers; positions?: Position[] } = {};
                  try {
                    data = JSON.parse(r.data || "{}");
                  } catch {}
                  const result = computeResult(data.answers || {});
                  const isOpen = open === r.id;
                  const complete = r.status === "complete";
                  return (
                    <div key={r.id} className="rounded-lg border border-border" data-testid={`admin-row-${r.id}`}>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : r.id)}
                        className="w-full text-left p-4 flex flex-wrap items-center gap-x-4 gap-y-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {r.firstName} {r.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.email}
                            {r.phone && ` · ${r.phone}`} · {new Date(r.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {complete ? (
                          <span className="text-sm font-medium tabular-nums text-foreground">
                            {r.overallScore}/100 · {RESULT_COPY[(r.resultCategory as keyof typeof RESULT_COPY) || "aligned"].title}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            In progress · {result.areas.length}/6 areas
                          </span>
                        )}
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-border p-4 space-y-4 text-sm">
                          <div className="grid sm:grid-cols-3 gap-3 text-muted-foreground">
                            <p>
                              <span className="text-foreground font-medium">Status: </span>
                              {r.jobSearchStatus || "—"}
                            </p>
                            <p>
                              <span className="text-foreground font-medium">Target role: </span>
                              {r.targetRole || "—"}
                            </p>
                            <p>
                              <span className="text-foreground font-medium">Resume: </span>
                              {r.hasResume ? (
                                <a
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    downloadResume(r.id, r.resumeFileName || "resume");
                                  }}
                                  className="text-primary underline inline-flex items-center gap-1"
                                >
                                  <Download className="h-3.5 w-3.5" /> {r.resumeFileName}
                                </a>
                              ) : (
                                "Not uploaded"
                              )}
                            </p>
                          </div>
                          {!!data.positions?.length && (
                            <div>
                              <p className="font-medium text-foreground mb-1">Positions</p>
                              <ul className="text-muted-foreground space-y-0.5">
                                {data.positions.map((p, i) => (
                                  <li key={i}>
                                    {p.employer} — {p.title}
                                    {(p.start || p.end || p.current) && ` (${p.start || "start not given"} to ${p.current ? "present" : p.end || "end not given"})`}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="space-y-2">
                            {RISK_AREAS.map((a) => {
                              const sa = result.areas.find((x) => x.key === a.key);
                              return (
                                <div key={a.key} className="rounded-md bg-muted/50 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-medium text-foreground">
                                      {a.number}. {a.title}
                                    </p>
                                    {sa ? <FlagChip flag={sa.flag} score={sa.score} /> : <span className="text-xs text-muted-foreground">Not answered</span>}
                                  </div>
                                  {sa && (
                                    <>
                                      <p className="text-muted-foreground mt-1">{sa.answerLabel}</p>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-end pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
                              onClick={() =>
                                setPending({ kind: "row", id: r.id, name: `${r.firstName} ${r.lastName}`.trim() || r.email || "this person", hasResume: r.hasResume })
                              }
                              data-testid={`button-delete-${r.id}`}
                            >
                              <Trash2 className="h-4 w-4" /> Delete record
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {coachingCount > 0 && (
              <div className="mt-4 rounded-lg border border-border p-4 flex flex-wrap items-center justify-between gap-3" data-testid="section-coaching-records">
                <div className="text-sm">
                  <p className="font-medium text-foreground">Old coaching records</p>
                  <p className="text-muted-foreground">
                    {coachingCount} {coachingCount === 1 ? "record" : "records"} from the retired 5-session coaching flow. They aren't listed above.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
                  onClick={() => setPending({ kind: "coaching", count: coachingCount })}
                  data-testid="button-delete-coaching"
                >
                  <Trash2 className="h-4 w-4" /> Delete old coaching records
                </Button>
              </div>
            )}

            <AlertDialog open={!!pending} onOpenChange={(o) => !o && !deleting && setPending(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {pending?.kind === "row" ? `Delete ${pending.name}'s record?` : "Delete old coaching records?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {pending?.kind === "row"
                      ? `This permanently removes their contact details and answers${pending.hasResume ? ", and their uploaded resume" : ""}. This can't be undone.`
                      : `This permanently removes ${pending?.count ?? 0} ${pending?.count === 1 ? "record" : "records"} from the retired coaching flow. This can't be undone.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      confirmDelete();
                    }}
                    disabled={deleting}
                    className="bg-red-700 text-white hover:bg-red-800"
                    data-testid="button-confirm-delete"
                  >
                    {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <FunnelPanel passcode={key} />

            <section className="mt-10 space-y-3" data-testid="section-admin-research">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-display font-semibold text-foreground">Research widget</h2>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={sample} onChange={(e) => setSample(e.target.checked)} data-testid="checkbox-sample" />
                  Show sample data
                </label>
              </div>
              <p className="text-sm text-muted-foreground">
                This is the chart shown on the results page and in the embed for workreferences.com/insights/research. Real
                numbers appear after 25 completed assessments.
              </p>
              <ResearchChart key={sample ? "demo" : "live"} demo={sample} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
