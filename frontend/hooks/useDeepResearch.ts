// Custom hook for managing deep research functionality with SSE
// Handles research job initiation, progress tracking, and cancellation

import { useState, useRef, useEffect } from 'react';
import { research as researchApi, chat as chatApi } from '@/lib/api';
import { SearchProgress, ResearchState } from '@/types/research';
import { Conversation } from '@/types/chat';
import { Artifact } from '@/types/artifact';

interface UseDeepResearchParams {
  currentConversation: Conversation | null;
  setCurrentConversation: (conv: Conversation) => void;
  updateConversation: (id: string, conv: Conversation) => void;
  addConversation: (conv: Conversation) => void;
  selectedModel: string;
  setCurrentArtifact: (artifact: Artifact | null) => void;
  setShowArtifactPanel: (show: boolean) => void;
  setCurrentSources: (sources: any[]) => void;
}

interface UseDeepResearch extends ResearchState {
  handleStartDeepResearch: (message: string, textareaRef?: React.RefObject<HTMLTextAreaElement>) => Promise<void>;
  handleCancelResearch: () => Promise<void>;
  setResearchProgress: React.Dispatch<React.SetStateAction<string>>;
  setSearchProgress: React.Dispatch<React.SetStateAction<SearchProgress[]>>;
  setResearchQueries: React.Dispatch<React.SetStateAction<string[]>>;
}

