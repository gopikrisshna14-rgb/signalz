-- Hiring Signals · 001: workspaces, seats, roles, invitations, profiles
-- Run once in the Supabase SQL Editor, before the first sign-up.
-- Safe to re-run: every statement is idempotent.
--
-- Model: an organization (workspace) has members with a role (owner / admin / member).
-- Each active member uses one seat; organizations.seat_limit caps active members.
-- People join a workspace by invitation, or automatically when their verified
-- e-mail domain matches organizations.email_domain ("company login").

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 120),
  slug             text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  email_domain     text unique check (email_domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),  -- e.g. hubspot.com → auto-join
  auto_join        boolean not null default false,
  sso_provider_id  uuid,                    -- Supabase SAML provider id (Settings → Auth → SSO), optional
  sso_enforced     boolean not null default false,  -- if true, members must sign in via SSO
  seat_limit       int not null default 5 check (seat_limit between 1 and 10000),
  plan             text not null default 'trial' check (plan in ('trial', 'team', 'business', 'enterprise')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text,
  full_name        text check (char_length(full_name) <= 120),
  avatar_url       text,
  job_title        text check (char_length(job_title) <= 120),
  team             text check (char_length(team) <= 80),     -- e.g. "DACH Mid-Market"; used for routing
  timezone         text not null default 'Europe/Berlin',
  default_org_id   uuid references public.organizations (id) on delete set null,
  notify_hot       boolean not null default true,            -- e-mail/Slack when an account turns Hot
  notify_digest    boolean not null default true,            -- daily digest
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.memberships (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status      text not null default 'active' check (status in ('active', 'deactivated')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships (user_id);

create table if not exists public.invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  email        text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role         text not null default 'member' check (role in ('admin', 'member')),
  token        text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by   uuid references auth.users (id) on delete set null,
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);
create unique index if not exists invitations_open_email_idx
  on public.invitations (org_id, lower(email)) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Helpers used by every RLS policy (security definer → no policy recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_updated_at on public.organizations;
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Seat limit: refuse to activate a member beyond organizations.seat_limit
-- ---------------------------------------------------------------------------
create or replace function public.enforce_seat_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limit int;
  v_used  int;
begin
  if new.status <> 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;  -- role change on an already-counted seat
  end if;
  select seat_limit into v_limit from public.organizations where id = new.org_id for update;
  select count(*) into v_used from public.memberships
    where org_id = new.org_id and status = 'active' and user_id <> new.user_id;
  if v_used >= v_limit then
    raise exception 'seat_limit_reached' using hint = 'Add seats under Settings → Team & seats.';
  end if;
  return new;
end;
$$;

drop trigger if exists memberships_seat_limit on public.memberships;
create trigger memberships_seat_limit before insert or update of status on public.memberships
  for each row execute function public.enforce_seat_limit();

-- An organization with other active members always keeps at least one active owner.
create or replace function public.keep_one_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and (new.role <> 'owner' or new.status <> 'active')) then
    if not exists (
      select 1 from public.memberships
      where org_id = old.org_id and role = 'owner' and status = 'active' and user_id <> old.user_id
    ) and exists (
      select 1 from public.memberships
      where org_id = old.org_id and status = 'active' and user_id <> old.user_id
    ) and exists (select 1 from public.organizations where id = old.org_id) then
      raise exception 'last_owner' using hint = 'Make someone else owner first.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists memberships_keep_owner on public.memberships;
create trigger memberships_keep_owner before update or delete on public.memberships
  for each row execute function public.keep_one_owner();

-- ---------------------------------------------------------------------------
-- 4. Sign-up: create the profile, then accept a pending invitation or
--    auto-join by e-mail domain (works for e-mail, Google, Microsoft and SAML SSO)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_domain text := lower(split_part(new.email, '@', 2));
  v_inv    public.invitations%rowtype;
  v_org    uuid;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id, new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  select * into v_inv from public.invitations
    where lower(email) = lower(new.email) and accepted_at is null and expires_at > now()
    order by created_at desc limit 1;

  if found then
    begin
      insert into public.memberships (org_id, user_id, role) values (v_inv.org_id, new.id, v_inv.role)
        on conflict do nothing;
      update public.invitations set accepted_at = now() where id = v_inv.id;
      update public.profiles set default_org_id = v_inv.org_id where id = new.id;
    exception when others then
      null;  -- seat limit reached: user lands on "ask your admin for a seat"
    end;
    return new;
  end if;

  select id into v_org from public.organizations where email_domain = v_domain and auto_join;
  if v_org is not null then
    begin
      insert into public.memberships (org_id, user_id, role) values (v_org, new.id, 'member')
        on conflict do nothing;
      update public.profiles set default_org_id = v_org where id = new.id;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. RPCs the app calls
-- ---------------------------------------------------------------------------
-- Onboarding: create a workspace; the caller becomes owner.
create or replace function public.create_organization(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  insert into public.organizations (name, slug) values (p_name, lower(p_slug)) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, v_uid, 'owner');
  insert into public.icp_settings (org_id) values (v_org) on conflict do nothing;
  update public.profiles set default_org_id = v_org where id = v_uid and default_org_id is null;
  return v_org;
end;
$$;

-- Invite link (/invite/<token>) for someone who already has an account.
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_inv   public.invitations%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select email into v_email from auth.users where id = v_uid;
  select * into v_inv from public.invitations
    where token = p_token and accepted_at is null and expires_at > now();
  if not found then raise exception 'invitation_invalid'; end if;
  if lower(v_inv.email) <> lower(v_email) then raise exception 'invitation_other_email'; end if;
  insert into public.memberships (org_id, user_id, role) values (v_inv.org_id, v_uid, v_inv.role)
    on conflict (org_id, user_id) do update set status = 'active', role = excluded.role;
  update public.invitations set accepted_at = now() where id = v_inv.id;
  update public.profiles set default_org_id = v_inv.org_id where id = v_uid;
  return v_inv.org_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Row-level security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.memberships   enable row level security;
alter table public.invitations   enable row level security;

drop policy if exists "orgs: members read"   on public.organizations;
drop policy if exists "orgs: admins update"  on public.organizations;
create policy "orgs: members read" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "orgs: admins update" on public.organizations
  for update to authenticated using (public.is_org_admin(id)) with check (public.is_org_admin(id));
-- seat_limit and plan are changed by the billing webhook (service role), never by the client:
revoke update on public.organizations from authenticated;
grant update (name, slug, email_domain, auto_join, sso_enforced) on public.organizations to authenticated;

drop policy if exists "profiles: read own or teammates" on public.profiles;
drop policy if exists "profiles: update own"           on public.profiles;
create policy "profiles: read own or teammates" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships a join public.memberships b on a.org_id = b.org_id
      where a.user_id = (select auth.uid()) and a.status = 'active' and b.user_id = profiles.id
    )
  );
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "memberships: members read"  on public.memberships;
drop policy if exists "memberships: admins write"  on public.memberships;
drop policy if exists "memberships: admins update" on public.memberships;
drop policy if exists "memberships: admins delete" on public.memberships;
create policy "memberships: members read" on public.memberships
  for select to authenticated using (user_id = (select auth.uid()) or public.is_org_member(org_id));
create policy "memberships: admins update" on public.memberships
  for update to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy "memberships: admins delete" on public.memberships
  for delete to authenticated using (public.is_org_admin(org_id) or user_id = (select auth.uid()));
-- Inserts happen only through create_organization / accept_invitation / the sign-up trigger.

drop policy if exists "invitations: admins all" on public.invitations;
create policy "invitations: admins all" on public.invitations
  for all to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

revoke all on public.organizations, public.profiles, public.memberships, public.invitations from anon;
grant select on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.invitations to authenticated;
revoke all on function public.create_organization(text, text), public.accept_invitation(text) from public, anon;
grant execute on function public.create_organization(text, text), public.accept_invitation(text) to authenticated;
