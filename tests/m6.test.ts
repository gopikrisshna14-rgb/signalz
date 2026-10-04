import { describe, expect, it } from "vitest";
import { buildPushPlan } from "@/lib/crm/hubspot";
import { buildDemoCompanies } from "@/lib/demo";
import { toCsv, toJson } from "@/lib/export";
import { reapplyExclusions } from "@/lib/rescore";
import { MemoryKv } from "@/lib/store/kv";
import { KvStore } from "@/lib/store/store";
import { defaultSettings, type User } from "@/lib/types";
import { createOrg, joinOrg, updateMember } from "@/lib/workspace";

const settings = defaultSettings();
const companies = buildDemoCompanies("o_t", settings);
const laufwerk = companies[0];

describe("export", () => {
  it("writes a UTF-8 BOM CSV with one row per contact and the ; option", () => {
    const csv = toCsv([laufwerk], ";");
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.trim().split("\r\n");
    expect(lines[0].split(";")[0]).toBe("company_name");
    expect(lines).toHaveLength(1 + laufwerk.people.length);
    expect(lines[1]).toContain("Laufwerk Sneakers;laufwerk-sneakers.de");
    expect(csv).toContain("4 open roles in Sales · Wholesale · DACH (3 SDR/AE, 1 leader)");
  });
  it("quotes separators and quotes", () => {
    const c = { ...laufwerk, name: 'Laufwerk, "Sneakers"' };
    expect(toCsv([c], ",")).toContain('"Laufwerk, ""Sneakers"""');
  });
  it("JSON has company and contacts", () => {
    const j = toJson([laufwerk]);
    expect(j[0].company.signal_tier).toBe("Hot");
    expect(j[0].contacts[0]).toMatchObject({ first_name: "Jonas", persona: "Economic buyer", prior_tools: "HubSpot" });
  });
});

describe("HubSpot dry run", () => {
  it("builds the exact payload with mapping and a note", () => {
    const plan = buildPushPlan(laufwerk, { "company.city": "" });
    expect(plan.company.match.domain).toBe("laufwerk-sneakers.de");
    expect(plan.company.properties).toMatchObject({ name: "Laufwerk Sneakers", domain: "laufwerk-sneakers.de", signal_tier: "Hot", hiring_cluster_index: "100" });
    expect(plan.company.properties.city).toBeUndefined();
    expect(plan.contacts[0].properties).toMatchObject({ firstname: "Jonas", lastname: "Weber", signalz_persona: "Economic buyer" });
    expect(plan.note.body).toContain("New sales leader, 21 days in the role");
    expect(plan.note.body).toContain("linkedin.com/jobs/view");
  });
});

describe("re-score exclusions", () => {
  it("applies a new regex and lifts a removed one", () => {
    const job = laufwerk.jobs.find((j) => j.title === "Sales Associate, Store Berlin")!;
    expect(reapplyExclusions(job, { ...settings, exclusions: [] }).cls.isExcluded).toBe(false);
    const sdr = laufwerk.jobs.find((j) => j.title === "SDR Wholesale DACH")!;
    expect(reapplyExclusions(sdr, { ...settings, exclusions: ["wholesale"] }).cls.isExcluded).toBe(true);
  });
});

describe("seats and owners", () => {
  const user = (id: string): User => ({ id, email: `${id}@x.de`, name: id, image: null, defaultOrgId: null, createdAt: new Date().toISOString() });

  it("refuses the 6th member of a 5-seat workspace and keeps an owner", async () => {
    const store = new KvStore(new MemoryKv());
    const owner = user("u0");
    await store.putUser(owner);
    const org = await createOrg(store, owner, { name: "Acme" });
    for (const id of ["u1", "u2", "u3", "u4"]) {
      await store.putUser(user(id));
      await joinOrg(store, org, user(id), "member", "test");
    }
    await store.putUser(user("u5"));
    await expect(joinOrg(store, org, user("u5"), "member", "test")).rejects.toMatchObject({ code: "no_seat" });
    await expect(updateMember(store, org, { user: owner, role: "owner" }, "u0", { role: "member" })).rejects.toMatchObject({ code: "last_owner" });
    await updateMember(store, org, { user: owner, role: "owner" }, "u4", { status: "deactivated" });
    await joinOrg(store, org, user("u5"), "member", "test");
    await expect(updateMember(store, org, { user: owner, role: "owner" }, "u4", { status: "active" })).rejects.toMatchObject({ code: "no_seat" });
    await expect(updateMember(store, org, { user: user("u1"), role: "admin" }, "u0", { role: "member" })).rejects.toMatchObject({ code: "forbidden" });
  });
});
