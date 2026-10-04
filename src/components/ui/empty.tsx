import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, text, action, className }: { icon?: React.ReactNode; title: string; text?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-10 text-center", className)}>
      {icon ? <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent">{icon}</div> : null}
      <h3 className="text-[14px] font-semibold">{title}</h3>
      {text ? <p className="mt-1 max-w-sm text-[13px] text-muted">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
