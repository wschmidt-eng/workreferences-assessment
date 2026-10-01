import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useAssessment } from "@/hooks/use-assessment";
import { Wordmark } from "@/components/logo";
import { RiskBadge, ScoreDial } from "@/components/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildReportPayload } from "@/lib/buildReport";
import { computeScores } from "@/lib/scoring";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, CheckCircle2 } from "lucide-react";

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { loading, record, data, setData, save, saving } = useAssessment(id);
  const [downloading, setDownloading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loading || saved || !record) return;
    const scores = computeScores(data);
    const report = buildReportPayload(record.clientName, data);
    const nextData = { ...data, scores, report };
    setData(() => nextData);
    (async () => {
      await save({
        overallRiskScore: scores.overall,
        riskBand: scores.band,
        status: "report_ready",
        dataOverride: nextData,
      });
      setSaved(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, record, saved]);

  if (loading || !data.report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const report = data.report;

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await apiRequest("GET", `/api/assessments/${id}/pdf`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `WorkReferences_Reference_Prep_Report_${(record?.clientName || "Client").replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Couldn't download the PDF", description: "Please try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/coaching"><Wordmark /></Link>
          <Button onClick={handleDownload} disabled={downloading || !saved} data-testid="button-download-pdf">
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <section className="text-center">
          <p className="text-xs font-medium text-primary uppercase tracking-wide">Reference Preparation Report</p>
          <h1 className="text-2xl font-display font-semibold text-foreground mt-2" data-testid="text-client-name">
            {report.clientName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Target role: {report.targetJobTitle} &middot; Generated {report.generatedDate}
          </p>
        </section>

        <section className="flex flex-col items-center gap-3">
          <ScoreDial score={report.overall.score} band={report.overall.band} />
          <RiskBadge level={report.overall.band} />
          <p className="text-sm text-muted-foreground text-center max-w-md">{report.overall.summaryNote}</p>
        </section>

        <section>
          <h2 className="text-sm font-medium text-foreground mb-3">Score Breakdown</h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              {report.overall.breakdown.map((b) => (
                <div key={b.key}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-foreground">{b.label}</span>
                    <span className="text-muted-foreground">{b.score} / {b.max}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(b.score / b.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-sm font-medium text-foreground mb-3">Positions Most Likely to Require Verification</h2>
          <div className="space-y-3">
            {report.positions.map((p, i) => (
              <Card key={i}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.jobTitle} — {p.employer}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.dates}</p>
                    </div>
                    <RiskBadge level={p.riskLevel} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Risk factors</p>
                      <ul className="space-y-1">
                        {p.riskFactors.map((f, j) => (
                          <li key={j} className="text-xs text-foreground">• {f}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Mitigation</p>
                      <ul className="space-y-1">
                        {p.mitigation.map((f, j) => (
                          <li key={j} className="text-xs text-foreground">• {f}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-foreground mb-3">Reference Strategy</h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Primary references</p>
                <div className="space-y-2">
                  {report.referenceStrategy.primary.map((r, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium text-foreground">{r.name}</span>
                      <span className="text-muted-foreground"> — {r.relationship}</span>
                    </div>
                  ))}
                </div>
              </div>
              {report.referenceStrategy.backup.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Backup references</p>
                  <div className="space-y-2">
                    {report.referenceStrategy.backup.map((r, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium text-foreground">{r.name}</span>
                        <span className="text-muted-foreground"> — {r.relationship}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {report.discrepancies.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-foreground mb-3">Verification & Consistency Audit</h2>
            <Card>
              <CardContent className="pt-6 space-y-3">
                {report.discrepancies.map((d, i) => (
                  <div key={i} className="border-b border-border last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{d.field}</p>
                      <RiskBadge level={d.riskLevel} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Resume: {d.resume} &middot; LinkedIn: {d.linkedin}</p>
                    <p className="text-xs text-foreground mt-1">{d.recommendation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}

        {report.talkingPoints.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-foreground mb-3">Reference Question Talking Points</h2>
            <div className="space-y-3">
              {report.talkingPoints.map((g, i) => (
                <Card key={i}>
                  <CardContent className="pt-5">
                    <p className="text-sm font-medium text-foreground mb-2">{g.position}</p>
                    <div className="space-y-2">
                      {g.items.map((it, j) => (
                        <div key={j} className="text-sm">
                          <span className="text-primary font-medium">{it.category}: </span>
                          <span className="text-foreground">{it.answer}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-medium text-foreground mb-3">Pre-Reference-Check Checklist</h2>
          <Card>
            <CardContent className="pt-6 space-y-2.5">
              {report.checklist.map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span>{c}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <p className="text-xs text-muted-foreground text-center pt-4">
          WorkReferences provides structured, professional reference representation and HR verification.
          We do not provide falsified documents, fake diplomas, or illegal identities. All services are
          100% legal, confidential, and designed to withstand strict corporate HR and third-party
          background-check scrutiny.
        </p>
      </main>
    </div>
  );
}
