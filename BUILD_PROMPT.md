# Build prompt: Hiring Signals (SDR signal dashboard)

Paste everything below the line into Claude Code, in an empty folder or a new repo.
The database already exists: run `supabase/001…005` from this folder in the Supabase SQL editor first
(see `README.md`). The prompt tells Claude Code to build against that schema, not to invent its own.

---

## 0. What you are building

**Hiring Signals** is a web app for SDRs (first user: an SDR at HubSpot selling HubSpot Sales Hub).
It finds companies that are **building a sales team inside one specific division right now**
("hiring clusters"), ranks them, shows the decision maker's LinkedIn context, helps the SDR write a
relevant first message, tracks what happened, and pushes the account into the SDR's CRM.

Example: a sneaker brand posts 2 SDR roles, 1 Account Executive and a Head of Sales, all for
**Sales · Wholesale · DACH**, and a new Head of Sales started 3 weeks ago. That is a hot cluster:
a new leader with budget, a team about to be onboarded, and job ads that mention Salesforce.
The same company posting "Sales Associate, Store Berlin" is **not** a signal: that is retail
shop-floor staff in a different division, and the app must exclude it.

Primary flow:
1. SDR pastes a LinkedIn URL (a person or a company) into the app.
2. The app starts an **n8n** workflow; n8n runs **Apify** actors (profile, company, jobs),
   classifies the jobs with Claude, and writes everything to **Supabase**.
3. Supabase's `recompute_company()` builds clusters and scores; the dashboard updates live (Realtime).
4. SDR reads "why now", picks an angle, copies the suggested opener, opens LinkedIn, sends it
   manually, and logs the step with one click.
5. Optional: push the account + contact + signal summary to HubSpot / Salesforce / Pipedrive / a webhook.

Also: a daily n8n run re-scrapes jobs for every tracked company so new clusters appear on their own.

## 1. Stack (use exactly this)

- **Next.js 15** (App Router, TypeScript, Server Components, Server Actions, Route Handlers), deployed on **Vercel**.
- **Supabase**: Postgres, Auth, Realtime. Use `@supabase/ssr` (cookie sessions, middleware refresh).
  Generate types with `supabase gen types typescript` into `src/lib/database.types.ts`.
- **Tailwind CSS v4** + **shadcn/ui** (Radix) + **lucide-react** icons.
- **Recharts** for charts, **TanStack Table v8** for the account table, **cmdk** for the command palette,
  **sonner** for toasts, **zod** for every input and every webhook body, **nuqs** for filters in the URL.
- **n8n** (cloud or self-hosted) for workflows, **Apify** for scraping, **Claude API** for
  classification (`claude-haiku-4-5`) and openers (`claude-sonnet-5-5`), via `@anthropic-ai/sdk`.
- No ORM. Query Supabase directly with typed clients. Browser uses the anon key + RLS;
  only Route Handlers that must bypass RLS use the service role key, and never in client code.

## 2. Database (already created; do not change it without a new numbered migration)

Read `supabase/001…005_*.sql` before writing any data code. Summary:

| Area | Tables / views / functions |
|---|---|
| Workspace | `organizations` (seat_limit, email_domain + auto_join, SSO), `profiles`, `memberships` (owner/admin/member, seat-limit trigger), `invitations`; RPCs `create_organization`, `accept_invitation` |
| Settings | `icp_settings` (countries, industries, headcount band, target functions, cluster window, min roles, leader tenure, weights, Hot/Warm thresholds, excluded title regexes) |
| Signals | `companies`, `divisions` (function + business unit + region, generated `label`), `job_postings`, `people`, `research_requests`, `hiring_clusters`, `signals`, `account_scores`, `score_history` |
| Outreach | `message_templates` (per angle), `outreach_events`, `tracked_links`, `link_clicks` |
| CRM / API | `crm_connections` (token in Vault), `crm_field_mappings`, `crm_sync_log`, `api_keys` (hash only), `audit_log` |
| Logic | `recompute_company(uuid)` (service role), `rescore_org(uuid)` (admin), `claim_account(uuid, release)`, `seed_demo(uuid)` |
| Read models | `v_accounts`, `v_kpis`, `v_just_changed`, `v_heatmap_division_week`, `v_heatmap_function_region`, `v_outreach_by_angle`, `v_outreach_by_user`, `v_reply_time_heatmap`, `v_crm_company_export`, `v_crm_contact_export` |

