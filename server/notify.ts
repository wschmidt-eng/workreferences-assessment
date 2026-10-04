import nodemailer from "nodemailer";
import type { RiskAssessment } from "@shared/schema";
import { computeResult, RESULT_COPY, type Flag } from "@shared/riskAreas";

// Email alerts to the WorkReferences team when an assessment is completed or a
// resume is uploaded. Sent through an SMTP mailbox (Google Workspace by default).
// If SMTP_USER, SMTP_PASS or NOTIFY_EMAIL_TO is missing, alerts are skipped.

const FLAG_LABEL: Record<Flag, string> = {
  green: "Aligned",
  yellow: "Worth reviewing",
  red: "Priority to prepare",
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let warned = false;

function config() {
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const to = process.env.NOTIFY_EMAIL_TO || "";
  if (!user || !pass || !to) return null;
  const port = Number(process.env.SMTP_PORT || 465);
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    user,
    pass: pass.replace(/\s+/g, ""), // Google shows app passwords in groups of four
    to,
    from: process.env.NOTIFY_EMAIL_FROM || `WorkReferences Assessment <${user}>`,
    appUrl: (process.env.APP_URL || "https://assessment.workreferences.com").replace(/\/+$/, ""),
  };
}

export function notificationsEnabled(): boolean {
  return !!config();
}

