export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-label="WorkReferences"
      role="img"
    >
      <rect x="1" y="1" width="38" height="38" rx="10" fill="currentColor" className="text-primary" />
      <path
        d="M12 20.5L17.2 25.7L28 14.9"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="font-display font-semibold text-lg tracking-tight text-foreground">
        WorkReferences
      </span>
    </div>
  );
}
