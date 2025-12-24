// Chat routes - conversation and message management
// Production-ready streaming chat API
import { Router, Response } from 'express';
import { authenticateJWT, requireTier } from '../middleware/auth';
import { validateConversation, validateConversationForSSE } from '../middleware/conversationValidator';
import { Conversation, User, Model, Message, Provider, SystemPrompt, Project, Artifact, TierConfig } from '../models';
import Document from '../models/Document';
import { searchDocuments, buildContextWithFiles, storeConversationChunk } from '../services/ragService';
import { streamChatCompletion, generateChatTitle } from '../services/aiService';
import { searchWeb } from '../services/serperService';
import { parseArtifacts, stripArtifactTags, detectArtifactStart, detectArtifactEnd, ArtifactMeta } from '../services/artifactService';
import { getModelForUser } from '../services/modelSelectionService';
import { generateAIResponse } from '../services/chatService';
import { ModelFormatter } from '../services/modelFormattingService';
import { toResponse, toResponseArray } from '../utils/responseFormatter';

const router = Router();

/**
 * Create new conversation
 */
router.post('/conversations', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;

    const conversation = await Conversation.create({
      userId: user.rowKey,
      title: 'New Chat',
    });

    res.json({
      success: true,
      conversation: toResponse(conversation),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation',
    });
  }
});

/**
 * List user's conversations
 */
router.get('/conversations', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { starred, archived, projectId } = req.query;

    const conversations = await Conversation.findByUserId(user.rowKey);

    // WHAT THIS DOES: Filter out empty conversations (no messages sent yet)
    // Empty conversations are created when user starts typing but never sends a message
    // They should not appear in the sidebar chat history
    let filteredConversations = conversations.filter(c => (c.messageCount || 0) > 0);

    // Filter based on query params
    if (starred === 'true') {
      filteredConversations = filteredConversations.filter(c => c.starred);
    }
    if (archived === 'true') {
      filteredConversations = filteredConversations.filter(c => c.archived);
    }
    if (projectId) {
      filteredConversations = filteredConversations.filter(c => c.projectId === projectId);
    }

    res.json({
      success: true,
      conversations: toResponseArray(filteredConversations),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
    });
  }
});

/**
 * Get single conversation with messages
 * Uses validateConversation middleware to check conversation exists and belongs to user
 * PERFORMANCE OPTIMIZATION: Supports pagination to prevent large payloads
 */
