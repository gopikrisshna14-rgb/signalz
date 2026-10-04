"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-[var(--overlay)]" />
      <D.Content
        className={cn(
          "animate-fade-in fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-surface p-5",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-[16px] font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-[13px] text-muted">{description}</D.Description> : <D.Description className="sr-only">{String(title)}</D.Description>}
          </div>
          <D.Close aria-label="Close" className="rounded-md p-1 text-muted hover:bg-hover hover:text-fg">
            <X size={16} />
          </D.Close>
        </div>
        <div className="mt-4">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

/** Right-hand drawer (or left, for the mobile sidebar). */
export function SheetContent({
  title,
  children,
  side = "right",
  className,
  hideTitle,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  side?: "right" | "left";
  className?: string;
  hideTitle?: boolean;
  wide?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-[var(--overlay)]" />
      <D.Content
        className={cn(
          "fixed top-0 z-50 flex h-full flex-col border-line bg-bg",
          side === "right" ? "animate-sheet-in right-0 border-l" : "animate-sheet-in-left left-0 border-r",
          side === "right" ? (wide ? "w-full max-w-[880px]" : "w-full max-w-[560px]") : "w-[280px]",
          className,
        )}
      >
        <D.Title className={hideTitle ? "sr-only" : "px-4 pt-4 text-[16px] font-semibold"}>{title}</D.Title>
        <D.Description className="sr-only">{title}</D.Description>
        {children}
      </D.Content>
    </D.Portal>
  );
}
