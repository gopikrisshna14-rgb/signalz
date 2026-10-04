import { Redis } from "@upstash/redis";

/** The handful of Redis commands the app uses. Implemented by Upstash and by an in-memory map. */
export interface Kv {
  readonly persistent: boolean;
  get<T>(key: string): Promise<T | null>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  incr(key: string, exSeconds?: number): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrem(key: string, member: string): Promise<void>;
  /** Members by score, highest first when rev is true. */
  zrange(key: string, start: number, stop: number, rev?: boolean): Promise<string[]>;
  lpush(key: string, ...values: unknown[]): Promise<void>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
  /** Removes all list entries equal to value (compared as JSON). */
  lrem(key: string, value: unknown): Promise<void>;
  hset(key: string, field: string, value: unknown): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  hgetall<T>(key: string): Promise<Record<string, T>>;
  scanKeys(prefix: string): Promise<string[]>;
}

export function redisEnv(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export class UpstashKv implements Kv {
  readonly persistent = true;
  private r: Redis;
  constructor(url: string, token: string) {
    this.r = new Redis({ url, token });
  }
  get<T>(key: string) {
    return this.r.get<T>(key);
  }
  async mget<T>(keys: string[]) {
    if (keys.length === 0) return [];
    const out: (T | null)[] = [];
    for (let i = 0; i < keys.length; i += 100) out.push(...(await this.r.mget<(T | null)[]>(...keys.slice(i, i + 100))));
    return out;
  }
  async set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) {
    let res: unknown;
    if (opts?.nx && opts.ex) res = await this.r.set(key, value, { nx: true, ex: opts.ex });
    else if (opts?.nx) res = await this.r.set(key, value, { nx: true });
    else if (opts?.ex) res = await this.r.set(key, value, { ex: opts.ex });
    else res = await this.r.set(key, value);
    return res === "OK";
  }
  async del(...keys: string[]) {
    if (keys.length) await this.r.del(...keys);
  }
  async incr(key: string, exSeconds?: number) {
    const n = await this.r.incr(key);
    if (n === 1 && exSeconds) await this.r.expire(key, exSeconds);
    return n;
  }
  async zadd(key: string, score: number, member: string) {
    await this.r.zadd(key, { score, member });
  }
  async zrem(key: string, member: string) {
    await this.r.zrem(key, member);
  }
  async zrange(key: string, start: number, stop: number, rev = false) {
    return (await this.r.zrange<string[]>(key, start, stop, rev ? { rev: true } : undefined)).map(String);
  }
  async lpush(key: string, ...values: unknown[]) {
    if (values.length) await this.r.lpush(key, ...values);
  }
  async ltrim(key: string, start: number, stop: number) {
    await this.r.ltrim(key, start, stop);
  }
  lrange<T>(key: string, start: number, stop: number) {
    return this.r.lrange<T>(key, start, stop);
  }
  async lrem(key: string, value: unknown) {
    await this.r.lrem(key, 0, value);
  }
  async hset(key: string, field: string, value: unknown) {
    await this.r.hset(key, { [field]: value });
  }
  async hdel(key: string, field: string) {
    await this.r.hdel(key, field);
  }
  async hgetall<T>(key: string) {
    return ((await this.r.hgetall<Record<string, T>>(key)) ?? {}) as Record<string, T>;
  }
  async scanKeys(prefix: string) {
    const keys: string[] = [];
    let cursor: string | number = 0;
    do {
      const [next, batch]: [string | number, string[]] = await this.r.scan(cursor, { match: `${prefix}*`, count: 500 });
      keys.push(...batch);
      cursor = next;
    } while (String(cursor) !== "0");
    return keys;
  }
}

type Entry = { v: unknown; exp: number | null };

/** In-memory stand-in for Redis (demo mode). Values are cloned to mimic serialisation. */
export class MemoryKv implements Kv {
  readonly persistent = false;
  private m = new Map<string, Entry>();

  private live(key: string): Entry | undefined {
    const e = this.m.get(key);
    if (e && e.exp !== null && e.exp < Date.now()) {
      this.m.delete(key);
      return undefined;
    }
    return e;
  }
  private val<T>(key: string, fallback: T): T {
    return (this.live(key)?.v as T) ?? fallback;
  }
  async get<T>(key: string) {
    const e = this.live(key);
    return e ? (structuredClone(e.v) as T) : null;
  }
  async mget<T>(keys: string[]) {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }
  async set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) {
    if (opts?.nx && this.live(key)) return false;
    this.m.set(key, { v: structuredClone(value), exp: opts?.ex ? Date.now() + opts.ex * 1000 : null });
    return true;
  }
  async del(...keys: string[]) {
    for (const k of keys) this.m.delete(k);
  }
  async incr(key: string, exSeconds?: number) {
    const n = Number(this.val(key, 0)) + 1;
    const e = this.live(key);
    this.m.set(key, { v: n, exp: e?.exp ?? (exSeconds ? Date.now() + exSeconds * 1000 : null) });
    return n;
  }
  async zadd(key: string, score: number, member: string) {
    const z = this.val<Map<string, number>>(key, new Map());
    z.set(member, score);
    this.m.set(key, { v: z, exp: null });
  }
  async zrem(key: string, member: string) {
    this.val<Map<string, number>>(key, new Map()).delete(member);
  }
  async zrange(key: string, start: number, stop: number, rev = false) {
    const z = this.val<Map<string, number>>(key, new Map());
    const sorted = [...z.entries()].sort((a, b) => (rev ? b[1] - a[1] : a[1] - b[1])).map(([m]) => m);
    return sorted.slice(start, stop === -1 ? undefined : stop + 1);
  }
  async lpush(key: string, ...values: unknown[]) {
    const l = this.val<unknown[]>(key, []);
    for (const v of values) l.unshift(structuredClone(v));
    this.m.set(key, { v: l, exp: null });
  }
  async ltrim(key: string, start: number, stop: number) {
    const l = this.val<unknown[]>(key, []);
    this.m.set(key, { v: l.slice(start, stop === -1 ? undefined : stop + 1), exp: null });
  }
  async lrange<T>(key: string, start: number, stop: number) {
    const l = this.val<unknown[]>(key, []);
    return structuredClone(l.slice(start, stop === -1 ? undefined : stop + 1)) as T[];
  }
  async lrem(key: string, value: unknown) {
    const json = JSON.stringify(value);
    this.m.set(key, { v: this.val<unknown[]>(key, []).filter((x) => JSON.stringify(x) !== json), exp: null });
  }
  async hset(key: string, field: string, value: unknown) {
    const h = this.val<Record<string, unknown>>(key, {});
    h[field] = structuredClone(value);
    this.m.set(key, { v: h, exp: null });
  }
  async hdel(key: string, field: string) {
    delete this.val<Record<string, unknown>>(key, {})[field];
  }
  async hgetall<T>(key: string) {
    return structuredClone(this.val<Record<string, T>>(key, {}));
  }
  async scanKeys(prefix: string) {
    return [...this.m.keys()].filter((k) => k.startsWith(prefix));
  }
}
