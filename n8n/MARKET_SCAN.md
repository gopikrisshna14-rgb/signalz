# Bulk market scan → Supabase

The bulk LinkedIn Jobs scan (e.g. all of Germany) writes into the **same tables** as everything else, so the
Today dashboard, account pages, clusters, scores and outreach tracking work with its results unchanged:

```
companies → divisions → job_postings → hiring_clusters / signals → account_scores → dashboard
```

It does **not** use `ingest_research` (the single-URL `/research` flow, see `README.md`). Both coexist:

| Flow | Entry point | Notes |
|---|---|---|
| `/research` (one LinkedIn URL) | app → n8n webhook → `rpc/ingest_research` | needs a `research_requests` row; closes that company's postings missing from the new scrape |
| Bulk market scan | n8n → `rpc/ingest_market_scan` | no request row; **never closes postings** (a market search is incomplete by design) |

## Setup

1. Run `supabase/007_market_scan_ingest.sql` in the Supabase SQL Editor (after 001–006).
2. In n8n, add an **HTTP Request** node at the end of the scan:
   - Method `POST`, URL `{{SUPABASE_URL}}/rest/v1/rpc/ingest_market_scan`
   - Headers: `apikey: <service role key>`, `Authorization: Bearer <service role key>`, `Content-Type: application/json`
   - Body (JSON): `{ "p": <payload below> }`

   The service role key stays in n8n. It is never needed in Vercel or the browser.
3. Find your `org_id`: in the app, **Settings → Workspace → Workspace ID**.
4. Example request body with all three hit types and a skipped recruiter posting: `n8n/market-scan.example.json`.

Optional but recommended: call the RPC once at the start with `"status": "running"` and no jobs, and with
`"status": "failed", "error": "…"` from the error branch. The dashboard then shows running/failed scans too.
Large scans can be sent in several batches with the same `n8n_execution_id`; they are merged into one run.

## Payload contract

```json
{
  "p": {
    "org_id": "uuid",                       // required: the workspace
    "n8n_execution_id": "21",               // recommended: makes reruns update the same run
    "status": "completed",                  // running | completed | failed   (default completed)
    "error": null,                          // text, only for status = failed
    "started_at": "2026-10-03T08:00:00Z",   // optional (default: now, on the first call)
    "finished_at": null,                    // optional (default: now, when completed/failed)
    "apify_cost_usd": 0.098425,
    "raw_job_count": 120,
    "unique_job_count": 112,
    "jobs": [
      {
        "source": "linkedin",               // linkedin | careers_page | stepstone | indeed | other
        "external_id": "4454261516",        // required; (org, source, external_id) is the idempotency key
        "url": "https://www.linkedin.com/jobs/view/4454261516",
        "title": "Account Executive (m/w/d)",   // required
        "posted_at": "2026-10-03T00:00:00Z",
        "location": "Berlin, Germany",
        "country": "DE",
        "description": "…",
        "company": {
          "name": "yoursquares GmbH",       // required, the real employer
          "domain": null,
          "linkedin_url": "https://www.linkedin.com/company/yoursquares",
          "employer_identified": true       // false → job is skipped (recruiter / investor / "our client")
        },
        "division": { "function": "sales", "business_unit": "general_sales", "region": "Berlin" },
        "team_key": "yoursquares-sales-berlin",  // NEW: same value for a manager + IC pair (see below)
        "role_family": "account_executive",
        "seniority": "ic",
        "flags": [],
        "crm_mentions": [],
        "classified_by": "featherless",
        "raw": {
          "search_bucket": "ic",
          "signal_evidence": null           // founding roles: { "reason": "…", "excerpt": "…" }
        }
      }
    ]
  }
}
```

Response:

```json
{ "scan_id": "uuid", "status": "completed", "companies_touched": 2, "jobs_inserted": 3, "jobs_updated": 0,
  "jobs_skipped": 1, "skipped": [{ "external_id": "…", "reason": "employer not identified" }],
  "founding_signals_created": 1, "companies_scored": 2, "hit_count": 2 }
```

## Mapping from the current n8n outputs

| n8n classifier output | Send as |
|---|---|
| Sales Manager / Head of Sales / Sales Lead | `role_family: "sales_leader"`, `seniority: "manager"` (or `director`/`vp`) |
| Account Executive | `role_family: "account_executive"`, `seniority: "ic"` |
| Sales Development Representative | `role_family: "sdr_bdr"`, `seniority: "ic"` |
| Founding sales / GTM role that passed the LLM check | `flags: ["founding_team"]` and/or `["build_from_scratch"]`, plus `raw.signal_evidence = { reason, excerpt }` |
| Third-party / recruiter / investor / portfolio posting without a named employer | `company.employer_identified: false` (or omit `company`): the job is skipped, nothing is invented |

The RPC also accepts common aliases (`sales_manager`, `head_of_sales`, `sales_lead`, `ae`, `sdr`, `bdr`) and maps
them; anything unknown is stored as `other`. `business_unit` / `region` values like `general_sales` are shown as
"General Sales".

### Fields to add in n8n

1. **`team_key`** (new, per job): for a manager + IC pair the LLM says belong together, give both jobs the same
   `team_key` (e.g. `<company-slug>-<function>-<region>`). The RPC then gives every job of that team the same
   division (the leader's), also across later scans that see only part of the team. This is what makes the
   pair count as one hiring cluster. Without `team_key`, both jobs must carry identical `division` values.
2. **`company.employer_identified`** (new, per job): `false` for postings where the real employer is unknown.
3. **`raw.signal_evidence`** for founding roles: the LLM's exact `reason` and the supporting `excerpt`.
   Kept in `job_postings.raw` and copied into a `signals` row (type `first_sdr`, shown under "Just changed").
4. Make sure `company.linkedin_url` is the company page (`/company/<slug>`), not the job URL: it is the main
   match key (case-insensitive, query strings and trailing slashes ignored), then `domain`.

## What the RPC does

- Creates/updates the `market_scan_runs` row (one per `org_id` + `n8n_execution_id`).
- Upserts companies by LinkedIn company URL, then domain; never overwrites existing data with blanks.
- Upserts divisions and job postings; reruns update, never duplicate. Jobs seen again are re-opened.
- Keeps the full classifier output in `job_postings.raw.classifier`, plus `raw.market_scan` (run id, seen at).
- **Never closes postings.**
- Calls `recompute_company` for every company touched. Since 007, one open role flagged
  `founding_team` / `build_from_scratch` / `first_sdr` also forms a hiring cluster.

## Checking a run

- App: **Today** shows "Latest market scan"; **Settings → Market scans** lists recent runs.
- SQL: `select * from market_scan_runs order by created_at desc limit 5;`
