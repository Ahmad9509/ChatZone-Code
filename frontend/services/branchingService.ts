// Branching service - handles conversation tree building and branch navigation logic
// All functions are pure - they don't modify state, just compute tree structures

export interface ConversationTree {
  assistantBranches: Record<string, string[]>;
  userBranches: Record<string, string[]>;
  branchCounts: Record<string, number>;
  visibleMessageIds: Set<string>;
}

/**
 * Builds the conversation tree from messages and active branch selections
 * This is the core tree-building algorithm
 */
export function buildConversationTree(
  messages: any[],
  activeBranchSelection: Record<string, number>
): ConversationTree {
  // Map of parent message id -> child assistant message ids
  const assistantBranches: Record<string, string[]> = {};
  // Map of parent message id -> child user message ids
  const userBranches: Record<string, string[]> = {};
  // Parent id -> number of branches available
  const branchCounts: Record<string, number> = {};

  messages.forEach((msg: any) => {
    const parentId = msg.parentMessageId || 'root';

    if (msg.role === 'assistant') {
      if (!assistantBranches[parentId]) {
        assistantBranches[parentId] = [];
      }
      assistantBranches[parentId].push(msg.messageId);
    }

    if (msg.role === 'user') {
      if (!userBranches[parentId]) {
        userBranches[parentId] = [];
      }
      userBranches[parentId].push(msg.messageId);
    }
  });

  Object.keys(userBranches).forEach((parentId) => {
    branchCounts[parentId] = userBranches[parentId].length;
  });

  Object.keys(assistantBranches).forEach((parentId) => {
    branchCounts[parentId] = Math.max(branchCounts[parentId] || 0, assistantBranches[parentId].length);
  });

  if (userBranches['root']) {
    branchCounts['root'] = userBranches['root'].length;
  }

  const visibleMessageIds = new Set<string>();

  const traverseBranch = (messageId: string, role: 'user' | 'assistant') => {
    visibleMessageIds.add(messageId);

    if (role === 'user') {
      const children = assistantBranches[messageId] || [];
      if (children.length === 0) {
        return;
      }
      const selectedIndex = readBranchSelection(messageId, children.length, activeBranchSelection);
      const selectedAssistantId = children[selectedIndex];
      if (selectedAssistantId) {
        traverseBranch(selectedAssistantId, 'assistant');
      }
    } else {
      const children = userBranches[messageId] || [];
      if (children.length === 0) {
        return;
      }
      const selectedIndex = readBranchSelection(messageId, children.length, activeBranchSelection);
      const selectedUserId = children[selectedIndex];
      if (selectedUserId) {
        traverseBranch(selectedUserId, 'user');
      }
    }
  };

  const rootUserMessages = userBranches['root'] || [];
  if (rootUserMessages.length > 0) {
    const rootSelectedIndex = readBranchSelection('root', rootUserMessages.length, activeBranchSelection);
    const selectedRootUser = rootUserMessages[rootSelectedIndex];
    if (selectedRootUser) {
      traverseBranch(selectedRootUser, 'user');
    }
  }

  return {
    assistantBranches,
    userBranches,
    branchCounts,
    visibleMessageIds,
  };
}

/**
 * Reads the selected branch index for a parent node
 * Returns the stored selection or defaults to the last branch
 */
export function readBranchSelection(
  parentId: string,
  branchCount: number,
  selectionMap: Record<string, number>
): number {
  if (branchCount <= 0) return 0;
  const stored = selectionMap[parentId];
  if (typeof stored === 'number' && stored >= 0 && stored < branchCount) {
    return stored;
  }
  return Math.max(0, branchCount - 1);
}

/**
 * Returns all assistant branch messageIds for a given parent (user message)
 */
export function getAssistantBranches(
  conversationTree: ConversationTree,
  parentMessageId?: string
): string[] {
  if (!parentMessageId) return [];
  return conversationTree.assistantBranches[parentMessageId] || [];
}

/**
 * Returns all user branch messageIds for a given parent (assistant message or 'root')
 */
export function getUserBranches(
  conversationTree: ConversationTree,
  parentMessageId?: string | null
): string[] {
  if (!parentMessageId) {
    return conversationTree.userBranches['root'] || [];
  }
  return conversationTree.userBranches[parentMessageId] || [];
}

/**
 * Returns the selected branch index for a parent node
 * This is a simple lookup with default fallback
 */
export function getSelectedBranchIndex(
  parentMessageId: string | undefined,
  branchCount: number,
  activeBranches: Record<string, number>
): number {
  if (!parentMessageId || branchCount <= 0) return 0;
  return readBranchSelection(parentMessageId, branchCount, activeBranches);
}

/**
 * Checks if a message should be visible based on the pre-built tree
 * This is a simple Set lookup with no recursive logic
 */
export function isMessageVisible(
  conversationTree: ConversationTree,
  messageId?: string
): boolean {
  if (!messageId) return false;
  return conversationTree.visibleMessageIds.has(messageId);
}

/**
 * Walks backwards through visible messages to find the last assistant message
 * This is used to determine the parent for new user messages
 */
export function getActiveAssistantParentId(
  allMessages: any[],
  conversationTree: ConversationTree
): string | undefined {
  for (let idx = allMessages.length - 1; idx >= 0; idx -= 1) {
    const msg = allMessages[idx];
    if (!msg || msg.role !== 'assistant' || !msg.messageId) continue;
    
    if (isMessageVisible(conversationTree, msg.messageId)) {
      return msg.messageId;
    }
  }
  return undefined;
}
