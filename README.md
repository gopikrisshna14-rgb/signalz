# Signalz (beta)

Signalz finds companies that are building a sales team **inside one division right now** ("hiring clusters"), ranks them, shows the decision maker's context, helps write a relevant first message, tracks outreach and exports accounts CRM-ready.

Example: a sneaker brand posts 2 SDR roles, 1 AE and a sales team lead for **Sales · Wholesale · DACH**, and a new Head of Sales started 3 weeks ago. That is a hot cluster. The same company posting "Sales Associate, Store Berlin" is shop-floor staff in another division and is not counted.

**Stack:** Next.js 15 (App Router) on Vercel · Upstash Redis (Vercel Storage) · Auth.js v5 · Apify (scraping, chained by webhooks) · Claude API (optional) · Tailwind v4, Radix, TanStack Table, Recharts, cmdk. No separate backend, no workflow tool.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000 → "Continue with demo account"
```

With no environment variables at all, the app runs on an in-memory store seeded with demo data (a "Demo data, not saved" banner shows). Research works in **simulation mode** on fixtures.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Deploy on Vercel

1. **Import** this repository in Vercel (framework: Next.js, root: repo root).
2. **Storage:** Vercel → your project → Storage → Create → **Upstash for Redis** (free tier) → connect it to the project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`. (`UPSTASH_REDIS_REST_URL`/`_TOKEN` also work.)
3. **Environment variables** (Settings → Environment Variables), see `.env.example`:
   - `AUTH_SECRET` (`openssl rand -base64 32`): required once Redis is connected.
   - `APP_URL`: your production URL, e.g. `https://signalz.vercel.app`. Previews fall back to the preview URL.
   - `CRON_SECRET`, `ENCRYPTION_KEY`, `APIFY_WEBHOOK_SECRET`: long random strings.
   - Optional: `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, OAuth credentials, `BETA_DEMO_LOGIN=true`.
4. **Redeploy**, sign up, create a workspace, and click "Load demo data" or research a URL.

### Sign-in providers

Providers whose env vars are missing are hidden on the login page. E-mail + password always works (users are stored in Redis, passwords hashed with bcrypt).

- **Google:** Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web). Authorized redirect URI: `{APP_URL}/api/auth/callback/google`. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
- **Microsoft:** Microsoft Entra admin center → App registrations → New registration. Redirect URI (Web): `{APP_URL}/api/auth/callback/microsoft-entra-id`. Create a client secret. Set `AUTH_MICROSOFT_ENTRA_ID_ID` (Application ID), `AUTH_MICROSOFT_ENTRA_ID_SECRET` and `AUTH_MICROSOFT_ENTRA_ID_ISSUER` (`https://login.microsoftonline.com/<tenant-id>/v2.0`, or `/common/v2.0` for any tenant).
- **Demo account:** `BETA_DEMO_LOGIN=true` (on by default in development).

## Apify setup

1. Create an Apify account, copy the API token (Settings → API & Integrations) into `APIFY_TOKEN`. Set `APIFY_WEBHOOK_SECRET`.
2. Pick actors. Every source is swappable through an env var; Settings → Data sources lists the candidates with links. Prefer actors that need **no LinkedIn cookie**.

   | Source | Env var | Candidates |
   |---|---|---|
   | LinkedIn jobs (required) | `APIFY_JOBS_ACTOR_ID` | `bebity/linkedin-jobs-scraper`, `automation-lab/linkedin-jobs-scraper`, `valig/linkedin-jobs-scraper` |
   | LinkedIn profile (required) | `APIFY_PROFILE_ACTOR_ID` | `dev_fusion/linkedin-profile-scraper`, `automation-lab/linkedin-profile-scraper`, `usestring/linkedin-profiles` |
   | LinkedIn company (required) | `APIFY_COMPANY_ACTOR_ID` | `automation-lab/linkedin-company-scraper`, `northbell/linkedin-company-growth-scraper` |
   | Company employees | `APIFY_EMPLOYEES_ACTOR_ID` | `automation-lab/linkedin-company-employees-scraper` |
   | LinkedIn posts | `APIFY_POSTS_ACTOR_ID` | `khadinakbar/linkedin-profile-posts-scraper`, `automation-lab/linkedin-post-scraper` |
   | StepStone (DACH) | `APIFY_STEPSTONE_ACTOR_ID` | `thirdwatch/stepstone-jobs-scraper`, `scrapesage/stepstone-scraper` |

3. **Run each actor once in the Apify console** with a real URL and check: the input fields it expects, the output field names (especially **start dates** of roles and **posting dates**) and the price per result. Field-name differences are handled in `src/lib/pipeline/mappers.ts` (`pick(obj, ...paths)`); add a path there if your actor uses a new name. If an actor needs a specific input shape, set `APIFY_<KIND>_INPUT` (see `.env.example`).

### How the pipeline works

Vercel functions can't wait minutes for a scraper, so each step is a short request and steps are chained by **Apify ad-hoc webhooks**:

