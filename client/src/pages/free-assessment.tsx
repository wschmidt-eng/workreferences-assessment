import { useEffect, useMemo, useState } from "react";
import founderPhoto from "@/assets/william-schmidt.jpg";
import { track } from "@/lib/track";
import { useLocation, Link } from "wouter";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  RISK_AREAS,
  JOB_SEARCH_STATUSES,
  OTHER_ID,
  isAnswered,
  type AreaAnswers,
  type AreaAnswer,
  type Position,
  type Flag,
} from "@shared/riskAreas";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileSearch,
  CalendarClock,
  Scale,
  Upload,
  FileText,
  X,
  Plus,
  Trash2,
  Lock,
  Info,
  Pencil,
  Check,
  ChevronDown,
  Clock,
  ShieldCheck,
  Star,
  HeartHandshake,
} from "lucide-react";


export const FLAG_STYLES: Record<Flag, { label: string; chip: string; dot: string }> = {
  green: {
    label: "Green flag",
    chip: "bg-primary/10 text-primary border-primary/25",
    dot: "bg-primary",
  },
  yellow: {
    label: "Yellow flag",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
  },
  red: {
    label: "Red flag",
    chip: "bg-destructive/10 text-destructive border-destructive/25",
    dot: "bg-destructive",
  },
};

// Visitor-facing labels: coaching language, no "red flag" wording, no numeric scores.
export const SOFT_STYLES: Record<Flag, { label: string; chip: string; dot: string; bar: string; text: string }> = {
  green: {
    label: "Aligned",
    chip: "bg-primary/10 text-primary border-primary/25",
    dot: "bg-primary",
    bar: "bg-primary",
    text: "text-primary",
  },
  yellow: {
    label: "Worth reviewing",
    chip: "bg-amber-400/15 text-amber-700 dark:text-amber-300 border-amber-400/40",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
    text: "text-amber-700 dark:text-amber-300",
  },
  red: {
    label: "Priority to prepare",
    chip: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
    dot: "bg-orange-500",
    bar: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-300",
  },
};

export function SoftChip({ flag }: { flag: Flag }) {
  const s = SOFT_STYLES[flag];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", s.chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

// Consultant-only chip (admin view): full flag language and 1–10 score.
export function FlagChip({ flag, score }: { flag: Flag; score?: number }) {
  const s = FLAG_STYLES[flag];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", s.chip)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
      {score !== undefined && <span className="tabular-nums">· {score}/10</span>}
    </span>
  );
}

const emptyPosition = (): Position => ({ employer: "", title: "", start: "", end: "", current: false });

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const PROGRESS_KEY = "wr-assessment-progress";
const URGENT_STATUS = "Received an offer, background check pending";

// Steps: 0 intro, 1–6 questions, 7 positions, 8 contact ("your plan is ready")
const Q_START = 1;
const POSITIONS_STEP = Q_START + RISK_AREAS.length; // 7
const CONTACT_STEP = POSITIONS_STEP + 1; // 8

interface SavedProgress {
  step: number;
  answers: AreaAnswers;
  positions: Position[];
  jobSearchStatus: string;
  targetRole: string;
  savedAt: number;
}

function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as SavedProgress;
    // Keep saved progress for 30 days.
    if (!p || typeof p.step !== "number" || Date.now() - (p.savedAt || 0) > 30 * 86400000) return null;
    if (!Object.keys(p.answers || {}).length) return null;
    return p;
  } catch {
    return null;
  }
}

function stepEvent(step: number): string {
  if (step === 0) return "intro";
  if (step >= Q_START && step < POSITIONS_STEP) return `q${step - Q_START + 1}`;
  if (step === POSITIONS_STEP) return "positions";
  return "contact";
}

