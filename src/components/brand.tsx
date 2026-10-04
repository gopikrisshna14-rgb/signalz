import { cn } from "@/lib/utils";

export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full bg-accent", className)} style={{ width: size, height: size }} aria-hidden>
      <span className="rounded-full bg-[#facc15]" style={{ width: size * 0.32, height: size * 0.32 }} />
      <span className="absolute inset-[3px] rounded-full border-2 border-white/40" />
    </span>
  );
}

export function BetaBadge() {
  return <span className="rounded-full bg-sun-soft px-1.5 py-px text-[11px] font-semibold text-sun-ink">Beta</span>;
}

export function Brand({ beta = true }: { beta?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <BrandMark />
      <span className="text-[15px] font-semibold tracking-tight">Signalz</span>
      {beta ? <BetaBadge /> : null}
    </span>
  );
}
