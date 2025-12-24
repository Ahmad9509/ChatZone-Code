// SSE (Server-Sent Events) utility service
// Provides helper functions for handling SSE streams

export interface SSEHandlers {
  onChunk?: (content: string) => void;
  onArtifactStart?: (meta: any) => void;
  onArtifactContent?: (content: string) => void;
  onArtifactComplete?: () => void;
  onArtifactSaved?: (artifactId: string) => void;
  onModelAutoSelected?: (modelName: string) => void;
  onDone?: (messageData: any) => void;
  onError?: (error: string) => void;
}

/**
 * Generic SSE stream handler
 * Processes EventSource messages and calls appropriate handlers
 */
export const handleSSEStream = (
  eventSource: EventSource,
  handlers: SSEHandlers
): void => {
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'chunk':
          handlers.onChunk?.(data.content);
          break;

        case 'artifact_start':
          handlers.onArtifactStart?.(data.meta);
          break;

        case 'artifact_content':
          handlers.onArtifactContent?.(data.content);
          break;

        case 'artifact_complete':
          handlers.onArtifactComplete?.();
          break;

        case 'artifact_saved':
          handlers.onArtifactSaved?.(data.artifactId);
          break;

        case 'model_auto_selected':
          handlers.onModelAutoSelected?.(data.modelName);
          break;

        case 'done':
          handlers.onDone?.(data);
          break;

        case 'error':
          handlers.onError?.(data.error);
          break;

        default:
          console.warn('Unknown SSE event type:', data.type);
      }
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
      handlers.onError?.('Failed to parse server message');
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error);
    handlers.onError?.('Connection error');
    eventSource.close();
  };
};

/**
 * Create an EventSource for chat streaming
 */
export const createChatSSE = (
  url: string,
  options?: { token?: string }
): EventSource => {
  const fullUrl = options?.token
    ? `${url}${url.includes('?') ? '&' : '?'}token=${options.token}`
    : url;
  
  return new EventSource(fullUrl);
};

/**
 * Cleanup SSE connection
 */
export const closeSSE = (eventSource: EventSource | null): void => {
  if (eventSource) {
    eventSource.close();
  }
};

