// Message sending and editing service - handles sending new messages and editing existing ones with SSE streaming
import { chat as chatApi, files as filesApi, auth } from '@/lib/api';
import { handleSSEStream, createChatSSEHandlers } from '@/lib/sseHandler';
import { MessageEventStream, EventStreamItem } from '@/types/eventStream';

interface SendMessageParams {
  // Current state
  message: string;
  streaming: boolean;
  currentConversation: any;
  attachedFiles: any[];
  selectedModel: string;
  selectedActions: {
    proSearch: boolean;
    createDoc: boolean;
    createPresentation: boolean;
    deepResearch?: boolean;
    createPPT?: boolean;
    pptTemplateId?: string;
    pptThemeId?: string;
  };
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  
  // State setters
  setMessage: (msg: string) => void;
  setStreaming: (val: boolean) => void;
  setStreamedContent: (val: string | ((prev: string) => string)) => void;
  setCurrentConversation: (conv: any) => void;
  setAttachedFiles: (files: any[] | ((prev: any[]) => any[])) => void;
  setTotalMemoryUsed: (val: number) => void;
  setSelectedModel: (model: string) => void;
  setModelSwitchNotification: (notif: { visible: boolean; message: string }) => void;
  setStreamingArtifact: (artifact: any | null | ((prev: any) => any)) => void;
  setShowArtifactPanel: (show: boolean) => void;
  setCurrentArtifact: (artifact: any) => void;
  
  // Thinking state setters
  setIsThinking: (thinking: boolean) => void;
  setThinkingContent: (content: string) => void;
  setThinkingSteps: (steps: any[] | ((prev: any[]) => any[])) => void;
  setShowInitialLoader: (show: boolean) => void;
  
  // Store actions
  addConversation: (conv: any) => void;
  updateConversation: (id: string, updates: any) => void;
  
  // Helper functions
  getActiveAssistantParentId: (messages: any[]) => string | undefined;
  activeStreamingConversationIdRef: React.MutableRefObject<string | null>;
  
  // Event stream state setter
  setCurrentEventStream: (stream: MessageEventStream | null) => void;
  
  // PPT template picker callback
  onPPTTemplateRequired?: () => void;
}

