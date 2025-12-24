// Message regeneration service - handles regenerating AI responses with SSE streaming
import { chat as chatApi } from '@/lib/api';
import { handleSSEStream, createChatSSEHandlers } from '@/lib/sseHandler';

interface RegenerateMessageParams {
  // Current state
  currentConversation: any;
  regenerating: boolean;
  selectedModel: string;
  messageIndex: number;
  directive: string;
  
  // State setters
  setRegenerating: (val: boolean) => void;
  setRegenerateStreamedContent: (val: string | ((prev: string) => string)) => void;
  setRegeneratingForParentId: (id: string | null) => void;
  setShowRegenerateMenu: (id: string | null) => void;
  setCurrentConversation: (conv: any) => void;
  setActiveBranches: (branches: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  
  // Thinking state setters
  setIsThinking: (thinking: boolean) => void;
  setThinkingContent: (content: string) => void;
  setThinkingSteps: (steps: any[] | ((prev: any[]) => any[])) => void;
  setShowInitialLoader: (show: boolean) => void;
  
  // Store actions
  updateConversation: (id: string, updates: any) => void;
  activeStreamingConversationIdRef: React.MutableRefObject<string | null>;
}

export async function regenerateMessage(params: RegenerateMessageParams): Promise<void> {
  const {
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
  } = params;

  if (!currentConversation || regenerating) return;

  // Find the parent message ID for this assistant message
  const messages = currentConversation.messages || [];
  const targetMessage = messages[messageIndex];
  
  if (!targetMessage || !targetMessage.parentMessageId) {
    console.error('Cannot regenerate: message has no parent');
    return;
  }

  const parentMessageId = targetMessage.parentMessageId;

  // Optimistically clear any descendant messages tied to this assistant branch before streaming
  const descendantIds = new Set<string>();
  const stack: string[] = [];

  if (targetMessage.messageId) {
    stack.push(targetMessage.messageId);
  }

  while (stack.length > 0) {
    const currentParentId = stack.pop();
    if (!currentParentId) continue;

    messages.forEach((msg: any) => {
      if (msg.parentMessageId === currentParentId && msg.messageId) {
        if (!descendantIds.has(msg.messageId)) {
          descendantIds.add(msg.messageId);
          stack.push(msg.messageId);
        }
      }
    });
  }

  if (descendantIds.size > 0) {
    const prunedMessages = messages.filter((msg: any) => {
      if (!msg.messageId) return true;
      if (descendantIds.has(msg.messageId)) return false;
      return true;
    });

    const removedUserIds: string[] = [];
    descendantIds.forEach((id) => {
      const removedMsg = messages.find((msg: any) => msg.messageId === id);
      if (removedMsg?.role === 'user' && removedMsg.messageId) {
        removedUserIds.push(removedMsg.messageId);
      }
    });

    const updatedConversation = {
      ...currentConversation,
      messages: prunedMessages,
    };

    setCurrentConversation(updatedConversation);
    updateConversation(updatedConversation._id, {
      messages: prunedMessages,
      updatedAt: updatedConversation.updatedAt,
    });

    if (removedUserIds.length > 0) {
      setActiveBranches((prev) => {
        const next = { ...prev };
        removedUserIds.forEach((userId) => {
          if (userId in next) {
            delete next[userId];
          }
        });
        return next;
      });
    }
  }

  setShowRegenerateMenu(null);
  setRegenerating(true);
  setRegenerateStreamedContent('');
  setRegeneratingForParentId(parentMessageId);

  // WHAT THIS DOES: Store conversation ID as active streaming conversation
  // This is the SINGLE SOURCE OF TRUTH for which conversation is streaming
  const conversationId = currentConversation._id;
  activeStreamingConversationIdRef.current = conversationId;

  // WHAT THIS DOES: Reset thinking state when regenerating
  // Clear any previous thinking content and steps
  setIsThinking(false);
  setThinkingContent('');
  setThinkingSteps([]);
  
  // WHAT THIS DOES: Show initial loader immediately when regenerating
  // This gives immediate feedback that AI is processing
  const initialLoaderTimeoutRef = { current: null as NodeJS.Timeout | null };
  setShowInitialLoader(true); // Show immediately, no delay

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'https://chatzone-api-b8h3g0c4hydccrcy.eastus-01.azurewebsites.net'}/api/chat/conversations/${conversationId}/regenerate/${messageIndex}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          model: selectedModel !== 'auto' ? selectedModel : undefined,
          directive,
        }),
        keepalive: true, // WHAT THIS DOES: Keep connection alive for slow models - prevents browser from timing out
      }
    );

    // ========== SSE STREAM PROCESSING ==========
    // WHAT THIS SECTION DOES:
    // Uses the single source of truth function createChatSSEHandlers to handle thinking
    // This includes all thinking logic (start, chunk, end) in one place
    // Custom handlers are provided for regenerate-specific logic (pruned descendants, branching, etc.)
    
    const sseHandlers = createChatSSEHandlers({
      setIsThinking,
      setThinkingContent,
      setThinkingSteps,
      setShowInitialLoader,
      initialLoaderTimeoutRef,
      customHandlers: {
      // Handle new content chunks from AI
        // WHAT THIS DOES: Only update regenerateStreamedContent if this conversation is still the active streaming conversation
      onChunk: (content) => {
          if (activeStreamingConversationIdRef.current === conversationId) {
        setRegenerateStreamedContent((prev) => prev + content);
          }
      },

      // Handle pruned descendants (old branches being removed)
        // WHAT THIS DOES: Only update if this conversation is still the active streaming conversation
      onPrunedDescendants: (data) => {
          if (activeStreamingConversationIdRef.current === conversationId) {
        if (Array.isArray(data.removedUserMessageIds) && data.removedUserMessageIds.length > 0) {
          setActiveBranches((prev) => {
            const next = { ...prev };
            data.removedUserMessageIds.forEach((id: string) => {
              if (id in next) {
                delete next[id];
              }
            });
            return next;
          });
            }
        }
      },

      // Handle response complete
        // WHAT THIS DOES: Only process completion if this conversation is still the active streaming conversation
      onComplete: async (data) => {
          if (activeStreamingConversationIdRef.current === conversationId) {
            // WHAT THIS DOES: Clear initial loader timeout if still pending
            if (initialLoaderTimeoutRef.current) {
              clearTimeout(initialLoaderTimeoutRef.current);
              initialLoaderTimeoutRef.current = null;
            }
            setShowInitialLoader(false);
            
        // Reload conversation to get updated branch data
        const convRes = await chatApi.getConversation(conversationId);
        const refreshedConversation = convRes.data.conversation;
        setCurrentConversation(refreshedConversation);
        updateConversation(refreshedConversation._id, {
          messages: refreshedConversation.messages,
          updatedAt: refreshedConversation.updatedAt,
        });

        // Set active branch to the newly regenerated one
        if (data.branchMetadata && data.branchMetadata.parentMessageId) {
          setActiveBranches((prev) => ({
            ...prev,
            [data.branchMetadata.parentMessageId]: data.branchMetadata.currentBranchIndex,
          }));
        }

            setRegenerating(false);
        setRegenerateStreamedContent('');
        setRegeneratingForParentId(null);
            
            // WHAT THIS DOES: Keep thinking steps visible but clear active thinking state
            setIsThinking(false);
            
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
            
        console.error('Regenerate error:', error);
        alert(`Failed to regenerate: ${error}`);
            setRegenerating(false);
            setRegenerateStreamedContent('');
        setRegeneratingForParentId(null);
            
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
    
    console.error('Failed to regenerate message:', error);
    alert('Failed to regenerate message. Please try again.');
    setRegeneratingForParentId(null);
  } finally {
    setRegenerating(false);
  }
}

