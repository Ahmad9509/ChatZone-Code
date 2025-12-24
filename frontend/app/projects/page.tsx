// Projects page - Claude-style workspace management
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { auth, projects as projectsApi, documents as documentsApi, chat as chatApi } from '@/lib/api';

// Project icon for folders in list view
const ProjectIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
    <path
      d="M2 4a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l1.414 1.414A1 1 0 0 0 11.414 4H16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

// Star icon for favorites
const StarIcon = ({ className = '', filled = false }: { className?: string; filled?: boolean }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
    <path
      d="M10 2l2.5 5.5L18 8.5l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1L10 2z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

// Plus icon for creating new projects
const PlusIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
    <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// Back arrow icon
const BackIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
    <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Document icon
const DocumentIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
    <path
      d="M5 3h7l3 3v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M12 3v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

// Chat conversation icon
const ConversationIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
    <path
      d="M4 4h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-4 3V5a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

export default function ProjectsPage() {
  const router = useRouter();
  const { user, setUser } = useStore();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [activeTab, setActiveTab] = useState<'conversations' | 'documents'>('conversations');
  const [conversations, setConversations] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Load user and projects on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    auth.getMe().then((res) => {
      setUser(res.data.user);
      loadProjects();
    }).catch(() => {
      localStorage.removeItem('token');
      router.push('/login');
    });
  }, [router, setUser]);

  // Load all projects
  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await projectsApi.getProjects();
      setProjects(res.data || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load project details
  const loadProjectDetails = async (projectId: string) => {
    try {
      const [projectRes, convsRes, docsRes] = await Promise.all([
        projectsApi.getProject(projectId),
        projectsApi.getProjectConversations(projectId),
        projectsApi.getProjectDocuments(projectId),
      ]);

      setSelectedProject(projectRes.data);
      setCustomInstructions(projectRes.data.customInstructions || '');
      setConversations(convsRes.data || []);
      setDocuments(docsRes.data || []);
    } catch (error) {
      console.error('Failed to load project details:', error);
    }
  };

  // Create new project
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    try {
      const res = await projectsApi.createProject({
        name: newProjectName,
        description: newProjectDescription,
        customInstructions,
      });

      setProjects((prev) => [res.data, ...prev]);
      setShowNewProjectModal(false);
      setNewProjectName('');
      setNewProjectDescription('');
      setCustomInstructions('');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create project');
    }
  };

  // Save custom instructions
  const handleSaveInstructions = async () => {
    if (!selectedProject) return;

    try {
      await projectsApi.updateProject(selectedProject._id, {
        customInstructions,
      });
      alert('Custom instructions saved');
    } catch (error) {
      alert('Failed to save instructions');
    }
  };

  // Toggle star/favorite
  const handleToggleStar = async (projectId: string, currentStarred: boolean) => {
    try {
      await projectsApi.updateProject(projectId, {
        starred: !currentStarred,
      });

      setProjects((prev) =>
        prev.map((p) => (p._id === projectId ? { ...p, starred: !currentStarred } : p))
      );
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  // Open project in detail view
  const handleOpenProject = (project: any) => {
    setSelectedProject(project);
    loadProjectDetails(project._id);
  };

  // Go back to projects list
  const handleBackToList = () => {
    setSelectedProject(null);
    loadProjects();
  };

  // Upload document to project
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProject || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    
    // Check file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      alert('File size exceeds 50MB limit');
      return;
    }

    try {
      setUploadingFile(true);
      setUploadProgress(0);

      await documentsApi.uploadDocument(file, selectedProject._id);
      
      // Reload documents
      await loadProjectDetails(selectedProject._id);
      
      alert('Document uploaded successfully! Processing may take a few moments.');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to upload document');
    } finally {
      setUploadingFile(false);
      setUploadProgress(0);
      // Reset file input
      event.target.value = '';
    }
  };

  // Delete document
  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await documentsApi.deleteDocument(docId);
      
      // Reload documents
      if (selectedProject) {
        await loadProjectDetails(selectedProject._id);
      }
      
      alert('Document deleted successfully');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete document');
    }
  };

  // Create new conversation in project
  const handleNewConversationInProject = async () => {
    if (!selectedProject) return;

    try {
      const res = await chatApi.createConversation();
      const newConv = res.data.conversation;
      
      // Assign to project
      await chatApi.updateConversation(newConv._id, { projectId: selectedProject._id } as any);
      
      // Navigate to chat
      router.push(`/chat?conversationId=${newConv._id}`);
    } catch (error) {
      alert('Failed to create conversation');
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-text-primary">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-8 soft-elevated">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-subtle border-t-accent"></div>
          <div className="text-sm text-text-secondary">Loading your workspace…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary">
      {/* Header */}
      <div className="bg-surface px-6 py-4 soft-elevated">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/chat')}
              className="flex items-center justify-center rounded-xl p-2 text-text-secondary bg-surface soft-elevated neumorphic-transition hover:soft-hover hover:text-text-primary active:soft-pressed"
              aria-label="Back to chat"
            >
              <BackIcon className="h-5 w-5" />
            </button>
            {selectedProject && (
              <button
                onClick={handleBackToList}
                className="flex items-center justify-center rounded-xl p-2 text-text-secondary bg-surface soft-elevated neumorphic-transition hover:soft-hover hover:text-text-primary active:soft-pressed"
                aria-label="Back to projects"
              >
                <BackIcon className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-semibold">
                {selectedProject ? selectedProject.name : 'Projects'}
              </h1>
              {selectedProject && (
                <>
                  {selectedProject.description && (
                    <p className="text-sm text-text-secondary">{selectedProject.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-4 text-xs text-text-secondary">
                    <span>{conversations.length} conversations</span>
                    <span>•</span>
                    <span>{documents.length} documents</span>
                  </div>
                </>
              )}
            </div>
          </div>
          {!selectedProject && (
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="flex items-center gap-2 rounded-xl border-0 bg-accent px-4 py-2.5 text-sm font-semibold text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
            >
              <PlusIcon className="h-4 w-4" />
              New project
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        {!selectedProject ? (
          // Projects list view
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.filter(p => p._id).map((project) => (
              <div
                key={project._id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border-0 bg-surface p-5 soft-elevated neumorphic-transition hover:soft-hover cursor-pointer"
                onClick={() => handleOpenProject(project)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <ProjectIcon className="h-6 w-6 text-accent" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleStar(project._id, project.starred);
                    }}
                    className="rounded-lg p-1.5 text-text-secondary hover:text-accent hover:bg-surface-subtle soft-elevated neumorphic-transition hover:soft-hover"
                  >
                    <StarIcon className="h-5 w-5" filled={project.starred} />
                  </button>
                </div>
                <div className="flex-1 text-left">
                  <h3 className="mb-2 text-lg font-semibold text-text-primary">{project.name}</h3>
                  {project.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-text-secondary">{project.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-text-secondary">
                    <span>{project.conversationCount || 0} chats</span>
                    <span>{project.documentCount || 0} docs</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Project detail view
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left panel: Custom instructions */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border-0 bg-surface p-5 soft-elevated">
                <h2 className="mb-4 text-lg font-semibold">Custom Instructions</h2>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Add custom instructions for this project..."
                  className="mb-4 w-full resize-y rounded-xl border-0 bg-surface-subtle px-4 py-3 text-sm text-text-primary soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 neumorphic-transition"
                  rows={12}
                />
                <button
                  onClick={handleSaveInstructions}
                  className="w-full rounded-xl border-0 bg-accent px-4 py-2.5 text-sm font-semibold text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
                >
                  Save instructions
                </button>
              </div>
            </div>

            {/* Right panel: Conversations and documents */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border-0 bg-surface soft-elevated">
                {/* Tabs */}
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('conversations')}
                    className={`flex-1 px-6 py-3 text-sm font-medium neumorphic-transition ${
                      activeTab === 'conversations'
                        ? 'border-b-[3px] border-accent text-accent bg-surface-subtle'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
                    }`}
                  >
                    Conversations ({conversations.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`flex-1 px-6 py-3 text-sm font-medium neumorphic-transition ${
                      activeTab === 'documents'
                        ? 'border-b-[3px] border-accent text-accent bg-surface-subtle'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
                    }`}
                  >
                    Documents ({documents.length})
                  </button>
                </div>

                {/* Tab content */}
                <div className="p-5">
                  {activeTab === 'conversations' ? (
                    <div className="space-y-3">
                      {/* New conversation button */}
                      <button
                        onClick={handleNewConversationInProject}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-surface-subtle px-4 py-3 text-sm font-medium text-text-secondary soft-elevated neumorphic-transition hover:soft-hover hover:text-accent active:soft-pressed"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Start new conversation in this project
                      </button>

                      {conversations.length === 0 ? (
                        <p className="text-center text-sm text-text-secondary">
                          No conversations yet
                        </p>
                      ) : (
                        conversations.map((conv) => (
                          <button
                            key={conv._id}
                            onClick={() => router.push(`/chat?conversationId=${conv._id}`)}
                            className="flex w-full items-center gap-3 rounded-xl border-0 bg-surface px-4 py-3 text-left soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
                          >
                            <ConversationIcon className="h-5 w-5 text-text-secondary" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-text-primary">{conv.title}</div>
                              <div className="text-xs text-text-secondary">
                                {new Date(conv.updatedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Upload document button */}
                      <div className="relative">
                        <input
                          type="file"
                          id="document-upload"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.html"
                        />
                        <label
                          htmlFor="document-upload"
                          className={`flex w-full items-center justify-center gap-2 rounded-xl border-0 bg-surface-subtle px-4 py-3 text-sm font-medium text-text-secondary soft-elevated neumorphic-transition hover:soft-hover hover:text-accent active:soft-pressed ${
                            uploadingFile ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                          }`}
                        >
                          {uploadingFile ? (
                            <>
                              <span className="animate-spin">⏳</span>
                              Uploading document...
                            </>
                          ) : (
                            <>
                              <PlusIcon className="h-4 w-4" />
                              Upload document to knowledge base
                            </>
                          )}
                        </label>
                      </div>

                      {documents.length === 0 ? (
                        <p className="text-center text-sm text-text-secondary">
                          No documents yet
                        </p>
                      ) : (
                        documents.map((doc) => (
                          <div
                            key={doc._id}
                            className="flex items-center gap-3 rounded-xl border-0 bg-surface px-4 py-3 soft-elevated"
                          >
                            <DocumentIcon className="h-5 w-5 text-text-secondary" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="truncate font-medium text-text-primary">{doc.fileName}</div>
                                {doc.status === 'processing' && (
                                  <span className="text-xs text-yellow-500">Processing...</span>
                                )}
                                {doc.status === 'error' && (
                                  <span className="text-xs text-red-500">Error</span>
                                )}
                                {doc.status === 'ready' && (
                                  <span className="text-xs text-green-500">✓ Ready</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-text-secondary">
                                <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                {doc.chunkCount && <span>• {doc.chunkCount} chunks</span>}
                                {doc.fileSize && <span>• {(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteDocument(doc._id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-red-500/10 hover:text-red-500 soft-elevated neumorphic-transition hover:soft-hover"
                              aria-label="Delete document"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                <path d="M6 6l8 8M14 6l-8 8" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New project modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border-0 bg-surface p-6 soft-elevated">
            <h2 className="mb-4 text-xl font-semibold">Create new project</h2>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-text-primary">
                Name
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="My project"
                className="w-full rounded-xl border-0 bg-surface-subtle px-4 py-2.5 text-sm text-text-primary soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 neumorphic-transition"
              />
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-text-primary">
                Description (optional)
              </label>
              <input
                type="text"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="A brief description of your project"
                className="w-full rounded-xl border-0 bg-surface-subtle px-4 py-2.5 text-sm text-text-primary soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 neumorphic-transition"
              />
            </div>
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-text-primary">
                Custom Instructions (optional)
              </label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Add custom instructions that the AI should follow in this project..."
                className="w-full resize-y rounded-xl border-0 bg-surface-subtle px-4 py-3 text-sm text-text-primary soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 neumorphic-transition"
                rows={6}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewProjectModal(false);
                  setNewProjectName('');
                  setNewProjectDescription('');
                  setCustomInstructions('');
                }}
                className="flex-1 rounded-xl border-0 bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="flex-1 rounded-xl border-0 bg-accent px-4 py-2.5 text-sm font-semibold text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

