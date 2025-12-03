/**
 * Shared Redis utilities for Cloudflare Workers
 *
 * Provides factory functions for creating Upstash Redis clients and task stores.
 * Used by workers that need persistent task storage.
 *
 * @example
 * ```typescript
 * import { createRedisClient, createRedisTaskStore } from "a2a-workers-shared";
 *
 * const redis = createRedisClient(env);
 * const taskStore = createRedisTaskStore(redis, { prefix: "a2a:travel:" });
 * ```
 */

import { Redis } from "@upstash/redis";
import { UpstashRedisTaskStore } from "@drew-foxall/a2a-js-taskstore-upstash-redis";

/**
 * Environment variables required for Redis connectivity
 */
export interface RedisEnv {
  /**
   * Upstash Redis REST URL
   * Set via: wrangler secret put UPSTASH_REDIS_REST_URL
   */
  UPSTASH_REDIS_REST_URL: string;

  /**
   * Upstash Redis REST Token
   * Set via: wrangler secret put UPSTASH_REDIS_REST_TOKEN
   */
  UPSTASH_REDIS_REST_TOKEN: string;
}

/**
 * Options for creating a Redis task store
 */
export interface RedisTaskStoreOptions {
  /**
   * Key prefix for task storage (e.g., "a2a:travel:")
   * Each agent should use a unique prefix to avoid collisions
   */
  prefix: string;

  /**
   * TTL in seconds for task expiration
   * @default 604800 (7 days)
   */
  ttlSeconds?: number;
}

/**
 * Default TTL for task storage (7 days)
 */
export const DEFAULT_TASK_TTL_SECONDS = 604800;

/**
 * Create an Upstash Redis client from environment variables
 *
 * @param env - Environment with Redis credentials
 * @returns Redis client instance
 *
 * @example
 * ```typescript
 * const redis = createRedisClient(c.env);
 * ```
 */
export function createRedisClient(env: RedisEnv): Redis {
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

/**
 * Create an Upstash Redis task store
 *
 * @param redis - Redis client instance
 * @param options - Task store configuration
 * @returns UpstashRedisTaskStore instance
 *
 * @example
 * ```typescript
 * const redis = createRedisClient(c.env);
 * const taskStore = createRedisTaskStore(redis, {
 *   prefix: "a2a:travel:",
 *   ttlSeconds: 86400 * 7,
 * });
 * ```
 */
export function createRedisTaskStore(
  redis: Redis,
  options: RedisTaskStoreOptions
): UpstashRedisTaskStore {
  return new UpstashRedisTaskStore({
    client: redis,
    prefix: options.prefix,
    ttlSeconds: options.ttlSeconds ?? DEFAULT_TASK_TTL_SECONDS,
  });
}

/**
 * Check if Redis environment variables are configured
 *
 * @param env - Environment to check
 * @returns true if Redis is configured
 */
export function isRedisConfigured(env: Partial<RedisEnv>): env is RedisEnv {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

// Re-export types and classes for convenience
export { Redis, UpstashRedisTaskStore };
