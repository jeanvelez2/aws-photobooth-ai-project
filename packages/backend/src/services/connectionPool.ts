import { logger } from '../utils/logger.js';

export interface PoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  maxLifetimeMs: number;
  healthCheckIntervalMs: number;
}

export interface PooledResource<T> {
  resource: T;
  createdAt: Date;
  lastUsedAt: Date;
  isHealthy: boolean;
  inUse: boolean;
}

export interface ResourceFactory<T> {
  create(): Promise<T>;
  destroy(resource: T): Promise<void>;
  validate(resource: T): Promise<boolean>;
}

/**
 * Generic connection pool for managing expensive resources
 */
export class ConnectionPool<T> {
  private readonly config: PoolConfig;
  private readonly factory: ResourceFactory<T>;
  private readonly pool: PooledResource<T>[] = [];
  private readonly waitingQueue: Array<{
    resolve: (resource: T) => void;
    reject: (error: Error) => void;
    timestamp: Date;
  }> = [];
  private healthCheckTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(config: PoolConfig, factory: ResourceFactory<T>) {
    this.config = config;
    this.factory = factory;
    this.startHealthCheck();
    this.initializeMinConnections();
  }

  /**
   * Acquire a resource from the pool
   */
  async acquire(): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Connection pool is shutting down');
    }

    // Try to get an available resource
    const availableResource = this.getAvailableResource();
    if (availableResource) {
      availableResource.inUse = true;
      availableResource.lastUsedAt = new Date();
      logger.debug('Resource acquired from pool', {
        poolSize: this.pool.length,
        inUse: this.pool.filter(r => r.inUse).length,
      });
      return availableResource.resource;
    }

    // Create new resource if under max limit
    if (this.pool.length < this.config.maxConnections) {
      try {
        const resource = await this.createResource();
        logger.debug('New resource created', {
          poolSize: this.pool.length,
          inUse: this.pool.filter(r => r.inUse).length,
        });
        return resource;
      } catch (error) {
        logger.error('Failed to create new resource', { error });
        throw error;
      }
    }

    // Wait for a resource to become available
    return this.waitForResource();
  }

  /**
   * Release a resource back to the pool
   */
  async release(resource: T): Promise<void> {
    const pooledResource = this.pool.find(r => r.resource === resource);
    if (!pooledResource) {
      logger.warn('Attempted to release resource not in pool');
      return;
    }

    pooledResource.inUse = false;
    pooledResource.lastUsedAt = new Date();

    // Check if there are waiting requests
    const waiting = this.waitingQueue.shift();
    if (waiting) {
      pooledResource.inUse = true;
      waiting.resolve(resource);
      return;
    }

    logger.debug('Resource released to pool', {
      poolSize: this.pool.length,
      inUse: this.pool.filter(r => r.inUse).length,
    });
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
  } {
    const activeConnections = this.pool.filter(r => r.inUse).length;
    return {
      totalConnections: this.pool.length,
      activeConnections,
      idleConnections: this.pool.length - activeConnections,
      waitingRequests: this.waitingQueue.length,
    };
  }

  /**
   * Shutdown the pool and cleanup all resources
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      if (waiting) {
        waiting.reject(new Error('Connection pool is shutting down'));
      }
    }

    // Destroy all resources
    const destroyPromises = this.pool.map(async (pooledResource) => {
      try {
        await this.factory.destroy(pooledResource.resource);
      } catch (error) {
        logger.error('Error destroying resource during shutdown', { error });
      }
    });

    await Promise.all(destroyPromises);
    this.pool.length = 0;

    logger.info('Connection pool shutdown completed');
  }

  /**
   * Execute a function with a pooled resource
   */
  async execute<R>(fn: (resource: T) => Promise<R>): Promise<R> {
    const resource = await this.acquire();
    try {
      return await fn(resource);
    } finally {
      await this.release(resource);
    }
  }

  private getAvailableResource(): PooledResource<T> | null {
    return this.pool.find(r => !r.inUse && r.isHealthy) || null;
  }

  private async createResource(): Promise<T> {
    const resource = await this.factory.create();
    const pooledResource: PooledResource<T> = {
      resource,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      isHealthy: true,
      inUse: true,
    };
    
    this.pool.push(pooledResource);
    return resource;
  }

  private async waitForResource(): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
        if (index >= 0) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error(`Resource acquisition timeout after ${this.config.acquireTimeoutMs}ms`));
      }, this.config.acquireTimeoutMs);

      this.waitingQueue.push({
        resolve: (resource: T) => {
          clearTimeout(timeout);
          resolve(resource);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: new Date(),
      });
    });
  }

  private async initializeMinConnections(): Promise<void> {
    const createPromises: Promise<void>[] = [];
    
    for (let i = 0; i < this.config.minConnections; i++) {
      createPromises.push(
        this.factory.create().then(resource => {
          const pooledResource: PooledResource<T> = {
            resource,
            createdAt: new Date(),
            lastUsedAt: new Date(),
            isHealthy: true,
            inUse: false,
          };
          this.pool.push(pooledResource);
        }).catch(error => {
          logger.error('Failed to create initial resource', { error });
        })
      );
    }

    await Promise.all(createPromises);
    logger.info('Connection pool initialized', {
      minConnections: this.config.minConnections,
      actualConnections: this.pool.length,
    });
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private async performHealthCheck(): Promise<void> {
    const now = new Date();
    const resourcesToRemove: PooledResource<T>[] = [];

    for (const pooledResource of this.pool) {
      // Skip resources currently in use
      if (pooledResource.inUse) {
        continue;
      }

      // Check if resource has exceeded max lifetime
      const age = now.getTime() - pooledResource.createdAt.getTime();
      if (age > this.config.maxLifetimeMs) {
        resourcesToRemove.push(pooledResource);
        continue;
      }

      // Check if resource has been idle too long
      const idleTime = now.getTime() - pooledResource.lastUsedAt.getTime();
      if (idleTime > this.config.idleTimeoutMs && this.pool.length > this.config.minConnections) {
        resourcesToRemove.push(pooledResource);
        continue;
      }

      // Validate resource health
      try {
        const isHealthy = await this.factory.validate(pooledResource.resource);
        if (!isHealthy) {
          pooledResource.isHealthy = false;
          resourcesToRemove.push(pooledResource);
        }
      } catch (error) {
        logger.error('Health check failed for resource', { error });
        pooledResource.isHealthy = false;
        resourcesToRemove.push(pooledResource);
      }
    }

    // Remove unhealthy or expired resources
    for (const resource of resourcesToRemove) {
      const index = this.pool.indexOf(resource);
      if (index >= 0) {
        this.pool.splice(index, 1);
        try {
          await this.factory.destroy(resource.resource);
        } catch (error) {
          logger.error('Error destroying resource during health check', { error });
        }
      }
    }

    if (resourcesToRemove.length > 0) {
      logger.debug('Health check completed', {
        removedResources: resourcesToRemove.length,
        remainingResources: this.pool.length,
      });
    }
  }
}

