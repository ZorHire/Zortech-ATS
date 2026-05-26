import Redis from 'ioredis';
import env from '../config/env';

const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
});

redis.on('error', (err: Error) => console.error('[Redis] error:', err.message));

export default redis;
