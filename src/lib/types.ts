export type Tier = "hot" | "warm" | "cold";
export type Bucket =
  | "call_today"
  | "high_intent_weak_fit"
  | "net_new"
  | "warming_up"
  | "recently_contacted"
  | "routed"
  | "other";

/** One row of public.v_accounts */
export interface Account {
  id: string;
  org_id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  linkedin_url: string | null;
  industry: string | null;
  employee_count: number | null;
  hq_country: string | null;
  hq_city: string | null;
  current_crm: string | null;
  status: string;
  owner_id: string | null;
  crm_external_id: string | null;
  is_net_new: boolean;
  owner_name: string | null;
  priority_score: number;
  cluster_score: number;
  fit_score: number;
  timing_score: number;
  reach_score: number;
  tier: Tier;
  previous_tier: Tier | null;
  tier_changed_at: string | null;
  bucket: Bucket;
  top_reason: string | null;
  reasons: string[];
  is_new: boolean;
  changed_24h: boolean;
  division_label: string | null;
  open_roles: number | null;
  leader_roles: number | null;
  builder_roles: number | null;
  new_leader_days: number | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_linkedin: string | null;
  contact_photo: string | null;
  last_signal_at: string | null;
  last_outreach_at: string | null;
}

/** One row of public.v_kpis */
export interface Kpis {
  org_id: string;
  call_today: number;
  net_new: number;
  new_or_upgraded_24h: number;
  with_new_leader: number;
  active_clusters: number;
  routed: number;
  avg_hot_priority: number | null;
}

/** One row of public.v_just_changed */
export interface JustChanged {
  id: string;
  org_id: string;
  company_id: string;
  company_name: string;
  type: string;
  title: string;
  strength: number;
  occurred_at: string;
  owner_name: string | null;
}

export interface Workspace {
  userId: string;
  email: string | null;
  fullName: string | null;
  orgId: string;
  orgName: string;
  role: "owner" | "admin" | "member";
}

export const BUCKET_LABELS: Record<Bucket, string> = {
  call_today: "Call today",
  high_intent_weak_fit: "High intent, weaker fit",
  net_new: "Net-new",
  warming_up: "Warming up",
  recently_contacted: "Recently contacted",
  routed: "Routed",
  other: "Other",
};

export const OUTREACH_EVENTS = [
  { type: "connection_sent", label: "Connection sent" },
  { type: "connection_accepted", label: "Accepted" },
  { type: "message_sent", label: "Message sent" },
  { type: "replied", label: "Replied" },
  { type: "meeting_booked", label: "Meeting booked" },
  { type: "not_interested", label: "Not interested" },
] as const;

export const ANGLES = [
  { value: "new_leader_90_days", label: "First 90 days" },
  { value: "sdr_team_buildout", label: "Team build-out" },
  { value: "crm_displacement", label: "CRM displacement" },
  { value: "new_region", label: "Expansion" },
  { value: "revops_hire", label: "RevOps hire" },
  { value: "custom", label: "Custom" },
] as const;
