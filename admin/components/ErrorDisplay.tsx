// Error Display Component
// Shows error messages with recovery options
// WHAT THIS COMPONENT DOES:
// - Displays error message in a user-friendly way
// - Provides retry button for recovery
// - Used across admin pages for consistent error UI

interface ErrorDisplayProps {
  error: string | null;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Error icon */}
          <span className="text-red-400 text-lg">⚠️</span>
          
          {/* Error message */}
          <div>
            <h3 className="text-red-300 font-semibold">Error</h3>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
        
        {/* Retry button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium whitespace-nowrap"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

