import { ReactNode } from "react";
import { Link } from "wouter";
import { Wordmark } from "./logo";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SESSION_TITLES = [
  "Reference Risk Assessment",
  "Reference Selection & Strategy",
  "Reference Question Preparation",
  "Verification & Consistency Audit",
  "Reference Check Simulation",
];

export function ProgressStepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2" aria-label="Session progress">
      {SESSION_TITLES.map((title, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "active" : "upcoming";
        return (
          <div key={n} className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium border",
                state === "done" && "bg-primary text-primary-foreground border-primary",
                state === "active" && "border-primary text-primary bg-primary/10",
                state === "upcoming" && "border-border text-muted-foreground"
              )}
              title={title}
              data-testid={`stepper-session-${n}`}
            >
              {n}
            </div>
            {n < SESSION_TITLES.length && (
              <div
                className={cn(
                  "h-px flex-1",
                  n < current ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SessionShell({
  sessionNumber,
  subtitle,
  children,
  onBack,
  onContinue,
  continueLabel = "Save & Continue",
  continueDisabled = false,
  saving = false,
  backHref,
}: {
  sessionNumber: number;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  saving?: boolean;
  backHref?: string;
}) {
  const title = SESSION_TITLES[sessionNumber - 1];
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/coaching">
            <a>
              <Wordmark />
            </a>
          </Link>
          <span className="text-xs text-muted-foreground hidden sm:block">
            References That Work!
          </span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-6">
        <ProgressStepper current={sessionNumber} />
        <div className="mt-6 mb-1">
          <p className="text-xs font-medium text-primary uppercase tracking-wide">
            Session {sessionNumber} of 5
          </p>
          <h1 className="text-xl font-display font-semibold text-foreground mt-1">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
        </div>
      </div>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6">{children}</div>
      </main>

      <footer className="border-t border-border sticky bottom-0 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {onBack || backHref ? (
            backHref ? (
              <Link href={backHref}>
                <Button variant="outline" className="w-full sm:w-auto" data-testid="button-back">
                  <ChevronLeft className="h-4 w-4 shrink-0" /> Back
                </Button>
              </Link>
            ) : (
              <Button variant="outline" onClick={onBack} className="w-full sm:w-auto" data-testid="button-back">
                <ChevronLeft className="h-4 w-4 shrink-0" /> Back
              </Button>
            )
          ) : (
            <span className="hidden sm:inline" />
          )}
          {onContinue && (
            <Button
              onClick={onContinue}
              disabled={continueDisabled || saving}
              className="w-full sm:w-auto h-auto min-h-10 whitespace-normal text-center leading-snug py-2.5"
              data-testid="button-continue"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : null}
              {continueLabel}
              {!saving && <ChevronRight className="h-4 w-4 shrink-0" />}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
