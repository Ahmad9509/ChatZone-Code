// Presentations API routes
// Handles creation and management of slide decks
import express from 'express';
import { Presentation, User } from '../models';
import { authenticateJWT } from '../middleware/auth';
import { 
  canUserCreatePresentation, 
  sanitizeSlides, 
  generateSlideId, 
  reorderSlides 
} from '../services/presentationService';
import { listAvailableTemplates, listAvailableThemes } from '../services/presentationTemplateService';
import { exportPresentationToPPTX, exportPresentationToPDF } from '../services/pptxExportService';

const router = express.Router();

// Get all presentations for user
router.get('/', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const presentations = await Presentation.findByUserId(user.rowKey);
    
    res.json({ presentations });
  } catch (error: any) {
    console.error('Get presentations error:', error);
    res.status(500).json({ error: 'Failed to fetch presentations' });
  }
});

// Get specific presentation
router.get('/:presentationId', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const presentation = await Presentation.findById(user.rowKey, req.params.presentationId);
    
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    res.json({ presentation });
  } catch (error: any) {
    console.error('Get presentation error:', error);
    res.status(500).json({ error: 'Failed to fetch presentation' });
  }
});

// Create new presentation
router.post('/', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    // Check if user can create presentation
    const { allowed, reason } = await canUserCreatePresentation(user.rowKey);
    if (!allowed) {
      return res.status(403).json({ error: reason });
    }
    
    const { title, description, theme, chatConversationId } = req.body;
    
    // Create presentation
    const presentation = await Presentation.create({
      userId: user.rowKey,
      title: title || 'Untitled Presentation',
      description: description || '',
      theme: theme || JSON.stringify({ brandColor: '#3B82F6', fontFamily: 'Arial', logoUrl: null }),
      chatConversationId,
      slides: '[]',
      slideCount: 0,
    });
    
    // Update user usage stats
    await User.update(user.rowKey, {
      presentationsCreatedThisMonth: user.presentationsCreatedThisMonth + 1,
      presentationsCreatedTotal: user.presentationsCreatedTotal + 1,
    });
    
    res.json({ presentation });
  } catch (error: any) {
    console.error('Create presentation error:', error);
    res.status(500).json({ error: 'Failed to create presentation' });
  }
});

// Update presentation
router.put('/:presentationId', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const { title, description, slides, theme, status, thumbnail } = req.body;
    
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (theme !== undefined) updates.theme = theme;
    if (status !== undefined) updates.status = status;
    if (thumbnail !== undefined) updates.thumbnail = thumbnail;
    
    if (slides !== undefined) {
      const sanitized = sanitizeSlides(slides);
      updates.slides = JSON.stringify(sanitized);
      updates.slideCount = sanitized.length;
    }
    
    const presentation = await Presentation.update(user.rowKey, req.params.presentationId, updates);
    
    res.json({ presentation });
  } catch (error: any) {
    console.error('Update presentation error:', error);
    res.status(500).json({ error: 'Failed to update presentation' });
  }
});

// Add slide to presentation
router.post('/:presentationId/slides', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const presentation = await Presentation.findById(user.rowKey, req.params.presentationId);
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    const slides = JSON.parse(presentation.slides);
    const { layoutId, position } = req.body;
    
    const newSlide = {
      slideId: generateSlideId(),
      slideNumber: position !== undefined ? position : slides.length + 1,
      layoutId: layoutId || 'default',
      elements: '[]',
      backgroundColor: '#FFFFFF',
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Insert at position
    if (position !== undefined && position <= slides.length) {
      slides.splice(position - 1, 0, newSlide);
      // Renumber slides
      slides.forEach((slide: any, index: number) => {
        slide.slideNumber = index + 1;
      });
    } else {
      slides.push(newSlide);
    }
    
    await Presentation.update(user.rowKey, req.params.presentationId, {
      slides: JSON.stringify(slides),
      slideCount: slides.length,
    });
    
    res.json({ slide: newSlide });
  } catch (error: any) {
    console.error('Add slide error:', error);
    res.status(500).json({ error: 'Failed to add slide' });
  }
});

// Update specific slide
router.put('/:presentationId/slides/:slideId', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const presentation = await Presentation.findById(user.rowKey, req.params.presentationId);
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    const slides = JSON.parse(presentation.slides);
    const slideIndex = slides.findIndex((s: any) => s.slideId === req.params.slideId);
    
    if (slideIndex === -1) {
      return res.status(404).json({ error: 'Slide not found' });
    }
    
    // Update slide
    slides[slideIndex] = {
      ...slides[slideIndex],
      ...req.body,
      updatedAt: new Date(),
    };
    
    await Presentation.update(user.rowKey, req.params.presentationId, {
      slides: JSON.stringify(slides),
    });
    
    res.json({ slide: slides[slideIndex] });
  } catch (error: any) {
    console.error('Update slide error:', error);
    res.status(500).json({ error: 'Failed to update slide' });
  }
});

// Delete slide
router.delete('/:presentationId/slides/:slideId', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const presentation = await Presentation.findById(user.rowKey, req.params.presentationId);
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    const slides = JSON.parse(presentation.slides);
    const filtered = slides.filter((s: any) => s.slideId !== req.params.slideId);
    
    // Renumber slides
    filtered.forEach((slide: any, index: number) => {
      slide.slideNumber = index + 1;
    });
    
    await Presentation.update(user.rowKey, req.params.presentationId, {
      slides: JSON.stringify(filtered),
      slideCount: filtered.length,
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete slide error:', error);
    res.status(500).json({ error: 'Failed to delete slide' });
  }
});

// Reorder slides
router.put('/:presentationId/slides-reorder', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const presentation = await Presentation.findById(user.rowKey, req.params.presentationId);
    if (!presentation) {
      return res.status(404).json({ error: 'Presentation not found' });
    }
    
    const { fromIndex, toIndex } = req.body;
    const slides = JSON.parse(presentation.slides);
    const reordered = reorderSlides(slides, fromIndex, toIndex);
    
    await Presentation.update(user.rowKey, req.params.presentationId, {
      slides: JSON.stringify(reordered),
    });
    
    res.json({ slides: reordered });
  } catch (error: any) {
    console.error('Reorder slides error:', error);
    res.status(500).json({ error: 'Failed to reorder slides' });
  }
});

// Delete presentation
router.delete('/:presentationId', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    await Presentation.delete(user.rowKey, req.params.presentationId);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete presentation error:', error);
    res.status(500).json({ error: 'Failed to delete presentation' });
  }
});

// Export presentation as PPTX
router.post('/:presentationId/export/pptx', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const buffer = await exportPresentationToPPTX(req.params.presentationId);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="presentation.pptx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Export PPTX error:', error);
    res.status(500).json({ error: error.message || 'Failed to export presentation' });
  }
});

// Export presentation as PDF
router.post('/:presentationId/export/pdf', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const buffer = await exportPresentationToPDF(req.params.presentationId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="presentation.pdf"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Export PDF error:', error);
    res.status(500).json({ error: error.message || 'Failed to export presentation' });
  }
});

// Get available templates
router.get('/templates/list', authenticateJWT as any, async (req: any, res) => {
  try {
    const templates = await listAvailableTemplates();
    const themes = listAvailableThemes();
    
    res.json({ templates, themes });
  } catch (error: any) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

export default router;

