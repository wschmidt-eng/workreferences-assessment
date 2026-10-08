import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { storage, riskStorage, researchStorage, funnelStorage, coachingStorage, DATA_DIR } from "./storage";
import { computeResult, RISK_AREAS, OTHER_ID, selectedIds, JOB_SEARCH_STATUSES, RESULT_COPY } from "@shared/riskAreas";
import type { RiskAssessment } from "@shared/schema";
import { notifyCompleted, notifyResume } from "./notify";
import { patchAssessmentSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/assessments", async (req, res) => {
    const clientName = typeof req.body?.clientName === "string" ? req.body.clientName : "";
    const targetJobTitle = typeof req.body?.targetJobTitle === "string" ? req.body.targetJobTitle : "";
    const assessment = await storage.createAssessment({
      id: randomUUID(),
      clientName,
      targetJobTitle,
      currentSession: 1,
      status: "in_progress",
      data: "{}",
    });
    res.status(201).json(assessment);
  });

  app.get("/api/assessments/:id", async (req, res) => {
    const assessment = await storage.getAssessment(req.params.id);
    if (!assessment) return res.status(404).json({ message: "Not found" });
    res.json(assessment);
  });

  app.patch("/api/assessments/:id", async (req, res) => {
    const parsed = patchAssessmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    }
    const updated = await storage.patchAssessment(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.get("/api/assessments/:id/pdf", async (req, res) => {
    const assessment = await storage.getAssessment(req.params.id);
    if (!assessment) return res.status(404).json({ message: "Not found" });

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(assessment.data || "{}");
    } catch {
      parsedData = {};
    }
    const reportPayload = parsedData.report;
    if (!reportPayload) {
      return res.status(400).json({ message: "Report has not been generated yet" });
    }
    try {
      const dir = mkdtempSync(path.join(tmpdir(), "refcoach-"));
      const jsonPath = path.join(dir, "report.json");
      const pdfPath = path.join(dir, "report.pdf");
      writeFileSync(jsonPath, JSON.stringify(reportPayload));

      const scriptPath = path.join(process.cwd(), "server", "generate_report_pdf.py");
      const py = spawn("python3", [scriptPath, jsonPath, pdfPath]);
      let stderr = "";
      py.stderr.on("data", (d) => (stderr += d.toString()));
      py.on("close", (code) => {
        if (code !== 0 || !existsSync(pdfPath)) {
          console.error("PDF generation failed:", stderr);
          return res.status(500).json({ message: "PDF generation failed" });
        }
        const safeName = (assessment.clientName || "Client").replace(/[^a-zA-Z0-9_\-]+/g, "_");
        res.download(pdfPath, `WorkReferences_Reference_Prep_Report_${safeName}.pdf`);
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "PDF generation failed" });
    }
  });

  // ---------------- Free Reference Risk Assessment (6 risk areas) ----------------
  const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx", ".rtf", ".txt"]);
  const MAX_RESUME_BYTES = 5 * 1024 * 1024;
  const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const publicView = (r: RiskAssessment) => {
    const { resumeStoredName, ...rest } = r;
    return { ...rest, hasResume: !!resumeStoredName };
  };

  const sanitizeData = (raw: any) => {
    const out: any = { positions: [], answers: {} };
    // Positions (employers, titles, dates) are no longer collected: a consultant only
    // needs to know where differences exist, not the details themselves.
    for (const area of RISK_AREAS) {
      const a = raw?.answers?.[area.key];
      if (!a) continue;
      let ids = selectedIds(a).map((x) => str(x, 40)).filter((id) => area.options.some((o) => o.id === id));
      ids = Array.from(new Set(ids));
      if (!area.multi) ids = ids.slice(0, 1);
      // An exclusive choice ("no issues") can't be combined with others.
      const excl = ids.find((id) => area.options.find((o) => o.id === id)?.exclusive);
      if (excl && ids.length > 1) ids = ids.filter((id) => id !== excl);
      if (!ids.length) continue;
      const other = ids.includes(OTHER_ID) ? str(a.other, 1000) : "";
      out.answers[area.key] = { optionIds: ids, other };
    }
    out.consent = !!raw?.consent;
    return out;
  };

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      bookingUrl: process.env.BOOKING_URL || "https://live.vcita.com/site/27x9gds0opl46jcy/online-scheduling?service=48a5dda49xy1aaj3",
      // Preview only: show sample research numbers on the results page. Leave unset in production.
      researchSample: process.env.RESEARCH_SAMPLE === "1",
    });
  });

  app.post("/api/risk-assessments", (req, res) => {
    const b = req.body || {};
    const firstName = str(b.firstName, 80);
    const email = str(b.email, 160);
    if (!firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "First name and a valid email are required" });
    }
    const phone = str(b.phone, 40);
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return res.status(400).json({ message: "A valid phone number is required" });
    }
    if (!b.consent) return res.status(400).json({ message: "Consent is required" });
    const rec = riskStorage.create({
      id: randomUUID(),
      firstName,
      lastName: str(b.lastName, 80),
      email,
      phone,
      jobSearchStatus: str(b.jobSearchStatus, 80),
      targetRole: str(b.targetRole, 120),
      data: JSON.stringify(sanitizeData({ ...(b.data && typeof b.data === "object" ? b.data : {}), consent: true })),
      status: "in_progress",
      overallScore: null,
      resultCategory: null,
      resumeFileName: null,
      resumeStoredName: null,
    });
    res.status(201).json(publicView(rec));
  });

  app.get("/api/risk-assessments/:id", (req, res) => {
    const rec = riskStorage.get(req.params.id);
    if (!rec) return res.status(404).json({ message: "Not found" });
    res.json(publicView(rec));
  });

  app.patch("/api/risk-assessments/:id", (req, res) => {
    const rec = riskStorage.get(req.params.id);
    if (!rec) return res.status(404).json({ message: "Not found" });
    const b = req.body || {};
    const prev = JSON.parse(rec.data || "{}");
    const data = sanitizeData({ ...prev, ...(b.data || {}), consent: prev.consent });
    const patch: any = { data: JSON.stringify(data) };
    let research: any = null;
    if (b.complete) {
      const result = computeResult(data.answers);
      if (result.areas.length < RISK_AREAS.length) {
        return res.status(400).json({ message: "All six risk areas must be answered" });
      }
      const missingOther = RISK_AREAS.some((a) => {
        const ans = data.answers[a.key];
        return ans?.optionIds.includes(OTHER_ID) && ans.other.trim().length < 3;
      });
      if (missingOther) return res.status(400).json({ message: "Please describe your \"Other\" answer" });
      patch.status = "complete";
      patch.overallScore = result.overall;
      patch.resultCategory = result.category;
      if (rec.status !== "complete") {
        const answers: Record<string, string[]> = {};
        for (const a of RISK_AREAS) answers[a.key] = data.answers[a.key]?.optionIds ?? [];
        research = {
          id: randomUUID(),
          month: new Date().toISOString().slice(0, 7),
          job_search_status: JOB_SEARCH_STATUSES.includes(rec.jobSearchStatus) ? rec.jobSearchStatus : "",
          result_category: result.category,
          answers: JSON.stringify(answers),
        };
      }
    }
    const updated = riskStorage.patch(rec.id, patch)!;
    if (research) {
      try { researchStorage.add(research); } catch (e) { console.error("research insert failed", e); }
    }
    res.json(publicView(updated));
    // First completion only: email the team (never blocks or fails the submission).
    if (research) notifyCompleted(updated);
  });

  app.post("/api/risk-assessments/:id/resume", (req, res) => {
    const rec = riskStorage.get(req.params.id);
    if (!rec) return res.status(404).json({ message: "Not found" });
    const fileName = str(req.body?.fileName, 180);
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return res.status(400).json({ message: "Please upload a PDF, Word, RTF or text file" });
    const b64 = typeof req.body?.base64 === "string" ? req.body.base64 : "";
    const buf = Buffer.from(b64, "base64");
    if (!buf.length) return res.status(400).json({ message: "Empty file" });
    if (buf.length > MAX_RESUME_BYTES) return res.status(400).json({ message: "File must be 5 MB or smaller" });
    if (rec.resumeStoredName) {
      try { unlinkSync(path.join(UPLOAD_DIR, rec.resumeStoredName)); } catch {}
    }
    const stored = `${rec.id}-${randomUUID()}${ext}`;
    writeFileSync(path.join(UPLOAD_DIR, stored), buf);
    const updated = riskStorage.patch(rec.id, { resumeFileName: fileName, resumeStoredName: stored })!;
    res.json(publicView(updated));
    notifyResume(updated);
  });

  app.delete("/api/risk-assessments/:id/resume", (req, res) => {
    const rec = riskStorage.get(req.params.id);
    if (!rec) return res.status(404).json({ message: "Not found" });
    if (rec.resumeStoredName) {
      try { unlinkSync(path.join(UPLOAD_DIR, rec.resumeStoredName)); } catch {}
    }
    const updated = riskStorage.patch(rec.id, { resumeFileName: null, resumeStoredName: null })!;
    res.json(publicView(updated));
  });

  // ---- Public, anonymous research summary (feeds the embeddable chart widget) ----
  const RESEARCH_MIN = Number(process.env.RESEARCH_MIN_RESPONSES || 25);
  const PERIODS: Record<string, number | null> = { all: null, "12m": 12, "3m": 3, "1m": 1 };
  const monthsAgo = (n: number) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - (n - 1));
    return d.toISOString().slice(0, 7);
  };

  app.get("/api/research/summary", (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "public, max-age=300");
    const period = typeof req.query.period === "string" && req.query.period in PERIODS ? req.query.period : "all";
    const months = PERIODS[period];
    const demo = req.query.demo === "1";
    let rows = researchStorage.list(months ? monthsAgo(months) : undefined);
    if (demo) {
      // Deterministic sample data so the widget design can be previewed before real responses arrive.
      let seed = 7;
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      rows = Array.from({ length: 180 }, () => {
        const answers: Record<string, string[]> = {};
        for (const a of RISK_AREAS) {
          const opts = a.options;
          const pick = () => opts[Math.min(opts.length - 1, Math.floor(Math.pow(rnd(), 1.6) * opts.length))].id;
          answers[a.key] = a.multi ? Array.from(new Set([pick(), ...(rnd() > 0.5 ? [pick()] : [])])) : [pick()];
        }
        const r = rnd();
        return { month: "demo", job_search_status: JOB_SEARCH_STATUSES[Math.floor(rnd() * JOB_SEARCH_STATUSES.length)], result_category: r < 0.35 ? "aligned" : r < 0.75 ? "review" : "issue", answers: JSON.stringify(answers) };
      });
    }
    const n = rows.length;
    const ready = demo || n >= RESEARCH_MIN;
    const base = { n: ready ? n : undefined, minimum: RESEARCH_MIN, ready, demo, period, updatedAt: new Date().toISOString() };
    if (!ready) return res.json({ ...base, areas: [] });
    const parsed = rows.map((r) => { try { return JSON.parse(r.answers) as Record<string, string[]>; } catch { return {}; } });
    const pct = (c: number) => Math.round((c / n) * 1000) / 10;
    const areas = RISK_AREAS.map((a) => ({
      key: a.key,
      title: a.title,
      question: a.question.replace(/ Select all that apply\.$/, ""),
      multi: !!a.multi,
      options: a.options
        .map((o) => {
          const count = parsed.filter((p) => selectedIds({ optionIds: p[a.key] || [], other: "" }).includes(o.id)).length;
          return { id: o.id, label: o.label, count, pct: pct(count) };
        })
        .sort((x, y) => y.count - x.count),
    }));
    const results = (["aligned", "review", "issue"] as const).map((k) => {
      const count = rows.filter((r) => r.result_category === k).length;
      return { key: k, label: RESULT_COPY[k].title, count, pct: pct(count) };
    });
    const statuses = JOB_SEARCH_STATUSES.map((s2) => {
      const count = rows.filter((r) => r.job_search_status === s2).length;
      return { label: s2, count, pct: pct(count) };
    }).sort((x, y) => y.count - x.count);
    res.json({ ...base, areas, results, statuses });
  });

  // ---- Anonymous funnel events (no personal data; random per-visit id) ----
  // Funnel counting changed on Oct 7, 2026: "open" replaced "intro", and the
  // first step is now "start" (picked an answer to question 1). Earlier rows
  // are ignored so old and new definitions never mix.
  const FUNNEL_SINCE = "2026-10-07";
  const FUNNEL_STEPS = [
    "open",
    "start", "q2", "q3", "q4", "q5", "q6",
    "contact",
    "results",
    "booking_click",
    "resume_upload",
  ] as const;
  const FUNNEL_LABELS: Record<string, string> = {
    open: "Opened the assessment",
    start: "Started · answered question 1 (Employment arrangement)",
    q2: "Question 2 · References",
    q3: "Question 3 · Records and profiles",
    q4: "Question 4 · Employment dates",
    q5: "Question 5 · Job titles",
    q6: "Question 6 · Departures and gaps",
    contact: "Contact details",
    results: "Saw results",
    booking_click: "Clicked booking",
    resume_upload: "Uploaded resume",
  };
  const SOURCES = ["website", "search", "social", "email", "direct", "other"] as const;
  const SOURCE_LABELS: Record<string, string> = {
    website: "workreferences.com",
    search: "Search engines",
    social: "Social media",
    email: "Email",
    direct: "Direct or unknown",
    other: "Other websites",
  };
  const EVENT_KEYS = new Set<string>([...FUNNEL_STEPS, ...SOURCES.map((x) => `src_${x}`)]);

  app.post("/api/events", (req, res) => {
    const v = typeof req.body?.v === "string" ? req.body.v : "";
    const step = typeof req.body?.s === "string" ? req.body.s : "";
    if (/^[a-z0-9-]{8,64}$/i.test(v) && EVENT_KEYS.has(step)) {
      try { funnelStorage.add(v, step); } catch {}
    }
    res.status(204).end();
  });

  // ---- Admin (consultant) view, protected by ADMIN_PASSCODE ----
  // Header-only passcode, with a simple lockout after repeated failures per IP.
  const adminFails = new Map<string, { n: number; until: number }>();
  const adminOk = (req: any) => {
    const code = process.env.ADMIN_PASSCODE;
    const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
    const now = Date.now();
    const f = adminFails.get(ip);
    if (f && f.until > now) return false;
    const given = req.headers["x-admin-key"];
    const ok = !!code && typeof given === "string" && given === code;
    if (ok) adminFails.delete(ip);
    else {
      const n = (f && f.until > now - 15 * 60000 ? f.n : 0) + 1;
      adminFails.set(ip, { n, until: n >= 10 ? now + 15 * 60000 : 0 });
    }
    return ok;
  };

  app.get("/api/admin/funnel", (req, res) => {
    if (!adminOk(req)) return res.status(401).json({ message: "Invalid passcode" });
    const days = [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const rangeStart = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    const since = rangeStart < FUNNEL_SINCE ? FUNNEL_SINCE : rangeStart;
    const c = funnelStorage.counts(since);
    const start = c.open || 0;
    let prev = start;
    const steps = FUNNEL_STEPS.map((k) => {
      const n = c[k] || 0;
      const row = {
        key: k,
        label: FUNNEL_LABELS[k],
        visits: n,
        ofStart: start ? Math.round((n / start) * 1000) / 10 : 0,
        dropFromPrev: prev ? Math.round(((prev - n) / prev) * 1000) / 10 : 0,
      };
      if (k !== "booking_click" && k !== "resume_upload") prev = n;
      return row;
    });
    const ss = funnelStorage.sourceStarts(since);
    const sources = SOURCES.map((k) => {
      const n = c[`src_${k}`] || 0;
      const started = ss[`src_${k}`] || 0;
      return { key: k, label: SOURCE_LABELS[k], visits: n, started, startRate: n ? Math.round((started / n) * 1000) / 10 : 0 };
    });
    res.json({ days, since, countingChanged: FUNNEL_SINCE, steps, sources });
  });

  app.get("/api/admin/risk-assessments", (req, res) => {
    if (!adminOk(req)) return res.status(401).json({ message: "Invalid passcode" });
    res.json(riskStorage.list().map(publicView));
  });

  app.delete("/api/admin/risk-assessments/:id", (req, res) => {
    if (!adminOk(req)) return res.status(401).json({ message: "Invalid passcode" });
    const rec = riskStorage.get(req.params.id);
    if (!rec) return res.status(404).json({ message: "Not found" });
    if (rec.resumeStoredName) {
      try { unlinkSync(path.join(UPLOAD_DIR, path.basename(rec.resumeStoredName))); } catch {}
    }
    riskStorage.remove(rec.id);
    res.status(204).end();
  });

  app.get("/api/admin/coaching-records", (req, res) => {
    if (!adminOk(req)) return res.status(401).json({ message: "Invalid passcode" });
    res.json({ count: coachingStorage.count() });
  });

  app.delete("/api/admin/coaching-records", (req, res) => {
    if (!adminOk(req)) return res.status(401).json({ message: "Invalid passcode" });
    res.json({ removed: coachingStorage.removeAll() });
  });

  app.get("/api/admin/risk-assessments/:id/resume", (req, res) => {
    if (!adminOk(req)) return res.status(401).json({ message: "Invalid passcode" });
    const rec = riskStorage.get(req.params.id);
    if (!rec?.resumeStoredName) return res.status(404).json({ message: "No resume uploaded" });
    const full = path.join(UPLOAD_DIR, rec.resumeStoredName);
    if (!existsSync(full)) return res.status(404).json({ message: "File missing" });
    res.download(full, rec.resumeFileName || path.basename(full));
  });

  return httpServer;
}
