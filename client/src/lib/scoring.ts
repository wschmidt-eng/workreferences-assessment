import type {
  AssessmentData,
  Position,
  ReferenceContact,
  Discrepancy,
  SimulationResponse,
  Scores,
  RiskLevel,
} from "./types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function monthsBetween(startISO: string, endISO: string): number | null {
  if (!startISO || !endISO) return null;
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  );
}

const REASON_SEVERITY: Record<Position["reasonForLeaving"], number> = {
  still_employed: 0,
  resigned: 0.5,
  contract_ended: 1,
  mutual_separation: 2,
  laid_off_restructuring: 2,
  other: 2.5,
  terminated: 5,
};

/** Employment History Risk — max 30 points */
export function scoreEmploymentHistory(positions: Position[]): {
  score: number;
  notes: string[];
} {
  if (positions.length === 0) {
    return { score: 0, notes: ["No positions entered yet."] };
  }

  let points = 0;
  const notes: string[] = [];

  for (const p of positions) {
    // Short tenure
    const tenure = p.isCurrent
      ? monthsBetween(p.startDate, new Date().toISOString())
      : monthsBetween(p.startDate, p.endDate);
    if (tenure !== null && tenure >= 0 && tenure < 6) {
      points += 4;
      notes.push(`Short tenure (<6 months) at ${p.employer || "an employer"}.`);
    }

    // Gap before this role
    if (p.hasGapBefore) {
      points += 3;
      notes.push(`Employment gap before ${p.employer || "this role"}.`);
    }

    // Unclear staffing/contract arrangement
    if (
      p.arrangement === "staffing_client_assignment" &&
      !p.staffingAgencyName.trim()
    ) {
      points += 3;
      notes.push(
        `Staffing/contract arrangement at ${p.employer || "an employer"} lacks a clearly documented agency of record.`
      );
    }

    // Reason for leaving severity
    const severity = REASON_SEVERITY[p.reasonForLeaving] ?? 2;
    if (severity > 0) {
      points += severity;
      if (severity >= 5) {
        notes.push(`Termination on record at ${p.employer || "an employer"}.`);
      } else if (severity >= 2) {
        notes.push(
          `Departure circumstances at ${p.employer || "an employer"} may prompt follow-up questions.`
        );
      }
    }

    // Closed / acquired employer
    if (p.companyStatus === "closed" || p.companyStatus === "acquired") {
      points += 2;
      notes.push(
        `${p.employer || "Employer"} is ${p.companyStatus === "closed" ? "no longer operating" : "acquired"}, which can complicate verification.`
      );
    }

    // Unreachable supervisor
    if (
      p.supervisorReachable === "no" ||
      p.supervisorReachable === "left_company"
    ) {
      points += 2;
      notes.push(
        `Direct supervisor at ${p.employer || "an employer"} may not be reachable for verification.`
      );
    }

    // User-flagged concern
    if (p.concernNotes.trim()) {
      points += 2;
      notes.push(`Self-flagged concern noted for ${p.employer || "a role"}.`);
    }
  }

  return { score: clamp(Math.round(points), 0, 30), notes };
}

/** Reference Quality & Availability Risk — max 25 points */
export function scoreReferenceQuality(
  references: ReferenceContact[],
  positions: Position[]
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let points = 0;

  // Reference count baseline
  const count = references.length;
  if (count === 0) points += 25;
  else if (count === 1) points += 15;
  else if (count === 2) points += 8;
  else points += 0;

  if (count < 2) {
    notes.push("Fewer than two references on file — coverage gap.");
  }

  // Average quality dimensions (inverted: low quality = higher risk)
  if (count > 0) {
    const avgQuality =
      references.reduce((sum, r) => {
        const dims = [
          r.knowledgeOfWork,
          r.communicationAbility,
          r.credibility,
          r.likelihoodToRespond,
          r.relevanceToTarget,
        ];
        return sum + dims.reduce((a, b) => a + b, 0) / dims.length;
      }, 0) / count;
    // avgQuality is 1-5; invert to 0-15 points of risk
    const qualityRisk = ((5 - avgQuality) / 4) * 15;
    points += qualityRisk;
    if (avgQuality < 3) {
      notes.push("Average reference quality rating is below target — coach before submission.");
    }
  }

  // Uncovered high-verification-risk positions (positions likely to be verified without a linked reference)
  const verifiablePositions = positions.filter((p) => p.likelyToBeVerified);
  const coveredPositionIds = new Set(references.map((r) => r.linkedPositionId).filter(Boolean));
  const uncovered = verifiablePositions.filter((p) => !coveredPositionIds.has(p.id));
  if (uncovered.length > 0) {
    points += Math.min(uncovered.length * 3, 9);
    notes.push(
      `${uncovered.length} position(s) likely to be verified have no linked reference.`
    );
  }

  return { score: clamp(Math.round(points), 0, 25), notes };
}

