import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const Role = z.enum(["owner", "admin", "member"]);
export type Role = z.infer<typeof Role>;

export const MemberStatus = z.enum(["active", "deactivated"]);
export type MemberStatus = z.infer<typeof MemberStatus>;

export const Tier = z.enum(["hot", "warm", "cold"]);
export type Tier = z.infer<typeof Tier>;

export const Bucket = z.enum([
  "routed",
  "recently_contacted",
  "call_today",
  "high_intent",
  "net_new",
  "warming_up",
  "other",
]);
export type Bucket = z.infer<typeof Bucket>;

export const Angle = z.enum(["first_90_days", "team_buildout", "crm_displacement", "expansion"]);
export type Angle = z.infer<typeof Angle>;

export const RoleFamily = z.enum(["sdr", "ae", "leader", "revops", "am", "cs", "marketing", "other"]);
export type RoleFamily = z.infer<typeof RoleFamily>;

export const Seniority = z.enum(["entry", "mid", "senior", "lead", "head", "vp", "c_level"]);
export type Seniority = z.infer<typeof Seniority>;

export const JobFunction = z.enum(["sales", "revops", "marketing", "customer_success", "other"]);
export type JobFunction = z.infer<typeof JobFunction>;

export const JobFlag = z.enum(["first_sdr", "founding_team", "build_from_scratch", "new_region", "reposted"]);
export type JobFlag = z.infer<typeof JobFlag>;

export const CompanyStatus = z.enum(["prospect", "customer", "open_opportunity", "disqualified"]);
export type CompanyStatus = z.infer<typeof CompanyStatus>;

export const OutreachType = z.enum([
  "connection_sent",
  "accepted",
  "message_sent",
  "replied",
  "meeting_booked",
  "not_interested",
]);
export type OutreachType = z.infer<typeof OutreachType>;

export const ResearchStep = z.enum(["queued", "profile", "posts", "company", "employees", "jobs", "stepstone", "classifying", "scoring", "done", "failed"]);
export type ResearchStep = z.infer<typeof ResearchStep>;

export const SignalType = z.enum(["hiring_cluster", "cluster_grew", "new_sales_leader", "first_sdr", "tier_changed"]);
export type SignalType = z.infer<typeof SignalType>;

/* ------------------------------------------------------------------ */
/* Users, workspaces, members                                          */
/* ------------------------------------------------------------------ */

export const User = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  image: z.string().nullable().default(null),
  passwordHash: z.string().optional(),
  defaultOrgId: z.string().nullable().default(null),
  timezone: z.string().optional(),
  createdAt: z.string(),
});
export type User = z.infer<typeof User>;

export const Org = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  emailDomain: z.string().nullable().default(null),
  autoJoin: z.boolean().default(false),
  seatLimit: z.number().int().default(5),
  plan: z.literal("beta").default("beta"),
  isDemo: z.boolean().optional(),
  createdAt: z.string(),
});
export type Org = z.infer<typeof Org>;

export const Membership = z.object({
  role: Role,
  status: MemberStatus,
  joinedAt: z.string(),
});
export type Membership = z.infer<typeof Membership>;

export const Invite = z.object({
  token: z.string(),
  orgId: z.string(),
  email: z.string(),
  role: Role,
  invitedBy: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().optional(),
});
export type Invite = z.infer<typeof Invite>;

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const SavedSearch = z.object({
  id: z.string(),
  name: z.string(),
  keywords: z.string(),
  location: z.string(),
  days: z.union([z.literal(7), z.literal(30)]),
});
export type SavedSearch = z.infer<typeof SavedSearch>;

export const Weights = z.object({
  cluster: z.number().min(0).max(1),
  fit: z.number().min(0).max(1),
  timing: z.number().min(0).max(1),
  reach: z.number().min(0).max(1),
});
export type Weights = z.infer<typeof Weights>;

export const DEFAULT_EXCLUSIONS = [
  String.raw`\bstores?\b`,
  "filiale",
  "shop ?(assistant|mitarbeiter)",
  "retail (sales )?associate",
  String.raw`sales (associate|assistant)\b`,
  "verkäufer",
  "kassierer",
  "cashier",
  "call ?cent(er|re)",
  "promoter",
  "aushilfe",
  "minijob",
];

export const Settings = z.object({
  countries: z.array(z.string()).default(["DE", "AT", "CH"]),
  industries: z.array(z.string()).default([]),
  headcountMin: z.number().int().default(50),
  headcountMax: z.number().int().default(2000),
  functions: z.array(JobFunction).default(["sales", "revops"]),
  ownProduct: z.string().default("hubspot"),
  clusterWindowDays: z.number().int().min(7).max(180).default(45),
  minClusterRoles: z.number().int().min(1).max(10).default(2),
  leaderTenureDays: z.number().int().min(14).max(365).default(90),
  weights: Weights.default({ cluster: 0.4, fit: 0.25, timing: 0.2, reach: 0.15 }),
  hotThreshold: z.number().int().min(1).max(100).default(70),
  warmThreshold: z.number().int().min(1).max(100).default(45),
  exclusions: z.array(z.string()).default(DEFAULT_EXCLUSIONS),
  savedSearches: z.array(SavedSearch).default([]),
  dataSourceLine: z.boolean().default(false),
  doNotScrape: z.array(z.string()).default([]),
  icpUpdatedAt: z.string().nullable().default(null),
});
export type Settings = z.infer<typeof Settings>;

