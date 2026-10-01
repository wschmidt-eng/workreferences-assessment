import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Wordmark } from "@/components/logo";
import { ScoreDial } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { computeResult, RESULT_COPY, type AreaAnswers } from "@shared/riskAreas";
import { SoftChip, SOFT_STYLES, readFileAsBase64 } from "@/pages/free-assessment";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import { ResearchChart } from "@/pages/research-widget";
import { CalendarCheck, FileUp, Printer, Loader2, CheckCircle2, Search, ClipboardList } from "lucide-react";

interface PublicRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  data: string;
  hasResume: boolean;
  jobSearchStatus?: string;
}

export default function FreeResults({ params }: { params: { id: string } }) {
  const rec = useQuery<PublicRecord>({ queryKey: ["/api/risk-assessments", params.id] });
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadResume(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload a file of 5 MB or less.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const base64 = await readFileAsBase64(file);
      await apiRequest("POST", `/api/risk-assessments/${params.id}/resume`, { fileName: file.name, base64 });
      await queryClient.invalidateQueries({ queryKey: ["/api/risk-assessments", params.id] });
      track("resume_upload");
      toast({ title: "Resume added", description: "Your consultant will have it before your call." });
    } catch (e: any) {
      const msg = String(e?.message || "");
      toast({
        title: "Upload failed",
        description: msg.startsWith("400") ? msg.replace(/^400: /, "").replace(/[{}"]/g, "").replace("message:", "") : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const cfg = useQuery<{ bookingUrl: string; researchSample?: boolean }>({ queryKey: ["/api/config"] });
  useEffect(() => {
    if (rec.data) track("results");
  }, [rec.data]);

  if (rec.isLoading) {
    return (
      <Shell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Shell>
    );
  }
  if (rec.error || !rec.data) {
    return (
      <Shell>
        <div className="text-center py-16">
          <p className="text-base font-medium text-foreground">We couldn't find that assessment.</p>
          <p className="text-sm text-muted-foreground mt-2">The link may be incomplete.</p>
          <Link href="/">
            <Button className="mt-6">Start a new assessment</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  let answers: AreaAnswers = {};
  try {
    answers = JSON.parse(rec.data.data || "{}").answers || {};
  } catch {}
  const result = computeResult(answers);
  const copy = RESULT_COPY[result.category];
  const baseBookingUrl = cfg.data?.bookingUrl || "https://live.vcita.com/site/27x9gds0opl46jcy/online-scheduling?service=48a5dda49xy1aaj3";
  // Pre-fill vCita's booking form so visitors never retype their details.
  const bookingUrl = (() => {
    try {
      const u = new URL(baseBookingUrl);
      const d = rec.data!;
      const phone = (d.phone || "").replace(/(?!^\+)[^\d]/g, "");
      if (d.firstName) u.searchParams.set("first_name", d.firstName);
      if (d.lastName) u.searchParams.set("last_name", d.lastName);
      if (d.email) u.searchParams.set("email", d.email);
      if (phone) u.searchParams.set("phone", phone);
      return u.toString();
    } catch {
      return baseBookingUrl;
    }
  })();
  const Icon = result.category === "aligned" ? CheckCircle2 : result.category === "review" ? Search : ClipboardList;
  const tone =
    result.category === "aligned"
      ? "text-primary"
      : result.category === "review"
        ? "text-amber-700 dark:text-amber-300"
        : "text-orange-700 dark:text-orange-300";
  const dialColor =
    result.category === "aligned" ? "hsl(var(--primary))" : result.category === "review" ? "#F59E0B" : "#F97316";
  const todo = [...result.areas].filter((a) => a.flag !== "green").sort((a, b) => b.score - a.score).slice(0, 3);

  const urgent = rec.data.jobSearchStatus === "Received an offer, background check pending";
  const BookButton = ({ className = "" }: { className?: string }) => (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => track("booking_click")}
      data-testid="link-book-consultation"
    >
      <Button size="lg" className="w-full h-auto min-h-11 whitespace-normal leading-snug py-3">
        <CalendarCheck className="h-4 w-4 shrink-0" />
        {urgent ? "Book a priority call with a career consultant" : "Schedule a free call with a career consultant"}
      </Button>
    </a>
  );

  return (
    <Shell>
      <section className="space-y-2">
        <p className="text-xs font-medium text-primary uppercase tracking-wide">Your Reference Preparation Plan</p>
        <h1 className="text-xl font-display font-semibold text-foreground">
          {rec.data.firstName ? `${rec.data.firstName}, here's` : "Here's"} what to prepare before your next background check
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-truthful">
          Every area here has a truthful way to prepare. Your consultant will walk you through it.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-border p-5 sm:p-6" data-testid="section-todo">
        {todo.length ? (
          <>
            <h2 className="text-base font-display font-semibold text-foreground">
              Your top {todo.length === 1 ? "thing" : `${todo.length} things`} to prepare
            </h2>
            <ol className="mt-4 space-y-4">
              {todo.map((a, i) => (
                <li key={a.key} className="flex gap-3" data-testid={`todo-${a.key}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{a.title}</p>
                      <SoftChip flag={a.flag} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{a.prepare}</p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-display font-semibold text-foreground">You're in good shape</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Nothing you shared stands out as a priority. A short call can confirm your references are ready and your
                records line up before an employer checks.
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="mt-5">
        <BookButton />
        <p className="text-xs text-muted-foreground text-center mt-2">
          Free, confidential, and no obligation. Your details are already filled in, so you'll just pick a time.
          Your consultant will already have your answers{rec.data.hasResume ? " and resume" : ""}.
        </p>
        {!rec.data.hasResume && (
          <div className="mt-4 rounded-lg border border-dashed p-4 flex flex-col sm:flex-row sm:items-center gap-3 print:hidden" data-testid="panel-add-resume">
            <p className="text-sm text-muted-foreground flex-1">
              Want your consultant to compare your resume with what a verifier would see? Add it here. Optional, PDF or Word, up to 5 MB.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.rtf,.txt"
              className="hidden"
              onChange={(e) => uploadResume(e.target.files?.[0])}
              data-testid="input-results-resume"
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="button-add-resume">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Add your resume
            </Button>
          </div>
        )}
      </div>

      <section className="mt-10 rounded-xl border border-border p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-6">
        <ScoreDial score={result.overall} band={copy.band} color={dialColor} />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your Reference Risk Score</p>
          <div className={cn("mt-1 inline-flex items-center gap-2 font-display font-semibold text-lg", tone)} data-testid="text-result-category">
            <Icon className="h-5 w-5" />
            {copy.title}
          </div>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{copy.summary}</p>
          <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2 text-xs">
            <FlagCount n={result.flags.green} flag="green" />
            <FlagCount n={result.flags.yellow} flag="yellow" />
            <FlagCount n={result.flags.red} flag="red" />
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-display font-semibold text-foreground mb-1">By category</h2>
        <p className="text-xs text-muted-foreground mb-4">Lower is better. Shows how much each area could raise questions during verification.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {result.categories.map((c) => (
            <div key={c.key} className="rounded-lg border border-border p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-foreground">{c.label}</p>
                <p className="text-sm tabular-nums text-muted-foreground">{c.risk}%</p>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    c.risk <= 25 ? "bg-primary" : c.risk <= 60 ? "bg-amber-400" : "bg-orange-500"
                  )}
                  style={{ width: `${Math.max(3, c.risk)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-display font-semibold text-foreground mb-4">All 6 areas</h2>
        <div className="space-y-3">
          {result.areas.map((a) => (
            <div key={a.key} className="rounded-lg border border-border p-4" data-testid={`result-area-${a.key}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {a.number}. {a.title}
                </p>
                <SoftChip flag={a.flag} />
              </div>
              <p className="text-sm text-muted-foreground mt-1.5">You said: {a.answerLabel}</p>
              <p className="text-sm text-foreground mt-3 leading-relaxed">
                <span className="font-medium">What to prepare: </span>
                {a.prepare}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 print:hidden" data-testid="section-research">
        <h2 className="text-base font-display font-semibold text-foreground">You're not alone</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-4 leading-relaxed">
          How other people answered the same questions. Results are anonymous and shown only in aggregate.
        </p>
        {cfg.isSuccess && <ResearchChart demo={!!cfg.data?.researchSample} />}
      </section>

      <section className="mt-10 rounded-xl bg-secondary p-5 sm:p-6">
        <h2 className="text-base font-display font-semibold text-foreground">Your next step</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          A WorkReferences career consultant will walk through the areas above with you, review your resume against what a verifier
          like HireRight is likely to find, and build a plan so there are no surprises at your next background check.
        </p>
        <div className="mt-4">
          <BookButton />
        </div>
        <Button variant="ghost" size="sm" onClick={() => window.print()} className="mt-3 print:hidden" data-testid="button-print">
          <Printer className="h-4 w-4" /> Print or save as PDF
        </Button>
      </section>

      <p className="mt-10 text-xs text-muted-foreground leading-relaxed">
        This assessment is a screening tool, not a guarantee of how any employer or background-screening company will respond.
        WorkReferences provides structured, professional reference representation and HR verification. We do not provide
        falsified documents, fake diplomas, or illegal identities. All services are 100% legal, confidential, and designed to
        withstand strict corporate HR and third-party background-check scrutiny.
      </p>
    </Shell>
  );
}

function FlagCount({ n, flag }: { n: number; flag: "green" | "yellow" | "red" }) {
  const label = SOFT_STYLES[flag].label.toLowerCase();
  const dot = SOFT_STYLES[flag].dot;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      <span className="tabular-nums">{n}</span> {label}
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border print:hidden">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" aria-label="WorkReferences home">
            <Wordmark />
          </Link>
          <span className="text-xs text-muted-foreground hidden sm:block">References That Work!</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">{children}</main>
    </div>
  );
}
