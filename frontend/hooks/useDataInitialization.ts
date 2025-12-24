// Custom hook for initializing all data on mount (auth, conversations, models, projects)
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, chat as chatApi, projects as projectsApi } from '@/lib/api';

interface UseDataInitializationParams {
  searchParams: any;
  setUser: (user: any) => void;
  setConversations: (conversations: any[]) => void;
  setCurrentConversation: (conversation: any) => void;
  setModels: (models: any[]) => void;
  setProjects: (projects: any[]) => void;
  setIsRestoring: (restoring: boolean) => void;
  currentConversation: any;
  // WHAT THIS DOES: Function to clear all user-related data from store
  // Called immediately on mount to prevent old user's data from showing
  clearUserData: () => void;
  // PERFORMANCE OPTIMIZATION: Function to clear messages from current conversation
  // Called before loading a new conversation to free memory
  clearCurrentConversationMessages: () => void;
}

export function useDataInitialization(params: UseDataInitializationParams) {
  const router = useRouter();
  const {
    searchParams,
    setUser,
    setConversations,
    setCurrentConversation,
    setModels,
    setProjects,
    setIsRestoring,
    currentConversation,
    clearUserData,
    clearCurrentConversationMessages,
  } = params;

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // WHAT THIS DOES: Clear all user-related data immediately on mount
    // This prevents old user's conversations and data from showing when new user logs in
    // Must be called before checking token to ensure clean state
    clearUserData();
    
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Load user data
    auth.getMe().then((res) => {
      setUser(res.data.user);
    }).catch(() => {
      localStorage.removeItem('token');
      router.push('/login');
    });

    // Load conversations and restore last active one (with fallback)
    chatApi.getConversations().then(async (res) => {
      const fetchedConversations = res.data.conversations;
      setConversations(fetchedConversations);

      // Check for conversationId in URL query parameter (from project page)
      const urlConversationId = searchParams?.get('conversationId');
      console.log('🔍 URL conversationId:', urlConversationId);
      
      // Priority: URL param > localStorage > first conversation
      const savedId = localStorage.getItem('cz.currentConversationId');
      const targetId = urlConversationId || 
                       (savedId && fetchedConversations.some((c: any) => c._id === savedId) ? savedId : null) ||
                       (fetchedConversations.length > 0 ? fetchedConversations[0]._id : null);
      
      console.log('🎯 Target conversation ID:', targetId);

      if (targetId) {
        // PERFORMANCE OPTIMIZATION: Clear messages from previous conversation before loading new one
        // This ensures only ONE conversation's messages are in memory at a time
        clearCurrentConversationMessages();
        
        // Optimistically set the current conversation from the list to avoid empty-state flicker
        const optimistic = fetchedConversations.find((c: any) => c._id === targetId);
        if (optimistic) {
          setCurrentConversation(optimistic);
        }
        try {
          // PERFORMANCE OPTIMIZATION: Load only last 30 messages initially
          // This prevents 10MB+ payloads from freezing the browser
          const convRes = await chatApi.getConversation(targetId, { limit: 30 });
          setCurrentConversation(convRes.data.conversation);
          // Persist the active id so subsequent refreshes are consistent
          localStorage.setItem('cz.currentConversationId', targetId);
        } catch {
          // If the saved id failed, drop it but don't clear again on this mount
          if (savedId === targetId) localStorage.removeItem('cz.currentConversationId');
        }
      }

      isInitialMount.current = false;
      setIsRestoring(false);
    });

    // Load available models
    chatApi.getModels().then((res) => {
      setModels(res.data.models || []);
    }).catch(err => {
      console.error('Failed to load models:', err);
    });

    // Load projects for project selector
    projectsApi.getProjects().then((res) => {
      const projectsList = res.data || [];
      console.log('✅ Loaded projects:', projectsList);
      setProjects(projectsList);
    }).catch(err => {
      console.error('Failed to load projects:', err);
    });
  }, [router, setUser, setConversations, setCurrentConversation, searchParams, setModels, setProjects, setIsRestoring, clearUserData, clearCurrentConversationMessages]);

  // Persist current conversation ID to localStorage (never clear on mount)
  useEffect(() => {
    if (typeof window === 'undefined' || isInitialMount.current) return;
    if (currentConversation?._id) {
      localStorage.setItem('cz.currentConversationId', currentConversation._id);
    }
  }, [currentConversation]);

  return {
    isInitialMount,
  };
}

