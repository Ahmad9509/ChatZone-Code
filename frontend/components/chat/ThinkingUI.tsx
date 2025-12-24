// ThinkingUI Component
// Displays AI thinking process with step-by-step visualization
// WHAT THIS COMPONENT DOES:
// - Shows collapsible thinking process header
// - Displays each thinking step as it streams in
// - Shows status icons (spinner for active, checkmark for complete)
// - Displays search results if AI searches the web
// - Provides smooth animations for step appearance and completion
// - Allows users to expand/collapse to see all steps

'use client';

import { useState } from 'react';

// WHAT THIS INTERFACE DOES:
// Defines the structure of a single thinking step
interface ThinkingStep {
  id: number; // Unique identifier for this step
  text: string; // The thinking text content
  status: 'streaming' | 'complete'; // Whether step is still streaming or done
  type?: 'thinking' | 'search'; // Type of step (regular thinking or web search)
  query?: string; // If search type, the search query used
  results?: Array<{ title: string; url: string }>; // If search type, the search results
  resultsCount?: number; // Number of results found
}

// WHAT THIS INTERFACE DOES:
// Defines what data this component needs to display thinking UI
interface ThinkingUIProps {
  isThinking: boolean; // Whether thinking is currently active
  thinkingContent: string; // Current thinking text being streamed
  thinkingSteps: ThinkingStep[]; // List of all thinking steps
  showInitialLoader: boolean; // Whether to show "AI is thinking..." before first token
}

export function ThinkingUI({
  isThinking,
  thinkingContent,
  thinkingSteps,
  showInitialLoader,
}: ThinkingUIProps) {
  // WHAT THIS STATE DOES:
  // Controls whether the thinking section is expanded or collapsed
  // User can click to expand/collapse to see all steps
  const [isExpanded, setIsExpanded] = useState(false);

  // WHAT THIS DOES:
  // Only render ThinkingUI when actual events arrive from backend
  // No hardcoded initial loader - only shows when thinking/tool events exist
  if (!isThinking && thinkingSteps.length === 0) {
    return null;
  }

  // WHAT THIS DOES:
  // Calculate how many steps are complete vs still streaming
  const completedSteps = thinkingSteps.filter((step) => step.status === 'complete').length;
  const totalSteps = thinkingSteps.length;

  return (
    // WHAT THIS DOES: Collapsible thinking process container (no ChatZone header)
    // ChatZone header is rendered by message container, not here
    <div className="overflow-hidden">
        {/* WHAT THIS SECTION DOES: Header bar with thinking icon and collapse button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-subtle rounded-xl transition-colors neumorphic-transition"
        >
          <div className="flex items-center gap-2">
            {/* WHAT THIS DOES: Shows thinking brain icon */}
            <span className="text-lg">🧠</span>
            <span className="text-sm font-medium text-text-primary">Thinking Process</span>
          </div>
          <div className="flex items-center gap-2">
            {/* WHAT THIS DOES: Shows count of completed steps */}
            {totalSteps > 0 && (
              <span className="text-xs text-text-secondary">
                {completedSteps}/{totalSteps} steps completed
              </span>
            )}
            {/* WHAT THIS DOES: Collapse/expand chevron icon */}
            <span className={`text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </button>

        {/* WHAT THIS SECTION DOES: Steps container - only visible when expanded or thinking is active */}
        {(isExpanded || isThinking) && (
          <div className="px-4 pb-4 space-y-3">
            {/* WHAT THIS DOES: Render each thinking step */}
            {thinkingSteps.map((step) => (
              <div
                key={step.id}
                className="p-3"
              >
                {/* WHAT THIS SECTION DOES: Step header with status icon */}
                <div className="flex items-start gap-2">
                  {/* WHAT THIS DOES: Show spinner if streaming, checkmark if complete */}
                  {step.status === 'streaming' ? (
                    <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full mt-0.5 flex-shrink-0"></div>
                  ) : (
                    <span className="text-emerald-500 text-sm flex-shrink-0">✅</span>
                  )}

                  {/* WHAT THIS SECTION DOES: Step content */}
                  <div className="flex-1 min-w-0">
                    {/* WHAT THIS DOES: Show step text with typing animation if streaming */}
                    <div className="text-sm text-text-primary">
                    {step.text}
                    {/* WHAT THIS DOES: Show blinking cursor if step is still streaming */}
                    {step.status === 'streaming' && (
                      <span className="inline-block w-0.5 h-4 bg-accent ml-1 animate-pulse"></span>
                    )}
                    </div>

                    {/* WHAT THIS SECTION DOES: If step is a search, show search details */}
                    {step.type === 'search' && (
                      <div className="mt-2 space-y-2">
                        {/* WHAT THIS DOES: Show search query */}
                        {step.query && (
                          <div className="text-xs text-text-secondary">
                            <span className="font-medium">Query:</span> {step.query}
                          </div>
                        )}

                        {/* WHAT THIS DOES: Show results count when search completes */}
                        {step.status === 'complete' && step.resultsCount !== undefined && (
                          <div className="text-xs text-emerald-500 font-medium">
                            ✓ Searched {step.resultsCount} sources
                          </div>
                        )}

                        {/* WHAT THIS DOES: Show expandable results list if results exist */}
                        {step.results && step.results.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="text-xs font-medium text-text-secondary mb-1">
                              Sources:
                            </div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {step.results.map((result, index) => (
                                <a
                                  key={index}
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-text-secondary bg-surface-subtle rounded px-2 py-1 flex items-start gap-2 hover:bg-surface transition-colors cursor-pointer"
                                >
                                  <span className="text-accent flex-shrink-0">🌐</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-text-primary truncate hover:text-accent transition-colors">
                                      {result.title}
                                    </div>
                                    <div className="text-text-secondary truncate text-[10px]">
                                      {result.url}
                                    </div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* WHAT THIS SECTION DOES: Show current streaming thinking content if active */}
            {isThinking && thinkingContent && (
              <div className="p-3">
                <div className="flex items-start gap-2">
                  {/* WHAT THIS DOES: Show spinner for active thinking */}
                  <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full mt-0.5 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    {/* WHAT THIS DOES: Show thinking text with typing cursor */}
                    <div className="text-sm text-text-primary">
                      {thinkingContent}
                      <span className="inline-block w-0.5 h-4 bg-accent ml-1 animate-pulse"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
  );
}

