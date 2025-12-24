// Custom hook for managing message branching in conversations
// Handles conversation tree building and branch selection state

import { useState, useEffect, useMemo } from 'react';
import { Message, ConversationTree, Conversation } from '@/types/chat';
import { buildConversationTree } from '@/services/branchingService';

interface UseBranching {
  conversationTree: ConversationTree;
  activeBranches: Record<string, number>;
  setActiveBranches: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  getAssistantBranches: (userMessageId: string) => string[];
  getUserBranches: (parentId: string) => string[];
  getSelectedBranchIndex: (parentId: string, branchCount: number) => number;
  handleBranchChange: (parentMessageId: string, branchIndexValue: number) => void;
}

export const useMessageBranching = (currentConversation: Conversation | null): UseBranching => {
  const [activeBranches, setActiveBranches] = useState<Record<string, number>>({});
  const [conversationTree, setConversationTree] = useState<ConversationTree>({
    assistantBranches: {},
    userBranches: {},
    branchCounts: {},
    visibleMessageIds: new Set(),
  });

  // Rebuild tree whenever conversation messages or branch selection changes
  useEffect(() => {
    if (!currentConversation?.messages) {
      setConversationTree({
        assistantBranches: {},
        userBranches: {},
        branchCounts: {},
        visibleMessageIds: new Set(),
      });
      return;
    }

    const tree = buildConversationTree(
      currentConversation.messages as Message[],
      activeBranches
    );
    setConversationTree(tree);
  }, [currentConversation?.messages, activeBranches]);

  // Helper function to get assistant branches for a user message
  const getAssistantBranches = (userMessageId: string): string[] => {
    return conversationTree.assistantBranches[userMessageId] || [];
  };

  // Helper function to get user branches for a parent (assistant or root)
  const getUserBranches = (parentId: string): string[] => {
    return conversationTree.userBranches[parentId] || [];
  };

  // Get selected branch index for a parent
  const getSelectedBranchIndex = (parentId: string, branchCount: number): number => {
    if (branchCount <= 0) return 0;
    const stored = activeBranches[parentId];
    if (typeof stored === 'number' && stored >= 0 && stored < branchCount) {
      return stored;
    }
    return Math.max(0, branchCount - 1);
  };

  // Handle branch navigation (< > buttons)
  const handleBranchChange = (parentMessageId: string, branchIndexValue: number) => {
    setActiveBranches((prev) => ({
      ...prev,
      [parentMessageId]: branchIndexValue,
    }));
  };

  return {
    conversationTree,
    activeBranches,
    setActiveBranches,
    getAssistantBranches,
    getUserBranches,
    getSelectedBranchIndex,
    handleBranchChange,
  };
};