router.get('/conversations/:id', authenticateJWT as any, validateConversation, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { limit, before } = req.query;

    // Conversation already validated by middleware and attached to req.conversation
    const conversation = req.conversation;

    // PERFORMANCE OPTIMIZATION: Get messages with limit from database
    // Pass limit directly to database query to avoid loading all messages into RAM
    const limitNum = limit ? parseInt(limit as string, 10) : undefined;
    let messages = await Message.findByConversationId(id, limitNum);

    // PERFORMANCE OPTIMIZATION: Apply before pagination if specified
    // This is for "load more" functionality when scrolling up
    if (before && messages.length > 0) {
      const beforeIndex = messages.findIndex(m => m.rowKey === before);
      if (beforeIndex > 0) {
        const startIndex = Math.max(0, beforeIndex - (limitNum || 30));
        messages = messages.slice(startIndex, beforeIndex);
      } else {
        messages = [];
      }
    }

    // PERFORMANCE OPTIMIZATION: Fetch artifact metadata for messages with artifactId
    // This allows frontend to show "View Artifact" buttons without embedding full content
    const artifactMetadataMap = new Map<string, { title: string; type: string }>();
    const messagesWithArtifacts = messages.filter(m => m.artifactId);
    
    if (messagesWithArtifacts.length > 0) {
      // Fetch artifact metadata in parallel
      await Promise.all(
        messagesWithArtifacts.map(async (m) => {
          if (m.artifactId) {
            try {
              const artifact = await Artifact.findById(id, m.artifactId);
              if (artifact) {
                artifactMetadataMap.set(m.artifactId, {
                  title: artifact.title,
                  type: artifact.type,
                });
              }
            } catch (error) {
              console.error(`Failed to fetch artifact ${m.artifactId}:`, error);
            }
          }
        })
      );
    }

    // Group messages by user-assistant pairs and calculate branch metadata
    const messagesWithBranchData = messages.map(m => {
      const branchData: any = {
        role: m.role,
        content: m.content,
        modelName: m.modelName,
        tokenCount: m.tokenCount,
        branchIndex: m.branchIndex || 0,
        parentMessageId: m.parentMessageId,
        messageId: m.rowKey,
        // PERFORMANCE OPTIMIZATION: Don't send heavy data - only flags
        // sources and eventStream can be 5-10MB per message for Deep Research
        // Frontend will fetch these on-demand when user clicks
        hasSourcesCount: m.sources ? m.sources.length : 0,
        hasThinking: m.eventStream && m.eventStream.length > 0,
        artifactId: m.artifactId,
        // PERFORMANCE OPTIMIZATION: Include artifact metadata if available (lazy loading)
        artifactTitle: m.artifactId ? artifactMetadataMap.get(m.artifactId)?.title : undefined,
        artifactType: m.artifactId ? artifactMetadataMap.get(m.artifactId)?.type : undefined,
        createdAt: m.createdAt,
      };

      // If this is an assistant message with a parent, calculate total branches
      if (m.role === 'assistant' && m.parentMessageId) {
        const siblings = messages.filter(
          msg => msg.role === 'assistant' && msg.parentMessageId === m.parentMessageId
        );
        branchData.totalBranches = siblings.length;
      }

      return branchData;
    });

    res.json({
      success: true,
      conversation: {
        ...toResponse(conversation),
        messages: messagesWithBranchData,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation',
    });
  }
});

/**
 * Send message with streaming response
 * Server-Sent Events for real-time streaming
 * Handles file attachments and vision model fallback
 * Uses validateConversationForSSE middleware before setting SSE headers
 */