Rules: the browser may only insert `research_requests`, `outreach_events`, `message_templates`,
`tracked_links`, update `icp_settings` (admins), `companies.status/routed_to_team`, and call the RPCs.
Everything n8n writes goes through the service role. All views are `security_invoker`, so RLS applies.

## 3. The hiring-cluster model (implement the UI around it; the SQL already computes it)

A **division** = function (sales, revops, …) + business unit (Wholesale, B2B, Enterprise, SME…) +
region (DACH, EMEA…). A **hiring cluster** exists when, inside **one** division, within
`cluster_window_days` (default 45):
- at least `min_cluster_roles` (default 2) open, non-excluded roles, **or**
- a sales leader started in the last `leader_tenure_days` (default 90) **and** ≥ 1 open role.

Roles in different divisions never add up. Excluded titles (store, Filiale, Verkäufer, cashier,
call center, sales associate…) never count.

**Hiring Cluster Index (0–100)**, stored per cluster with a breakdown (`score_breakdown`):

| Factor | Points | Why it matters to the SDR |
|---|---|---|
| Open roles in the division | 15 each, max 45 | More seats = more licences, more onboarding pain |
| Leader + builders mix (Head of/Director + SDR/AE) | 20 (10 if ≥ 2 builders only) | Someone owns the budget and a team is being built under them |
| New sales leader, days in role | ≤ 30: 20 · ≤ 60: 15 · ≤ 90: 10 | First 90 days = new leaders change tools |
| CRM named in job ads | competitor: 10 · own product: 5 | Displacement angle, or expansion |
| "First SDR", "build from scratch", "founding team", new region | 10 | Greenfield process, no tool locked in |
| Velocity: ≥ 2 roles in last 14 days | 5 | It is happening now |
| RevOps / enablement role in the same division | 5 | The person who picks tools is being hired |

Account scores (all 0–100): **cluster** (best cluster), **fit** (headcount band, country, industry,
current CRM, headcount growth), **timing** (`100·e^(−days/30)` since newest posting or leader start),
**reach** (decision maker found, posted on LinkedIn in 30 days, mutual connections, used HubSpot at a
previous job, shared history, e-mail known). **Priority** = weighted sum (default 40/25/20/15) + 10 % of
website intent if available. Tiers: Hot ≥ 70, Warm ≥ 45. Buckets (tabs): Call today · High intent,
weaker fit · Net-new (not in CRM) · Warming up · Recently contacted · Routed.

Every score in the UI must be explainable: hovering or clicking a score shows its breakdown
("+20 new leader 21 days in"). Never show a number without the reason next to it.

## 4. Factors the SDR should see before reaching out (design the account page around these)

1. **Why now, in one line**: `top_reason`, e.g. "4 open roles in Sales · Wholesale · DACH (3 SDR/AE, 1 leader)".
2. **Who to contact**: the economic buyer (new Head of Sales) first, then the RevOps hire, then the
   hiring manager on the SDR posts. Show persona, days in role, previous companies and whether
   their previous employer used HubSpot (`prior_tools`): "used HubSpot at Zalando" is the best opener there is.
3. **Their current stack**: CRM named in job ads or detected (`current_crm`), so the SDR picks
   displacement vs greenfield.
4. **What they talk about**: last 3 LinkedIn posts with date, to reference something real.
5. **Warm paths**: mutual connections, shared employer or university.
6. **Division scope**: which BU and region, so the message speaks to "your new Wholesale team in DACH",
   not "your company".
7. **Timing**: days since the cluster started and since the leader joined; a countdown "buying
   window closes in ~X days" (90 − days in role).
8. **Suppression**: already a customer, open opportunity, claimed by another SDR, or contacted in
   the last 14 days. Show this first, in red, so nobody double-touches an account.
9. **Recommended angle + opener**: picked from the strongest factor (new leader → "first 90 days",
   many SDRs → "team build-out", competitor CRM → "displacement", new region → "expansion").
10. **What worked before**: reply rate of that angle in this workspace (`v_outreach_by_angle`).

## 5. Pages and components

Global layout: left sidebar (collapsible to icons) with workspace switcher at top; top bar with
search (⌘K), "Research a LinkedIn URL" button, notifications bell, user menu. Content max-width
1440px. Everything works at 375px wide (sidebar becomes a sheet, table becomes cards).

