// Tier Service - Centralized tier limit management
// This service fetches tier configurations from the database instead of using hardcoded values
// It includes caching to avoid database hits on every request and fallbacks for safety

import { TierConfigTable, ITierConfig } from '../models/TierConfigTable';

/**
 * TierService class
 * Provides centralized access to tier limits and configurations
 */
export class TierService {
  // In-memory cache to store tier configs and avoid hitting database repeatedly
  private static cache: Map<string, ITierConfig> = new Map();
  private static cacheExpiry: Map<string, number> = new Map();
  private static CACHE_TTL = 5 * 60 * 1000; // Cache expires after 5 minutes

  /**
   * Get tier configuration from database (with caching)
   * Returns null if tier not found
   */
  static async getTierConfig(tierName: string): Promise<ITierConfig | null> {
    // Check if we have a valid cached version
    const cached = this.cache.get(tierName);
    const expiry = this.cacheExpiry.get(tierName);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    // Fetch from database
    try {
      const config = await TierConfigTable.findByTierName(tierName);
      
      if (config) {
        // Store in cache with expiry time
        this.cache.set(tierName, config);
        this.cacheExpiry.set(tierName, Date.now() + this.CACHE_TTL);
        return config;
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching tier config for ${tierName}:`, error);
      return null;
    }
  }

  /**
   * Get maximum projects allowed for a tier
   * Returns -1 for unlimited projects
   * Falls back to hardcoded values if database fails
   */
  static async getMaxProjects(tierName: string): Promise<number> {
    const config = await this.getTierConfig(tierName);
    
    if (!config) {
      // Fallback to current hardcoded values to maintain existing behavior
      const fallbacks: Record<string, number> = {
        free: 3,
        tier5: 10,
        tier10: 50,
        tier15: -1, // unlimited
      };
      return fallbacks[tierName] ?? 3;
    }
    
    // Treat 999 or higher as unlimited (represented as -1)
    return config.maxProjects >= 999 ? -1 : config.maxProjects;
  }

  /**
   * Get storage limit in bytes for a tier
   * Returns 0 if storage/RAG not available for this tier
   * Falls back to hardcoded values if database fails
   */
  static async getStorageLimit(tierName: string): Promise<number> {
    const config = await this.getTierConfig(tierName);
    
    if (!config) {
      // Fallback to current hardcoded values to maintain existing behavior
      const fallbacks: Record<string, number> = {
        free: 0, // No RAG for free tier
        tier5: 2.1 * 1024 * 1024 * 1024, // 2.1 GB
        tier10: 3.5 * 1024 * 1024 * 1024, // 3.5 GB
        tier15: 3.5 * 1024 * 1024 * 1024, // 3.5 GB
      };
      return fallbacks[tierName] ?? 0;
    }
    
    return config.ragStorageLimit;
  }

  /**
   * Get tier price in USD
   * Returns 0 for free tier
   * Falls back to hardcoded values if database fails
   */
  static async getTierPrice(tierName: string): Promise<number> {
    const config = await this.getTierConfig(tierName);
    
    if (!config) {
      // Fallback to current hardcoded values
      const fallbacks: Record<string, number> = {
        free: 0,
        tier5: 5,
        tier10: 10,
        tier15: 15,
      };
      return fallbacks[tierName] ?? 0;
    }
    
    return config.priceUSD;
  }

  /**
   * Clear the cache (useful after updating tier configs in admin panel)
   */
  static clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

