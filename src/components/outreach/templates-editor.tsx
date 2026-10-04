"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { fill, TEMPLATE_VARIABLES, templateVars } from "@/lib/templates";
import { ANGLE_LABEL, type Angle, type Company, type Template } from "@/lib/types";
import { cn } from "@/lib/utils";

const ANGLES = Object.keys(ANGLE_LABEL) as Angle[];
type Key = "connectionNote" | "message" | "emailSubject" | "emailBody";

export function TemplatesEditor({ templates, sample }: { templates: Template[]; sample: Company | null }) {
  const router = useRouter();
  const [angle, setAngle] = useState<Angle>(templates[0]?.angle ?? "first_90_days");
  const current = templates.find((t) => t.angle === angle);
  const [draft, setDraft] = useState<Template | null>(current ?? null);
  const [focus, setFocus] = useState<Key>("connectionNote");
  const [pending, start] = useTransition();

  const pick = (a: Angle) => {
    setAngle(a);
    const t = templates.find((x) => x.angle === a);
    setDraft(
      t ?? { id: `tpl_${a}`, angle: a, name: ANGLE_LABEL[a], connectionNote: "Hi {{first_name}}, ", message: "Hi {{first_name}}, ", emailSubject: "", emailBody: "Hi {{first_name}},\n\n", updatedAt: new Date().toISOString() },
    );
  };
  const vars = sample ? templateVars(sample, sample.people.find((p) => p.id === sample.score?.decisionMakerId) ?? null) : null;
  const insert = (v: string) => draft && setDraft({ ...draft, [focus]: `${draft[focus]}{{${v}}}` });

  return (
    <Card>
      <CardHeader title="Templates" description="Used for openers when Claude is off or declines. Variables are filled per account." />
      <CardBody className="pt-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Angle">
          {ANGLES.map((a) => (
            <button key={a} role="tab" aria-selected={angle === a} onClick={() => pick(a)} className={cn("rounded-full border border-line px-3 py-1 text-[13px]", angle === a ? "border-accent bg-accent-soft text-accent" : "hover:bg-hover")}>
              {ANGLE_LABEL[a]}
              {!templates.some((t) => t.angle === a) ? <span className="text-muted"> (built-in)</span> : null}
            </button>
          ))}
        </div>
        {draft ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const res = await fetch("/api/templates", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
                  if (res.ok) {
                    toast.success("Template saved");
                    router.refresh();
                  } else toast.error((await res.json().catch(() => ({}))).message ?? "Could not save");
                });
              }}
            >
              <Field label="Name" htmlFor="t-name">
                <Input id="t-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="text-muted">Insert:</span>
                {TEMPLATE_VARIABLES.map((v) => (
                  <button key={v} type="button" onClick={() => insert(v)} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono hover:bg-hover">
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
              <Field label={`Connection note (${draft.connectionNote.length}/300)`} htmlFor="t-note">
                <Textarea id="t-note" value={draft.connectionNote} onFocus={() => setFocus("connectionNote")} onChange={(e) => setDraft({ ...draft, connectionNote: e.target.value })} />
              </Field>
              <Field label={`First message (${draft.message.length}/700)`} htmlFor="t-msg">
                <Textarea id="t-msg" className="min-h-28" value={draft.message} onFocus={() => setFocus("message")} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
              </Field>
              <Field label="E-mail subject" htmlFor="t-subj">
                <Input id="t-subj" value={draft.emailSubject} onFocus={() => setFocus("emailSubject")} onChange={(e) => setDraft({ ...draft, emailSubject: e.target.value })} />
              </Field>
              <Field label="E-mail body" htmlFor="t-body">
                <Textarea id="t-body" className="min-h-32" value={draft.emailBody} onFocus={() => setFocus("emailBody")} onChange={(e) => setDraft({ ...draft, emailBody: e.target.value })} />
              </Field>
              <Button type="submit" variant="primary" disabled={pending}>
                Save template
              </Button>
            </form>
            <div>
              <div className="text-[12px] font-medium text-muted">Preview{sample ? ` with ${sample.name}` : ""}</div>
              {vars ? (
                <div className="mt-2 space-y-3 text-[13px]">
                  {(["connectionNote", "message", "emailSubject", "emailBody"] as Key[]).map((k) => (
                    <pre key={k} className="rounded-[10px] bg-surface-2 p-3 font-sans leading-relaxed whitespace-pre-wrap">
                      {fill(draft[k], vars) || <span className="text-muted">empty</span>}
                    </pre>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-muted">Research an account to see a preview.</p>
              )}
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
