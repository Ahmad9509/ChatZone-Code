// Chat service - Reusable AI response generation logic
// This service handles model selection, context building, system prompts,
// tool calling, streaming, citation extraction, and message persistence
// Used by: /messages, /regenerate, /edit-message endpoints

import { Response } from 'express';
import { User, Model, Message, Conversation, SystemPrompt, Project, Artifact, TierConfig } from '../models';
import { searchDocuments, buildContextWithFiles, storeConversationChunk } from './ragService';
import { streamChatCompletion, generateChatTitle } from './aiService';
import { searchWeb } from './serperService';
import { parseArtifacts, stripArtifactTags, detectArtifactStart, detectArtifactEnd, ArtifactMeta, streamArtifact, saveArtifact } from './artifactService';
import { detectThinkingStart, detectThinkingEnd, detectOrphanClosing } from './thinkingService';
import { getModelForUser } from './modelSelectionService';

/**
 * Configuration for generating an AI response
 * This is passed from each endpoint with their specific context
 */
export interface ChatGenerationConfig {
  user: any;                          // Authenticated user object
  conversation: any;                  // Conversation entity
  conversationId: string;             // Conversation ID
  userMessageContent: string;         // The user's message text to respond to
  userMessageRecord: any;             // The saved user message entity (for parentMessageId linking)
  model?: string;                     // Optional model override from user selection
  isProSearch: boolean;               // Pro Search mode enabled
  forceArtifact?: boolean;            // Force artifact mode (Create Doc button)
  attachedFileIds?: string[];         // Attached file IDs
  existingMessages: any[];            // All existing messages in conversation (for title generation)
  parentMessageId?: string;           // For branching - which message to branch from
  content: string;                    // Original user content (for title generation)
  customSystemPromptAdditions?: string; // Optional additional system prompt content (for regenerate directives)
  
  // Fields for edit-message endpoint support
  branchAwareContext?: any[];         // Pre-built context from branch traversal (edit-message only)
  skipContextBuilding?: boolean;      // If true, use branchAwareContext instead of building from existingMessages
  branchMetadata?: {                  // Metadata to include in complete event (edit-message only)
    parentMessageId: string;
    currentBranchIndex: number;
    newUserMessageId: string;
    totalBranches?: number;
  };
}

/**
 * Generates an AI response and streams it via SSE
 * 
 * This function handles ALL the shared logic across chat endpoints:
 * - Model selection with Pro Search auto-switch
 * - Context building (project instructions, RAG, file attachments)
 * - System prompt assembly (master, artifact, pro search)
 * - Tool calling (search_web)
 * - SSE streaming with artifact detection
 * - Citation extraction and storage
 * - Message persistence
 * - User stats updates
 * - Conversation updates
 * 
 * @param res - Express Response object (SSE stream must already be set up)
 * @param config - Configuration object with all necessary context
 */
