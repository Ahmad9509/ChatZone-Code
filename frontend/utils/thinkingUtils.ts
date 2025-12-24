// Thinking UI Utility - Single Source of Truth
// WHAT THIS FILE DOES:
// Provides a single function to determine when thinking UI should be displayed
// This prevents duplication and ensures thinking UI only shows for conversations with pending requests

/**
 * SINGLE SOURCE OF TRUTH: Determines if thinking UI should be shown
 * 
 * WHAT THIS FUNCTION DOES:
 * Checks if thinking UI should be displayed based on thinking state and conversation context
 * 
 * This function has TWO modes:
 * 1. Basic mode (for AssistantMessage): Just checks if thinking state exists
 *    - Used when displaying completed messages that might be regenerating
 * 2. Full mode (for MessageList): Also validates conversation has pending request
 *    - Used when displaying streaming messages to prevent showing thinking in wrong chats
 * 
 * @param params - Thinking state flags and optional conversation context
 * @returns true if thinking UI should be shown, false otherwise
 */
export function shouldShowThinkingUI(params: {
  // WHAT THESE DO: Required thinking state flags
  // These indicate if AI is currently thinking or showing initial loader
  isThinking: boolean;
  showInitialLoader: boolean;
  thinkingSteps: any[];
  
  // WHAT THESE DO: Optional conversation context for validation
  // If provided, function validates that THIS conversation has a pending request
  // If not provided, function just checks thinking state (for completed messages)
  currentConversation?: any;
  streaming?: boolean;
  streamedContent?: string;
}): boolean {
  // WHAT THIS DOES: First check if we have any thinking indicators at all
  // If no thinking state exists, don't show thinking UI regardless of conversation
  const hasThinkingState = params.isThinking || 
                          params.showInitialLoader || 
                          params.thinkingSteps.length > 0;
  
  // WHAT THIS DOES: If no thinking state, return false immediately
  // This prevents showing thinking UI when there's no thinking activity
  if (!hasThinkingState) {
    return false;
  }
  
  // WHAT THIS DOES: If conversation context is provided, validate it belongs to THIS conversation
  // This prevents showing "AI is thinking..." in chats that already have responses
  if (params.currentConversation !== undefined && 
      params.streamedContent !== undefined) {
    
    // WHAT THIS DOES: Get messages from current conversation
    const messages = params.currentConversation?.messages || [];
    
    // WHAT THIS DOES: Check if last message is from user (meaning no assistant response yet)
    // This indicates the conversation is waiting for a response
    const lastMessage = messages[messages.length - 1];
    const lastMessageIsUser = lastMessage?.role === 'user';
    
    // WHAT THIS DOES: Check if streaming is currently active for this conversation
    // Streaming is active if we have streamed content OR initial loader is showing
    // We infer streaming from streamedContent existence (if provided) or use explicit streaming flag
    const isStreamingActive = params.streaming !== undefined 
      ? params.streaming && (params.streamedContent.length > 0 || params.showInitialLoader)
      : params.streamedContent.length > 0 || params.showInitialLoader;
    
    // WHAT THIS DOES: Only show thinking UI if BOTH conditions are true:
    // 1. Last message is from user (conversation is waiting)
    // 2. Streaming is active (response is being generated)
    // This ensures thinking UI only shows for conversations with pending requests
    return lastMessageIsUser && isStreamingActive;
  }
  
  // WHAT THIS DOES: No conversation context provided (AssistantMessage case)
  // This is safe because AssistantMessage only shows thinking during regeneration
  // For completed messages, we just check if thinking state exists
  return true;
}

