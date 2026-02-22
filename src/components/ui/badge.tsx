import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide backdrop-blur-md",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-primary/15 text-primary",
        secondary: "border-white/10 bg-secondary/55 text-secondary-foreground",
        destructive: "border-white/10 bg-destructive/18 text-destructive",
        outline: "border-white/10 bg-card/25 text-foreground/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
