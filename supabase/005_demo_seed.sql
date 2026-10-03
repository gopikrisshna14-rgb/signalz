-- Hiring Signals · 005 (optional): demo data for the hackathon.
-- Run after 004. Then, once you have created your workspace in the app:
--   select public.seed_demo('<your org id>');
-- Removes nothing; re-running adds nothing twice (keyed on domain / linkedin_url / external_id).
-- All companies and people below are fictional.

create or replace function public.seed_demo(p_org uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_co   uuid;
  v_div  uuid;
  v_div2 uuid;
  r      record;
  n      int := 0;
begin
  if auth.role() <> 'service_role' and not public.is_org_admin(p_org) then raise exception 'forbidden'; end if;

  for r in select * from (values
    -- name, domain, industry, employees, country, city, crm, growth, bu, region, leader_days, roles
    ('Laufwerk Sneakers',  'laufwerk-sneakers.example', 'Footwear & Apparel', 420,  'DE', 'Berlin',     'salesforce', 18.0, 'Wholesale',  'DACH', 21,   'sdr,sdr,ae,leader'),
    ('Kicks Kollektiv',    'kicks-kollektiv.example',   'Footwear & Apparel', 160,  'DE', 'Hamburg',    'none',       12.0, 'B2B',        'DACH', null, 'sdr,sdr,revops'),
    ('Sohle & Co',         'sohle-co.example',          'Footwear & Apparel', 95,   'AT', 'Wien',       'unknown',    4.0,  'Retail Partnerships', 'DACH', 75, 'ae'),
    ('Fahrwerk Mobility',  'fahrwerk.example',          'Mobility',           150,  'DE', 'München',    'pipedrive',  9.0,  'Fleet',      'DACH', 40,   'sdr,ae,ae'),
    ('Grünwerk Energie',   'gruenwerk.example',         'Energy',             610,  'DE', 'Köln',       'salesforce', 22.0, 'SME',        'DACH', null, 'sdr,sdr,sdr,leader'),
    ('Nomad Travel Tech',  'nomadtravel.example',       'Travel Software',    80,   'CH', 'Zürich',     'spreadsheet',30.0, '',           'EMEA', 12,   'sdr,leader'),
    ('Pflegedienst Sonnenhof', 'sonnenhof.example',     'Healthcare',         2400, 'DE', 'Leipzig',    'unknown',    1.0,  '',           'DACH', null, 'ae,ae'),
    ('Atelier Nordlicht',  'nordlicht.example',         'Footwear & Apparel', 300,  'DK', 'Kopenhagen', 'hubspot',    3.0,  'Wholesale',  'Nordics', null, 'sdr')
  ) as t(name, domain, industry, emp, country, city, crm, growth, bu, region, leader_days, roles)
  loop
    insert into public.companies (org_id, name, domain, linkedin_url, industry, employee_count, hq_country, hq_city,
                                  current_crm, employee_growth_6m, last_enriched_at)
    values (p_org, r.name, r.domain, 'https://www.linkedin.com/company/' || split_part(r.domain, '.', 1),
            r.industry, r.emp, r.country, r.city, r.crm, r.growth, now())
    on conflict (org_id, lower(domain)) where domain is not null do update set name = excluded.name
    returning id into v_co;

    insert into public.divisions (org_id, company_id, function, business_unit, region)
    values (p_org, v_co, 'sales', r.bu, r.region)
    on conflict (company_id, function, business_unit, region) do update set region = excluded.region
    returning id into v_div;

    -- one decoy division so the demo shows that roles in OTHER divisions do not cluster
    insert into public.divisions (org_id, company_id, function, business_unit, region)
    values (p_org, v_co, 'sales', 'Retail Stores', r.region)
    on conflict (company_id, function, business_unit, region) do update set region = excluded.region
    returning id into v_div2;

    insert into public.job_postings (org_id, company_id, division_id, source, external_id, url, title, role_family,
                                     seniority, country, posted_at, crm_mentions, flags, classified_by)
    select p_org, v_co, v_div, 'linkedin', r.domain || '-' || i, 'https://www.linkedin.com/jobs/view/demo-' || i,
           case role when 'sdr'    then 'Sales Development Representative (m/w/d) – ' || coalesce(nullif(r.bu, ''), 'Sales')
                     when 'ae'     then 'Account Executive ' || coalesce(nullif(r.bu, ''), '') || ' ' || r.region
                     when 'leader' then 'Head of Sales ' || coalesce(nullif(r.bu, ''), '') || ' ' || r.region
                     when 'revops' then 'Revenue Operations Manager' end,
           case role when 'sdr' then 'sdr_bdr' when 'ae' then 'account_executive'
                     when 'leader' then 'sales_leader' when 'revops' then 'revops' end,
           case role when 'leader' then 'director' when 'revops' then 'manager' else 'ic' end,
           r.country,
           now() - make_interval(days => ((i * 6) % 40)::int),
           case when r.crm in ('salesforce', 'pipedrive', 'hubspot') and i = 1 then array[r.crm] else '{}' end,
           case when r.crm in ('none', 'spreadsheet') and role = 'sdr' and i = 1 then array['first_sdr', 'build_from_scratch']
                when r.region = 'EMEA' then array['new_region'] else '{}' end,
           'rules'
    from unnest(string_to_array(r.roles, ',')) with ordinality as u(role, i)
    on conflict (org_id, source, external_id) do nothing;

    -- shop-floor "sales" role: excluded by excluded_title_patterns, never counts
    insert into public.job_postings (org_id, company_id, division_id, source, external_id, title, role_family,
                                     seniority, country, posted_at, classified_by)
    values (p_org, v_co, v_div2, 'careers_page', r.domain || '-store', 'Sales Associate Store ' || r.city,
            'other', 'ic', r.country, now() - interval '3 days', 'rules')
    on conflict (org_id, source, external_id) do nothing;

    insert into public.people (org_id, company_id, division_id, linkedin_url, full_name, headline, current_title,
                               role_family, seniority, persona, is_decision_maker, started_current_role_at,
                               location, country, prior_tools, mutual_connections, last_post_at, last_enriched_at)
    values (p_org, v_co, v_div, 'https://www.linkedin.com/in/demo-' || split_part(r.domain, '.', 1),
            (array['Jonas Weber', 'Lea Hoffmann', 'Markus Zimmermann', 'Sofia Rossi', 'Max Bauer',
                   'Elif Yilmaz', 'Hannah Schulz', 'Mads Jensen'])[n + 1],
            'Head of Sales ' || coalesce(nullif(r.bu, ''), '') || ' @ ' || r.name,
            'Head of Sales ' || coalesce(nullif(r.bu, ''), ''),
            'sales_leader', 'director', 'economic_buyer', true,
            case when r.leader_days is not null then current_date - r.leader_days::int else current_date - 700 end,
            r.city, r.country,
            case when n % 3 = 0 then array['hubspot', 'outreach'] else array['salesforce'] end,
            (n * 3) % 9,
            case when n % 2 = 0 then now() - interval '5 days' else now() - interval '60 days' end,
            now())
    on conflict (org_id, linkedin_url) do nothing;

    perform public.recompute_company(v_co);
    n := n + 1;
  end loop;

  insert into public.message_templates (org_id, name, angle, body)
  select p_org, x.name, x.angle, x.body from (values
    ('First 90 days',      'new_leader_90_days',
     'Hi {{first_name}}, congrats on the new role at {{company}}. Most sales leaders I talk to spend their first 90 days fixing pipeline visibility before they scale the team. Saw you are hiring {{open_roles}} roles in {{division}} – how are you planning to onboard them?'),
    ('SDR team build-out', 'sdr_team_buildout',
     'Hi {{first_name}}, noticed {{company}} is hiring {{open_roles}} SDRs/AEs in {{division}} at once. Teams that scale outbound this fast usually hit a sequencing and reporting wall around rep #4. Worth a 15-min swap on how others set this up?'),
    ('CRM displacement',   'crm_displacement',
     'Hi {{first_name}}, your job ads for {{division}} mention {{crm}}. Curious whether the new reps will live in it day to day or mostly in spreadsheets – happy to share what we see at similar {{industry}} teams.')
  ) as x(name, angle, body)
  where not exists (select 1 from public.message_templates mt where mt.org_id = p_org and mt.name = x.name);

  return n;
end;
$$;
revoke all on function public.seed_demo(uuid) from public, anon;
grant execute on function public.seed_demo(uuid) to authenticated, service_role;
