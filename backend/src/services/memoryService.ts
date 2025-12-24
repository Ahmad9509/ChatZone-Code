// Memory management service for tracking file storage usage per conversation

interface MemoryLimit {
  free: number;
  tier5: number;
  tier10: number;
  tier15: number;
}

// Tier-based memory limits in bytes
const TIER_MEMORY_LIMITS: MemoryLimit = {
  free: 50 * 1024 * 1024,      // 50MB
  tier5: 150 * 1024 * 1024,    // 150MB
  tier10: 250 * 1024 * 1024,   // 250MB
  tier15: 500 * 1024 * 1024,   // 500MB
};

export class MemoryService {
  /**
   * Get memory capacity for a user tier
   */
  static getCapacity(tier: string): number {
    const capacity = TIER_MEMORY_LIMITS[tier as keyof MemoryLimit];
    return capacity || TIER_MEMORY_LIMITS.free;
  }

  /**
   * Calculate total size of files
   */
  static calculateFileSize(files: Array<{ size: number }>): number {
    return files.reduce((sum, file) => sum + file.size, 0);
  }

  /**
   * Check if adding files would exceed memory capacity
   */
  static checkMemoryCapacity(
    currentUsage: number,
    filesToAdd: Array<{ size: number }>,
    tier: string
  ): { available: boolean; remaining: number } {
    const capacity = this.getCapacity(tier);
    const additionalSize = this.calculateFileSize(filesToAdd);
    const totalUsage = currentUsage + additionalSize;

    return {
      available: totalUsage <= capacity,
      remaining: Math.max(0, capacity - totalUsage),
    };
  }

  /**
   * Get available memory for a conversation
   */
  static getAvailableMemory(currentUsage: number, tier: string): number {
    const capacity = this.getCapacity(tier);
    return Math.max(0, capacity - currentUsage);
  }

  /**
   * Format bytes to human-readable format
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get percentage of memory used
   */
  static getUsagePercentage(currentUsage: number, tier: string): number {
    const capacity = this.getCapacity(tier);
    return Math.min((currentUsage / capacity) * 100, 100);
  }

  /**
   * Validate file size against tier limit
   */
  static validateFileSize(fileSize: number, tier: string): { valid: boolean; error?: string } {
    // Individual file limits per tier
    const fileSizeLimits: Record<string, number> = {
      free: 10 * 1024 * 1024,      // 10MB
      tier5: 30 * 1024 * 1024,     // 30MB
      tier10: 50 * 1024 * 1024,    // 50MB
      tier15: 100 * 1024 * 1024,   // 100MB
    };

    const limit = fileSizeLimits[tier] || fileSizeLimits.free;

    if (fileSize > limit) {
      return {
        valid: false,
        error: `File exceeds maximum size of ${this.formatBytes(limit)} for ${tier} tier`,
      };
    }

    return { valid: true };
  }
}
