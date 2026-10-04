"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";

async function send(url: string, method: string, payload: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast.error(data.message ?? "Something went wrong");
    return null;
  }
  return data;
}

export function ProfileSettings({ name, email, timezone }: { name: string; email: string; timezone: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["Europe/Berlin"];
  const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <Card>
      <CardHeader title="Profile" description="How teammates see you on claims and outreach." />
      <CardBody>
        <form
          className="grid max-w-lg gap-3"
          action={(f) =>
            start(async () => {
              if (await send("/api/me", "PATCH", { name: f.get("name"), timezone: f.get("timezone") })) {
                toast.success("Profile saved");
                router.refresh();
              }
            })
          }
        >
          <Field label="Name" htmlFor="p-name">
            <Input id="p-name" name="name" defaultValue={name} required />
          </Field>
          <Field label="E-mail" htmlFor="p-email">
            <Input id="p-email" value={email} readOnly disabled />
          </Field>
          <Field label="Time zone" htmlFor="p-tz" hint="Used for the reply-time heatmap on Outreach.">
            <Select id="p-tz" name="timezone" defaultValue={timezone ?? guess}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <Button type="submit" variant="primary" disabled={pending}>
              Save
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function WorkspaceSettings({
  org,
  isAdmin,
}: {
  org: { id: string; name: string; emailDomain: string | null; autoJoin: boolean; seatLimit: number; createdAt: string };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Workspace" description={isAdmin ? "Name, ID and who can join automatically." : "Only admins can change these."} />
      <CardBody>
        <form
          className="grid max-w-lg gap-3"
          action={(f) =>
            start(async () => {
              const domain = String(f.get("emailDomain") || "").trim();
              if (await send("/api/orgs", "PATCH", { name: f.get("name"), emailDomain: domain || null, autoJoin: f.get("autoJoin") === "on" })) {
                toast.success("Workspace saved");
                router.refresh();
              }
            })
          }
        >
          <Field label="Name" htmlFor="w-name">
            <Input id="w-name" name="name" defaultValue={org.name} disabled={!isAdmin} required minLength={2} />
          </Field>
          <Field label="Workspace ID" htmlFor="w-id">
            <div className="flex gap-2">
              <Input id="w-id" value={org.id} readOnly className="font-mono text-[13px]" />
              <Button type="button" size="md" aria-label="Copy workspace ID" onClick={() => navigator.clipboard.writeText(org.id).then(() => toast.success("Copied"))}>
                <Copy size={14} />
              </Button>
            </div>
          </Field>
          <Field label="Auto-join domain" htmlFor="w-domain" hint="Anyone signing up with this e-mail domain can join (seat limit applies).">
            <Input id="w-domain" name="emailDomain" defaultValue={org.emailDomain ?? ""} placeholder="company.com" disabled={!isAdmin} />
          </Field>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="autoJoin" defaultChecked={org.autoJoin} disabled={!isAdmin} className="size-4 accent-[var(--accent)]" /> Auto-join enabled
          </label>
          {isAdmin ? (
            <div>
              <Button type="submit" variant="primary" disabled={pending}>
                Save
              </Button>
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}

export function DangerZone({ orgName, isOwner }: { orgName: string; isOwner: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <Card className="border-danger-fg/40">
      <CardHeader title="Danger zone" description="Deleting the workspace removes all accounts, research, outreach and settings. This cannot be undone." />
      <CardBody>
        {isOwner ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger-outline">Delete workspace</Button>
            </DialogTrigger>
            <DialogContent title={`Delete ${orgName}?`} description="Type the workspace name to confirm.">
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Workspace name" placeholder={orgName} />
              <Button
                className="mt-4 w-full"
                variant="danger"
                disabled={confirm !== orgName || pending}
                onClick={() =>
                  start(async () => {
                    if (await send("/api/orgs", "DELETE", { confirm })) {
                      toast.success("Workspace deleted");
                      router.push("/onboarding");
                      router.refresh();
                    }
                  })
                }
              >
                Delete forever
              </Button>
            </DialogContent>
          </Dialog>
        ) : (
          <p className="text-[13px] text-muted">Only the owner can delete the workspace.</p>
        )}
      </CardBody>
    </Card>
  );
}
