import { useParams, useLocation } from "wouter";
import { useAssessment } from "@/hooks/use-assessment";
import { SessionShell } from "@/components/session-shell";
import { QUESTION_CATEGORIES, QuestionPrepEntry } from "@/lib/types";
import { coachingPromptFor } from "@/lib/questionBank";
import { newId } from "@/hooks/use-assessment";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Session3() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { loading, data, setData, save, saving } = useAssessment(id);
  const [activePositionId, setActivePositionId] = useState<string>("");

  useEffect(() => {
    if (!loading && data.positions.length > 0 && !activePositionId) {
      setActivePositionId(data.positions[0].id);
    }
  }, [loading, data.positions, activePositionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function entryFor(positionId: string, category: string): QuestionPrepEntry {
    return (
      data.questionPrep.find((q) => q.positionId === positionId && q.category === category) || {
        id: newId(),
        positionId,
        category: category as any,
        clientInput: "",
        coachedAnswer: "",
      }
    );
  }

  function updateEntry(positionId: string, category: string, patch: Partial<QuestionPrepEntry>) {
    setData((prev) => {
      const existingIdx = prev.questionPrep.findIndex(
        (q) => q.positionId === positionId && q.category === category
      );
      const base = existingIdx >= 0 ? prev.questionPrep[existingIdx] : entryFor(positionId, category);
      const updated = { ...base, ...patch };
      const next = [...prev.questionPrep];
      if (existingIdx >= 0) next[existingIdx] = updated;
      else next.push(updated);
      return { ...prev, questionPrep: next };
    });
  }

  const filledCount = data.questionPrep.filter((q) => q.clientInput.trim() || q.coachedAnswer.trim()).length;

  async function handleContinue() {
    if (filledCount === 0) {
      toast({ title: "Prepare at least one talking point before continuing.", variant: "destructive" });
      return;
    }
    const nextData = { ...data, session3Complete: true };
    setData(() => nextData);
    await save({ currentSession: 4, dataOverride: nextData });
    setLocation(`/assessment/${id}/session/4`);
  }

  if (data.positions.length === 0) {
    return (
      <SessionShell sessionNumber={3} backHref={`/assessment/${id}/session/1`}>
        <p className="text-sm text-muted-foreground">Add a position in Session 1 before preparing talking points.</p>
      </SessionShell>
    );
  }

  return (
    <SessionShell
      sessionNumber={3}
      subtitle="Prepare clear, confident talking points for the questions a reference or recruiter is likely to ask about each role."
      onContinue={handleContinue}
      saving={saving}
      backHref={`/assessment/${id}/session/2`}
    >
      <Tabs value={activePositionId} onValueChange={setActivePositionId}>
        <TabsList className="flex-wrap h-auto">
          {data.positions.map((p) => (
            <TabsTrigger key={p.id} value={p.id} data-testid={`tab-position-${p.id}`}>
              {p.jobTitle || p.employer || "Untitled role"}
            </TabsTrigger>
          ))}
        </TabsList>
        {data.positions.map((p) => (
          <TabsContent key={p.id} value={p.id} className="space-y-3 mt-4">
            {QUESTION_CATEGORIES.map((category) => {
              const entry = entryFor(p.id, category);
              return (
                <Card key={category}>
                  <CardContent className="pt-5 space-y-3">
                    <p className="text-sm font-medium text-foreground">{category}</p>
                    <div className="flex items-start gap-2 rounded-md bg-secondary/60 p-2.5 text-xs text-secondary-foreground">
                      <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{coachingPromptFor(category)}</span>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Client's draft answer</Label>
                      <Textarea
                        className="mt-1.5"
                        rows={2}
                        value={entry.clientInput}
                        onChange={(e) => updateEntry(p.id, category, { clientInput: e.target.value })}
                        data-testid={`textarea-client-${category}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Coached / final answer</Label>
                      <Textarea
                        className="mt-1.5"
                        rows={2}
                        value={entry.coachedAnswer}
                        onChange={(e) => updateEntry(p.id, category, { coachedAnswer: e.target.value })}
                        data-testid={`textarea-coached-${category}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </SessionShell>
  );
}