export default function FreeAssessment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [saved] = useState<SavedProgress | null>(() => loadProgress());
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [returnToContact, setReturnToContact] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobSearchStatus, setJobSearchStatus] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [consent, setConsent] = useState(false);

  const [positions, setPositions] = useState<Position[]>([emptyPosition()]);
  const [answers, setAnswers] = useState<AreaAnswers>({});

  const areaIndex = step - Q_START;
  const area = areaIndex >= 0 && areaIndex < RISK_AREAS.length ? RISK_AREAS[areaIndex] : null;
  const urgent = jobSearchStatus === URGENT_STATUS;
  const minutesLeft = Math.max(1, Math.round((CONTACT_STEP + 1 - step) * 0.6));

  useEffect(() => {
    track(stepEvent(step));
  }, [step]);

  // Save progress on this device (answers only, never contact details).
  useEffect(() => {
    if (step === 0 && !Object.keys(answers).length) return;
    try {
      const p: SavedProgress = { step, answers, positions, jobSearchStatus, targetRole, savedAt: Date.now() };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    } catch {}
  }, [step, answers, positions, jobSearchStatus, targetRole]);

  function resumeSaved() {
    if (!saved) return;
    setAnswers(saved.answers || {});
    setPositions(saved.positions?.length ? saved.positions : [emptyPosition()]);
    setJobSearchStatus(saved.jobSearchStatus || "");
    setTargetRole(saved.targetRole || "");
    setStep(Math.min(Math.max(saved.step, Q_START), CONTACT_STEP));
    window.scrollTo({ top: 0 });
  }

  function startOver() {
    try { localStorage.removeItem(PROGRESS_KEY); } catch {}
    setAnswers({});
    setPositions([emptyPosition()]);
    setStep(Q_START);
    window.scrollTo({ top: 0 });
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length >= 10 && phoneDigits.length <= 15;
  const allAnswered = RISK_AREAS.every((a) => isAnswered(a, answers[a.key]));

  const canContinue = useMemo(() => {
    if (step === CONTACT_STEP) return allAnswered && !!firstName.trim() && emailValid && phoneValid && consent;
    if (area) return isAnswered(area, answers[area.key]);
    return true;
  }, [step, allAnswered, firstName, emailValid, phoneValid, consent, area, answers]);

  function updateAnswer(key: string, patch: Partial<AreaAnswer>) {
    setAnswers((prev) => {
      const cur: AreaAnswer = (prev as any)[key] || { optionIds: [], other: "" };
      return { ...prev, [key]: { ...cur, ...patch } };
    });
  }

  function go(next: number) {
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  async function handleContinue() {
    if (!canContinue || busy) return;
    if (step !== CONTACT_STEP) {
      if (returnToContact && area) {
        setReturnToContact(false);
        go(CONTACT_STEP);
        return;
      }
      go(step + 1);
      return;
    }
    setBusy(true);
    try {
      const cleanPositions = positions.filter((p) => p.employer.trim() || p.title.trim());
      const res = await apiRequest("POST", "/api/risk-assessments", {
        firstName,
        lastName,
        email,
        phone,
        jobSearchStatus,
        targetRole,
        consent,
        data: { positions: cleanPositions, answers },
      });
      const json = await res.json();
      await apiRequest("PATCH", `/api/risk-assessments/${json.id}`, { data: { positions: cleanPositions, answers }, complete: true });
      try { localStorage.removeItem(PROGRESS_KEY); } catch {}
      setLocation(`/free-assessment/${json.id}/results`);
    } catch (e: any) {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function handleBack() {
    setReturnToContact(false);
    go(Math.max(0, step - 1));
  }

  const positionsFilled = positions.some((p) => p.employer.trim() || p.title.trim());
  const continueLabel =
    step === 0
      ? "Start my free assessment"
      : step === POSITIONS_STEP && !positionsFilled
        ? "Skip this step"
        : step === CONTACT_STEP
          ? "See my plan"
          : returnToContact && area
            ? "Save and return"
            : "Continue";

  const stepLabel = area ? `Question ${area.number} of 6` : step === POSITIONS_STEP ? "Almost done" : "Last step";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" aria-label="WorkReferences home">
            <Wordmark />
          </Link>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 shrink-0" /> <span className="sm:hidden">Free · Private</span><span className="hidden sm:inline">Free · Private · No obligation</span>
          </span>
        </div>
        {step > 0 && (
          <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span data-testid="text-step">{stepLabel}</span>
              <span>About {minutesLeft} min left</span>
            </div>
            <Progress value={(step / CONTACT_STEP) * 100} className="h-1.5" />
          </div>
        )}
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10">
        {step === 0 && (
          <IntroStep
            saved={saved}
            onResume={resumeSaved}
            onStartOver={startOver}
            status={jobSearchStatus}
            onStatus={setJobSearchStatus}
          />
        )}

        {area && urgent && (
          <div className="mb-6 flex items-start gap-2.5 rounded-md border border-primary/25 bg-primary/5 p-3.5" data-testid="banner-urgent">
            <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-relaxed">
              <span className="font-medium">Short on time?</span> This takes about 5 minutes, and your results include a
              booking link for a priority call.
            </p>
          </div>
        )}

        {area && (
          <AreaStep
            key={area.key}
            areaIndex={areaIndex}
            answer={answers[area.key]}
            onChange={(patch) => updateAnswer(area.key, patch)}
          />
        )}

        {step === POSITIONS_STEP && (
          <section className="space-y-6">
            <StepHeading
              eyebrow="Optional"
              title="Which job is most likely to be checked?"
              lead="Usually your most recent role. This stays between you and your consultant. It's just so your plan can refer to the right job. You can skip it."
            />
            <div className="space-y-4">
              {positions.map((p, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-3" data-testid={`card-position-${i}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Position {i + 1}</p>
                    {positions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPositions((ps) => ps.filter((_, j) => j !== i))}
                        aria-label={`Remove position ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Employer (a nickname or initials is fine)" htmlFor={`emp-${i}`}>
                      <Input
                        id={`emp-${i}`}
                        value={p.employer}
                        onChange={(e) => setPositions((ps) => ps.map((x, j) => (j === i ? { ...x, employer: e.target.value } : x)))}
                        data-testid={`input-employer-${i}`}
                      />
                    </Field>
                    <Field label="Title on your resume" htmlFor={`ttl-${i}`}>
                      <Input
                        id={`ttl-${i}`}
                        value={p.title}
                        onChange={(e) => setPositions((ps) => ps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                        data-testid={`input-title-${i}`}
                      />
                    </Field>
                    <Field label="Start (month and year)" htmlFor={`st-${i}`}>
                      <Input
                        id={`st-${i}`}
                        type="month"
                        value={p.start}
                        onChange={(e) => setPositions((ps) => ps.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                      />
                    </Field>
                    <Field label="End (month and year)" htmlFor={`en-${i}`}>
                      <Input
                        id={`en-${i}`}
                        type="month"
                        value={p.end}
                        disabled={p.current}
                        onChange={(e) => setPositions((ps) => ps.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={p.current}
                      onCheckedChange={(v) =>
                        setPositions((ps) => ps.map((x, j) => (j === i ? { ...x, current: v === true, end: v === true ? "" : x.end } : x)))
                      }
                    />
                    I currently work here
                  </label>
                </div>
              ))}
            </div>
            {positions.length < 3 && (
              <Button variant="ghost" size="sm" onClick={() => setPositions((ps) => [...ps, emptyPosition()])} data-testid="button-add-position">
                <Plus className="h-4 w-4" /> Add another position (optional)
              </Button>
            )}
          </section>
        )}

        {step === CONTACT_STEP && (
          <section className="space-y-6">
            <StepHeading
              eyebrow="Your plan is ready"
              title="Where should we send it?"
              lead="Enter your details to see your results and your personal preparation plan."
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="First name" htmlFor="fn">
                <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" data-testid="input-first-name" />
              </Field>
              <Field label="Last name (optional)" htmlFor="ln">
                <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" data-testid="input-last-name" />
              </Field>
              <Field label="Email" htmlFor="em" error={email && !emailValid ? "Enter a valid email address" : undefined}>
                <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="input-email" />
              </Field>
              <Field
                label="Mobile phone"
                htmlFor="ph"
                hint="Only used to confirm your free call if you book one. Never shared with employers."
                error={phone && !phoneValid ? "Enter a valid phone number, including area code" : undefined}
              >
                <Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" data-testid="input-phone" />
              </Field>
              {!jobSearchStatus && (
                <Field label="Job-search stage (optional)" htmlFor="st">
                  <Select value={jobSearchStatus} onValueChange={setJobSearchStatus}>
                    <SelectTrigger id="st" data-testid="select-status">
                      <SelectValue placeholder="Select one" />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_SEARCH_STATUSES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Target role (optional)" htmlFor="tr">
                <Input id="tr" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Project Manager" data-testid="input-target-role" />
              </Field>
            </div>

            <div className="flex items-start gap-2.5 rounded-md bg-primary/5 border border-primary/20 p-3.5">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">
                We never contact an employer without your permission, and we never share your answers with an employer.
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-md border border-border p-4 cursor-pointer" htmlFor="consent">
              <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" data-testid="checkbox-consent" />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I agree that WorkReferences may store the information I provide to prepare my assessment and to contact me about
                my results. My information will not be shared with any employer. My answers may be used anonymously, in
                aggregate, for WorkReferences research.
              </span>
            </label>

            <Testimonial compact />

            <details className="group rounded-lg border border-border" data-testid="details-review">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-medium text-foreground">
                Review or change your answers
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2 px-4 pb-4">
                {RISK_AREAS.map((a, i) => {
                  const ans = answers[a.key];
                  const labels = a.options
                    .filter((o) => ans?.optionIds.includes(o.id))
                    .map((o) => (o.id === OTHER_ID && ans?.other ? `Other: ${ans.other}` : o.label));
                  return (
                    <div key={a.key} className="flex items-start gap-3 rounded-md bg-muted/50 p-3" data-testid={`review-${a.key}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {a.number}. {a.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">{labels.length ? labels.join("; ") : "Not answered"}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReturnToContact(true);
                          go(Q_START + i);
                        }}
                        aria-label={`Change ${a.title}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </details>
            <PrivacyPanel />
          </section>
        )}
      </main>

      <footer className="border-t border-border bg-background sticky bottom-0">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-3 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {step > 0 ? (
            <Button variant="outline" onClick={handleBack} disabled={busy} className="w-full sm:w-auto" data-testid="button-back">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <span className="hidden sm:block text-xs text-muted-foreground">About 5 minutes · 6 multiple-choice questions</span>
          )}
          <Button
            onClick={step === 0 && saved ? startOver : handleContinue}
            disabled={!canContinue || busy}
            className="w-full sm:w-auto h-auto min-h-10 whitespace-normal text-center leading-snug py-2.5"
            data-testid="button-continue"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
            {step === 0 && saved ? "Start a new assessment" : continueLabel}
            {!busy && <ChevronRight className="h-4 w-4 shrink-0" />}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function StepHeading({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-primary uppercase tracking-wide mb-2">{eyebrow}</p>
      <h1 className="text-xl font-display font-semibold text-foreground leading-snug">{title}</h1>
      {lead && <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-prose">{lead}</p>}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Swap in a photo URL (e.g. "/william.jpg") to replace the monogram.
const FOUNDER_PHOTO_URL: string = founderPhoto;

function FounderNote() {
  return (
    <figure className="flex items-start gap-4 rounded-lg border border-border p-4 sm:p-5" data-testid="founder-note">
      {FOUNDER_PHOTO_URL ? (
        <img src={FOUNDER_PHOTO_URL} alt="William Schmidt, Founder and CEO of WorkReferences" width={56} height={56} className="h-14 w-14 rounded-full object-cover shrink-0 ring-2 ring-primary/20" />
      ) : (
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-semibold">
          WS
        </span>
      )}
      <div>
        <blockquote className="text-sm sm:text-base text-foreground leading-relaxed">
          “Our goal is to help you enter the screening process prepared, not surprised.”
        </blockquote>
        <figcaption className="mt-1.5 text-xs text-muted-foreground">William Schmidt, Founder &amp; CEO, WorkReferences</figcaption>
      </div>
    </figure>
  );
}

function Testimonial({ compact = false }: { compact?: boolean }) {
  return (
    <figure className={cn("rounded-lg bg-muted/60", compact ? "p-3.5" : "p-4 sm:p-5")} data-testid="testimonial">
      <div className="flex items-center gap-0.5 text-amber-500" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-3.5 w-3.5 fill-current" />
        ))}
      </div>
      <blockquote className="mt-2 text-sm text-foreground leading-relaxed">
        “To be 100% honest I was skeptical at first. But they are 100% legit and have been so essential for me.”
      </blockquote>
      <figcaption className="mt-1.5 text-xs text-muted-foreground">Dan Z. · Google Reviews</figcaption>
    </figure>
  );
}

function PrivacyPanel() {
  return (
    <details className="group rounded-lg border border-border" data-testid="details-privacy">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-medium text-foreground">
        <span className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" /> What happens to my answers?
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="space-y-2 px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
        <li className="flex gap-2">
          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Only your WorkReferences consultant sees your answers.
        </li>
        <li className="flex gap-2">
          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> We never contact an employer without your permission.
        </li>
        <li className="flex gap-2">
          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Anonymous totals, with no names or contact details, help us publish
          research on reference challenges.
        </li>
        <li className="flex gap-2">
          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Your contact details are only requested at the end, and only to send
          your plan.
        </li>
      </ul>
    </details>
  );
}

function IntroStep({
  saved,
  onResume,
  onStartOver,
  status,
  onStatus,
}: {
  saved: SavedProgress | null;
  onResume: () => void;
  onStartOver: () => void;
  status: string;
  onStatus: (s: string) => void;
}) {
  const cards = [
    {
      icon: FileSearch,
      title: "What gets reviewed",
      body: "Background-screening companies like HireRight confirm your dates, title and sometimes rehire eligibility directly with each employer's HR or payroll records.",
    },
    {
      icon: CalendarClock,
      title: "Where discrepancies appear",
      body: "Rounded dates, informal titles, staffing-agency placements, gaps and mismatched LinkedIn profiles are the most common sources of surprises.",
    },
    {
      icon: Scale,
      title: "Why alignment matters",
      body: "Small, explainable differences are common. Knowing where they are gives you time to prepare a truthful explanation before anyone asks.",
    },
  ];
  const savedQuestion = saved ? Math.min(6, Math.max(1, saved.step)) : 1;
  return (
    <section className="space-y-8">
      {saved && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="banner-resume">
          <p className="flex-1 text-sm text-foreground">
            <span className="font-medium">Welcome back.</span>{" "}
            {saved.step >= POSITIONS_STEP ? "You've answered all 6 questions." : `Pick up at question ${savedQuestion}?`} Your answers
            were saved on this device.
          </p>
          <Button onClick={onResume} data-testid="button-resume">
            Continue where I left off
          </Button>
        </div>
      )}

      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs font-medium text-primary uppercase tracking-wide mb-3">Free Reference Risk Assessment</p>
        <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground leading-tight">
          Find out what an employer is likely to verify, before they call
        </h1>
        <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
          Answer 6 multiple-choice questions and get a private plan showing what to prepare. About 5 minutes. No resume needed.
        </p>
        <p className="mt-4 text-sm text-foreground font-medium">
          Most people who take this have at least one thing to prepare for. That's exactly what it's for.
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground" data-testid="trust-row">
          {["Private", "Never shared with employers", "No credit card", "No obligation"].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" /> {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border p-4 sm:p-5" data-testid="status-picker">
        <p className="text-sm font-medium text-foreground">Where are you in your job search? <span className="font-normal text-muted-foreground">(optional)</span></p>
        <div className="mt-3 flex flex-wrap gap-2">
          {JOB_SEARCH_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onStatus(status === st ? "" : st)}
              aria-pressed={status === st}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                status === st ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary/50"
              )}
              data-testid={`status-${st.split(" ")[0].toLowerCase()}`}
            >
              {st}
            </button>
          ))}
        </div>
        {status === URGENT_STATUS && (
          <p className="mt-3 text-sm text-primary" data-testid="text-urgent-intro">
            Good timing. This takes about 5 minutes, and your results include a booking link for a priority call.
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <FounderNote />
        <Testimonial />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.title} className="rounded-lg border border-border p-4">
            <c.icon className="h-5 w-5 text-primary mb-3" />
            <p className="text-sm font-medium text-foreground">{c.title}</p>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>

      <PrivacyPanel />

      <p className="text-xs text-muted-foreground text-center">
        A screening tool, not a guarantee of how any employer will respond. It identifies potential risk; it does not judge your
        history.
      </p>
    </section>
  );
}

function AreaStep({
  areaIndex,
  answer,
  onChange,
}: {
  areaIndex: number;
  answer?: AreaAnswer;
  onChange: (patch: Partial<AreaAnswer>) => void;
}) {
  const area = RISK_AREAS[areaIndex];
  const ids = answer?.optionIds ?? [];
  const otherChosen = ids.includes(OTHER_ID);
  const priorityChosen = area.options.some((o) => ids.includes(o.id) && o.score >= 7);

  function toggle(id: string) {
    if (!area.multi) {
      onChange({ optionIds: [id] });
      return;
    }
    const opt = area.options.find((o) => o.id === id);
    if (ids.includes(id)) {
      onChange({ optionIds: ids.filter((x) => x !== id) });
    } else if (opt?.exclusive) {
      onChange({ optionIds: [id] });
    } else {
      const withoutExclusive = ids.filter((x) => !area.options.find((o) => o.id === x)?.exclusive);
      onChange({ optionIds: [...withoutExclusive, id] });
    }
  }

  return (
    <section className="space-y-6">
      <StepHeading
        eyebrow={`Risk area ${area.number} of 6 · ${area.title}`}
        title={area.question.replace(/ Select all that apply\.$/, "")}
        lead={area.multi ? "Select all that apply." : undefined}
      />

      {area.number === 1 && (
        <p className="text-sm text-foreground leading-relaxed" data-testid="text-no-wrong">
          There are no wrong answers. Pick what's true. You can change it before you see results.
        </p>
      )}

      <p className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed" data-testid={`reassurance-${area.key}`}>
        <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span>
          Most people we work with have at least one of these. Nothing you share here goes to an employer, and honest answers
          are the only way we can help you prepare.
        </span>
      </p>

      <div className="flex gap-3 rounded-md bg-muted/60 p-3.5">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">What a verifier checks: </span>
          {area.whatHrChecks}
        </p>
      </div>

      <div role={area.multi ? "group" : "radiogroup"} aria-label={area.question} className="space-y-2">
        {area.options.map((o) => {
          const selected = ids.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              role={area.multi ? "checkbox" : "radio"}
              aria-checked={selected}
              onClick={() => toggle(o.id)}
              className={cn(
                "w-full text-left rounded-lg border p-3.5 flex items-start gap-3 transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"
              )}
              data-testid={`option-${area.key}-${o.id}`}
            >
              {area.multi ? (
                <span
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded-[4px] border-2 flex items-center justify-center",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  )}
                >
                  {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              ) : (
                <span
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center",
                    selected ? "border-primary" : "border-input"
                  )}
                >
                  {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-sm text-foreground">{o.label}</span>
                {o.hint && <span className="block text-xs text-muted-foreground mt-0.5">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {priorityChosen && (
        <div className="flex items-start gap-2.5 rounded-md border border-primary/25 bg-primary/5 p-3.5" data-testid={`support-${area.key}`}>
          <HeartHandshake className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-foreground leading-relaxed">
            Thanks for being honest. This is one of the most common situations we help with, and it usually has a clear, truthful
            way to prepare.
          </p>
        </div>
      )}

      {otherChosen && (
        <div className="space-y-1.5 rounded-lg border border-border p-4">
          <Label htmlFor={`other-${area.key}`}>Tell us what applies</Label>
          <p className="text-xs text-muted-foreground">A few words is fine. Only your consultant sees this.</p>
          <Textarea
            id={`other-${area.key}`}
            value={answer?.other ?? ""}
            onChange={(e) => onChange({ other: e.target.value })}
            rows={2}
            maxLength={1000}
            autoFocus
            data-testid={`textarea-other-${area.key}`}
          />
        </div>
      )}
    </section>
  );
}
