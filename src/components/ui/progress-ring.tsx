import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  size = 96,
  stroke = 10,
  label,
  pulse = false,
  className,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  label?: string;
  pulse?: boolean;
  className?: string;
}) {
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v);

  return (
    <div className={cn("relative inline-flex items-center justify-center", pulse && "animate-pulse", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke="hsla(0,0%,100%,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="transparent"
          stroke="hsl(var(--glowRiver) / 0.9)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          style={{ filter: "drop-shadow(0 0 12px hsla(196,70%,60%,0.25))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-lg font-semibold tabular-nums">{Math.round(v * 100)}%</div>
        {label ? <div className="text-[11px] text-muted-foreground">{label}</div> : null}
      </div>
    </div>
  );
}
