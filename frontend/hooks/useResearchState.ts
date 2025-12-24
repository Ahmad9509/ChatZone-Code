// Custom hook for managing deep research state
// WHAT THIS DOES: Manages research progress state for streaming Deep Research
// No longer uses activeResearchJob since research streams like regular chat
import { useState } from 'react';

interface UseResearchStateParams {
  currentConversation: any;
}

export function useResearchState(params?: UseResearchStateParams) {
  const { currentConversation } = params || {};
  
  // WHAT THIS DOES: Track research progress text (e.g., "Searching 5/15...")
  const [researchProgress, setResearchProgress] = useState<string>('');
  
  // WHAT THIS DOES: Store list of research queries from the plan
  const [researchQueries, setResearchQueries] = useState<string[]>([]);
  
  // WHAT THIS DOES: Track progress of each search query (pending/searching/complete)
  const [searchProgress, setSearchProgress] = useState<{
    query: string;
    index: number;
    total: number;
    status: 'pending' | 'searching' | 'complete';
  }[]>([]);

  return {
    researchProgress,
    setResearchProgress,
    researchQueries,
    setResearchQueries,
    searchProgress,
    setSearchProgress,
  };
}

