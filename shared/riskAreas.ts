// Free Reference Risk Assessment — the 6 risk areas described on
// https://workreferences.com/services/free-reference-risk-assessment
// Deterministic scoring: each area is scored 1–10 (higher = more risk).

export type Flag = "green" | "yellow" | "red";
export type ResultCategory = "aligned" | "review" | "issue";

export interface AreaOption {
  id: string;
  label: string;
  hint?: string;
  score: number; // 1–10
  /** In multi-select areas, choosing this clears every other choice (e.g. "no issues"). */
  exclusive?: boolean;
}

export interface RiskArea {
  key: AreaKey;
  number: number;
  title: string;
  question: string;
  whatHrChecks: string;
  weight: number; // share of the 0–100 overall score
  category: CategoryKey;
  /** "Select all that apply" when true. */
  multi?: boolean;
  options: AreaOption[]; // max 9 + the shared "Other" option appended below
  prepare: Record<Flag, string>;
}

export type AreaKey = "dates" | "titles" | "arrangement" | "references" | "departure" | "consistency";
export type CategoryKey = "employment" | "references" | "resume" | "online";

export interface AreaAnswer {
  optionIds: string[];
  /** Free text, only collected when "Other" is chosen. Never used in research data. */
  other: string;
}

export type AreaAnswers = Partial<Record<AreaKey, AreaAnswer>>;

export interface Position {
  employer: string;
  title: string;
  start: string;
  end: string;
  current: boolean;
}

export const OTHER_ID = "other";
export const OTHER_SCORE = 5; // "Worth reviewing" so a consultant always looks at it
const OTHER_OPTION: AreaOption = { id: OTHER_ID, label: "Other", score: OTHER_SCORE };

