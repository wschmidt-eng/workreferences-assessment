import {
  AssessmentData,
  ReportPayload,
  ReportPosition,
  ReportReferenceRow,
  RiskLevel,
} from "./types";
import { computeScores } from "./scoring";

const REASON_LABEL: Record<string, string> = {
  still_employed: "Still employed",
  resigned: "Resigned",
  laid_off_restructuring: "Laid off / restructuring",
  contract_ended: "Contract ended",
  mutual_separation: "Mutual separation",
  terminated: "Terminated",
  other: "Other",
};

function positionRisk(p: AssessmentData["positions"][number]): { level: RiskLevel; factors: string[]; mitigation: string[] } {
  const factors: string[] = [];
  const mitigation: string[] = [];
  let weight = 0;

  if (p.reasonForLeaving === "terminated") {
    weight += 3;
    factors.push("Employment ended in termination.");
    mitigation.push("Prepare a brief, factual, non-defensive explanation of the circumstances.");
  } else if (p.reasonForLeaving === "laid_off_restructuring" || p.reasonForLeaving === "mutual_separation" || p.reasonForLeaving === "other") {
    weight += 1.5;
    factors.push(`Departure reason: ${REASON_LABEL[p.reasonForLeaving]}.`);
    mitigation.push("Have a short, consistent explanation ready that matches what the employer will confirm.");
  }

  if (p.hasGapBefore) {
    weight += 1.5;
    factors.push("Employment gap precedes this role.");
    mitigation.push(p.gapExplanation ? `Explain the gap: ${p.gapExplanation}` : "Prepare a candid, brief explanation for the gap.");
  }

  if (p.arrangement === "staffing_client_assignment" && !p.staffingAgencyName.trim()) {
    weight += 1.5;
    factors.push("Staffing/contract arrangement without a documented agency of record.");
    mitigation.push("Identify the staffing agency that can confirm this assignment.");
  }

  if (p.companyStatus === "closed" || p.companyStatus === "acquired") {
    weight += 1;
    factors.push(`Employer is ${p.companyStatus === "closed" ? "no longer operating" : "acquired by another company"}.`);
    mitigation.push("Locate an alternate verifier — a former manager or colleague who can confirm employment.");
  }

  if (p.supervisorReachable === "no" || p.supervisorReachable === "left_company") {
    weight += 1;
    factors.push("Direct supervisor may not be reachable for verification.");
    mitigation.push("Identify a secondary contact at the company (HR, colleague) who can verify employment.");
  }

  if (p.concernNotes.trim()) {
    weight += 1;
    factors.push(`Self-flagged concern: ${p.concernNotes}`);
    mitigation.push("Discuss this concern directly with a WorkReferences strategist before scheduling checks.");
  }

  const tenure = p.isCurrent ? null : (() => {
    if (!p.startDate || !p.endDate) return null;
    const s = new Date(p.startDate);
    const e = new Date(p.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  })();
  if (tenure !== null && tenure >= 0 && tenure < 6) {
    weight += 1.5;
    factors.push("Short tenure (under 6 months).");
    mitigation.push("Be ready to explain the short tenure briefly and positively.");
  }

  if (factors.length === 0) {
    factors.push("No significant risk factors identified for this role.");
    mitigation.push("No specific action needed — maintain consistency across resume, LinkedIn, and references.");
  }

  const level: RiskLevel = weight >= 4 ? "High" : weight >= 1.5 ? "Moderate" : "Low";
  return { level, factors, mitigation };
}

function formatDate(d: string): string {
  if (!d) return "Present";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function buildReportPayload(clientName: string, data: AssessmentData): ReportPayload {
  const scores = computeScores(data);

  const positions: ReportPosition[] = data.positions.map((p) => {
    const risk = positionRisk(p);
    return {
      employer: p.employer || "Unnamed employer",
      jobTitle: p.jobTitle || "Unnamed role",
      dates: `${formatDate(p.startDate)} – ${p.isCurrent ? "Present" : formatDate(p.endDate)}`,
      riskLevel: risk.level,
      riskFactors: risk.factors,
      mitigation: risk.mitigation,
    };
  });

  const sortedRefs = [...data.references].sort((a, b) => {
    const scoreA = a.knowledgeOfWork + a.communicationAbility + a.credibility + a.likelihoodToRespond + a.relevanceToTarget;
    const scoreB = b.knowledgeOfWork + b.communicationAbility + b.credibility + b.likelihoodToRespond + b.relevanceToTarget;
    return scoreB - scoreA;
  });
  const toRow = (r: (typeof sortedRefs)[number]): ReportReferenceRow => ({
    name: r.name || "Unnamed reference",
    relationship: r.relationship || "—",
    notes: r.notes || "",
  });
  const primary = sortedRefs.slice(0, Math.min(2, sortedRefs.length)).map(toRow);
  const backup = sortedRefs.slice(2).map(toRow);

  const discrepancies = data.discrepancies.map((d) => ({
    field: d.field,
    resume: d.resumeValue,
    linkedin: d.linkedinValue,
    riskLevel: d.riskLevel,
    recommendation: d.recommendation,
  }));

  const talkingPoints = data.positions
    .map((p) => {
      const items = data.questionPrep
        .filter((q) => q.positionId === p.id && (q.coachedAnswer.trim() || q.clientInput.trim()))
        .map((q) => ({ category: q.category, answer: q.coachedAnswer.trim() || q.clientInput.trim() }));
      return { position: `${p.jobTitle || "Role"} — ${p.employer || "Employer"}`, items };
    })
    .filter((g) => g.items.length > 0);

  const checklist = [
    "Confirm every reference has been personally asked and has agreed to be contacted.",
    "Share the target job title and posting with each reference in advance.",
    "Walk each reference through likely questions so their story matches the resume.",
    "Resolve every flagged discrepancy between the resume and LinkedIn before scheduling checks.",
    "Rehearse answers for any Moderate or High risk positions listed above.",
    "Confirm current contact information for every reference.",
  ];

  return {
    clientName,
    targetJobTitle: data.targetJobTitle || "—",
    generatedDate: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    overall: {
      score: scores.overall,
      band: scores.band,
      breakdown: scores.breakdown,
      summaryNote: scores.summaryNote,
    },
    positions,
    referenceStrategy: { primary, backup },
    discrepancies,
    talkingPoints,
    checklist,
  };
}
