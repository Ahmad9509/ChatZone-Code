// Branch calculation service
// Centralizes message branching logic to eliminate duplication across endpoints
// Used by: /regenerate, /edit-message, and GET /conversations/:id endpoints

/**
 * WHAT THIS SERVICE DOES:
 * - Calculates branch indices for messages in a conversation tree
 * - Determines how many alternative branches exist for a given message
 * - Handles both assistant branches (regenerate) and user branches (edit-message)
 */

/**
 * Calculate the next branch index for an assistant message
 * 
 * WHAT THIS DOES:
 * 1. Takes all messages in the conversation
 * 2. Finds the parent user message using parentMessageId
 * 3. Counts how many assistant messages already branch from that parent
 * 4. Returns the next available branch index (count = next index)
 * 
 * EXAMPLE:
 * - User message A has rowKey "user-123"
 * - Assistant messages branching from "user-123": ["assist-1", "assist-2"]
 * - Next branch index = 2 (0-indexed: 0, 1, then 2)
 * 
 * @param allMessages - All messages in the conversation
 * @param parentUserMessageId - The rowKey of the user message to branch from
 * @returns The next available branch index number
 */
export function calculateAssistantBranchIndex(
  allMessages: any[],
  parentUserMessageId: string
): number {
  // Find all assistant messages that branch from this parent
  const existingBranches = allMessages.filter(
    (msg) => msg.role === 'assistant' && msg.parentMessageId === parentUserMessageId
  );
  
  // The next branch index is the count of existing branches
  return existingBranches.length;
}

/**
 * Calculate the next branch index for a user message
 * 
 * WHAT THIS DOES:
 * 1. Takes all messages in the conversation
 * 2. Identifies the parent message (could be 'root' for first message)
 * 3. Counts how many user messages already branch from that parent
 * 4. Returns the next available branch index
 * 
 * EXAMPLE:
 * - Original message has parentMessageId "assist-5"
 * - Sibling user branches: ["user-10", "user-11"]
 * - Next branch index = 2
 * 
 * @param allMessages - All messages in the conversation
 * @param parentMessageId - The parent message ID (or undefined for root)
 * @returns Object with nextBranchIndex and normalized parentId ('root' if undefined)
 */
export function calculateUserBranchIndex(
  allMessages: any[],
  parentMessageId: string | undefined
): { nextBranchIndex: number; parentId: string } {
  // Normalize parent ID - use 'root' if undefined
  const parentId = parentMessageId || 'root';
  
  // Find all user messages that branch from this parent
  const siblingUserBranches = allMessages.filter((m) => {
    const branchParent = m.parentMessageId || 'root';
    return m.role === 'user' && branchParent === parentId;
  });
  
  // The next branch index is the count of existing sibling branches
  const nextBranchIndex = siblingUserBranches.length;
  
  return {
    nextBranchIndex,
    parentId,
  };
}

/**
 * Calculate branch metadata for all messages in a conversation
 * 
 * WHAT THIS DOES:
 * 1. Takes all messages in the conversation
 * 2. For each message, calculates its branch index and total branches
 * 3. Returns enriched message objects with branch metadata
 * 4. Used by GET /conversations/:id to show branch info in UI
 * 
 * WHAT IT ADDS TO EACH MESSAGE:
 * - role: The message role (user/assistant)
 * - content: The message content
 * - branchIndex: This message's branch index (default 0 if not set)
 * - parentMessageId: The parent message rowKey
 * - totalBranches: How many alternative branches exist (only for assistant messages)
 * - messageId: The message's rowKey
 * - sources: Parsed citations (if any)
 * - artifactId: Linked artifact ID (if any)
 * - modelName: Model used for this message
 * - tokenCount: Token usage
 * - createdAt: Timestamp
 * 
 * @param messages - All messages in the conversation
 * @returns Array of messages with branch metadata added
 */
export function enrichMessagesWithBranchData(messages: any[]): any[] {
  return messages.map(m => {
    // Base message data with branch info
    // sources is already deserialized by Message model
    const branchData: any = {
      role: m.role,
      content: m.content,
      modelName: m.modelName,
      tokenCount: m.tokenCount,
      branchIndex: m.branchIndex || 0,
      parentMessageId: m.parentMessageId,
      messageId: m.rowKey,
      sources: m.sources,
      artifactId: m.artifactId,
      createdAt: m.createdAt,
    };

    // Calculate total branches for assistant messages
    // This tells the UI how many alternative responses exist
    if (m.role === 'assistant' && m.parentMessageId) {
      const siblings = messages.filter(
        msg => msg.role === 'assistant' && msg.parentMessageId === m.parentMessageId
      );
      branchData.totalBranches = siblings.length;
    }

    return branchData;
  });
}

