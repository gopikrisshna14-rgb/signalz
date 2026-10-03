-- Hiring Signals · 002: ICP settings, companies, divisions, job postings, people,
-- research requests (LinkedIn URL → n8n → Apify), hiring clusters, signals, scores.
-- Run after 001. Safe to re-run.
--
-- Writes from n8n use the service role key (bypasses RLS). The browser only reads,
-- plus a few explicit writes (claiming an account, starting a research request).

-- ---------------------------------------------------------------------------
-- 1. ICP + scoring settings (one row per workspace, edited by admins)
-- ---------------------------------------------------------------------------
create table if not exists public.icp_settings (
  org_id                 uuid primary key references public.organizations (id) on delete cascade,
  target_countries       text[] not null default '{DE,AT,CH}',     -- ISO-3166 alpha-2
  target_industries      text[] not null default '{}',              -- empty = any
  min_employees          int not null default 50,
  max_employees          int not null default 2000,
  target_functions       text[] not null default '{sales,revops}',  -- which divisions count for a cluster
  own_product_crm        text not null default 'hubspot',           -- your product: accounts already on it score lower
  cluster_window_days    int not null default 45  check (cluster_window_days between 7 and 180),
  min_cluster_roles      int not null default 2   check (min_cluster_roles between 1 and 20),
  leader_tenure_days     int not null default 90  check (leader_tenure_days between 14 and 365),
  hot_threshold          int not null default 70,
  warm_threshold         int not null default 45,
  -- priority = Σ weight × sub-score; weights should sum to 1
  weights                jsonb not null default
    '{"cluster":0.40,"fit":0.25,"timing":0.20,"reach":0.15}'::jsonb,
  -- Case-insensitive regexes for titles that say "sales" but are not B2B sales (a sneaker
  -- brand's shop floor, call centers). Keep them narrow: "Key Account Manager Retail" or
  -- "AE Retail Partnerships" sells TO retailers and must still count.
  excluded_title_patterns text[] not null default array[
    '\mstores?\M', '\mfiliale', '\mshop ?(assistant|mitarbeiter)', '\mretail (sales )?associate',
    '\msales (associate|assistant)\M', '\mverkäufer', '\mkassierer', '\mcashier', '\mcall ?cent(er|re)',
    '\mpromoter', '\maushilfe', '\mminijob'],
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Companies (accounts), per workspace
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  name               text not null,
  domain             text,
  linkedin_url       text,
  logo_url           text,
  industry           text,
  employee_count     int,
  employee_growth_6m numeric(6,2),                 -- % headcount change, from LinkedIn
  hq_country         text,
  hq_city            text,
  description        text,
  funding_stage      text,
  last_funding_at    date,
  last_funding_eur   bigint,
  current_crm        text,                         -- detected: hubspot / salesforce / pipedrive / none / unknown
  website_intent     int check (website_intent between 0 and 100),  -- optional, from reverse-IP tool
  status             text not null default 'prospect'
                       check (status in ('prospect', 'customer', 'open_opportunity', 'disqualified', 'routed')),
  routed_to_team     text,
  owner_id           uuid references auth.users (id) on delete set null,
  claimed_at         timestamptz,
  crm_external_id    text,                         -- id in the user's CRM after export; null = net-new
  last_enriched_at   timestamptz,
  raw                jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists companies_org_domain_idx   on public.companies (org_id, lower(domain)) where domain is not null;
create unique index if not exists companies_org_linkedin_idx on public.companies (org_id, linkedin_url) where linkedin_url is not null;
create index if not exists companies_owner_idx on public.companies (org_id, owner_id);

-- A division = function + business unit + region inside one company,
-- e.g. "Sales · Wholesale · DACH". A hiring cluster only counts roles of ONE division.
create table if not exists public.divisions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  company_id     uuid not null references public.companies (id) on delete cascade,
  function       text not null check (function in
                   ('sales', 'revops', 'marketing', 'customer_success', 'partnerships', 'other')),
  business_unit  text not null default '',          -- "Wholesale", "B2B", "Enterprise", '' if unknown
  region         text not null default '',          -- "DACH", "EMEA", "US", '' if unknown
  label          text generated always as (
                   initcap(replace(function, '_', ' '))
                   || case when business_unit <> '' then ' · ' || business_unit else '' end
                   || case when region <> '' then ' · ' || region else '' end
                 ) stored,
  created_at     timestamptz not null default now(),
  unique (company_id, function, business_unit, region)
);

-- ---------------------------------------------------------------------------
-- 3. Job postings (from Apify: LinkedIn Jobs, careers page, job boards)
-- ---------------------------------------------------------------------------
create table if not exists public.job_postings (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  company_id        uuid not null references public.companies (id) on delete cascade,
  division_id       uuid references public.divisions (id) on delete set null,
  source            text not null check (source in ('linkedin', 'careers_page', 'stepstone', 'indeed', 'other')),
  external_id       text not null,
  url               text,
  title             text not null,
  role_family       text check (role_family in
                      ('sales_leader', 'sdr_bdr', 'account_executive', 'account_manager', 'revops',
                       'sales_enablement', 'sales_engineer', 'marketing', 'customer_success', 'other')),
  seniority         text check (seniority in ('intern', 'ic', 'lead', 'manager', 'director', 'vp', 'c_level')),
  location          text,
  country           text,
  remote            boolean,
  posted_at         timestamptz not null,
  closed_at         timestamptz,
  description       text,
  crm_mentions      text[] not null default '{}',   -- {salesforce, hubspot, pipedrive, excel}
  flags             text[] not null default '{}',   -- {first_sdr, founding_team, new_region, build_from_scratch, outbound}
  is_excluded       boolean not null default false, -- retail/store/call-center roles etc.
  exclusion_reason  text,
  classified_by     text,                            -- 'rules' or 'llm'
  raw               jsonb,
  created_at        timestamptz not null default now(),
  unique (org_id, source, external_id)
);
create index if not exists job_postings_company_idx on public.job_postings (company_id, posted_at desc);
create index if not exists job_postings_division_idx on public.job_postings (division_id) where closed_at is null;

-- ---------------------------------------------------------------------------
-- 4. People (decision makers, from the LinkedIn profile scrape)
-- ---------------------------------------------------------------------------
create table if not exists public.people (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references public.organizations (id) on delete cascade,
  company_id              uuid references public.companies (id) on delete set null,
  division_id             uuid references public.divisions (id) on delete set null,
  linkedin_url            text not null,
  full_name               text,
  headline                text,
  photo_url               text,
  current_title           text,
  role_family             text,
  seniority               text,
  persona                 text check (persona in ('economic_buyer', 'champion', 'user', 'influencer', 'unknown')),
  is_decision_maker       boolean not null default false,
  started_current_role_at date,                         -- drives the "first 90 days" window
  location                text,
  country                 text,
  about                   text,
  previous_roles          jsonb not null default '[]',  -- [{company, title, from, to}]
  prior_tools             text[] not null default '{}', -- tools named in profile/past roles, e.g. {hubspot, outreach}
  skills                  text[] not null default '{}',
  languages               text[] not null default '{}',
  education               jsonb not null default '[]',
  recent_posts            jsonb not null default '[]',  -- [{posted_at, text, url, reactions}]
  last_post_at            timestamptz,
  followers               int,
  connections             int,
  mutual_connections      int,
  shared_history          text[] not null default '{}', -- same ex-employer / university as the SDR
  email                   text,                         -- only if found via a compliant source
  last_enriched_at        timestamptz,
  raw                     jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (org_id, linkedin_url)
);
create index if not exists people_company_idx on public.people (company_id);

-- ---------------------------------------------------------------------------
-- 5. Research requests: SDR pastes a LinkedIn URL → n8n → Apify → rows above
-- ---------------------------------------------------------------------------
create table if not exists public.research_requests (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  requested_by      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  linkedin_url      text not null check (linkedin_url ~* '^https://([a-z]{2,3}\.)?linkedin\.com/(in|company)/[^/?#]+'),
  kind              text generated always as (
                      case when linkedin_url ~* 'linkedin\.com/company/' then 'company' else 'person' end
                    ) stored,
  status            text not null default 'queued'
                      check (status in ('queued', 'scraping_profile', 'scraping_company', 'scraping_jobs',
                                        'classifying', 'scoring', 'done', 'failed')),
  progress          int not null default 0 check (progress between 0 and 100),
  n8n_execution_id  text,
  apify_run_ids     jsonb not null default '{}',
  error             text,
  person_id         uuid references public.people (id) on delete set null,
  company_id        uuid references public.companies (id) on delete set null,
  created_at        timestamptz not null default now(),
  finished_at       timestamptz
);
create index if not exists research_requests_org_idx on public.research_requests (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. Hiring clusters (computed in 003 from job_postings + people)
-- ---------------------------------------------------------------------------
create table if not exists public.hiring_clusters (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations (id) on delete cascade,
  company_id            uuid not null references public.companies (id) on delete cascade,
  division_id           uuid not null references public.divisions (id) on delete cascade,
  open_roles            int not null default 0,
  leader_roles          int not null default 0,   -- Head of / Director / VP Sales, open
  builder_roles         int not null default 0,   -- SDR / BDR / AE, open
  revops_roles          int not null default 0,
  roles_last_14d        int not null default 0,
  new_leader_person_id  uuid references public.people (id) on delete set null,
  new_leader_days       int,                      -- days since the new leader started
  crm_mentions          text[] not null default '{}',
  flags                 text[] not null default '{}',
  cluster_score         int not null default 0 check (cluster_score between 0 and 100),
  score_breakdown       jsonb not null default '{}',
  status                text not null default 'active' check (status in ('active', 'cooling', 'closed')),
  first_detected_at     timestamptz not null default now(),
  last_changed_at       timestamptz not null default now(),
  unique (company_id, division_id)
);

-- ---------------------------------------------------------------------------
-- 7. Signals feed (one row per detected event; the "Just changed" list)
-- ---------------------------------------------------------------------------
create table if not exists public.signals (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,
  person_id    uuid references public.people (id) on delete set null,
  cluster_id   uuid references public.hiring_clusters (id) on delete set null,
  type         text not null check (type in
                 ('hiring_cluster', 'cluster_grew', 'new_sales_leader', 'first_sdr', 'new_region',
                  'competitor_crm_mentioned', 'revops_hire', 'leader_posted', 'funding', 'headcount_growth',
                  'website_intent', 'tier_changed')),
  title        text not null,                 -- "3 SDR roles + Head of Sales in Sales · Wholesale · DACH"
  detail       text,
  strength     int not null default 50 check (strength between 0 and 100),
  occurred_at  timestamptz not null default now(),
  payload      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists signals_org_time_idx on public.signals (org_id, occurred_at desc);
create index if not exists signals_company_idx on public.signals (company_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 8. Account scores (one current row per company) + history for trends
-- ---------------------------------------------------------------------------
create table if not exists public.account_scores (
  company_id      uuid primary key references public.companies (id) on delete cascade,
  org_id          uuid not null references public.organizations (id) on delete cascade,
  cluster_score   int not null default 0,   -- Hiring Cluster Index (best cluster of the account)
  fit_score       int not null default 0,   -- ICP fit
  timing_score    int not null default 0,   -- freshness / buying window
  reach_score     int not null default 0,   -- can we get a reply from the decision maker?
  priority_score  int not null default 0,
  tier            text not null default 'cold' check (tier in ('hot', 'warm', 'cold')),
  bucket          text not null default 'other' check (bucket in
                    ('call_today', 'high_intent_weak_fit', 'net_new', 'warming_up',
                     'recently_contacted', 'routed', 'other')),
  top_reason      text,
  reasons         jsonb not null default '[]',  -- ordered list of "why now" bullets
  previous_tier   text,
  tier_changed_at timestamptz,
  is_new          boolean not null default true, -- first scored in the latest run
  computed_at     timestamptz not null default now()
);
create index if not exists account_scores_org_idx on public.account_scores (org_id, priority_score desc);

create table if not exists public.score_history (
  id              bigint generated always as identity primary key,
  org_id          uuid not null references public.organizations (id) on delete cascade,
  company_id      uuid not null references public.companies (id) on delete cascade,
  priority_score  int not null,
  cluster_score   int not null,
  fit_score       int not null,
  tier            text not null,
  computed_at     timestamptz not null default now()
);
create index if not exists score_history_company_idx on public.score_history (company_id, computed_at desc);

-- ---------------------------------------------------------------------------
-- 9. updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
drop trigger if exists people_updated_at on public.people;
create trigger people_updated_at before update on public.people
  for each row execute function public.set_updated_at();
drop trigger if exists icp_settings_updated_at on public.icp_settings;
create trigger icp_settings_updated_at before update on public.icp_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. Row-level security: members of a workspace read its data.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'icp_settings', 'companies', 'divisions', 'job_postings', 'people', 'research_requests',
    'hiring_clusters', 'signals', 'account_scores', 'score_history'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: members read" on public.%I', t, t);
    execute format('create policy "%s: members read" on public.%I for select to authenticated
                    using (public.is_org_member(org_id))', t, t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Admins edit ICP + scoring settings.
drop policy if exists "icp_settings: admins update" on public.icp_settings;
create policy "icp_settings: admins update" on public.icp_settings
  for update to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
grant update on public.icp_settings to authenticated;

-- Members start research requests (for themselves).
drop policy if exists "research_requests: members insert" on public.research_requests;
create policy "research_requests: members insert" on public.research_requests
  for insert to authenticated
  with check (public.is_org_member(org_id) and requested_by = (select auth.uid()));
grant insert (org_id, linkedin_url) on public.research_requests to authenticated;

-- Members route / disqualify accounts; only these columns are writable.
-- Claiming goes through claim_account() in 003 so nobody overwrites another SDR's claim.
drop policy if exists "companies: members update" on public.companies;
create policy "companies: members update" on public.companies
  for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
grant update (status, routed_to_team) on public.companies to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Realtime: the dashboard listens to these
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['research_requests', 'signals', 'account_scores'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
