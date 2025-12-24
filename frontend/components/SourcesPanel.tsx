// Sources panel component - displays web search sources in a right side panel
// Similar to Perplexity.ai's sources display with clickable tiles
'use client';

// Interface for individual search result/source
interface Source {
  title: string;
  url: string;
  snippet: string;
}

// Props for the SourcesPanel component
interface SourcesPanelProps {
  sources: Source[];
  highlightedIndex: number | null;
  onClose: () => void;
}

/**
 * SourcesPanel Component
 * Displays all web search sources in a sliding right panel
 * Features:
 * - Numbered source tiles with title, snippet, and domain
 * - Clickable links that open in new tab
 * - Auto-scroll and highlight when citation is clicked in message
 * - Clean, card-based UI similar to Perplexity
 */
export default function SourcesPanel({ sources, highlightedIndex, onClose }: SourcesPanelProps) {
  /**
   * Extract domain name from full URL
   * Removes www. prefix for cleaner display
   */
  const extractDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-[400px] border-l border-border bg-background shadow-2xl z-50 flex flex-col animate-slide-in-right">
      {/* Panel Header - Title and Close Button */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔍</span>
          <h2 className="text-lg font-semibold text-text-primary">
            {sources.length} {sources.length === 1 ? 'source' : 'sources'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-subtle text-text-secondary"
          aria-label="Close sources"
          type="button"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
          </svg>
        </button>
      </div>

      {/* Scrollable Sources List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {sources.map((source, index) => (
          <div
            key={index}
            id={`source-${index + 1}`}
            className={`rounded-xl border p-4 transition-all duration-300 ${
              highlightedIndex === index
                ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                : 'border-border bg-surface hover:border-text-secondary'
            }`}
          >
            {/* Citation Number Badge and Title */}
            <div className="mb-2 flex items-start gap-3">
              {/* Citation Number Badge */}
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-accent/10 text-xs font-bold text-accent">
                {index + 1}
              </span>
              
              <div className="flex-1 min-w-0">
                {/* Clickable Title Link - Opens in New Tab */}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-semibold text-text-primary hover:text-accent transition-colors break-words"
                >
                  {source.title}
                </a>
                
                {/* Domain Name Display */}
                <p className="mt-1 text-xs text-text-secondary truncate">
                  {extractDomain(source.url)}
                </p>
              </div>
            </div>
            
            {/* Source Snippet Preview - Limited to 3 Lines */}
            <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
              {source.snippet}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