export async function sendMessage(params: SendMessageParams): Promise<void> {
  const {
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
    onPPTTemplateRequired,
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
  } = params;

  if (!message.trim() || streaming) return;

  // Auto-create conversation if none 
  let activeConversation = currentConversation;
  console.log('💬 Sending message to conversation:', activeConversation?._id);
  
  if (!activeConversation) {
    try {
      const res = await chatApi.createConversation();
      const newConv = res.data.conversation;
      
      addConversation(newConv);
      setCurrentConversation(newConv);
      activeConversation = newConv;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return;
    }
  }

  if (!activeConversation) return;

  const userMessage = message;
  setMessage('');
  setStreaming(true);
  setStreamedContent('');
  
  // WHAT THIS DOES: Store conversation ID as active streaming conversation
  // This is the SINGLE SOURCE OF TRUTH for which conversation is streaming
  // SSE handlers will check this before updating state
  const conversationId = activeConversation._id;
  activeStreamingConversationIdRef.current = conversationId;
  
  // WHAT THIS DOES: Reset thinking state when starting new message
  // Clear any previous thinking content and steps
  setIsThinking(false);
  setThinkingContent('');
  setThinkingSteps([]);
  
  // WHAT THIS DOES: Show initial loader immediately when message is sent
  // This gives immediate feedback that AI is processing
  const initialLoaderTimeoutRef = { current: null as NodeJS.Timeout | null };
  setShowInitialLoader(true); // Show immediately, no delay
  
  console.log('📤 Sending to API:', activeConversation._id);
  
  // Reset textarea height
  if (textareaRef.current) {
    textareaRef.current.style.height = '32px';
  }

  const timestamp = new Date().toISOString();
  const originalConversation = activeConversation;
  const originalMessages = [...(activeConversation.messages || [])];

  const parentAssistantId = getActiveAssistantParentId(originalMessages);
  const userParentMessageId = parentAssistantId || undefined;

  const pendingUserMessage = {
    role: 'user',
    content: userMessage,
    createdAt: timestamp,
    attachedFiles: attachedFiles.filter((f) => f.status === 'uploaded').map((f) => f.file),
    parentMessageId: userParentMessageId,
    // Assign a temporary ID so the optimistic branch render includes this prompt immediately
    messageId: `pending-${timestamp}-${Math.random()}`,
  } as any;

  const optimisticConversation = {
    ...activeConversation,
    messages: [...(activeConversation.messages || []), pendingUserMessage],
    updatedAt: timestamp,
    lastMessageAt: timestamp,
  };

  setCurrentConversation(optimisticConversation);
  updateConversation(optimisticConversation._id, {
    messages: optimisticConversation.messages,
    updatedAt: timestamp,
    lastMessageAt: timestamp,
  });
  
  // WHAT THIS DOES: Initialize event stream for this message
  // Event stream is scoped to conversationId + userMessageId (for assistant messages)
  const userMessageId = pendingUserMessage.messageId;
  const initialEventStream: MessageEventStream = {
    conversationId: conversationId,
    messageId: userMessageId,
    events: [],
  };
  setCurrentEventStream(initialEventStream);
  
  // WHAT THIS DOES: Create function to add events to stream
  // This function will be passed to SSE handlers to track events chronologically
  const addEventToStream = (event: EventStreamItem) => {
    if (activeStreamingConversationIdRef.current === conversationId) {
      setCurrentEventStream((prev) => {
        if (!prev || prev.conversationId !== conversationId || prev.messageId !== userMessageId) {
          return initialEventStream;
        }
        return {
          ...prev,
          events: [...prev.events, event],
        };
      });
    }
  };

  try {
    // Upload files first if any are attached
    if (attachedFiles.length > 0) {
      try {
        const filesToUpload = attachedFiles
          .filter(f => f.status === 'pending' || f.status === 'uploading')
          .map(f => f.file);

        if (filesToUpload.length > 0) {
          const fileRes = await filesApi.uploadFiles(conversationId, filesToUpload);
          
          // Update attached files status
          setAttachedFiles((prev) =>
            prev.map((f) =>
              fileRes.data.files.find((uploaded: any) => uploaded.fileName === f.file.name)
                ? { ...f, status: 'uploaded' }
                : f
            )
          );
        }
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        // Continue with message even if file upload fails
      }
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'https://chatzone-api-b8h3g0c4hydccrcy.eastus-01.azurewebsites.net'}/api/chat/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          content: userMessage,
          model: selectedModel !== 'auto' ? selectedModel : undefined,
          isProSearch: selectedActions.proSearch,
          forceArtifact: selectedActions.createDoc || selectedActions.createPresentation,
          isDeepResearch: selectedActions.deepResearch,
          isCreatePPT: selectedActions.createPPT,
          pptTemplateId: selectedActions.pptTemplateId,
          pptThemeId: selectedActions.pptThemeId,
          attachedFileIds: attachedFiles.filter((f) => f.status === 'uploaded').map((f) => f.id),
          parentMessageId: userParentMessageId,
        }),
        keepalive: true, // WHAT THIS DOES: Keep connection alive for slow models - prevents browser from timing out
      }
    );

    console.log('🌐 API Response status:', response.status);

    // ========== SSE STREAM PROCESSING ==========
    // WHAT THIS SECTION DOES:
    // Uses the single source of truth function createChatSSEHandlers to handle thinking
    // This includes all thinking logic (start, chunk, end) in one place
    // Custom handlers are provided for sendMessage-specific logic (artifacts, completion, etc.)
    
    const sseHandlers = createChatSSEHandlers({
      setIsThinking,
      setThinkingContent,
      setThinkingSteps,
      setShowInitialLoader,
      initialLoaderTimeoutRef,
      addEventToStream,
      customHandlers: {
      // Handle new content chunks from AI
        // WHAT THIS DOES: Only update streamedContent if this conversation is still the active streaming conversation
        // This prevents chunks from one conversation appearing in another conversation
      onChunk: (content) => {
          if (activeStreamingConversationIdRef.current === conversationId) {
        setStreamedContent((prev) => prev + content);
          }
      },

      // Handle model auto-switch for Pro Search
      onModelSwitched: (data) => {
        setSelectedModel(data.modelId);
        setModelSwitchNotification({
          visible: true,
          message: data.message,
        });
        // Auto-hide after 3 seconds
        setTimeout(() => {
          setModelSwitchNotification({ visible: false, message: '' });
        }, 3000);
      },

      // Handle artifact streaming
        // WHAT THIS DOES: Only update artifact if this conversation is still the active streaming conversation
      onArtifactStart: (artifact) => {
          if (activeStreamingConversationIdRef.current === conversationId) {
        setStreamingArtifact({
          _id: 'streaming',
          type: artifact.type as 'html' | 'code' | 'svg' | 'markdown' | 'react' | 'vue' | 'json' | 'csv' | 'mermaid',
          title: artifact.title,
          language: artifact.language,
          content: '',
          version: 0,
          messageId: 'streaming',
          conversationId: conversationId,
        });
        setShowArtifactPanel(true);
          }
      },

        // WHAT THIS DOES: Only update artifact content if this conversation is still the active streaming conversation
      onArtifactContent: (content) => {
          if (activeStreamingConversationIdRef.current === conversationId) {
        setStreamingArtifact(prev => prev ? {
          ...prev,
          content: prev.content + content
        } : null);
          }
      },

      onArtifactComplete: () => {
        // Artifact streaming complete (but not yet saved to DB)
        // Keep showing the streaming artifact
      },

      onArtifactSaved: (artifact) => {
        setCurrentArtifact({
          ...artifact,
          conversationId: artifact.conversationId || conversationId,
        });
        setStreamingArtifact(null);
      },

      onArtifactCreated: (artifact) => {
        // Legacy handler for non-streaming artifacts
        setCurrentArtifact({
          ...artifact,
          conversationId: artifact.conversationId || conversationId,
        });
        setShowArtifactPanel(true);
      },

      // Handle PPT template selection required
      onPPTTemplateRequired: () => {
        if (onPPTTemplateRequired) {
          onPPTTemplateRequired();
        }
      },

      // Handle response complete
        // WHAT THIS DOES: Only process completion if this conversation is still the active streaming conversation
      onComplete: async (data) => {
          // WHAT THIS DOES: Only update state if this conversation is still the active streaming conversation
          if (activeStreamingConversationIdRef.current === conversationId) {
            // WHAT THIS DOES: Clear initial loader timeout if still pending
            if (initialLoaderTimeoutRef.current) {
              clearTimeout(initialLoaderTimeoutRef.current);
              initialLoaderTimeoutRef.current = null;
            }
            setShowInitialLoader(false);
            
        // Reload conversation to get full message history
        const convRes = await chatApi.getConversation(conversationId);
        const refreshedConversation = convRes.data.conversation;
        setCurrentConversation(refreshedConversation);
        updateConversation(refreshedConversation._id, {
          title: refreshedConversation.title,
          updatedAt: refreshedConversation.updatedAt,
          lastMessageAt: refreshedConversation.updatedAt,
          messages: refreshedConversation.messages,
        });
        setStreamedContent('');
        setAttachedFiles([]); // Clear attached files after successful send
        setTotalMemoryUsed(0); // Reset memory usage
        
        // WHAT THIS DOES: Clear draft text after successful message send
        // Draft is cleared so it doesn't reappear when user returns to this conversation
        // Also clear newChatDraft if this was sent from new chat
        try {
          await chatApi.saveDraft(conversationId, '');
          // WHAT THIS DOES: Also clear new chat draft since message was successfully sent
          // This ensures newChatDraft doesn't persist after successful send
          await chatApi.saveDraft('new', '');
        } catch (draftError) {
          // WHAT THIS DOES: Silently fail - draft clearing shouldn't interrupt user experience
          console.error('Failed to clear draft:', draftError);
        }
            
            // WHAT THIS DOES: Keep thinking steps visible but clear active thinking state
            // User can still expand thinking section to see steps
            setIsThinking(false);
            
            // WHAT THIS DOES: Clear active streaming conversation ID since stream is complete
            activeStreamingConversationIdRef.current = null;
            setStreaming(false);
            
            // WHAT THIS DOES: Keep event stream for rendering completed messages
            // Event stream will be cleared when switching conversations or starting new chat
            // TODO: Save event stream to backend for persistence
          }
        },
      },
    });

    // Use shared SSE handler to process the stream
    await handleSSEStream(response, sseHandlers);
  } catch (error) {
    console.error('Failed to send message:', error);
    alert('Failed to send message. Please try again.');
    
    // WHAT THIS DOES: Clear initial loader timeout on error
    if (initialLoaderTimeoutRef.current) {
      clearTimeout(initialLoaderTimeoutRef.current);
      initialLoaderTimeoutRef.current = null;
    }
    setShowInitialLoader(false);
    setIsThinking(false);
    
    // WHAT THIS DOES: Clear active streaming conversation ID on error
    if (activeStreamingConversationIdRef.current === conversationId) {
      activeStreamingConversationIdRef.current = null;
      setStreaming(false);
    }
    
    // WHAT THIS DOES: Restore draft text after failed send
    // Draft remains in backend (saved in real-time), so restore it to composer bar
    // This ensures user can retry without losing their text
    try {
      const conversationIdForDraft = conversationId || 'new';
      if (conversationIdForDraft === 'new') {
        // For new chat, fetch user data to get newChatDraft
        const userRes = await auth.getMe();
        if (userRes?.data?.user?.newChatDraft) {
          setMessage(userRes.data.user.newChatDraft);
        }
      } else {
        // For existing conversation, fetch conversation to get draftText
        const convRes = await chatApi.getConversation(conversationId);
        if (convRes.data.conversation.draftText) {
          setMessage(convRes.data.conversation.draftText);
        }
      }
    } catch (draftError) {
      // WHAT THIS DOES: Silently fail - draft restoration shouldn't interrupt error handling
      console.error('Failed to restore draft after error:', draftError);
    }
    
    // Roll back optimistic message on failure
    const rolledBackConversation = {
      ...originalConversation,
      messages: originalMessages,
    } as any;
    setCurrentConversation(rolledBackConversation);
    updateConversation(conversationId, {
      messages: originalMessages,
      updatedAt: originalConversation.updatedAt,
      lastMessageAt: originalConversation.lastMessageAt,
    });
  }
}

