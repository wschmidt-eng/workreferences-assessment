import { useParams, useLocation } from "wouter";
import { useAssessment, newId } from "@/hooks/use-assessment";
import { SessionShell } from "@/components/session-shell";
import { detectDiscrepancies } from "@/lib/consistency";
import { LinkedInEntry, Discrepancy, RiskLevel } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/risk-badge";
import { Loader2, Plus, Trash2, ScanSearch } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function emptyLinkedInEntry(): LinkedInEntry {
  return { id: newId(), employer: "", jobTitle: "", startDate: "", endDate: "" };
}

function emptyDiscrepancy(): Discrepancy {
  return {
    id: newId(),
    field: "",
    resumeValue: "",
    linkedinValue: "",
    riskLevel: "Low",
    recommendation: "",
    source: "manual",
  };
}

export default function Session4() {
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

  function runAutoDetect() {
    const autoFound = detectDiscrepancies(data.positions, data.linkedinEntries);
    setData((prev) => ({
      ...prev,
      discrepancies: [...prev.discrepancies.filter((d) => d.source === "manual"), ...autoFound],
    }));
    toast({ title: `Found ${autoFound.length} potential discrepancy(ies).` });
  }

  function updateLinkedIn(entryId: string, patch: Partial<LinkedInEntry>) {
    setData((prev) => ({
      ...prev,
      linkedinEntries: prev.linkedinEntries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
    }));
  }
  function removeLinkedIn(entryId: string) {
    setData((prev) => ({ ...prev, linkedinEntries: prev.linkedinEntries.filter((e) => e.id !== entryId) }));
  }
  function addLinkedIn() {
    setData((prev) => ({ ...prev, linkedinEntries: [...prev.linkedinEntries, emptyLinkedInEntry()] }));
  }

  function updateDiscrepancy(dId: string, patch: Partial<Discrepancy>) {
    setData((prev) => ({
      ...prev,
      discrepancies: prev.discrepancies.map((d) => (d.id === dId ? { ...d, ...patch } : d)),
    }));
  }
  function removeDiscrepancy(dId: string) {
    setData((prev) => ({ ...prev, discrepancies: prev.discrepancies.filter((d) => d.id !== dId) }));
  }
  function addDiscrepancy() {
    setData((prev) => ({ ...prev, discrepancies: [...prev.discrepancies, emptyDiscrepancy()] }));
  }

  async function handleContinue() {
    const nextData = { ...data, session4Complete: true };
    setData(() => nextData);
    await save({ currentSession: 5, dataOverride: nextData });
    setLocation(`/assessment/${id}/session/5`);
  }

  return (
    <SessionShell
      sessionNumber={4}
      subtitle="Enter what the client's LinkedIn profile currently shows for each role, then run the consistency check to flag anything that doesn't line up with the resume."
      onContinue={handleContinue}
      saving={saving}
      backHref={`/assessment/${id}/session/3`}
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm font-medium text-foreground">LinkedIn entries</p>
            {data.linkedinEntries.map((entry, idx) => (
              <div key={entry.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end border-b border-border pb-4 last:border-0 last:pb-0">
                <div>
                  <Label className="text-xs">Employer</Label>
                  <Input className="mt-1" value={entry.employer} onChange={(e) => updateLinkedIn(entry.id, { employer: e.target.value })} data-testid={`input-li-employer-${idx}`} />
                </div>
                <div>
                  <Label className="text-xs">Job title</Label>
                  <Input className="mt-1" value={entry.jobTitle} onChange={(e) => updateLinkedIn(entry.id, { jobTitle: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Start</Label>
                  <Input type="date" className="mt-1" value={entry.startDate} onChange={(e) => updateLinkedIn(entry.id, { startDate: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">End</Label>
                  <Input type="date" className="mt-1" value={entry.endDate} onChange={(e) => updateLinkedIn(entry.id, { endDate: e.target.value })} />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeLinkedIn(entry.id)} aria-label="Remove entry">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={addLinkedIn} data-testid="button-add-linkedin-entry">
                <Plus className="h-4 w-4" /> Add LinkedIn entry
              </Button>
              <Button onClick={runAutoDetect} data-testid="button-run-audit">
                <ScanSearch className="h-4 w-4" /> Run consistency check
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Flagged discrepancies</p>
              <Button variant="outline" size="sm" onClick={addDiscrepancy} data-testid="button-add-discrepancy">
                <Plus className="h-4 w-4" /> Add manually
              </Button>
            </div>
            {data.discrepancies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No discrepancies flagged. Run the consistency check above once LinkedIn entries are filled in.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field</TableHead>
                      <TableHead>Resume</TableHead>
                      <TableHead>LinkedIn</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Recommendation</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.discrepancies.map((d, idx) => (
                      <TableRow key={d.id}>
                        <TableCell className="min-w-[140px]">
                          <Input value={d.field} onChange={(e) => updateDiscrepancy(d.id, { field: e.target.value })} className="h-8 text-xs" data-testid={`input-discrepancy-field-${idx}`} />
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <Input value={d.resumeValue} onChange={(e) => updateDiscrepancy(d.id, { resumeValue: e.target.value })} className="h-8 text-xs" />
                        </TableCell>
                        <TableCell className="min-w-[140px]">
                          <Input value={d.linkedinValue} onChange={(e) => updateDiscrepancy(d.id, { linkedinValue: e.target.value })} className="h-8 text-xs" />
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <Select value={d.riskLevel} onValueChange={(v) => updateDiscrepancy(d.id, { riskLevel: v as RiskLevel })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Low">Low</SelectItem>
                              <SelectItem value="Moderate">Moderate</SelectItem>
                              <SelectItem value="High">High</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-[240px]">
                          <Textarea value={d.recommendation} onChange={(e) => updateDiscrepancy(d.id, { recommendation: e.target.value })} className="text-xs min-h-[32px]" rows={1} />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeDiscrepancy(d.id)} aria-label="Remove">
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SessionShell>
  );
}
