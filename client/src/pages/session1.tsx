import { useParams, useLocation } from "wouter";
import { useAssessment } from "@/hooks/use-assessment";
import { SessionShell } from "@/components/session-shell";
import { PositionEditor, emptyPosition } from "@/components/position-editor";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

function YesNoUnsure({
  value,
  onChange,
  name,
}: {
  value: "yes" | "no" | "unsure" | null;
  onChange: (v: "yes" | "no" | "unsure") => void;
  name: string;
}) {
  return (
    <RadioGroup value={value ?? undefined} onValueChange={(v) => onChange(v as any)} className="flex gap-4 mt-2">
      {(["yes", "no", "unsure"] as const).map((opt) => (
        <div key={opt} className="flex items-center gap-1.5">
          <RadioGroupItem value={opt} id={`${name}-${opt}`} />
          <Label htmlFor={`${name}-${opt}`} className="capitalize cursor-pointer font-normal">{opt}</Label>
        </div>
      ))}
    </RadioGroup>
  );
}

export default function Session1() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { loading, data, setData, save, saving } = useAssessment(id);

  useEffect(() => {
    if (!loading && data.positions.length === 0) {
      setData((prev) => ({ ...prev, positions: [emptyPosition()] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function validate(): boolean {
    if (!data.targetJobTitle.trim()) {
      toast({ title: "Please enter the target job title.", variant: "destructive" });
      return false;
    }
    if (data.positions.length === 0 || !data.positions.some((p) => p.employer.trim())) {
      toast({ title: "Add at least one position with an employer name.", variant: "destructive" });
      return false;
    }
    return true;
  }

  async function handleContinue() {
    if (!validate()) return;
    const nextData = { ...data, session1Complete: true };
    setData(() => nextData);
    await save({ currentSession: 2, dataOverride: nextData });
    setLocation(`/assessment/${id}/session/2`);
  }

  return (
    <SessionShell
      sessionNumber={1}
      subtitle="Let's map the client's employment history and flag anything that could raise a recruiter's eyebrow. Nothing here is invented or altered — we work only with what actually happened."
      onContinue={handleContinue}
      saving={saving}
      backHref="/coaching"
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Target job title</Label>
                <Input
                  className="mt-1.5"
                  value={data.targetJobTitle}
                  onChange={(e) => setData((p) => ({ ...p, targetJobTitle: e.target.value }))}
                  data-testid="input-target-job-title"
                />
              </div>
              <div>
                <Label>Target industry (optional)</Label>
                <Input
                  className="mt-1.5"
                  value={data.targetIndustry}
                  onChange={(e) => setData((p) => ({ ...p, targetIndustry: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Seniority level (optional)</Label>
              <Select value={data.seniorityLevel || undefined} onValueChange={(v) => setData((p) => ({ ...p, seniorityLevel: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry-level</SelectItem>
                  <SelectItem value="mid">Mid-level</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div>
          <p className="text-sm font-medium text-foreground mb-3">Employment history</p>
          <PositionEditor
            positions={data.positions}
            onChange={(positions) => setData((p) => ({ ...p, positions }))}
          />
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            <div>
              <Label>How many professional references does the client currently have lined up?</Label>
              <Input
                type="number"
                min={0}
                className="mt-1.5 max-w-[120px]"
                value={data.referencesAvailableCount ?? ""}
                onChange={(e) => setData((p) => ({ ...p, referencesAvailableCount: e.target.value === "" ? null : Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Does their LinkedIn profile match their resume?</Label>
              <YesNoUnsure
                name="linkedin-consistent"
                value={data.linkedinConsistent}
                onChange={(v) => setData((p) => ({ ...p, linkedinConsistent: v }))}
              />
            </div>
            <div>
              <Label>Are there any employment gaps?</Label>
              <YesNoUnsure
                name="has-gaps"
                value={data.hasEmploymentGaps === null ? null : data.hasEmploymentGaps ? "yes" : "no"}
                onChange={(v) => setData((p) => ({ ...p, hasEmploymentGaps: v === "yes" }))}
              />
            </div>
            <div>
              <Label>Any contract, temp, or staffing-agency work in their history?</Label>
              <YesNoUnsure
                name="has-contract"
                value={data.hasContractWork === null ? null : data.hasContractWork ? "yes" : "no"}
                onChange={(v) => setData((p) => ({ ...p, hasContractWork: v === "yes" }))}
              />
            </div>
            <div>
              <Label>Has the client ever had a reference check go badly?</Label>
              <YesNoUnsure
                name="past-problem"
                value={data.hasPastReferenceProblem === null ? null : data.hasPastReferenceProblem ? "yes" : "no"}
                onChange={(v) => setData((p) => ({ ...p, hasPastReferenceProblem: v === "yes" }))}
              />
              {data.hasPastReferenceProblem && (
                <Textarea
                  className="mt-2"
                  rows={2}
                  placeholder="What happened?"
                  value={data.pastProblemDetail}
                  onChange={(e) => setData((p) => ({ ...p, pastProblemDetail: e.target.value }))}
                />
              )}
            </div>
            <div>
              <Label>Any other background-check concerns worth flagging? (optional)</Label>
              <Textarea
                className="mt-1.5"
                rows={2}
                value={data.backgroundCheckConcerns}
                onChange={(e) => setData((p) => ({ ...p, backgroundCheckConcerns: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </SessionShell>
  );
}
