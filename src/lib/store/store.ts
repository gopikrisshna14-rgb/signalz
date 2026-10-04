import type {
  AuditEntry,
  Company,
  HubspotConfig,
  Invite,
  Membership,
  Org,
  OutreachEvent,
  Research,
  Scan,
  Settings,
  Signal,
  Template,
  User,
} from "@/lib/types";
import { defaultSettings, Settings as SettingsSchema } from "@/lib/types";
import type { Kv } from "./kv";

/**
 * Every read and write of app data goes through this interface. The beta implements it on Redis
 * (or an in-memory map); a Postgres implementation can replace it without touching callers.
 */
export interface Store {
  readonly persistent: boolean;

  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  putUser(user: User): Promise<void>;
  listUserOrgIds(userId: string): Promise<string[]>;

  getOrg(id: string): Promise<Org | null>;
  putOrg(org: Org): Promise<void>;
  listOrgIds(): Promise<string[]>;
  findOrgByDomain(domain: string): Promise<Org | null>;
  deleteOrg(id: string): Promise<void>;

  getMembers(orgId: string): Promise<Record<string, Membership>>;
  setMember(orgId: string, userId: string, m: Membership): Promise<void>;

  getInvite(token: string): Promise<Invite | null>;
  putInvite(invite: Invite): Promise<void>;
  deleteInvite(invite: Invite): Promise<void>;
  listInvites(orgId: string): Promise<Invite[]>;

  getSettings(orgId: string): Promise<Settings>;
  putSettings(orgId: string, s: Settings): Promise<void>;
  getHubspot(orgId: string): Promise<HubspotConfig | null>;
  putHubspot(orgId: string, c: HubspotConfig | null): Promise<void>;

  getCompany(id: string): Promise<Company | null>;
  putCompany(c: Company): Promise<void>;
  deleteCompany(c: Company): Promise<void>;
  /** All companies of a workspace (fine for the beta, up to ~2,000 accounts). */
  listCompanies(orgId: string): Promise<Company[]>;
  findCompanyByKey(orgId: string, key: string): Promise<string | null>;
  setCompanyKey(orgId: string, key: string, companyId: string): Promise<void>;
  /** Runs fn while holding lock:company:{id} (SET NX EX 30). */
  withCompanyLock<T>(companyId: string, fn: () => Promise<T>): Promise<T>;

  addSignals(orgId: string, signals: Signal[]): Promise<void>;
  listSignals(orgId: string, limit?: number): Promise<Signal[]>;

  getResearch(id: string): Promise<Research | null>;
  putResearch(r: Research): Promise<void>;
  listResearch(orgId: string, limit?: number): Promise<Research[]>;

  addOutreach(e: OutreachEvent): Promise<void>;
  listOutreach(orgId: string, limit?: number): Promise<OutreachEvent[]>;
  listCompanyOutreach(companyId: string): Promise<OutreachEvent[]>;
  removeOutreach(e: OutreachEvent): Promise<void>;

  getTemplates(orgId: string): Promise<Template[]>;
  putTemplates(orgId: string, t: Template[]): Promise<void>;

  getScan(id: string): Promise<Scan | null>;
  putScan(s: Scan): Promise<void>;
  listScans(orgId: string, limit?: number): Promise<Scan[]>;

  addAudit(orgId: string, e: AuditEntry): Promise<void>;
  listAudit(orgId: string, limit?: number): Promise<AuditEntry[]>;

  /** Daily KPI snapshots (date → counts) for the 7-day deltas on Today. */
  getKpiHistory(orgId: string): Promise<Record<string, Record<string, number>>>;
  putKpiSnapshot(orgId: string, date: string, kpis: Record<string, number>): Promise<void>;

  /** Increments a counter that expires after `windowSeconds`; returns the new count. */
  hit(key: string, windowSeconds: number): Promise<number>;
}

