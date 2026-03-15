import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

export let redisClient: Redis;

export async function connectRedis(): Promise<void> {
  redisClient = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redisClient.connect();
  logger.info('✅ Redis connected');

  redisClient.on('error', (err) => {
    logger.error('Redis error:', err);
  });
}

export function getRedis(): Redis {
  if (!redisClient) throw new Error('Redis not initialized');
  return redisClient;
}
