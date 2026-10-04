"use client";

import { Armchair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";

export function NoSeatDialog({ open, onOpenChange, message }: { open: boolean; onOpenChange: (v: boolean) => void; message: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="No seat left" description="The beta allows 5 seats per workspace.">
        <div className="flex gap-3 rounded-[10px] bg-warm-bg p-3 text-[13px] text-warm-fg">
          <Armchair size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p>{message}</p>
        </div>
        <div className="mt-4 flex justify-end">
          <DialogClose asChild>
            <Button>OK</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
