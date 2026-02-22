import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted/40",
        "bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.10)_50%,rgba(255,255,255,0.04)_100%)]",
        "bg-[length:200%_100%] animate-ab-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
