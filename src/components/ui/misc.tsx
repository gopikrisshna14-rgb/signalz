"use client";

import { Slider as S, Switch as Sw, Tabs as T } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function Switch({ checked, onCheckedChange, label, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Sw.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full border border-line bg-surface-2 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent"
      >
        <Sw.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[17px] dark:bg-fg dark:data-[state=checked]:bg-accent-fg" />
      </Sw.Root>
      <label htmlFor={id} className="cursor-pointer text-[13px]">
        {label}
      </label>
    </span>
  );
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string }) {
  return (
    <S.Root value={[value]} onValueChange={(v) => onChange(v[0])} min={min} max={max} step={step} className="relative flex h-5 w-full touch-none items-center select-none">
      <S.Track className="relative h-1.5 grow rounded-full bg-surface-2">
        <S.Range className="absolute h-full rounded-full bg-accent" />
      </S.Track>
      <S.Thumb aria-label={label} className="block size-4 rounded-full border-2 border-accent bg-surface focus-visible:outline-2 focus-visible:outline-accent" />
    </S.Root>
  );
}

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <T.List className={cn("flex gap-1 overflow-x-auto border-b border-line", className)}>{children}</T.List>;
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <T.Trigger
      value={value}
      className="-mb-px shrink-0 border-b-2 border-transparent px-3 py-2 text-[13px] font-medium whitespace-nowrap text-muted transition-colors hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg"
    >
      {children}
    </T.Trigger>
  );
}