export async function generateAIResponse(
  res: Response,
  config: ChatGenerationConfig
): Promise<void> {
  const {
    user,
    conversation,
    conversationId,
    userMessageContent,
    userMessageRecord,
    model,
    isProSearch,
    forceArtifact,
    attachedFileIds,
    existingMessages,
    parentMessageId,
    content,
    customSystemPromptAdditions,
    // New fields for edit-message support
    branchAwareContext,
    skipContextBuilding,
    branchMetadata
  } = config;

  try {
    // ========== MODEL SELECTION ==========
    // Use smart auto-rotation or user's explicit choice
    let modelResult;
    try {
      modelResult = await getModelForUser(user, model, conversation);
    } catch (error: any) {
      // WHAT THIS DOES: Clean up empty conversation if no assistant message was saved
      // This prevents storing conversations with only user messages (empty chats)
      try {
        const messages = await Message.findByConversationId(conversationId, 1);
        const hasAssistantMessage = messages.some(m => m.role === 'assistant');
        
        if (!hasAssistantMessage) {
          // No assistant message was saved - delete the conversation and user message
          console.log(`🧹 Cleaning up empty conversation ${conversationId} due to model selection error`);
          await Message.deleteByConversationId(conversationId);
          await Conversation.delete(user.rowKey, conversationId);
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup empty conversation:', cleanupError);
        // Don't fail the error response if cleanup fails
      }
      
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
      return;
    }

    let modelRowKey = modelResult.modelRowKey;
    let providerApiModelId = modelResult.providerApiModelId;
    let useVisionModel = false;
    let originalModelId = providerApiModelId;
    let switchedToThinkingModel = false;
    let switchedModelDisplayName = '';

    // ========== PRO SEARCH AUTO-SWITCH LOGIC ==========
    // If Pro Search is enabled and the selected model is NOT a thinking model,
    // try to auto-switch to the tier's default Pro Search thinking model
    if (isProSearch && !modelResult.model.isThinking) {
      const tierConfig = await TierConfig.findByTierName(user.tier);
      
      if (tierConfig?.defaultProSearchModelId) {
        const thinkingModel = await Model.findById(tierConfig.defaultProSearchModelId);
        
        if (thinkingModel && thinkingModel.isActive && thinkingModel.isThinking) {
          console.log(`🧠 Pro Search: Auto-switching from ${modelResult.model.displayName} (non-thinking) to ${thinkingModel.displayName} (thinking)`);
          
          providerApiModelId = thinkingModel.modelId;
          modelRowKey = thinkingModel.rowKey;
          switchedToThinkingModel = true;
          switchedModelDisplayName = thinkingModel.displayName;
          
          // Update conversation's current model so it persists
          conversation.currentModel = thinkingModel.rowKey;
        } else {
          console.warn(`⚠️ Pro Search: Configured thinking model not found/inactive for tier ${user.tier}`);
        }
      } else {
        console.warn(`⚠️ Pro Search: No default thinking model configured for tier ${user.tier}`);
      }
    }
    // ===================================================

    // ========== CONTEXT BUILDING ==========
    let projectInstructions = '';
    let projectDocumentChunks: any[] = [];

    if (conversation.projectId) {
      const project = await Project.findById(user.rowKey, conversation.projectId);
      if (project?.customInstructions) {
        projectInstructions = project.customInstructions;
      }

      const ragResults = await searchDocuments(user.rowKey, userMessageContent, 5, conversation.projectId);
      projectDocumentChunks = ragResults;
      console.log(`📚 Loaded ${ragResults.length} RAG results for project ${conversation.projectId}`);
      
      // Log what types were loaded
      const conversationCount = ragResults.filter((r: any) => r.metadata?.fileType === 'conversation').length;
      const documentCount = ragResults.filter((r: any) => r.metadata?.fileType !== 'conversation').length;
      console.log(`   - ${conversationCount} conversation excerpts`);
      console.log(`   - ${documentCount} document chunks`);
    }

    // Collect file content from attached files
    let fileContentContext = '';
    let hasImages = false;

    if (attachedFileIds && attachedFileIds.length > 0) {
      // In production, fetch file content from database/blob storage
      // For now, we'll note that file content should be passed with the request
      // This would typically come from the file upload endpoint response
      fileContentContext = `[Files attached: ${attachedFileIds.length} file(s) in conversation context]\n`;
    }

    // Check if should use vision model for images
    if (hasImages && !providerApiModelId.includes('vision') && !providerApiModelId.includes('4v')) {
      // Get default vision model for tier from admin config
      // For now, fallback to gpt-4-vision
      providerApiModelId = 'gpt-4-vision';
      useVisionModel = true;
    }

    // ========== MESSAGE HISTORY FOR CONTEXT ==========
    // For edit-message: use pre-built branch-aware context if provided
    // For other endpoints: build context from conversation messages
    let recentMessages: any[];
    
    if (skipContextBuilding && branchAwareContext) {
      // Edit-message provides pre-built context from branch traversal
      recentMessages = branchAwareContext;
    } else {
      // Standard context building for /messages and /regenerate endpoints
      // Get all conversation messages for context (last N messages for memory window)
      const allMessages = await Message.findByConversationId(conversationId, 10);

      // Determine context messages based on branch if parentMessageId provided
      let branchContext: any[] = [];
      if (parentMessageId) {
        // Find the parent user message and traverse only messages linked to this branch
        const parentUserMessage = allMessages.find((msg) => msg.rowKey === parentMessageId);
        if (!parentUserMessage) {
          res.write(`data: ${JSON.stringify({ type: 'error', error: 'Parent message not found' })}\n\n`);
          res.end();
          return;
        }

        branchContext = allMessages.filter((msg) => {
          if (msg.rowKey === parentUserMessage.rowKey) return true;
          if (msg.parentMessageId === parentUserMessage.rowKey) return true;
          // Include follow-up messages chained off prior branch nodes
          let currentParent = msg.parentMessageId;
          while (currentParent) {
            if (currentParent === parentUserMessage.rowKey) return true;
            const parentMsg = allMessages.find((m) => m.rowKey === currentParent);
            if (!parentMsg) break;
            currentParent = parentMsg.parentMessageId;
          }
          return false;
        });
      } else {
        branchContext = allMessages;
      }

      const contextWindowSize = 5; // Configurable from admin panel
      recentMessages = branchContext.slice(Math.max(0, branchContext.length - contextWindowSize));
    }
    
    // Build messages with file context
    const messages = recentMessages.map((msg: any) => {
      let msgContent = msg.content;
      
      // Add file content if attached to this message
      // attachedFiles is already deserialized by Message model
      if (msg.attachedFiles && Array.isArray(msg.attachedFiles)) {
        const fileTexts = msg.attachedFiles
          .filter((f: any) => f.type === 'text' && f.content)
          .map((f: any) => `[File: ${f.name}]\n${f.content}`)
          .join('\n\n');
        
        if (fileTexts) {
          msgContent = `${msgContent}\n\n${fileTexts}`;
        }
      }
      
      return {
        role: msg.role,
        content: msgContent,
      };
    });

    // ========== SYSTEM PROMPT ASSEMBLY ==========
    // Load system prompt - ALWAYS load master first
    const masterPromptRecord = await SystemPrompt.findByType('master');
    let systemPromptContent = masterPromptRecord?.content || 
      `You are ChatZone, a helpful AI assistant. Provide clear, accurate, and friendly responses to user queries.`;
    
    // Load and append artifact instructions
    // Skip if "answer_in_chat" directive is present, or include if forceArtifact is true
    const shouldIncludeArtifact = customSystemPromptAdditions !== 'answer_in_chat' || forceArtifact;
    if (shouldIncludeArtifact) {
    const artifactPromptRecord = await SystemPrompt.findByType('artifact');
    if (artifactPromptRecord?.content) {
      systemPromptContent += artifactPromptRecord.content;
      }
    }
    
    // If forceArtifact is true, add mandatory artifact creation instruction
    if (forceArtifact) {
      systemPromptContent += `\n\n**MANDATORY ARTIFACT MODE ACTIVE**: You MUST use the create_artifact function to respond to this query. The user has explicitly requested artifact output. 

**Artifact Type Guidelines**:
- For presentations or slide decks → Use type: "presentation" and create HTML with multiple slides
- For documents or long-form text → Use type: "markdown" 
- For web pages or interfaces → Use type: "html"
- For code/scripts → Use type: "code" with appropriate language
- For diagrams → Use type: "mermaid" or "svg"

Call create_artifact with the appropriate type, title, and content. You may provide a brief introduction (1-2 sentences) before calling the function, but the main deliverable MUST be an artifact. Do not provide a full conversational response without creating an artifact.

**For Presentations**: When creating a presentation artifact, structure the HTML with multiple <div class="slide"> elements, each containing one slide. Include embedded CSS for professional styling with gradients, proper typography, and visual hierarchy.`;
    }
    
    if (projectInstructions) {
      systemPromptContent += `\n\n## Project Instructions\n${projectInstructions}`;
    }

    if (projectDocumentChunks.length > 0) {
      systemPromptContent = buildContextWithFiles(
        [],
        projectDocumentChunks,
        systemPromptContent,
      );
    }

    // If ProSearch enabled, APPEND ProSearch instructions
    if (isProSearch) {
      const proSearchPromptRecord = await SystemPrompt.findByType('proSearch');
      const proSearchInstructions = proSearchPromptRecord?.content || 
        `\n\nENHANCED SEARCH MODE: You have access to the search_web tool. Use it to find current, accurate information. Perform multiple searches if needed. Always cite sources using [1], [2], etc. format.`;
      
      systemPromptContent += proSearchInstructions;
    }

    // Add custom system prompt additions (for regenerate directives, etc.)
    if (customSystemPromptAdditions) {
      systemPromptContent += customSystemPromptAdditions;
    }

    // Add file context to system prompt
    if (fileContentContext) {
      systemPromptContent += `\n\n${fileContentContext}`;
    }

    // Prepend system prompt
    messages.unshift({
      role: 'system',
      content: systemPromptContent,
    });

    // Add user message with file context
    let finalUserMessageContent = userMessageContent;
    if (fileContentContext) {
      finalUserMessageContent += `\n\n${fileContentContext}`;
    }

    messages.push({
      role: 'user',
      content: finalUserMessageContent,
    });

    // ========== NOTIFY FRONTEND OF MODEL SWITCH ==========
    // Notify frontend if model was auto-switched for Pro Search
    if (switchedToThinkingModel) {
      res.write(`data: ${JSON.stringify({ 
        type: 'model_switched', 
        modelId: modelRowKey,
        modelName: switchedModelDisplayName,
        message: `Pro Search works best with thinking models - switched to ${switchedModelDisplayName}` 
      })}\n\n`);
    }

    // ========== STREAMING STATE ==========
    let fullResponse = '';
    let totalTokens = 0;
    let citations: any[] = [];
    // WHAT THIS DOES: Collect all events (thinking, tool calls, content chunks) for persistence
    // This allows the thinking UI to be restored when user returns to previous sessions
    const eventStream: any[] = [];

    // Define tools: search_web and create_artifact
    const tools = [{
      type: 'function',
      function: {
        name: 'search_web',
        description: 'Search the web for current information using Google search. YOU have full control over search depth.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to execute'
            },
            num_results: {
              type: 'number',
              description: 'Number of search results to return (5-100). YOU control the depth: use 5-10 for quick facts, 20-40 for standard research, 50-100 for comprehensive analysis. Choose based on query complexity.',
              default: 10
            }
          },
          required: ['query']
        }
      }
    }, {
      type: 'function',
      function: {
        name: 'create_artifact',
        description: 'Create a structured artifact (document, code, HTML page, diagram, data) that will be rendered in a separate panel. Use this for any substantial, structured, or reusable content that the user can save, edit, or reuse.',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['html', 'code', 'svg', 'markdown', 'react', 'vue', 'json', 'csv', 'mermaid', 'presentation'],
              description: 'The type of artifact to create. Use "presentation" for slide-based HTML presentations.'
            },
            title: {
              type: 'string',
              description: 'A descriptive title for the artifact (e.g., "Landing Page", "Data Parser Script", "Logo Design")'
            },
            language: {
              type: 'string',
              description: 'Programming language for code artifacts (e.g., "python", "javascript", "typescript", "html", "css")'
            },
            content: {
              type: 'string',
              description: 'The complete content of the artifact'
            }
          },
          required: ['type', 'title', 'content']
        }
      }
    }];

    // Thinking streaming state variables
    // These handle <think>...</think> tags from reasoning models
    let isStreamingThinking = false;
    let thinkingBuffer = '';
    
    // Artifact streaming state variables
    let isStreamingArtifact = false;
    let artifactBuffer = '';
    let currentArtifactMeta: ArtifactMeta | null = null;
    let textBeforeArtifact = '';
    let chunksSentToChat = 0;

    // ========== AI GENERATION & STREAMING ==========
    // Stream AI response with tool calling support
    await streamChatCompletion(
      providerApiModelId,
      messages,
      (chunk) => {
        fullResponse += chunk;
        
        // ========== PRIORITY 1: THINKING TAG DETECTION ==========
        // Handle active thinking stream (already inside <think>...</think>)
        if (isStreamingThinking) {
          thinkingBuffer += chunk;
          
          // Check if closing </think> tag appears
          const thinkingEnd = detectThinkingEnd(thinkingBuffer);
          
          if (thinkingEnd.found) {
            // Thinking block complete!
            // Send final thinking chunk (content before </think>)
            if (thinkingEnd.contentBeforeTag) {
              res.write(`data: ${JSON.stringify({
                type: 'thinking_chunk',
                content: thinkingEnd.contentBeforeTag
              })}\n\n`);
              
              // WHAT THIS DOES: Add thinking_chunk event to eventStream for persistence
              eventStream.push({
                timestamp: Date.now(),
                eventType: 'thinking_chunk',
                data: { thinkingContent: thinkingEnd.contentBeforeTag }
              });
            }
            
            // Send thinking_end event
            res.write(`data: ${JSON.stringify({
              type: 'thinking_end',
              endedByStream: false
            })}\n\n`);
            
            // WHAT THIS DOES: Add thinking_end event to eventStream for persistence
            eventStream.push({
              timestamp: Date.now(),
              eventType: 'thinking_end',
              data: { endedByStream: false }
            });
            
            // Reset thinking state
            isStreamingThinking = false;
            thinkingBuffer = '';
            chunksSentToChat = fullResponse.length;
            
            // Continue with text after </think> (could be regular content or artifacts)
            if (thinkingEnd.contentAfterTag) {
              res.write(`data: ${JSON.stringify({
                type: 'chunk',
                content: thinkingEnd.contentAfterTag
              })}\n\n`);
              
              // WHAT THIS DOES: Add content_chunk event to eventStream for persistence
              eventStream.push({
                timestamp: Date.now(),
                eventType: 'content_chunk',
                data: { content: thinkingEnd.contentAfterTag }
              });
            }
          } else {
            // Still inside thinking block, stream chunk to thinking panel
            res.write(`data: ${JSON.stringify({
              type: 'thinking_chunk',
              content: chunk
            })}\n\n`);
            
            // WHAT THIS DOES: Add thinking_chunk event to eventStream for persistence
            eventStream.push({
              timestamp: Date.now(),
              eventType: 'thinking_chunk',
              data: { thinkingContent: chunk }
            });
          }
          
          return; // Exit early - don't process artifacts when in thinking mode
        }
        
        // Check for orphan closing tag (</think> without opening <think>)
        // This handles edge case where model emits reasoning without opening tag
        if (!isStreamingThinking && !isStreamingArtifact) {
          const orphanClosing = detectOrphanClosing(fullResponse);
          
          if (orphanClosing.found) {
            // Found orphan </think> - treat preceding content as reasoning
            const reasoningContent = orphanClosing.contentBefore || '';
            
            // Send synthetic thinking_start (inferred)
            res.write(`data: ${JSON.stringify({
              type: 'thinking_start',
              inferredStart: true
            })}\n\n`);
            
            // WHAT THIS DOES: Add thinking_start event to eventStream for persistence
            eventStream.push({
              timestamp: Date.now(),
              eventType: 'thinking_start',
              data: { inferredStart: true }
            });
            
            // Send the reasoning content
            if (reasoningContent) {
              res.write(`data: ${JSON.stringify({
                type: 'thinking_chunk',
                content: reasoningContent
              })}\n\n`);
              
              // WHAT THIS DOES: Add thinking_chunk event to eventStream for persistence
              eventStream.push({
                timestamp: Date.now(),
                eventType: 'thinking_chunk',
                data: { thinkingContent: reasoningContent }
              });
            }
            
            // Immediately send thinking_end
            res.write(`data: ${JSON.stringify({
              type: 'thinking_end',
              endedByStream: false,
              inferredStart: true
            })}\n\n`);
            
            // WHAT THIS DOES: Add thinking_end event to eventStream for persistence
            eventStream.push({
              timestamp: Date.now(),
              eventType: 'thinking_end',
              data: { endedByStream: false, inferredStart: true }
            });
            
            chunksSentToChat = fullResponse.length;
            
            // Continue with text after orphan </think>
            if (orphanClosing.contentAfter) {
              res.write(`data: ${JSON.stringify({
                type: 'chunk',
                content: orphanClosing.contentAfter
              })}\n\n`);
              
              // WHAT THIS DOES: Add content_chunk event to eventStream for persistence
              eventStream.push({
                timestamp: Date.now(),
                eventType: 'content_chunk',
                data: { content: orphanClosing.contentAfter }
              });
            }
            
            return; // Exit early - orphan handled
          }
        }
        
        // Check for normal thinking opening tag (<think>)
        if (!isStreamingThinking && !isStreamingArtifact) {
          const thinkingStart = detectThinkingStart(fullResponse);
          
          if (thinkingStart.found && thinkingStart.tagComplete) {
            // Found opening <think> tag!
            isStreamingThinking = true;
            
            // Send any text before the <think> tag as normal content
            const beforeTag = fullResponse.substring(chunksSentToChat, thinkingStart.tagStartIndex);
            if (beforeTag) {
              res.write(`data: ${JSON.stringify({
                type: 'chunk',
                content: beforeTag
              })}\n\n`);
              
              // WHAT THIS DOES: Add content_chunk event to eventStream for persistence
              eventStream.push({
                timestamp: Date.now(),
                eventType: 'content_chunk',
                data: { content: beforeTag }
              });
            }
            
            // Send thinking_start event
            res.write(`data: ${JSON.stringify({
              type: 'thinking_start',
              inferredStart: false
            })}\n\n`);
            
            // WHAT THIS DOES: Add thinking_start event to eventStream for persistence
            eventStream.push({
              timestamp: Date.now(),
              eventType: 'thinking_start',
              data: { inferredStart: false }
            });
            
            // Initialize thinking buffer with content after <think>
            thinkingBuffer = fullResponse.substring(thinkingStart.contentStart!);
            chunksSentToChat = fullResponse.length;
            
            return; // Exit early - thinking mode activated
          }
        }
        
        // ========== PRIORITY 2: ARTIFACT DETECTION (UNCHANGED - EXISTING CODE) ==========
        // Real-time artifact detection during streaming
        if (!isStreamingArtifact) {
          // Check if artifact opening tag appears in accumulated response
          const artifactStart = detectArtifactStart(fullResponse);
          
          if (artifactStart.found && artifactStart.tagComplete) {
            // Found complete opening tag!
            isStreamingArtifact = true;
            currentArtifactMeta = {
              type: artifactStart.type!,
              title: artifactStart.title!,
              language: artifactStart.language,
            };
            
            // Extract text before artifact tag
            textBeforeArtifact = fullResponse.substring(0, artifactStart.tagEndIndex! - fullResponse.substring(artifactStart.tagEndIndex!).length);
            const beforeTag = fullResponse.substring(chunksSentToChat, artifactStart.tagEndIndex);
            const tagIndex = beforeTag.indexOf('<artifact') >= 0 ? beforeTag.indexOf('<artifact') : beforeTag.indexOf('<antArtifact');
            
            if (tagIndex >= 0) {
              const textToSend = beforeTag.substring(0, tagIndex);
              if (textToSend) {
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: textToSend })}\n\n`);
                
                // WHAT THIS DOES: Add content_chunk event to eventStream for persistence
                eventStream.push({
                  timestamp: Date.now(),
                  eventType: 'content_chunk',
                  data: { content: textToSend }
                });
              }
            }
            
            // Send artifact_start event to frontend
            res.write(`data: ${JSON.stringify({
              type: 'artifact_start',
              artifact: currentArtifactMeta
            })}\n\n`);
            
            // Initialize buffer with content after opening tag
            artifactBuffer = fullResponse.substring(artifactStart.contentStart!);
            chunksSentToChat = fullResponse.length;
          } else {
            // No artifact detected yet, send chunk normally
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            
            // WHAT THIS DOES: Add content_chunk event to eventStream for persistence
            eventStream.push({
              timestamp: Date.now(),
              eventType: 'content_chunk',
              data: { content: chunk }
            });
            
            chunksSentToChat = fullResponse.length;
          }
        } else {
          // Currently streaming artifact content
          artifactBuffer += chunk;
          
          // Check for closing tag
          const artifactEnd = detectArtifactEnd(artifactBuffer);
          
          if (artifactEnd.found) {
            // Artifact complete!
            const finalContent = artifactEnd.contentBeforeTag!;
            
            // Send final artifact content chunk
            const remainingContent = finalContent.substring(finalContent.length - chunk.length);
            if (remainingContent) {
              res.write(`data: ${JSON.stringify({
                type: 'artifact_content',
                content: remainingContent
              })}\n\n`);
            }
            
            // Send artifact_complete event
            res.write(`data: ${JSON.stringify({
              type: 'artifact_complete'
            })}\n\n`);
            
            // Send placeholder to chat
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: `[Artifact: ${currentArtifactMeta!.title}]`
            })}\n\n`);
            
            // Continue with text after closing tag (if any)
            if (artifactEnd.contentAfterTag) {
              res.write(`data: ${JSON.stringify({
                type: 'chunk',
                content: artifactEnd.contentAfterTag
              })}\n\n`);
              
              // WHAT THIS DOES: Add content_chunk event to eventStream for persistence
              eventStream.push({
                timestamp: Date.now(),
                eventType: 'content_chunk',
                data: { content: artifactEnd.contentAfterTag }
              });
            }
            
            // Update tracking
            chunksSentToChat = fullResponse.length;
            
            // Keep artifact state for saving later
            // Don't reset yet - we need it in the completion handler
          } else {
            // Still inside artifact, stream content to artifact panel
            res.write(`data: ${JSON.stringify({
              type: 'artifact_content',
              content: chunk
            })}\n\n`);
          }
        }
      },
      async (response, tokens) => {
        // Handle tool call response
        if (response === '__TOOL_CALL__') {
          // Tool execution will continue in onToolCall
          return;
        }

        // ========== HANDLE INCOMPLETE THINKING STREAM ==========
        // If thinking mode is still active (no closing </think> tag received)
        // Send final thinking chunk and thinking_end event
        if (isStreamingThinking) {
          if (thinkingBuffer) {
            res.write(`data: ${JSON.stringify({
              type: 'thinking_chunk',
              content: thinkingBuffer
            })}\n\n`);
            
            // WHAT THIS DOES: Add thinking_chunk event to eventStream for persistence
            eventStream.push({
              timestamp: Date.now(),
              eventType: 'thinking_chunk',
              data: { thinkingContent: thinkingBuffer }
            });
          }
          
          res.write(`data: ${JSON.stringify({
            type: 'thinking_end',
            endedByStream: true
          })}\n\n`);
          
          // WHAT THIS DOES: Add thinking_end event to eventStream for persistence
          eventStream.push({
            timestamp: Date.now(),
            eventType: 'thinking_end',
            data: { endedByStream: true }
          });
          
          // Reset thinking state
          isStreamingThinking = false;
          thinkingBuffer = '';
        }

        totalTokens = tokens;
        
        let assistantMessage;
        
        // Check if we streamed an artifact
        if (currentArtifactMeta) {
          // We streamed an artifact - save it now
          const artifactEnd = detectArtifactEnd(artifactBuffer);
          const artifactContent = artifactEnd.found ? artifactEnd.contentBeforeTag! : artifactBuffer;
          
          // Create message with placeholder instead of artifact tags
          // Also strip thinking tags from saved message
          let chatMessage = fullResponse.replace(
            /<(ant)?[Aa]rtifact[\s\S]*?<\/(ant)?[Aa]rtifact>/g, 
            `[Artifact: ${currentArtifactMeta.title}]`
          );
          chatMessage = chatMessage.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          
          assistantMessage = await Message.create({
            conversationId: conversationId,
            role: 'assistant',
            content: chatMessage,
            modelName: useVisionModel ? `${originalModelId} (via ${providerApiModelId})` : providerApiModelId,
            tokenCount: tokens,
            branchIndex: 0,
            parentMessageId: userMessageRecord.rowKey,
            sources: citations.length > 0 ? JSON.stringify(citations) : undefined,
            eventStream: eventStream.length > 0 ? eventStream : undefined,
          });
          
          // Save artifact to database
          // WHAT THIS DOES: Use saveArtifact function - SINGULAR SOURCE OF TRUTH for artifact saving
          // Artifact was already streamed during AI response, so we just save it now
          try {
            const savedArtifact = await saveArtifact(
              res,
              artifactContent,
              currentArtifactMeta,
              user.rowKey,
              conversationId,
              assistantMessage.rowKey
            );
            
            // Note: artifact_saved event is sent by saveArtifact function
          } catch (error) {
            console.error('Failed to save artifact:', error);
          }
        } else {
          // No artifact - regular message
          // Strip thinking tags from saved message content
          const cleanedContent = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          
          assistantMessage = await Message.create({
          conversationId: conversationId,
          role: 'assistant',
          content: cleanedContent,
          modelName: useVisionModel ? `${originalModelId} (via ${providerApiModelId})` : providerApiModelId,
          tokenCount: tokens,
          branchIndex: 0,
          parentMessageId: userMessageRecord.rowKey,
          sources: citations.length > 0 ? JSON.stringify(citations) : undefined,
          eventStream: eventStream.length > 0 ? eventStream : undefined,
        });
        }

        // Generate title if first response
        const messageCount = existingMessages.length + 2; // +2 for user and assistant
        if (messageCount === 2) {
          const title = await generateChatTitle(content);
          await Conversation.update(user.rowKey, conversationId, { title });
        }

        // Update conversation
        await Conversation.update(user.rowKey, conversationId, {
          messageCount: messageCount,
          currentModel: conversation.currentModel,
          updatedAt: new Date(),
        });

        // Update user stats (NO proReplies tracking here - that's for referral rewards)
        await User.update(user.rowKey, {
          tokenUsageTotal: user.tokenUsageTotal + tokens,
          tokenUsageThisMonth: user.tokenUsageThisMonth + tokens,
          messageCount: user.messageCount + 1,
        });

          // Store conversation chunk in RAG if this conversation belongs to a project
          if (conversation.projectId) {
            try {
              const allProjectMessages = await Message.findByConversationId(conversationId, 10);
              if (allProjectMessages.length >= 4) { // Store every 2 exchanges (4 messages)
                await storeConversationChunk(
                  user.rowKey,
                  conversationId,
                  allProjectMessages.slice(-4), // Store last 4 messages
                  conversation.projectId
                );
              }
            } catch (error) {
              console.error('Failed to store conversation chunk:', error);
              // Don't fail the whole request if RAG storage fails
            }
          }

        // Send completion event
        // Build completion event object
        const completionEvent: any = {
          type: 'complete',
          message: {
            role: 'assistant',
            content: assistantMessage.content,
            modelName: useVisionModel ? `${originalModelId} (via ${providerApiModelId})` : providerApiModelId,
            tokenCount: tokens,
            sources: citations.length > 0 ? citations : undefined,
            eventStream: assistantMessage.eventStream, // WHAT THIS DOES: Include persisted eventStream for Thinking UI persistence
          },
          conversation: {
            id: conversation.rowKey,
            title: conversation.title,
          },
        };

        // Add branch metadata if provided (for edit-message endpoint)
        if (branchMetadata) {
          completionEvent.branchMetadata = branchMetadata;
        }

        res.write(`data: ${JSON.stringify(completionEvent)}\n\n`);

        res.end();
      },
      tools,
      async (toolCalls) => {
        // Execute tool calls
        const toolResults = [];
        
        for (const toolCall of toolCalls) {
          // Handle search_web tool call
          if (toolCall.function.name === 'search_web') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const query = args.query;
              const numResults = args.num_results || 5;
              
              // WHAT THIS DOES: Notify frontend that search is starting
              // This creates the search step with spinning animation
              res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: 'search_web', query })}\n\n`);
              
              // WHAT THIS DOES: Add tool_call event to eventStream for persistence
              eventStream.push({
                timestamp: Date.now(),
                eventType: 'tool_call',
                data: {
                  toolName: 'search_web',
                  query: query
                }
              });
              
              // WHAT THIS DOES: Execute the web search
              const results = await searchWeb(query, numResults);
              
              // WHAT THIS DOES: Store citations for later reference in response
              citations.push(...results);
              
              // WHAT THIS DOES: Notify frontend that search completed successfully
              // This updates the search step to show checkmark and clickable results
              res.write(`data: ${JSON.stringify({ 
                type: 'tool_call_complete', 
                tool: 'search_web', 
                query,
                resultsCount: results.length,
                results: results.map(r => ({ title: r.title, url: r.url }))
              })}\n\n`);
              
              // WHAT THIS DOES: Add tool_call_complete event to eventStream for persistence
              eventStream.push({
                timestamp: Date.now(),
                eventType: 'tool_call_complete',
                data: {
                  toolName: 'search_web',
                  query: query,
                  resultsCount: results.length,
                  results: results.map(r => ({ title: r.title, url: r.url }))
                }
              });
              
              // WHAT THIS DOES: Format results for AI to use in its response
              const formattedResults = results.map((r, i) => 
                `[${citations.length - results.length + i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`
              ).join('\n\n');
              
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: formattedResults
              });
            } catch (error) {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Error executing search: ${(error as Error).message}`
              });
            }
          }
          
          // Handle create_artifact tool call
          if (toolCall.function.name === 'create_artifact') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const artifactType = args.type;
              const artifactTitle = args.title;
              const artifactLanguage = args.language;
              const artifactContent = args.content;
              
              // WHAT THIS DOES: Use streamArtifact function - SINGULAR SOURCE OF TRUTH for artifact streaming
              // Note: messageId uses userMessageRecord.rowKey temporarily - will be updated after assistant message is created
              const artifactMeta: ArtifactMeta = {
                type: artifactType,
                title: artifactTitle,
                language: artifactLanguage,
              };
              
              // Stream and save artifact (messageId will be updated after assistant message is created)
              const savedArtifact = await streamArtifact(
                res,
                artifactContent,
                artifactMeta,
                user.rowKey,
                conversationId,
                userMessageRecord.rowKey // Temporary - will be updated after assistant message creation
              );
              
              // Add artifact tags to fullResponse for database persistence
              fullResponse += `<artifact type="${artifactType}" title="${artifactTitle}"${artifactLanguage ? ` language="${artifactLanguage}"` : ''}>${artifactContent}</artifact>`;
              
              // Return success to AI (no need for AI to process this further)
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: 'Artifact created successfully and displayed to user.'
              });
            } catch (error) {
              console.error('Error creating artifact:', error);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                content: `Error creating artifact: ${(error as Error).message}`
              });
            }
          }
        }
        
        // Add tool results to messages and continue conversation
        messages.push(...toolResults);
        
        // Recursively call AI with tool results
        await streamChatCompletion(
          providerApiModelId,
          messages,
          (chunk) => {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            
            // WHAT THIS DOES: Add content_chunk event to eventStream for persistence
            eventStream.push({
              timestamp: Date.now(),
              eventType: 'content_chunk',
              data: { content: chunk }
            });
            
            fullResponse += chunk;
          },
          async (response, tokens) => {
            // Handle potential additional tool calls
            if (response === '__TOOL_CALL__') {
              return;
            }

            totalTokens += tokens;
            
            // Detect and extract artifacts from response
            const artifacts = parseArtifacts(response);
            const cleanedResponse = artifacts.length > 0 ? stripArtifactTags(response) : response;
            
            // Save assistant message (with artifacts stripped)
            const assistantMessage = await Message.create({
              conversationId: conversationId,
              role: 'assistant',
              content: cleanedResponse,
              modelName: useVisionModel ? `${originalModelId} (via ${providerApiModelId})` : providerApiModelId,
              tokenCount: tokens,
              branchIndex: 0,
              parentMessageId: userMessageRecord.rowKey,
              sources: citations.length > 0 ? JSON.stringify(citations) : undefined,
              eventStream: eventStream.length > 0 ? eventStream : undefined,
            });

            // Save artifacts and notify frontend
            // WHAT THIS DOES: Use saveArtifact function - SINGULAR SOURCE OF TRUTH for artifact saving
            // These artifacts were parsed from AI response (legacy flow)
            for (const artifact of artifacts) {
              try {
                const artifactMeta: ArtifactMeta = {
                  type: artifact.type,
                  title: artifact.title,
                  language: artifact.language,
                };
                
                const savedArtifact = await saveArtifact(
                  res,
                  artifact.content,
                  artifactMeta,
                  user.rowKey,
                  conversationId,
                  assistantMessage.rowKey
                );

                // Update assistant message with artifact reference
                await Message.update(assistantMessage.rowKey, conversationId, {
                  artifactId: savedArtifact.rowKey,
                });

                // Note: artifact_saved event is sent by saveArtifact function
              } catch (error) {
                console.error('Failed to save artifact:', error);
              }
            }

            // Generate title if first response
            const messageCount = existingMessages.length + 2;
            if (messageCount === 2) {
              const title = await generateChatTitle(content);
              await Conversation.update(user.rowKey, conversationId, { title });
            }

            // Update conversation
            await Conversation.update(user.rowKey, conversationId, {
              messageCount: messageCount,
              currentModel: conversation.currentModel,
              updatedAt: new Date(),
            });

            // Update user stats
            await User.update(user.rowKey, {
              tokenUsageTotal: user.tokenUsageTotal + totalTokens,
              tokenUsageThisMonth: user.tokenUsageThisMonth + totalTokens,
              messageCount: user.messageCount + 1,
            });

            // Send completion
            // Build completion event object
            const completionEvent: any = {
              type: 'complete',
              message: {
                role: 'assistant',
                content: cleanedResponse,
                modelName: useVisionModel ? `${originalModelId} (via ${providerApiModelId})` : providerApiModelId,
                tokenCount: totalTokens,
                sources: citations.length > 0 ? citations : undefined,
                eventStream: assistantMessage.eventStream, // WHAT THIS DOES: Include persisted eventStream for Thinking UI persistence
              },
              conversation: {
                id: conversation.rowKey,
                title: conversation.title,
              },
            };

            // Add branch metadata if provided (for edit-message endpoint)
            if (branchMetadata) {
              completionEvent.branchMetadata = branchMetadata;
            }

            res.write(`data: ${JSON.stringify(completionEvent)}\n\n`);

            res.end();
          },
          tools,
          undefined // No nested tool calls for now
        );
        
        return toolResults;
      }
    );
  } catch (error: any) {
    console.error('Chat service error:', error);
    
    // WHAT THIS DOES: Clean up empty conversation if no assistant message was saved
    // This prevents storing conversations with only user messages (empty chats)
    try {
      const messages = await Message.findByConversationId(conversationId, 1);
      const hasAssistantMessage = messages.some(m => m.role === 'assistant');
      
      if (!hasAssistantMessage) {
        // No assistant message was saved - delete the conversation and user message
        console.log(`🧹 Cleaning up empty conversation ${conversationId} due to error`);
        await Message.deleteByConversationId(conversationId);
        await Conversation.delete(user.rowKey, conversationId);
      }
    } catch (cleanupError) {
      console.error('Failed to cleanup empty conversation:', cleanupError);
      // Don't fail the error response if cleanup fails
    }
    
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
}

