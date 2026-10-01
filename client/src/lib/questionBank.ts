export const COACHING_PROMPTS: Record<string, string> = {
  "Responsibilities": "State the scope plainly: what the client owned day to day, in one or two sentences, using the same wording as their resume.",
  "Greatest Strengths": "Name one or two strengths and back each with a brief, concrete example of when it showed up on the job.",
  "Greatest Accomplishment": "Lead with a measurable result (a number, percentage, or outcome) and briefly explain what the client did to achieve it.",
  "Area for Development": "Name a real, minor growth area and immediately pair it with the specific step the client took to improve it.",
  "Reliability": "Confirm consistent attendance and on-time delivery; mention a specific project where reliability mattered.",
  "Teamwork": "Describe one example of the client collaborating cross-functionally or supporting a teammate.",
  "Leadership": "If applicable, mention a specific instance of leading, training, or mentoring; if not applicable, say so plainly.",
  "Handling Pressure": "Give one specific deadline or high-pressure situation and how the client stayed organized through it.",
  "Reason for Leaving": "State the reason factually and briefly, in positive or neutral terms, without elaborating defensively.",
  "Management Style": "Describe communication style and working preferences in a few words — direct, collaborative, detail-oriented, etc.",
  "Rehire": "Answer plainly. If the honest answer is anything other than an enthusiastic yes, prepare a brief, factual explanation.",
};

export function coachingPromptFor(category: string): string {
  return COACHING_PROMPTS[category] || "Answer specifically and factually, in 2-4 confident sentences.";
}

export interface BankQuestion {
  id: string;
  category: string;
  text: string;
  keywords: string[]; // relevance keywords the evaluator looks for
}

export const SIMULATED_QUESTIONS: BankQuestion[] = [
  {
    id: "q_verify_dates",
    category: "Employment Verification",
    text: "Can you confirm this person's job title, employment dates, and department?",
    keywords: ["title", "date", "department", "start", "end", "role"],
  },
  {
    id: "q_verify_duties",
    category: "Employment Verification",
    text: "What were this person's main responsibilities day to day?",
    keywords: ["responsib", "manage", "led", "handled", "owned", "duties"],
  },
  {
    id: "q_performance",
    category: "Performance",
    text: "How would you rate this person's overall performance?",
    keywords: ["strong", "excellent", "consistent", "result", "performance", "reliable"],
  },
  {
    id: "q_accomplishment",
    category: "Performance",
    text: "What is an example of strong work this person delivered?",
    keywords: ["project", "result", "increase", "%", "delivered", "launched", "achieved"],
  },
  {
    id: "q_development",
    category: "Development",
    text: "Is there anything this person could have improved on?",
    keywords: ["improve", "growth", "development", "learn", "working on"],
  },
  {
    id: "q_reliability",
    category: "Reliability",
    text: "Was this person reliable — did they show up consistently and meet deadlines?",
    keywords: ["reliable", "on time", "deadline", "consistent", "dependable", "attendance"],
  },
  {
    id: "q_teamwork",
    category: "Teamwork",
    text: "How did this person work with others on the team?",
    keywords: ["team", "collaborat", "colleague", "support", "cross-functional"],
  },
  {
    id: "q_leadership",
    category: "Leadership",
    text: "Did this person take on any leadership or mentoring responsibilities?",
    keywords: ["lead", "mentor", "train", "manage", "supervis", "coach"],
  },
  {
    id: "q_pressure",
    category: "Handling Pressure",
    text: "How did this person handle pressure or tight deadlines?",
    keywords: ["pressure", "deadline", "calm", "prioritiz", "manage stress", "handled"],
  },
  {
    id: "q_departure",
    category: "Reason for Leaving",
    text: "Why did this person leave the company?",
    keywords: ["resign", "opportunity", "restructur", "laid off", "contract ended", "career"],
  },
  {
    id: "q_management_style",
    category: "Management Style",
    text: "How would you describe this person's working or management style?",
    keywords: ["style", "communicat", "organiz", "detail", "collaborative", "direct"],
  },
  {
    id: "q_rehire",
    category: "Rehire",
    text: "Would you rehire this person if given the opportunity?",
    keywords: ["yes", "rehire", "would hire again", "welcome back"],
  },
];

const HEDGING_WORDS = [
  "i guess",
  "kind of",
  "sort of",
  "i think maybe",
  "not sure",
  "probably",
  "i don't know",
  "um",
  "uh",
];

const NEGATIVE_WORDS = [
  "hate",
  "terrible",
  "awful",
  "worst",
  "toxic",
  "fired me unfairly",
  "sued",
  "lawsuit",
  "screwed",
  "incompetent boss",
];

export interface EvaluationResult {
  score: number; // 0-10
  feedback: string[];
  suggestion: string;
}

/** Deterministic heuristic evaluator — no LLM calls. */
export function evaluateResponse(
  question: BankQuestion,
  response: string
): EvaluationResult {
  const text = response.trim();
  const lower = text.toLowerCase();
  const feedback: string[] = [];
  let score = 5;

  // Word count
  const wordCount = text.length === 0 ? 0 : text.split(/\s+/).length;
  if (wordCount === 0) {
    return {
      score: 0,
      feedback: ["No response provided yet."],
      suggestion: "Draft a specific, concrete answer using the STAR format (Situation, Task, Action, Result).",
    };
  }
  if (wordCount < 12) {
    score -= 2;
    feedback.push("Response is quite short — recruiters expect a fuller, more specific answer.");
  } else if (wordCount > 15 && wordCount < 90) {
    score += 1;
    feedback.push("Good length — concise but substantive.");
  } else if (wordCount >= 90) {
    feedback.push("Response is long — consider tightening to the most relevant details.");
  }

  // Numbers / metrics present
  const hasNumbers = /\d/.test(text) || /%/.test(text);
  if (hasNumbers) {
    score += 1.5;
    feedback.push("Includes concrete numbers or metrics — strengthens credibility.");
  } else if (question.category === "Performance") {
    feedback.push("Consider adding a measurable result or metric to make this more concrete.");
  }

  // Hedging language
  const hedgeHit = HEDGING_WORDS.find((h) => lower.includes(h));
  if (hedgeHit) {
    score -= 2;
    feedback.push(`Hedging language detected ("${hedgeHit}") — aim for confident, direct phrasing.`);
  }

  // Negative language about past employer
  const negHit = NEGATIVE_WORDS.find((n) => lower.includes(n));
  if (negHit) {
    score -= 3;
    feedback.push("Contains negative or inflammatory language about a past employer — reframe constructively.");
  }

  // Relevance keyword overlap
  const keywordHits = question.keywords.filter((k) => lower.includes(k.toLowerCase()));
  if (keywordHits.length > 0) {
    score += Math.min(keywordHits.length, 2);
    feedback.push("Directly addresses the question topic.");
  } else {
    score -= 1;
    feedback.push("Response doesn't clearly address the specific question asked — stay on topic.");
  }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  let suggestion: string;
  if (score >= 8) {
    suggestion = "Strong answer — keep this framing for the live reference check.";
  } else if (score >= 5) {
    suggestion = "Solid start. Add a specific example or metric and remove any hedging language.";
  } else {
    suggestion = "Rework this answer: use a specific, factual example, avoid hedging or negativity, and keep it to 2-4 confident sentences.";
  }

  return { score, feedback, suggestion };
}
