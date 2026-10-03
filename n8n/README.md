# Research pipeline: n8n setup

The SDR pastes a LinkedIn URL on **/research**. Everything after that runs in n8n:

```
App (/api/research) ──signed POST──▶ n8n Webhook
                                      ├─ verify signature
                                      ├─ Apify: profile → company → jobs
                                      ├─ Featherless.ai: classify jobs + person
                                      └─ Supabase: rpc/ingest_research  ──▶ dashboard updates live
```

Progress shows live on /research (Queued → Profile → Company → Jobs → Classifying → Scoring → Done)
because n8n calls `rpc/set_research_status` at each step.

## 1. Database

Run `supabase/006_research_ingest.sql` in the Supabase SQL Editor (after 001–005).

## 2. Import the workflow

n8n → **Workflows → Import from file** → `n8n/research.workflow.json`.

Open the **Config** node and fill in:

| Field | Where it comes from |
|---|---|
| `supabaseUrl` | Supabase → Project Settings → Data API → Project URL (`https://xxxx.supabase.co`, nothing after `.co`) |
| `supabaseServiceKey` | Supabase → Project Settings → API Keys → **secret** key (`sb_secret_…`). Never put this in the app or the browser. |
| `apifyToken` | Apify → Settings → API & Integrations |
| `profileActor`, `companyActor`, `jobsActor` | The Apify actors you picked, as `owner~actor-name` (or the actor id) |
| `featherlessKey`, `featherlessModel` | featherless.ai → API keys; model default `Qwen/Qwen2.5-7B-Instruct` |
| `webhookSecret` | Any long random string. **The same value** goes into Vercel as `N8N_WEBHOOK_SECRET`. |

Using n8n Variables or credentials instead of plain values is fine: replace a value with `{{ $vars.NAME }}`.

**Activate** the workflow and copy the **Production URL** of the Webhook node
(`https://<your-n8n>/webhook/signalz-research`).

## 3. Vercel

Settings → Environment Variables, then redeploy:

| Key | Type | Value |
|---|---|---|
| `N8N_RESEARCH_WEBHOOK_URL` | Config | the Webhook **Production URL** |
| `N8N_WEBHOOK_SECRET` | Secret | the same string as `webhookSecret` in n8n |
| `RESEARCH_LIMIT_PER_DAY` | Config (optional) | URLs per user per 24 h, default 50 |

The yellow "not connected" banner on /research disappears once both are set.

## 4. Adapt the Apify actors

Actors differ in what they expect and return. In the **Research pipeline** Code node, edit only the
two sections marked `ADAPT HERE`:

- `profileInput` / `companyInput` / `jobsInput`: the JSON input each actor expects
  (copy it from the actor's "Input" tab → JSON).
- `mapPerson` / `mapCompany` / `mapJob`: which output fields hold the name, title, website, job id…
  `pick(obj, 'a', 'b', 'c')` takes the first field that exists, so you can list several candidates.
  Dates (`"3 days ago"`, `{year, month}`, ISO) and counts (`"201-500"`) are normalised for you.

Tip: run each actor once in Apify with a real URL and look at the dataset JSON, then adjust the mappers.
Prefer actors that do not need a LinkedIn cookie.

Editing the code: change `n8n/research-pipeline.js` and run `node n8n/build-workflow.mjs` to refresh the
import file, or edit the Code node directly in n8n.

## Troubleshooting

- **Request stays on "Queued"**: n8n was not reached. Check the two Vercel variables, that the workflow
  is **active**, and that you used the *Production* URL (not the Test URL).
- **"Failed: … answered 401/403"**: wrong key in the Config node (the message names the service).
- **"Failed: … answered 400: Input is not valid …"**: the actor expects a different input; fix `*Input()`.
- **Runs stop after ~5 minutes**: n8n limits a Code node to 300 s by default. Self-hosted: set
  `N8N_RUNNERS_TASK_TIMEOUT=900`. Or use faster actors / fewer jobs (`count` in `jobsInput`).
- **Company found but no clusters**: the jobs actor returned nothing, or every job was classified outside
  `sales`/`revops`. Look at the execution in n8n → Executions.

## Tested

The workflow was imported into n8n 2.x and run end to end against mocked Apify/Featherless responses and
a Postgres copy of the schema: bad signatures are rejected, a person URL goes through every status to
`done` and the company is scored, a company URL skips the profile step, and actor errors mark the request
`failed` with the actor's message.

## The contract (if you build your own workflow instead)

**What the app sends** (POST, JSON):

```json
{ "request_id": "uuid", "org_id": "uuid", "linkedin_url": "https://www.linkedin.com/in/jane-doe",
  "kind": "person", "sent_at": "2026-10-03T10:00:00.000Z" }
```

Header `X-Signature` = hex HMAC-SHA256 of the raw body with `N8N_WEBHOOK_SECRET`.
Reject when the signature differs or `sent_at` is older than 5 minutes. Answer 2xx right away
(the work continues in the background).

**Status updates** (service role key in `apikey` and `Authorization: Bearer` headers):

```
POST {supabaseUrl}/rest/v1/rpc/set_research_status
{ "p_request": "<request_id>", "p_status": "scraping_company" }
```

Statuses: `scraping_profile`, `scraping_company`, `scraping_jobs`, `classifying`, `scoring`,
`failed` (add `"p_error": "message"`). `done` is set by `ingest_research`.

**Results**: one call, one transaction; it re-scores the company and marks the request done:

```
POST {supabaseUrl}/rest/v1/rpc/ingest_research
{ "p": {
  "request_id": "<request_id>",
  "company": { "name": "Laufwerk Sneakers", "domain": "laufwerk.de", "linkedin_url": "https://www.linkedin.com/company/laufwerk",
               "logo_url": null, "industry": "Footwear", "employee_count": 420, "employee_growth_6m": 18,
               "hq_country": "DE", "hq_city": "Berlin", "description": "…", "current_crm": "salesforce" },
  "person": { "linkedin_url": "https://www.linkedin.com/in/jonas-weber", "full_name": "Jonas Weber",
              "current_title": "Head of Sales Wholesale", "started_current_role_at": "2026-09-12",
              "role_family": "sales_leader", "seniority": "director", "persona": "economic_buyer",
              "is_decision_maker": true, "prior_tools": ["hubspot"], "country": "DE",
              "recent_posts": [{ "text": "…", "url": "…", "posted_at": "…" }],
              "division": { "function": "sales", "business_unit": "Wholesale", "region": "DACH" } },
  "jobs": [ { "source": "linkedin", "external_id": "3901234567", "url": "…", "title": "SDR Wholesale DACH",
              "posted_at": "2026-09-28T00:00:00Z", "function": "sales", "business_unit": "Wholesale", "region": "DACH",
              "role_family": "sdr_bdr", "seniority": "ic", "crm_mentions": ["salesforce"], "flags": ["first_sdr"],
              "is_excluded": false, "exclusion_reason": "" } ]
} }
```

- `person` is optional (company URLs have none). Every field except `company.name`, `jobs[].external_id`
  and `jobs[].title` is optional.
- Unknown values for `function`, `role_family` or `seniority` are stored as `other` / empty instead of failing.
- Jobs from the same `source` that are missing in a later scrape are marked closed.
- Returns `{ "company_id", "person_id", "jobs", "priority" }`.

## Daily refresh (next)

A second workflow (cron 06:00 Europe/Berlin) can re-run the jobs step for companies whose
`last_enriched_at` is older than 24 h and call `ingest_research` with a fresh `request_id`
(insert a `research_requests` row first with the service key). Ask and it can be added to this folder.
