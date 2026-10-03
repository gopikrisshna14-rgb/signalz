// Fictional sample data for the Outreach and Clusters pages, shown until the
// n8n + Apify pipeline fills the workspace with real rows. Deterministic, so the
// page looks the same on every load.

export const ANGLE_LABELS: Record<string, string> = {
  new_leader_90_days: "First 90 days",
  sdr_team_buildout: "Team build-out",
  crm_displacement: "CRM displacement",
  new_region: "Expansion",
  revops_hire: "RevOps hire",
  funding: "Funding",
  custom: "Custom",
};

export interface AngleRow {
  angle: string;
  sent: number;
  accepted: number;
  replies: number;
  meetings: number;
}

export interface UserRow {
  user_id: string;
  full_name: string;
  sent: number;
  replies: number;
  meetings: number;
  accounts_touched: number;
}

export interface ReplyCell {
  weekday: number; // 1 = Monday
  hour: number; // local hour (UTC when utc = true)
  sent: number;
  replied: number;
  utc?: boolean;
}

export interface ActivityRow {
  id: string;
  company: string;
  person: string;
  event_type: string;
  angle: string | null;
  user: string;
  occurred_at: string;
}

export interface OutreachData {
  byAngle: AngleRow[];
  byUser: UserRow[];
  replyTimes: ReplyCell[];
  activity: ActivityRow[];
  weekly: { week: string; sent: number; replies: number }[];
}

export interface ClusterRow {
  id: string;
  company_id: string | null;
  company: string;
  division: string;
  function: string;
  region: string;
  open_roles: number;
  builder_roles: number;
  leader_roles: number;
  revops_roles: number;
  new_leader_days: number | null;
  crm_mentions: string[];
  cluster_score: number;
  first_detected_at: string;
}

export interface ClustersData {
  clusters: ClusterRow[];
  functionRegion: { function: string; region: string; clusters: number; open_roles: number; avg_score: number }[];
  divisionWeek: { label: string; company: string; week_start: string; roles: number }[];
  perWeek: { week: string; clusters: number }[];
  roleFamilies: { role: string; count: number }[];
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const DAY = 86400000;
function weekStart(offsetWeeks: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - offsetWeeks * 7);
  return d.toISOString().slice(0, 10);
}

export function sampleOutreach(): OutreachData {
  const byAngle: AngleRow[] = [
    { angle: "new_leader_90_days", sent: 64, accepted: 31, replies: 17, meetings: 7 },
    { angle: "sdr_team_buildout", sent: 82, accepted: 35, replies: 15, meetings: 5 },
    { angle: "crm_displacement", sent: 47, accepted: 18, replies: 6, meetings: 2 },
    { angle: "new_region", sent: 29, accepted: 14, replies: 7, meetings: 3 },
    { angle: "revops_hire", sent: 18, accepted: 9, replies: 5, meetings: 2 },
  ];
  const byUser: UserRow[] = [
    { user_id: "s1", full_name: "Jonas Weber", sent: 71, replies: 16, meetings: 6, accounts_touched: 24 },
    { user_id: "s2", full_name: "Lea Hoffmann", sent: 64, replies: 14, meetings: 5, accounts_touched: 21 },
    { user_id: "s3", full_name: "Elif Yilmaz", sent: 58, replies: 11, meetings: 4, accounts_touched: 19 },
    { user_id: "s4", full_name: "Max Bauer", sent: 33, replies: 5, meetings: 2, accounts_touched: 12 },
    { user_id: "s5", full_name: "Sofia Rossi", sent: 14, replies: 4, meetings: 2, accounts_touched: 6 },
  ];
  const r = rng(7);
  const replyTimes: ReplyCell[] = [];
  for (let wd = 1; wd <= 5; wd++) {
    for (let h = 7; h <= 19; h++) {
      // Replies peak Tue–Thu mornings and just after lunch.
      const morning = Math.exp(-((h - 9) ** 2) / 3);
      const lunch = 0.6 * Math.exp(-((h - 13.5) ** 2) / 2);
      const day = wd >= 2 && wd <= 4 ? 1 : 0.65;
      const sent = 4 + Math.round(r() * 6);
      const rate = Math.min(0.6, (morning + lunch) * day * 0.55 + r() * 0.05);
      replyTimes.push({ weekday: wd, hour: h, sent, replied: Math.round(sent * rate) });
    }
  }
  const companies = [
    ["Laufwerk Sneakers", "Jonas Weber"],
    ["Grünwerk Energie", "Max Bauer"],
    ["Nomad Travel Tech", "Elif Yilmaz"],
    ["Fahrwerk Mobility", "Sofia Rossi"],
    ["Kicks Kollektiv", "Lea Hoffmann"],
    ["Sohle & Co", "Markus Zimmermann"],
  ];
  const events = ["meeting_booked", "replied", "connection_accepted", "message_sent", "connection_sent", "replied", "connection_sent", "not_interested"];
  const angles = Object.keys(ANGLE_LABELS).slice(0, 5);
  const users = byUser.map((u) => u.full_name);
  const activity: ActivityRow[] = events.map((e, i) => ({
    id: `a${i}`,
    company: companies[i % companies.length]![0]!,
    person: companies[i % companies.length]![1]!,
    event_type: e,
    angle: angles[i % angles.length]!,
    user: users[(i * 2) % users.length]!,
    occurred_at: new Date(Date.now() - (i * 3.3 + 0.4) * 3600000).toISOString(),
  }));
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const sent = Math.round(14 + i * 2.2 + r() * 8);
    return { week: weekStart(11 - i), sent, replies: Math.round(sent * (0.14 + r() * 0.1)) };
  });
  return { byAngle, byUser, replyTimes, activity, weekly };
}

