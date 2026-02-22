import { cn } from "@/lib/utils";

export type Segment<T extends string> = {
  id: T;
  label: string;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  segments,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  segments: Array<Segment<T>>;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-2xl border border-white/10 bg-card/25 p-1 backdrop-blur-xl", className)}>
      {segments.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-semibold transition",
              active ? "bg-card/55 text-foreground ab-glow-river" : "text-muted-foreground hover:bg-card/35 hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