```
POST /api/research ─▶ start profile actor (webhook → /api/apify/callback?r=…&step=profile&sig=HMAC)
callback(profile)  ─▶ map person ─▶ start company actor
callback(company)  ─▶ map company ─▶ start jobs actor (f_C=<companyId>, last 60 days)
callback(jobs)     ─▶ classify (rules, then Claude in batches of 20) ─▶ merge under lock ─▶ score ─▶ done
```

Callbacks are verified (HMAC-SHA256, constant time) and idempotent (a callback for a step that isn't current is ignored). Requests unchanged for 20 minutes are failed ("No answer from Apify") and can be retried.

### Testing on a preview deployment

Apify must reach the callback URL, so `localhost` won't work. Either:

- push a branch and test on its **Vercel preview** (the app uses the preview URL automatically when `APP_URL` is unset; make sure preview deployments have the env vars and are not behind Vercel Authentication, or add a protection-bypass for `/api/apify/callback`), or
- run locally with a tunnel (`cloudflared tunnel --url http://localhost:3000` or ngrok) and set `APP_URL` to the tunnel URL.

Then paste a LinkedIn URL on `/research` and watch it go Queued → Profile → Company → Jobs → Classifying → Scoring → Done. Without `APIFY_TOKEN`, use **Simulate with demo data**: the same pipeline runs on fixtures from `src/lib/pipeline/fixtures/`.

## Crons (`vercel.json`)

| Path | Schedule | What |
|---|---|---|
| `/api/cron/stuck` | daily 04:30 UTC | fail research requests unchanged for 20 min |
| `/api/cron/refresh` | daily 05:00 UTC | re-run the jobs step for companies enriched > 24 h ago (max 50) |
| `/api/cron/market-scan` | Mondays 06:00 UTC | run every workspace's saved searches |
| `/api/cron/retention` | Sundays 03:00 UTC | drop posts and raw job texts older than 180 days |

All cron routes require `Authorization: Bearer $CRON_SECRET` (Vercel sends it when `CRON_SECRET` is set).

**Vercel Hobby only allows daily crons**, so the stuck check runs daily, and the research page also fails stuck requests whenever anyone opens it. On a Pro plan, change the stuck schedule to `*/15 * * * *`.

## Claude

With `ANTHROPIC_API_KEY` set, postings and people are classified with Claude (`ANTHROPIC_MODEL`, default `claude-opus-5-5`) using structured outputs, and "Write with Claude" drafts openers (German for DACH unless the profile is English). Refusals, invalid output and API errors fall back to the rules classifier and the templates. Without a key, the UI says so and uses rules and templates. For supported models, server-side refusal fallbacks (`fallbacks: "default"`) are enabled.

## Data model (Redis)

All access goes through the `Store` interface in `src/lib/store/` (Redis or in-memory), so Postgres can replace it later. Keys are namespaced by workspace: `user:{id}`, `org:{id}`, `org:{id}:members` (hash), `invite:{token}`, `org:{id}:settings`, `company:{id}` (with embedded jobs, people, clusters, score, owner, CRM state), `org:{id}:companies` (sorted by priority), `org:{id}:companyKey:{key}` (dedupe), `org:{id}:signals`, `research:{id}`, `org:{id}:outreach`, `org:{id}:templates`, `org:{id}:scans`, `org:{id}:audit`, `lock:company:{id}`. The beta reads all companies of a workspace into memory for the dashboard (`loadCompanies` in `src/lib/accounts.ts`), fine up to ~2,000 accounts.

## Code map

- `src/lib/scoring.ts`: clusters, Hiring Cluster Index, fit / timing / reach / priority, buckets, reasons, signals (pure, unit-tested)
- `src/lib/pipeline/`: `rules.ts` (rules classifier), `classify.ts` (Claude), `mappers.ts`, `apify.ts`, `steps.ts`, `merge.ts`, `scan.ts`, `fixtures/`
- `src/lib/store/`: `Store` interface, Upstash and in-memory backends
- `src/lib/crm/hubspot.ts`, `src/lib/export.ts`: HubSpot push (with dry run) and CSV/JSON export
- `src/app/api/`: route handlers (zod-validated, JSON errors `{ error, message }`, session + workspace role checked)
- `tests/`: Vitest (scoring, rules, mappers, URL normalisation, simulated pipeline, export, seats)

## Data protection (GDPR)

Only business-context data about people is stored (name, title, employer, public profile facts, work posts). Posts and raw job texts are dropped after 180 days. Every profile card shows source and scrape date. Admins can delete a person and add them to a do-not-scrape list. E-mail openers can include a line saying where the data came from (Art. 14; Settings → Data sources). Scraping LinkedIn may conflict with LinkedIn's terms: every source is swappable for licensed data, and the server never uses an SDR's own LinkedIn session. Signalz never sends messages on LinkedIn: the SDR copies the text, sends it and logs the step.
