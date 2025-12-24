// Artifact routes - managing generated code, HTML, documents
import { Router, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { Artifact, Conversation, Message } from '../models';
import { streamChatCompletion } from '../services/aiService';
import { getModelForUser } from '../services/modelSelectionService';
import { searchWeb } from '../services/serperService';
import { generateAIResponse } from '../services/chatService';
import { toResponse, toResponseArray } from '../utils/responseFormatter';

const router = Router();

/**
 * Get all artifacts for a conversation
 */
router.get('/conversations/:conversationId/artifacts', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { conversationId } = req.params;

    // Verify conversation ownership
    const conversation = await Conversation.findById(user.rowKey, conversationId);
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }

    const artifacts = await Artifact.findByConversationId(conversationId);

    res.json({
      success: true,
      artifacts: toResponseArray(artifacts),
    });
  } catch (error) {
    console.error('Get artifacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch artifacts',
    });
  }
});

/**
 * Get single artifact
 */
router.get('/artifacts/:artifactId', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { artifactId } = req.params;
    const { conversationId } = req.query;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'conversationId query parameter required',
      });
      return;
    }

    const artifact = await Artifact.findById(conversationId as string, artifactId);

    if (!artifact) {
      res.status(404).json({
        success: false,
        error: 'Artifact not found',
      });
      return;
    }

    // Verify user owns this artifact
    if (artifact.userId !== user.rowKey) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    res.json({
      success: true,
      artifact: toResponse(artifact),
    });
  } catch (error) {
    console.error('Get artifact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch artifact',
    });
  }
});

/**
 * Get all versions of an artifact
 */
router.get('/artifacts/:artifactId/versions', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { artifactId } = req.params;
    const { conversationId } = req.query;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'conversationId query parameter required',
      });
      return;
    }

    const versions = await Artifact.findVersions(conversationId as string, artifactId);

    if (versions.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Artifact not found',
      });
      return;
    }

    // Verify user owns this artifact
    if (versions[0].userId !== user.rowKey) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    res.json({
      success: true,
      versions: toResponseArray(versions),
    });
  } catch (error) {
    console.error('Get artifact versions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch artifact versions',
    });
  }
});

/**
 * Create new artifact (usually done automatically during chat, but exposed for manual creation)
 */
router.post('/artifacts', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { conversationId, messageId, type, title, language, content, metadata } = req.body;

    // Validate required fields
    if (!conversationId || !messageId || !type || !title || !content) {
      res.status(400).json({
        success: false,
        error: 'conversationId, messageId, type, title, and content are required',
      });
      return;
    }

    // Verify conversation ownership
    const conversation = await Conversation.findById(user.rowKey, conversationId);
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }

    const artifact = await Artifact.create({
      userId: user.rowKey,
      conversationId,
      messageId,
      type,
      title,
      language,
      content,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    res.json({
      success: true,
      artifact: toResponse(artifact),
    });
  } catch (error) {
    console.error('Create artifact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create artifact',
    });
  }
});

/**
 * Update artifact (creates new version)
 */
router.patch('/artifacts/:artifactId', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { artifactId } = req.params;
    const { conversationId, messageId, content, title } = req.body;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'conversationId is required',
      });
      return;
    }

    const existingArtifact = await Artifact.findById(conversationId, artifactId);

    if (!existingArtifact) {
      res.status(404).json({
        success: false,
        error: 'Artifact not found',
      });
      return;
    }

    // Verify ownership
    if (existingArtifact.userId !== user.rowKey) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    // Create new version
    const newVersion = await Artifact.create({
      userId: user.rowKey,
      conversationId,
      messageId: messageId || `manual-edit-${Date.now()}`,
      type: existingArtifact.type,
      title: title || existingArtifact.title,
      language: existingArtifact.language,
      content,
      version: existingArtifact.version + 1,
      parentArtifactId: existingArtifact.rowKey,
      metadata: JSON.stringify({
        ...((existingArtifact.metadata && JSON.parse(existingArtifact.metadata)) || {}),
        editType: 'manual',
        editedAt: new Date().toISOString(),
      }),
    });

    res.json({
      success: true,
      artifact: toResponse(newVersion),
    });
  } catch (error) {
    console.error('Update artifact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update artifact',
    });
  }
});

/**
 * Apply AI edit to selected portion of artifact
 * User highlights text and asks AI to modify it
 * Uses SSE streaming for real-time response
 */
