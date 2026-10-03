-- Hiring Signals · 003: outreach tracking, message templates, tracked links,
-- CRM connections + field mappings + sync log, API keys, audit log.
-- Run after 002. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Message templates, one per outreach angle
-- ---------------------------------------------------------------------------
create table if not exists public.message_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  channel     text not null default 'linkedin' check (channel in ('linkedin', 'email', 'phone')),
  angle       text not null check (angle in
                ('new_leader_90_days', 'sdr_team_buildout', 'crm_displacement', 'new_region',
                 'revops_hire', 'funding', 'custom')),
  body        text not null check (char_length(body) <= 3000),   -- supports {{first_name}}, {{division}}, {{open_roles}}
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Outreach events: what the SDR did and what came back.
--    "What works" analytics (angle → accept → reply → meeting) is built on this.
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_events (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,
  person_id    uuid references public.people (id) on delete set null,
  signal_id    uuid references public.signals (id) on delete set null,   -- the signal the message referenced
  template_id  uuid references public.message_templates (id) on delete set null,
  channel      text not null default 'linkedin' check (channel in ('linkedin', 'email', 'phone')),
  event_type   text not null check (event_type in
                 ('profile_viewed', 'connection_sent', 'connection_accepted', 'message_sent', 'inmail_sent',
                  'email_sent', 'call_made', 'link_clicked', 'replied', 'positive_reply', 'meeting_booked',
                  'not_interested', 'wrong_person', 'bounced')),
  angle        text check (angle in
                 ('new_leader_90_days', 'sdr_team_buildout', 'crm_displacement', 'new_region',
                  'revops_hire', 'funding', 'custom')),
  note         text check (char_length(note) <= 2000),
  occurred_at  timestamptz not null default now(),
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists outreach_events_company_idx on public.outreach_events (company_id, occurred_at desc);
create index if not exists outreach_events_org_idx on public.outreach_events (org_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 3. Tracked links: /r/<slug> redirects and logs the click (server, service role)
-- ---------------------------------------------------------------------------
create table if not exists public.tracked_links (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete cascade,
  person_id   uuid references public.people (id) on delete set null,
  slug        text not null unique default encode(gen_random_bytes(6), 'hex'),
  target_url  text not null check (target_url ~* '^https://'),
  label       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.link_clicks (
  id          bigint generated always as identity primary key,
  link_id     uuid not null references public.tracked_links (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  clicked_at  timestamptz not null default now(),
  user_agent  text,
  ip_hash     text,          -- sha256(ip + daily salt), never the raw IP
  is_bot      boolean not null default false
);
create index if not exists link_clicks_link_idx on public.link_clicks (link_id, clicked_at desc);

-- ---------------------------------------------------------------------------
-- 4. CRM integration (optional): connections, field mapping, sync log
--    OAuth tokens live in Supabase Vault; only the vault secret id is stored here.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_connections (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  provider         text not null check (provider in ('hubspot', 'salesforce', 'pipedrive', 'webhook')),
  status           text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  instance_url     text,               -- Salesforce instance / HubSpot portal id / webhook URL
  vault_secret_id  uuid,               -- vault.secrets.id holding the token JSON
  auto_push        boolean not null default false,  -- push automatically when an account turns Hot
  push_contacts    boolean not null default true,
  push_notes       boolean not null default true,   -- signal summary as a note/activity
  create_tasks     boolean not null default false,  -- "Call today" task for the owner
  connected_by     uuid references auth.users (id) on delete set null,
  last_synced_at   timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  unique (org_id, provider)
);

create table if not exists public.crm_field_mappings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  provider      text not null check (provider in ('hubspot', 'salesforce', 'pipedrive', 'webhook')),
  object        text not null check (object in ('company', 'contact', 'note', 'task')),
  source_field  text not null,         -- a column of v_crm_company_export / v_crm_contact_export
  target_field  text not null,         -- e.g. HubSpot property "hs_signal_priority" or SF "Signal_Priority__c"
  transform     text not null default 'none' check (transform in ('none', 'upper', 'lower', 'date', 'join_comma')),
  enabled       boolean not null default true,
  unique (org_id, provider, object, target_field)
);

create table if not exists public.crm_sync_log (
  id            bigint generated always as identity primary key,
  org_id        uuid not null references public.organizations (id) on delete cascade,
  provider      text not null,
  object        text not null,
  entity_id     uuid not null,          -- companies.id or people.id
  external_id   text,
  action        text not null check (action in ('create', 'update', 'skip')),
  status        text not null check (status in ('ok', 'error', 'dry_run')),
  request       jsonb,
  response      jsonb,
  error         text,
  triggered_by  uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists crm_sync_log_org_idx on public.crm_sync_log (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. API keys for the inbound API (POST /api/v1/research, GET /api/v1/accounts)
--    Only a SHA-256 hash is stored; the full key is shown once on creation.
-- ---------------------------------------------------------------------------
create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  name          text not null,
  prefix        text not null,           -- first 8 chars, for display: "hs_live_ab12…"
  key_hash      text not null unique,
  scopes        text[] not null default '{read}',
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Audit log (admin view): seat changes, role changes, exports, settings
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,     -- 'member.invited', 'member.role_changed', 'crm.pushed', 'settings.weights_changed', …
  entity      text,
  entity_id   text,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_org_idx on public.audit_log (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7. Row-level security
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'message_templates', 'outreach_events', 'tracked_links', 'link_clicks',
    'crm_connections', 'crm_field_mappings', 'crm_sync_log', 'api_keys', 'audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Members: read + write their workspace's templates, outreach and links.
drop policy if exists "message_templates: members read"  on public.message_templates;
drop policy if exists "message_templates: members write" on public.message_templates;
drop policy if exists "message_templates: members update" on public.message_templates;
create policy "message_templates: members read" on public.message_templates
  for select to authenticated using (public.is_org_member(org_id));
create policy "message_templates: members write" on public.message_templates
  for insert to authenticated with check (public.is_org_member(org_id));
create policy "message_templates: members update" on public.message_templates
  for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
grant select, insert, update on public.message_templates to authenticated;

drop policy if exists "outreach_events: members read"    on public.outreach_events;
drop policy if exists "outreach_events: log own"         on public.outreach_events;
drop policy if exists "outreach_events: delete own"      on public.outreach_events;
create policy "outreach_events: members read" on public.outreach_events
  for select to authenticated using (public.is_org_member(org_id));
create policy "outreach_events: log own" on public.outreach_events
  for insert to authenticated with check (public.is_org_member(org_id) and user_id = (select auth.uid()));
create policy "outreach_events: delete own" on public.outreach_events
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, delete on public.outreach_events to authenticated;

drop policy if exists "tracked_links: members read" on public.tracked_links;
drop policy if exists "tracked_links: create own"   on public.tracked_links;
create policy "tracked_links: members read" on public.tracked_links
  for select to authenticated using (public.is_org_member(org_id));
create policy "tracked_links: create own" on public.tracked_links
  for insert to authenticated with check (public.is_org_member(org_id) and user_id = (select auth.uid()));
grant select, insert on public.tracked_links to authenticated;

drop policy if exists "link_clicks: members read" on public.link_clicks;
create policy "link_clicks: members read" on public.link_clicks
  for select to authenticated using (public.is_org_member(org_id));
grant select on public.link_clicks to authenticated;

-- Members can see the sync log (so they know what was pushed); admins manage connections + mappings.
drop policy if exists "crm_sync_log: members read" on public.crm_sync_log;
create policy "crm_sync_log: members read" on public.crm_sync_log
  for select to authenticated using (public.is_org_member(org_id));
grant select on public.crm_sync_log to authenticated;

drop policy if exists "crm_connections: members read" on public.crm_connections;
drop policy if exists "crm_connections: admins write" on public.crm_connections;
create policy "crm_connections: members read" on public.crm_connections
  for select to authenticated using (public.is_org_member(org_id));
create policy "crm_connections: admins write" on public.crm_connections
  for update to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
-- vault_secret_id is never readable from the browser; connect/disconnect runs server-side.
grant select (id, org_id, provider, status, instance_url, auto_push, push_contacts, push_notes, create_tasks,
              connected_by, last_synced_at, last_error, created_at) on public.crm_connections to authenticated;
grant update (auto_push, push_contacts, push_notes, create_tasks) on public.crm_connections to authenticated;

drop policy if exists "crm_field_mappings: members read" on public.crm_field_mappings;
drop policy if exists "crm_field_mappings: admins all"   on public.crm_field_mappings;
create policy "crm_field_mappings: members read" on public.crm_field_mappings
  for select to authenticated using (public.is_org_member(org_id));
create policy "crm_field_mappings: admins all" on public.crm_field_mappings
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
grant select, insert, update, delete on public.crm_field_mappings to authenticated;

drop policy if exists "api_keys: admins read"   on public.api_keys;
drop policy if exists "api_keys: admins revoke" on public.api_keys;
create policy "api_keys: admins read" on public.api_keys
  for select to authenticated using (public.is_org_admin(org_id));
create policy "api_keys: admins revoke" on public.api_keys
  for update to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
grant select (id, org_id, name, prefix, scopes, created_by, last_used_at, revoked_at, created_at)
  on public.api_keys to authenticated;
grant update (revoked_at) on public.api_keys to authenticated;
-- Keys are created by POST /api/keys (server, service role) so the plain key never touches the DB.

drop policy if exists "audit_log: admins read" on public.audit_log;
create policy "audit_log: admins read" on public.audit_log
  for select to authenticated using (public.is_org_admin(org_id));
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Claim / release an account (never steal one another SDR owns)
-- ---------------------------------------------------------------------------
create or replace function public.claim_account(p_company uuid, p_release boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_owner uuid;
begin
  select org_id, owner_id into v_org, v_owner from public.companies where id = p_company for update;
  if v_org is null or not public.is_org_member(v_org) then raise exception 'not_found'; end if;
  if p_release then
    if v_owner is distinct from v_uid and not public.is_org_admin(v_org) then raise exception 'not_owner'; end if;
    update public.companies set owner_id = null, claimed_at = null where id = p_company;
  else
    if v_owner is not null and v_owner <> v_uid then raise exception 'claimed_by_other'; end if;
    update public.companies set owner_id = v_uid, claimed_at = now() where id = p_company;
  end if;
  insert into public.audit_log (org_id, actor_id, action, entity, entity_id)
  values (v_org, v_uid, case when p_release then 'account.released' else 'account.claimed' end,
          'company', p_company::text);
end;
$$;
revoke all on function public.claim_account(uuid, boolean) from public, anon;
grant execute on function public.claim_account(uuid, boolean) to authenticated;
