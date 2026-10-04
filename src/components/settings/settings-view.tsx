"use client";

import { parseAsString, useQueryState } from "nuqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import type { AuditEntry, Invite, Org, Role, Scan, Settings } from "@/lib/types";
import type { MemberRow } from "@/lib/workspace";
import { DangerZone, ProfileSettings, WorkspaceSettings } from "./general";
import { IcpSettings } from "./icp";
import { AuditLog, IntegrationsSettings, ScansSettings, SourcesSettings, type HubspotStatus, type SourceInfo } from "./more";
import { TeamSettings } from "./team";

export interface SettingsProps {
  me: { id: string; name: string; email: string; timezone: string | null };
  org: Org;
  role: Role;
  members: MemberRow[];
  invites: (Invite & { url: string })[];
  settings: Settings;
  scans: Scan[];
  audit: AuditEntry[];
  apify: boolean;
  sources: SourceInfo;
  hubspot: HubspotStatus;
  accounts: { id: string; name: string; tier: string; inHubspot: boolean }[];
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
          <TabsTrigger value="icp">ICP &amp; scoring</TabsTrigger>
          <TabsTrigger value="sources">Data sources</TabsTrigger>
          <TabsTrigger value="scans">Market scans</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          {isAdmin ? <TabsTrigger value="audit">Audit log</TabsTrigger> : null}
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>
        <div className="mt-5 max-w-5xl">
          <TabsContent value="profile">
            <ProfileSettings name={p.me.name} email={p.me.email} timezone={p.me.timezone} />
          </TabsContent>
          <TabsContent value="workspace">
            <WorkspaceSettings org={p.org} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="team">
            <TeamSettings orgId={p.org.id} members={p.members} invites={p.invites} seatLimit={p.org.seatLimit} me={p.me.id} myRole={p.role} />
          </TabsContent>
          <TabsContent value="icp">
            <IcpSettings settings={p.settings} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="sources">
            <SourcesSettings info={p.sources} settings={p.settings} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="scans">
            <ScansSettings searches={p.settings.savedSearches} scans={p.scans} isAdmin={isAdmin} apify={p.apify} />
          </TabsContent>
          <TabsContent value="integrations">
            <IntegrationsSettings hubspot={p.hubspot} isAdmin={isAdmin} accounts={p.accounts} />
          </TabsContent>
          {isAdmin ? (
            <TabsContent value="audit">
              <AuditLog entries={p.audit} />
            </TabsContent>
          ) : null}
          <TabsContent value="danger">
            <DangerZone orgName={p.org.name} isOwner={p.role === "owner"} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
