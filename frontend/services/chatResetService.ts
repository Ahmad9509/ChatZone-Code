// Service for chat reset operations
interface ResetChatParams {
  setCurrentConversation: (conv: any) => void;
  setMessage: (msg: string) => void;
  setStreamedContent: (content: string) => void;
  setStreaming: (streaming: boolean) => void;
  setSelectedActions: (actions: any) => void;
  setAttachedFiles: (files: any[]) => void;
  setTotalMemoryUsed: (memory: number) => void;
  setHoveredUserMessageId: (id: string | null) => void;
  setResearchProgress: (progress: string) => void;
  setSearchProgress: (progress: any[]) => void;
  setResearchQueries: (queries: string[]) => void;
  setIsThinking: (thinking: boolean) => void;
  setThinkingContent: (content: string) => void;
  setThinkingSteps: (steps: any[]) => void;
  setShowInitialLoader: (show: boolean) => void;
  activeStreamingConversationIdRef: React.MutableRefObject<string | null>;
  setCurrentEventStream: (stream: any) => void;
}

export function resetChatState(params: ResetChatParams): void {
  const {
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
  } = params;

  // WHAT THIS DOES: Clear active streaming conversation ID
  // This prevents streaming state from one conversation appearing in another
  activeStreamingConversationIdRef.current = null;

  setCurrentConversation(null);
  localStorage.removeItem('cz.currentConversationId');
  setMessage('');
  setStreamedContent('');
  setStreaming(false);
  setSelectedActions({
    think: false,
    proSearch: false,
    createDoc: false,
    deepResearch: false,
    createDesign: false,
    createPresentation: false,
  });
  setAttachedFiles([]);
  setTotalMemoryUsed(0);
  setHoveredUserMessageId(null);

  // WHAT THIS DOES: Reset thinking state when switching chats
  setIsThinking(false);
  setThinkingContent('');
  setThinkingSteps([]);
  setShowInitialLoader(false);
  
  // WHAT THIS DOES: Reset event stream when switching chats
  setCurrentEventStream(null);

  // WHAT THIS DOES: Reset research state when switching chats
  setResearchProgress('');
  setSearchProgress([]);
  setResearchQueries([]);
}

