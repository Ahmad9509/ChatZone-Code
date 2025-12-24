// Custom hook that provides all chat action handlers
import { useRouter } from 'next/navigation';
import { sendMessage, editMessage } from '@/services/messageSendService';
import { regenerateMessage } from '@/services/messageRegenerateService';
import { addConversationToProject } from '@/services/projectService';
import { handleLogout as logoutUser } from '@/services/authService';
import { resetChatState } from '@/services/chatResetService';

interface UseChatHandlersParams {
  // Message and streaming state
  message: string;
  setMessage: (msg: string) => void;
  streaming: boolean;
  setStreaming: (streaming: boolean) => void;
  streamedContent: string;
  setStreamedContent: (content: string) => void;
  
  // Conversation state
  currentConversation: any;
  setCurrentConversation: (conv: any) => void;
  addConversation: (conv: any) => void;
  updateConversation: (id: string, updates: any) => void;
  
  // File and memory state
  attachedFiles: any[];
  setAttachedFiles: (files: any[]) => void;
  totalMemoryUsed: number;
  setTotalMemoryUsed: (memory: number) => void;
  
  // Model state
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  setModelSwitchNotification: (notification: any) => void;
  
  // Actions state
  selectedActions: any;
  setSelectedActions: (actions: any) => void;
  
  // Artifact state
  setStreamingArtifact: (artifact: any) => void;
  setShowArtifactPanel: (show: boolean) => void;
  setCurrentArtifact: (artifact: any) => void;
  
  // Research state
  researchProgress: string;
  setResearchProgress: (progress: string) => void;
  researchQueries: string[];
  setResearchQueries: (queries: string[]) => void;
  searchProgress: any[];
  setSearchProgress: (progress: any[]) => void;
  
  // Sources state
  setCurrentSources: (sources: any[]) => void;
  
  // Thinking state
  setIsThinking: (thinking: boolean) => void;
  setThinkingContent: (content: string) => void;
  setThinkingSteps: (steps: any[] | ((prev: any[]) => any[])) => void;
  setShowInitialLoader: (show: boolean) => void;
  
  // Editing state
  hoveredUserMessageId: string | null;
  setHoveredUserMessageId: (id: string | null) => void;
  editingMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  editedContent: string;
  setEditedContent: (content: string) => void;
  editingInProgress: boolean;
  setEditingInProgress: (inProgress: boolean) => void;
  pendingEditedUserMessageId: string | null;
  setPendingEditedUserMessageId: (id: string | null) => void;
  
