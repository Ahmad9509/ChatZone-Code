// Presentation Service - Manages presentation operations
// Handles presentation creation, slide management, and basic operations
import { Presentation, User, TierConfig } from '../models';

/**
 * Check if user can create a new presentation based on tier limits
 */
export async function canUserCreatePresentation(userId: string): Promise<{ 
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
      return { allowed: false, reason: 'Tier configuration not found' };
    }

    // Check if tier has presentations feature
    if (!tierConfig.presentations.hasPresentations) {
      return { 
        allowed: false, 
        reason: 'Your tier does not include the Presentations feature. Please upgrade to access this feature.'
      };
    }

    // Check monthly limit (0 = unlimited)
    if (tierConfig.presentations.presentationsLimit > 0) {
      const presentationsThisMonth = await Presentation.countThisMonth(userId);
      
      if (presentationsThisMonth >= tierConfig.presentations.presentationsLimit) {
        return { 
          allowed: false, 
          reason: `Monthly presentation limit reached (${tierConfig.presentations.presentationsLimit}). Upgrade your tier for more presentations.`,
          tierConfig
        };
      }
    }

    return { allowed: true, tierConfig };
  } catch (error) {
    console.error('Error checking presentation permissions:', error);
    return { allowed: false, reason: 'Failed to check permissions' };
  }
}

/**
 * Validate slide structure
 */
export function validateSlide(slide: any): boolean {
  if (!slide.slideId || typeof slide.slideNumber !== 'number') return false;
  if (!slide.layoutId) return false;
  return true;
}

/**
 * Sanitize slides before saving
 */
export function sanitizeSlides(slides: any[]): any[] {
  return slides.filter(validateSlide).map(slide => ({
    slideId: slide.slideId,
    slideNumber: slide.slideNumber,
    layoutId: slide.layoutId,
    elements: slide.elements || '[]',
    backgroundColor: slide.backgroundColor || '#FFFFFF',
    notes: slide.notes || '',
    createdAt: slide.createdAt || new Date(),
    updatedAt: new Date()
  }));
}

/**
 * Generate slide ID
 */
export function generateSlideId(): string {
  return `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Reorder slides
 */
export function reorderSlides(slides: any[], fromIndex: number, toIndex: number): any[] {
  const result = Array.from(slides);
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  
  // Update slide numbers
  return result.map((slide, index) => ({
    ...slide,
    slideNumber: index + 1
  }));
}

/**
 * Export presentation to PowerPoint (.pptx)
 * NOTE: This will be implemented after pptxgenjs dependency is installed
 */
export async function exportToPowerPoint(presentationId: string, userId: string): Promise<Buffer> {
  // TODO: Implement PowerPoint export using pptxgenjs
  // This will be added after the dependency is installed
  throw new Error('PowerPoint export not yet implemented. Please install pptxgenjs dependency first.');
}

/**
 * Export presentation to PDF
 * NOTE: This will be implemented after sharp/puppeteer dependencies are installed
 */
export async function exportToPDF(presentationId: string, userId: string): Promise<Buffer> {
  // TODO: Implement PDF export using puppeteer or sharp
  // This will be added after the dependencies are installed
  throw new Error('PDF export not yet implemented. Please install required dependencies first.');
}