export function sampleClusters(): ClustersData {
  const r = rng(42);
  const base: [string, string, string, string, number, number, number, number, number | null, string[]][] = [
    // company, function, business unit, region, roles, builders, leaders, revops, leader days, crm
    ["Laufwerk Sneakers", "sales", "Wholesale", "DACH", 4, 3, 1, 0, 21, ["salesforce"]],
    ["Grünwerk Energie", "sales", "SME", "DACH", 4, 3, 1, 0, null, ["salesforce"]],
    ["Kicks Kollektiv", "sales", "B2B", "DACH", 3, 2, 0, 1, null, []],
    ["Fahrwerk Mobility", "sales", "Fleet", "DACH", 3, 3, 0, 0, 40, ["pipedrive"]],
    ["Nomad Travel Tech", "sales", "", "EMEA", 2, 1, 1, 0, 12, []],
    ["Pflegedienst Sonnenhof", "sales", "", "DACH", 2, 2, 0, 0, null, []],
    ["Brauhaus Digital", "revops", "", "DACH", 2, 0, 0, 2, null, ["hubspot"]],
    ["Velo Nord", "sales", "Enterprise", "Nordics", 3, 2, 1, 0, 55, ["salesforce"]],
    ["Mosaik Software", "sales", "Mid-Market", "UK", 5, 4, 1, 0, 8, ["salesforce"]],
    ["Atlas Logistik", "sales", "Enterprise", "DACH", 3, 2, 1, 0, null, ["sap"]],
    ["Kühlkette AG", "customer_success", "", "DACH", 2, 0, 0, 0, null, []],
    ["Paperwise", "sales", "SMB", "EMEA", 4, 4, 0, 0, null, []],
    ["Sonnenkraft", "marketing", "", "DACH", 2, 0, 0, 0, null, ["hubspot"]],
    ["Lumen Health", "sales", "Enterprise", "US", 3, 2, 1, 0, 70, ["salesforce"]],
    ["Fjord Analytics", "revops", "", "Nordics", 2, 0, 0, 2, null, []],
    ["Bergwerk Tools", "sales", "Retail Partnerships", "DACH", 2, 1, 0, 0, null, []],
  ];
  const clusters: ClusterRow[] = base.map(([company, fn, bu, region, roles, builders, leaders, revops, days, crm], i) => {
    const score = Math.min(
      100,
      Math.min(roles, 3) * 15 +
        ((leaders > 0 || days != null) && builders > 0 ? 20 : builders >= 2 ? 10 : 0) +
        (days == null ? 0 : days <= 30 ? 20 : days <= 60 ? 15 : 10) +
        (crm.some((c) => c !== "hubspot") ? 10 : crm.length ? 5 : 0) +
        (revops > 0 ? 5 : 0) +
        (i % 3 === 0 ? 5 : 0),
    );
    const fnLabel = { sales: "Sales", revops: "RevOps", marketing: "Marketing", customer_success: "Customer success" }[fn] ?? fn;
    const label = [fnLabel, bu, region].filter(Boolean).join(" · ");
    return {
      id: `c${i}`,
      company_id: null,
      company,
      division: label,
      function: fn,
      region: region || "Unknown",
      open_roles: roles,
      builder_roles: builders,
      leader_roles: leaders,
      revops_roles: revops,
      new_leader_days: days,
      crm_mentions: crm,
      cluster_score: score,
      first_detected_at: new Date(Date.now() - Math.round(r() * 60 + 1) * DAY).toISOString(),
    };
  });

  const frMap = new Map<string, { function: string; region: string; clusters: number; open_roles: number; score: number }>();
  for (const c of clusters) {
    const k = `${c.function}|${c.region}`;
    const e = frMap.get(k) ?? { function: c.function, region: c.region, clusters: 0, open_roles: 0, score: 0 };
    e.clusters += 1;
    e.open_roles += c.open_roles;
    e.score += c.cluster_score;
    frMap.set(k, e);
  }
  const functionRegion = [...frMap.values()].map((e) => ({
    function: e.function,
    region: e.region,
    clusters: e.clusters,
    open_roles: e.open_roles,
    avg_score: Math.round(e.score / e.clusters),
  }));

  const divisionWeek: ClustersData["divisionWeek"] = [];
  for (const c of [...clusters].sort((a, b) => b.cluster_score - a.cluster_score).slice(0, 10)) {
    let left = c.open_roles + Math.round(r() * 3);
    for (let w = 11; w >= 0 && left > 0; w--) {
      if (r() < 0.32 || w < 2) {
        const n = Math.min(left, 1 + Math.round(r()));
        left -= n;
        divisionWeek.push({ label: c.division, company: c.company, week_start: weekStart(w), roles: n });
      }
    }
  }

  const perWeek = Array.from({ length: 12 }, (_, i) => ({ week: weekStart(11 - i), clusters: Math.round(2 + i * 0.6 + r() * 3) }));
  const roleFamilies = [
    { role: "SDR / BDR", count: 21 },
    { role: "Account Executive", count: 17 },
    { role: "Head of Sales", count: 8 },
    { role: "RevOps", count: 6 },
    { role: "Account Manager", count: 5 },
    { role: "Sales Engineer", count: 3 },
  ];
  return { clusters, functionRegion, divisionWeek, perWeek, roleFamilies };
}

export function weekLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