router.post('/conversations/:id/messages', authenticateJWT as any, validateConversationForSSE, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { content, model, isProSearch, forceArtifact, isDeepResearch, isCreatePPT, pptTemplateId, pptThemeId, attachedFileIds, parentMessageId } = req.body;

    // Conversation already validated by middleware and attached to req.conversation
    const conversation = req.conversation;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get existing messages for context (PERFORMANCE OPTIMIZATION: limit to last 10)
    const existingMessages = await Message.findByConversationId(id, 10);

    // WHAT THIS DOES: Deep Research orchestration - handles two-phase flow
    // Phase 1: Ask clarifying questions | Phase 2: Conduct research with answers
    let customSystemPromptAdditions = '';
    let finalContent = content;
    let forceArtifactForResearch = false;

    if (isDeepResearch && !conversation.deepResearchActive) {
      // PHASE 1: Starting Deep Research - do basic research + ask clarifying questions
      const { CLARIFYING_QUESTIONS_PROMPT } = await import('../prompts/deepResearchPrompts');
      customSystemPromptAdditions = CLARIFYING_QUESTIONS_PROMPT;
      // NO forceArtifact in Phase 1 - AI outputs questions as plain text
      
      // Save state for phase 2
      await Conversation.update(user.rowKey, id, {
        deepResearchActive: true,
        deepResearchPhase: 'questions',
        deepResearchData: JSON.stringify({ originalMessage: content })
      });
    } else if (conversation.deepResearchActive && conversation.deepResearchPhase === 'questions') {
      // PHASE 2: User answered questions - conduct deep research with artifacts
      const { DEEP_RESEARCH_PROMPT } = await import('../prompts/deepResearchPrompts');
      customSystemPromptAdditions = DEEP_RESEARCH_PROMPT;
      forceArtifactForResearch = true; // Force artifact mode for research plan + final document
      
      // Get the AI's questions and user's answers from last 2 messages
      const recentMessages = await Message.findByConversationId(id, 2);
      const data = JSON.parse(conversation.deepResearchData || '{}');
      
      // Combine: original message + AI questions + user answers
      const aiQuestions = recentMessages.length >= 2 ? recentMessages[recentMessages.length - 1].content : '';
      finalContent = `${data.originalMessage}\n\nAI Questions:\n${aiQuestions}\n\nUser Answers:\n${content}`;
      
      // Clear state - research complete after this
      await Conversation.update(user.rowKey, id, {
        deepResearchActive: false,
        deepResearchPhase: undefined,
        deepResearchData: undefined
      });
    }

    // WHAT THIS DOES: PPT Generation orchestration - handles four-phase flow
    // Phase 1: Ask clarifying questions | Phase 2: Generate outline | Phase 3: Template selection | Phase 4: Generate slides
    let forceArtifactForPPT = false;

    if (isCreatePPT && !conversation.pptGenerationActive) {
      // PHASE 1: Starting PPT Generation - ask clarifying questions
      const { PPT_CLARIFYING_QUESTIONS_PROMPT } = await import('../prompts/pptPrompts');
      customSystemPromptAdditions = PPT_CLARIFYING_QUESTIONS_PROMPT;
      // NO forceArtifact in Phase 1 - AI outputs questions as plain text
      
      // Save state for phase 2
      await Conversation.update(user.rowKey, id, {
        pptGenerationActive: true,
        pptGenerationPhase: 'questions',
        pptGenerationData: JSON.stringify({ originalMessage: content })
      });
    } else if (conversation.pptGenerationActive && conversation.pptGenerationPhase === 'questions') {
      // PHASE 2: User answered questions - generate outline
      const { PPT_OUTLINE_GENERATION_PROMPT } = await import('../prompts/pptPrompts');
      customSystemPromptAdditions = PPT_OUTLINE_GENERATION_PROMPT;
      // NO forceArtifact in Phase 2 - AI outputs outline as plain text
      
      // Get the AI's questions and user's answers from last 2 messages
      const recentMessages = await Message.findByConversationId(id, 2);
      const data = JSON.parse(conversation.pptGenerationData || '{}');
      
      // Combine: original message + AI questions + user answers
      const aiQuestions = recentMessages.length >= 2 ? recentMessages[recentMessages.length - 1].content : '';
      finalContent = `${data.originalMessage}\n\nAI Questions:\n${aiQuestions}\n\nUser Answers:\n${content}`;
      
      // Update state to outline phase
      await Conversation.update(user.rowKey, id, {
        pptGenerationPhase: 'outline',
        pptGenerationData: JSON.stringify({ 
          originalMessage: data.originalMessage, 
          questions: aiQuestions, 
          answers: content 
        })
      });
    } else if (conversation.pptGenerationActive && conversation.pptGenerationPhase === 'outline') {
      // PHASE 3: User reviewed outline - trigger template selection
      // Send SSE event to frontend to show template picker
      res.write(`event: ppt_template_select_required\ndata: ${JSON.stringify({ message: 'Please select a template and theme' })}\n\n`);
      
      // Update state to template_select phase
      const data = JSON.parse(conversation.pptGenerationData || '{}');
      await Conversation.update(user.rowKey, id, {
        pptGenerationPhase: 'template_select',
        pptGenerationData: JSON.stringify({ 
          ...data,
          outline: content 
        })
      });
      
      // Don't generate AI response yet - wait for template selection
      res.write(`event: done\ndata: {}\n\n`);
      res.end();
      return;
    } else if (conversation.pptGenerationActive && conversation.pptGenerationPhase === 'template_select' && pptTemplateId && pptThemeId) {
      // PHASE 4: User selected template - generate slides with artifacts
      const { PPT_SLIDE_GENERATION_PROMPT } = await import('../prompts/pptPrompts');
      customSystemPromptAdditions = PPT_SLIDE_GENERATION_PROMPT;
      forceArtifactForPPT = true; // Force artifact mode for presentation
      
      // Get all the accumulated data
      const data = JSON.parse(conversation.pptGenerationData || '{}');
      
      // Combine everything: original message + questions + answers + outline + template info
      finalContent = `${data.originalMessage}\n\nAI Questions:\n${data.questions}\n\nUser Answers:\n${data.answers}\n\nOutline:\n${data.outline}\n\nTemplate: ${pptTemplateId}\nTheme: ${pptThemeId}`;
      
      // Clear state - PPT generation complete after this
      await Conversation.update(user.rowKey, id, {
        pptGenerationActive: false,
        pptGenerationPhase: undefined,
        pptGenerationData: undefined
      });
    }

    // Save user message with attached file IDs
    const userMessageRecord = await Message.create({
      conversationId: id,
      role: 'user',
      content: finalContent,
      modelName: model || 'auto',
      tokenCount: 0,
      branchIndex: 0,
      parentMessageId: parentMessageId || undefined,
      attachedFiles: attachedFileIds ? attachedFileIds.map((fileId: string) => ({ 
        id: fileId, 
        name: '', 
        type: 'text',
        size: 0 
      })) : undefined,
    });

    // Call the shared AI response generation service
    await generateAIResponse(res, {
      user,
      conversation,
          conversationId: id,
      userMessageContent: finalContent,
      userMessageRecord,
      model,
      isProSearch: isProSearch || false,
      forceArtifact: forceArtifact || forceArtifactForResearch || forceArtifactForPPT,
      attachedFileIds,
      existingMessages,
      parentMessageId,
      content: finalContent,
      customSystemPromptAdditions
              });
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
    });
  }
});

