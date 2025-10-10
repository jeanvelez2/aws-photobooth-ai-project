import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export interface MemoryReservation {
  id: string;
  allocated: number; // MB
  reserved: number; // MB
  timestamp: Date;
  purpose: string;
  priority: MemoryPriority;
}

export enum MemoryPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface GPUMemoryStats {
  total: number; // MB
  available: number; // MB
  used: number; // MB
  reserved: number; // MB
  reservations: MemoryReservation[];
  utilizationPercent: number;
}

export interface GPUResourceInfo {
  deviceId: number;
  name: string;
  totalMemory: number; // MB
  availableMemory: number; // MB
  computeCapability: string;
  isAvailable: boolean;
}

/**
 * GPU Memory Manager
 * Handles GPU memory allocation, monitoring, and optimization for style transfer operations
 */
export class GPUMemoryManager {
  private reservations: Map<string, MemoryReservation> = new Map();
  private totalGPUMemory: number;
  private memoryBuffer: number; // Safety buffer in MB
  private cleanupInterval: NodeJS.Timeout;
  private reservationTimeout: number = 30 * 60 * 1000; // 30 minutes
  private maxUtilization: number = 0.85; // 85% max utilization

  constructor() {
    this.totalGPUMemory = this.detectGPUMemory();
    this.memoryBuffer = Math.max(512, this.totalGPUMemory * 0.1); // 10% buffer, min 512MB
    
    logger.info('GPU Memory Manager initialized', {
      totalMemory: this.totalGPUMemory,
      memoryBuffer: this.memoryBuffer,
      maxUtilization: this.maxUtilization
    });

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Check available GPU memory
   */
  async checkAvailableMemory(requiredMemory?: number): Promise<GPUMemoryStats> {
    const stats = await this.getMemoryStats();
    
    if (requiredMemory && stats.available < requiredMemory) {
      logger.warn('Insufficient GPU memory', {
        required: requiredMemory,
        available: stats.available,
        total: stats.total
      });
      
      throw new Error(`INSUFFICIENT_GPU_MEMORY: Required ${requiredMemory}MB, available ${stats.available}MB`);
    }

    return stats;
  }

  /**
   * Reserve GPU memory for processing
   */
  async reserveMemory(
    requiredMemory: number, 
    purpose: string = 'style_transfer',
    priority: MemoryPriority = MemoryPriority.NORMAL
  ): Promise<MemoryReservation> {
    logger.debug('Attempting to reserve GPU memory', {
      required: requiredMemory,
      purpose,
      priority
    });

    // Check if memory is available
    const stats = await this.getMemoryStats();
    
    if (stats.available < requiredMemory) {
      // Try to free up memory by evicting lower priority reservations
      const freed = await this.evictLowerPriorityReservations(requiredMemory, priority);
      
      if (freed < requiredMemory) {
        throw new Error(`INSUFFICIENT_GPU_MEMORY: Cannot reserve ${requiredMemory}MB (available: ${stats.available}MB, freed: ${freed}MB)`);
      }
    }

    // Create reservation
    const reservation: MemoryReservation = {
      id: uuidv4(),
      allocated: 0, // Will be set when actually allocated
      reserved: requiredMemory,
      timestamp: new Date(),
      purpose,
      priority
    };

    this.reservations.set(reservation.id, reservation);
    
    logger.info('GPU memory reserved', {
      reservationId: reservation.id,
      reserved: requiredMemory,
      purpose,
      priority
    });

    return reservation;
  }

  /**
   * Allocate reserved memory (mark as actually in use)
   */
  async allocateReservedMemory(reservationId: string, actualMemory: number): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    
    if (!reservation) {
      throw new Error(`Memory reservation not found: ${reservationId}`);
    }

    if (actualMemory > reservation.reserved) {
      logger.warn('Actual memory usage exceeds reservation', {
        reservationId,
        reserved: reservation.reserved,
        actual: actualMemory
      });
    }

    reservation.allocated = actualMemory;
    
    logger.debug('GPU memory allocated', {
      reservationId,
      allocated: actualMemory,
      reserved: reservation.reserved
    });
  }

  /**
   * Release GPU memory reservation
   */
  async releaseMemory(reservationId: string): Promise<void> {
    const reservation = this.reservations.get(reservationId);
    
    if (!reservation) {
      logger.warn('Attempted to release non-existent memory reservation', { reservationId });
      return;
    }

    this.reservations.delete(reservationId);
    
    logger.info('GPU memory released', {
      reservationId,
      allocated: reservation.allocated,
      reserved: reservation.reserved,
      purpose: reservation.purpose
    });
  }

  /**
   * Get current GPU memory statistics
   */
  async getMemoryStats(): Promise<GPUMemoryStats> {
    const currentMemory = await this.getCurrentGPUMemoryUsage();
    const reservedMemory = this.getTotalReservedMemory();
    const availableMemory = Math.max(0, this.totalGPUMemory - currentMemory - reservedMemory - this.memoryBuffer);
    
    return {
      total: this.totalGPUMemory,
      available: availableMemory,
      used: currentMemory,
      reserved: reservedMemory,
      reservations: Array.from(this.reservations.values()),
      utilizationPercent: (currentMemory / this.totalGPUMemory) * 100
    };
  }