router.post('/artifacts/:artifactId/apply-selection-edit', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { artifactId } = req.params;
    const { conversationId, selectedText, startIndex, endIndex, prompt } = req.body;

    if (!conversationId || !selectedText || startIndex === undefined || endIndex === undefined || !prompt) {
      res.status(400).json({
        success: false,
        error: 'conversationId, selectedText, startIndex, endIndex, and prompt are required',
      });
      return;
    }

    const existingArtifact = await Artifact.findById(conversationId, artifactId);

    if (!existingArtifact) {
      res.status(404).json({
        success: false,
        error: 'Artifact not found',
      });
      return;
    }

    // Verify ownership
    if (existingArtifact.userId !== user.rowKey) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    // Get conversation
    const conversation = await Conversation.findById(user.rowKey, conversationId);
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send artifact context event with selection info
    res.write(`data: ${JSON.stringify({
      type: 'artifact_edit_start',
      artifactId: existingArtifact.rowKey,
      selectedText,
      startIndex,
      endIndex
    })}\n\n`);

    // Build custom system prompt additions for artifact editing
    const customSystemPromptAdditions = `

## Artifact Selection Editing Mode

You are editing a specific portion of an existing artifact. The user has selected text and provided an instruction to modify it.

### Understanding User Instructions
Interpret instructions contextually:
- **"make it bigger" / "expand" / "make it longer"** = Add more detail, examples, explanations, or paragraphs while maintaining the core message
- **"make it shorter" / "condense" / "summarize"** = Compress the content while preserving key information
- **"improve" / "enhance" / "make it better"** = Rewrite with better clarity, flow, structure, and quality
- **"add [X]"** = Incorporate X naturally into the selected content
- **"make it more [style]"** = Adjust tone/style (e.g., formal, casual, technical, simple)
- **Questions about current info** = Use the search_web tool to find up-to-date information before responding

### Critical Output Rules
1. Return ONLY the revised text that should replace the selected portion
2. Do NOT include explanations, markdown code fences, or additional commentary
3. Do NOT include phrases like "Here's the revised version" or similar meta-text
4. Preserve the document's existing format and style unless explicitly asked to change it
5. If you need current information, use search_web tool, then incorporate findings naturally

### Artifact Context
- Type: ${existingArtifact.type}
${existingArtifact.language ? `- Language: ${existingArtifact.language}` : ''}

### Full Document Context
\`\`\`
${existingArtifact.content}
\`\`\`

### Selected Section (to be replaced)
===START SELECTION===
${selectedText}
===END SELECTION===

### User's Instruction
"${prompt}"

Provide ONLY the improved/modified replacement text for the selected section. Address their instruction fully while maintaining coherence with the overall document.`;

    // Create a temporary user message for context
    const userMessageContent = `Edit artifact selection: ${prompt}`;
    const tempUserMessage = {
      rowKey: `artifact-edit-${Date.now()}`,
      conversationId,
      role: 'user',
      content: userMessageContent,
      modelName: 'auto',
      tokenCount: 0,
      branchIndex: 0,
      attachedFiles: undefined,
    };

    // Call generateAIResponse with custom system prompt additions
    await generateAIResponse(res, {
      user,
      conversation,
      conversationId,
      userMessageContent,
      userMessageRecord: tempUserMessage,
      model: undefined, // Use user's selected model
      isProSearch: false,
      forceArtifact: false,
      attachedFileIds: undefined,
      existingMessages: [],
      parentMessageId: undefined,
      content: userMessageContent,
      customSystemPromptAdditions,
    });

  } catch (error: any) {
    console.error('Apply selection edit error:', error);
    
    // If SSE headers already sent, send error event
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Failed to apply AI edit' })}\n\n`);
      res.end();
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to apply AI edit',
      });
    }
  }
});

/**
 * Delete artifact
 */
router.delete('/artifacts/:artifactId', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { artifactId } = req.params;
    const { conversationId } = req.query;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'conversationId query parameter required',
      });
      return;
    }

    const artifact = await Artifact.findById(conversationId as string, artifactId);

    if (!artifact) {
      res.status(404).json({
        success: false,
        error: 'Artifact not found',
      });
      return;
    }

    // Verify ownership
    if (artifact.userId !== user.rowKey) {
      res.status(403).json({
        success: false,
        error: 'Access denied',
      });
      return;
    }

    await Artifact.delete(conversationId as string, artifactId);

    res.json({
      success: true,
      message: 'Artifact deleted',
    });
  } catch (error) {
    console.error('Delete artifact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete artifact',
    });
  }
});

/**
 * Get all artifacts for current user
 */
router.get('/artifacts', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;

    const artifacts = await Artifact.findByUserId(user.rowKey);

    res.json({
      success: true,
      artifacts: artifacts.map(a => ({
        ...a,
        _id: a.rowKey,
      })),
    });
  } catch (error) {
    console.error('Get user artifacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch artifacts',
    });
  }
});

export default router;

