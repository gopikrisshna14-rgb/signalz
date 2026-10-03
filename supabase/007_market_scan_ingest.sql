-- Hiring Signals · 007: bulk market scan ingest (n8n LinkedIn Jobs scan across a market → existing model).
-- Run after 006. Safe to re-run.
--
-- The single-URL research flow (006, ingest_research) stays as it is. This adds a second entry point for the
-- bulk scan: n8n searches LinkedIn Jobs (e.g. all of Germany), classifies many postings and sends them here in
-- one call. Rows land in the existing tables, so the dashboard, account pages, clusters and scores just work:
--
--   companies → divisions → job_postings → hiring_clusters / signals → account_scores → dashboard
--
-- n8n calls, with the service role key:
--   POST /rest/v1/rpc/ingest_market_scan   { "p": { org_id, n8n_execution_id, status, ..., jobs: [...] } }
--
-- Differences to ingest_research (on purpose):
--   * no research_requests row is needed;
--   * a market search is incomplete by design, so postings missing from a scan are NEVER closed;
--   * jobs carry their own company; postings whose real employer is not identified are skipped.

-- ---------------------------------------------------------------------------
-- 1. Scan runs
-- ---------------------------------------------------------------------------
create table if not exists public.market_scan_runs (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations (id) on delete cascade,
  n8n_execution_id  text,
  status            text not null default 'running' check (status in ('running', 'completed', 'failed')),
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  raw_job_count     int,
  unique_job_count  int,
  company_count     int not null default 0,
  hit_count         int not null default 0,
  apify_cost_usd    numeric(12, 6),
  error             text,
  summary           jsonb not null default '{}',   -- what the last ingest call returned
  created_at        timestamptz not null default now()
);
create unique index if not exists market_scan_runs_execution_idx
  on public.market_scan_runs (org_id, n8n_execution_id) where n8n_execution_id is not null;
create index if not exists market_scan_runs_org_idx on public.market_scan_runs (org_id, created_at desc);

alter table public.market_scan_runs enable row level security;
drop policy if exists "market_scan_runs: members read" on public.market_scan_runs;
create policy "market_scan_runs: members read" on public.market_scan_runs
  for select to authenticated using (public.is_org_member(org_id));
revoke all on public.market_scan_runs from anon, authenticated;
grant select on public.market_scan_runs to authenticated;
-- No insert/update/delete grants: only ingest_market_scan (service role) writes runs.

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
-- "general_sales" → "General Sales" (division labels are shown on the dashboard); readable values stay as sent.
create or replace function public.ms_label(p text)
returns text language sql immutable set search_path = '' as $$
  select case when coalesce(trim(p), '') = '' then ''
              when p ~ '^[a-z0-9_]+$' then initcap(replace(p, '_', ' '))
              else trim(p) end;
$$;

-- Map the classifier's role names onto job_postings.role_family.
create or replace function public.ms_role_family(p text)
returns text language sql immutable set search_path = '' as $$
  select case
    when lower(coalesce(p, '')) in ('sales_leader', 'sales_manager', 'head_of_sales', 'sales_lead', 'vp_sales',
                                     'sales_director', 'manager', 'leader') then 'sales_leader'
    when lower(coalesce(p, '')) in ('account_executive', 'ae') then 'account_executive'
    when lower(coalesce(p, '')) in ('sdr_bdr', 'sdr', 'bdr', 'sales_development_representative',
                                     'business_development_representative') then 'sdr_bdr'
    when lower(coalesce(p, '')) in ('account_manager', 'revops', 'sales_enablement', 'sales_engineer', 'marketing',
                                     'customer_success', 'other') then lower(p)
    else 'other' end;
$$;

-- Stable key for "the same company" inside one payload: normalised LinkedIn URL, else domain, else name.
create or replace function public.ms_company_key(c jsonb)
returns text language sql immutable set search_path = '' as $$
  select lower(coalesce(
    nullif(regexp_replace(regexp_replace(coalesce(c ->> 'linkedin_url', ''), '[?#].*$', ''), '/+$', ''), ''),
    nullif(regexp_replace(coalesce(c ->> 'domain', ''), '^(https?://)?(www\.)?([^/?#]+).*$', '\3'), ''),
    trim(c ->> 'name'), ''));