/**
 * Regenerate message (creates branch)
 * Supports: "Try again", "Add details", "More concise", "Search the web"
 * Uses validateConversationForSSE middleware before setting SSE headers
 */
router.post('/conversations/:id/regenerate/:messageIndex', authenticateJWT as any, validateConversationForSSE, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { id, messageIndex } = req.params;
    const { model, directive } = req.body; // directive: "try_again" | "add_details" | "more_concise" | "search_web"

    // Conversation already validated by middleware and attached to req.conversation
    const conversation = req.conversation;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const index = parseInt(messageIndex);
    // PERFORMANCE OPTIMIZATION: Load only messages up to index + buffer (not all 1000 messages)
    const loadLimit = Math.max(50, index + 20);
    let allMessages = await Message.findByConversationId(id, loadLimit);

    if (index >= allMessages.length || index < 0) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Invalid message index' })}\n\n`);
      res.end();
      return;
    }

    // The assistant message to regenerate
    const targetAssistantMessage = allMessages[index];
    
    if (targetAssistantMessage.role !== 'assistant') {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Target message is not an assistant message' })}\n\n`);
      res.end();
      return;
    }

    // Find the user message using parentMessageId
    if (!targetAssistantMessage.parentMessageId) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Assistant message has no parentMessageId' })}\n\n`);
      res.end();
      return;
    }

    const userMessage = allMessages.find(msg => msg.rowKey === targetAssistantMessage.parentMessageId);
    
    if (!userMessage || userMessage.role !== 'user') {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Could not find user message' })}\n\n`);
      res.end();
      return;
    }

    // Calculate the next branch index for this user message
    const existingBranches = allMessages.filter(
      (msg) => msg.role === 'assistant' && msg.parentMessageId === userMessage.rowKey
    );
    const nextBranchIndex = existingBranches.length;

    // Determine if this is a Pro Search regeneration
    const isProSearchRegenerate = directive === 'web_search' || false; // Check if original message had Pro Search

    // Remove descendant messages that belonged to the previous assistant branch
    const targetMessageId = targetAssistantMessage.rowKey;
    const descendantQueue = [targetMessageId];
    const descendantIds: string[] = [];
    const descendantMessages: typeof allMessages = [];

    while (descendantQueue.length > 0) {
      const currentId = descendantQueue.shift();
      if (!currentId) {
        continue;
      }

      const children = allMessages.filter(
        (msg) => msg.parentMessageId === currentId
      );

      for (const child of children) {
        descendantIds.push(child.rowKey);
        descendantMessages.push(child);
        descendantQueue.push(child.rowKey);
      }
    }

    if (descendantIds.length > 0) {
      for (const descendantId of descendantIds) {
        await Message.delete(id, descendantId);
      }

      allMessages = allMessages.filter((msg) => !descendantIds.includes(msg.rowKey));

      const descendantUserIds = descendantMessages
        .filter((msg) => msg.role === 'user')
        .map((msg) => msg.rowKey);

      if (descendantUserIds.length > 0) {
        res.write(
          `data: ${JSON.stringify({
            type: 'pruned_descendants',
            parentMessageId: userMessage.rowKey,
            removedUserMessageIds: descendantUserIds,
          })}\n\n`
        );
      }
    }

    // Build custom system prompt additions for regenerate directives
    let customSystemPromptAdditions = '';
    
    // Add rejected response context
    customSystemPromptAdditions += `\n\n[Previous Response (Rejected by User)]:\n${targetAssistantMessage.content}`;
    
    // Add directive-specific instructions
    switch (directive) {
      case 'try_again':
        customSystemPromptAdditions += '\n\nThe user rejected your previous answer. Please provide a different response.';
        break;
      case 'add_details':
        customSystemPromptAdditions += '\n\nThe user rejected your previous answer. Please revise it with more detail and depth.';
        break;
      case 'more_concise':
        customSystemPromptAdditions += '\n\nThe user rejected your previous answer. Please rewrite it to be more concise.';
        break;
      case 'search_web':
        customSystemPromptAdditions += '\n\nThe user rejected your previous answer. You MUST perform a mandatory web search before responding and incorporate the findings.';
        customSystemPromptAdditions += '\n\nYou MUST use the search_web tool to find current information before responding.';
        break;
      default:
        customSystemPromptAdditions += '\n\nThe user rejected your previous answer. Please provide a different response.';
    }

    // Get existing messages up to (but not including) the rejected assistant message
    const userMessageIndex = allMessages.findIndex(msg => msg.rowKey === userMessage.rowKey);
    const existingMessagesForContext = allMessages.slice(0, userMessageIndex + 1);

    // Call the shared AI response generation service
    await generateAIResponse(res, {
      user,
      conversation,
          conversationId: id,
      userMessageContent: userMessage.content,
      userMessageRecord: userMessage,
      model,
      isProSearch: isProSearchRegenerate,
      attachedFileIds: userMessage.attachedFiles?.map((f: any) => f.id),
      existingMessages: existingMessagesForContext,
          parentMessageId: userMessage.rowKey,
      content: userMessage.content,
      customSystemPromptAdditions
    });
  } catch (error: any) {
    console.error('Regenerate error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

/**
 * Edit user message (creates prompt branch)
 * Creates a new user branch with edited content and streams new assistant response
 * Uses validateConversationForSSE middleware before setting SSE headers
 */
router.post('/conversations/:id/edit-message/:messageId', authenticateJWT as any, validateConversationForSSE, async (req: any, res: Response) => {
            try {
    const user = req.user;
    const { id, messageId } = req.params;
    const { content, model, isProSearch } = req.body;

    // Conversation already validated by middleware and attached to req.conversation
    const conversation = req.conversation;

    // Set up SSE headers for real-time streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get all messages in this conversation (PERFORMANCE OPTIMIZATION: limit to 100 for branch traversal)
    const allMessages = await Message.findByConversationId(id, 100);
        
    // Find the original message being edited
    const originalMessage = allMessages.find((m) => m.rowKey === messageId);

    if (!originalMessage || originalMessage.role !== 'user') {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'User message not found' })}\n\n`);
      res.end();
              return;
            }

    // Calculate branch information
    const parentId = originalMessage.parentMessageId || 'root';

    // Count existing sibling branches to determine the next branch index
    const siblingUserBranches = allMessages.filter((m) => {
      const branchParent = m.parentMessageId || 'root';
      return m.role === 'user' && branchParent === parentId;
    });
            
    const nextBranchIndex = siblingUserBranches.length;

    // Create new user message as a branch
    const newUserMessage = await Message.create({
              conversationId: id,
      role: 'user',
      content,
      modelName: '',
      tokenCount: 0,
              branchIndex: nextBranchIndex,
      parentMessageId: parentId === 'root' ? undefined : parentId,
            });

    // Notify frontend that user branch was created
    res.write(`data: ${JSON.stringify({
      type: 'user_branch_created',
      userMessage: {
        role: 'user',
        content,
        messageId: newUserMessage.rowKey,
        parentMessageId: parentId === 'root' ? undefined : parentId,
                  branchIndex: nextBranchIndex,
                },
                branchMetadata: {
                  currentBranchIndex: nextBranchIndex,
        totalBranches: nextBranchIndex + 1,
        parentMessageId: parentId,
      },
    })}\n\n`);

    // ========== BUILD BRANCH-AWARE CONTEXT ==========
    // This section is UNIQUE to edit-message endpoint
    // It traverses the conversation tree to build context from only the active branch path
    
    let branchContext: any[] = [];
    const branchParentId = originalMessage.parentMessageId;

    if (branchParentId) {
      // Find messages in the active branch path leading to the edited message
      const branchParentMessage = allMessages.find((msg) => msg.rowKey === branchParentId);
      
      if (branchParentMessage) {
        const editIndex = allMessages.indexOf(originalMessage);
        
        // Filter messages that belong to the active branch path
        branchContext = allMessages.filter((msg) => {
          const msgIndex = allMessages.indexOf(msg);
          
          // Don't include the edited message or anything after it
          if (msgIndex >= editIndex) return false;
          
          // Include the branch parent
          if (msg.rowKey === branchParentMessage.rowKey) return true;
          
          // Include direct children of branch parent
          if (msg.parentMessageId === branchParentMessage.rowKey) return true;
          
          // Walk up the tree to see if this message is in the branch path
          let currentParent = msg.parentMessageId;
          while (currentParent) {
            if (currentParent === branchParentMessage.rowKey) return true;
            const parentMsg = allMessages.find((m) => m.rowKey === currentParent);
            if (!parentMsg) break;
            currentParent = parentMsg.parentMessageId;
          }
          return false;
        });
      }
    } else {
      // Root-level edit: include all messages before the edited one
      const editIndex = allMessages.indexOf(originalMessage);
      branchContext = allMessages.slice(0, editIndex);
    }

    // Apply context window (last 5 messages from branch)
    const contextWindowSize = 5;
    const recentMessages = branchContext.slice(Math.max(0, branchContext.length - contextWindowSize));

    // ========== CALL SHARED AI GENERATION SERVICE ==========
    // Use the centralized chatService to generate AI response
    // This replaces 564 lines of duplicated code with shared logic
    await generateAIResponse(res, {
      user,
      conversation,
      conversationId: id,
      userMessageContent: content,
      userMessageRecord: newUserMessage,
      model,
      isProSearch: isProSearch || false,
      attachedFileIds: undefined,
      existingMessages: allMessages, // For title generation
      parentMessageId: newUserMessage.rowKey,
      content,
      
      // EDIT-MESSAGE SPECIFIC FIELDS:
      skipContextBuilding: true,         // Use our pre-built branch-aware context instead
      branchAwareContext: recentMessages, // Context from the active branch path
      branchMetadata: {                   // Include branch info in completion event for frontend
        parentMessageId: parentId,
        currentBranchIndex: nextBranchIndex,
        newUserMessageId: newUserMessage.rowKey,
        totalBranches: nextBranchIndex + 1,
      },
    });
  } catch (error: any) {
    console.error('Edit message error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Failed to edit message' })}\n\n`);
    res.end();
  }
});