export const RISK_AREAS: RiskArea[] = [
  {
    key: "arrangement",
    number: 1,
    title: "Employment arrangement",
    question: "How were you employed in your recent jobs?",
    whatHrChecks:
      "If you were a contractor, consultant, temp or staffing-agency placement, the client company often has no record of you. Verification may need to go through the agency instead.",
    weight: 15,
    category: "employment",
    options: [
      { id: "direct", label: "Direct employee, and the resume shows it correctly", score: 1 },
      { id: "agencyShown", label: "Contractor or staffing agency, and the resume names the agency", score: 3 },
      { id: "closed", label: "The company has closed", hint: "Records may be hard to locate", score: 5 },
      { id: "merged", label: "The company merged, was acquired or was renamed", score: 5 },
      { id: "agencyHidden", label: "Placed by a staffing agency, but the resume lists only the client company", score: 6 },
      { id: "contract", label: "Contract, 1099 or consulting work shown as direct employment", score: 7 },
      { id: "self", label: "Self-employed or my own business, with limited records", score: 7 },
      { id: "unsure", label: "I'm not sure who would verify my employment", score: 5 },
    ],
    prepare: {
      green: "No action needed. Your employer of record matches your resume.",
      yellow:
        "Add the agency or company-of-record to your resume (for example, \"Client Company via Agency Name\") and keep a contact there who can verify.",
      red: "Gather proof such as 1099s, contracts, invoices or pay stubs, and list the real arrangement. A consultant can help you describe contract work so it still reads as strong experience.",
    },
  },
  {
    key: "references",
    number: 2,
    title: "References",
    question: "Which of these describe the references you can provide? Select all that apply.",
    whatHrChecks:
      "Employers look for references who are available, credible (ideally former managers) and likely to give positive, accurate feedback that matches your resume.",
    weight: 15,
    category: "references",
    multi: true,
    options: [
      { id: "strong", label: "3 or more former managers who are reachable and likely positive", score: 1, exclusive: true },
      { id: "peers", label: "Mostly peers or colleagues rather than managers", score: 4 },
      { id: "hrOnly", label: "My former employer sends all reference requests to HR", score: 5 },
      { id: "datesOnly", label: "My former employer will only confirm dates and title", score: 5 },
      { id: "retired", label: "A former manager has retired", score: 6 },
      { id: "few", label: "I have only 1 or 2 references, or none", score: 7 },
      { id: "gone", label: "A key supervisor left and I can't reach them", score: 7 },
      { id: "unsure", label: "I'm not sure what a reference would say about me", score: 8 },
      { id: "poor", label: "A work relationship ended poorly, or a manager may be negative", score: 10 },
    ],
    prepare: {
      green: "Confirm each reference still agrees, and send them your current resume and target role.",
      yellow:
        "Reconnect with former supervisors, including those who've moved to new companies, and brief each reference on the dates and title you'll present.",
      red: "Build your reference list before you apply. WorkReferences can help you identify credible, verifiable references and prepare them.",
    },
  },
  {
    key: "consistency",
    number: 3,
    title: "Consistency across records and profiles",
    question: "How consistent are your resume, LinkedIn profile and past job applications?",
    whatHrChecks:
      "Recruiters routinely compare your resume with LinkedIn and with earlier applications. Mismatched dates, titles or employers raise credibility questions even when each one has an explanation.",
    weight: 15,
    category: "online",
    options: [
      { id: "match", label: "Resume, LinkedIn and applications all match", score: 1 },
      { id: "minor", label: "Minor wording differences only", score: 3 },
      { id: "nolinkedin", label: "My LinkedIn is missing or out of date", score: 4 },
      { id: "unsure", label: "I haven't compared them recently", score: 5 },
      { id: "differ", label: "Dates or titles differ between my resume and LinkedIn", score: 7 },
      { id: "oldapps", label: "An old application or background check shows different details", score: 7 },
      { id: "versions", label: "I've sent different resume versions with different details", score: 8 },
    ],
    prepare: {
      green: "No action needed. Re-check LinkedIn whenever you update your resume.",
      yellow: "Update LinkedIn so dates, titles and employers match your resume word for word.",
      red: "Pick one accurate version of your history and update LinkedIn and your resume to match it before applying again.",
    },
  },
  {
    key: "dates",
    number: 4,
    title: "Employment dates",
    question: "Would the dates on your resume match what a former employer has on file?",
    whatHrChecks:
      "Employment verifications usually confirm start and end dates from the employer's HR or payroll records. Only the difference matters here, not the dates themselves.",
    weight: 20,
    category: "employment",
    options: [
      { id: "match", label: "Yes, they match", score: 1 },
      { id: "le90", label: "Close. Rounded to the month or year", score: 4 },
      { id: "3to6", label: "A few months different", score: 6 },
      { id: "6to12", label: "Six months or more different", score: 9 },
      { id: "overlap", label: "Two jobs overlap", score: 5 },
      { id: "gapcover", label: "A gap between jobs isn't shown", score: 10 },
      { id: "records", label: "Their records may be missing or wrong", hint: "For example, after a closure, merger or payroll change", score: 5 },
      { id: "unsure", label: "Not sure", score: 5 },
    ],
    prepare: {
      green: "Keep your dates exactly as they are and use the same dates on every application.",
      yellow:
        "Small differences are common, but align your resume to the dates HR will confirm, and be ready to explain any rounding in one sentence.",
      red: "Update the resume to the verifiable dates before your next background check. A consultant can help you present any gap honestly and confidently.",
    },
  },
  {
    key: "titles",
    number: 5,
    title: "Job titles",
    question: "Would your job titles match what a former employer has on file?",
    whatHrChecks:
      "Employment verifications usually return the official title in the HR system, which can differ from the title you used day to day. Only the difference matters here, not the title itself.",
    weight: 20,
    category: "resume",
    options: [
      { id: "match", label: "Yes, they match", score: 1 },
      { id: "wording", label: "Same job, different wording", hint: "For example, \"Operations Manager\" vs. \"Operations Supervisor II\"", score: 3 },
      { id: "functional", label: "I used a clearer title for an unusual internal one", score: 4 },
      { id: "reorg", label: "Title changed after a reorganization or merger", score: 4 },
      { id: "acting", label: "A promotion or acting role HR never updated", score: 6 },
      { id: "oneup", label: "One level above their records", score: 8 },
      { id: "different", label: "A different or more senior role than their records", score: 10 },
      { id: "unsure", label: "Not sure", score: 5 },
    ],
    prepare: {
      green: "No action needed. Keep titles identical across your resume, LinkedIn and applications.",
      yellow:
        "Consider listing the official title with a clarifier, such as \"Operations Supervisor II (Operations Manager duties)\", and brief a reference who can confirm your scope.",
      red: "Use the official title on record. A recruiter who finds a higher title during verification is likely to question the whole resume.",
    },
  },
  {
    key: "departure",
    number: 6,
    title: "Departures and employment gaps",
    question: "Which of these describe how you left recent positions, and any gaps between them? Select all that apply.",
    whatHrChecks:
      "Some verifications include reason for leaving or rehire eligibility. Unexplained gaps and difficult departures often lead to follow-up questions.",
    weight: 15,
    category: "employment",
    multi: true,
    options: [
      { id: "clean", label: "Left voluntarily, with no gaps over 6 months", score: 1, exclusive: true },
      { id: "layoff", label: "Laid off, position eliminated or restructured", score: 3 },
      { id: "closure", label: "My employer closed, merged or was acquired", score: 3 },
      { id: "personal", label: "A gap for caregiving, health, education or relocation", score: 4 },
      { id: "gap6", label: "A gap of 6 to 12 months", score: 5 },
      { id: "gap12", label: "A gap of more than 12 months", score: 7 },
      { id: "pressure", label: "Resigned under pressure, or a difficult departure", score: 8 },
      { id: "rehire", label: "Not eligible for rehire", score: 9 },
      { id: "cause", label: "Fired or let go with cause", score: 10 },
    ],
    prepare: {
      green: "Have a one-sentence, positive reason for leaving ready for each role.",
      yellow:
        "Prepare a short, factual explanation (for example, restructuring, caregiving or education) and make sure your references would describe it the same way.",
      red: "Don't try to hide it. Prepare a truthful, forward-looking explanation and choose references who can speak to your performance. This is where a consultant helps most.",
    },
  },
];

