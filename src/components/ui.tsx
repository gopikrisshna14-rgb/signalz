import * as React from "react";
import { cn, initials } from "@/lib/format";
import type { Tier } from "@/lib/types";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-accent text-accent-fg hover:opacity-90",
        variant === "secondary" && "border border-line bg-surface hover:bg-surface-2",
        variant === "ghost" && "hover:bg-surface-2",
        variant === "danger" && "bg-danger-bg text-danger-fg hover:opacity-90",
        className,
      )}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("rounded-xl border border-line bg-surface", className)} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-muted focus:border-accent focus:outline-none",
        className,
      )}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={cn("mb-1.5 block text-[13px] font-medium", className)} />;
}

const TIER_STYLE: Record<Tier, string> = {
  hot: "bg-hot-bg text-hot-fg",
  warm: "bg-warm-bg text-warm-fg",
  cold: "bg-cold-bg text-cold-fg",
};

export function TierPill({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-1.5 text-[12px] font-semibold capitalize",
        TIER_STYLE[tier],
        className,
      )}
    >
      {tier}
    </span>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md bg-surface-2 px-1.5 text-[12px] font-medium text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Avatar({ name, src, size = 28 }: { name: string | null; src?: string | null; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function CompanyLogo({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-lg border border-line object-cover" />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 font-semibold text-muted"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
