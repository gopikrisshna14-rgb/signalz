-- Hiring Signals · 004: cluster detection, scoring, and the views the dashboard reads.
-- Run after 003. Safe to re-run.
--
-- n8n calls  rpc/recompute_company  (service role) after every scrape.
-- Admins call rpc/rescore_org after changing weights in Settings → Scoring.
--
-- Scores (all 0–100):
--   cluster  Hiring Cluster Index: open sales roles in ONE division, leader + builder mix,
--            a new sales leader in the first 90 days, CRM mentioned in JDs, "first SDR" style flags, velocity
--   fit      ICP fit: headcount band, country, industry, current CRM, headcount growth
--   timing   freshness: 100 × e^(−days since the newest posting or the leader's start / 30)
--   reach    can we reach the decision maker: identified, active on LinkedIn, mutuals,
--            used our product before, shared history, e-mail known
--   priority Σ weight × score (+10 % of website intent if you have it)

-- ---------------------------------------------------------------------------
-- 1. Recompute one company: clusters → signals → account score
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

    v_qual := agg.open_roles >= s.min_cluster_roles or (ldr.id is not null and agg.open_roles >= 1);

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

-- Admin button "Re-score all accounts" (after changing weights or ICP).
create or replace function public.rescore_org(p_org uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  n int := 0;
begin
  if auth.role() <> 'service_role' and not public.is_org_admin(p_org) then raise exception 'forbidden'; end if;
  for v_id in select id from public.companies where org_id = p_org loop
    perform public.recompute_company(v_id);
    n := n + 1;
  end loop;
  insert into public.audit_log (org_id, actor_id, action, meta)
  values (p_org, auth.uid(), 'scores.recomputed', jsonb_build_object('companies', n));
  return n;
end;
$$;
revoke all on function public.rescore_org(uuid) from public, anon;
grant execute on function public.rescore_org(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Views (security_invoker → RLS of the caller applies)
-- ---------------------------------------------------------------------------

-- Main table + scatter plot: one row per scored account.
create or replace view public.v_accounts with (security_invoker = true) as
select
  co.id, co.org_id, co.name, co.domain, co.logo_url, co.linkedin_url, co.industry, co.employee_count,
  co.hq_country, co.hq_city, co.current_crm, co.status, co.owner_id, co.crm_external_id,
  co.crm_external_id is null                         as is_net_new,
  owner.full_name                                    as owner_name,
  sc.priority_score, sc.cluster_score, sc.fit_score, sc.timing_score, sc.reach_score,
  sc.tier, sc.previous_tier, sc.tier_changed_at, sc.bucket, sc.top_reason, sc.reasons, sc.is_new,
  (sc.tier_changed_at >= now() - interval '24 hours' and sc.previous_tier is not null) or sc.is_new as changed_24h,
  cl.division_label, cl.open_roles, cl.leader_roles, cl.builder_roles, cl.new_leader_days,
  dm.id               as contact_id,
  dm.full_name        as contact_name,
  dm.current_title    as contact_title,
  dm.linkedin_url     as contact_linkedin,
  dm.photo_url        as contact_photo,
  greatest(lp.last_posted, dm.started_current_role_at::timestamptz) as last_signal_at,
  lo.last_outreach_at
from public.companies co
join public.account_scores sc on sc.company_id = co.id
left join public.profiles owner on owner.id = co.owner_id
left join lateral (
  select dv.label as division_label, hc.open_roles, hc.leader_roles, hc.builder_roles, hc.new_leader_days
  from public.hiring_clusters hc join public.divisions dv on dv.id = hc.division_id
  where hc.company_id = co.id and hc.status = 'active'
  order by hc.cluster_score desc limit 1
) cl on true
left join lateral (
  select pe.* from public.people pe where pe.company_id = co.id
  order by pe.is_decision_maker desc, pe.started_current_role_at desc nulls last limit 1
) dm on true
left join lateral (
  select max(posted_at) as last_posted from public.job_postings jp
  where jp.company_id = co.id and not jp.is_excluded
) lp on true
left join lateral (
  select max(occurred_at) as last_outreach_at from public.outreach_events oe where oe.company_id = co.id
) lo on true;

-- KPI tiles.
create or replace view public.v_kpis with (security_invoker = true) as
select
  org_id,
  count(*) filter (where bucket = 'call_today')                         as call_today,
  count(*) filter (where is_net_new and tier <> 'cold')                 as net_new,
  count(*) filter (where changed_24h)                                   as new_or_upgraded_24h,
  count(*) filter (where new_leader_days is not null)                   as with_new_leader,
  count(*) filter (where open_roles is not null)                        as active_clusters,
  count(*) filter (where bucket = 'routed')                             as routed,
  round(avg(priority_score) filter (where tier = 'hot'))                as avg_hot_priority
from public.v_accounts
group by org_id;

-- "Just changed" feed (last 7 days).
create or replace view public.v_just_changed with (security_invoker = true) as
select si.id, si.org_id, si.company_id, co.name as company_name, si.type, si.title, si.strength,
       si.occurred_at, owner.full_name as owner_name
from public.signals si
join public.companies co on co.id = si.company_id
left join public.profiles owner on owner.id = co.owner_id
where si.occurred_at >= now() - interval '7 days'
  and si.type in ('tier_changed', 'hiring_cluster', 'cluster_grew', 'new_sales_leader', 'first_sdr', 'new_region');

-- Heatmap A: postings per division per week (last 12 weeks), for the cluster explorer.
create or replace view public.v_heatmap_division_week with (security_invoker = true) as
select jp.org_id, jp.company_id, co.name as company_name, dv.id as division_id, dv.label as division_label,
       date_trunc('week', jp.posted_at)::date as week_start, count(*) as roles
from public.job_postings jp
join public.divisions dv on dv.id = jp.division_id
join public.companies co on co.id = jp.company_id
where not jp.is_excluded and jp.posted_at >= now() - interval '12 weeks'
group by 1, 2, 3, 4, 5, 6;

-- Heatmap B: where is the market hiring? function × region, across all accounts.
create or replace view public.v_heatmap_function_region with (security_invoker = true) as
select hc.org_id, dv.function, coalesce(nullif(dv.region, ''), 'Unknown') as region,
       count(*) as clusters, sum(hc.open_roles) as open_roles, round(avg(hc.cluster_score)) as avg_score
from public.hiring_clusters hc join public.divisions dv on dv.id = hc.division_id
where hc.status = 'active'
group by 1, 2, 3;

-- Outreach analytics: which angle converts (accept → reply → meeting).
create or replace view public.v_outreach_by_angle with (security_invoker = true) as
select org_id, coalesce(angle, 'custom') as angle,
       count(*) filter (where event_type in ('connection_sent', 'message_sent', 'inmail_sent', 'email_sent')) as sent,
       count(*) filter (where event_type = 'connection_accepted')                         as accepted,
       count(*) filter (where event_type = 'link_clicked')                                as clicks,
       count(*) filter (where event_type in ('replied', 'positive_reply'))                as replies,
       count(*) filter (where event_type = 'positive_reply')                              as positive,
       count(*) filter (where event_type = 'meeting_booked')                              as meetings
from public.outreach_events
where occurred_at >= now() - interval '90 days'
group by 1, 2;

-- Leaderboard per SDR (last 30 days).
create or replace view public.v_outreach_by_user with (security_invoker = true) as
select oe.org_id, oe.user_id, pr.full_name,
       count(*) filter (where event_type in ('connection_sent', 'message_sent', 'inmail_sent', 'email_sent')) as sent,
       count(*) filter (where event_type in ('replied', 'positive_reply'))  as replies,
       count(*) filter (where event_type = 'meeting_booked')                as meetings,
       count(distinct company_id)                                           as accounts_touched
from public.outreach_events oe left join public.profiles pr on pr.id = oe.user_id
where oe.occurred_at >= now() - interval '30 days'
group by 1, 2, 3;

-- Heatmap C: best time to send (reply rate by weekday × hour of the message that got the reply).
create or replace view public.v_reply_time_heatmap with (security_invoker = true) as
with sent as (
  select org_id, person_id, occurred_at from public.outreach_events
  where event_type in ('message_sent', 'inmail_sent', 'email_sent') and person_id is not null
    and occurred_at >= now() - interval '180 days'
)
select s.org_id,
       extract(isodow from s.occurred_at)::int as weekday,   -- 1 = Monday
       extract(hour from s.occurred_at)::int   as hour,       -- UTC; convert in the UI
       count(*) as sent,
       count(*) filter (where exists (
         select 1 from public.outreach_events r
         where r.person_id = s.person_id and r.event_type in ('replied', 'positive_reply')
           and r.occurred_at between s.occurred_at and s.occurred_at + interval '7 days')) as replied
from sent s
group by 1, 2, 3;

-- ---------------------------------------------------------------------------
-- 3. CRM-ready export rows (the CRM push maps these columns via crm_field_mappings)
-- ---------------------------------------------------------------------------
create or replace view public.v_crm_company_export with (security_invoker = true) as
select a.id as company_id, a.org_id, a.crm_external_id,
       a.name, a.domain, a.linkedin_url, a.industry, a.employee_count as number_of_employees,
       a.hq_country as country, a.hq_city as city,
       a.priority_score as signal_priority, a.tier as signal_tier, a.bucket as signal_bucket,
       a.cluster_score as hiring_cluster_index, a.fit_score as icp_fit,
       a.division_label as hiring_division, a.open_roles as open_sales_roles,
       a.new_leader_days as new_leader_days_in_role,
       a.top_reason as signal_top_reason,
       (select string_agg(r, ' • ') from jsonb_array_elements_text(a.reasons) r) as signal_reasons,
       a.last_signal_at, a.owner_name as signal_owner
from public.v_accounts a;

create or replace view public.v_crm_contact_export with (security_invoker = true) as
select pe.id as person_id, pe.org_id, pe.company_id, co.crm_external_id as company_crm_id,
       split_part(pe.full_name, ' ', 1) as first_name,
       nullif(substr(pe.full_name, length(split_part(pe.full_name, ' ', 1)) + 2), '') as last_name,
       pe.current_title as job_title, pe.email, pe.linkedin_url, pe.location, pe.country,
       pe.persona, pe.is_decision_maker, pe.started_current_role_at as role_start_date,
       (current_date - pe.started_current_role_at) as days_in_role,
       array_to_string(pe.prior_tools, ', ') as prior_tools
from public.people pe join public.companies co on co.id = pe.company_id;

grant select on public.v_accounts, public.v_kpis, public.v_just_changed, public.v_heatmap_division_week,
  public.v_heatmap_function_region, public.v_outreach_by_angle, public.v_outreach_by_user,
  public.v_reply_time_heatmap, public.v_crm_company_export, public.v_crm_contact_export to authenticated;
revoke all on public.v_accounts, public.v_kpis, public.v_just_changed, public.v_heatmap_division_week,
  public.v_heatmap_function_region, public.v_outreach_by_angle, public.v_outreach_by_user,
  public.v_reply_time_heatmap, public.v_crm_company_export, public.v_crm_contact_export from anon;

-- ---------------------------------------------------------------------------
-- 4. Logging outreach moves the account to "Recently contacted" right away
-- ---------------------------------------------------------------------------
create or replace function public.outreach_rescore()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.recompute_company(new.company_id);
  return new;
end;
$$;
drop trigger if exists outreach_events_rescore on public.outreach_events;
create trigger outreach_events_rescore after insert on public.outreach_events
  for each row execute function public.outreach_rescore();
