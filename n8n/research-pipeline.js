// Hiring Signals · research pipeline (n8n Code node, "Run Once for All Items").
// Input: the verified webhook body { request_id, org_id, linkedin_url, kind, sent_at } and the Config node.
// Output: rows in Supabase via two RPCs (see supabase/006_research_ingest.sql).
//
// ADAPT HERE: the three Apify actors return different field names. Edit the *Input() functions
// (what each actor expects) and the map*() functions (what it returns). Everything else stays.

const cfg = $('Config').first().json;
const job = $('Webhook').first().json.body;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
// Reads the status code itself so failures carry the API's own message (Apify, Featherless, Supabase).
const http = async (opts) => {
  const res = await this.helpers.httpRequest({
    json: true,
    timeout: 300000,
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
    ...opts,
  });
  if (res.statusCode >= 400) {
    const b = res.body;
    const detail = b?.error?.message ?? b?.message ?? (typeof b?.error === 'string' ? b.error : null) ?? (typeof b === 'string' ? b.slice(0, 300) : JSON.stringify(b)?.slice(0, 300));
    const where = String(opts.url).replace(/token=[^&]+/, 'token=***').split('?')[0];
    throw new Error(`${where} answered ${res.statusCode}: ${detail}`);
  }
  return res.body;
};

const rpc = (fn, body) =>
  http({
    method: 'POST',
    url: `${cfg.supabaseUrl}/rest/v1/rpc/${fn}`,
    headers: { apikey: cfg.supabaseServiceKey, Authorization: `Bearer ${cfg.supabaseServiceKey}`, 'Content-Type': 'application/json' },
    body,
  });

const status = (s, error) => rpc('set_research_status', { p_request: job.request_id, p_status: s, p_error: error ?? null });

// Runs an Apify actor and returns its dataset items (waits up to 5 minutes).
const apify = (actorId, input) =>
  http({
    method: 'POST',
    url: `https://api.apify.com/v2/acts/${encodeURIComponent(actorId.replace('/', '~'))}/run-sync-get-dataset-items?token=${cfg.apifyToken}&timeout=280`,
    body: input,
  });

