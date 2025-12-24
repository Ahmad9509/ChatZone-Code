// Response builder service
// Centralizes SSE (Server-Sent Events) response formatting
// Eliminates repetitive JSON.stringify() calls throughout chat endpoints

/**
 * WHAT THIS SERVICE DOES:
 * - Provides clean methods to send SSE events to frontend
 * - Handles JSON stringification and SSE format automatically
 * - Makes code more readable by replacing res.write(`data: ${JSON.stringify({...})}\n\n`)
 * - Centralizes event type definitions in one place
 */

import { Response } from 'express';

/**
 * SSE Response Builder
 * 
 * WHY THIS EXISTS:
 * SSE responses require a specific format: `data: {json}\n\n`
 * Without this utility, every SSE endpoint has 50+ lines like:
 * res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
 * 
 * This is repetitive, error-prone, and makes the code harder to read.
 * This builder provides clean methods like: SSE.chunk(res, chunk)
 */
export class SSEResponseBuilder {
  /**
   * Send a generic SSE event
   * Base method used by all other methods
   * 
   * @param res - Express Response object
   * @param data - Event data object to send
   */
  private static send(res: Response, data: any): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
  
  // ========== ERROR EVENTS ==========
  
  /**
   * Send an error event
   * Used when something goes wrong during streaming
   * 
   * EXAMPLE: SSE.error(res, 'Conversation not found')
   * SENDS: data: {"type":"error","error":"Conversation not found"}\n\n
   */
  static error(res: Response, errorMessage: string): void {
    this.send(res, { type: 'error', error: errorMessage });
  }
  
  // ========== CONTENT STREAMING EVENTS ==========
  
  /**
   * Send a content chunk event
   * Used for normal message content streaming
   * 
   * EXAMPLE: SSE.chunk(res, 'Hello')
   * SENDS: data: {"type":"chunk","content":"Hello"}\n\n
   */
  static chunk(res: Response, content: string): void {
    this.send(res, { type: 'chunk', content });
  }
  
  /**
   * Send a thinking chunk event
   * Used for streaming thinking tokens (<think>...</think>)
   * 
   * EXAMPLE: SSE.thinkingChunk(res, 'Let me analyze this...')
   * SENDS: data: {"type":"thinking_chunk","content":"Let me analyze this..."}\n\n
   */
  static thinkingChunk(res: Response, content: string): void {
    this.send(res, { type: 'thinking_chunk', content });
  }
  
  /**
   * Send a thinking start event
   * Signals frontend to show thinking UI
   * 
   * EXAMPLE: SSE.thinkingStart(res, false)
   * SENDS: data: {"type":"thinking_start","inferredStart":false}\n\n
   */
  static thinkingStart(res: Response, inferredStart: boolean = false): void {
    this.send(res, { type: 'thinking_start', inferredStart });
  }
  
  /**
   * Send a thinking end event
   * Signals frontend to hide thinking UI
   * 
   * EXAMPLE: SSE.thinkingEnd(res, true)
   * SENDS: data: {"type":"thinking_end","endedByStream":true}\n\n
   */
  static thinkingEnd(res: Response, endedByStream: boolean = false, inferredStart: boolean = false): void {
    this.send(res, { 
      type: 'thinking_end', 
      endedByStream,
      ...(inferredStart && { inferredStart })
    });
  }
  
  /**
   * Send an artifact content chunk event
   * Used for streaming artifact content
   * 
   * EXAMPLE: SSE.artifactContent(res, '<div>Hello</div>')
   * SENDS: data: {"type":"artifact_content","content":"<div>Hello</div>"}\n\n
   */
  static artifactContent(res: Response, content: string): void {
    this.send(res, { type: 'artifact_content', content });
  }
  
  /**
   * Send an artifact start event
   * Signals frontend to show artifact panel
   * 
   * EXAMPLE: SSE.artifactStart(res, { type: 'html', title: 'My Page' })
   * SENDS: data: {"type":"artifact_start","artifact":{...}}\n\n
   */
  static artifactStart(res: Response, artifact: any): void {
    this.send(res, { type: 'artifact_start', artifact });
  }
  
