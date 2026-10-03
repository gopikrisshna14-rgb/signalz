-- Hiring Signals · 006: entry points for the research pipeline (app → n8n → Apify → Supabase).
-- Run after 005. Safe to re-run.
--
-- n8n needs only two calls, both with the service role key:
--   POST /rest/v1/rpc/set_research_status   { p_request, p_status, p_progress?, p_error? }
--   POST /rest/v1/rpc/ingest_research       { p: { request_id, company, person?, jobs[] } }
-- ingest_research upserts the company, the person, divisions and job postings, closes postings
-- that are no longer listed, re-scores the company and marks the request done, in one transaction.
--
-- The app calls two small RPCs as the signed-in user:
--   mark_research_dispatch(request, ok, error)  after calling the n8n webhook
--   retry_research(request)                     before re-sending a failed request

-- ---------------------------------------------------------------------------
-- 1. Status updates from n8n
-- ---------------------------------------------------------------------------
create or replace function public.set_research_status(
  p_request uuid, p_status text, p_progress int default null, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.research_requests
     set status      = p_status,
         progress    = coalesce(p_progress, case p_status
                         when 'queued' then 0 when 'scraping_profile' then 15 when 'scraping_company' then 35
                         when 'scraping_jobs' then 55 when 'classifying' then 75 when 'scoring' then 90
                         when 'done' then 100 else progress end),
         error       = case when p_status = 'failed' then left(coalesce(p_error, 'unknown error'), 1000) end,
         finished_at = case when p_status in ('done', 'failed') then now() end
   where id = p_request;
  if not found then raise exception 'request_not_found'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Ingest one researched company (+ person + jobs)
-- ---------------------------------------------------------------------------
create or replace function public.ingest_research(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_req     public.research_requests%rowtype;
  v_org     uuid;
  c         jsonb := p -> 'company';
  pe        jsonb := p -> 'person';
  j         jsonb;
  v_domain  text;
  v_li      text;
  v_co      uuid;
  v_person  uuid;
  v_div     uuid;
  v_pdiv    uuid;
  v_fn      text;
  v_sources text[] := '{}';
  v_ids     text[] := '{}';
  v_source  text;
  n         int := 0;
  v_prio    int;
begin
  select * into v_req from public.research_requests where id = (p ->> 'request_id')::uuid;
  if not found then raise exception 'request_not_found'; end if;
  v_org := v_req.org_id;  -- never trust an org id from the payload
  if c is null or coalesce(trim(c ->> 'name'), '') = '' then raise exception 'company_name_missing'; end if;

  -- ---- company: match by LinkedIn URL, then by domain ----
  v_domain := nullif(lower(regexp_replace(coalesce(c ->> 'domain', ''), '^(https?://)?(www\.)?([^/?#]+).*$', '\3')), '');
  v_li := nullif(regexp_replace(coalesce(c ->> 'linkedin_url', ''), '/+$', ''), '');
  select id into v_co from public.companies
   where org_id = v_org
     and ((v_li is not null and linkedin_url = v_li) or (v_domain is not null and lower(domain) = v_domain))
   order by (linkedin_url = v_li) desc nulls last
   limit 1;

  if v_co is null then
    insert into public.companies (org_id, name, domain, linkedin_url, logo_url, industry, employee_count,
                                  employee_growth_6m, hq_country, hq_city, description, current_crm, raw, last_enriched_at)
    values (v_org, left(c ->> 'name', 200), v_domain, v_li, c ->> 'logo_url', c ->> 'industry',
            nullif(c ->> 'employee_count', '')::numeric::int, nullif(c ->> 'employee_growth_6m', '')::numeric,
            upper(nullif(c ->> 'hq_country', '')), c ->> 'hq_city', left(c ->> 'description', 5000),
            lower(nullif(c ->> 'current_crm', '')), c -> 'raw', now())
    returning id into v_co;
  else
    update public.companies set
      name               = coalesce(left(nullif(c ->> 'name', ''), 200), name),
      domain             = coalesce(domain, v_domain),
      linkedin_url       = coalesce(linkedin_url, v_li),
      logo_url           = coalesce(nullif(c ->> 'logo_url', ''), logo_url),
      industry           = coalesce(nullif(c ->> 'industry', ''), industry),
      employee_count     = coalesce(nullif(c ->> 'employee_count', '')::numeric::int, employee_count),
      employee_growth_6m = coalesce(nullif(c ->> 'employee_growth_6m', '')::numeric, employee_growth_6m),
      hq_country         = coalesce(upper(nullif(c ->> 'hq_country', '')), hq_country),
      hq_city            = coalesce(nullif(c ->> 'hq_city', ''), hq_city),
      description        = coalesce(left(nullif(c ->> 'description', ''), 5000), description),
      current_crm        = coalesce(lower(nullif(c ->> 'current_crm', '')), current_crm),
      raw                = coalesce(c -> 'raw', raw),
      last_enriched_at   = now()
    where id = v_co;
  end if;

  -- ---- person (optional) ----
  if pe is not null and coalesce(pe ->> 'linkedin_url', '') <> '' then
    if pe -> 'division' is not null and coalesce(pe -> 'division' ->> 'function', '') <> '' then
      v_fn := lower(pe -> 'division' ->> 'function');
      if v_fn not in ('sales', 'revops', 'marketing', 'customer_success', 'partnerships', 'other') then v_fn := 'other'; end if;
      insert into public.divisions (org_id, company_id, function, business_unit, region)
      values (v_org, v_co, v_fn, coalesce(pe -> 'division' ->> 'business_unit', ''), coalesce(pe -> 'division' ->> 'region', ''))
      on conflict (company_id, function, business_unit, region) do update set region = excluded.region
      returning id into v_pdiv;
    end if;

    insert into public.people as x (
      org_id, company_id, division_id, linkedin_url, full_name, headline, photo_url, current_title, role_family,
      seniority, persona, is_decision_maker, started_current_role_at, location, country, about, previous_roles,
      prior_tools, skills, languages, education, recent_posts, last_post_at, followers, connections,
      mutual_connections, shared_history, raw, last_enriched_at)
    values (
      v_org, v_co, v_pdiv, regexp_replace(pe ->> 'linkedin_url', '/+$', ''), pe ->> 'full_name', pe ->> 'headline',
      pe ->> 'photo_url', pe ->> 'current_title', pe ->> 'role_family', pe ->> 'seniority',
      case when pe ->> 'persona' in ('economic_buyer', 'champion', 'user', 'influencer', 'unknown') then pe ->> 'persona' end,
      coalesce((pe ->> 'is_decision_maker')::boolean, false),
      nullif(pe ->> 'started_current_role_at', '')::date, pe ->> 'location', upper(nullif(pe ->> 'country', '')),
      left(pe ->> 'about', 5000), coalesce(pe -> 'previous_roles', '[]'),
      coalesce(array(select lower(jsonb_array_elements_text(pe -> 'prior_tools'))), '{}'),
      coalesce(array(select jsonb_array_elements_text(pe -> 'skills')), '{}'),
      coalesce(array(select jsonb_array_elements_text(pe -> 'languages')), '{}'),
      coalesce(pe -> 'education', '[]'), coalesce(pe -> 'recent_posts', '[]'),
      nullif(pe ->> 'last_post_at', '')::timestamptz, nullif(pe ->> 'followers', '')::numeric::int,
      nullif(pe ->> 'connections', '')::numeric::int, nullif(pe ->> 'mutual_connections', '')::numeric::int,
      coalesce(array(select jsonb_array_elements_text(pe -> 'shared_history')), '{}'), pe -> 'raw', now())
    on conflict (org_id, linkedin_url) do update set
      company_id = excluded.company_id, division_id = coalesce(excluded.division_id, x.division_id),
      full_name = coalesce(excluded.full_name, x.full_name), headline = coalesce(excluded.headline, x.headline),
      photo_url = coalesce(excluded.photo_url, x.photo_url), current_title = coalesce(excluded.current_title, x.current_title),
      role_family = coalesce(excluded.role_family, x.role_family), seniority = coalesce(excluded.seniority, x.seniority),
      persona = coalesce(excluded.persona, x.persona), is_decision_maker = excluded.is_decision_maker,
      started_current_role_at = coalesce(excluded.started_current_role_at, x.started_current_role_at),
      location = coalesce(excluded.location, x.location), country = coalesce(excluded.country, x.country),
      about = coalesce(excluded.about, x.about), previous_roles = excluded.previous_roles,
      prior_tools = excluded.prior_tools, skills = excluded.skills, languages = excluded.languages,
      education = excluded.education, recent_posts = excluded.recent_posts,
      last_post_at = coalesce(excluded.last_post_at, x.last_post_at), followers = coalesce(excluded.followers, x.followers),
      connections = coalesce(excluded.connections, x.connections),
      mutual_connections = coalesce(excluded.mutual_connections, x.mutual_connections),
      shared_history = excluded.shared_history, raw = coalesce(excluded.raw, x.raw), last_enriched_at = now()
    returning id into v_person;
  end if;

  -- ---- job postings, each in its division ----
  for j in select * from jsonb_array_elements(coalesce(p -> 'jobs', '[]'::jsonb)) loop
    continue when coalesce(j ->> 'external_id', '') = '' or coalesce(j ->> 'title', '') = '';
    v_source := case when j ->> 'source' in ('linkedin', 'careers_page', 'stepstone', 'indeed', 'other') then j ->> 'source' else 'other' end;
    v_div := null;
    if coalesce(j ->> 'function', '') <> '' then
      v_fn := lower(j ->> 'function');
      if v_fn not in ('sales', 'revops', 'marketing', 'customer_success', 'partnerships', 'other') then v_fn := 'other'; end if;
      insert into public.divisions (org_id, company_id, function, business_unit, region)
      values (v_org, v_co, v_fn, coalesce(j ->> 'business_unit', ''), coalesce(j ->> 'region', ''))
      on conflict (company_id, function, business_unit, region) do update set region = excluded.region
      returning id into v_div;
    end if;

    insert into public.job_postings as x (
      org_id, company_id, division_id, source, external_id, url, title, role_family, seniority, location, country,
      remote, posted_at, closed_at, description, crm_mentions, flags, is_excluded, exclusion_reason, classified_by, raw)
    values (
      v_org, v_co, v_div, v_source, j ->> 'external_id', j ->> 'url', left(j ->> 'title', 300),
      case when j ->> 'role_family' in ('sales_leader', 'sdr_bdr', 'account_executive', 'account_manager', 'revops',
                                        'sales_enablement', 'sales_engineer', 'marketing', 'customer_success', 'other')
           then j ->> 'role_family' else 'other' end,
      case when j ->> 'seniority' in ('intern', 'ic', 'lead', 'manager', 'director', 'vp', 'c_level') then j ->> 'seniority' end,
      j ->> 'location', upper(nullif(j ->> 'country', '')), (j ->> 'remote')::boolean,
      coalesce(nullif(j ->> 'posted_at', '')::timestamptz, now()), null, left(j ->> 'description', 20000),
      coalesce(array(select lower(jsonb_array_elements_text(j -> 'crm_mentions'))), '{}'),
      coalesce(array(select lower(jsonb_array_elements_text(j -> 'flags'))), '{}'),
      coalesce((j ->> 'is_excluded')::boolean, false), nullif(j ->> 'exclusion_reason', ''),
      coalesce(nullif(j ->> 'classified_by', ''), 'llm'), j -> 'raw')
    on conflict (org_id, source, external_id) do update set
      company_id = excluded.company_id, division_id = excluded.division_id, url = excluded.url, title = excluded.title,
      role_family = excluded.role_family, seniority = excluded.seniority, location = excluded.location,
      country = excluded.country, remote = excluded.remote, posted_at = excluded.posted_at, closed_at = null,
      description = coalesce(excluded.description, x.description), crm_mentions = excluded.crm_mentions,
      flags = excluded.flags, is_excluded = excluded.is_excluded, exclusion_reason = excluded.exclusion_reason,
      classified_by = excluded.classified_by, raw = coalesce(excluded.raw, x.raw);

    v_ids := v_ids || (j ->> 'external_id');
    if not v_source = any (v_sources) then v_sources := v_sources || v_source; end if;
    n := n + 1;
  end loop;

  -- postings from the same sources that were not in this scrape are closed
  if p ? 'jobs' then
    update public.job_postings
       set closed_at = now()
     where company_id = v_co and closed_at is null and source = any (v_sources) and not (external_id = any (v_ids));
  end if;

  perform public.recompute_company(v_co);
  select priority_score into v_prio from public.account_scores where company_id = v_co;

  update public.research_requests
     set status = 'done', progress = 100, error = null, finished_at = now(), company_id = v_co, person_id = v_person
   where id = v_req.id;

  return jsonb_build_object('company_id', v_co, 'person_id', v_person, 'jobs', n, 'priority', v_prio);
end;
$$;

revoke all on function public.set_research_status(uuid, text, int, text), public.ingest_research(jsonb) from public, anon, authenticated;
grant execute on function public.set_research_status(uuid, text, int, text), public.ingest_research(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Called by the app as the signed-in user
-- ---------------------------------------------------------------------------
-- After calling the n8n webhook: record a failed hand-off so the request does not sit in "Queued".
create or replace function public.mark_research_dispatch(p_request uuid, p_ok boolean, p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_ok then return; end if;
  update public.research_requests
     set status = 'failed', error = left(coalesce(p_error, 'Could not reach the research workflow'), 1000), finished_at = now()
   where id = p_request and requested_by = auth.uid() and status = 'queued';
end;
$$;

-- Retry: the requester or an admin puts a failed request back in the queue.
create or replace function public.retry_research(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_req public.research_requests%rowtype;
begin
  select * into v_req from public.research_requests where id = p_request;
  if not found or not public.is_org_member(v_req.org_id) then raise exception 'not_found'; end if;
  if v_req.requested_by <> auth.uid() and not public.is_org_admin(v_req.org_id) then raise exception 'forbidden'; end if;
  if v_req.status <> 'failed' then raise exception 'not_failed'; end if;
  update public.research_requests
     set status = 'queued', progress = 0, error = null, finished_at = null, created_at = now()
   where id = p_request;
end;
$$;

revoke all on function public.mark_research_dispatch(uuid, boolean, text), public.retry_research(uuid) from public, anon;
grant execute on function public.mark_research_dispatch(uuid, boolean, text), public.retry_research(uuid) to authenticated;
