"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";

export async function submitResearch(text: string): Promise<{ ok: boolean; message: string }> {
  const urls = text
    .split(/[\s,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
  if (!urls.length) return { ok: false, message: "Paste at least one LinkedIn URL" };
  if (urls.length > 25) return { ok: false, message: "At most 25 URLs at a time" };
  const res = await fetch("/api/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ urls }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: data.message ?? "Could not start research" };
  const skipped = data.invalid?.length ? ` (${data.invalid.length} skipped: not a LinkedIn person or company URL)` : "";
  return { ok: true, message: `Researching ${data.created.length} URL${data.created.length === 1 ? "" : "s"}${skipped}` };
}

export function ResearchDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (open) {
      setText(initial);
      setError(null);
    }
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Research a LinkedIn URL" description="A person (linkedin.com/in/…) or a company (linkedin.com/company/…). One per line, up to 25.">
        <form
          action={() =>
            start(async () => {
              const r = await submitResearch(text);
              if (!r.ok) return setError(r.message);
              toast.success(r.message);
              onOpenChange(false);
              router.push("/research");
              router.refresh();
            })
          }
        >
          <Textarea
            aria-label="LinkedIn URLs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"https://www.linkedin.com/in/jonas-weber\nhttps://www.linkedin.com/company/laufwerk-sneakers"}
            className="min-h-28 font-mono text-[13px]"
            autoFocus
          />
          {error ? (
            <p role="alert" className="mt-2 text-[13px] text-danger-fg">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Starting…" : "Start research"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