1. **`/` Today (dashboard)** — mirrors the reference screenshot, cleaner:
   - Header: "Hiring signals", subline "Prospects · last 45 days · data fresh to <time> · <n> companies tracked".
     Right: "I am [owner select]" filter and theme toggle.
   - **KPI tiles** (from `v_kpis`): Call today · Net-new companies · New/upgraded in 24 h ·
     With a new sales leader · Routed to other teams. Each tile: big number, label, small delta vs
     7 days ago (from `score_history`), click = apply that filter.
   - **Quadrant chart** "Hiring intent vs fit": x = cluster score, y = fit score, dashed lines at 60/60,
     corner labels ("Call today ↗", "Right fit, not ready yet ↖", "Qualify fast ↘"). Dot colour by
     bucket, size by open roles, hover card with name, division, top reason; click opens the account drawer.
   - **Just changed** panel (`v_just_changed`): "Laufwerk Sneakers  Warm → Hot · Jonas Weber",
     NEW / UPGRADED pills, relative time, owner. Realtime-updated.
   - **Tabs with counts** for the buckets + All + Routed; **filters**: search, tier, owner, country,
     division function, "New/upgraded only", "Hide claimed by others" (default on).
   - **Account table**: Tier pill · Company (logo, name, domain, headcount, top reason) · Division ·
     Owner → contact (avatar, name, title, days in role) · Cluster · Fit · Priority (number + tiny
     bar) · Last signal (relative). Sortable, sticky header, row hover actions: Claim, Open LinkedIn,
     Log outreach, Push to CRM. Keyboard: `j/k` move, `enter` open, `c` claim, `l` log, `p` push.
2. **Account drawer / page `/accounts/[id]`**:
   - Header: logo, name, tier, priority ring, owner + Claim button, "Push to CRM", "Open on LinkedIn".
   - **Why now** card: reasons as a checklist with points; buying-window countdown.
   - **Score breakdown**: four horizontal bars (cluster, fit, timing, reach) with the factor list.
   - **Hiring clusters**: per division a card with role chips (SDR ×2, AE, Head of Sales), posting dates,
     links to the ads, CRM mentions; a 12-week mini heatmap of postings (`v_heatmap_division_week`).
     Excluded postings collapsed under "Not counted (3)" with the reason.
   - **People**: decision-maker card (photo, headline, started X days ago, previous roles timeline,
     prior tools with HubSpot highlighted, skills, last 3 posts, mutuals, shared history) and other contacts.
   - **Outreach**: angle picker → generated opener (editable, ≤ 300 chars for a connection note),
     "Copy & open LinkedIn", tracked-link inserter, one-click log buttons (Connection sent, Accepted,
     Message sent, Replied, Meeting booked, Not interested), activity timeline.
   - **CRM**: what will be sent (field preview), last sync result.
3. **`/research`**: big input "Paste a LinkedIn profile or company URL", queue of recent requests with
   live status steps (Queued → Profile → Company → Jobs → Classifying → Scoring → Done) via Realtime,
   bulk paste (one URL per line, max 25), failed requests with "Retry".
4. **`/clusters`**: cluster explorer. Heatmap function × region (`v_heatmap_function_region`),
   division × week heatmap for the top 20 accounts, line chart of new clusters per week, bar chart of
   most-hired role families, filterable list of clusters.
