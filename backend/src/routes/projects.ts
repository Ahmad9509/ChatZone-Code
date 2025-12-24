// Projects API routes
// Production-ready Claude-style workspaces
import express from 'express';
import { Project, Conversation, Artifact } from '../models';
import Document, { DocumentChunk } from '../models/Document';
import { authenticateJWT } from '../middleware/auth';
import { TierService } from '../services/tierService';
import { toResponse, toResponseArray } from '../utils/responseFormatter';
import { enrichProjectsWithCounts, enrichSingleProject } from '../services/projectStatsService';
import multer from 'multer';

const router = express.Router();

// Create new project
router.post('/', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    // Get max projects from TierService (centralized tier limit management)
    const maxProjects = await TierService.getMaxProjects(user.tier);

    // Check tier limits - fetch user's existing projects
    const userProjects = await Project.findByUserId(user.rowKey);
    const activeProjects = userProjects.filter((p: any) => !p.archived);
    
    // Enforce project limit (-1 means unlimited)
    if (maxProjects !== -1 && activeProjects.length >= maxProjects) {
      return res.status(403).json({ 
        error: `Project limit reached. Your tier allows ${maxProjects} projects. Upgrade to create more.` 
      });
    }

    // Create project
    const project = await Project.create({
      userId: user.rowKey,
      name: req.body.name || 'Untitled Project',
      description: req.body.description || '',
      customInstructions: req.body.customInstructions || '',
    });

    res.json(project);
  } catch (error: any) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create project',
    });
  }
});

// Get all projects for user
router.get('/', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const { starred, archived } = req.query;

    // Get all projects from Table Storage
    let projects = await Project.findByUserId(user.rowKey);
    
    // Filter based on query params
    if (starred === 'true') {
      projects = projects.filter((p: any) => p.starred);
    }
    
    if (archived === 'true') {
      projects = projects.filter((p: any) => p.archived);
    } else if (archived === 'false' || !archived) {
      projects = projects.filter((p: any) => !p.archived);
    }

    // Sort by updatedAt desc
    projects.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Efficiently add conversation and document counts to all projects
    // This fetches data ONCE and counts in memory (instead of N database queries)
    const projectsWithCounts = await enrichProjectsWithCounts(user.rowKey, projects);
        
    // Transform to API response format with _id field
    const formattedProjects = projectsWithCounts.map(p => toResponse(p));

    res.json(formattedProjects);
  } catch (error: any) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects',
    });
  }
});

// Get single project
router.get('/:id', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const project = await Project.findById(user.rowKey, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Efficiently add conversation and document counts to this project
    const projectWithCounts = await enrichSingleProject(user.rowKey, project);

    res.json(toResponse(projectWithCounts));
  } catch (error: any) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project',
    });
  }
});

// Update project
router.put('/:id', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const { name, description, customInstructions, starred, archived } = req.body;

    const project = await Project.findById(user.rowKey, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Build updates
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (customInstructions !== undefined) updates.customInstructions = customInstructions;
    if (starred !== undefined) updates.starred = starred;
    if (archived !== undefined) updates.archived = archived;

    const updatedProject = await Project.update(user.rowKey, req.params.id, updates);

    res.json(toResponse(updatedProject!));
  } catch (error: any) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update project',
    });
  }
});

// Delete project
router.delete('/:id', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const project = await Project.findById(user.rowKey, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete all associated conversations from Table Storage
    await Conversation.deleteByProjectId(user.rowKey, project.rowKey);

    // Delete all associated RAG documents from MongoDB
    const documents = await Document.find({ 
      userId: user.rowKey, 
      projectId: project.rowKey 
    });
    
    for (const doc of documents) {
      // Delete from blob storage would go here
      await doc.deleteOne();
    }

    // Delete project from Table Storage
    await Project.delete(user.rowKey, project.rowKey);

    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete project',
    });
  }
});

// Get conversations in project
router.get('/:id/conversations', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const project = await Project.findById(user.rowKey, req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const allConversations = await Conversation.findByUserId(user.rowKey);
    const projectConversations = allConversations
      .filter((c: any) => c.projectId === project.rowKey)
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    res.json(toResponseArray(projectConversations));
  } catch (error: any) {
    console.error('Get project conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
    });
  }
});

// Get documents in project
router.get('/:id/documents', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    
    const project = await Project.findById(user.rowKey, req.params.id);

    if (!project) {
      console.log('Project not found for documents:', req.params.id);
      return res.json([]); // Return empty array instead of 404
    }

    // RAG documents are still in MongoDB
    // Handle case when MongoDB is not available
    let documents: any[] = [];
    try {
      documents = await Document.find({ 
        userId: user.rowKey, 
        projectId: project.rowKey 
      }).sort({ uploadedAt: -1 });
    } catch (mongoError: any) {
      // MongoDB not available - return empty array
      console.warn('MongoDB not available for documents:', mongoError.message);
      documents = [];
    }

    res.json(documents);
  } catch (error: any) {
    console.error('Get project documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents',
    });
  }
});

// Copy artifact to project
router.post('/:projectId/artifacts', authenticateJWT as any, async (req: any, res) => {
  try {
    const user = req.user;
    const { projectId } = req.params;
    const { artifactId, conversationId, title, content, type, language } = req.body;

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Verify project ownership
    const project = await Project.findById(user.rowKey, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // If artifactId provided, verify artifact ownership
    if (artifactId && conversationId) {
      const artifact = await Artifact.findById(conversationId, artifactId);
      if (!artifact || artifact.userId !== user.rowKey) {
        return res.status(404).json({ error: 'Artifact not found' });
      }
    }

    // Create new artifact in project context
    const projectArtifact = await Artifact.create({
      userId: user.rowKey,
      conversationId: projectId, // Use projectId as conversationId for project artifacts
      messageId: `project-${Date.now()}`, // Generate unique message ID
      type: type || 'markdown',
      title: title || 'Untitled',
      language: language,
      content: content,
      metadata: JSON.stringify({ 
        sourceArtifactId: artifactId,
        sourceConversationId: conversationId,
        copiedToProject: true,
        copiedAt: new Date().toISOString()
      }),
    });

    // Update project timestamp
    await Project.update(user.rowKey, projectId, {
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      artifact: toResponse(projectArtifact),
      message: `Copied to ${project.name}`,
    });
  } catch (error: any) {
    console.error('Copy artifact to project error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to copy artifact to project',
    });
  }
});

export default router;