/**
 * AWS SDK client pool for managing SDK connections
 */
export class AwsClientPool<T> extends ConnectionPool<T> {
  constructor(
    clientFactory: () => Promise<T>,
    clientDestroy: (client: T) => Promise<void> = async () => {},
    clientValidate: (client: T) => Promise<boolean> = async () => true,
    config: Partial<PoolConfig> = {}
  ) {
    const defaultConfig: PoolConfig = {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeoutMs: 5000,
      idleTimeoutMs: 300000, // 5 minutes
      maxLifetimeMs: 3600000, // 1 hour
      healthCheckIntervalMs: 60000, // 1 minute
      ...config,
    };

    const factory: ResourceFactory<T> = {
      create: clientFactory,
      destroy: clientDestroy,
      validate: clientValidate,
    };

    super(defaultConfig, factory);
  }
}

/**
 * Memory pool for managing buffer allocations
 */
export class BufferPool {
  private readonly pools: Map<number, Buffer[]> = new Map();
  private readonly maxBuffersPerSize = 10;
  private readonly commonSizes = [1024, 4096, 16384, 65536, 262144, 1048576]; // 1KB to 1MB

  constructor() {
    // Pre-allocate common buffer sizes
    for (const size of this.commonSizes) {
      this.pools.set(size, []);
    }
  }

  /**
   * Get a buffer of the specified size
   */
  getBuffer(size: number): Buffer {
    // Find the smallest pool that can accommodate the requested size
    const poolSize = this.commonSizes.find(s => s >= size);
    
    if (poolSize) {
      const pool = this.pools.get(poolSize);
      if (pool && pool.length > 0) {
        const buffer = pool.pop()!;
        return buffer.subarray(0, size);
      }
    }

    // Create new buffer if no pooled buffer available
    return Buffer.allocUnsafe(size);
  }

  /**
   * Return a buffer to the pool
   */
  returnBuffer(buffer: Buffer): void {
    const size = buffer.length;
    const poolSize = this.commonSizes.find(s => s === size);
    
    if (poolSize) {
      const pool = this.pools.get(poolSize);
      if (pool && pool.length < this.maxBuffersPerSize) {
        // Clear the buffer before returning to pool
        buffer.fill(0);
        pool.push(buffer);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): Record<number, number> {
    const stats: Record<number, number> = {};
    for (const [size, pool] of this.pools) {
      stats[size] = pool.length;
    }
    return stats;
  }

  /**
   * Clear all pools
   */
  clear(): void {
    for (const pool of this.pools.values()) {
      pool.length = 0;
    }
  }
}

// Global instances
export const bufferPool = new BufferPool();