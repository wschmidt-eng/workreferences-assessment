import { Position, LinkedInEntry, Discrepancy, RiskLevel } from "./types";
import { newId } from "@/hooks/use-assessment";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Auto-detects likely discrepancies between resume positions and LinkedIn entries. */
export function detectDiscrepancies(
  positions: Position[],
  linkedinEntries: LinkedInEntry[]
): Discrepancy[] {
  const found: Discrepancy[] = [];

  for (const p of positions) {
    if (!p.employer.trim()) continue;
    const match = linkedinEntries.find((l) => fuzzyMatch(l.employer, p.employer));

    if (!match) {
      found.push({
        id: newId(),
        field: `${p.employer} — not found on LinkedIn`,
        resumeValue: `${p.jobTitle} at ${p.employer}`,
        linkedinValue: "(no matching entry)",
        riskLevel: "Moderate" as RiskLevel,
        recommendation: "Add this employer to LinkedIn, or be prepared to explain the omission if asked.",
        source: "auto",
      });
      continue;
    }

    if (p.jobTitle.trim() && match.jobTitle.trim() && !fuzzyMatch(p.jobTitle, match.jobTitle)) {
      found.push({
        id: newId(),
        field: `Job title at ${p.employer}`,
        resumeValue: p.jobTitle,
        linkedinValue: match.jobTitle,
        riskLevel: "High" as RiskLevel,
        recommendation: "Align the job title on both profiles to the title that appears on official employment records.",
        source: "auto",
      });
    }

    const resumeStart = p.startDate?.slice(0, 7);
    const linkedinStart = match.startDate?.slice(0, 7);
    if (resumeStart && linkedinStart && resumeStart !== linkedinStart) {
      found.push({
        id: newId(),
        field: `Start date at ${p.employer}`,
        resumeValue: p.startDate,
        linkedinValue: match.startDate,
        riskLevel: "Moderate" as RiskLevel,
        recommendation: "Update whichever date is inaccurate so both sources agree.",
        source: "auto",
      });
    }

    const resumeEnd = p.isCurrent ? "" : p.endDate?.slice(0, 7);
    const linkedinEnd = match.endDate?.slice(0, 7);
    if (resumeEnd && linkedinEnd && resumeEnd !== linkedinEnd) {
      found.push({
        id: newId(),
        field: `End date at ${p.employer}`,
        resumeValue: p.endDate,
        linkedinValue: match.endDate,
        riskLevel: "Moderate" as RiskLevel,
        recommendation: "Update whichever date is inaccurate so both sources agree.",
        source: "auto",
      });
    }
  }

  return found;
}
