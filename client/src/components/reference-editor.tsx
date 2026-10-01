import { ReferenceContact, Position } from "@/lib/types";
import { newId } from "@/hooks/use-assessment";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Trash2, Plus } from "lucide-react";

export function emptyReference(): ReferenceContact {
  return {
    id: newId(),
    name: "",
    relationship: "",
    linkedPositionId: "",
    seniority: 3,
    lengthOfRelationshipMonths: 12,
    recencyYearsAgo: 1,
    knowledgeOfWork: 3,
    communicationAbility: 3,
    credibility: 3,
    likelihoodToRespond: 3,
    relevanceToTarget: 3,
    notes: "",
  };
}

function RatingSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{value} / 5</span>
      </div>
      <Slider
        className="mt-2"
        min={1}
        max={5}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

export function ReferenceEditor({
  references,
  positions,
  onChange,
}: {
  references: ReferenceContact[];
  positions: Position[];
  onChange: (refs: ReferenceContact[]) => void;
}) {
  function update(id: string, patch: Partial<ReferenceContact>) {
    onChange(references.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) {
    onChange(references.filter((r) => r.id !== id));
  }
  function add() {
    onChange([...references, emptyReference()]);
  }

  return (
    <div className="space-y-3">
      <Accordion type="multiple" defaultValue={references.map((r) => r.id)} className="space-y-3">
        {references.map((r, idx) => (
          <AccordionItem key={r.id} value={r.id} className="border border-border rounded-md">
            <div className="flex items-center">
              <AccordionTrigger className="px-4 py-3 hover:no-underline flex-1" data-testid={`accordion-reference-${idx}`}>
                <span className="text-sm font-medium">{r.name || `Reference ${idx + 1}`}</span>
              </AccordionTrigger>
              <Button variant="ghost" size="icon" className="mr-3" onClick={() => remove(r.id)} aria-label="Remove reference" data-testid={`button-remove-reference-${idx}`}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <AccordionContent className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Reference name</Label>
                  <Input className="mt-1.5" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} data-testid={`input-reference-name-${idx}`} />
                </div>
                <div>
                  <Label>Relationship (e.g. Former Manager)</Label>
                  <Input className="mt-1.5" value={r.relationship} onChange={(e) => update(r.id, { relationship: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Linked to which position?</Label>
                <Select value={r.linkedPositionId || undefined} onValueChange={(v) => update(r.id, { linkedPositionId: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select position" /></SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.jobTitle || "Untitled role"} — {p.employer || "Employer TBD"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Months known</Label>
                  <Input type="number" min={0} className="mt-1.5" value={r.lengthOfRelationshipMonths} onChange={(e) => update(r.id, { lengthOfRelationshipMonths: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Years since last contact</Label>
                  <Input type="number" min={0} className="mt-1.5" value={r.recencyYearsAgo} onChange={(e) => update(r.id, { recencyYearsAgo: Number(e.target.value) })} />
                </div>
              </div>

              <RatingSlider label="Knowledge of the client's work" value={r.knowledgeOfWork} onChange={(v) => update(r.id, { knowledgeOfWork: v })} />
              <RatingSlider label="Communication ability" value={r.communicationAbility} onChange={(v) => update(r.id, { communicationAbility: v })} />
              <RatingSlider label="Credibility / seniority" value={r.credibility} onChange={(v) => update(r.id, { credibility: v })} />
              <RatingSlider label="Likelihood to respond promptly" value={r.likelihoodToRespond} onChange={(v) => update(r.id, { likelihoodToRespond: v })} />
              <RatingSlider label="Relevance to target role" value={r.relevanceToTarget} onChange={(v) => update(r.id, { relevanceToTarget: v })} />

              <div>
                <Label>Notes (optional)</Label>
                <Textarea className="mt-1.5" rows={2} value={r.notes} onChange={(e) => update(r.id, { notes: e.target.value })} />
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <Button variant="outline" onClick={add} className="w-full" data-testid="button-add-reference">
        <Plus className="h-4 w-4" /> Add reference
      </Button>
    </div>
  );
}
