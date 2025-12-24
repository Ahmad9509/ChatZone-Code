// Message tree service
// Centralizes message tree traversal and deletion operations
// Used by: /regenerate endpoint to delete descendant messages when creating new branches

/**
 * WHAT THIS SERVICE DOES:
 * - Handles deletion of descendant messages in a conversation tree
 * - Tracks which messages are removed (important for frontend state updates)
 * - Returns metadata about deleted messages for frontend notifications
 */

import { Message } from '../models';

/**
 * Result of deleting descendant messages
 * Contains lists of removed message IDs by role
 */
export interface DescendantDeletionResult {
  /** Total number of descendants deleted */
  deletedCount: number;
  
  /** IDs of all deleted messages (both user and assistant) */
  deletedMessageIds: string[];
  
  /** IDs of deleted user messages (used for frontend branch tree updates) */
  deletedUserMessageIds: string[];
  
  /** IDs of deleted assistant messages */
  deletedAssistantMessageIds: string[];
}

/**
 * Delete all descendant messages of a given message
 * 
 * WHAT THIS DOES:
 * 1. Takes a starting message ID (e.g., an assistant message being regenerated)
 * 2. Finds all child messages that have this message as their parent
 * 3. Recursively finds children of those children (breadth-first traversal)
 * 4. Deletes all found descendants from the database
 * 5. Returns metadata about what was deleted
 * 
 * WHY THIS EXISTS:
 * When regenerating a message, we need to delete all messages that came after it
 * in the conversation thread. This prevents orphaned messages and keeps the
 * conversation tree clean.
 * 
 * EXAMPLE SCENARIO:
 * - Conversation tree: User1 -> Assistant1 -> User2 -> Assistant2 -> User3
 * - User clicks "regenerate" on Assistant1
 * - This function deletes: User2, Assistant2, User3 (all descendants of Assistant1)
 * 
 * ALGORITHM (Breadth-First Search):
 * 1. Start with queue = [targetMessageId]
 * 2. While queue has items:
 *    a. Take first item from queue
 *    b. Find all messages with parentMessageId = current item
 *    c. Add those messages to deletion list
 *    d. Add those messages to queue (to find their children)
 * 3. Delete all messages in deletion list
 * 
 * @param conversationId - The conversation ID
 * @param targetMessageId - The message whose descendants should be deleted
 * @param allMessages - All messages in the conversation (to avoid extra DB queries)
 * @returns Result object with deletion metadata
 */
export async function deleteDescendants(
  conversationId: string,
  targetMessageId: string,
  allMessages: any[]
): Promise<DescendantDeletionResult> {
  // Initialize breadth-first search queue with the target message
  const descendantQueue = [targetMessageId];
  
  // Track all descendant IDs to delete
  const descendantIds: string[] = [];
  
  // Store full message objects to categorize by role later
  const descendantMessages: any[] = [];
  
  // Breadth-first traversal of the message tree
  while (descendantQueue.length > 0) {
    // Get next message ID to process
    const currentId = descendantQueue.shift();
    if (!currentId) {
      continue;
    }
    
    // Find all direct children of this message
    const children = allMessages.filter(
      (msg) => msg.parentMessageId === currentId
    );
    
    // Add each child to deletion lists and queue
    for (const child of children) {
      descendantIds.push(child.rowKey);
      descendantMessages.push(child);
      descendantQueue.push(child.rowKey); // Add to queue to find its children
    }
  }
  
  // Delete all descendants from database
  if (descendantIds.length > 0) {
    for (const descendantId of descendantIds) {
      await Message.delete(conversationId, descendantId);
    }
  }
  
  // Categorize deleted messages by role
  const deletedUserMessageIds = descendantMessages
    .filter((msg) => msg.role === 'user')
    .map((msg) => msg.rowKey);
  
  const deletedAssistantMessageIds = descendantMessages
    .filter((msg) => msg.role === 'assistant')
    .map((msg) => msg.rowKey);
  
  return {
    deletedCount: descendantIds.length,
    deletedMessageIds: descendantIds,
    deletedUserMessageIds,
    deletedAssistantMessageIds,
  };
}

/**
 * Build a filtered message list with descendants removed
 * 
 * WHAT THIS DOES:
 * 1. Takes the full list of messages
 * 2. Takes a list of IDs to remove
 * 3. Returns a new array with those messages filtered out
 * 4. Used to update in-memory message list after deletion
 * 
 * @param allMessages - All messages in the conversation
 * @param deletedIds - IDs of messages to remove
 * @returns Filtered message array
 */
export function removeDeletedMessagesFromList(
  allMessages: any[],
  deletedIds: string[]
): any[] {
  return allMessages.filter((msg) => !deletedIds.includes(msg.rowKey));
}

