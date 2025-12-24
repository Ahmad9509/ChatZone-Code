// SSE Stream Handler - Reusable SSE (Server-Sent Events) stream reading logic
// This module handles reading and parsing SSE streams from the backend
// Used by: handleSendMessage, handleRegenerateMessage, handleEditMessage

/**
 * Callback functions for different SSE event types
 * Each handler receives the parsed event data
 */
import { EventStreamItem } from '@/types/eventStream';

export interface SSEHandlers {
  onChunk?: (content: string) => void;                    // New content chunk from AI
  onModelSwitched?: (data: { modelId: string; modelName: string; message: string }) => void;  // Model auto-switched for Pro Search
  onThinkingStart?: (data: { inferredStart?: boolean }) => void;  // Thinking stream started
  onThinkingChunk?: (content: string) => void;            // Thinking content chunk
  onThinkingEnd?: (data: { endedByStream?: boolean; inferredStart?: boolean }) => void;  // Thinking stream ended
  onArtifactStart?: (artifact: { type: string; title: string; language?: string }) => void;  // Artifact streaming started
  onArtifactContent?: (content: string) => void;          // Artifact content chunk
  onArtifactComplete?: () => void;                        // Artifact streaming finished
  onArtifactSaved?: (artifact: any) => void;              // Artifact saved to database
  onArtifactCreated?: (artifact: any) => void;            // Legacy: artifact created (non-streaming)
  onUserBranchCreated?: (data: { userMessage: any; branchMetadata: any }) => void;  // Edit message: user branch created
  onPrunedDescendants?: (data: { parentMessageId: string; removedUserMessageIds: string[] }) => void;  // Regenerate: old branches removed
  onToolCall?: (data: { tool: string; query: string }) => void;  // Tool call started (e.g., search_web)
  onToolCallComplete?: (data: { tool: string; query: string; resultsCount: number; results: Array<{ title: string; url: string }> }) => void;  // Tool call completed with results
  // Research-specific handlers
  onResearchPlanningStart?: () => void;                    // Research planning started
  onResearchPlanCreated?: (data: { queries: string[]; queryCount: number }) => void;  // Research plan created
  onResearchSearchStart?: (data: { query: string; index: number; total: number }) => void;  // Search started
  onResearchSearchComplete?: (data: { query: string; resultCount: number; index: number; total: number }) => void;  // Search completed
  onResearchSearchesComplete?: (data: { totalSources: number }) => void;  // All searches completed
  onResearchGeneratingStart?: (data: { sourceCount: number }) => void;  // Document generation started
  onPPTTemplateRequired?: () => void;                     // PPT template selection required
  onComplete?: (data: { message: any; conversation?: any; branchMetadata?: any }) => void;  // Response complete
  onError?: (error: string) => void;                      // Error occurred
}

/**
 * Handles reading and parsing an SSE stream from the backend
 * 
 * This function:
 * 1. Gets a reader from the response body
 * 2. Decodes the stream chunks
 * 3. Parses SSE "data:" lines
 * 4. Calls the appropriate handler for each event type
 * 
 * @param response - The fetch Response object with SSE stream
 * @param handlers - Object with callback functions for each event type
 */
/**
 * Parameters for createChatSSEHandlers function
 * This is the single source of truth for thinking handlers
 */
export interface CreateChatSSEHandlersParams {
  // Thinking state setters
  setIsThinking: (thinking: boolean) => void;
  setThinkingContent: (content: string | ((prev: string) => string)) => void;
  setThinkingSteps: (steps: any[] | ((prev: any[]) => any[])) => void;
  setShowInitialLoader: (show: boolean) => void;
  initialLoaderTimeoutRef: { current: NodeJS.Timeout | null };
  
  // Event stream tracking (for dynamic rendering)
  addEventToStream?: (event: EventStreamItem) => void;
  
  // Custom handlers that can override default behavior
  customHandlers?: Partial<SSEHandlers>;
}

