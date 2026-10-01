import type { RiskLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<RiskLevel, string> = {
  Low: "bg-primary/10 text-primary border-primary/20",
  Moderate: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  High: "bg-destructive/10 text-destructive border-destructive/20",
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STYLES[level],
        className
      )}
      data-testid={`risk-badge-${level.toLowerCase()}`}
    >
      {level} Risk
    </span>
  );
}

export function ScoreDial({ score, band, color }: { score: number; band: RiskLevel; color?: string }) {
  const circumference = 2 * Math.PI * 54;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dashoffset = circumference * (1 - pct);
  const strokeColor = color ??
    (band === "Low" ? "hsl(var(--primary))" : band === "Moderate" ? "#D97706" : "hsl(var(--destructive))");

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
        <circle
          cx="70"
          cy="70"
          r="54"
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-display font-semibold text-foreground" data-testid="text-overall-score">
          {score}
        </span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
