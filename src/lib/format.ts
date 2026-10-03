import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the theme's colour tokens so a later "bg-accent-soft" replaces "bg-surface-2".
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "bg", "surface", "surface-2", "line", "fg", "muted", "accent", "accent-fg", "accent-soft",
        "hot-bg", "hot-fg", "warm-bg", "warm-fg", "cold-bg", "cold-fg", "danger-bg", "danger-fg",
        "ok", "orange", "chart-1", "chart-2", "chart-3",
      ],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function errorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  const known: Record<string, string> = {
    claimed_by_other: "Another SDR already owns this account.",
    not_owner: "Only the owner or an admin can release this account.",
    seat_limit_reached: "No seat left in this workspace. Ask an admin to add seats.",
    forbidden: "Only workspace admins can do this.",
  };
  for (const [k, v] of Object.entries(known)) if (msg.includes(k)) return v;
  if (msg.includes("organizations_slug_key")) return "That workspace URL is taken. Try another.";
  return msg;
}
