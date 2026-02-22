import { cn } from "@/lib/utils";

export function MiniSparkline({
  values,
  width = 120,
  height = 32,
  className,
}: {
  values: Array<number | null | undefined>;
  width?: number;
  height?: number;
  className?: string;
}) {
  const pts = values
    .map((v, i) => ({ i, v: typeof v === "number" ? v : null }))
    .filter((p) => p.v != null) as Array<{ i: number; v: number }>;

  if (pts.length < 2) {
    return <div className={cn("rounded-xl border border-white/10 bg-card/20", className)} style={{ width, height }} />;
  }

  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = Math.max(1e-6, max - min);

  const toX = (i: number) => (i / (values.length - 1)) * width;
  const toY = (v: number) => height - ((v - min) / span) * height;

  const d = pts
    .map((p, idx) => {
      const x = toX(p.i);
      const y = toY(p.v);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)}>
      <path d={d} fill="none" stroke="hsla(146,70%,58%,0.9)" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
