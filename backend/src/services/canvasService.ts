// Canvas Service - Manages design operations
// Handles design creation, element updates, and basic operations
import { Design, User, TierConfig } from '../models';

/**
 * Check if user can create a new design based on tier limits
 */
export async function canUserCreateDesign(userId: string): Promise<{ 
  allowed: boolean; 
  reason?: string;
  tierConfig?: any;
}> {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const tierConfig = await TierConfig.findByTierName(user.tier);
    if (!tierConfig) {
      console.error(`Tier config not found for tier: ${user.tier}, userId: ${userId}`);
      return { allowed: false, reason: `Tier configuration not found for tier: ${user.tier}` };
    }

    // Debug logging
    console.log(`Design permission check - User: ${userId}, Tier: ${user.tier}, hasDesigns: ${tierConfig.designs?.hasDesigns}, designsLimit: ${tierConfig.designs?.designsLimit}`);

    // Check if tier has designs feature
    if (!tierConfig.designs || !tierConfig.designs.hasDesigns) {
      console.warn(`Designs feature disabled for tier: ${user.tier}, userId: ${userId}`);
      return { 
        allowed: false, 
        reason: 'Your tier does not include the Designs feature. Please upgrade to access this feature.'
      };
    }

    // Check monthly limit (0 = unlimited)
    if (tierConfig.designs.designsLimit > 0) {
      const designsThisMonth = await Design.countThisMonth(userId);
      
      if (designsThisMonth >= tierConfig.designs.designsLimit) {
        return { 
          allowed: false, 
          reason: `Monthly design limit reached (${tierConfig.designs.designsLimit}). Upgrade your tier for more designs.`,
          tierConfig
        };
      }
    }

    return { allowed: true, tierConfig };
  } catch (error) {
    console.error('Error checking design permissions:', error);
    return { allowed: false, reason: 'Failed to check permissions' };
  }
}

/**
 * Get design size presets
 */
export function getDesignPresets() {
  return {
    // Social Media
    'instagram-post': { width: 1080, height: 1080, name: 'Instagram Post (Square)' },
    'instagram-story': { width: 1080, height: 1920, name: 'Instagram Story' },
    'facebook-post': { width: 1200, height: 630, name: 'Facebook Post' },
    'twitter-post': { width: 1200, height: 675, name: 'Twitter Post' },
    'linkedin-post': { width: 1200, height: 627, name: 'LinkedIn Post' },
    'twitter-header': { width: 1500, height: 500, name: 'Twitter Header' },
    'facebook-cover': { width: 820, height: 312, name: 'Facebook Cover' },
    
    // YouTube
    'youtube-thumbnail': { width: 1280, height: 720, name: 'YouTube Thumbnail' },
    'youtube-banner': { width: 2560, height: 1440, name: 'YouTube Banner' },
    
    // Ads
    'google-display-ad': { width: 300, height: 250, name: 'Google Display Ad' },
    'facebook-ad': { width: 1200, height: 628, name: 'Facebook Ad' },
    
    // Print
    'flyer': { width: 2550, height: 3300, name: 'Flyer (8.5x11")' },
    'business-card': { width: 1050, height: 600, name: 'Business Card' },
    
    // Custom
    'custom': { width: null, height: null, name: 'Custom Size' }
  };
}

/**
 * Validate design element structure
 */
export function validateDesignElement(element: any): boolean {
  if (!element.elementId || !element.type) return false;
  if (!['text', 'image', 'shape', 'ai-image'].includes(element.type)) return false;
  if (typeof element.x !== 'number' || typeof element.y !== 'number') return false;
  if (typeof element.width !== 'number' || typeof element.height !== 'number') return false;
  return true;
}

/**
 * Sanitize design elements before saving
 */
export function sanitizeDesignElements(elements: any[]): any[] {
  return elements.filter(validateDesignElement).map(element => ({
    elementId: element.elementId,
    type: element.type,
    content: element.content || '',
    x: Math.round(element.x),
    y: Math.round(element.y),
    width: Math.round(element.width),
    height: Math.round(element.height),
    rotation: element.rotation || 0,
    opacity: element.opacity !== undefined ? element.opacity : 1,
    zIndex: element.zIndex || 0,
    styles: element.styles || '{}'
  }));
}

