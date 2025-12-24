// EventStreamRenderer Component
// WHAT THIS COMPONENT DOES:
// Renders events in chronological order as they arrive
// Supports: content chunks, thinking events, tool calls
// No hardcoded positioning - renders based on event order

'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { EventStreamItem } from '@/types/eventStream';
import { ThinkingUI } from '@/components/chat/ThinkingUI';

interface EventStreamRendererProps {
  events: EventStreamItem[];
  // Legacy props for backward compatibility during migration
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
  // WHAT THIS PROP DOES: Handle citation clicks in rendered content
  onContentClick?: (e: React.MouseEvent) => void;
}

export function EventStreamRenderer({
  events,
  isThinking = false,
  thinkingContent = '',
  thinkingSteps = [],
  onContentClick,
}: EventStreamRendererProps) {
  // WHAT THIS DOES: Render events in strict chronological order as they happened
  // Content chunks render where they appear, thinking UI appears when thinking/tool events occur
  
  // WHAT THIS DOES: Sort events by timestamp to ensure chronological order
  const sortedEvents = [...events].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  
  // WHAT THIS DOES: Check if thinking should be shown (has thinking events, tool calls, or active thinking state)
  const hasThinkingEvents = sortedEvents.some(e => 
    e.eventType === 'thinking_start' || 
    e.eventType === 'thinking_chunk' || 
    e.eventType === 'thinking_end' ||
    e.eventType === 'tool_call' ||
    e.eventType === 'tool_call_complete'
  );
  const shouldShowThinking = hasThinkingEvents || isThinking || thinkingSteps.length > 0;
  
  // WHAT THIS DOES: Render events in chronological order
  const renderedElements: React.ReactNode[] = [];
  let contentBeforeThinking: string[] = [];
  let contentAfterThinking: string[] = [];
  let hasSeenThinkingOrTool = false;
  
  // WHAT THIS DOES: Iterate through events and separate content chunks before/after thinking
  for (const event of sortedEvents) {
    if (event.eventType === 'content_chunk') {
      const content = event.data.content || '';
      // WHAT THIS DOES: Filter out JSON query patterns
      const jsonQueryPattern = /\{"query"\s*:\s*"[^"]*"\s*,\s*"num_results"\s*:\s*\d+\}/;
      if (!jsonQueryPattern.test(content)) {
        if (hasSeenThinkingOrTool) {
          contentAfterThinking.push(content);
        } else {
          contentBeforeThinking.push(content);
        }
      }
    } else if (event.eventType === 'thinking_start' || 
               event.eventType === 'tool_call' || 
               event.eventType === 'tool_call_complete') {
      hasSeenThinkingOrTool = true;
    }
  }
  
  // WHAT THIS DOES: Render content that appeared before thinking
  if (contentBeforeThinking.length > 0) {
    const beforeContent = contentBeforeThinking.join('');
    const processedBefore = beforeContent.replace(/\[(\d+)\]/g, (match, num) => 
      `<sup class="citation-marker inline-flex items-center justify-center w-5 h-5 ml-0.5 text-[10px] font-semibold text-accent bg-accent/10 rounded cursor-pointer hover:bg-accent/20 transition-colors" data-citation="${num}" style="vertical-align: super; font-size: 0.7em;">${num}</sup>`
    );
    renderedElements.push(
      <div key="content-before" className="prose prose-sm max-w-none break-words text-text-primary" onClick={onContentClick}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {processedBefore}
        </ReactMarkdown>
      </div>
    );
  }
  
  // WHAT THIS DOES: Render thinking UI if thinking/tool events exist
  if (shouldShowThinking) {
    renderedElements.push(
      <ThinkingUI
        key="thinking"
        isThinking={isThinking}
        thinkingContent={thinkingContent}
        thinkingSteps={thinkingSteps}
        showInitialLoader={false}
      />
    );
  }
  
  // WHAT THIS DOES: Render content that appeared after thinking
  if (contentAfterThinking.length > 0) {
    const afterContent = contentAfterThinking.join('');
    const processedAfter = afterContent.replace(/\[(\d+)\]/g, (match, num) => 
      `<sup class="citation-marker inline-flex items-center justify-center w-5 h-5 ml-0.5 text-[10px] font-semibold text-accent bg-accent/10 rounded cursor-pointer hover:bg-accent/20 transition-colors" data-citation="${num}" style="vertical-align: super; font-size: 0.7em;">${num}</sup>`
    );
    renderedElements.push(
      <div key="content-after" className="prose prose-sm max-w-none break-words text-text-primary" onClick={onContentClick}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
          {processedAfter}
        </ReactMarkdown>
      </div>
    );
  }
  
  return <>{renderedElements}</>;
}

