'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { CopyIcon, CheckIcon, RefreshIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { markdownComponents } from '@/lib/markdown-config';
import { ThinkingUI } from './ThinkingUI';
import { shouldShowThinkingUI } from '@/utils/thinkingUtils';
import { EventStreamRenderer } from './EventStreamRenderer';
import { EventStreamItem, MessageEventStream } from '@/types/eventStream';

interface AssistantMessageProps {
  message: any;
  userMessageId: string;
  isRegenerating: boolean;
  regenerateStreamedContent: string;
  copiedMessageId: string | null;
  showRegenerateMenu: string | null;
  setShowRegenerateMenu: (id: string | null) => void;
  regenerateMenuRef: React.RefObject<HTMLDivElement | null>;
  regenerating: boolean;
  messages: any[];
  assistantBranchCount: number;
  activeAssistantBranchIndex: number;
  currentConversation: any;
  handleCopyMessage: (content: string, messageId: string) => void;
  handleRegenerateMessage: (msgIndex: number, directive: string) => void;
  handleBranchChange: (parentId: string, newIndex: number) => void;
  setCurrentArtifact: (artifact: any) => void;
  setShowArtifactPanel: (show: boolean) => void;
  setCurrentSources: (sources: any[]) => void;
  setShowSourcesPanel: (show: boolean) => void;
  handleCitationClick: (citationNum: number) => void;
  // WHAT THESE PROPS DO: Pass thinking state to display thinking UI
  isThinking?: boolean;
  thinkingContent?: string;
  thinkingSteps?: Array<{
    id: number;
    text: string;
    status: 'streaming' | 'complete';
    type?: 'thinking' | 'search';
    query?: string;
    results?: Array<{ title: string; url: string }>;
    resultsCount?: number;
  }>;
  showInitialLoader?: boolean;
}

