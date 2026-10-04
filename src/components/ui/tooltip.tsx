"use client";

import { Popover as P, Tooltip as T } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <T.Provider delayDuration={250}>{children}</T.Provider>;
}

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="animate-fade-in z-[60] max-w-72 rounded-lg bg-fg px-2.5 py-1.5 text-[12px] text-bg">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;

export function PopoverContent({ children, className, align = "start", side }: { children: React.ReactNode; className?: string; align?: "start" | "center" | "end"; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <P.Portal>
      <P.Content align={align} side={side} sideOffset={6} className={cn("animate-fade-in z-[55] w-72 rounded-xl border border-line bg-surface p-3 shadow-lg shadow-black/5", className)}>
        {children}
      </P.Content>
    </P.Portal>
  );
}
