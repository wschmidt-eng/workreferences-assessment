import { assessments, riskAssessments } from "@shared/schema";
import type { Assessment, InsertAssessment, PatchAssessment, RiskAssessment } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

import { mkdirSync } from "node:fs";
import path from "node:path";

// On Render, DATA_DIR points at the persistent disk (e.g. /var/data) so the
// database and uploaded resumes survive deploys and restarts.
export const DATA_DIR = process.env.DATA_DIR || process.cwd();
mkdirSync(DATA_DIR, { recursive: true });
const sqlite = new Database(path.join(DATA_DIR, "data.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL DEFAULT '',
    target_job_title TEXT NOT NULL DEFAULT '',
    current_session INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'in_progress',
    data TEXT NOT NULL DEFAULT '{}',
    overall_risk_score INTEGER,
    risk_band TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS risk_assessments (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    job_search_status TEXT NOT NULL DEFAULT '',
    target_role TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'in_progress',
    overall_score INTEGER,
    result_category TEXT,
    resume_file_name TEXT,
    resume_stored_name TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  -- Anonymous research data: no names, contact details, resumes, free text or
  -- assessment IDs, and only the month of completion.
  CREATE TABLE IF NOT EXISTS research_responses (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    job_search_status TEXT NOT NULL DEFAULT '',
    result_category TEXT NOT NULL,
    answers TEXT NOT NULL
  );
  -- Anonymous funnel analytics: a random per-visit id (not linked to any
  -- assessment or person), the step reached and the day.
  CREATE TABLE IF NOT EXISTS funnel_events (
    visit_id TEXT NOT NULL,
    step TEXT NOT NULL,
    day TEXT NOT NULL,
    PRIMARY KEY (visit_id, step)
  );
`);

export const db = drizzle(sqlite);

export interface IStorage {
  createAssessment(a: InsertAssessment): Promise<Assessment>;
  getAssessment(id: string): Promise<Assessment | undefined>;
  patchAssessment(id: string, patch: PatchAssessment): Promise<Assessment | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createAssessment(a: InsertAssessment): Promise<Assessment> {
    const now = Date.now();
    return db
      .insert(assessments)
      .values({ ...a, createdAt: now, updatedAt: now })
      .returning()
      .get();
  }

  async getAssessment(id: string): Promise<Assessment | undefined> {
    return db.select().from(assessments).where(eq(assessments.id, id)).get();
  }

  async patchAssessment(id: string, patch: PatchAssessment): Promise<Assessment | undefined> {
    const existing = await this.getAssessment(id);
    if (!existing) return undefined;
    return db
      .update(assessments)
      .set({ ...patch, updatedAt: Date.now() })
      .where(eq(assessments.id, id))
      .returning()
      .get();
  }
}

export const storage = new DatabaseStorage();

type RiskPatch = Partial<Omit<RiskAssessment, "id" | "createdAt" | "updatedAt">>;

export const riskStorage = {
  create(values: Omit<RiskAssessment, "createdAt" | "updatedAt">): RiskAssessment {
    const now = Date.now();
    return db.insert(riskAssessments).values({ ...values, createdAt: now, updatedAt: now }).returning().get();
  },
  get(id: string): RiskAssessment | undefined {
    return db.select().from(riskAssessments).where(eq(riskAssessments.id, id)).get();
  },
  patch(id: string, patch: RiskPatch): RiskAssessment | undefined {
    if (!this.get(id)) return undefined;
    return db
      .update(riskAssessments)
      .set({ ...patch, updatedAt: Date.now() })
      .where(eq(riskAssessments.id, id))
      .returning()
      .get();
  },
  list(): RiskAssessment[] {
    return db.select().from(riskAssessments).orderBy(desc(riskAssessments.createdAt)).all();
  },
  remove(id: string): boolean {
    return sqlite.prepare("DELETE FROM risk_assessments WHERE id = ?").run(id).changes > 0;
  },
};

// Records from the retired 5-session coaching flow (not shown in the admin list).
export const coachingStorage = {
  count(): number {
    return (sqlite.prepare("SELECT COUNT(*) AS n FROM assessments").get() as { n: number }).n;
  },
  removeAll(): number {
    return sqlite.prepare("DELETE FROM assessments").run().changes;
  },
};

export interface ResearchRow {
  month: string;
  job_search_status: string;
  result_category: string;
  answers: string;
}

export const researchStorage = {
  add(row: { id: string } & ResearchRow) {
    sqlite
      .prepare(
        "INSERT INTO research_responses (id, month, job_search_status, result_category, answers) VALUES (@id, @month, @job_search_status, @result_category, @answers)"
      )
      .run(row);
  },
  list(sinceMonth?: string): ResearchRow[] {
    const sql = "SELECT month, job_search_status, result_category, answers FROM research_responses" + (sinceMonth ? " WHERE month >= ?" : "");
    const stmt = sqlite.prepare(sql);
    return (sinceMonth ? stmt.all(sinceMonth) : stmt.all()) as ResearchRow[];
  },
};

export const funnelStorage = {
  add(visitId: string, step: string) {
    sqlite
      .prepare("INSERT OR IGNORE INTO funnel_events (visit_id, step, day) VALUES (?, ?, ?)")
      .run(visitId, step, new Date().toISOString().slice(0, 10));
  },
  counts(sinceDay: string): Record<string, number> {
    const rows = sqlite
      .prepare("SELECT step, COUNT(*) AS n FROM funnel_events WHERE day >= ? GROUP BY step")
      .all(sinceDay) as { step: string; n: number }[];
    return Object.fromEntries(rows.map((r) => [r.step, r.n]));
  },
};