$$;

revoke all on function public.ms_label(text), public.ms_role_family(text), public.ms_company_key(jsonb) from public, anon, authenticated;
grant execute on function public.ms_label(text), public.ms_role_family(text), public.ms_company_key(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. ingest_market_scan
-- ---------------------------------------------------------------------------
create or replace function public.ingest_market_scan(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org       uuid;
  v_status    text := lower(coalesce(nullif(p ->> 'status', ''), 'completed'));
  v_exec      text := nullif(p ->> 'n8n_execution_id', '');
  v_run       uuid;
  j           jsonb;
  c           jsonb;
  d           jsonb;
  v_ckey      text;
  v_tkey      text;
  v_team      jsonb := '{}';
  v_domain    text;
  v_li        text;
  v_co        uuid;
  v_div       uuid;
  v_fn        text;
  v_source    text;
  v_flags     text[];
  v_inserted  boolean;
  v_job_id    uuid;
  v_ev        jsonb;
  v_companies uuid[] := '{}';
  v_ins       int := 0;
  v_upd       int := 0;
  v_skip      int := 0;
  v_skipped   jsonb := '[]';
  v_signals   int := 0;
  v_scored    int := 0;
  v_hits      int := 0;
  v_id        uuid;
  v_summary   jsonb;
begin
  begin
    v_org := (p ->> 'org_id')::uuid;
  exception when others then
    raise exception 'org_id_invalid';
  end;
  if v_org is null or not exists (select 1 from public.organizations where id = v_org) then
    raise exception 'org_not_found';
  end if;
  if v_status not in ('running', 'completed', 'failed') then raise exception 'status_invalid: %', v_status; end if;

  -- ---- the run record (one per n8n execution; repeated calls update it) ----
  if v_exec is not null then
    select id into v_run from public.market_scan_runs where org_id = v_org and n8n_execution_id = v_exec;
  end if;
  if v_run is null then
    insert into public.market_scan_runs (org_id, n8n_execution_id, status, started_at)
    values (v_org, v_exec, v_status, coalesce(nullif(p ->> 'started_at', '')::timestamptz, now()))
    returning id into v_run;
  end if;

  -- ---- one division per team: jobs the classifier paired (same team_key) share the leader's division ----
  for j in
    select e from jsonb_array_elements(coalesce(p -> 'jobs', '[]'::jsonb)) e
     order by (public.ms_role_family(e ->> 'role_family') = 'sales_leader') desc
  loop
    v_tkey := coalesce(nullif(j ->> 'team_key', ''), nullif(j -> 'raw' ->> 'team_key', ''));
    continue when v_tkey is null or j -> 'division' is null or coalesce(j -> 'division' ->> 'function', '') = '';
    v_ckey := public.ms_company_key(j -> 'company') || '|' || v_tkey;
    if not v_team ? v_ckey then v_team := v_team || jsonb_build_object(v_ckey, j -> 'division'); end if;
  end loop;

  -- ---- jobs ----
  for j in select * from jsonb_array_elements(coalesce(p -> 'jobs', '[]'::jsonb)) loop
    c := j -> 'company';
    if coalesce(j ->> 'external_id', '') = '' or coalesce(j ->> 'title', '') = '' then
      v_skip := v_skip + 1;
      v_skipped := v_skipped || jsonb_build_object('external_id', j ->> 'external_id', 'reason', 'missing external_id or title');
      continue;
    end if;
    -- Recruiters, investors, job boards, "our client"… : no false company identity.
    if c is null or jsonb_typeof(c) <> 'object' or coalesce(trim(c ->> 'name'), '') = ''
       or coalesce((c ->> 'employer_identified')::boolean, true) = false then
      v_skip := v_skip + 1;
      v_skipped := v_skipped || jsonb_build_object('external_id', j ->> 'external_id', 'reason', 'employer not identified');
      continue;
    end if;

    -- company: LinkedIn URL first, then domain
    v_li := nullif(regexp_replace(regexp_replace(coalesce(c ->> 'linkedin_url', ''), '[?#].*$', ''), '/+$', ''), '');
    v_domain := nullif(lower(regexp_replace(coalesce(c ->> 'domain', ''), '^(https?://)?(www\.)?([^/?#]+).*$', '\3')), '');
    v_co := null;
    if v_li is not null then
      select id into v_co from public.companies where org_id = v_org and lower(linkedin_url) = lower(v_li) limit 1;
    end if;
    if v_co is null and v_domain is not null then
      select id into v_co from public.companies where org_id = v_org and lower(domain) = v_domain limit 1;
    end if;
    if v_co is null then
      insert into public.companies (org_id, name, domain, linkedin_url, logo_url, industry, employee_count, hq_country,
                                    hq_city, last_enriched_at)
      values (v_org, left(trim(c ->> 'name'), 200), v_domain, v_li, nullif(c ->> 'logo_url', ''), nullif(c ->> 'industry', ''),
              nullif(c ->> 'employee_count', '')::numeric::int, upper(nullif(c ->> 'hq_country', '')),
              nullif(c ->> 'hq_city', ''), now())
      returning id into v_co;
    else
      -- never overwrite richer data (e.g. from /research) with blanks
      update public.companies set
        linkedin_url     = coalesce(linkedin_url, v_li),
        domain           = coalesce(domain, v_domain),
        logo_url         = coalesce(logo_url, nullif(c ->> 'logo_url', '')),
        industry         = coalesce(industry, nullif(c ->> 'industry', '')),
        employee_count   = coalesce(employee_count, nullif(c ->> 'employee_count', '')::numeric::int),
        hq_country       = coalesce(hq_country, upper(nullif(c ->> 'hq_country', ''))),
        hq_city          = coalesce(hq_city, nullif(c ->> 'hq_city', '')),
        last_enriched_at = now()
      where id = v_co;
    end if;
    if not v_co = any (v_companies) then v_companies := v_companies || v_co; end if;

    -- division (team-paired jobs use the shared division)
    v_tkey := coalesce(nullif(j ->> 'team_key', ''), nullif(j -> 'raw' ->> 'team_key', ''));
    v_ckey := public.ms_company_key(c) || '|' || v_tkey;
    d := coalesce(case when v_tkey is not null then v_team -> v_ckey end, j -> 'division');
    v_div := null;
    -- A team seen before (earlier scan or earlier in this payload) keeps its division, even when only
    -- part of the team is in this payload.
    if v_tkey is not null then
      select jp.division_id into v_div
        from public.job_postings jp
       where jp.company_id = v_co and jp.division_id is not null
         and jp.raw -> 'classifier' ->> 'team_key' = v_tkey
         and jp.external_id <> (j ->> 'external_id')
       order by (jp.role_family = 'sales_leader') desc, jp.created_at
       limit 1;
    end if;
    if v_div is null and d is not null and coalesce(d ->> 'function', '') <> '' then
      v_fn := lower(d ->> 'function');
      if v_fn not in ('sales', 'revops', 'marketing', 'customer_success', 'partnerships', 'other') then v_fn := 'other'; end if;
      insert into public.divisions (org_id, company_id, function, business_unit, region)
      values (v_org, v_co, v_fn, public.ms_label(d ->> 'business_unit'), public.ms_label(d ->> 'region'))
      on conflict (company_id, function, business_unit, region) do update set region = excluded.region
      returning id into v_div;
    end if;

    v_source := case when j ->> 'source' in ('linkedin', 'careers_page', 'stepstone', 'indeed', 'other') then j ->> 'source' else 'other' end;
    v_flags := coalesce(array(select distinct lower(x) from jsonb_array_elements_text(coalesce(j -> 'flags', '[]'::jsonb)) x), '{}');

    insert into public.job_postings as x (
      org_id, company_id, division_id, source, external_id, url, title, role_family, seniority, location, country,
      remote, posted_at, description, crm_mentions, flags, is_excluded, exclusion_reason, classified_by, raw)
    values (
      v_org, v_co, v_div, v_source, j ->> 'external_id', nullif(j ->> 'url', ''), left(j ->> 'title', 300),
      public.ms_role_family(j ->> 'role_family'),
      case when j ->> 'seniority' in ('intern', 'ic', 'lead', 'manager', 'director', 'vp', 'c_level') then j ->> 'seniority' end,
      nullif(j ->> 'location', ''), upper(nullif(j ->> 'country', '')), (j ->> 'remote')::boolean,
      coalesce(nullif(j ->> 'posted_at', '')::timestamptz, now()), left(j ->> 'description', 20000),
      coalesce(array(select lower(y) from jsonb_array_elements_text(coalesce(j -> 'crm_mentions', '[]'::jsonb)) y), '{}'),
      v_flags, coalesce((j ->> 'is_excluded')::boolean, false), nullif(j ->> 'exclusion_reason', ''),
      coalesce(nullif(j ->> 'classified_by', ''), 'llm'),
      -- full classifier output + source evidence, without the long description
      coalesce(j -> 'raw', '{}'::jsonb)
        || jsonb_build_object('classifier', j - 'description' - 'raw',
                              'market_scan', jsonb_build_object('run_id', v_run, 'n8n_execution_id', v_exec, 'seen_at', now())))
    on conflict (org_id, source, external_id) do update set
      company_id       = excluded.company_id,
      division_id      = coalesce(excluded.division_id, x.division_id),
      url              = coalesce(excluded.url, x.url),
      title            = excluded.title,
      role_family      = excluded.role_family,
      seniority        = coalesce(excluded.seniority, x.seniority),
      location         = coalesce(excluded.location, x.location),
      country          = coalesce(excluded.country, x.country),
      remote           = coalesce(excluded.remote, x.remote),
      posted_at        = case when nullif(j ->> 'posted_at', '') is not null then excluded.posted_at else x.posted_at end,
      closed_at        = null,  -- seen live in this scan; a scan never closes anything
      description      = coalesce(excluded.description, x.description),
      crm_mentions     = case when excluded.crm_mentions <> '{}' then excluded.crm_mentions else x.crm_mentions end,
      flags            = excluded.flags,
      is_excluded      = excluded.is_excluded,
      exclusion_reason = excluded.exclusion_reason,
      classified_by    = excluded.classified_by,
      raw              = coalesce(x.raw, '{}'::jsonb) || excluded.raw
    returning id, (xmax = 0) into v_job_id, v_inserted;
    if v_inserted then v_ins := v_ins + 1; else v_upd := v_upd + 1; end if;

    -- founding / build-from-scratch evidence → a normal signal row (once per posting)
    if v_flags && array['founding_team', 'build_from_scratch', 'first_sdr'] then
      v_ev := j -> 'raw' -> 'signal_evidence';
      if not exists (select 1 from public.signals s
                      where s.company_id = v_co and s.type = 'first_sdr' and s.payload ->> 'job_posting_id' = v_job_id::text) then
        insert into public.signals (org_id, company_id, type, title, detail, strength, payload)
        values (v_org, v_co, 'first_sdr', left('Founding GTM role: ' || (j ->> 'title'), 300),
                left(coalesce(v_ev ->> 'reason', case when jsonb_typeof(v_ev) = 'string' then v_ev #>> '{}' end), 2000), 60,
                jsonb_build_object('job_posting_id', v_job_id, 'external_id', j ->> 'external_id', 'source', v_source,
                                   'url', j ->> 'url', 'flags', to_jsonb(v_flags), 'evidence', v_ev,
                                   'market_scan_run_id', v_run));
        v_signals := v_signals + 1;
      end if;
    end if;
  end loop;

  -- ---- score every company this scan touched ----
  foreach v_id in array v_companies loop
    perform public.recompute_company(v_id);
  end loop;
  select count(*) into v_scored from public.account_scores where company_id = any (v_companies);
  select count(distinct company_id) into v_hits from public.hiring_clusters
   where company_id = any (v_companies) and status = 'active';

  v_summary := jsonb_build_object(
    'scan_id', v_run, 'status', v_status, 'companies_touched', coalesce(array_length(v_companies, 1), 0),
    'jobs_inserted', v_ins, 'jobs_updated', v_upd, 'jobs_skipped', v_skip, 'skipped', v_skipped,
    'founding_signals_created', v_signals, 'companies_scored', v_scored, 'hit_count', v_hits);

  update public.market_scan_runs set
    status           = v_status,
    raw_job_count    = coalesce(nullif(p ->> 'raw_job_count', '')::int, raw_job_count),
    unique_job_count = coalesce(nullif(p ->> 'unique_job_count', '')::int, unique_job_count),
    apify_cost_usd   = coalesce(nullif(p ->> 'apify_cost_usd', '')::numeric, apify_cost_usd),
    -- a run may arrive in several batches: count everything this run has touched so far
    company_count    = (select count(distinct jp.company_id) from public.job_postings jp
                         where jp.org_id = v_org and jp.raw -> 'market_scan' ->> 'run_id' = v_run::text),
    hit_count        = (select count(distinct hc.company_id) from public.hiring_clusters hc
                         where hc.status = 'active' and hc.company_id in (
                           select jp.company_id from public.job_postings jp
                            where jp.org_id = v_org and jp.raw -> 'market_scan' ->> 'run_id' = v_run::text)),
    error            = case when v_status = 'failed' then left(coalesce(p ->> 'error', 'unknown error'), 2000) else null end,
    finished_at      = case when v_status in ('completed', 'failed') then coalesce(nullif(p ->> 'finished_at', '')::timestamptz, now()) end,
    summary          = v_summary
  where id = v_run;

  return v_summary;
end;
$$;

revoke all on function public.ingest_market_scan(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_market_scan(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Scoring: a single founding / build-from-scratch role also forms a cluster
--    (identical to 004 except for the v_qual rule marked "007")
-- ---------------------------------------------------------------------------
create or replace function public.recompute_company(p_company uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  c        public.companies%rowtype;
  s        public.icp_settings%rowtype;
  d        record;
  agg      record;
  ldr      record;
  v_cl     public.hiring_clusters%rowtype;
  v_old    public.hiring_clusters%rowtype;
  v_exists boolean;
  v_qual   boolean;
  v_score  int;
  v_bd     jsonb;
  v_cluster int := 0;
  v_fit    int := 0;
  v_timing int := 0;
  v_reach  int := 0;
  v_prio   int;
  v_tier   text;
  v_bucket text;
  v_prev   public.account_scores%rowtype;
  v_reasons jsonb := '[]';
  v_days   numeric;
  best     record;
  p        record;
begin
  select * into c from public.companies where id = p_company;
  if not found then return null; end if;
  select * into s from public.icp_settings where org_id = c.org_id;
  if not found then
    insert into public.icp_settings (org_id) values (c.org_id) returning * into s;
  end if;

  -- Mark postings that are "sales" in title only (shop floor, call center, …). Re-evaluated on
  -- every run so pattern changes apply; exclusions set by the LLM classifier are left alone.
  update public.job_postings jp
     set is_excluded = x.hit,
         exclusion_reason = case when x.hit then 'title matches excluded pattern' end
    from (
      select j.id, exists (select 1 from unnest(s.excluded_title_patterns) pat where j.title ~* pat) as hit
        from public.job_postings j
       where j.company_id = p_company
    ) x
   where jp.id = x.id and jp.is_excluded <> x.hit
     and (jp.exclusion_reason is null or jp.exclusion_reason = 'title matches excluded pattern');

  -- ---- clusters, one per division in a target function ----
  for d in
    select * from public.divisions where company_id = p_company and function = any (s.target_functions)
  loop
    with js as (
      select * from public.job_postings
       where division_id = d.id and not is_excluded and closed_at is null
         and posted_at >= now() - make_interval(days => s.cluster_window_days)
    )
    select count(*)                                                                as open_roles,
           count(*) filter (where role_family = 'sales_leader'
                              or seniority in ('director', 'vp', 'c_level'))       as leader_roles,
           count(*) filter (where role_family in ('sdr_bdr', 'account_executive'))  as builder_roles,
           count(*) filter (where role_family in ('revops', 'sales_enablement'))    as revops_roles,
           count(*) filter (where posted_at >= now() - interval '14 days')          as last_14d,
           coalesce((select array_agg(distinct m order by m) from js, unnest(js.crm_mentions) m), '{}') as crm,
           coalesce((select array_agg(distinct f order by f) from js, unnest(js.flags) f), '{}')        as flags
      into agg
      from js;

    -- newest sales leader who started in this division (or company, if division unknown) within the tenure window
    select pe.id, (current_date - pe.started_current_role_at) as days
      into ldr
      from public.people pe
     where pe.company_id = p_company
       and (pe.division_id = d.id or (pe.division_id is null and d.function = 'sales'))
       and pe.started_current_role_at >= current_date - s.leader_tenure_days
       and (pe.role_family = 'sales_leader' or pe.seniority in ('director', 'vp', 'c_level'))
     order by pe.started_current_role_at desc
     limit 1;

    -- 007: a single open role that is explicitly about building the function (founding / first SDR /
    -- build from scratch) is a cluster too: greenfield teams start with one hire.
    v_qual := agg.open_roles >= s.min_cluster_roles
              or (ldr.id is not null and agg.open_roles >= 1)
              or (agg.open_roles >= 1 and agg.flags && array['founding_team', 'build_from_scratch', 'first_sdr']);

    select * into v_old from public.hiring_clusters where company_id = p_company and division_id = d.id;
    v_exists := found;

    if not v_qual then
      if v_exists and v_old.status = 'active' then
        update public.hiring_clusters
           set status = case when agg.open_roles >= 1 then 'cooling' else 'closed' end,
               open_roles = agg.open_roles, cluster_score = 0, last_changed_at = now()
         where id = v_old.id;
      end if;
      continue;
    end if;

    v_bd := jsonb_build_object(
      'roles',    least(agg.open_roles, 3) * 15,
      'mix',      case when (agg.leader_roles > 0 or ldr.id is not null) and agg.builder_roles > 0 then 20
                       when agg.builder_roles >= 2 then 10 else 0 end,
      'new_leader', case when ldr.id is null then 0 when ldr.days <= 30 then 20
                         when ldr.days <= 60 then 15 else 10 end,
      'crm',      case when exists (select 1 from unnest(agg.crm) x where x <> s.own_product_crm) then 10
                       when agg.crm <> '{}' then 5 else 0 end,
      'flags',    case when agg.flags && array['first_sdr', 'founding_team', 'build_from_scratch', 'new_region'] then 10 else 0 end,
      'velocity', case when agg.last_14d >= 2 then 5 else 0 end,
      'revops',   case when agg.revops_roles > 0 then 5 else 0 end
    );
    v_score := least(100, (select sum(value::int) from jsonb_each_text(v_bd)));

    insert into public.hiring_clusters as hc (
      org_id, company_id, division_id, open_roles, leader_roles, builder_roles, revops_roles, roles_last_14d,
      new_leader_person_id, new_leader_days, crm_mentions, flags, cluster_score, score_breakdown, status, last_changed_at)
    values (
      c.org_id, p_company, d.id, agg.open_roles, agg.leader_roles, agg.builder_roles, agg.revops_roles, agg.last_14d,
      ldr.id, ldr.days, agg.crm, agg.flags, v_score, v_bd, 'active', now())
    on conflict (company_id, division_id) do update set
      open_roles = excluded.open_roles, leader_roles = excluded.leader_roles,
      builder_roles = excluded.builder_roles, revops_roles = excluded.revops_roles,
      roles_last_14d = excluded.roles_last_14d, new_leader_person_id = excluded.new_leader_person_id,
      new_leader_days = excluded.new_leader_days, crm_mentions = excluded.crm_mentions, flags = excluded.flags,
      cluster_score = excluded.cluster_score, score_breakdown = excluded.score_breakdown, status = 'active',
      last_changed_at = case when hc.open_roles <> excluded.open_roles or hc.status <> 'active'
                             then now() else hc.last_changed_at end
    returning * into v_cl;

    if not v_exists or v_old.status <> 'active' then
      insert into public.signals (org_id, company_id, cluster_id, person_id, type, title, strength, payload)
      values (c.org_id, p_company, v_cl.id, ldr.id, 'hiring_cluster',
              agg.open_roles || case when agg.open_roles = 1 then ' open role in ' else ' open roles in ' end || d.label
                || case when ldr.id is not null then ' + new leader (' || ldr.days || ' days in)' else '' end,
              v_score, v_bd);
    elsif agg.open_roles > v_old.open_roles then
      insert into public.signals (org_id, company_id, cluster_id, type, title, strength, payload)
      values (c.org_id, p_company, v_cl.id, 'cluster_grew',
              d.label || ': ' || v_old.open_roles || ' → ' || agg.open_roles || ' open roles',
              v_score, jsonb_build_object('from', v_old.open_roles, 'to', agg.open_roles));
    end if;
    if ldr.id is not null and v_exists and v_old.new_leader_person_id is distinct from ldr.id then
      insert into public.signals (org_id, company_id, cluster_id, person_id, type, title, strength)
      values (c.org_id, p_company, v_cl.id, ldr.id, 'new_sales_leader',
              'New sales leader in ' || d.label || ' (' || ldr.days || ' days in)', v_score);
    end if;
  end loop;

  -- also flag clusters whose division left target_functions
  update public.hiring_clusters hc set status = 'closed', cluster_score = 0
   where hc.company_id = p_company and hc.status = 'active'
     and not exists (select 1 from public.divisions dv
                     where dv.id = hc.division_id and dv.function = any (s.target_functions));

  -- ---- account-level scores ----
  select hc.*, dv.label into best
    from public.hiring_clusters hc join public.divisions dv on dv.id = hc.division_id
   where hc.company_id = p_company and hc.status = 'active'
   order by hc.cluster_score desc, hc.open_roles desc
   limit 1;
  v_cluster := coalesce(best.cluster_score, 0);

  v_fit := least(100,
      case when c.employee_count is null then 10
           when c.employee_count between s.min_employees and s.max_employees then 35
           when c.employee_count between s.min_employees / 2 and s.max_employees * 2 then 15 else 0 end
    + case when c.hq_country is null then 10 when c.hq_country = any (s.target_countries) then 25 else 0 end
    + case when s.target_industries = '{}' then 15 when c.industry = any (s.target_industries) then 15 else 0 end
    + case when c.current_crm = s.own_product_crm then 0
           when c.current_crm in ('none', 'spreadsheet') then 15
           when c.current_crm is null or c.current_crm = 'unknown' then 8 else 10 end
    + case when c.employee_growth_6m >= 10 then 10 when c.employee_growth_6m >= 0 then 5 else 0 end);

  select least(
           extract(epoch from now() - max(jp.posted_at)) / 86400,
           coalesce(best.new_leader_days, 9999))
    into v_days
    from public.job_postings jp
   where jp.company_id = p_company and not jp.is_excluded and jp.closed_at is null
     and jp.division_id in (select division_id from public.hiring_clusters
                            where company_id = p_company and status = 'active');
  -- least() ignores nulls, so v_days is null only when there is neither a posting nor a new leader
  v_timing := coalesce(round(100 * exp(-v_days / 30.0)), 0);

  select pe.*,
         least(100,
             case when pe.is_decision_maker then 30 else 10 end
           + case when pe.last_post_at >= now() - interval '30 days' then 20 else 0 end
           + case when pe.mutual_connections >= 5 then 20 when pe.mutual_connections > 0 then 15 else 0 end
           + case when s.own_product_crm = any (pe.prior_tools) then 20 else 0 end
           + case when pe.shared_history <> '{}' then 10 else 0 end
           + case when pe.email is not null then 5 else 0 end) as reach
    into p
    from public.people pe
   where pe.company_id = p_company
   order by pe.is_decision_maker desc, reach desc
   limit 1;
  v_reach := coalesce(p.reach, 0);

  v_prio := least(100, round(
      (s.weights ->> 'cluster')::numeric * v_cluster
    + (s.weights ->> 'fit')::numeric     * v_fit
    + (s.weights ->> 'timing')::numeric  * v_timing
    + (s.weights ->> 'reach')::numeric   * v_reach
    + 0.10 * coalesce(c.website_intent, 0)));

  v_tier := case when v_prio >= s.hot_threshold then 'hot' when v_prio >= s.warm_threshold then 'warm' else 'cold' end;

  v_bucket := case
    when c.status = 'routed' then 'routed'
    when exists (select 1 from public.outreach_events oe
                 where oe.company_id = p_company and oe.occurred_at >= now() - interval '14 days') then 'recently_contacted'
    when c.status in ('customer', 'open_opportunity', 'disqualified') then 'other'
    when v_cluster >= 60 and v_fit >= 60 then 'call_today'
    when v_cluster >= 60 then 'high_intent_weak_fit'
    when c.crm_external_id is null and v_prio >= s.warm_threshold then 'net_new'
    when v_cluster >= 30 then 'warming_up'
    else 'other' end;

  -- "why now" bullets, strongest first
  if best.id is not null then
    v_reasons := v_reasons || to_jsonb(best.open_roles || case when best.open_roles = 1 then ' open role in ' else ' open roles in ' end || best.label
                   || ' (' || best.builder_roles || ' SDR/AE, ' || best.leader_roles || ' leader)');
    if best.new_leader_days is not null then
      v_reasons := v_reasons || to_jsonb('New sales leader, ' || best.new_leader_days || ' days in the role');
    end if;
    if best.crm_mentions <> '{}' then
      v_reasons := v_reasons || to_jsonb('Job ads mention ' || array_to_string(best.crm_mentions, ', '));
    end if;
    if best.flags && array['first_sdr', 'founding_team', 'build_from_scratch'] then
      v_reasons := v_reasons || to_jsonb('Building the sales team from scratch'::text);
    end if;
    if 'new_region' = any (best.flags) then
      v_reasons := v_reasons || to_jsonb('Expanding into a new region'::text);
    end if;
  end if;
  if p.id is not null and s.own_product_crm = any (p.prior_tools) then
    v_reasons := v_reasons || to_jsonb(coalesce(p.full_name, 'Decision maker') || ' used ' || s.own_product_crm || ' before');
  end if;
  if c.employee_growth_6m >= 10 then
    v_reasons := v_reasons || to_jsonb('Headcount +' || round(c.employee_growth_6m) || ' % in 6 months');
  end if;

  select * into v_prev from public.account_scores where company_id = p_company;

  insert into public.account_scores as a (
    company_id, org_id, cluster_score, fit_score, timing_score, reach_score, priority_score, tier, bucket,
    top_reason, reasons, previous_tier, tier_changed_at, is_new, computed_at)
  values (
    p_company, c.org_id, v_cluster, v_fit, v_timing, v_reach, v_prio, v_tier, v_bucket,
    v_reasons ->> 0, v_reasons, null, now(), true, now())
  on conflict (company_id) do update set
    cluster_score = excluded.cluster_score, fit_score = excluded.fit_score, timing_score = excluded.timing_score,
    reach_score = excluded.reach_score, priority_score = excluded.priority_score, tier = excluded.tier,
    bucket = excluded.bucket, top_reason = excluded.top_reason, reasons = excluded.reasons,
    previous_tier = case when a.tier <> excluded.tier then a.tier else a.previous_tier end,
    tier_changed_at = case when a.tier <> excluded.tier then now() else a.tier_changed_at end,
    is_new = false, computed_at = now();

  insert into public.score_history (org_id, company_id, priority_score, cluster_score, fit_score, tier)
  values (c.org_id, p_company, v_prio, v_cluster, v_fit, v_tier);

  if v_prev.company_id is not null and v_prev.tier <> v_tier
     and array_position(array['cold', 'warm', 'hot'], v_tier) > array_position(array['cold', 'warm', 'hot'], v_prev.tier) then
    insert into public.signals (org_id, company_id, type, title, strength, payload)
    values (c.org_id, p_company, 'tier_changed', initcap(v_prev.tier) || ' → ' || initcap(v_tier), v_prio,
            jsonb_build_object('from', v_prev.tier, 'to', v_tier));
  end if;

  return v_prio;
end;
$$;


revoke all on function public.recompute_company(uuid) from public, anon, authenticated;
grant execute on function public.recompute_company(uuid) to service_role;