/**
 * Save draft text for conversation or new chat
 * WHAT THIS DOES: Saves draft text in real-time as user types
 * For existing conversations: saves to conversation.draftText
 * For new chat (id='new'): saves to user.newChatDraft
 * IMPORTANT: This route must come BEFORE the general PATCH /conversations/:id route
 * so Express matches the more specific /draft path first
 */
router.patch('/conversations/:id/draft', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { draftText } = req.body;

    // WHAT THIS DOES: Handle special 'new' conversation ID for new chat drafts
    // Store draft in user-level storage, not as a conversation record
    if (id === 'new') {
      await User.update(user.rowKey, { newChatDraft: draftText || '' });
      res.json({
        success: true,
        message: 'Draft saved',
      });
      return;
    }

    // WHAT THIS DOES: For existing conversations, save draft to conversation
    const conversation = await Conversation.findById(user.rowKey, id);
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }

    await Conversation.update(user.rowKey, id, { draftText: draftText || '' });

    res.json({
      success: true,
      message: 'Draft saved',
    });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save draft',
    });
  }
});

/**
 * Update conversation (rename, star, archive)
 * Uses validateConversation middleware to check conversation exists and belongs to user
 */
router.patch('/conversations/:id', authenticateJWT as any, validateConversation, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { title, starred, archived, projectId } = req.body;

    // Conversation already validated by middleware and attached to req.conversation
    const conversation = req.conversation;

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (starred !== undefined) updates.starred = starred;
    if (archived !== undefined) updates.archived = archived;
    if (projectId !== undefined) updates.projectId = projectId;

    const updatedConversation = await Conversation.update(user.rowKey, id, updates);

    res.json({
      success: true,
      conversation: toResponse(updatedConversation!),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update conversation',
    });
  }
});