export const useDeepResearch = (params: UseDeepResearchParams): UseDeepResearch => {
  const {
    currentConversation,
    setCurrentConversation,
    updateConversation,
    addConversation,
    selectedModel,
    setCurrentArtifact,
    setShowArtifactPanel,
    setCurrentSources,
  } = params;

  const [activeResearchJob, setActiveResearchJob] = useState<string | null>(null);
  const [researchProgress, setResearchProgress] = useState<string>('');
  const [researchQueries, setResearchQueries] = useState<string[]>([]);
  const [searchProgress, setSearchProgress] = useState<SearchProgress[]>([]);
  const researchEventSourceRef = useRef<EventSource | null>(null);

  // Cleanup Deep Research SSE connection on unmount or conversation change
  useEffect(() => {
    return () => {
      if (researchEventSourceRef.current) {
        researchEventSourceRef.current.close();
        researchEventSourceRef.current = null;
      }
    };
  }, [currentConversation?._id]);

  const handleStartDeepResearch = async (
    message: string,
    textareaRef?: React.RefObject<HTMLTextAreaElement>
  ) => {
    if (!message.trim() || activeResearchJob) return;

    // Auto-create conversation if none
    let activeConversation = currentConversation;
    if (!activeConversation) {
      try {
        const res = await chatApi.createConversation();
        const newConv = res.data.conversation;
        addConversation(newConv);
        setCurrentConversation(newConv);
        activeConversation = newConv;
      } catch (error) {
        console.error('Failed to create conversation:', error);
        return;
      }
    }

    if (!activeConversation) return;

    const userMessage = message;
    setResearchProgress('Starting Deep Research...');
    
    // Reset textarea height
    if (textareaRef?.current) {
      textareaRef.current.style.height = '32px';
    }

    try {
      // Start research job
      const startRes = await researchApi.startResearch({
        conversationId: activeConversation._id,
        userMessage,
        modelId: selectedModel
      });

      const jobId = startRes.data.jobId;
      setActiveResearchJob(jobId);
      console.log('🔬 Started Deep Research job:', jobId);

      // Open SSE connection for progress updates
      const eventSource = researchApi.getResearchStatus(jobId);
      researchEventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 Research event:', data.type);

          switch (data.type) {
            case 'connected':
              setResearchProgress('Connected to research service...');
              break;

            case 'planning_start':
              setResearchProgress('Creating research plan...');
              break;

            case 'plan_created':
              setResearchProgress(`Research plan created (${data.queryCount} searches)`);
              setResearchQueries(data.queries);
              // Initialize search progress
              setSearchProgress(data.queries.map((q: string, i: number) => ({
                query: q,
                index: i + 1,
                total: data.queries.length,
                status: 'pending' as const
              })));
              break;

            case 'search_start':
              setResearchProgress(`Searching: ${data.query}...`);
              setSearchProgress(prev => prev.map(s =>
                s.index === data.index ? { ...s, status: 'searching' as const } : s
              ));
              break;

            case 'search_complete':
              setSearchProgress(prev => prev.map(s =>
                s.index === data.index ? { ...s, status: 'complete' as const } : s
              ));
              const completedCount = searchProgress.filter(s => s.status === 'complete').length + 1;
              setResearchProgress(`Completed ${completedCount}/${data.total} searches`);
              break;

            case 'search_error':
              console.error('Search error:', data.error);
              break;

            case 'searches_complete':
              setResearchProgress(`All searches complete! Generating document...`);
              break;

            case 'generating_start':
              setResearchProgress('Analyzing sources and generating comprehensive document...');
              break;

            case 'complete':
              setResearchProgress('Research complete!');
              // Show the artifact
              if (data.artifact) {
                setCurrentArtifact({
                  _id: data.artifact._id,
                  type: data.artifact.type,
                  title: data.artifact.title,
                  content: data.artifact.content,
                  language: undefined,
                  version: 1,
                  messageId: '',
                  conversationId: data.artifact.conversationId || activeConversation._id,
                });
                setShowArtifactPanel(true);
                
                // Store sources if available
                if (data.artifact.sources) {
                  setCurrentSources(data.artifact.sources);
                }
              }
              
              // Reload conversation to get the new message
              setTimeout(async () => {
                try {
                  const convRes = await chatApi.getConversation(activeConversation._id);
                  setCurrentConversation(convRes.data.conversation);
                  updateConversation(activeConversation._id, convRes.data.conversation);
                } catch (error) {
                  console.error('Failed to reload conversation:', error);
                }
              }, 500);
              
              // Close connection and cleanup
              eventSource.close();
              setActiveResearchJob(null);
              setSearchProgress([]);
              setResearchQueries([]);
              setTimeout(() => setResearchProgress(''), 3000);
              break;

            case 'error':
              setResearchProgress(`Error: ${data.error}`);
              eventSource.close();
              setActiveResearchJob(null);
              setSearchProgress([]);
              setResearchQueries([]);
              setTimeout(() => setResearchProgress(''), 5000);
              break;

            case 'cancelled':
              setResearchProgress('Research cancelled');
              eventSource.close();
              setActiveResearchJob(null);
              setSearchProgress([]);
              setResearchQueries([]);
              setTimeout(() => setResearchProgress(''), 3000);
              break;
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setResearchProgress('Connection error - please try again');
        eventSource.close();
        setActiveResearchJob(null);
        setSearchProgress([]);
        setResearchQueries([]);
        setTimeout(() => setResearchProgress(''), 5000);
      };

    } catch (error: any) {
      console.error('Deep Research error:', error);
      setResearchProgress(`Failed to start research: ${error.response?.data?.error || error.message}`);
      setActiveResearchJob(null);
      setTimeout(() => setResearchProgress(''), 5000);
    }
  };

  // Cancel active research job
  const handleCancelResearch = async () => {
    if (!activeResearchJob) return;

    try {
      await researchApi.cancelResearch(activeResearchJob);
      if (researchEventSourceRef.current) {
        researchEventSourceRef.current.close();
        researchEventSourceRef.current = null;
      }
      setActiveResearchJob(null);
      setResearchProgress('Research cancelled');
      setSearchProgress([]);
      setResearchQueries([]);
      setTimeout(() => setResearchProgress(''), 3000);
    } catch (error) {
      console.error('Failed to cancel research:', error);
    }
  };

  return {
    activeResearchJob,
    researchProgress,
    researchQueries,
    searchProgress,
    handleStartDeepResearch,
    handleCancelResearch,
    setResearchProgress,
    setSearchProgress,
    setResearchQueries,
  };
};