5. **`/outreach`**: funnel by angle (sent → accepted → replied → meeting), reply-time heatmap
   weekday × hour (convert UTC to the user's timezone), leaderboard (`v_outreach_by_user`), link clicks,
   templates editor with `{{first_name}} {{company}} {{division}} {{open_roles}} {{crm}} {{industry}}`.
6. **`/settings`** (tabs): Profile · Notifications · **ICP & scoring** (admin; sliders for the
   four weights that must sum to 100 %, thresholds, window, min roles, tenure, excluded title regexes
   with a live tester, "Re-score all" → `rescore_org`) · **Team & seats** (admin; members table with
   role select, deactivate, invite by e-mail, seat usage bar "4 of 5 seats", auto-join domain toggle,
   SSO status) · **Integrations** (CRM cards, field mapping table, webhook URL, API keys) ·
   **Audit log** (admin) · Danger zone (owner: delete workspace).
7. **Auth pages**: `/login`, `/signup`, `/forgot`, `/auth/callback`, `/invite/[token]`, `/onboarding`.

Empty states everywhere with one clear action ("No clusters yet. Paste a LinkedIn URL or load demo data").
The first-run checklist on the dashboard: connect n8n ✓, research first URL, set ICP, invite a teammate, connect CRM.
An admin-only "Load demo data" button calls `seed_demo(org_id)`.

## 6. Design direction

Modern B2B SaaS, in the style of Linear, Attio, Vercel and Clay: calm, dense, fast.
- **Type**: Inter (variable) for UI, tabular numbers for all scores (`font-variant-numeric: tabular-nums`),
  JetBrains Mono only for IDs/API keys. Sizes 12/13/14/16/20/28; body 14.
- **Colour**: neutral zinc greys, one accent (indigo `#4F46E5` light / `#818CF8` dark). Tier colours:
  Hot = red-orange, Warm = amber, Cold = slate; pills with tinted background + dark text, never
  colour alone (always the word too). Charts use the accent + 2 neutrals; quadrant buckets: Call today
  (accent), Net-new (orange), others (grey), as in the reference.
- Define all colours as CSS variables on `:root` with a `.dark` override; dark mode follows the system,
  with a toggle. Body background explicit in both themes.
- **Surfaces**: 1px borders (`zinc-200` / `zinc-800`), radius 10–12px, almost no shadows; cards on a
  slightly tinted page background. 8px spacing grid. Comfortable vs compact density toggle for the table.
- **Motion**: 150 ms ease-out for hovers, drawers slide from the right, skeleton loaders (no spinners
  in content), optimistic updates for claim/log with undo toast.
- **Accessibility**: WCAG AA contrast, visible focus rings, full keyboard use, `aria-live` on the
  research queue, charts have a table fallback ("View as table").
- **Command palette (⌘K)**: jump to account, research URL, switch tab, change theme, open settings.

## 7. Auth, SSO, seats, admin

- Supabase Auth with: e-mail + password, magic link, **Google** and **Microsoft (Azure AD)** OAuth,
  and **SAML 2.0 SSO** (Supabase Pro: `supabase sso add`; store the provider id in
  `organizations.sso_provider_id`). Login page: "Continue with Google", "Continue with Microsoft",
  "Continue with SSO" (asks for work e-mail, looks up the domain, calls `signInWithSSO({ domain })`),
  then e-mail/password below a divider.
- If `organizations.sso_enforced`, middleware rejects sessions of that org's members whose
  `amr` does not include `sso/saml`, and sends them to SSO.
- The sign-up trigger in `001` already creates the profile and joins the user by invitation or by
  e-mail domain (`auto_join`). If they end up in no workspace, `/onboarding` offers "Create a workspace"
  (`create_organization`) or "Ask your admin for an invite".
- Seats: the DB refuses activating a member beyond `seat_limit` (`seat_limit_reached`); show it as a
  friendly dialog. Admins change seats on the Team page; the button "Add seats" opens a placeholder
  billing dialog (Stripe later; `seat_limit` and `plan` are only writable by the service role).
- Roles: owner (everything, delete workspace, transfer ownership), admin (members, seats, ICP, CRM,
  API keys, audit log), member (use the app). Guard pages in middleware **and** rely on RLS.
- Invitations: admin enters e-mails + role → insert `invitations` → Route Handler sends the e-mail
  (Resend) with `/invite/<token>` → `accept_invitation`.
- Every admin action writes `audit_log` (from Route Handlers with the service role).

## 8. Research pipeline (Vercel ⇄ n8n ⇄ Apify ⇄ Supabase)

**Vercel → n8n**: `POST /api/research` (auth required, zod: `{ urls: string[] ≤ 25 }`, normalise to
`https://www.linkedin.com/in/<slug>` or `/company/<slug>`, rate limit 50/user/day). Insert
`research_requests` with the user's client (RLS), then call `N8N_RESEARCH_WEBHOOK_URL` with
`{ request_id, org_id, linkedin_url, kind }` and header `X-Signature: hex(hmac_sha256(N8N_WEBHOOK_SECRET, body))`.

**n8n workflow "research"** (generate the importable JSON into `n8n/research.workflow.json`):
1. Webhook (POST) → Code node verifies the HMAC → respond 202 immediately.
2. Supabase/HTTP: `research_requests.status = 'scraping_profile'`.
3. If `kind = person`: Apify "Run actor and get dataset" with `APIFY_PROFILE_ACTOR_ID` → upsert
   `people` (on `org_id,linkedin_url`); take the current employer's LinkedIn company URL.
4. `status = 'scraping_company'`: Apify `APIFY_COMPANY_ACTOR_ID` → upsert `companies`
   (name, domain, industry, employee_count, growth, HQ, description, logo).
5. `status = 'scraping_jobs'`: Apify `APIFY_JOBS_ACTOR_ID` with the company's LinkedIn jobs search
   (last 60 days) and, if a careers URL is known, a website content crawler → list of postings.
6. `status = 'classifying'`: Claude (`claude-haiku-4-5`, JSON output, batch of ≤ 20 postings) returns
   per posting: `function`, `business_unit`, `region`, `role_family`, `seniority`, `crm_mentions[]`,
   `flags[]`, `is_excluded` + `exclusion_reason`. Also classify the person: `role_family`, `seniority`,
   `persona`, `is_decision_maker`, `prior_tools[]` (tools named in their past roles), division.
   Prompt it with the rule: *a division is function + business unit + region; retail store or
   call-center staff are excluded; "Key Account Manager Retail" sells to retailers and is NOT excluded.*
7. Upsert `divisions` (on `company_id,function,business_unit,region`), then `job_postings`
   (on `org_id,source,external_id`), mark postings no longer listed as `closed_at = now()`.
8. `status = 'scoring'`: `POST /rest/v1/rpc/recompute_company { p_company }`.
9. `status = 'done'`, `progress = 100`, set `person_id`, `company_id`, `finished_at`.
   Error branch on every node: `status = 'failed'`, `error = <message>`.

**n8n workflow "daily refresh"** (cron 06:00 Europe/Berlin): for each company with
`last_enriched_at` older than 24 h and not disqualified, run steps 5–8; then call
`POST {APP_URL}/api/notify/digest` (HMAC-signed) to e-mail each SDR their new Hot accounts.

Apify actors: choose them in the Apify Store (a LinkedIn profile scraper, a LinkedIn company
scraper, a LinkedIn jobs scraper) and keep their IDs in n8n credentials/env, so they can be swapped.
Prefer actors that do not need the user's LinkedIn cookie.

## 9. CRM integration (build the feature; real connectors can come later)

- `/settings/integrations`: cards for HubSpot, Salesforce, Pipedrive and "Custom webhook".
  HubSpot first: OAuth app (scopes `crm.objects.companies.write`, `crm.objects.contacts.write`,
  `crm.objects.notes.write`, `crm.schemas.companies.write`) or private-app token; tokens stored in
  Supabase Vault by a Route Handler, only `vault_secret_id` in `crm_connections`.
- "Create custom properties" button for HubSpot: `signal_priority`, `signal_tier`,
  `hiring_cluster_index`, `hiring_division`, `open_sales_roles`, `new_leader_days_in_role`,
  `signal_top_reason`, `signal_reasons` (group "Hiring Signals").
- **Field mapping** table per object (company, contact, note, task): source column from
  `v_crm_company_export` / `v_crm_contact_export` → target property, transform; sensible defaults per provider.
- **Push**: `POST /api/crm/push { company_ids[] , dry_run }` → match by domain (company) and
  LinkedIn URL / e-mail (contact), create or update, associate contact ↔ company, add a note with the
  reasons and the cluster's job links, optionally a task "Call today" for the owner. Write
  `crm_sync_log`, store `companies.crm_external_id`. **Dry run** shows the exact JSON first.
- **Auto-push** toggle: when an account turns Hot (`signals.type = 'tier_changed'`), push it.
- **Custom webhook**: POST the same JSON, signed with HMAC, to any URL (Zapier/Make/n8n).
- **Inbound API** with workspace API keys (`Authorization: Bearer hs_live_…`, hash compare):
  `POST /api/v1/research`, `GET /api/v1/accounts?tier=hot`, `GET /api/v1/accounts/:id`. OpenAPI spec at `/api/v1/openapi.json`.

## 10. Outreach assistant

- `POST /api/opener { company_id, person_id, angle }` → Claude (`claude-sonnet-5-5`) with the reasons,
  division, person's last posts and prior tools. Output: connection note (≤ 300 chars), first message
  (≤ 700 chars), e-mail subject + body. Plain, specific, one question, no flattery, no fake familiarity,
  in the person's language (German for DACH unless their profile is English).
- Templates from `message_templates` can be used instead (variables filled server-side).
- **Never automate sending on LinkedIn.** The app copies the text and opens the profile; the SDR
  sends it, then logs it with one click (`outreach_events`). Logging triggers a re-score
  (account moves to "Recently contacted").
- Tracked links: `POST /api/links` → `/r/[slug]` Route Handler logs `link_clicks` (hash IP with a
  daily salt, flag bots by user agent), inserts an `outreach_events` `link_clicked`, then 302 redirects.

## 11. Route handlers (all zod-validated, all return typed JSON errors)

`/api/research` · `/api/research/[id]/retry` · `/api/opener` · `/api/links` · `/r/[slug]` ·
`/api/crm/connect/[provider]` · `/api/crm/callback/[provider]` · `/api/crm/push` · `/api/crm/disconnect` ·
`/api/keys` (create/revoke) · `/api/invitations` · `/api/notify/digest` (HMAC from n8n) ·
`/api/n8n/status` (optional HMAC callback if n8n should not hold the service key) · `/api/v1/*`.

## 12. Environment variables

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`, `N8N_RESEARCH_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `APP_URL`, `RESEND_API_KEY`,
`HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`,
`PIPEDRIVE_CLIENT_ID`, `PIPEDRIVE_CLIENT_SECRET`, `LINK_IP_SALT`.
In n8n: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APIFY_TOKEN`, `APIFY_PROFILE_ACTOR_ID`,
`APIFY_COMPANY_ACTOR_ID`, `APIFY_JOBS_ACTOR_ID`, `ANTHROPIC_API_KEY`, `N8N_WEBHOOK_SECRET`, `APP_URL`.
Write `.env.example` with all of them and comments.

## 13. Data protection (the team is in Germany: GDPR applies)

- Store only business-context data about people (name, title, employer, public profile facts,
  posts relevant to their work). No private e-mail, no phone unless from a compliant provider.
- Keep `people.raw` and `recent_posts` 180 days, then null them (n8n weekly job); show the source
  and scrape date on every profile card.
- "Delete this person" (admin) removes the row and its outreach events; a suppression list stops
  re-scraping them.
- The first message should be able to say where the data came from (Art. 14 GDPR); add an
  optional footer line in templates.
- Scraping LinkedIn may conflict with LinkedIn's terms; keep the Apify step swappable for licensed
  data sources, and never log in with the SDR's own LinkedIn account from the server.

## 14. Build order (hackathon)

1. **Day 1 morning**: Next.js app, Supabase clients, auth (e-mail + Google), onboarding,
   sidebar layout, design tokens, dark mode.
2. **Day 1 afternoon**: Today dashboard from `v_accounts` / `v_kpis` / `v_just_changed` with
   `seed_demo` data: KPI tiles, quadrant chart, tabs, filters, table, account drawer.
3. **Day 2 morning**: `/research` + n8n workflow + Apify + Claude classification, Realtime queue.
4. **Day 2 afternoon**: outreach assistant + logging + `/outreach` analytics; `/clusters` heatmaps.
5. **Then**: Team & seats, invites, ICP settings + re-score, CRM field mapping + HubSpot push (dry run first),
   SSO, API keys, audit log.

## 15. Acceptance checks

- Pasting a LinkedIn URL of a new Head of Sales at a sneaker brand shows the request moving through
  the steps and, when done, the company in "Call today" with "N open roles in Sales · Wholesale · DACH
  + new leader (21 days in)".
- A "Sales Associate Store Berlin" posting appears under "Not counted" and does not change the score.
- Roles in two different divisions of the same company produce two clusters, not one.
- A user of another workspace sees none of these rows (RLS), also through the views.
- The 6th member of a 5-seat workspace gets the "no seat left" dialog.
- Claiming an account owned by someone else fails with a clear message.
- Logging "Connection sent" moves the account to "Recently contacted" within a second.
- CRM dry run shows the exact payload; real push writes `crm_sync_log` and `crm_external_id`.
- Lighthouse ≥ 90 for accessibility; the dashboard is usable at 375px; dark mode has no unreadable text.
