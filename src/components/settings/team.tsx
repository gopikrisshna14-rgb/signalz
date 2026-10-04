"use client";

import { Copy, Link2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { NoSeatDialog } from "@/components/no-seat-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Avatar, Pill } from "@/components/ui/pills";
import { Bar } from "@/components/ui/score";
import { relativeTime, shortDate } from "@/lib/format";
import type { Invite, Role } from "@/lib/types";
import type { MemberRow } from "@/lib/workspace";

export function TeamSettings({
  orgId,
  members,
  invites,
  seatLimit,
  me,
  myRole,
}: {
  orgId: string;
  members: MemberRow[];
  invites: (Invite & { url: string })[];
  seatLimit: number;
  me: string;
  myRole: Role;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [noSeat, setNoSeat] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [seatReq, setSeatReq] = useState(false);
  const isAdmin = myRole !== "member";
  const used = members.filter((m) => m.status === "active").length;

  async function call(url: string, method: string, payload: unknown) {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === "no_seat") setNoSeat(data.message);
      else toast.error(data.message ?? "Something went wrong");
      return null;
    }
    return data;
  }

  const patch = (userId: string, p: { role?: Role; status?: "active" | "deactivated" }) =>
    start(async () => {
      if (await call(`/api/orgs/${orgId}/members`, "PATCH", { userId, ...p })) {
        toast.success("Member updated");
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Seats"
          description={`${used} of ${seatLimit} seats used`}
          action={
            <Button size="sm" onClick={() => setSeatReq(true)}>
              Request more seats
            </Button>
          }
        />
        <CardBody>
          <Bar value={(used / seatLimit) * 100} tone={used >= seatLimit ? "warm" : "accent"} />
          <p className="mt-2 text-[12px] text-muted">
            <span className="tabular">{used}</span> of <span className="tabular">{seatLimit}</span>. Deactivated members do not use a seat.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Members"
          description={isAdmin ? "Change roles, deactivate members and invite teammates." : "Only admins can change members."}
          action={
            isAdmin ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  if (used >= seatLimit) setNoSeat(`All ${seatLimit} seats are used. Deactivate a member or request more seats before inviting someone.`);
                  else {
                    setLink(null);
                    setInviteOpen(true);
                  }
                }}
              >
                <UserPlus size={14} /> Invite
              </Button>
            ) : null
          }
        />
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={m.name} src={m.image} size={32} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">
                  {m.name} {m.userId === me ? <span className="text-muted">(you)</span> : null}
                </div>
                <div className="truncate text-[12px] text-muted">
                  {m.email} · joined {shortDate(m.joinedAt)}
                </div>
              </div>
              {m.status === "deactivated" ? <Pill tone="danger">Deactivated</Pill> : null}
              {isAdmin && m.userId !== me ? (
                <div className="flex items-center gap-2">
                  <Select
                    aria-label={`Role of ${m.name}`}
                    value={m.role}
                    disabled={pending || (m.role === "owner" && myRole !== "owner")}
                    onChange={(e) => patch(m.userId, { role: e.target.value as Role })}
                    className="h-8 w-32 text-[13px]"
                  >
                    {myRole === "owner" || m.role === "owner" ? <option value="owner">Owner</option> : null}
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </Select>
                  {m.status === "active" ? (
                    <Button size="sm" variant="danger-outline" disabled={pending} onClick={() => patch(m.userId, { status: "deactivated" })}>
                      Deactivate
                    </Button>
                  ) : (
                    <Button size="sm" disabled={pending} onClick={() => patch(m.userId, { status: "active" })}>
                      Activate
                    </Button>
                  )}
                </div>
              ) : (
                <Pill>{m.role[0].toUpperCase() + m.role.slice(1)}</Pill>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {isAdmin && invites.length ? (
        <Card>
          <CardHeader title="Open invites" description="Links expire after 14 days." />
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {invites.map((i) => (
              <li key={i.token} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                <Link2 size={14} className="text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  {i.email} · {i.role} · expires {relativeTime(i.expiresAt).replace(" ago", "")}
                </span>
                <Button size="sm" onClick={() => navigator.clipboard.writeText(i.url).then(() => toast.success("Invite link copied"))}>
                  <Copy size={14} /> Copy link
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Revoke invite for ${i.email}`}
                  onClick={() =>
                    start(async () => {
                      if (await call("/api/invites", "DELETE", { token: i.token })) router.refresh();
                    })
                  }
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent title="Invite a teammate" description="We create a link you can copy and send yourself.">
          {link ? (
            <div className="space-y-3">
              <Input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="primary" className="w-full" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Invite link copied"))}>
                <Copy size={14} /> Copy invite link
              </Button>
            </div>
          ) : (
            <form
              className="space-y-3"
              action={(f) =>
                start(async () => {
                  const r = await call("/api/invites", "POST", { email: f.get("email"), role: f.get("role") });
                  if (r) {
                    setLink(r.invite.url);
                    router.refresh();
                  }
                })
              }
            >
              <Field label="E-mail" htmlFor="invite-email">
                <Input id="invite-email" name="email" type="email" required />
              </Field>
              <Field label="Role" htmlFor="invite-role">
                <Select id="invite-role" name="role" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
              <Button type="submit" variant="primary" className="w-full" disabled={pending}>
                Create invite link
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={seatReq} onOpenChange={setSeatReq}>
        <DialogContent title="Request more seats" description="The beta is limited to 5 seats per workspace.">
          <p className="text-[13px] text-muted">More seats come with the paid plan after the beta. Until then, deactivate members who no longer need access to free a seat.</p>
          <Button className="mt-4 w-full" onClick={() => setSeatReq(false)}>
            Got it
          </Button>
        </DialogContent>
      </Dialog>
      <NoSeatDialog open={noSeat !== null} onOpenChange={(v) => !v && setNoSeat(null)} message={noSeat ?? ""} />
    </div>
  );
}