async function featherless(system, user) {
  const res = await http({
    method: 'POST',
    url: 'https://api.featherless.ai/v1/chat/completions',
    headers: { Authorization: `Bearer ${cfg.featherlessKey}`, 'Content-Type': 'application/json' },
    body: {
      model: cfg.featherlessModel || 'Qwen/Qwen2.5-7B-Instruct',
      temperature: 0,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
  });
  const text = res?.choices?.[0]?.message?.content ?? '';
  const start = text.search(/[\[{]/);
  const end = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'));
  if (start < 0 || end <= start) throw new Error('Featherless did not return JSON');
  return JSON.parse(text.slice(start, end + 1));
}

// First non-empty value among several possible field names (actors differ).
const pick = (o, ...keys) => {
  for (const k of keys) {
    const v = k.split('.').reduce((x, p) => (x == null ? undefined : x[p]), o);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
};
// First number in a value: 420, "420", "1,200 employees", "201-500" (→ 201).
const num = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const m = String(v).replace(/(\d),(\d{3})/g, '$1$2').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// Any date an actor returns → ISO string, or null: ISO text, "Jan 2025", {year, month}, epoch, "3 days ago".
const toIso = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'object') {
    if (!v.year) return null;
    return new Date(Date.UTC(v.year, (v.month ?? 1) - 1, v.day ?? 1)).toISOString();
  }
  if (typeof v === 'number') return new Date(v > 1e12 ? v : v * 1000).toISOString();
  const rel = String(v).match(/(\d+)\s*(minute|hour|day|week|month|year)/i);
  if (rel && /ago|vor/i.test(String(v))) {
    const ms = { minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 }[rel[2].toLowerCase()];
    return new Date(Date.now() - Number(rel[1]) * ms).toISOString();
  }
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};
const toDay = (v) => toIso(v)?.slice(0, 10) ?? null;

// ---------------------------------------------------------------------------
// ADAPT HERE: actor inputs
// ---------------------------------------------------------------------------
const profileInput = (url) => ({ profileUrls: [url] });
const companyInput = (url) => ({ companyUrls: [url] });
const jobsInput = (company) => ({
  // Most LinkedIn job actors take a jobs search URL; f_C filters by LinkedIn company id, f_TPR=r5184000 = last 60 days.
  urls: [
    company.linkedin_id
      ? `https://www.linkedin.com/jobs/search/?f_C=${company.linkedin_id}&f_TPR=r5184000`
      : `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(company.name)}&f_TPR=r5184000`,
  ],
  count: 100,
});

// ---------------------------------------------------------------------------
// ADAPT HERE: actor outputs → the shape ingest_research expects
// ---------------------------------------------------------------------------
function mapPerson(p, url) {
  const exp = pick(p, 'experiences', 'experience', 'positions') ?? [];
  const current = exp[0] ?? {};
  return {
    linkedin_url: url,
    full_name: pick(p, 'fullName', 'full_name', 'name') ?? [pick(p, 'firstName'), pick(p, 'lastName')].filter(Boolean).join(' '),
    headline: pick(p, 'headline', 'occupation'),
    photo_url: pick(p, 'profilePic', 'profilePicture', 'photoUrl', 'profile_pic_url'),
    current_title: pick(p, 'jobTitle', 'currentJobTitle', 'title') ?? pick(current, 'title'),
    started_current_role_at: toDay(pick(current, 'startDate', 'starts_at', 'start', 'dateRange.start')),
    location: pick(p, 'addressWithCountry', 'location', 'geoLocationName'),
    country: pick(p, 'countryCode', 'country_code'),
    about: pick(p, 'about', 'summary'),
    previous_roles: exp.slice(0, 8).map((e) => ({
      company: pick(e, 'companyName', 'company', 'subtitle'),
      title: pick(e, 'title'),
      from: pick(e, 'startDate', 'starts_at', 'start'),
      to: pick(e, 'endDate', 'ends_at', 'end'),
      description: pick(e, 'description'),
    })),
    skills: (pick(p, 'skills') ?? []).map((s) => (typeof s === 'string' ? s : pick(s, 'name', 'title'))).filter(Boolean).slice(0, 30),
    recent_posts: (pick(p, 'posts', 'activities', 'updates') ?? []).slice(0, 3).map((x) => ({
      text: pick(x, 'text', 'title', 'content'),
      url: pick(x, 'url', 'link'),
      posted_at: toIso(pick(x, 'postedAt', 'date', 'time')),
    })),
    followers: num(pick(p, 'followers', 'followersCount')),
    connections: num(pick(p, 'connections', 'connectionsCount')),
    company_linkedin_url: pick(p, 'companyLinkedinUrl', 'company_linkedin_url', 'currentCompany.url') ?? pick(current, 'companyLink1', 'companyUrl', 'company_linkedin_profile_url'),
    raw: p,
  };
}

function mapCompany(c, url) {
  return {
    name: pick(c, 'name', 'companyName', 'company_name'),
    domain: pick(c, 'website', 'websiteUrl', 'domain'),
    linkedin_url: url,
    linkedin_id: pick(c, 'companyId', 'id', 'linkedinId', 'company_id'),
    logo_url: pick(c, 'logo', 'logoUrl', 'logo_url', 'profilePicture'),
    industry: pick(c, 'industry', 'industries.0', 'industryName'),
    employee_count: num(pick(c, 'employeeCount', 'staffCount', 'employees', 'company_size_on_linkedin')),
    employee_growth_6m: num(pick(c, 'employeeGrowth6m', 'growth6Months')),
    hq_country: pick(c, 'headquarter.country', 'hq.country', 'countryCode', 'locations.0.country'),
    hq_city: pick(c, 'headquarter.city', 'hq.city', 'locations.0.city'),
    description: pick(c, 'description', 'about', 'tagline'),
  };
}

function mapJob(j) {
  return {
    source: 'linkedin',
    external_id: String(pick(j, 'id', 'jobId', 'job_id', 'trackingId') ?? pick(j, 'link', 'url', 'jobUrl')),
    url: pick(j, 'link', 'url', 'jobUrl'),
    title: pick(j, 'title', 'jobTitle', 'positionName'),
    location: pick(j, 'location', 'jobLocation'),
    posted_at: toIso(pick(j, 'postedAt', 'publishedAt', 'listedAt', 'postedDate')),
    description: String(pick(j, 'descriptionText', 'description', 'jobDescription') ?? '').slice(0, 6000),
  };
}

// ---------------------------------------------------------------------------
// Classification with Featherless.ai
// ---------------------------------------------------------------------------
const CLASSIFY_SYSTEM = `You classify job postings for a B2B sales-intelligence tool.
A division is function + business unit + region inside one company, e.g. "sales / Wholesale / DACH".
For each posting return an object with:
  index (number, as given), function (sales|revops|marketing|customer_success|partnerships|other),
  business_unit (short name like Wholesale, B2B, Enterprise, SME, Fleet, or "" if unknown),
  region (DACH|EMEA|Nordics|UK|US|APAC|… or "" if unknown),
  role_family (sales_leader|sdr_bdr|account_executive|account_manager|revops|sales_enablement|sales_engineer|marketing|customer_success|other),
  seniority (intern|ic|lead|manager|director|vp|c_level),
  crm_mentions (array, lower case: salesforce, hubspot, pipedrive, dynamics, zoho, sap, excel…),
  flags (array of: first_sdr, founding_team, new_region, build_from_scratch, outbound),
  is_excluded (boolean), exclusion_reason (string or "").
Rules: retail store staff, shop floor, cashiers and call-center agents are excluded even if the title says "sales".
"Key Account Manager Retail" or "AE Retail Partnerships" sell TO retailers and are NOT excluded.
Answer with a JSON array only.`;

const PERSON_SYSTEM = `Classify this LinkedIn person for a B2B sales-intelligence tool. Answer with JSON only:
{"role_family": sales_leader|sdr_bdr|account_executive|account_manager|revops|sales_enablement|marketing|customer_success|other,
 "seniority": intern|ic|lead|manager|director|vp|c_level,
 "persona": economic_buyer|champion|user|influencer|unknown,
 "is_decision_maker": boolean,
 "prior_tools": array of sales tools named in their past roles (lower case, e.g. hubspot, salesforce, outreach),
 "division": {"function": sales|revops|marketing|customer_success|partnerships|other, "business_unit": string, "region": string}}`;

async function classifyJobs(jobs, company) {
  const out = [];
  for (let i = 0; i < jobs.length; i += 20) {
    const batch = jobs.slice(i, i + 20).map((j, k) => ({ index: i + k, title: j.title, location: j.location, description: j.description.slice(0, 1500) }));
    const res = await featherless(CLASSIFY_SYSTEM, `Company: ${company.name} (${company.industry ?? 'unknown industry'}, HQ ${company.hq_country ?? '?'})\nPostings:\n${JSON.stringify(batch)}`);
    for (const r of Array.isArray(res) ? res : res.postings ?? []) out[r.index] = r;
  }
  return jobs.map((j, i) => ({ ...j, ...(out[i] ?? { function: 'other', role_family: 'other' }), classified_by: 'llm' }));
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
try {
  let person = null;
  let companyUrl = job.kind === 'company' ? job.linkedin_url : null;

  if (job.kind === 'person') {
    await status('scraping_profile');
    const items = await apify(cfg.profileActor, profileInput(job.linkedin_url));
    if (!items?.length) throw new Error('Profile not found by the Apify profile actor');
    person = mapPerson(items[0], job.linkedin_url);
    companyUrl = person.company_linkedin_url;
    if (!companyUrl) throw new Error("Could not find the person's current company on LinkedIn");
  }

  await status('scraping_company');
  const companies = await apify(cfg.companyActor, companyInput(companyUrl));
  if (!companies?.length) throw new Error('Company not found by the Apify company actor');
  const company = mapCompany(companies[0], companyUrl.replace(/\/+$/, ''));
  if (!company.name) throw new Error('The company actor returned no company name');

  await status('scraping_jobs');
  const rawJobs = (await apify(cfg.jobsActor, jobsInput(company))) ?? [];
  const jobs = rawJobs.map(mapJob).filter((j) => j.external_id && j.title);

  await status('classifying');
  const classified = jobs.length ? await classifyJobs(jobs, company) : [];
  if (person) {
    const p = await featherless(
      PERSON_SYSTEM,
      JSON.stringify({ title: person.current_title, headline: person.headline, company: company.name, previous_roles: person.previous_roles, about: person.about?.slice(0, 1500) }),
    );
    Object.assign(person, p);
  }

  await status('scoring');
  const { company_linkedin_url, ...personRow } = person ?? {};
  const { linkedin_id, ...companyRow } = company;
  const result = await rpc('ingest_research', {
    p: { request_id: job.request_id, company: companyRow, person: person ? personRow : null, jobs: classified },
  });
  return [{ json: { ok: true, ...result } }];
} catch (e) {
  const message = e?.message ?? String(e);
  await status('failed', String(message).slice(0, 900)).catch(() => {});
  return [{ json: { ok: false, error: message } }];
}
