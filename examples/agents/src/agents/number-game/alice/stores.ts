/**
 * Alice Agent - Game Store Implementations
 *
 * Composable storage implementations for the Number Guessing Game.
 */

import type { GameState, GameStore } from "./types.js";

/**
 * Create a new game state with a random secret number
 */
function createNewGameState(): GameState {
  return {
    secret: Math.floor(Math.random() * 100) + 1,
    attempts: 0,
    createdAt: new Date().toISOString(),
    guesses: [],
  };
}

/**
 * In-memory game store for testing and local development
 *
 * Note: State is lost on restart. Use Redis or Durable Objects for persistence.
 */
export class InMemoryGameStore implements GameStore {
  private games = new Map<string, GameState>();

  async getOrCreate(sessionId: string): Promise<{ state: GameState; isNew: boolean }> {
    const existing = this.games.get(sessionId);
    if (existing) {
      return { state: existing, isNew: false };
    }

    const newState = createNewGameState();
    this.games.set(sessionId, newState);
    return { state: newState, isNew: true };
  }

  async update(sessionId: string, state: GameState): Promise<void> {
    this.games.set(sessionId, state);
  }

  async delete(sessionId: string): Promise<void> {
    this.games.delete(sessionId);
  }

  /** Get the number of active games (for testing/debugging) */
  getActiveGameCount(): number {
    return this.games.size;
  }
}

/**
 * Redis game store configuration
 */
export interface RedisGameStoreConfig {
  /** Key prefix for Redis keys */
  prefix?: string;
  /** TTL in seconds for game state (default: 1 hour) */
  ttlSeconds?: number;
}

/**
 * Minimal Redis client interface
 *
 * Compatible with @upstash/redis and ioredis
 */
export interface RedisClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/**
 * Redis-backed game store for persistent game state
 *
 * Works with Upstash Redis (Cloudflare Workers) or any Redis client.
 */
export class RedisGameStore implements GameStore {
  private redis: RedisClient;
  private prefix: string;
  private ttlSeconds: number;

  constructor(redis: RedisClient, config: RedisGameStoreConfig = {}) {
    this.redis = redis;
    this.prefix = config.prefix ?? "a2a:number-game:";
    this.ttlSeconds = config.ttlSeconds ?? 3600; // 1 hour default
  }

  private getKey(sessionId: string): string {
    return `${this.prefix}${sessionId}`;
  }

  async getOrCreate(sessionId: string): Promise<{ state: GameState; isNew: boolean }> {
    const key = this.getKey(sessionId);

    try {
      const existing = await this.redis.get<GameState>(key);
      if (existing) {
        return { state: existing, isNew: false };
      }
    } catch (error) {
      console.error("Redis get error:", error);
    }

    const newState = createNewGameState();

    try {
      await this.redis.set(key, newState, { ex: this.ttlSeconds });
    } catch (error) {
      console.error("Redis set error:", error);
    }

    return { state: newState, isNew: true };
  }

  async update(sessionId: string, state: GameState): Promise<void> {
    const key = this.getKey(sessionId);
    try {
      await this.redis.set(key, state, { ex: this.ttlSeconds });
    } catch (error) {
      console.error("Redis update error:", error);
    }
  }

  async delete(sessionId: string): Promise<void> {
    const key = this.getKey(sessionId);
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error("Redis delete error:", error);
    }
  }
}

/**
 * Create an in-memory game store
 */
export function createInMemoryGameStore(): GameStore {
  return new InMemoryGameStore();
}

/**
 * Create a Redis-backed game store
 */
export function createRedisGameStore(
  redis: RedisClient,
  config?: RedisGameStoreConfig
): GameStore {
  return new RedisGameStore(redis, config);
}

