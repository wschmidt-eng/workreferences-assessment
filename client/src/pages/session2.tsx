import { useParams, useLocation } from "wouter";
import { useAssessment } from "@/hooks/use-assessment";
import { SessionShell } from "@/components/session-shell";
import { ReferenceEditor, emptyReference } from "@/components/reference-editor";
import { Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Session2() {
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

  const uncoveredPositions = data.positions.filter(
    (p) => p.likelyToBeVerified && !data.references.some((r) => r.linkedPositionId === p.id)
  );

  async function handleContinue() {
    if (data.references.length === 0) {
      toast({ title: "Add at least one reference before continuing.", variant: "destructive" });
      return;
    }
    const nextData = { ...data, session2Complete: true };
    setData(() => nextData);
    await save({ currentSession: 3, dataOverride: nextData });
    setLocation(`/assessment/${id}/session/3`);
  }

  return (
    <SessionShell
      sessionNumber={2}
      subtitle="Now let's choose the strongest references and make sure every position likely to be verified is covered."
      onContinue={handleContinue}
      saving={saving}
      backHref={`/assessment/${id}/session/1`}
    >
      <div className="space-y-4">
        {data.references.length === 0 && (
          <button
            className="w-full text-left rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground hover:border-primary/40"
            onClick={() => setData((p) => ({ ...p, references: [emptyReference()] }))}
            data-testid="button-start-first-reference"
          >
            Add the first reference to get started.
          </button>
        )}

        {data.references.length > 0 && (
          <ReferenceEditor
            references={data.references}
            positions={data.positions}
            onChange={(references) => setData((p) => ({ ...p, references }))}
          />
        )}

        {uncoveredPositions.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-3.5 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-foreground">
              <span className="font-medium">{uncoveredPositions.length} position(s)</span> flagged as
              likely to be verified have no linked reference yet:{" "}
              {uncoveredPositions.map((p) => p.employer || p.jobTitle || "Untitled").join(", ")}.
            </p>
          </div>
        )}
      </div>
    </SessionShell>
  );
}
