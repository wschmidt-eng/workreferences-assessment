import { useParams, useLocation } from "wouter";
import { useAssessment, newId } from "@/hooks/use-assessment";
import { SessionShell } from "@/components/session-shell";
import { SIMULATED_QUESTIONS, evaluateResponse } from "@/lib/questionBank";
import { SimulationResponse } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Session5() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { loading, data, setData, save, saving } = useAssessment(id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function responseFor(questionId: string): SimulationResponse | undefined {
    return data.simulationResponses.find((r) => r.questionId === questionId);
  }

  function setDraft(questionId: string, text: string) {
    const q = SIMULATED_QUESTIONS.find((q) => q.id === questionId)!;
    setData((prev) => {
      const idx = prev.simulationResponses.findIndex((r) => r.questionId === questionId);
      const base: SimulationResponse = idx >= 0
        ? prev.simulationResponses[idx]
        : { id: newId(), questionId, questionText: q.text, category: q.category, clientResponse: "", score: 0, feedback: [], suggestion: "" };
      const updated = { ...base, clientResponse: text };
      const next = [...prev.simulationResponses];
      if (idx >= 0) next[idx] = updated;
      else next.push(updated);
      return { ...prev, simulationResponses: next };
    });
  }

  function runEvaluation(questionId: string) {
    const q = SIMULATED_QUESTIONS.find((q) => q.id === questionId)!;
    const existing = responseFor(questionId);
    const result = evaluateResponse(q, existing?.clientResponse || "");
    setData((prev) => {
      const idx = prev.simulationResponses.findIndex((r) => r.questionId === questionId);
      const base: SimulationResponse = idx >= 0
        ? prev.simulationResponses[idx]
        : { id: newId(), questionId, questionText: q.text, category: q.category, clientResponse: "", score: 0, feedback: [], suggestion: "" };
      const updated = { ...base, ...result };
      const next = [...prev.simulationResponses];
      if (idx >= 0) next[idx] = updated;
      else next.push(updated);
      return { ...prev, simulationResponses: next };
    });
  }

  const evaluatedCount = data.simulationResponses.filter((r) => r.feedback.length > 0).length;

  async function handleFinish() {
    if (evaluatedCount === 0) {
      toast({ title: "Score at least one response before generating the report.", variant: "destructive" });
      return;
    }
    const nextData = { ...data, session5Complete: true };
    setData(() => nextData);
    await save({ currentSession: 6, status: "ready_for_report", dataOverride: nextData });
    setLocation(`/assessment/${id}/report`);
  }

  return (
    <SessionShell
      sessionNumber={5}
      subtitle="Practice live. Type the client's answer to each simulated reference-check question, then score it for specific, actionable feedback."
      onContinue={handleFinish}
      continueLabel="Generate Reference Preparation Report"
      saving={saving}
      backHref={`/assessment/${id}/session/4`}
    >
      <div className="space-y-4">
        {SIMULATED_QUESTIONS.map((q, idx) => {
          const resp = responseFor(q.id);
          const scored = resp && resp.feedback.length > 0;
          return (
            <Card key={q.id}>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-primary font-medium uppercase tracking-wide">{q.category}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{q.text}</p>
                  </div>
                  {scored && (
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium rounded-full px-2 py-0.5 border",
                        resp!.score >= 8 ? "border-primary/30 text-primary bg-primary/10"
                          : resp!.score >= 5 ? "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                          : "border-destructive/30 text-destructive bg-destructive/10"
                      )}
                      data-testid={`score-${idx}`}
                    >
                      {resp!.score} / 10
                    </span>
                  )}
                </div>
                <Textarea
                  rows={3}
                  placeholder="Type the client's answer as if speaking to a recruiter..."
                  value={resp?.clientResponse || ""}
                  onChange={(e) => setDraft(q.id, e.target.value)}
                  data-testid={`textarea-response-${idx}`}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => runEvaluation(q.id)} data-testid={`button-score-${idx}`}>
                    Score this response
                  </Button>
                  {scored && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </div>
                {scored && (
                  <div className="rounded-md bg-secondary/60 p-3 text-xs space-y-1.5">
                    {resp!.feedback.map((f, i) => (
                      <p key={i} className="text-secondary-foreground">• {f}</p>
                    ))}
                    <p className="text-secondary-foreground font-medium pt-1">Suggestion: {resp!.suggestion}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </SessionShell>
  );
}