const k = {
  user: (id: string) => `user:${id}`,
  userEmail: (email: string) => `user:email:${email.toLowerCase()}`,
  userOrgs: (id: string) => `user:${id}:orgs`,
  org: (id: string) => `org:${id}`,
  orgs: () => "orgs",
  orgDomain: (d: string) => `orgdomain:${d.toLowerCase()}`,
  members: (id: string) => `org:${id}:members`,
  invite: (t: string) => `invite:${t}`,
  invites: (id: string) => `org:${id}:invites`,
  settings: (id: string) => `org:${id}:settings`,
  hubspot: (id: string) => `org:${id}:hubspot`,
  company: (id: string) => `company:${id}`,
  companies: (id: string) => `org:${id}:companies`,
  companyKey: (orgId: string, key: string) => `org:${orgId}:companyKey:${key}`,
  lock: (id: string) => `lock:company:${id}`,
  signals: (id: string) => `org:${id}:signals`,
  research: (id: string) => `research:${id}`,
  researchIdx: (id: string) => `org:${id}:research`,
  outreach: (id: string) => `org:${id}:outreach`,
  companyOutreach: (id: string) => `company:${id}:outreach`,
  templates: (id: string) => `org:${id}:templates`,
  scan: (id: string) => `scan:${id}`,
  scans: (id: string) => `org:${id}:scans`,
  audit: (id: string) => `org:${id}:audit`,
  kpis: (id: string) => `org:${id}:kpis`,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class KvStore implements Store {
  constructor(private kv: Kv) {}

  get persistent() {
    return this.kv.persistent;
  }

  async getUser(id: string) {
    return this.kv.get<User>(k.user(id));
  }
  async getUserByEmail(email: string) {
    const id = await this.kv.get<string>(k.userEmail(email));
    return id ? this.getUser(String(id)) : null;
  }
  async putUser(user: User) {
    await this.kv.set(k.user(user.id), user);
    await this.kv.set(k.userEmail(user.email), user.id);
  }
  async listUserOrgIds(userId: string) {
    return this.kv.zrange(k.userOrgs(userId), 0, -1);
  }

  async getOrg(id: string) {
    return this.kv.get<Org>(k.org(id));
  }
  async putOrg(org: Org) {
    const prev = await this.getOrg(org.id);
    if (prev?.emailDomain && prev.emailDomain !== org.emailDomain) await this.kv.del(k.orgDomain(prev.emailDomain));
    await this.kv.set(k.org(org.id), org);
    await this.kv.zadd(k.orgs(), Date.parse(org.createdAt), org.id);
    if (org.emailDomain && org.autoJoin) await this.kv.set(k.orgDomain(org.emailDomain), org.id);
    else if (org.emailDomain) await this.kv.del(k.orgDomain(org.emailDomain));
  }
  async listOrgIds() {
    return this.kv.zrange(k.orgs(), 0, -1);
  }
  async findOrgByDomain(domain: string) {
    const id = await this.kv.get<string>(k.orgDomain(domain));
    return id ? this.getOrg(String(id)) : null;
  }
  async deleteOrg(id: string) {
    const org = await this.getOrg(id);
    const companyIds = await this.kv.zrange(k.companies(id), 0, -1);
    const members = await this.getMembers(id);
    for (const uid of Object.keys(members)) await this.kv.zrem(k.userOrgs(uid), id);
    const research = await this.kv.zrange(k.researchIdx(id), 0, -1);
    const scans = await this.kv.lrange<string>(k.scans(id), 0, -1);
    const invites = await this.kv.zrange(k.invites(id), 0, -1);
    const prefixed = await this.kv.scanKeys(`org:${id}:`);
    await this.kv.del(
      k.org(id),
      ...companyIds.flatMap((c) => [k.company(c), k.companyOutreach(c)]),
      ...research.map(k.research),
      ...scans.map(k.scan),
      ...invites.map(k.invite),
      ...prefixed,
    );
    if (org?.emailDomain) await this.kv.del(k.orgDomain(org.emailDomain));
    await this.kv.zrem(k.orgs(), id);
  }

  async getMembers(orgId: string) {
    return this.kv.hgetall<Membership>(k.members(orgId));
  }
  async setMember(orgId: string, userId: string, m: Membership) {
    await this.kv.hset(k.members(orgId), userId, m);
    await this.kv.zadd(k.userOrgs(userId), Date.parse(m.joinedAt), orgId);
  }

  async getInvite(token: string) {
    return this.kv.get<Invite>(k.invite(token));
  }
  async putInvite(invite: Invite) {
    const ttl = Math.max(60, Math.floor((Date.parse(invite.expiresAt) - Date.now()) / 1000));
    await this.kv.set(k.invite(invite.token), invite, { ex: ttl });
    await this.kv.zadd(k.invites(invite.orgId), Date.parse(invite.expiresAt), invite.token);
  }
  async deleteInvite(invite: Invite) {
    await this.kv.del(k.invite(invite.token));
    await this.kv.zrem(k.invites(invite.orgId), invite.token);
  }
  async listInvites(orgId: string) {
    const tokens = await this.kv.zrange(k.invites(orgId), 0, -1, true);
    const docs = await this.kv.mget<Invite>(tokens.map(k.invite));
    return docs.filter((d): d is Invite => d !== null && !d.acceptedAt);
  }

  async getSettings(orgId: string) {
    const s = await this.kv.get<Settings>(k.settings(orgId));
    if (!s) return defaultSettings();
    const parsed = SettingsSchema.safeParse(s);
    return parsed.success ? parsed.data : defaultSettings();
  }
  async putSettings(orgId: string, s: Settings) {
    await this.kv.set(k.settings(orgId), s);
  }
  async getHubspot(orgId: string) {
    return this.kv.get<HubspotConfig>(k.hubspot(orgId));
  }
  async putHubspot(orgId: string, c: HubspotConfig | null) {
    if (c) await this.kv.set(k.hubspot(orgId), c);
    else await this.kv.del(k.hubspot(orgId));
  }

  async getCompany(id: string) {
    return this.kv.get<Company>(k.company(id));
  }
  async putCompany(c: Company) {
    await this.kv.set(k.company(c.id), c);
    await this.kv.zadd(k.companies(c.orgId), c.score?.priority ?? 0, c.id);
  }
  async deleteCompany(c: Company) {
    await this.kv.del(k.company(c.id), k.companyOutreach(c.id));
    await this.kv.zrem(k.companies(c.orgId), c.id);
    if (c.linkedinUrl) await this.kv.del(k.companyKey(c.orgId, c.linkedinUrl));
    if (c.domain) await this.kv.del(k.companyKey(c.orgId, c.domain));
  }
  async listCompanies(orgId: string) {
    const ids = await this.kv.zrange(k.companies(orgId), 0, -1, true);
    const docs = await this.kv.mget<Company>(ids.map(k.company));
    return docs.filter((d): d is Company => d !== null);
  }
  async findCompanyByKey(orgId: string, key: string) {
    const id = await this.kv.get<string>(k.companyKey(orgId, key));
    return id ? String(id) : null;
  }
  async setCompanyKey(orgId: string, key: string, companyId: string) {
    await this.kv.set(k.companyKey(orgId, key), companyId);
  }
  async withCompanyLock<T>(companyId: string, fn: () => Promise<T>) {
    const key = k.lock(companyId);
    const token = crypto.randomUUID();
    let acquired = false;
    for (let i = 0; i < 40 && !acquired; i++) {
      acquired = await this.kv.set(key, token, { nx: true, ex: 30 });
      if (!acquired) await sleep(250 + Math.random() * 250);
    }
    if (!acquired) throw new Error("Company is busy, try again in a moment");
    try {
      return await fn();
    } finally {
      if ((await this.kv.get<string>(key)) === token) await this.kv.del(key);
    }
  }

  async addSignals(orgId: string, signals: Signal[]) {
    if (!signals.length) return;
    await this.kv.lpush(k.signals(orgId), ...signals);
    await this.kv.ltrim(k.signals(orgId), 0, 999);
  }
  async listSignals(orgId: string, limit = 200) {
    return this.kv.lrange<Signal>(k.signals(orgId), 0, limit - 1);
  }

  async getResearch(id: string) {
    return this.kv.get<Research>(k.research(id));
  }
  async putResearch(r: Research) {
    await this.kv.set(k.research(r.id), r);
    await this.kv.zadd(k.researchIdx(r.orgId), Date.parse(r.createdAt), r.id);
  }
  async listResearch(orgId: string, limit = 100) {
    const ids = await this.kv.zrange(k.researchIdx(orgId), 0, limit - 1, true);
    const docs = await this.kv.mget<Research>(ids.map(k.research));
    return docs.filter((d): d is Research => d !== null);
  }

  async addOutreach(e: OutreachEvent) {
    await this.kv.lpush(k.outreach(e.orgId), e);
    await this.kv.ltrim(k.outreach(e.orgId), 0, 4999);
    await this.kv.lpush(k.companyOutreach(e.companyId), e);
  }
  async listOutreach(orgId: string, limit = 5000) {
    return this.kv.lrange<OutreachEvent>(k.outreach(orgId), 0, limit - 1);
  }
  async listCompanyOutreach(companyId: string) {
    return this.kv.lrange<OutreachEvent>(k.companyOutreach(companyId), 0, 199);
  }

  async removeOutreach(e: OutreachEvent) {
    const [orgList, coList] = await Promise.all([this.kv.lrange<OutreachEvent>(k.outreach(e.orgId), 0, 199), this.kv.lrange<OutreachEvent>(k.companyOutreach(e.companyId), 0, 199)]);
    const a = orgList.find((x) => x.id === e.id);
    const b = coList.find((x) => x.id === e.id);
    if (a) await this.kv.lrem(k.outreach(e.orgId), a);
    if (b) await this.kv.lrem(k.companyOutreach(e.companyId), b);
  }

  async getTemplates(orgId: string) {
    return (await this.kv.get<Template[]>(k.templates(orgId))) ?? [];
  }
  async putTemplates(orgId: string, t: Template[]) {
    await this.kv.set(k.templates(orgId), t);
  }

  async getScan(id: string) {
    return this.kv.get<Scan>(k.scan(id));
  }
  async putScan(s: Scan) {
    const isNew = !(await this.kv.get(k.scan(s.id)));
    await this.kv.set(k.scan(s.id), s);
    if (isNew) {
      await this.kv.lpush(k.scans(s.orgId), s.id);
      await this.kv.ltrim(k.scans(s.orgId), 0, 199);
    }
  }
  async listScans(orgId: string, limit = 50) {
    const ids = await this.kv.lrange<string>(k.scans(orgId), 0, limit - 1);
    const docs = await this.kv.mget<Scan>(ids.map((id) => k.scan(String(id))));
    return docs.filter((d): d is Scan => d !== null);
  }

  async addAudit(orgId: string, e: AuditEntry) {
    await this.kv.lpush(k.audit(orgId), e);
    await this.kv.ltrim(k.audit(orgId), 0, 999);
  }
  async listAudit(orgId: string, limit = 200) {
    return this.kv.lrange<AuditEntry>(k.audit(orgId), 0, limit - 1);
  }

  async getKpiHistory(orgId: string) {
    return this.kv.hgetall<Record<string, number>>(k.kpis(orgId));
  }
  async putKpiSnapshot(orgId: string, date: string, kpis: Record<string, number>) {
    await this.kv.hset(k.kpis(orgId), date, kpis);
  }

  async hit(key: string, windowSeconds: number) {
    return this.kv.incr(`rate:${key}`, windowSeconds);
  }
}