  /**
   * Get GPU device information
   */
  async getGPUInfo(): Promise<GPUResourceInfo[]> {
    // In a real implementation, this would query actual GPU devices
    // For now, return mock data based on environment
    const gpuInfo: GPUResourceInfo[] = [];
    
    if (process.env.CUDA_VISIBLE_DEVICES) {
      const deviceIds = process.env.CUDA_VISIBLE_DEVICES.split(',').map(id => parseInt(id.trim()));
      
      for (const deviceId of deviceIds) {
        gpuInfo.push({
          deviceId,
          name: `NVIDIA GPU ${deviceId}`,
          totalMemory: this.totalGPUMemory,
          availableMemory: (await this.getMemoryStats()).available,
          computeCapability: '7.5', // Mock value
          isAvailable: true
        });
      }
    } else {
      // No GPU available, return CPU fallback info
      gpuInfo.push({
        deviceId: -1,
        name: 'CPU Fallback',
        totalMemory: 0,
        availableMemory: 0,
        computeCapability: 'N/A',
        isAvailable: false
      });
    }

    return gpuInfo;
  }

  /**
   * Optimize memory usage by cleaning up expired reservations
   */
  async optimizeMemory(): Promise<{ cleaned: number; optimized: number }> {
    const beforeStats = await this.getMemoryStats();
    
    // Clean up expired reservations
    const cleaned = await this.cleanupExpiredReservations();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const afterStats = await this.getMemoryStats();
    const optimized = beforeStats.used - afterStats.used;
    
    logger.info('Memory optimization completed', {
      cleanedReservations: cleaned,
      memoryOptimized: optimized,
      beforeUtilization: beforeStats.utilizationPercent,
      afterUtilization: afterStats.utilizationPercent
    });

    return { cleaned, optimized };
  }

  /**
   * Check if GPU is available and properly configured
   */
  async isGPUAvailable(): Promise<boolean> {
    try {
      const gpuInfo = await this.getGPUInfo();
      return gpuInfo.some(gpu => gpu.isAvailable);
    } catch (error) {
      logger.error('Failed to check GPU availability', { error });
      return false;
    }
  }

  /**
   * Get recommended memory allocation for different quality levels
   */
  getRecommendedMemoryAllocation(quality: 'fast' | 'balanced' | 'high'): number {
    const baseMemory = Math.min(1024, this.totalGPUMemory * 0.3); // 30% of total or 1GB max
    
    const multipliers = {
      fast: 0.5,
      balanced: 1.0,
      high: 1.5
    };

    return Math.round(baseMemory * multipliers[quality]);
  }

  /**
   * Detect total GPU memory available
   */
  private detectGPUMemory(): number {
    // In a real implementation, this would query actual GPU memory
    // For now, use environment variables or defaults
    
    if (process.env.GPU_MEMORY_MB) {
      return parseInt(process.env.GPU_MEMORY_MB);
    }

    // Default values based on common GPU types
    if (process.env.CUDA_VISIBLE_DEVICES) {
      // Assume T4 GPU (16GB) if CUDA is available
      return 16 * 1024; // 16GB in MB
    }

    // No GPU available
    return 0;
  }

  /**
   * Get current GPU memory usage (mock implementation)
   */
  private async getCurrentGPUMemoryUsage(): Promise<number> {
    // In a real implementation, this would query actual GPU memory usage
    // For now, calculate based on active reservations
    
    let totalAllocated = 0;
    for (const reservation of this.reservations.values()) {
      totalAllocated += reservation.allocated;
    }

    return totalAllocated;
  }

  /**
   * Get total reserved memory
   */
  private getTotalReservedMemory(): number {
    let totalReserved = 0;
    for (const reservation of this.reservations.values()) {
      totalReserved += reservation.reserved;
    }
    return totalReserved;
  }

  /**
   * Evict lower priority reservations to free memory
   */
  private async evictLowerPriorityReservations(
    requiredMemory: number, 
    requestPriority: MemoryPriority
  ): Promise<number> {
    const evictableReservations = Array.from(this.reservations.values())
      .filter(r => r.priority < requestPriority)
      .sort((a, b) => a.priority - b.priority); // Lowest priority first

    let freedMemory = 0;
    
    for (const reservation of evictableReservations) {
      if (freedMemory >= requiredMemory) {
        break;
      }

      logger.info('Evicting lower priority memory reservation', {
        reservationId: reservation.id,
        priority: reservation.priority,
        reserved: reservation.reserved,
        purpose: reservation.purpose
      });

      freedMemory += reservation.reserved;
      this.reservations.delete(reservation.id);
    }

    return freedMemory;
  }

  /**
   * Start periodic cleanup of expired reservations
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredReservations().catch(error => {
        logger.error('Memory cleanup failed', { error });
      });
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Clean up expired reservations
   */
  private async cleanupExpiredReservations(): Promise<number> {
    const now = Date.now();
    const expiredReservations: string[] = [];

    for (const [id, reservation] of this.reservations.entries()) {
      if (now - reservation.timestamp.getTime() > this.reservationTimeout) {
        expiredReservations.push(id);
      }
    }

    for (const id of expiredReservations) {
      const reservation = this.reservations.get(id);
      if (reservation) {
        logger.info('Cleaning up expired memory reservation', {
          reservationId: id,
          age: now - reservation.timestamp.getTime(),
          purpose: reservation.purpose
        });
        
        this.reservations.delete(id);
      }
    }

    return expiredReservations.length;
  }

  /**
   * Cleanup resources on shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.reservations.clear();
    
    logger.info('GPU Memory Manager destroyed');
  }
}