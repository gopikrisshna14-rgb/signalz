"use client";

import { parseAsString, useQueryState } from "nuqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import type { Invite, Org, Role } from "@/lib/types";
import type { MemberRow } from "@/lib/workspace";
import { DangerZone, ProfileSettings, WorkspaceSettings } from "./general";
import { TeamSettings } from "./team";

export interface SettingsProps {
  me: { id: string; name: string; email: string; timezone: string | null };
  org: Org;
  role: Role;
  members: MemberRow[];
  invites: (Invite & { url: string })[];
}

export function SettingsView(p: SettingsProps) {
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("profile"));
  const isAdmin = p.role !== "member";
  return (
    <div>
      <h1 className="text-[20px] font-semibold">Settings</h1>
      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="team">Team &amp; seats</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>
        <div className="mt-5 max-w-4xl">
          <TabsContent value="profile">
            <ProfileSettings name={p.me.name} email={p.me.email} timezone={p.me.timezone} />
          </TabsContent>
          <TabsContent value="workspace">
            <WorkspaceSettings org={p.org} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="team">
            <TeamSettings orgId={p.org.id} members={p.members} invites={p.invites} seatLimit={p.org.seatLimit} me={p.me.id} myRole={p.role} />
          </TabsContent>
          <TabsContent value="danger">
            <DangerZone orgName={p.org.name} isOwner={p.role === "owner"} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
