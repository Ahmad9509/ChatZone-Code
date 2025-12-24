// TypeScript interfaces for deep research functionality

export interface ResearchJob {
  jobId: string;
  conversationId: string;
  userMessage: string;
  status: 'planning' | 'searching' | 'generating' | 'complete' | 'error' | 'cancelled';
  queries: string[];
  createdAt: Date | string;
}

export interface SearchProgress {
  query: string;
  index: number;
  total: number;
  status: 'pending' | 'searching' | 'complete';
}

export interface ResearchEvent {
  type: 'connected' | 'planning_start' | 'plan_created' | 'search_start' | 'search_complete' | 
        'search_error' | 'searches_complete' | 'generating_start' | 'complete' | 'error' | 'cancelled';
  message?: string;
  error?: string;
  query?: string;
  queries?: string[];
  queryCount?: number;
  index?: number;
  total?: number;
  artifact?: any;
}

export interface ResearchState {
  activeResearchJob: string | null;
  researchProgress: string;
  researchQueries: string[];
  searchProgress: SearchProgress[];
}