export const AssistantMessage = ({
  message: activeAssistantMsg,
  userMessageId,
  isRegenerating,
  regenerateStreamedContent,
  copiedMessageId,
  showRegenerateMenu,
  setShowRegenerateMenu,
  regenerateMenuRef,
  regenerating,
  messages,
  assistantBranchCount,
  activeAssistantBranchIndex,
  currentConversation,
  handleCopyMessage,
  handleRegenerateMessage,
  handleBranchChange,
  setCurrentArtifact,
  setShowArtifactPanel,
  setCurrentSources,
  setShowSourcesPanel,
  handleCitationClick,
  // WHAT THESE PROPS DO: Receive thinking state from parent
  isThinking = false,
  thinkingContent = '',
  thinkingSteps = [],
  showInitialLoader = false,
}: AssistantMessageProps) => {
  // PERFORMANCE OPTIMIZATION: Lazy load eventStream on mount if hasThinking flag is set
  const [loadedEventStream, setLoadedEventStream] = useState<any[] | null>(null);
  const [isLoadingEventStream, setIsLoadingEventStream] = useState(false);
  
  useEffect(() => {
    // Fetch eventStream if message has thinking but eventStream not yet loaded
    if (
      activeAssistantMsg.hasThinking && 
      !activeAssistantMsg.eventStream && 
      !loadedEventStream &&
      !isLoadingEventStream &&
      currentConversation?._id &&
      activeAssistantMsg.messageId
    ) {
      setIsLoadingEventStream(true);
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat/messages/${activeAssistantMsg.messageId}/thinking?conversationId=${currentConversation._id}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      )
        .then(res => res.json())
        .then(data => {
          if (data.success && data.eventStream) {
            setLoadedEventStream(data.eventStream);
          }
        })
        .catch(error => {
          console.error('Failed to load thinking:', error);
        })
        .finally(() => {
          setIsLoadingEventStream(false);
        });
    }
  }, [activeAssistantMsg.hasThinking, activeAssistantMsg.eventStream, activeAssistantMsg.messageId, currentConversation?._id, loadedEventStream, isLoadingEventStream]);
  
  // WHAT THIS DOES: If regenerating but no content yet, show loading state immediately
  // This handles the case when user clicks regenerate button
  if (isRegenerating && !regenerateStreamedContent) {
    return (
      <div className="flex flex-col gap-3 animate-message-appear">
        <div className="flex items-center gap-2 text-text-secondary">
          <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full"></div>
          <span className="text-sm">Regenerating response...</span>
        </div>
      </div>
    );
  }

  // WHAT THIS DOES: Show thinking UI if thinking is active or initial loader is shown
  // This displays the thinking process above the main response
  // WHAT THIS DOES: Use single source of truth function to check if thinking UI should be shown
  // For AssistantMessage (completed messages), we don't pass conversation context
  // This is safe because thinking UI here is only shown during regeneration
  const shouldShowThinking = shouldShowThinkingUI({
    isThinking,
    showInitialLoader,
    thinkingSteps
  });

  // WHAT THIS DOES: Check if message has persisted eventStream from database
  // If it does, convert it to MessageEventStream format and extract thinking state
  // PERFORMANCE OPTIMIZATION: Use loadedEventStream if it was fetched on demand
  const eventStreamData = loadedEventStream || activeAssistantMsg.eventStream;
  let persistedEventStream: MessageEventStream | null = null;
  let persistedThinkingContent = '';
  let persistedThinkingSteps: Array<{
    id: number;
    text: string;
    status: 'streaming' | 'complete';
    type?: 'thinking' | 'search';
    query?: string;
    results?: Array<{ title: string; url: string }>;
    resultsCount?: number;
  }> = [];
  
  if (eventStreamData && Array.isArray(eventStreamData) && eventStreamData.length > 0) {
    // WHAT THIS DOES: Convert backend eventStream format to frontend MessageEventStream format
    const events: EventStreamItem[] = eventStreamData.map((event: any) => ({
      timestamp: event.timestamp || Date.now(),
      eventType: event.eventType,
      data: event.data || {}
    }));
    
    persistedEventStream = {
      conversationId: currentConversation?._id || '',
      messageId: userMessageId,
      events: events
    };
    
    // WHAT THIS DOES: Extract thinking content and steps from events for legacy ThinkingUI support
    // Accumulate all thinking_chunk events into thinkingContent
    persistedThinkingContent = events
      .filter(e => e.eventType === 'thinking_chunk')
      .map(e => e.data.thinkingContent || '')
      .join('');
    
    // WHAT THIS DOES: Build thinkingSteps from events
    // Track tool calls and thinking chunks to create steps
    // IMPORTANT: Include tool calls even if there's no thinking_start event
    let stepId = 0;
    let currentThinkingStep: { id: number; text: string; status: 'complete'; type: 'thinking' } | null = null;
    
    for (const event of events) {
      if (event.eventType === 'thinking_start') {
        // Start new thinking step
        currentThinkingStep = {
          id: stepId++,
          text: '',
          status: 'complete',
          type: 'thinking'
        };
        persistedThinkingSteps.push(currentThinkingStep);
      } else if (event.eventType === 'thinking_chunk' && currentThinkingStep) {
        // Append thinking content to current step
        currentThinkingStep.text += (event.data.thinkingContent || '');
      } else if (event.eventType === 'thinking_end') {
        // Complete current thinking step
        currentThinkingStep = null;
      } else if (event.eventType === 'tool_call') {
        // Create search step (even if no thinking_start event occurred)
        persistedThinkingSteps.push({
          id: stepId++,
          text: `Searching: ${event.data.query || ''}`,
          status: 'complete',
          type: 'search',
          query: event.data.query || (event.data.toolName === 'search_web' ? event.data.query : undefined)
        });
      } else if (event.eventType === 'tool_call_complete') {
        // Update search step with results
        const searchStep = persistedThinkingSteps.find(s => s.type === 'search' && s.query === event.data.query);
        if (searchStep) {
          searchStep.results = event.data.results || [];
          searchStep.resultsCount = event.data.resultsCount || 0;
        }
      }
    }
  }

  const displayContent = isRegenerating && regenerateStreamedContent 
    ? regenerateStreamedContent 
    : activeAssistantMsg.content;
  
  // Extract artifact info from content if present (for fallback support)
  let artifactFromContent: { title: string; type: string } | null = null;
  if (typeof displayContent === 'string') {
    // First try to detect <artifact> tags (before backend processing)
    const artifactTagMatch = displayContent.match(/<(ant)?[Aa]rtifact\s+([^>]+)>/);
    if (artifactTagMatch) {
      const attributes = artifactTagMatch[2];
      const titleMatch = attributes.match(/title=["']([^"']+)["']/);
      const typeMatch = attributes.match(/type=["']([^"']+)["']/);
      if (titleMatch && typeMatch) {
        artifactFromContent = { title: titleMatch[1], type: typeMatch[1] };
      }
    } else {
      // Fallback: Detect [Artifact: Title] pattern (after backend processing)
      const artifactTextMatch = displayContent.match(/\[Artifact:\s*([^\]]+)\]/);
      if (artifactTextMatch) {
        artifactFromContent = { title: artifactTextMatch[1].trim(), type: 'document' };
      }
    }
  }
  
  // Process citations BEFORE ReactMarkdown - convert to HTML sup tags
  // Also remove [Artifact: ...] text and <artifact> tags since they're redundant with the clickable box
  const processedContent = typeof displayContent === 'string' 
    ? displayContent
        .replace(/\[Artifact:([^\]]+)\]/g, '') // Remove [Artifact: ...] text
        .replace(/<(ant)?[Aa]rtifact\s+[^>]+>/g, '') // Remove opening <artifact> tag
        .replace(/<\/(ant)?[Aa]rtifact>/g, '') // Remove closing </artifact> tag
        .replace(/\[(\d+)\]/g, (match, num) => 
          `<sup class="citation-marker inline-flex items-center justify-center w-5 h-5 ml-0.5 text-[10px] font-semibold text-accent bg-accent/10 rounded cursor-pointer hover:bg-accent/20 transition-colors" data-citation="${num}" style="vertical-align: super; font-size: 0.7em;">${num}</sup>`
        )
        .trim() // Clean up any extra whitespace
    : displayContent;

  const handleArtifactClick = () => {
    // If we have artifactId, fetch from database
    if (activeAssistantMsg.artifactId && currentConversation?._id) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/artifacts/${activeAssistantMsg.artifactId}?conversationId=${currentConversation._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.artifact) {
            setCurrentArtifact({
              _id: data.artifact.rowKey,
              type: data.artifact.type,
              title: data.artifact.title,
              language: data.artifact.language,
              content: data.artifact.content,
              version: data.artifact.version,
              messageId: data.artifact.messageId,
              conversationId: data.artifact.conversationId || currentConversation._id,
            });
            setShowArtifactPanel(true);
          }
        })
        .catch(err => console.error('Failed to load artifact:', err));
    } else if (artifactFromContent && currentConversation?._id) {
      // Fallback: Fetch artifact from conversation by title match
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/conversations/${currentConversation._id}/artifacts`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.artifacts && data.artifacts.length > 0) {
            // Find artifact by title match
            const matchingArtifact = data.artifacts.find((a: any) => 
              a.title === artifactFromContent.title
            );
            if (matchingArtifact) {
              setCurrentArtifact({
                _id: matchingArtifact.rowKey || matchingArtifact._id,
                type: matchingArtifact.type,
                title: matchingArtifact.title,
                language: matchingArtifact.language,
                content: matchingArtifact.content,
                version: matchingArtifact.version || 0,
                messageId: matchingArtifact.messageId || activeAssistantMsg.messageId,
                conversationId: matchingArtifact.conversationId || currentConversation._id,
              });
              setShowArtifactPanel(true);
            }
          }
        })
        .catch(err => console.error('Failed to load artifacts:', err));
    }
  };

  const handleSourcesClick = async () => {
    // PERFORMANCE OPTIMIZATION: Lazy load sources on demand
    // Check if sources already loaded (from streaming or previous fetch)
    if (activeAssistantMsg.sources) {
    const parsedSources = typeof activeAssistantMsg.sources === 'string' 
      ? JSON.parse(activeAssistantMsg.sources) 
      : activeAssistantMsg.sources;
    setCurrentSources(parsedSources);
    setShowSourcesPanel(true);
      return;
    }
    
    // Sources not loaded yet - fetch from backend
    if (activeAssistantMsg.hasSourcesCount && activeAssistantMsg.hasSourcesCount > 0 && currentConversation?._id) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/chat/messages/${activeAssistantMsg.messageId}/sources?conversationId=${currentConversation._id}`,
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          }
        );
        const data = await response.json();
        if (data.success && data.sources) {
          setCurrentSources(data.sources);
          setShowSourcesPanel(true);
        }
      } catch (error) {
        console.error('Failed to load sources:', error);
      }
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('citation-marker')) {
      e.preventDefault();
      const citationNum = parseInt(target.getAttribute('data-citation') || '0');
      if (citationNum && activeAssistantMsg.sources) {
        const parsedSources = typeof activeAssistantMsg.sources === 'string' 
          ? JSON.parse(activeAssistantMsg.sources) 
          : activeAssistantMsg.sources;
        setCurrentSources(parsedSources);
        handleCitationClick(citationNum);
      }
    }
  };

  // Parse sources for display - handle both loaded sources and hasSourcesCount
  const parsedSources = activeAssistantMsg.sources 
    ? (typeof activeAssistantMsg.sources === 'string' 
        ? JSON.parse(activeAssistantMsg.sources) 
        : activeAssistantMsg.sources)
    : null;
  
  // PERFORMANCE OPTIMIZATION: Show source count from backend if sources not loaded yet
  const sourcesCount = parsedSources ? parsedSources.length : (activeAssistantMsg.hasSourcesCount || 0);

  return (
    <div key={`assistant-${userMessageId}-${activeAssistantMsg.messageId}`} className="flex flex-col gap-3 animate-message-appear">
      {/* WHAT THIS SECTION DOES: Render thinking UI inside message container (not above) */}
      {/* Shows thinking process when thinking events arrive - no hardcoded positioning */}
      {/* WHAT THIS DOES: Use EventStreamRenderer for persisted messages with eventStream */}
      {/* Otherwise fall back to legacy ThinkingUI for regeneration */}
      {persistedEventStream ? (
        <EventStreamRenderer
          events={persistedEventStream.events}
          isThinking={false}
          thinkingContent={persistedThinkingContent}
          thinkingSteps={persistedThinkingSteps}
          onContentClick={handleContentClick}
        />
      ) : shouldShowThinking ? (
        <ThinkingUI
          isThinking={isThinking}
          thinkingContent={thinkingContent}
          thinkingSteps={thinkingSteps}
          showInitialLoader={showInitialLoader}
        />
      ) : null}
      
      {/* WHAT THIS DOES: Render message content */}
      {/* If eventStream exists, EventStreamRenderer already rendered content, so skip here */}
      {!persistedEventStream && (
      <div 
        className="prose prose-sm max-w-none break-words text-text-primary rounded-2xl bg-surface-subtle px-5 py-4 leading-[1.7] soft-elevated neumorphic-transition hover:soft-hover"
        onClick={handleContentClick}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={markdownComponents}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
      )}
      {isRegenerating && regenerateStreamedContent && (
        <div className="text-sm text-accent">▌</div>
      )}
      
      {/* Artifact attachment - clickable box to reopen */}
      {(activeAssistantMsg.artifactId || artifactFromContent) && (
        <button
          onClick={handleArtifactClick}
          className="mt-3 flex items-center gap-3 rounded-2xl border-0 bg-surface hover:bg-surface-subtle px-4 py-3 transition-colors w-full text-left group soft-elevated neumorphic-transition hover:soft-hover"
        >
          <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-text-primary truncate">
              {artifactFromContent?.title || 'View Artifact'}
            </div>
            <div className="text-xs text-text-secondary">
              {artifactFromContent?.type || 'Document'} • Click to view in split-screen
            </div>
          </div>
          <svg className="w-4 h-4 text-text-secondary group-hover:text-accent transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      
      {!isRegenerating && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => handleCopyMessage(activeAssistantMsg.content, activeAssistantMsg.messageId)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-subtle hover:text-text-primary transition-colors soft-elevated neumorphic-transition hover:soft-hover"
            aria-label={copiedMessageId === activeAssistantMsg.messageId ? 'Copied' : 'Copy'}
          >
            {copiedMessageId === activeAssistantMsg.messageId ? (
              <CheckIcon className="h-4 w-4" />
            ) : (
              <CopyIcon className="h-4 w-4" />
            )}
          </button>

          {/* Sources button - shows when message has web search sources */}
          {sourcesCount > 0 && (
            <button
              onClick={handleSourcesClick}
              className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-subtle hover:text-text-primary transition-colors soft-elevated neumorphic-transition hover:soft-hover"
              aria-label="View sources"
            >
              <span>🔍</span>
              <span>{sourcesCount} {sourcesCount === 1 ? 'source' : 'sources'}</span>
            </button>
          )}

          <div className="relative" ref={showRegenerateMenu === activeAssistantMsg.messageId ? regenerateMenuRef : null}>
            <button
              onClick={() => setShowRegenerateMenu(showRegenerateMenu === activeAssistantMsg.messageId ? null : activeAssistantMsg.messageId)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-subtle hover:text-text-primary transition-colors soft-elevated neumorphic-transition hover:soft-hover"
              aria-label="Regenerate"
              disabled={regenerating}
            >
              <RefreshIcon className="h-4 w-4" />
            </button>

            {showRegenerateMenu === activeAssistantMsg.messageId && (
              <div className="absolute left-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-2xl border-0 bg-surface soft-elevated">
                <button
                  onClick={() => {
                    const msgIndex = messages.findIndex((m: any) => m.messageId === activeAssistantMsg.messageId);
                    handleRegenerateMessage(msgIndex, 'try_again');
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-subtle neumorphic-transition"
                >
                  Try again
                </button>
                <button
                  onClick={() => {
                    const msgIndex = messages.findIndex((m: any) => m.messageId === activeAssistantMsg.messageId);
                    handleRegenerateMessage(msgIndex, 'add_details');
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-subtle neumorphic-transition"
                >
                  Add details
                </button>
                <button
                  onClick={() => {
                    const msgIndex = messages.findIndex((m: any) => m.messageId === activeAssistantMsg.messageId);
                    handleRegenerateMessage(msgIndex, 'more_concise');
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-subtle neumorphic-transition"
                >
                  More concise
                </button>
                <button
                  onClick={() => {
                    const msgIndex = messages.findIndex((m: any) => m.messageId === activeAssistantMsg.messageId);
                    handleRegenerateMessage(msgIndex, 'search_web');
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-subtle neumorphic-transition"
                >
                  Search the web
                </button>
                {activeAssistantMsg.artifactId && (
                  <button
                    onClick={() => {
                      const msgIndex = messages.findIndex((m: any) => m.messageId === activeAssistantMsg.messageId);
                      handleRegenerateMessage(msgIndex, 'answer_in_chat');
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-subtle border-t border-border neumorphic-transition"
                  >
                    Answer in Chat
                  </button>
                )}
              </div>
            )}
          </div>

          {assistantBranchCount > 1 && (
            <div className="flex items-center gap-1 ml-2 text-xs text-text-secondary">
              <button
                onClick={() => handleBranchChange(userMessageId, Math.max(0, activeAssistantBranchIndex - 1))}
                disabled={activeAssistantBranchIndex === 0}
                className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed soft-elevated neumorphic-transition hover:soft-hover"
                aria-label="Previous branch"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="px-1">{activeAssistantBranchIndex + 1} / {assistantBranchCount}</span>
              <button
                onClick={() => handleBranchChange(userMessageId, Math.min(assistantBranchCount - 1, activeAssistantBranchIndex + 1))}
                disabled={activeAssistantBranchIndex === assistantBranchCount - 1}
                className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed soft-elevated neumorphic-transition hover:soft-hover"
                aria-label="Next branch"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};