/**
 * Delete conversation
 */
router.delete('/conversations/:id', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const conversation = await Conversation.findById(user.rowKey, id);

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }

    // Delete the conversation
    await Conversation.delete(user.rowKey, id);

    // Delete all messages in this conversation
    await Message.deleteByConversationId(id);

    // Delete all artifacts in this conversation
    await Artifact.deleteByConversationId(id);

    res.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation',
    });
  }
});

/**
 * Get available models for user's tier
 * Returns models with limited information (user mode - no API key data)
 */
router.get('/models', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;

    const models = await Model.findByTier(user.tier);

    // Use ModelFormatter to enrich models with provider info (user mode - no API key)
    const modelsWithProvider = await ModelFormatter.formatModels(models, 'user');

    res.json({
      success: true,
      models: modelsWithProvider,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch models',
    });
  }
});

/**
 * Get sources for a specific message (on-demand fetching)
 * PERFORMANCE OPTIMIZATION: Sources not loaded upfront, fetched when user clicks
 */
router.get('/messages/:messageId/sources', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { messageId } = req.params;
    const { conversationId } = req.query;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'conversationId query parameter required',
      });
      return;
    }

    // Verify conversation ownership
    const conversation = await Conversation.findById(user.rowKey, conversationId as string);
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }

    // Get the specific message directly by ID (PERFORMANCE OPTIMIZATION: avoid loading all messages)
    const message = await Message.findById(conversationId as string, messageId);

    if (!message) {
      res.status(404).json({
        success: false,
        error: 'Message not found',
      });
      return;
    }

    res.json({
      success: true,
      sources: message.sources || [],
    });
  } catch (error) {
    console.error('Get message sources error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch message sources',
    });
  }
});

/**
 * Get eventStream (thinking steps) for a specific message (on-demand fetching)
 * PERFORMANCE OPTIMIZATION: EventStream not loaded upfront, fetched when user expands thinking
 */
router.get('/messages/:messageId/thinking', authenticateJWT as any, async (req: any, res: Response) => {
  try {
    const user = req.user;
    const { messageId } = req.params;
    const { conversationId } = req.query;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'conversationId query parameter required',
      });
      return;
    }

    // Verify conversation ownership
    const conversation = await Conversation.findById(user.rowKey, conversationId as string);
    if (!conversation) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }

    // Get the specific message directly by ID (PERFORMANCE OPTIMIZATION: avoid loading all messages)
    const message = await Message.findById(conversationId as string, messageId);

    if (!message) {
      res.status(404).json({
        success: false,
        error: 'Message not found',
      });
      return;
    }

    res.json({
      success: true,
      eventStream: message.eventStream || [],
    });
  } catch (error) {
    console.error('Get message thinking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch message thinking',
    });
  }
});

export default router;
