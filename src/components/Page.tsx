import * as React from "react";

import { cn } from "@/lib/utils";

type PageProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Page({ title, description, actions, children, className }: PageProps) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl px-4 py-6 md:px-6", className)}>
      {(title || description || actions) && (
        <div className="mb-6 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            {title ? (
              <div>
                <div className="text-xl font-semibold tracking-tight md:text-2xl">{title}</div>
                {description ? (
                  <div className="mt-1 text-sm text-muted-foreground">{description}</div>
                ) : null}
              </div>
            ) : (
              <div />
            )}
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
