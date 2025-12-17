/**
 * MCP Agent Registry - Storage Implementations
 *
 * Provides composable storage backends for the agent registry.
 * These can be used in any deployment environment (Workers, Node.js, etc.)
 */

import type { AgentRegistry } from "./registry.js";
import type { RegisteredAgentCard } from "./types.js";

// ============================================================================
// Store Interface
// ============================================================================

/**
 * Interface for registry persistence
 */
export interface RegistryStore {
  /** Load agents from storage */
  load(): Promise<RegisteredAgentCard[]>;
  /** Save agents to storage */
  save(agents: RegisteredAgentCard[]): Promise<void>;
}

// ============================================================================
// In-Memory Store
// ============================================================================

/**
 * In-memory store (no persistence, useful for testing)
 */
export class InMemoryRegistryStore implements RegistryStore {
  private agents: RegisteredAgentCard[] = [];

  async load(): Promise<RegisteredAgentCard[]> {
    return [...this.agents];
  }

  async save(agents: RegisteredAgentCard[]): Promise<void> {
    this.agents = [...agents];
  }
}

export function createInMemoryRegistryStore(): RegistryStore {
  return new InMemoryRegistryStore();
}

// ============================================================================
// Redis Store
// ============================================================================

/**
 * Generic Redis interface - works with Upstash, ioredis, etc.
 */
export interface RedisLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
}

/**
 * Redis-backed registry store
 */
export class RedisRegistryStore implements RegistryStore {
  constructor(
    private redis: RedisLike,
    private key: string = "a2a:registry:agents",
    private ttlSeconds: number = 86400 * 7 // 7 days
  ) {}

  async load(): Promise<RegisteredAgentCard[]> {
    try {
      const agents = await this.redis.get<RegisteredAgentCard[]>(this.key);
      return agents || [];
    } catch (error) {
      console.error("Failed to load agents from Redis:", error);
      return [];
    }
  }

  async save(agents: RegisteredAgentCard[]): Promise<void> {
    try {
      await this.redis.set(this.key, agents, { ex: this.ttlSeconds });
    } catch (error) {
      console.error("Failed to save agents to Redis:", error);
    }
  }
}

export interface RedisRegistryStoreConfig {
  redis: RedisLike;
  key?: string;
  ttlSeconds?: number;
}

export function createRedisRegistryStore(config: RedisRegistryStoreConfig): RegistryStore {
  return new RedisRegistryStore(config.redis, config.key, config.ttlSeconds);
}

// ============================================================================
// Persistent Registry Wrapper
// ============================================================================

/**
 * Wraps an AgentRegistry with automatic persistence
 *
 * This utility automatically loads/saves the registry state to the backing store.
 * Use this to create a registry that persists across requests.
 *
 * @example
 * ```typescript
 * const store = createRedisRegistryStore({ redis });
 * const registry = await createPersistentRegistry(store);
 *
 * // Changes are automatically persisted
 * registry.register({ agentCard: { name: "Weather", url: "...", ... } });
 * ```
 */
export class PersistentRegistry {
  private dirty = false;

  constructor(
    private registry: AgentRegistry,
    private store: RegistryStore
  ) {}

  /**
   * Load agents from storage into the registry
   */
  async load(): Promise<void> {
    const agents = await this.store.load();
    this.registry.importAgents(agents);
    this.dirty = false;
  }

  /**
   * Save registry state to storage
   */
  async save(): Promise<void> {
    if (this.dirty) {
      await this.store.save(this.registry.exportAgents());
      this.dirty = false;
    }
  }

  /**
   * Mark registry as dirty (needs saving)
   */
  markDirty(): void {
    this.dirty = true;
  }

  /**
   * Get the underlying registry
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  /**
   * Check if there are unsaved changes
   */
  isDirty(): boolean {
    return this.dirty;
  }
}

/**
 * Create a registry with persistence
 */
export async function createPersistentRegistry(
  store: RegistryStore,
  registry?: AgentRegistry
): Promise<PersistentRegistry> {
  // Import dynamically to avoid circular dependency
  const { createAgentRegistry } = await import("./registry.js");
  const reg = registry ?? createAgentRegistry();
  const persistent = new PersistentRegistry(reg, store);
  await persistent.load();
  return persistent;
}