// Edit message params interface
interface EditMessageParams {
  message: any;
  currentConversation: any;
  editedContent: string;
  selectedModel: string;
  
  // State setters
  setEditingInProgress: (val: boolean) => void;
  setPendingEditedUserMessageId: (id: string | null) => void;
  setEditingMessageId: (id: string | null) => void;
  setCurrentConversation: (conv: any) => void;
  setActiveBranches: (branches: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  setEditedContent: (content: string) => void;
  
  // Thinking state setters
  setIsThinking: (thinking: boolean) => void;
  setThinkingContent: (content: string) => void;
  setThinkingSteps: (steps: any[] | ((prev: any[]) => any[])) => void;
  setShowInitialLoader: (show: boolean) => void;
  
  // Store actions
  updateConversation: (id: string, updates: any) => void;
  activeStreamingConversationIdRef: React.MutableRefObject<string | null>;
}

// Edit an existing user message and get a new AI response
export async function editMessage(params: EditMessageParams): Promise<void> {
  const {
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
  } = params;

  if (!currentConversation || !message) return;

  const conversationId = currentConversation._id;
  const messageId = message.messageId;
  const parentMessageId = message.parentMessageId || 'root';

  setEditingInProgress(true);
  setPendingEditedUserMessageId(messageId);
  setEditingMessageId(null);
  
  // WHAT THIS DOES: Store conversation ID as active streaming conversation
  // This is the SINGLE SOURCE OF TRUTH for which conversation is streaming
  activeStreamingConversationIdRef.current = conversationId;
  
  // WHAT THIS DOES: Reset thinking state when editing message
  setIsThinking(false);
  setThinkingContent('');
  setThinkingSteps([]);
  
  // WHAT THIS DOES: Show initial loader immediately when editing
  const initialLoaderTimeoutRef = { current: null as NodeJS.Timeout | null };
  setShowInitialLoader(true); // Show immediately, no delay

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'https://chatzone-api-b8h3g0c4hydccrcy.eastus-01.azurewebsites.net'}/api/chat/conversations/${conversationId}/edit-message/${messageId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          content: editedContent,
          model: selectedModel !== 'auto' ? selectedModel : undefined,
        }),
      }
    );

    // ========== SSE STREAM PROCESSING ==========
    // WHAT THIS SECTION DOES:
    // Uses the single source of truth function createChatSSEHandlers to handle thinking
    // This includes all thinking logic (start, chunk, end) in one place
    // Custom handlers are provided for editMessage-specific logic (branching, completion, etc.)
    
    const sseHandlers = createChatSSEHandlers({
      setIsThinking,
      setThinkingContent,
      setThinkingSteps,
      setShowInitialLoader,
      initialLoaderTimeoutRef,
      customHandlers: {
      // Handle user branch created event
        // WHAT THIS DOES: Only update if this conversation is still the active streaming conversation
      onUserBranchCreated: (data) => {
          if (activeStreamingConversationIdRef.current === conversationId) {
        const existingMessages = currentConversation?.messages || [];
        const nextMessages = [...existingMessages, data.userMessage];
        const updatedConversation = {
          ...currentConversation!,
          messages: nextMessages,
        };

        setCurrentConversation(updatedConversation);
        updateConversation(updatedConversation._id, { messages: nextMessages });

        setActiveBranches((prevSelection) => ({
          ...prevSelection,
          [parentMessageId]: data.branchMetadata.currentBranchIndex,
        }));

        setPendingEditedUserMessageId(data.userMessage.messageId);
          }
      },

      // Handle response complete
        // WHAT THIS DOES: Only process completion if this conversation is still the active streaming conversation
      onComplete: async (data) => {
          if (activeStreamingConversationIdRef.current === conversationId) {
            if (initialLoaderTimeoutRef.current) {
              clearTimeout(initialLoaderTimeoutRef.current);
              initialLoaderTimeoutRef.current = null;
            }
            setShowInitialLoader(false);
            setIsThinking(false);
            
        const convRes = await chatApi.getConversation(conversationId);
        const refreshedConversation = convRes.data.conversation;
        setCurrentConversation(refreshedConversation);
        updateConversation(refreshedConversation._id, {
          messages: refreshedConversation.messages,
          updatedAt: refreshedConversation.updatedAt,
        });

        if (data.branchMetadata && data.branchMetadata.parentMessageId !== undefined) {
          const branchParentId = data.branchMetadata.parentMessageId || 'root';
          setActiveBranches((prev) => ({
            ...prev,
            [branchParentId]: data.branchMetadata.currentBranchIndex,
            [data.branchMetadata.newUserMessageId]: 0,
          }));

          setPendingEditedUserMessageId(data.branchMetadata.newUserMessageId);
        }

        setEditingInProgress(false);
        setEditedContent('');
            
            // WHAT THIS DOES: Clear active streaming conversation ID since stream is complete
            activeStreamingConversationIdRef.current = null;
          }
      },

      // Handle errors
        // WHAT THIS DOES: Only process errors if this conversation is still the active streaming conversation
      onError: (error) => {
          if (activeStreamingConversationIdRef.current === conversationId) {
            if (initialLoaderTimeoutRef.current) {
              clearTimeout(initialLoaderTimeoutRef.current);
              initialLoaderTimeoutRef.current = null;
            }
            setShowInitialLoader(false);
            setIsThinking(false);
            
        console.error('Edit error:', error);
        alert(`Failed to edit prompt: ${error}`);
        setEditingInProgress(false);
        setPendingEditedUserMessageId(null);
            
            // WHAT THIS DOES: Clear active streaming conversation ID on error
            activeStreamingConversationIdRef.current = null;
          }
        },
      },
    });

    // Use shared SSE handler to process the stream
    await handleSSEStream(response, sseHandlers);
  } catch (error) {
    if (initialLoaderTimeoutRef.current) {
      clearTimeout(initialLoaderTimeoutRef.current);
      initialLoaderTimeoutRef.current = null;
    }
    setShowInitialLoader(false);
    setIsThinking(false);
    
    console.error('Failed to edit message:', error);
    alert('Failed to edit prompt. Please try again.');
    setEditingInProgress(false);
    setPendingEditedUserMessageId(null);
  }
}