/**
 * Creates chat SSE handlers with thinking support
 * This is the SINGLE SOURCE OF TRUTH for thinking handler logic
 * Used by: sendMessage, editMessage, regenerateMessage
 * 
 * This function:
 * 1. Creates thinking handlers that manage thinking state
 * 2. Parses thinking content into steps
 * 3. Manages initial loader timeout
 * 4. Allows custom handlers to override or extend default behavior
 * 
 * @param params - Parameters including thinking state setters and custom handlers
 * @returns SSEHandlers object with thinking support
 */
export function createChatSSEHandlers(params: CreateChatSSEHandlersParams): SSEHandlers {
  const {
    setIsThinking,
    setThinkingContent,
    setThinkingSteps,
    setShowInitialLoader,
    initialLoaderTimeoutRef,
    addEventToStream,
    customHandlers = {},
  } = params;

  // ========== THINKING HANDLERS ==========
  // WHAT THIS SECTION DOES:
  // Creates handlers for AI thinking events (thinking_start, thinking_chunk, thinking_end)
  // These handlers manage thinking state and parse thinking content into steps

  const thinkingHandlers: SSEHandlers = {
    // WHAT THIS HANDLER DOES: Called when thinking stream starts
    // Backend sends thinking_start event when AI begins thinking
    onThinkingStart: (data) => {
      // WHAT THIS DOES: Clear initial loader since thinking has started
      if (initialLoaderTimeoutRef.current) {
        clearTimeout(initialLoaderTimeoutRef.current);
        initialLoaderTimeoutRef.current = null;
      }
      setShowInitialLoader(false);
      
      // WHAT THIS DOES: Mark that thinking is now active
      setIsThinking(true);
      
      // WHAT THIS DOES: Reset thinking content and create initial thinking step
      setThinkingContent('');
      setThinkingSteps([{
        id: 1,
        text: 'Analyzing request...',
        status: 'streaming' as const,
        type: 'thinking' as const
      }]);
      
      // WHAT THIS DOES: Add thinking_start event to stream for chronological rendering
      if (addEventToStream) {
        addEventToStream({
          timestamp: Date.now(),
          eventType: 'thinking_start',
          data: {},
        });
      }
    },

    // WHAT THIS HANDLER DOES: Called for each chunk of thinking content
    // Backend sends thinking_chunk events as AI streams thinking text
    onThinkingChunk: (content) => {
      // WHAT THIS DOES: Clear initial loader since we're receiving content
      if (initialLoaderTimeoutRef.current) {
        clearTimeout(initialLoaderTimeoutRef.current);
        initialLoaderTimeoutRef.current = null;
      }
      setShowInitialLoader(false);
      
      // WHAT THIS DOES: Accumulate thinking content and update current thinking step
      setThinkingContent((prev) => {
        const newContent = prev + content;
        
        // WHAT THIS DOES: Update the current thinking step with accumulated content
        // Use last 200 chars or first line as step text for better visibility
        setThinkingSteps((prevSteps) => {
          if (prevSteps.length > 0) {
            const lastStep = prevSteps[prevSteps.length - 1];
            if (lastStep && lastStep.status === 'streaming' && lastStep.type === 'thinking') {
              const firstLine = newContent.split('\n')[0];
              const stepText = firstLine.length > 200 ? firstLine.substring(0, 200) + '...' : firstLine;
              return prevSteps.map((step, idx) =>
                idx === prevSteps.length - 1
                  ? { ...step, text: stepText || 'Thinking...' }
                  : step
              );
            }
          }
          return prevSteps;
        });
        
        return newContent;
      });
      
      // WHAT THIS DOES: Add thinking_chunk event to stream for chronological rendering
      if (addEventToStream) {
        addEventToStream({
          timestamp: Date.now(),
          eventType: 'thinking_chunk',
          data: { thinkingContent: content },
        });
      }
    },

    // WHAT THIS HANDLER DOES: Called when thinking stream ends
    // Backend sends thinking_end event when AI finishes thinking
    onThinkingEnd: (data) => {
      // WHAT THIS DOES: Clear initial loader
      if (initialLoaderTimeoutRef.current) {
        clearTimeout(initialLoaderTimeoutRef.current);
        initialLoaderTimeoutRef.current = null;
      }
      setShowInitialLoader(false);
      
      // WHAT THIS DOES: Mark last step as complete
      setThinkingSteps((prevSteps) => {
        if (prevSteps.length > 0) {
          const lastStep = prevSteps[prevSteps.length - 1];
          if (lastStep.status === 'streaming') {
            return prevSteps.map((step, idx) =>
              idx === prevSteps.length - 1
                ? { ...step, status: 'complete' as const }
                : step
            );
          }
        }
        return prevSteps;
      });
      
      // WHAT THIS DOES: Mark thinking as complete
      setIsThinking(false);
      
      // WHAT THIS DOES: Keep thinking content visible but mark as complete
      // User can still expand to see thinking steps
      
      // WHAT THIS DOES: Add thinking_end event to stream for chronological rendering
      if (addEventToStream) {
        addEventToStream({
          timestamp: Date.now(),
          eventType: 'thinking_end',
          data: {},
        });
      }
    },

    // WHAT THIS HANDLER DOES: Called when AI uses a tool (e.g., web search)
    // Backend sends tool_call event when AI calls search_web or other tools
    // This is the SINGLE SOURCE OF TRUTH for displaying web searches
    onToolCall: (data) => {
      // WHAT THIS DOES: Clear initial loader since activity is happening
      if (initialLoaderTimeoutRef.current) {
        clearTimeout(initialLoaderTimeoutRef.current);
        initialLoaderTimeoutRef.current = null;
      }
      setShowInitialLoader(false);
      
      // WHAT THIS DOES: Mark previous step as complete before adding search step
      setThinkingSteps((prevSteps) => {
        const updatedSteps = prevSteps.map((step, idx) => 
          idx === prevSteps.length - 1 && step.status === 'streaming'
            ? { ...step, status: 'complete' as const }
            : step
        );
        
        // WHAT THIS DOES: Add new search step to show the web search
        // This creates a visible step in the thinking UI
        return [
          ...updatedSteps,
          {
            id: Date.now(), // Use timestamp as unique ID for search steps
            text: `Searching: ${data.query}`,
            status: 'streaming' as const,
            type: 'search' as const,
            query: data.query,
            // Results will be populated when search completes (backend doesn't send results count in tool_call event)
          },
        ];
      });
      
      // WHAT THIS DOES: Keep thinking UI visible while search is happening
      // Don't set isThinking to false - let it stay active during searches
      
      // WHAT THIS DOES: Add tool_call event to stream for chronological rendering
      if (addEventToStream) {
        addEventToStream({
          timestamp: Date.now(),
          eventType: 'tool_call',
          data: {
            toolName: data.tool,
            query: data.query,
          },
        });
      }
    },

    // WHAT THIS HANDLER DOES: Called when tool call completes with results
    // Backend sends tool_call_complete event after search finishes
    // This is the SINGLE SOURCE OF TRUTH for marking searches as complete
    onToolCallComplete: (data) => {
      // WHAT THIS DOES: Update the search step to mark it as complete
      // Change from spinning animation to checkmark, add results count and URLs
      setThinkingSteps((prevSteps) => {
        return prevSteps.map((step) => {
          // WHAT THIS DOES: Find the search step that matches this query
          // Update it with completion status and results
          if (step.type === 'search' && step.query === data.query && step.status === 'streaming') {
            return {
              ...step,
              status: 'complete' as const,
              text: `Searched: ${data.query}`,
              resultsCount: data.resultsCount,
              results: data.results
            };
          }
          return step;
        });
      });
      
      // WHAT THIS DOES: Add tool_call_complete event to stream for chronological rendering
      if (addEventToStream) {
        addEventToStream({
          timestamp: Date.now(),
          eventType: 'tool_call_complete',
          data: {
            toolName: data.tool,
            query: data.query,
            resultsCount: data.resultsCount,
            results: data.results,
          },
        });
      }
    },
  };

  // ========== MERGE WITH CUSTOM HANDLERS ==========
  // WHAT THIS SECTION DOES:
  // Merges thinking handlers with any custom handlers provided by the caller
  // Custom handlers can add additional logic or override default behavior
  // Also wraps onChunk handler to add content_chunk events to stream
  const wrappedHandlers: SSEHandlers = {
    ...thinkingHandlers,
    ...customHandlers,
  };
  
  // WHAT THIS DOES: Wrap onChunk handler to add content_chunk events to stream
  if (customHandlers.onChunk) {
    const originalOnChunk = customHandlers.onChunk;
    wrappedHandlers.onChunk = (content: string) => {
      // WHAT THIS DOES: Call original handler first
      originalOnChunk(content);
      
      // WHAT THIS DOES: Add content_chunk event to stream for chronological rendering
      if (addEventToStream) {
        addEventToStream({
          timestamp: Date.now(),
          eventType: 'content_chunk',
          data: { content },
        });
      }
    };
  }
  
  return wrappedHandlers;
}