function getTransport(c: NonNullable<ReturnType<typeof config>>) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: { user: c.user, pass: c.pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fullName(r: RiskAssessment) {
  return `${r.firstName} ${r.lastName}`.trim() || r.email;
}

function warnOff() {
  if (!warned) {
    console.log("email alerts off: set SMTP_USER, SMTP_PASS and NOTIFY_EMAIL_TO to turn them on");
    warned = true;
  }
}

async function send(subject: string, text: string, html: string, replyTo?: string) {
  const c = config();
  if (!c) return warnOff(), false;
  try {
    await getTransport(c).sendMail({ from: c.from, to: c.to, replyTo, subject, text, html });
    return true;
  } catch (e: any) {
    // Never log submission details; the reason is enough to troubleshoot.
    console.error("email alert failed:", e?.code || "", e?.responseCode || "", e?.message || e);
    return false;
  }
}

function shell(title: string, body: string, c: NonNullable<ReturnType<typeof config>>) {
  return `<!doctype html><html><body style="margin:0;background:#F3FAF5;font-family:Arial,Helvetica,sans-serif;color:#1F2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3FAF5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #E5E7EB;border-radius:10px">
<tr><td style="background:#16A34A;color:#ffffff;padding:16px 24px;border-radius:10px 10px 0 0;font-size:16px;font-weight:bold">WorkReferences &middot; ${esc(title)}</td></tr>
<tr><td style="padding:20px 24px;font-size:14px;line-height:1.5">${body}
<p style="margin:24px 0 0"><a href="${esc(c.appUrl)}/#/admin" style="background:#16A34A;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block;font-weight:bold">Open the consultant view</a></p>
</td></tr>
<tr><td style="padding:12px 24px;font-size:12px;color:#6B7280;border-top:1px solid #E5E7EB">Sent automatically by the Free Reference Risk Assessment. Contains personal information. Please don't forward it outside WorkReferences.</td></tr>
</table></td></tr></table></body></html>`;
}

function row(label: string, value: string) {
  return `<tr><td style="padding:4px 12px 4px 0;color:#6B7280;white-space:nowrap;vertical-align:top">${esc(label)}</td><td style="padding:4px 0">${esc(value || "—")}</td></tr>`;
}

export function notifyCompleted(rec: RiskAssessment) {
  const c = config();
  if (!c) return warnOff();
  let data: any = {};
  try { data = JSON.parse(rec.data || "{}"); } catch {}
  const result = computeResult(data.answers || {});
  const cat = RESULT_COPY[result.category];
  const name = fullName(rec);
  const top = [...result.areas].filter((a) => a.flag !== "green").sort((a, b) => b.score - a.score).slice(0, 3);
  const resultsUrl = `${c.appUrl}/#/free-assessment/${rec.id}/results`;
  const positions: any[] = Array.isArray(data.positions) ? data.positions : [];

  const subject = `New assessment: ${name} · ${result.overall}/100 · ${cat.title}`;

  const text = [
    `New Free Reference Risk Assessment completed`,
    ``,
    `Name: ${name}`,
    `Email: ${rec.email}`,
    `Phone: ${rec.phone || "—"}`,
    `Job-search status: ${rec.jobSearchStatus || "—"}`,
    `Target role: ${rec.targetRole || "—"}`,
    `Score: ${result.overall}/100 (${cat.title})`,
    `Resume: ${rec.resumeFileName ? rec.resumeFileName : "Not uploaded yet"}`,
    ``,
    `Top areas to prepare:`,
    ...(top.length ? top.map((a, i) => `${i + 1}. ${a.title} (${FLAG_LABEL[a.flag]})`) : ["None. All six areas are aligned."]),
    ``,
    `All six areas:`,
    ...result.areas.map((a) => `${a.number}. ${a.title} [${FLAG_LABEL[a.flag]}]: ${a.answerLabel}`),
    ...(positions.length
      ? ["", "Positions:", ...positions.map((p) => `- ${p.employer || "—"}, ${p.title || "—"}${p.start || p.end || p.current ? ` (${p.start || "?"} to ${p.current ? "present" : p.end || "?"})` : ""}`)]
      : []),
    ``,
    `Their results page: ${resultsUrl}`,
    `Consultant view: ${c.appUrl}/#/admin`,
    ``,
    `Reply to this email to write to ${rec.firstName || "them"} directly.`,
  ].join("\n");

  const html = shell(
    "New assessment",
    `<p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:#111827">${esc(name)} completed the assessment</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">
${row("Email", rec.email)}${row("Phone", rec.phone)}${row("Job-search status", rec.jobSearchStatus)}${row("Target role", rec.targetRole)}
${row("Score", `${result.overall}/100 · ${cat.title}`)}${row("Resume", rec.resumeFileName || "Not uploaded yet")}
</table>
<p style="margin:18px 0 6px;font-weight:bold;color:#111827">Top areas to prepare</p>
${top.length ? `<ol style="margin:0;padding-left:20px">${top.map((a) => `<li>${esc(a.title)} <span style="color:#6B7280">(${FLAG_LABEL[a.flag]})</span></li>`).join("")}</ol>` : `<p style="margin:0">None. All six areas are aligned.</p>`}
<p style="margin:18px 0 6px;font-weight:bold;color:#111827">All six areas</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px;width:100%">
${result.areas
  .map(
    (a) =>
      `<tr><td style="padding:6px 0;border-top:1px solid #F3F4F6;vertical-align:top"><b>${a.number}. ${esc(a.title)}</b> <span style="color:#6B7280">· ${FLAG_LABEL[a.flag]}</span><br>${esc(a.answerLabel)}</td></tr>`
  )
  .join("")}
</table>
${
  positions.length
    ? `<p style="margin:18px 0 6px;font-weight:bold;color:#111827">Positions</p><ul style="margin:0;padding-left:20px">${positions
        .map((p) => `<li>${esc(p.employer || "—")}, ${esc(p.title || "—")}${p.start || p.end || p.current ? ` <span style="color:#6B7280">(${esc(p.start || "?")} to ${p.current ? "present" : esc(p.end || "?")})</span>` : ""}</li>`)
        .join("")}</ul>`
    : ""
}
<p style="margin:18px 0 0"><a href="${esc(resultsUrl)}" style="color:#0F7A35">View their results page</a> &middot; Reply to this email to write to ${esc(rec.firstName || "them")} directly.</p>`,
    c
  );

  void send(subject, text, html, rec.email);
}

export function notifyResume(rec: RiskAssessment) {
  const c = config();
  if (!c) return warnOff();
  const name = fullName(rec);
  const subject = `Resume uploaded: ${name}`;
  const text = [
    `${name} uploaded a resume after their assessment.`,
    ``,
    `File: ${rec.resumeFileName || "resume"}`,
    `Email: ${rec.email}`,
    `Phone: ${rec.phone || "—"}`,
    rec.overallScore != null ? `Score: ${rec.overallScore}/100` : ``,
    ``,
    `Download it from the consultant view: ${c.appUrl}/#/admin`,
  ]
    .filter((l, i, arr) => l !== "" || arr[i - 1] !== "")
    .join("\n");
  const html = shell(
    "Resume uploaded",
    `<p style="margin:0 0 12px;font-size:18px;font-weight:bold;color:#111827">${esc(name)} uploaded a resume</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">
${row("File", rec.resumeFileName || "resume")}${row("Email", rec.email)}${row("Phone", rec.phone)}${rec.overallScore != null ? row("Score", `${rec.overallScore}/100`) : ""}
</table>
<p style="margin:16px 0 0">For privacy, the file isn't attached. Download it from the consultant view.</p>`,
    c
  );
  void send(subject, text, html, rec.email);
}
