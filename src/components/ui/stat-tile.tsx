import { cn } from "@/lib/utils";
import { MiniSparkline } from "@/components/ui/mini-sparkline";

export function StatTile({
  label,
  value,
  sub,
  accent = "leaf",
  trend,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "leaf" | "river" | "sun";
  trend?: Array<number | null>;
  className?: string;
}) {
  const glow = accent === "river" ? "ab-glow-river" : accent === "sun" ? "" : "ab-glow-leaf";

  return (
    <div className={cn("rounded-2xl border border-white/10 bg-card/35 p-4 backdrop-blur-xl", glow, className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
          {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
        </div>
        {trend ? <MiniSparkline values={trend} /> : null}
      </div>
    </div>
  );
}