export async function handleSSEStream(
  response: Response,
  handlers: SSEHandlers
): Promise<void> {
  // Get reader to read the stream
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  // Decoder to convert bytes to text
  const decoder = new TextDecoder();

  // Read stream until done
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decode chunk and split into lines
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    // Process each line
    for (const line of lines) {
      // SSE lines start with "data: "
      if (line.startsWith('data: ')) {
        try {
          // Parse JSON data after "data: " prefix
          const data = JSON.parse(line.substring(6));

          // Call appropriate handler based on event type
          switch (data.type) {
            case 'chunk':
              handlers.onChunk?.(data.content);
              break;

            case 'model_switched':
              handlers.onModelSwitched?.(data);
              break;

            case 'thinking_start':
              handlers.onThinkingStart?.(data);
              break;

            case 'thinking_chunk':
              handlers.onThinkingChunk?.(data.content);
              break;

            case 'thinking_end':
              handlers.onThinkingEnd?.(data);
              break;

            case 'artifact_start':
              handlers.onArtifactStart?.(data.artifact);
              break;

            case 'artifact_content':
              handlers.onArtifactContent?.(data.content);
              break;

            case 'artifact_complete':
              handlers.onArtifactComplete?.();
              break;

            case 'artifact_saved':
              handlers.onArtifactSaved?.(data.artifact);
              break;

            case 'artifact_created':
              handlers.onArtifactCreated?.(data.artifact);
              break;

            case 'user_branch_created':
              handlers.onUserBranchCreated?.(data);
              break;

            case 'pruned_descendants':
              handlers.onPrunedDescendants?.(data);
              break;

            case 'tool_call':
              handlers.onToolCall?.(data);
              break;

            case 'tool_call_complete':
              handlers.onToolCallComplete?.(data);
              break;

            // Research-specific events
            case 'research_planning_start':
              handlers.onResearchPlanningStart?.();
              break;

            case 'research_plan_created':
              handlers.onResearchPlanCreated?.(data);
              break;

            case 'research_search_start':
              handlers.onResearchSearchStart?.(data);
              break;

            case 'research_search_complete':
              handlers.onResearchSearchComplete?.(data);
              break;

            case 'research_searches_complete':
              handlers.onResearchSearchesComplete?.(data);
              break;

            case 'research_generating_start':
              handlers.onResearchGeneratingStart?.(data);
              break;

            case 'ppt_template_select_required':
              handlers.onPPTTemplateRequired?.();
              break;

            case 'complete':
              handlers.onComplete?.(data);
              break;

            case 'error':
              handlers.onError?.(data.error);
              break;

            default:
              // Unknown event type - ignore
              console.warn('Unknown SSE event type:', data.type);
              break;
          }
        } catch (e) {
          // Skip invalid JSON lines
          console.warn('Failed to parse SSE line:', line, e);
        }
      }
    }
  }
}

