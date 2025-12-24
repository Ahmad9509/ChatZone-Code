// Event Stream Types
// WHAT THIS FILE DOES:
// Defines types for tracking events (content chunks, thinking, tool calls) in chronological order
// This allows dynamic rendering based on when events arrive, not hardcoded positions

// WHAT THIS INTERFACE DOES:
// Represents a single event in the stream with timestamp and type-specific data
export interface EventStreamItem {
  timestamp: number; // When event arrived (Date.now())
  eventType: 'content_chunk' | 'thinking_start' | 'thinking_chunk' | 'thinking_end' | 'tool_call' | 'tool_call_complete';
  data: {
    // For content_chunk events
    content?: string;
    
    // For thinking events
    thinkingContent?: string;
    
    // For tool_call events
    toolName?: string;
    query?: string;
    
    // For tool_call_complete events
    results?: Array<{ title: string; url: string }>;
    resultsCount?: number;
  };
}

// WHAT THIS INTERFACE DOES:
// Event stream scoped to a specific message in a conversation
export interface MessageEventStream {
  conversationId: string;
  messageId: string; // userMessageId for assistant messages
  events: EventStreamItem[];
}

