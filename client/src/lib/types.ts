// Core domain types for the WorkReferences Reference Readiness Coaching Course.
// These live inside the `data` JSON blob on the assessments row.

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "temporary"
  | "contract"
  | "consulting"
  | "staffing";

export type Arrangement = "direct_employer" | "staffing_client_assignment";

export type ReasonForLeaving =
  | "resigned"
  | "laid_off_restructuring"
  | "terminated"
  | "contract_ended"
  | "mutual_separation"
  | "still_employed"
  | "other";

export type RehireEligibility = "yes" | "no" | "unknown" | "not_applicable";

export type CompanyStatus = "active" | "closed" | "acquired" | "unknown";

export type SupervisorReachable = "yes" | "no" | "unknown" | "left_company";

export interface Position {
  id: string;
  employer: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  employmentType: EmploymentType;
  arrangement: Arrangement;
  staffingAgencyName: string;
  supervisor: string;
  supervisorReachable: SupervisorReachable;
  department: string;
  responsibilities: string;
  accomplishments: string;
  reasonForLeaving: ReasonForLeaving;
  reasonDetail: string;
  rehireEligible: RehireEligibility;
  companyStatus: CompanyStatus;
  likelyToBeVerified: boolean;
  concernNotes: string;
  hasGapBefore: boolean;
  gapExplanation: string;
}

export type RiskLevel = "Low" | "Moderate" | "High";

export interface ReferenceContact {
  id: string;
  name: string;
  relationship: string;
  linkedPositionId: string;
  seniority: number; // 1-5
  lengthOfRelationshipMonths: number;
  recencyYearsAgo: number;
  knowledgeOfWork: number; // 1-5
  communicationAbility: number; // 1-5
  credibility: number; // 1-5
  likelihoodToRespond: number; // 1-5
  relevanceToTarget: number; // 1-5
  notes: string;
}

export interface LinkedInEntry {
  id: string;
  employer: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
}

export interface Discrepancy {
  id: string;
  field: string;
  resumeValue: string;
  linkedinValue: string;
  riskLevel: RiskLevel;
  recommendation: string;
  source: "auto" | "manual";
}

export const QUESTION_CATEGORIES = [
  "Responsibilities",
  "Greatest Strengths",
  "Greatest Accomplishment",
  "Area for Development",
  "Reliability",
  "Teamwork",
  "Leadership",
  "Handling Pressure",
  "Reason for Leaving",
  "Management Style",
  "Rehire",
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export interface QuestionPrepEntry {
  id: string;
  positionId: string;
  category: QuestionCategory;
  clientInput: string;
  coachedAnswer: string;
}

export interface SimulationResponse {
  id: string;
  questionId: string;
  questionText: string;
  category: string;
  clientResponse: string;
  score: number; // 0-10
  feedback: string[];
  suggestion: string;
}

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  score: number;
  max: number;
}

export interface Scores {
  employmentHistoryRisk: number; // 0-30
  referenceQualityRisk: number; // 0-25
  consistencyRisk: number; // 0-25
  simulationReadinessRisk: number; // 0-20
  overall: number; // 0-100
  band: RiskLevel;
  breakdown: ScoreBreakdownItem[];
  summaryNote: string;
}

export interface AssessmentData {
  // Session 1
  targetJobTitle: string;
  targetIndustry: string;
  seniorityLevel: string;
  targetJobPosting: string;
  positions: Position[];
  referencesAvailableCount: number | null;
  linkedinConsistent: "yes" | "no" | "unsure" | null;
  hasEmploymentGaps: boolean | null;
  hasContractWork: boolean | null;
  hasPastReferenceProblem: boolean | null;
  pastProblemDetail: string;
  backgroundCheckConcerns: string;
  session1Complete: boolean;

  // Session 2
  references: ReferenceContact[];
  session2Complete: boolean;

  // Session 3
  questionPrep: QuestionPrepEntry[];
  session3Complete: boolean;

  // Session 4
  linkedinEntries: LinkedInEntry[];
  discrepancies: Discrepancy[];
  session4Complete: boolean;

  // Session 5
  simulationResponses: SimulationResponse[];
  session5Complete: boolean;

  // Computed
  scores: Scores | null;
  report: ReportPayload | null;
}

export function emptyAssessmentData(): AssessmentData {
  return {
    targetJobTitle: "",
    targetIndustry: "",
    seniorityLevel: "",
    targetJobPosting: "",
    positions: [],
    referencesAvailableCount: null,
    linkedinConsistent: null,
    hasEmploymentGaps: null,
    hasContractWork: null,
    hasPastReferenceProblem: null,
    pastProblemDetail: "",
    backgroundCheckConcerns: "",
    session1Complete: false,

    references: [],
    session2Complete: false,

    questionPrep: [],
    session3Complete: false,

    linkedinEntries: [],
    discrepancies: [],
    session4Complete: false,

    simulationResponses: [],
    session5Complete: false,

    scores: null,
    report: null,
  };
}

// ---- Report payload sent to the PDF generator ----

export interface ReportPosition {
  employer: string;
  jobTitle: string;
  dates: string;
  riskLevel: RiskLevel;
  riskFactors: string[];
  mitigation: string[];
}

export interface ReportReferenceRow {
  name: string;
  relationship: string;
  notes: string;
}

export interface ReportTalkingPointGroup {
  position: string;
  items: { category: string; answer: string }[];
}

export interface ReportPayload {
  clientName: string;
  targetJobTitle: string;
  generatedDate: string;
  overall: {
    score: number;
    band: RiskLevel;
    breakdown: ScoreBreakdownItem[];
    summaryNote: string;
  };
  positions: ReportPosition[];
  referenceStrategy: {
    primary: ReportReferenceRow[];
    backup: ReportReferenceRow[];
  };
  discrepancies: {
    field: string;
    resume: string;
    linkedin: string;
    riskLevel: RiskLevel;
    recommendation: string;
  }[];
  talkingPoints: ReportTalkingPointGroup[];
  checklist: string[];
}
