// Loading Spinner Component
// Reusable loading state display
// WHAT THIS COMPONENT DOES:
// - Shows centered loading spinner
// - Used across all admin pages for consistent loading UI
// - Can be used with optional text message

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner animation */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        
        {/* Optional message */}
        {message && <p className="text-gray-400 text-sm">{message}</p>}
      </div>
    </div>
  );
}