  /**
   * Send an artifact complete event
   * Signals frontend that artifact streaming is done
   * 
   * EXAMPLE: SSE.artifactComplete(res)
   * SENDS: data: {"type":"artifact_complete"}\n\n
   */
  static artifactComplete(res: Response): void {
    this.send(res, { type: 'artifact_complete' });
  }
  
  /**
   * Send an artifact saved event
   * Notifies frontend of saved artifact with database ID
   * 
   * EXAMPLE: SSE.artifactSaved(res, savedArtifactData)
   * SENDS: data: {"type":"artifact_saved","artifact":{...}}\n\n
   */
  static artifactSaved(res: Response, artifact: any): void {
    this.send(res, { type: 'artifact_saved', artifact });
  }
  
  // ========== BRANCH MANAGEMENT EVENTS ==========
  
  /**
   * Send a user branch created event
   * Used by edit-message endpoint to notify frontend of new user branch
   * 
   * EXAMPLE: SSE.userBranchCreated(res, userMessage, branchMetadata)
   * SENDS: data: {"type":"user_branch_created","userMessage":{...},"branchMetadata":{...}}\n\n
   */
  static userBranchCreated(res: Response, userMessage: any, branchMetadata: any): void {
    this.send(res, { 
      type: 'user_branch_created', 
      userMessage,
      branchMetadata 
    });
  }
  
  /**
   * Send a pruned descendants event
   * Used by regenerate endpoint to notify frontend of deleted messages
   * 
   * EXAMPLE: SSE.prunedDescendants(res, 'user-123', ['user-456', 'user-789'])
   * SENDS: data: {"type":"pruned_descendants","parentMessageId":"user-123","removedUserMessageIds":[...]}\n\n
   */
  static prunedDescendants(res: Response, parentMessageId: string, removedUserMessageIds: string[]): void {
    this.send(res, {
      type: 'pruned_descendants',
      parentMessageId,
      removedUserMessageIds,
    });
  }
  
  // ========== TOOL CALL EVENTS ==========
  
  /**
   * Send a tool call event
   * Notifies frontend that a tool is being executed (e.g., web search)
   * 
   * EXAMPLE: SSE.toolCall(res, 'search_web', 'best practices for React')
   * SENDS: data: {"type":"tool_call","tool":"search_web","query":"best practices for React"}\n\n
   */
  static toolCall(res: Response, tool: string, query: string): void {
    this.send(res, { type: 'tool_call', tool, query });
  }
  
  // ========== MODEL EVENTS ==========
  
  /**
   * Send a model switched event
   * Notifies frontend when Pro Search auto-switches to thinking model
   * 
   * EXAMPLE: SSE.modelSwitched(res, 'model-123', 'DeepSeek R1', 'Pro Search works best with...')
   * SENDS: data: {"type":"model_switched","modelId":"...","modelName":"...","message":"..."}\n\n
   */
  static modelSwitched(res: Response, modelId: string, modelName: string, message: string): void {
    this.send(res, {
      type: 'model_switched',
      modelId,
      modelName,
      message,
    });
  }
  
  // ========== COMPLETION EVENTS ==========
  
  /**
   * Send a complete event
   * Final event sent when AI response is complete
   * 
   * EXAMPLE: SSE.complete(res, messageData, conversationData, branchMetadata)
   * SENDS: data: {"type":"complete","message":{...},"conversation":{...},"branchMetadata":{...}}\n\n
   */
  static complete(res: Response, message: any, conversation: any, branchMetadata?: any): void {
    const event: any = {
      type: 'complete',
      message,
      conversation,
    };
    
    // Add branch metadata if provided (for edit-message and regenerate)
    if (branchMetadata) {
      event.branchMetadata = branchMetadata;
    }
    
    this.send(res, event);
  }
}

// Export shorter alias for convenience
export const SSE = SSEResponseBuilder;