export const defaultSettings = (): Settings => Settings.parse({});

/* ------------------------------------------------------------------ */
/* Companies, jobs, people, clusters, scores                           */
/* ------------------------------------------------------------------ */

export const JobClassification = z.object({
  function: JobFunction,
  businessUnit: z.string(),
  region: z.string(),
  roleFamily: RoleFamily,
  seniority: Seniority,
  crmMentions: z.array(z.string()),
  flags: z.array(JobFlag),
  isExcluded: z.boolean(),
  exclusionReason: z.string().nullable(),
  employerIdentified: z.boolean(),
  by: z.enum(["rules", "claude"]),
});
export type JobClassification = z.infer<typeof JobClassification>;

export const Job = z.object({
  id: z.string(),
  source: z.string(),
  externalId: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  location: z.string().nullable(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  description: z.string().nullable(),
  employerName: z.string().nullable(),
  postedAt: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  closedAt: z.string().nullable().default(null),
  fromScan: z.boolean().default(false),
  cls: JobClassification,
});
export type Job = z.infer<typeof Job>;

export const PersonClassification = z.object({
  roleFamily: RoleFamily,
  seniority: Seniority,
  persona: z.string(),
  isDecisionMaker: z.boolean(),
  priorTools: z.array(z.string()),
  divisionKey: z.string().nullable(),
  by: z.enum(["rules", "claude"]),
});
export type PersonClassification = z.infer<typeof PersonClassification>;

export const Person = z.object({
  id: z.string(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  title: z.string(),
  linkedinUrl: z.string().nullable(),
  email: z.string().nullable().default(null),
  location: z.string().nullable(),
  country: z.string().nullable(),
  roleStartedAt: z.string().nullable(),
  previousRoles: z.array(z.object({ company: z.string(), title: z.string(), from: z.string().nullable(), to: z.string().nullable() })),
  schools: z.array(z.string()).default([]),
  posts: z.array(z.object({ text: z.string(), at: z.string().nullable(), url: z.string().nullable() })).default([]),
  mutualConnections: z.number().nullable().default(null),
  sharedHistory: z.string().nullable().default(null),
  source: z.string(),
  scrapedAt: z.string(),
  cls: PersonClassification,
});
export type Person = z.infer<typeof Person>;

export const Factor = z.object({ label: z.string(), points: z.number() });
export type Factor = z.infer<typeof Factor>;

export const Cluster = z.object({
  key: z.string(),
  label: z.string(),
  function: JobFunction,
  businessUnit: z.string(),
  region: z.string(),
  jobIds: z.array(z.string()),
  openRoles: z.number(),
  sdrAe: z.number(),
  leaders: z.number(),
  revops: z.number(),
  newLeader: z.object({ personId: z.string(), name: z.string(), days: z.number() }).nullable(),
  crmMentions: z.array(z.string()),
  flags: z.array(JobFlag),
  velocity14: z.number(),
  index: z.number(),
  breakdown: z.array(Factor),
  newestAt: z.string().nullable(),
  firstSeenAt: z.string(),
});
export type Cluster = z.infer<typeof Cluster>;

export const Division = z.object({
  key: z.string(),
  label: z.string(),
  function: JobFunction,
  businessUnit: z.string(),
  region: z.string(),
});
export type Division = z.infer<typeof Division>;

export const AccountScore = z.object({
  cluster: z.number(),
  fit: z.number(),
  timing: z.number(),
  reach: z.number(),
  boost: z.number(),
  priority: z.number(),
  tier: Tier,
  bucket: Bucket,
  reasons: z.array(z.string()),
  breakdown: z.object({
    cluster: z.array(Factor),
    fit: z.array(Factor),
    timing: z.array(Factor),
    reach: z.array(Factor),
    boost: z.array(Factor),
  }),
  topClusterKey: z.string().nullable(),
  decisionMakerId: z.string().nullable(),
  angle: Angle,
  suppression: z.array(z.string()),
  crmState: z.enum(["none", "spreadsheet", "competitor", "own", "unknown"]),
  crmNamed: z.array(z.string()),
  computedAt: z.string(),
});
export type AccountScore = z.infer<typeof AccountScore>;

export const Company = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  domain: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  linkedinId: z.string().nullable().default(null),
  logoUrl: z.string().nullable().default(null),
  industry: z.string().nullable(),
  headcount: z.number().nullable(),
  headcountGrowth6m: z.number().nullable().default(null),
  country: z.string().nullable(),
  city: z.string().nullable(),
  fundingAt: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  status: CompanyStatus.default("prospect"),
  routedTo: z.string().nullable().default(null),
  divisions: z.array(Division).default([]),
  jobs: z.array(Job).default([]),
  people: z.array(Person).default([]),
  clusters: z.array(Cluster).default([]),
  score: AccountScore.nullable().default(null),
  scoreHistory: z.array(z.object({ at: z.string(), priority: z.number(), tier: Tier })).default([]),
  owner: z.object({ userId: z.string(), name: z.string(), claimedAt: z.string() }).nullable().default(null),
  lastOutreachAt: z.string().nullable().default(null),
  crm: z
    .object({
      detected: z.string().nullable().default(null),
      exportedAt: z.string().nullable().default(null),
      hubspotCompanyId: z.string().nullable().default(null),
      hubspotContactIds: z.record(z.string(), z.string()).default({}),
    })
    .default({ detected: null, exportedAt: null, hubspotCompanyId: null, hubspotContactIds: {} }),
  sources: z.array(z.object({ kind: z.string(), at: z.string() })).default([]),
  enrichedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Company = z.infer<typeof Company>;

/* ------------------------------------------------------------------ */
/* Signals, research, outreach, templates, scans, audit                */
/* ------------------------------------------------------------------ */

export const Signal = z.object({
  id: z.string(),
  companyId: z.string(),
  companyName: z.string(),
  type: SignalType,
  title: z.string(),
  strength: z.number(),
  at: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type Signal = z.infer<typeof Signal>;

export const Research = z.object({
  id: z.string(),
  orgId: z.string(),
  requestedBy: z.string(),
  url: z.string(),
  kind: z.enum(["person", "company"]),
  status: ResearchStep,
  error: z.string().nullable(),
  runIds: z.array(z.string()),
  costUsd: z.number(),
  companyId: z.string().nullable(),
  personId: z.string().nullable(),
  simulated: z.boolean().default(false),
  /** Data carried between steps (company URL found on the profile, mapped person). */
  context: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Research = z.infer<typeof Research>;

export const OutreachEvent = z.object({
  id: z.string(),
  orgId: z.string(),
  companyId: z.string(),
  companyName: z.string(),
  personId: z.string().nullable(),
  personName: z.string().nullable(),
  userId: z.string(),
  userName: z.string(),
  type: OutreachType,
  angle: Angle.nullable(),
  note: z.string().nullable(),
  at: z.string(),
});
export type OutreachEvent = z.infer<typeof OutreachEvent>;

export const Template = z.object({
  id: z.string(),
  angle: Angle,
  name: z.string(),
  connectionNote: z.string(),
  message: z.string(),
  emailSubject: z.string(),
  emailBody: z.string(),
  updatedAt: z.string(),
});
export type Template = z.infer<typeof Template>;

export const Scan = z.object({
  id: z.string(),
  orgId: z.string(),
  searchId: z.string().nullable(),
  name: z.string(),
  status: z.enum(["running", "classifying", "done", "failed"]),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  rawJobs: z.number(),
  companies: z.number(),
  hits: z.number(),
  costUsd: z.number(),
  error: z.string().nullable(),
  simulated: z.boolean().default(false),
});
export type Scan = z.infer<typeof Scan>;

export const AuditEntry = z.object({
  id: z.string(),
  at: z.string(),
  userId: z.string(),
  userName: z.string(),
  action: z.string(),
  target: z.string().nullable(),
  detail: z.string().nullable(),
});
export type AuditEntry = z.infer<typeof AuditEntry>;

export const HubspotConfig = z.object({
  tokenEnc: z.string(),
  connectedAt: z.string(),
  propertiesCreatedAt: z.string().nullable().default(null),
  mapping: z.record(z.string(), z.string()).default({}),
});
export type HubspotConfig = z.infer<typeof HubspotConfig>;

/* ------------------------------------------------------------------ */
/* UI labels                                                           */
/* ------------------------------------------------------------------ */

export const BUCKET_LABEL: Record<Bucket, string> = {
  call_today: "Call today",
  high_intent: "High intent, weaker fit",
  net_new: "Net-new",
  warming_up: "Warming up",
  recently_contacted: "Recently contacted",
  routed: "Routed",
  other: "Other",
};

export const ANGLE_LABEL: Record<Angle, string> = {
  first_90_days: "First 90 days",
  team_buildout: "Team build-out",
  crm_displacement: "CRM displacement",
  expansion: "Expansion",
};

export const OUTREACH_LABEL: Record<OutreachType, string> = {
  connection_sent: "Connection sent",
  accepted: "Accepted",
  message_sent: "Message sent",
  replied: "Replied",
  meeting_booked: "Meeting booked",
  not_interested: "Not interested",
};

export const STEP_LABEL: Record<ResearchStep, string> = {
  queued: "Queued",
  profile: "Profile",
  posts: "Posts",
  company: "Company",
  employees: "Employees",
  jobs: "Jobs",
  stepstone: "StepStone",
  classifying: "Classifying",
  scoring: "Scoring",
  done: "Done",
  failed: "Failed",
};

export const ROLE_FAMILY_LABEL: Record<RoleFamily, string> = {
  sdr: "SDR/BDR",
  ae: "Account Executive",
  leader: "Sales leader",
  revops: "RevOps",
  am: "Account Manager",
  cs: "Customer Success",
  marketing: "Marketing",
  other: "Other",
};