// Every question ends with "Other" (max 10 choices in total).
for (const area of RISK_AREAS) area.options.push(OTHER_OPTION);

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  employment: "Employment History",
  references: "Reference Reliability",
  resume: "Resume Claims",
  online: "Online Presence",
};

export const RESULT_COPY: Record<ResultCategory, { title: string; summary: string; band: "Low" | "Moderate" | "High" }> = {
  aligned: {
    title: "Generally aligned",
    summary:
      "Your information appears generally aligned with what an employer or background-screening company is likely to verify. A quick review can still help you go into your next check with confidence.",
    band: "Low",
  },
  review: {
    title: "Closer review recommended",
    summary:
      "One or more areas may deserve closer review before your next reference or employment-verification check. Most of these have straightforward fixes when they're addressed early.",
    band: "Moderate",
  },
  issue: {
    title: "Potential issue to address",
    summary:
      "A potential verification or reference issue may be worth addressing before your next check. We recommend speaking with a WorkReferences career consultant before you apply or accept an offer.",
    band: "High",
  },
};

export function flagFor(score: number): Flag {
  if (score <= 3) return "green";
  if (score <= 6) return "yellow";
  return "red";
}

function bandOf(score: number): [number, number] {
  return score <= 3 ? [1, 3] : score <= 6 ? [4, 6] : [7, 10];
}

const LEGACY_IDS: Record<string, string> = { gt12: "6to12" };

