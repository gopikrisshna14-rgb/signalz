# Hiring Signals

Dashboard for SDRs that ranks companies building a sales team inside one division ("hiring
clusters"), shows the decision maker's LinkedIn context, helps write the first message, tracks
outreach and pushes accounts to a CRM. Stack: Next.js on Vercel, Supabase, n8n, Apify, Claude.

- `BUILD_PROMPT.md`: the prompt to paste into Claude Code to build the app.
- `supabase/`: the database (tables, row-level security, scoring, dashboard views, demo data).

## Set up the database

In the Supabase SQL Editor, run the scripts in order, each once (all are safe to re-run):

1. `001_workspaces.sql`: workspaces, profiles, memberships with roles and a seat limit,
   invitations, the sign-up trigger (joins by invitation or e-mail domain), `create_organization`,
   `accept_invitation`.
2. `002_signals.sql`: ICP and scoring settings, companies, divisions, job postings, people,
   research requests, hiring clusters, signals, account scores, Realtime publication.
3. `003_outreach_crm.sql`: message templates, outreach events, tracked links, CRM connections,
   field mappings, sync log, API keys, audit log, `claim_account`.
4. `004_scoring_views.sql`: `recompute_company` (clusters, scores, signals), `rescore_org`,
   and the views the dashboard reads.
5. `005_demo_seed.sql` (optional): `seed_demo(org_id)` with eight fictional companies, among them
   a sneaker brand with a Wholesale DACH cluster and a shop-floor role that is correctly not counted.

After signing up and creating a workspace in the app:
`select public.seed_demo('<org id>');` (or the admin's "Load demo data" button).

## How a hiring cluster is scored

Only roles in the same division (function + business unit + region) count together, within
45 days. Shop-floor and call-center titles are excluded by regex (`icp_settings.excluded_title_patterns`).
The Hiring Cluster Index adds points for the number of roles, a leader + SDR/AE mix, a sales leader
in their first 90 days, a CRM named in the job ads, "first SDR / new region" flags, velocity and a
RevOps hire. Priority = 40 % cluster + 25 % fit + 20 % timing + 15 % reach (weights editable by admins).
Details and the factor table are in `BUILD_PROMPT.md`, section 3.

Tested on Postgres 16 with Supabase's `auth` schema stubbed: all five scripts run twice
without errors, RLS hides one workspace's rows from another, and the seat limit and claim rules hold.
