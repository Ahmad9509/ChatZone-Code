// Zustand store for global state management
import { create } from 'zustand';

interface TierConfig {
  _id: string;
  tierName: string;
  displayName: string;
  deepResearch?: {
    hasDeepResearch: boolean;
    deepResearchLimit: number;
    deepResearchMaxSources: number;
  };
  designs?: {
    hasDesigns: boolean;
    designsLimit: number;
    aiImageGenerationsLimit: number;
    canUseQwen: boolean;
    canUseImagen: boolean;
    canExportPNG: boolean;
    canExportJPG: boolean;
    canExportPDF: boolean;
  };
  presentations?: {
    hasPresentations: boolean;
    presentationsLimit: number;
    maxSlidesPerPresentation: number;
    canExportPPTX: boolean;
    canExportPDF: boolean;
  };
  features?: {
    hasRAG: boolean;
    hasProjects: boolean;
    hasProReplies: boolean;
    hasVision: boolean;
  };
}

interface User {
  _id: string;
  email: string;
  name: string;
  username: string;
  profilePicture?: string;
  tier: string;
  tokenUsage: { total: number; thisMonth: number };
  messageCount: number;
  proRepliesCount: { total: number; daily: number };
  referralCode: string;
  customInstructions?: { aboutYou?: string; responseStyle?: string };
  settings: any;
  lastModelUsed?: string;
  preferredModelId?: string;
  tierConfig?: TierConfig | null;
  createdAt: string;
}

interface AttachedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  uploadProgress: number;
}

interface Conversation {
  _id: string;
  title: string;
  starred: boolean;
  archived: boolean;
  updatedAt: string;
  lastMessageAt: string;
  messages?: any[];
}

interface AppState {
  user: User | null;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  
  // File attachment state
  attachedFiles: AttachedFile[];
  conversationMemoryUsage: number;
  memoryCapacityPerTier: Record<string, number>;
  
  setUser: (user: User | null) => void;
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  setLoading: (loading: boolean) => void;
  
  // File attachment actions
  addFile: (file: File) => void;
  removeFile: (fileId: string) => void;
  updateFileStatus: (fileId: string, status: AttachedFile['status'], error?: string) => void;
  updateFileProgress: (fileId: string, progress: number) => void;
  clearAttachedFiles: () => void;
  updateMemoryUsage: (usage: number) => void;
  setMemoryCapacity: (tier: string, capacity: number) => void;
  
  // PERFORMANCE OPTIMIZATION: Clear messages from current conversation
  // This is called when switching to a different conversation to free memory
  clearCurrentConversationMessages: () => void;
  
  // WHAT THIS DOES: Clear all user-related data when logging out
  // This ensures no data from previous user persists when new user logs in
  clearUserData: () => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  conversations: [],
  currentConversation: null,
  isLoading: false,
  
  attachedFiles: [],
  conversationMemoryUsage: 0,
  memoryCapacityPerTier: {
    free: 52428800,      // 50MB
    tier5: 157286400,    // 150MB
    tier10: 262144000,   // 250MB
    tier15: 524288000,   // 500MB
  },
  
  setUser: (user) => set({ user }),
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  addConversation: (conversation) =>
    set((state) => ({ conversations: [conversation, ...state.conversations] })),
  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === id ? { ...c, ...updates } : c
      ),
      currentConversation:
        state.currentConversation?._id === id
          ? { ...state.currentConversation, ...updates }
          : state.currentConversation,
    })),
  deleteConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c._id !== id),
      currentConversation:
        state.currentConversation?._id === id ? null : state.currentConversation,
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  
  addFile: (file) =>
    set((state) => ({
      attachedFiles: [
        ...state.attachedFiles,
        {
          id: `${Date.now()}-${Math.random()}`,
          file,
          status: 'pending',
          uploadProgress: 0,
        },
      ],
    })),
  removeFile: (fileId) =>
    set((state) => ({
      attachedFiles: state.attachedFiles.filter((f) => f.id !== fileId),
    })),
  updateFileStatus: (fileId, status, error) =>
    set((state) => ({
      attachedFiles: state.attachedFiles.map((f) =>
        f.id === fileId ? { ...f, status, error } : f
      ),
    })),
  updateFileProgress: (fileId, progress) =>
    set((state) => ({
      attachedFiles: state.attachedFiles.map((f) =>
        f.id === fileId ? { ...f, uploadProgress: progress } : f
      ),
    })),
  clearAttachedFiles: () => set({ attachedFiles: [] }),
  updateMemoryUsage: (usage) => set({ conversationMemoryUsage: usage }),
  setMemoryCapacity: (tier, capacity) =>
    set((state) => ({
      memoryCapacityPerTier: { ...state.memoryCapacityPerTier, [tier]: capacity },
    })),
  // PERFORMANCE OPTIMIZATION: Clear messages from current conversation
  // This frees up memory when switching between conversations
  // Only keeps conversation metadata (title, id, etc.) without messages
  clearCurrentConversationMessages: () =>
    set((state) => ({
      currentConversation: state.currentConversation 
        ? { ...state.currentConversation, messages: [] }
        : null,
    })),
  // WHAT THIS DOES: Clear all user-related data when logging out
  // Resets user, conversations, currentConversation, attachedFiles, and conversationMemoryUsage
  // This prevents old user's data from showing when new user logs in
  clearUserData: () => set({
    user: null,
    conversations: [],
    currentConversation: null,
    attachedFiles: [],
    conversationMemoryUsage: 0,
  }),
}));

