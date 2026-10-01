import { Position } from "@/lib/types";
import { newId } from "@/hooks/use-assessment";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Trash2, Plus } from "lucide-react";

export function emptyPosition(): Position {
  return {
    id: newId(),
    employer: "",
    jobTitle: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    employmentType: "full_time",
    arrangement: "direct_employer",
    staffingAgencyName: "",
    supervisor: "",
    supervisorReachable: "unknown",
    department: "",
    responsibilities: "",
    accomplishments: "",
    reasonForLeaving: "resigned",
    reasonDetail: "",
    rehireEligible: "unknown",
    companyStatus: "active",
    likelyToBeVerified: true,
    concernNotes: "",
    hasGapBefore: false,
    gapExplanation: "",
  };
}

export function PositionEditor({
  positions,
  onChange,
}: {
  positions: Position[];
  onChange: (positions: Position[]) => void;
}) {
  function update(id: string, patch: Partial<Position>) {
    onChange(positions.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function remove(id: string) {
    onChange(positions.filter((p) => p.id !== id));
  }
  function add() {
    onChange([...positions, emptyPosition()]);
  }

  return (
    <div className="space-y-3">
      <Accordion type="multiple" defaultValue={positions.map((p) => p.id)} className="space-y-3">
        {positions.map((p, idx) => (
          <AccordionItem key={p.id} value={p.id} className="border border-border rounded-md px-0">
            <div className="flex items-center">
              <AccordionTrigger className="px-4 py-3 hover:no-underline flex-1" data-testid={`accordion-position-${idx}`}>
                <span className="text-sm font-medium">
                  {p.employer || p.jobTitle ? `${p.jobTitle || "Untitled role"} — ${p.employer || "Employer TBD"}` : `Position ${idx + 1}`}
                </span>
              </AccordionTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="mr-3"
                onClick={() => remove(p.id)}
                data-testid={`button-remove-position-${idx}`}
                aria-label="Remove position"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Employer name</Label>
                  <Input
                    className="mt-1.5"
                    value={p.employer}
                    onChange={(e) => update(p.id, { employer: e.target.value })}
                    data-testid={`input-employer-${idx}`}
                  />
                </div>
                <div>
                  <Label>Job title</Label>
                  <Input
                    className="mt-1.5"
                    value={p.jobTitle}
                    onChange={(e) => update(p.id, { jobTitle: e.target.value })}
                    data-testid={`input-job-title-${idx}`}
                  />
                </div>
                <div>
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    className="mt-1.5"
                    value={p.startDate}
                    onChange={(e) => update(p.id, { startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input
                    type="date"
                    className="mt-1.5"
                    value={p.endDate}
                    disabled={p.isCurrent}
                    onChange={(e) => update(p.id, { endDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Switch
                  checked={p.isCurrent}
                  onCheckedChange={(v) => update(p.id, { isCurrent: v, endDate: v ? "" : p.endDate })}
                  id={`current-${p.id}`}
                />
                <Label htmlFor={`current-${p.id}`} className="cursor-pointer">This is their current role</Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <Label>Employment type</Label>
                  <Select value={p.employmentType} onValueChange={(v) => update(p.id, { employmentType: v as Position["employmentType"] })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full-time</SelectItem>
                      <SelectItem value="part_time">Part-time</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="consulting">Consulting</SelectItem>
                      <SelectItem value="staffing">Staffing agency placement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Arrangement</Label>
                  <Select value={p.arrangement} onValueChange={(v) => update(p.id, { arrangement: v as Position["arrangement"] })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct_employer">Direct employer</SelectItem>
                      <SelectItem value="staffing_client_assignment">Staffing agency / client assignment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {p.arrangement === "staffing_client_assignment" && (
                <div className="mt-3">
                  <Label>Staffing agency of record</Label>
                  <Input
                    className="mt-1.5"
                    value={p.staffingAgencyName}
                    onChange={(e) => update(p.id, { staffingAgencyName: e.target.value })}
                    placeholder="Agency name"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <Label>Direct supervisor name</Label>
                  <Input
                    className="mt-1.5"
                    value={p.supervisor}
                    onChange={(e) => update(p.id, { supervisor: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Is the supervisor reachable?</Label>
                  <Select value={p.supervisorReachable} onValueChange={(v) => update(p.id, { supervisorReachable: v as Position["supervisorReachable"] })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="left_company">Left the company</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3">
                <Label>Department</Label>
                <Input
                  className="mt-1.5"
                  value={p.department}
                  onChange={(e) => update(p.id, { department: e.target.value })}
                />
              </div>

              <div className="mt-3">
                <Label>Main responsibilities</Label>
                <Textarea
                  className="mt-1.5"
                  rows={2}
                  value={p.responsibilities}
                  onChange={(e) => update(p.id, { responsibilities: e.target.value })}
                />
              </div>

              <div className="mt-3">
                <Label>Key accomplishments</Label>
                <Textarea
                  className="mt-1.5"
                  rows={2}
                  value={p.accomplishments}
                  onChange={(e) => update(p.id, { accomplishments: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <Label>Reason for leaving</Label>
                  <Select value={p.reasonForLeaving} onValueChange={(v) => update(p.id, { reasonForLeaving: v as Position["reasonForLeaving"] })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="still_employed">Still employed</SelectItem>
                      <SelectItem value="resigned">Resigned</SelectItem>
                      <SelectItem value="laid_off_restructuring">Laid off / restructuring</SelectItem>
                      <SelectItem value="contract_ended">Contract ended</SelectItem>
                      <SelectItem value="mutual_separation">Mutual separation</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rehire eligible?</Label>
                  <Select value={p.rehireEligible} onValueChange={(v) => update(p.id, { rehireEligible: v as Position["rehireEligible"] })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                      <SelectItem value="not_applicable">Not applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3">
                <Label>Additional detail on departure (optional)</Label>
                <Textarea
                  className="mt-1.5"
                  rows={2}
                  value={p.reasonDetail}
                  onChange={(e) => update(p.id, { reasonDetail: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <Label>Company status today</Label>
                  <Select value={p.companyStatus} onValueChange={(v) => update(p.id, { companyStatus: v as Position["companyStatus"] })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="acquired">Acquired</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={p.likelyToBeVerified}
                    onCheckedChange={(v) => update(p.id, { likelyToBeVerified: v })}
                    id={`verify-${p.id}`}
                  />
                  <Label htmlFor={`verify-${p.id}`} className="cursor-pointer">Likely to be verified by employers</Label>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Switch
                  checked={p.hasGapBefore}
                  onCheckedChange={(v) => update(p.id, { hasGapBefore: v })}
                  id={`gap-${p.id}`}
                />
                <Label htmlFor={`gap-${p.id}`} className="cursor-pointer">There's an employment gap before this role</Label>
              </div>
              {p.hasGapBefore && (
                <div className="mt-3">
                  <Label>Gap explanation</Label>
                  <Textarea
                    className="mt-1.5"
                    rows={2}
                    value={p.gapExplanation}
                    onChange={(e) => update(p.id, { gapExplanation: e.target.value })}
                  />
                </div>
              )}

              <div className="mt-3">
                <Label>Anything about this role that concerns you (optional)</Label>
                <Textarea
                  className="mt-1.5"
                  rows={2}
                  value={p.concernNotes}
                  onChange={(e) => update(p.id, { concernNotes: e.target.value })}
                  placeholder="Be candid — this stays with your WorkReferences strategist."
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Button variant="outline" onClick={add} className="w-full" data-testid="button-add-position">
        <Plus className="h-4 w-4" /> Add position
      </Button>
    </div>
  );
}
