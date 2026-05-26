import redis from './redis';

export async function withCache<T>(
  key: string,
  ttl: number,
  fetch: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch {
    // Redis unavailable — fall through to DB
  }

  const data = await fetch();

  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch {
    // Redis unavailable — don't fail the request
  }

  return data;
}

export async function invalidate(...keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    await redis.del(...(keys as [string, ...string[]]));
  } catch {
    // silent
  }
}

// Uses SCAN (not KEYS) — safe for production
export async function invalidatePrefix(prefix: string): Promise<void> {
  try {
    let cursor = '0';
    do {
      const [next, found] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = next;
      if (found.length) await redis.del(...(found as [string, ...string[]]));
    } while (cursor !== '0');
  } catch {
    // silent
  }
}
