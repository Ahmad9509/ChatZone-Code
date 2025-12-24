// API client for ChatZone.ai backend
// Production-ready API integration
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chatzone-api-b8h3g0c4hydccrcy.eastus-01.azurewebsites.net';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (redirect to login)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// API methods
export const auth = {
  getMe: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
  validateReferral: (code: string) => api.get(`/api/auth/referral/${code}`),
};

export const chat = {
  createConversation: () => api.post('/api/chat/conversations'),
  getConversations: (params?: { starred?: boolean; archived?: boolean; projectId?: string }) =>
    api.get('/api/chat/conversations', { params }),
  getConversation: (id: string, params?: { limit?: number; before?: string }) => 
    api.get(`/api/chat/conversations/${id}`, { params }),
  sendMessage: (conversationId: string, data: { content: string; model?: string; isProSearch?: boolean }) =>
    api.post(`/api/chat/conversations/${conversationId}/messages`, data),
  regenerateMessage: (conversationId: string, messageIndex: number, data: { model?: string; directive?: string }) =>
    api.post(`/api/chat/conversations/${conversationId}/regenerate/${messageIndex}`, data),
  editUserMessage: (conversationId: string, messageId: string, data: { content: string; model?: string; attachedFileIds?: string[] }) =>
    api.post(`/api/chat/conversations/${conversationId}/edit-message/${messageId}`, data),
  updateConversation: (id: string, data: { title?: string; starred?: boolean; archived?: boolean }) =>
    api.patch(`/api/chat/conversations/${id}`, data),
  saveDraft: (conversationId: string, draftText: string) =>
    api.patch(`/api/chat/conversations/${conversationId}/draft`, { draftText }),
  deleteConversation: (id: string) => api.delete(`/api/chat/conversations/${id}`),
  getModels: () => api.get('/api/chat/models'),
};

export const stripe = {
  createCheckout: (tier: string) => api.post('/api/stripe/create-checkout', { tier }),
  cancelSubscription: () => api.post('/api/stripe/cancel-subscription'),
  updateTier: (newTier: string) => api.post('/api/stripe/update-tier', { newTier }),
  getSubscriptionStatus: () => api.get('/api/stripe/subscription-status'),
  setupAffiliate: (country: string) => api.post('/api/stripe/affiliate/setup', { country }),
  getAffiliateEarnings: () => api.get('/api/stripe/affiliate/earnings'),
};

export const files = {
  uploadFiles: (conversationId: string, files: File[]) => {
    const formData = new FormData();
    formData.append('conversationId', conversationId);
    files.forEach((file, index) => {
      formData.append('files', file);
    });

    return api.post('/api/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent: any) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        // Can be used to update progress in UI
        console.log(`Upload progress: ${percentCompleted}%`);
      },
    });
  },
};

// Projects API endpoints
export const projects = {
  getProjects: (params?: { starred?: boolean; archived?: boolean }) =>
    api.get('/api/projects', { params }),
  getProject: (id: string) => api.get(`/api/projects/${id}`),
  createProject: (data: { name: string; description?: string; customInstructions?: string }) =>
    api.post('/api/projects', data),
  updateProject: (id: string, data: { name?: string; description?: string; customInstructions?: string; starred?: boolean; archived?: boolean }) =>
    api.put(`/api/projects/${id}`, data),
  deleteProject: (id: string) => api.delete(`/api/projects/${id}`),
  getProjectConversations: (id: string) => api.get(`/api/projects/${id}/conversations`),
  getProjectDocuments: (id: string) => api.get(`/api/projects/${id}/documents`),
  copyArtifactToProject: (projectId: string, data: { 
    artifactId?: string; 
    conversationId?: string; 
    title: string; 
    content: string; 
    type: string; 
    language?: string 
  }) => api.post(`/api/projects/${projectId}/artifacts`, data),
};

// Documents/RAG API endpoints
export const documents = {
  uploadDocument: (file: File, projectId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) {
      formData.append('projectId', projectId);
    }

    return api.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent: any) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Document upload progress: ${percentCompleted}%`);
      },
    });
  },
  getDocuments: (params?: { projectId?: string; status?: string }) =>
    api.get('/api/documents', { params }),
  deleteDocument: (id: string) => api.delete(`/api/documents/${id}`),
  searchDocuments: (query: string, projectId?: string, topK?: number) =>
    api.post('/api/documents/search', { query, projectId, topK }),
};

// Deep Research API endpoints
export const research = {
  startResearch: (data: { conversationId: string; userMessage: string; modelId: string }) =>
    api.post('/api/research/start', data),
  getResearchStatus: (jobId: string) => {
    // WHAT THIS DOES: Returns an EventSource for SSE streaming
    // EventSource doesn't support custom headers, so token must be passed via URL query parameter
    const token = localStorage.getItem('token');
    const url = `${API_URL}/api/research/status/${jobId}?token=${encodeURIComponent(token || '')}`;
    const eventSource = new EventSource(url, {
      withCredentials: true,
    });
    return eventSource;
  },
  cancelResearch: (jobId: string) => api.post(`/api/research/cancel/${jobId}`),
  getResearchJobs: () => api.get('/api/research/jobs'),
};

// Designs API endpoints
export const designs = {
  getDesigns: () => api.get('/api/designs'),
  getDesign: (designId: string) => api.get(`/api/designs/${designId}`),
  createDesign: (data: { title?: string; designType?: string; width?: number; height?: number; backgroundColor?: string }) =>
    api.post('/api/designs', data),
  updateDesign: (designId: string, data: { title?: string; elements?: any[]; backgroundColor?: string; thumbnail?: string }) =>
    api.put(`/api/designs/${designId}`, data),
  deleteDesign: (designId: string) => api.delete(`/api/designs/${designId}`),
  getPresets: () => api.get('/api/designs/presets/list'),
};

// Presentations API endpoints
export const presentations = {
  getPresentations: () => api.get('/api/presentations'),
  getPresentation: (presentationId: string) => api.get(`/api/presentations/${presentationId}`),
  createPresentation: (data: { title?: string; description?: string; theme?: any; chatConversationId?: string }) =>
    api.post('/api/presentations', data),
  updatePresentation: (presentationId: string, data: { title?: string; description?: string; slides?: any[]; theme?: any; status?: string; thumbnail?: string }) =>
    api.put(`/api/presentations/${presentationId}`, data),
  deletePresentation: (presentationId: string) => api.delete(`/api/presentations/${presentationId}`),
  addSlide: (presentationId: string, data: { layoutId?: string; position?: number }) =>
    api.post(`/api/presentations/${presentationId}/slides`, data),
  updateSlide: (presentationId: string, slideId: string, data: any) =>
    api.put(`/api/presentations/${presentationId}/slides/${slideId}`, data),
  deleteSlide: (presentationId: string, slideId: string) =>
    api.delete(`/api/presentations/${presentationId}/slides/${slideId}`),
  reorderSlides: (presentationId: string, data: { fromIndex: number; toIndex: number }) =>
    api.put(`/api/presentations/${presentationId}/slides-reorder`, data),
};

