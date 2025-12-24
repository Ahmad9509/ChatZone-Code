'use client';

import { SearchProgress } from '@/types/research';

interface ResearchProgressProps {
  streaming: boolean; // WHAT THIS DOES: Show panel when research is streaming
  researchProgress: string;
  researchQueries: string[];
  searchProgress: SearchProgress[];
  onCancel: () => void;
}

export const ResearchProgressPanel = ({
  streaming,
  researchProgress,
  researchQueries,
  searchProgress,
  onCancel,
}: ResearchProgressProps) => {
  // WHAT THIS DOES: Show panel when streaming and there's progress to show
  if (!streaming || !researchProgress) return null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
          <h3 className="text-sm font-semibold text-text-primary">Deep Research in Progress</h3>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
      
      <p className="text-sm text-text-secondary mb-3">{researchProgress}</p>
      
      {researchQueries.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-text-primary mb-2">Research Plan:</div>
          {searchProgress.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              {item.status === 'complete' ? (
                <span className="text-emerald-500">✅</span>
              ) : item.status === 'searching' ? (
                <div className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              ) : (
                <span className="text-text-secondary">⏳</span>
              )}
              <span className={`${item.status === 'complete' ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
                {item.query}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {searchProgress.length > 0 && (
        <div className="mt-3">
          <div className="w-full bg-surface-subtle rounded-full h-2">
            <div 
              className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(searchProgress.filter(s => s.status === 'complete').length / searchProgress.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

