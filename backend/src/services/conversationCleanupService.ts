// Conversation cleanup service
// Centralizes conversation deletion logic
// Used by: DELETE /conversations/:id endpoint

/**
 * WHAT THIS SERVICE DOES:
 * - Handles complete deletion of a conversation and all related data
 * - Ensures all child entities are also deleted (messages, artifacts)
 * - Provides a single source of truth for cleanup operations
 */

import { Conversation, Message, Artifact } from '../models';

/**
 * Result of deleting a conversation
 * Contains success status for logging/auditing
 */
export interface ConversationDeletionResult {
  /** Whether the deletion was successful */
  success: boolean;
  
  /** Error message if deletion failed */
  error?: string;
}

/**
 * Delete a conversation and all its related data
 * 
 * WHAT THIS DOES:
 * 1. Deletes the conversation record from database
 * 2. Deletes all messages in the conversation
 * 3. Deletes all artifacts in the conversation
 * 4. Returns result with success status
 * 
 * WHY THIS EXISTS:
 * When deleting a conversation, we must also delete all child entities
 * to prevent orphaned data. This service ensures all cleanup happens
 * in the correct order.
 * 
 * DELETION ORDER:
 * 1. Conversation (parent entity)
 * 2. Messages (child entities)
 * 3. Artifacts (child entities)
 * 
 * This order prevents foreign key constraint issues.
 * 
 * EXAMPLE USAGE:
 * ```typescript
 * const result = await deleteConversationWithRelatedData('user-123', 'conv-456');
 * if (result.success) {
 *   console.log('Successfully deleted conversation and all related data');
 * }
 * ```
 * 
 * @param userId - The user ID who owns the conversation
 * @param conversationId - The conversation ID to delete
 * @returns Result object with success status
 */
export async function deleteConversationWithRelatedData(
  userId: string,
  conversationId: string
): Promise<ConversationDeletionResult> {
  try {
    // Delete the conversation record
    await Conversation.delete(userId, conversationId);
    
    // Delete all messages in this conversation
    // The deleteByConversationId method deletes all messages but doesn't return a count
    await Message.deleteByConversationId(conversationId);
    
    // Delete all artifacts in this conversation
    // The deleteByConversationId method deletes all artifacts but doesn't return a count
    await Artifact.deleteByConversationId(conversationId);
    
    return {
      success: true,
    };
  } catch (error: any) {
    console.error('Conversation deletion error:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete conversation',
    };
  }
}