/** Consistency Risk — max 25 points */
export function scoreConsistency(discrepancies: Discrepancy[]): {
  score: number;
  notes: string[];
} {
  const weights: Record<RiskLevel, number> = { High: 8, Moderate: 4, Low: 1 };
  let points = 0;
  for (const d of discrepancies) points += weights[d.riskLevel] ?? 2;

  const notes =
    discrepancies.length > 0
      ? [`${discrepancies.length} discrepancy(ies) flagged between resume and LinkedIn.`]
      : ["No discrepancies flagged."];

  return { score: clamp(Math.round(points), 0, 25), notes };
}

/** Simulation Readiness Risk — max 20 points */
export function scoreSimulationReadiness(responses: SimulationResponse[]): {
  score: number;
  notes: string[];
} {
  if (responses.length === 0) {
    return { score: 0, notes: ["No simulation responses recorded yet."] };
  }
  const avg =
    responses.reduce((sum, r) => sum + r.score, 0) / responses.length;
  // avg is 0-10; invert to 0-20 risk points
  const risk = ((10 - avg) / 10) * 20;
  const notes = [
    avg < 6
      ? "Simulated responses need more preparation before a live reference check."
      : "Simulated responses are solid overall.",
  ];
  return { score: clamp(Math.round(risk), 0, 20), notes };
}

function bandFor(overall: number): RiskLevel {
  if (overall <= 25) return "Low";
  if (overall <= 55) return "Moderate";
  return "High";
}

export function computeScores(data: AssessmentData): Scores {
  const emp = scoreEmploymentHistory(data.positions);
  const ref = scoreReferenceQuality(data.references, data.positions);
  const cons = scoreConsistency(data.discrepancies);
  const sim = scoreSimulationReadiness(data.simulationResponses);

  const overall = clamp(
    Math.round(emp.score + ref.score + cons.score + sim.score),
    0,
    100
  );
  const band = bandFor(overall);

  const summaryNote =
    band === "Low"
      ? "Overall reference risk is low. The current employment history, reference roster, and consistency checks are in good shape. Continue final talking-point rehearsal before any live reference check."
      : band === "Moderate"
      ? "Overall reference risk is moderate. A handful of items — flagged below — could generate follow-up questions from a recruiter or verifier. Address these before scheduling reference checks."
      : "Overall reference risk is high. Multiple factors could create credibility or verification problems. Work through each flagged item with a WorkReferences strategist before any reference check is initiated.";

  return {
    employmentHistoryRisk: emp.score,
    referenceQualityRisk: ref.score,
    consistencyRisk: cons.score,
    simulationReadinessRisk: sim.score,
    overall,
    band,
    breakdown: [
      { key: "employmentHistoryRisk", label: "Employment History", score: emp.score, max: 30 },
      { key: "referenceQualityRisk", label: "Reference Quality & Availability", score: ref.score, max: 25 },
      { key: "consistencyRisk", label: "Consistency (Resume vs. LinkedIn)", score: cons.score, max: 25 },
      { key: "simulationReadinessRisk", label: "Simulation Readiness", score: sim.score, max: 20 },
    ],
    summaryNote,
  };
}

export function riskBandColor(band: RiskLevel): string {
  if (band === "Low") return "text-primary";
  if (band === "Moderate") return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}
