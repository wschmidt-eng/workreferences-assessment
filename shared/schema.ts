import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type * as z from "zod/mini";

export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey(),
  clientName: text("client_name").notNull().default(""),
  targetJobTitle: text("target_job_title").notNull().default(""),
  currentSession: integer("current_session").notNull().default(1),
  status: text("status").notNull().default("in_progress"),
  data: text("data").notNull().default("{}"),
  overallRiskScore: integer("overall_risk_score"),
  riskBand: text("risk_band"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({
  createdAt: true,
  updatedAt: true,
});

export const patchAssessmentSchema = createInsertSchema(assessments)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();

export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type PatchAssessment = z.infer<typeof patchAssessmentSchema>;
export type Assessment = typeof assessments.$inferSelect;

// Free Reference Risk Assessment (visitor funnel, 6 risk areas)
export const riskAssessments = sqliteTable("risk_assessments", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  jobSearchStatus: text("job_search_status").notNull().default(""),
  targetRole: text("target_role").notNull().default(""),
  data: text("data").notNull().default("{}"),
  status: text("status").notNull().default("in_progress"),
  overallScore: integer("overall_score"),
  resultCategory: text("result_category"),
  resumeFileName: text("resume_file_name"),
  resumeStoredName: text("resume_stored_name"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type RiskAssessment = typeof riskAssessments.$inferSelect;
