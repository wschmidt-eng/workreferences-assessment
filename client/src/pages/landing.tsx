import { useState } from "react";
import { useLocation } from "wouter";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ListChecks, MessagesSquare, ScanSearch, PlayCircle, Loader2 } from "lucide-react";

const SESSIONS = [
  { icon: ShieldCheck, title: "Reference Risk Assessment", desc: "Map employment history and flag anything that could raise questions." },
  { icon: ListChecks, title: "Reference Selection & Strategy", desc: "Choose the strongest references and cover every position." },
  { icon: MessagesSquare, title: "Question Preparation", desc: "Prepare clear, confident answers to likely reference questions." },
  { icon: ScanSearch, title: "Verification & Consistency Audit", desc: "Check resume vs. LinkedIn for anything that doesn't line up." },
  { icon: PlayCircle, title: "Reference Check Simulation", desc: "Practice live and get scored, specific feedback." },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [clientName, setClientName] = useState("");
  const [targetJobTitle, setTargetJobTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [resumeId, setResumeId] = useState("");

  async function handleStart() {
    if (!clientName.trim()) {
      toast({ title: "Client name is required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await apiRequest("POST", "/api/assessments", {
        clientName: clientName.trim(),
        targetJobTitle: targetJobTitle.trim(),
      });
      const json = await res.json();
      setLocation(`/assessment/${json.id}/session/1`);
    } catch (e) {
      toast({ title: "Couldn't start assessment", description: "Please try again.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  function handleResume() {
    if (!resumeId.trim()) return;
    setLocation(`/assessment/${resumeId.trim()}/session/1`);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Wordmark />
          <span className="text-xs text-muted-foreground hidden sm:block">References That Work!</span>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-14 pb-10 text-center">
        <p className="text-xs font-medium text-primary uppercase tracking-wide mb-3">
          Reference Readiness Coaching Course
        </p>
        <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground leading-tight">
          Know your Reference Risk before a recruiter finds it first.
        </h1>
        <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          A guided, five-session walkthrough that scores employment reference risk from 0–100
          and builds a personalized Reference Preparation Report — the same structured process
          WorkReferences strategists use with clients.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-10">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="clientName">Client full name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Jordan Michaels"
                className="mt-1.5"
                data-testid="input-client-name"
              />
            </div>
            <div>
              <Label htmlFor="targetJobTitle">Target job title (optional)</Label>
              <Input
                id="targetJobTitle"
                value={targetJobTitle}
                onChange={(e) => setTargetJobTitle(e.target.value)}
                placeholder="e.g. Senior Operations Manager"
                className="mt-1.5"
                data-testid="input-target-job-title"
              />
            </div>
            <Button
              onClick={handleStart}
              disabled={creating}
              className="w-full h-auto min-h-10 whitespace-normal py-2.5 text-center leading-snug"
              size="lg"
              data-testid="button-start-assessment"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
              Start Session 1: Reference Risk Assessment
            </Button>
          </CardContent>
        </Card>

        <div className="mt-4 flex items-center gap-2">
          <Input
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
            placeholder="Paste an assessment ID to resume a saved session"
            className="text-sm"
            data-testid="input-resume-id"
          />
          <Button variant="outline" onClick={handleResume} data-testid="button-resume">
            Resume
          </Button>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
          The five sessions
        </p>
        <div className="space-y-3">
          {SESSIONS.map((s, i) => (
            <div key={s.title} className="flex items-start gap-3 rounded-md border border-border p-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-xs text-muted-foreground">
          WorkReferences provides structured, professional reference representation and HR verification.
          We do not provide falsified documents, fake diplomas, or illegal identities. All services are
          100% legal, confidential, and designed to withstand strict corporate HR and third-party
          background-check scrutiny.
        </div>
      </footer>
    </div>
  );
}
