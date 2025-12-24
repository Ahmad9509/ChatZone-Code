// Custom hook for managing message editing and regeneration state
import { useState } from 'react';

export function useMessageEditingState() {
  const [hoveredUserMessageId, setHoveredUserMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [showRegenerateMenu, setShowRegenerateMenu] = useState<string | null>(null);
  const [activeBranches, setActiveBranches] = useState<Record<string, number>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateStreamedContent, setRegenerateStreamedContent] = useState('');
  const [regeneratingForParentId, setRegeneratingForParentId] = useState<string | null>(null);
  const [pendingEditedUserMessageId, setPendingEditedUserMessageId] = useState<string | null>(null);
  const [modelSwitchNotification, setModelSwitchNotification] = useState<{
    visible: boolean;
    message: string;
  }>({
    visible: false,
    message: '',
  });
  const [editingInProgress, setEditingInProgress] = useState(false);

  // Handler for changing which branch is visible at a given parent
  const handleBranchChange = (parentMessageId: string, branchIndexValue: number) => {
    setActiveBranches((prev) => ({
      ...prev,
      [parentMessageId]: branchIndexValue,
    }));
  };

  // Reset branch selection for a specific parent to default (latest)
  const resetParentBranchSelection = (parentMessageId: string) => {
    setActiveBranches((prev) => {
      if (!(parentMessageId in prev)) {
        return prev;
      }
      const { [parentMessageId]: _, ...rest } = prev;
      return rest;
    });
  };

  return {
    hoveredUserMessageId,
    setHoveredUserMessageId,
    editingMessageId,
    setEditingMessageId,
    editedContent,
    setEditedContent,
    showRegenerateMenu,
    setShowRegenerateMenu,
    activeBranches,
    setActiveBranches,
    regenerating,
    setRegenerating,
    regenerateStreamedContent,
    setRegenerateStreamedContent,
    regeneratingForParentId,
    setRegeneratingForParentId,
    pendingEditedUserMessageId,
    setPendingEditedUserMessageId,
    modelSwitchNotification,
    setModelSwitchNotification,
    editingInProgress,
    setEditingInProgress,
    handleBranchChange,
    resetParentBranchSelection,
  };
}

