// Designs API routes
// Handles creation and management of user designs (social media graphics, posters, etc.)
import express from 'express';
import { Design, User } from '../models';
import { authenticateJWT } from '../middleware/auth';
import { canUserCreateDesign, sanitizeDesignElements, getDesignPresets } from '../services/canvasService';
import { toResponse } from '../utils/responseFormatter';

const router = express.Router();

// Get all designs for user
router.get('/', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const designs = await Design.findByUserId(user.rowKey);
    
    // Transform to API response format with _id field
    const formattedDesigns = designs.map(d => toResponse(d));
    
    res.json({ designs: formattedDesigns });
  } catch (error: any) {
    console.error('Get designs error:', error);
    res.status(500).json({ error: 'Failed to fetch designs' });
  }
});

// Get specific design
router.get('/:designId', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const design = await Design.findById(user.rowKey, req.params.designId);
    
    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }
    
    // Transform to API response format with _id field
    res.json({ design: toResponse(design) });
  } catch (error: any) {
    console.error('Get design error:', error);
    res.status(500).json({ error: 'Failed to fetch design' });
  }
});

// Create new design
router.post('/', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    // Check if user can create design
    const { allowed, reason } = await canUserCreateDesign(user.rowKey);
    if (!allowed) {
      return res.status(403).json({ error: reason });
    }
    
    const { title, designType, width, height, backgroundColor } = req.body;
    
    // Create design
    const design = await Design.create({
      userId: user.rowKey,
      title: title || 'Untitled Design',
      designType: designType || 'custom',
      width: width || 1080,
      height: height || 1080,
      backgroundColor: backgroundColor || '#FFFFFF',
      elements: '[]',
    });
    
    // Update user usage stats
    await User.update(user.rowKey, {
      designsCreatedThisMonth: user.designsCreatedThisMonth + 1,
      designsCreatedTotal: user.designsCreatedTotal + 1,
    });
    
    // Transform to API response format with _id field
    res.json({ design: toResponse(design) });
  } catch (error: any) {
    console.error('Create design error:', error);
    res.status(500).json({ error: 'Failed to create design' });
  }
});

// Update design
router.put('/:designId', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const { title, elements, backgroundColor, thumbnail } = req.body;
    
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (backgroundColor !== undefined) updates.backgroundColor = backgroundColor;
    if (thumbnail !== undefined) updates.thumbnail = thumbnail;
    
    if (elements !== undefined) {
      const sanitized = sanitizeDesignElements(elements);
      updates.elements = JSON.stringify(sanitized);
    }
    
    const design = await Design.update(user.rowKey, req.params.designId, updates);
    
    // Transform to API response format with _id field
    res.json({ design: toResponse(design) });
  } catch (error: any) {
    console.error('Update design error:', error);
    res.status(500).json({ error: 'Failed to update design' });
  }
});

// Delete design
router.delete('/:designId', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    await Design.delete(user.rowKey, req.params.designId);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete design error:', error);
    res.status(500).json({ error: 'Failed to delete design' });
  }
});

// Get design presets (sizes for social media, etc.)
router.get('/presets/list', authenticateJWT as any, async (req: any, res) => {
  try {
    const presets = getDesignPresets();
    res.json({ presets });
  } catch (error: any) {
    console.error('Get presets error:', error);
    res.status(500).json({ error: 'Failed to fetch presets' });
  }
});

export default router;

