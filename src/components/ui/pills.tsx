import { Flame, Snowflake, Sun } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/types";

const TIER: Record<Tier, { label: string; cls: string; icon: React.ReactNode }> = {
  hot: { label: "Hot", cls: "bg-hot-bg text-hot-fg", icon: <Flame size={12} aria-hidden /> },
  warm: { label: "Warm", cls: "bg-warm-bg text-warm-fg", icon: <Sun size={12} aria-hidden /> },
  cold: { label: "Cold", cls: "bg-cold-bg text-cold-fg", icon: <Snowflake size={12} aria-hidden /> },
};

/** Tier pill: always colour plus the word, never colour alone. */
export function TierPill({ tier, className }: { tier: Tier; className?: string }) {
  const t = TIER[tier];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold", t.cls, className)}>{t.icon}{t.label}</span>;
}

export function Pill({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "accent" | "danger" | "warm" | "info" | "hot"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-fg",
    accent: "bg-accent-soft text-accent",
    danger: "bg-danger-bg text-danger-fg",
    warm: "bg-warm-bg text-warm-fg",
    hot: "bg-hot-bg text-hot-fg",
    info: "bg-info-bg text-info-fg",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

export function Avatar({ name, src, size = 28, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const initials = name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />;
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38), background: `hsl(${hue} 45% 30%)` }}
    >
      {initials}
    </span>
  );
}

/** Company logo or a monogram square. */
export function Logo({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360;
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-lg border border-line object-cover" style={{ width: size, height: size }} />;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 35% 30%)` }}
    >
      {name.replace(/[^A-Za-zÄÖÜäöü]/g, "")[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