/** Normalises stored answers, including records saved before multi-select existed. */
export function selectedIds(answer?: AreaAnswer | { optionId?: string }): string[] {
  if (!answer) return [];
  const a = answer as any;
  const raw: string[] = Array.isArray(a.optionIds)
    ? a.optionIds.filter((x: unknown) => typeof x === "string")
    : typeof a.optionId === "string" && a.optionId
      ? [a.optionId]
      : [];
  // Answer choices merged on Oct 7, 2026 ("Off by more than 12 months" became
  // part of "Six months or more different").
  return Array.from(new Set(raw.map((x) => LEGACY_IDS[x] || x)));
}

export function areaScore(area: RiskArea, answer?: AreaAnswer): number | null {
  const ids = selectedIds(answer);
  const opts = area.options.filter((o) => ids.includes(o.id));
  if (!opts.length) return null;
  const top = Math.max(...opts.map((o) => o.score));
  // Stacked challenges (2+ non-green choices) add one point, but never move the
  // answer out of the band set by its most serious choice.
  const stacked = opts.filter((o) => o.score >= 4).length >= 2;
  if (!stacked) return top;
  const [, hi] = bandOf(top);
  return Math.min(hi, top + 1);
}

export function isAnswered(area: RiskArea, answer?: AreaAnswer): boolean {
  const ids = selectedIds(answer);
  if (!ids.length) return false;
  if (ids.includes(OTHER_ID)) return (answer?.other ?? "").trim().length >= 3;
  return true;
}

export interface ScoredArea {
  key: AreaKey;
  number: number;
  title: string;
  score: number;
  flag: Flag;
  answerLabel: string;
  answerLabels: string[];
  other: string;
  prepare: string;
}

export interface AssessmentResult {
  overall: number; // 0–100
  category: ResultCategory;
  areas: ScoredArea[];
  categories: { key: CategoryKey; label: string; risk: number }[];
  flags: { green: number; yellow: number; red: number };
}

export function computeResult(answers: AreaAnswers): AssessmentResult {
  const areas: ScoredArea[] = [];
  let weighted = 0;
  let totalWeight = 0;
  const catAcc: Record<CategoryKey, { sum: number; n: number }> = {
    employment: { sum: 0, n: 0 },
    references: { sum: 0, n: 0 },
    resume: { sum: 0, n: 0 },
    online: { sum: 0, n: 0 },
  };

  for (const area of RISK_AREAS) {
    const ans = answers[area.key];
    const s = areaScore(area, ans);
    if (s === null) continue;
    const flag = flagFor(s);
    const norm = (s - 1) / 9;
    weighted += norm * area.weight;
    totalWeight += area.weight;
    catAcc[area.category].sum += norm * 100;
    catAcc[area.category].n += 1;
    areas.push({
      key: area.key,
      number: area.number,
      title: area.title,
      score: s,
      flag,
      answerLabels: area.options.filter((o) => selectedIds(ans).includes(o.id)).map((o) => o.label),
      answerLabel: area.options
        .filter((o) => selectedIds(ans).includes(o.id))
        .map((o) => (o.id === OTHER_ID && ans?.other ? `Other: ${ans.other}` : o.label))
        .join("; "),
      other: ans?.other ?? "",
      prepare: area.prepare[flag],
    });
  }

  const overall = totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 100);
  const reds = areas.filter((a) => a.flag === "red").length;
  const yellows = areas.filter((a) => a.flag === "yellow").length;

  let category: ResultCategory = overall <= 30 ? "aligned" : overall <= 55 ? "review" : "issue";
  // Escalation rules: a single red flag always warrants review; two or more means a likely issue.
  if (reds >= 2) category = "issue";
  else if (reds === 1 && category === "aligned") category = "review";

  const categories = (Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    risk: catAcc[key].n ? Math.round(catAcc[key].sum / catAcc[key].n) : 0,
  }));

  return {
    overall,
    category,
    areas,
    categories,
    flags: { green: areas.length - reds - yellows, yellow: yellows, red: reds },
  };
}

export const JOB_SEARCH_STATUSES = [
  "Actively applying",
  "Interviewing now",
  "Received an offer, background check pending",
  "Planning a search in the next 3 months",
  "Just exploring",
];