  // Regeneration state
  regenerating: boolean;
  setRegenerating: (regenerating: boolean) => void;
  regenerateStreamedContent: string;
  setRegenerateStreamedContent: (content: string) => void;
  regeneratingForParentId: string | null;
  setRegeneratingForParentId: (id: string | null) => void;
  showRegenerateMenu: string | null;
  setShowRegenerateMenu: (id: string | null) => void;
  activeBranches: Record<string, number>;
  setActiveBranches: (branches: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  
  // UI state
  setConversations: (conversations: any[]) => void;
  setConversationMenuOpen: (id: string | null) => void;
  setShowAddToProjectMenu: (id: string | null) => void;
  setSubmenuPosition: (position: any) => void;
  
  // Refs
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  activeStreamingConversationIdRef: React.MutableRefObject<string | null>;
  
  // Event stream state
  setCurrentEventStream: (stream: any) => void;
  
  // Helper functions
  getActiveAssistantParentId: (allMessages: any[]) => string | undefined;
  
  // WHAT THIS DOES: Function to clear all user-related data from store
  // Used during logout to prevent old user's data from persisting
  clearUserData: () => void;
  
  // PPT template picker callback
  onPPTTemplateRequired?: () => void;
}

export function useChatHandlers(params: UseChatHandlersParams) {
  const router = useRouter();
  const {
    message,
    setMessage,
    streaming,
    setStreaming,
    streamedContent,
    setStreamedContent,
    currentConversation,
    setCurrentConversation,
    addConversation,
    updateConversation,
    attachedFiles,
    setAttachedFiles,
    totalMemoryUsed,
    setTotalMemoryUsed,
    selectedModel,
    setSelectedModel,
    setModelSwitchNotification,
    selectedActions,
    setSelectedActions,
    setStreamingArtifact,
    setShowArtifactPanel,
    setCurrentArtifact,
    researchProgress,
    setResearchProgress,
    researchQueries,
    setResearchQueries,
    searchProgress,
    setSearchProgress,
    setCurrentSources,
    setIsThinking,
    setThinkingContent,
    setThinkingSteps,
    setShowInitialLoader,
    hoveredUserMessageId,
    setHoveredUserMessageId,
    editingMessageId,
    setEditingMessageId,
    editedContent,
    setEditedContent,
    editingInProgress,
    setEditingInProgress,
    pendingEditedUserMessageId,
    setPendingEditedUserMessageId,
    regenerating,
    setRegenerating,
    regenerateStreamedContent,
    setRegenerateStreamedContent,
    regeneratingForParentId,
    setRegeneratingForParentId,
    showRegenerateMenu,
    setShowRegenerateMenu,
    activeBranches,
    setActiveBranches,
    setConversations,
    setConversationMenuOpen,
    setShowAddToProjectMenu,
    setSubmenuPosition,
    textareaRef,
    activeStreamingConversationIdRef,
    setCurrentEventStream,
    getActiveAssistantParentId,
    clearUserData,
    onPPTTemplateRequired,
  } = params;

  const handleNewChat = async () => {
    resetChatState({
      setCurrentConversation,
      setMessage,
      setStreamedContent,
      setStreaming,
      setSelectedActions,
      setAttachedFiles,
      setTotalMemoryUsed,
      setHoveredUserMessageId,
      setResearchProgress,
      setSearchProgress,
      setResearchQueries,
      setIsThinking,
      setThinkingContent,
      setThinkingSteps,
      setShowInitialLoader,
      activeStreamingConversationIdRef,
      setCurrentEventStream,
    });
  };

  const handleAddToProject = async (conversationId: string, projectId: string) => {
    await addConversationToProject({
      conversationId,
      projectId,
      setConversations,
      setConversationMenuOpen,
      setShowAddToProjectMenu,
      setSubmenuPosition,
    });
  };

  const handleSendMessage = async () => {
    await sendMessage({
      message,
      streaming,
      currentConversation,
      attachedFiles,
      selectedModel,
      selectedActions,
      textareaRef,
      setMessage,
      setStreaming,
      setStreamedContent,
      setCurrentConversation,
      setAttachedFiles,
      setTotalMemoryUsed,
      setSelectedModel,
      setModelSwitchNotification,
      setStreamingArtifact,
      setShowArtifactPanel,
      setCurrentArtifact,
      setIsThinking,
      setThinkingContent,
      setThinkingSteps,
      setShowInitialLoader,
      addConversation,
      updateConversation,
      getActiveAssistantParentId,
      activeStreamingConversationIdRef,
      setCurrentEventStream,
      onPPTTemplateRequired,
    });
  };

  const handleStartDeepResearch = async () => {
    // WHAT THIS DOES: Send message with Deep Research flag
    // Backend orchestrates the two-phase flow (questions → research)
    await sendMessage({
      message,
      streaming,
      currentConversation,
      attachedFiles,
      selectedModel,
      selectedActions: { ...selectedActions, deepResearch: true }, // Add deep research flag
      textareaRef,
      setMessage,
      setStreaming,
      setStreamedContent,
      setCurrentConversation,
      setAttachedFiles,
      setTotalMemoryUsed,
      setSelectedModel,
      setModelSwitchNotification,
      setStreamingArtifact,
      setShowArtifactPanel,
      setCurrentArtifact,
      setIsThinking,
      setThinkingContent,
      setThinkingSteps,
      setShowInitialLoader,
      addConversation,
      updateConversation,
      getActiveAssistantParentId,
      activeStreamingConversationIdRef,
      setCurrentEventStream,
    });
  };

  const handleCancelResearch = async () => {
    // WHAT THIS DOES: Cancel research by clearing state (no separate endpoint needed)
    // Since research now streams like regular chat, we can just clear the state
    setResearchProgress('');
    setResearchQueries([]);
    setSearchProgress([]);
    // Note: The SSE stream will close naturally when user navigates away or starts new chat
  };

  const handleRegenerateMessage = async (messageIndex: number, directive: string) => {
    await regenerateMessage({
      currentConversation,
      regenerating,
      selectedModel,
      messageIndex,
      directive,
      setRegenerating,
      setRegenerateStreamedContent,
      setRegeneratingForParentId,
      setShowRegenerateMenu,
      setCurrentConversation,
      setActiveBranches,
      setIsThinking,
      setThinkingContent,
      setThinkingSteps,
      setShowInitialLoader,
      updateConversation,
      activeStreamingConversationIdRef,
    });
  };

  // WHAT THIS DOES: Handle user logout by clearing localStorage and store state
  // Calls clearUserData to reset all user-related data in Zustand store
  const handleLogout = () => {
    logoutUser(router, clearUserData);
  };

  const handleEditMessage = async (message: any) => {
    await editMessage({
      message,
      currentConversation,
      editedContent,
      selectedModel,
      setEditingInProgress,
      setPendingEditedUserMessageId,
      setEditingMessageId,
      setCurrentConversation,
      setActiveBranches,
      setEditedContent,
      setIsThinking,
      setThinkingContent,
      setThinkingSteps,
      setShowInitialLoader,
      updateConversation,
      activeStreamingConversationIdRef,
    });
  };

  return {
    handleNewChat,
    handleAddToProject,
    handleSendMessage,
    handleStartDeepResearch,
    handleCancelResearch,
    handleRegenerateMessage,
    handleLogout,
    handleEditMessage,
  };
}

