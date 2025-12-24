// Custom hook for managing conversation tree state and building logic
import { useState, useEffect } from 'react';
import {
  buildConversationTree,
  getAssistantBranches as getAssistantBranchesHelper,
  getUserBranches as getUserBranchesHelper,
  getSelectedBranchIndex as getSelectedBranchIndexHelper,
  isMessageVisible as isMessageVisibleHelper,
  getActiveAssistantParentId as getActiveAssistantParentIdHelper,
  ConversationTree,
} from '@/services/branchingService';

interface UseConversationTreeParams {
  currentConversation: any;
  activeBranches: Record<string, number>;
}

export function useConversationTree(params: UseConversationTreeParams) {
  const { currentConversation, activeBranches } = params;

  const [conversationTree, setConversationTree] = useState<ConversationTree>({
    assistantBranches: {},
    userBranches: {},
    branchCounts: {},
    visibleMessageIds: new Set(),
  });

  // Rebuild tree whenever conversation or branch selection changes
  useEffect(() => {
    if (!currentConversation?.messages) return;
    
    const tree = buildConversationTree(currentConversation.messages, activeBranches);
    setConversationTree(tree);
  }, [currentConversation?.messages, activeBranches]);

  // Wrapper functions that call the branching service with the current tree
  function getAssistantBranches(parentMessageId?: string): string[] {
    return getAssistantBranchesHelper(conversationTree, parentMessageId);
  }

  function getUserBranches(parentMessageId?: string | null): string[] {
    return getUserBranchesHelper(conversationTree, parentMessageId);
  }

  function getSelectedBranchIndex(parentMessageId: string | undefined, branchCount: number): number {
    return getSelectedBranchIndexHelper(parentMessageId, branchCount, activeBranches);
  }

  function isMessageVisible(messageId?: string): boolean {
    return isMessageVisibleHelper(conversationTree, messageId);
  }

  function getActiveAssistantParentId(allMessages: any[]): string | undefined {
    return getActiveAssistantParentIdHelper(allMessages, conversationTree);
  }

  return {
    conversationTree,
    getAssistantBranches,
    getUserBranches,
    getSelectedBranchIndex,
    isMessageVisible,
    getActiveAssistantParentId,
  };
}

