// Main chat interface - Production-ready with all features
'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { chat as chatApi, designs as designsApi, presentations as presentationsApi } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FileChip } from '@/components/FileChip';
import { FileUploadHandler } from '@/components/FileUploadHandler';
import { Toast } from '@/components/Toast';
import ArtifactPanel, { Artifact } from '@/components/ArtifactPanel';
import SourcesPanel from '@/components/SourcesPanel';
import UnifiedComposerBar from '@/components/UnifiedComposerBar';
import { Sidebar } from '@/components/chat/Sidebar';
import { EmptyState } from '@/components/chat/EmptyState';
import { ResearchProgressPanel } from '@/components/chat/ResearchProgressPanel';
import { UserMessage } from '@/components/chat/UserMessage';
import { AssistantMessage } from '@/components/chat/AssistantMessage';
import { MessageList } from '@/components/chat/MessageList';
import { TopBar } from '@/components/chat/TopBar';
import TemplatePicker from '@/components/presentations/TemplatePicker';
import { 
  SidebarToggleIcon, 
  PlusIcon, 
  GearIcon, 
  LogoutIcon,
  ConversationIcon,
  CopyIcon,
  CheckIcon,
  EditIcon,
  CloseIcon,
  RefreshIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@/components/icons';
import { CodeBlock } from '@/components/markdown/CodeBlock';
import { MarkdownTable } from '@/components/markdown/MarkdownTable';
import { markdownComponents } from '@/lib/markdown-config';
import { ConversationTree } from '@/services/branchingService';
import { useFileManagement } from '@/hooks/useFileManagement';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useModelSelection } from '@/hooks/useModelSelection';
import { useUIState } from '@/hooks/useUIState';
import { useMessageEditingState } from '@/hooks/useMessageEditingState';
import { useArtifactState } from '@/hooks/useArtifactState';
import { useResearchState } from '@/hooks/useResearchState';
import { useChatInputState } from '@/hooks/useChatInputState';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useDataInitialization } from '@/hooks/useDataInitialization';
import { MessageEventStream, EventStreamItem } from '@/types/eventStream';
import { useConversationTree } from '@/hooks/useConversationTree';
import { useChatHandlers } from '@/hooks/useChatHandlers';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    conversations,
    currentConversation,
    setUser,
    setConversations,
    setCurrentConversation,
    updateConversation,
    addConversation,
    clearUserData,
    clearCurrentConversationMessages,
  } = useStore();
  
  // Chat input and streaming state
  const {
    message,
    setMessage,
    streaming,
    setStreaming,
    streamedContent,
    setStreamedContent,
  } = useChatInputState();
  
  // ========== EVENT STREAM STATE ==========
  // WHAT THIS SECTION DOES:
  // Manages event stream for dynamic rendering based on chronological event order
  // Events are scoped to conversationId + messageId (userMessageId for assistant messages)
  // This allows rendering events in the order they arrive, not hardcoded positions
  const [currentEventStream, setCurrentEventStream] = useState<MessageEventStream | null>(null);
  
  // ========== THINKING STATE (DEPRECATED - kept for backward compatibility during migration) ==========
  // WHAT THIS SECTION DOES:
  // Legacy state - will be removed after event stream migration is complete
  // Currently still used by ThinkingUI component during transition
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<Array<{
    id: number;
    text: string;
    status: 'streaming' | 'complete';
    type?: 'thinking' | 'search';
    query?: string;
    results?: Array<{ title: string; url: string }>;
    resultsCount?: number;
  }>>([]);
  const [showInitialLoader, setShowInitialLoader] = useState(false);
  
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('auto');
  
  // Model selection hook (handles persistence and loading)
  const { handleModelChange } = useModelSelection({ user, selectedModel, setSelectedModel });
  
  // UI state hook (dropdowns, panels, menus)
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    showComposerMenu,
    setShowComposerMenu,
    showModelSelector,
    setShowModelSelector,
    isActionHovered,
    setIsActionHovered,
    isRestoring,
    setIsRestoring,
    conversationMenuOpen,
    setConversationMenuOpen,
    showAddToProjectMenu,
    setShowAddToProjectMenu,
    submenuPosition,
    setSubmenuPosition,
    showArtifactPanel,
    setShowArtifactPanel,
    showSourcesPanel,
    setShowSourcesPanel,
  } = useUIState();
  
  const [selectedActions, setSelectedActions] = useState<{
    think: boolean;
    proSearch: boolean;
    createDoc: boolean;
    deepResearch: boolean;
    createDesign: boolean;
    createPresentation: boolean;
  }>({
    think: false,
    proSearch: false,
    createDoc: false,
    deepResearch: false,
    createDesign: false,
    createPresentation: false,
  });

  // File management hook
  const {
    attachedFiles,
    setAttachedFiles,
    totalMemoryUsed,
    setTotalMemoryUsed,
    handleFilesSelected,
    handleRemoveFile,
    calculateMemoryPercentage,
    getMemoryColor,
  } = useFileManagement({ user, setShowComposerMenu });
  
  // Message editing and regeneration state hook
  const {
    hoveredUserMessageId,
    setHoveredUserMessageId,
    editingMessageId,
    setEditingMessageId,
    editedContent,
    setEditedContent,
    showRegenerateMenu,
    setShowRegenerateMenu,
    activeBranches,
    setActiveBranches,
    regenerating,
    setRegenerating,
    regenerateStreamedContent,
    setRegenerateStreamedContent,
    regeneratingForParentId,
    setRegeneratingForParentId,
    pendingEditedUserMessageId,
    setPendingEditedUserMessageId,
    modelSwitchNotification,
    setModelSwitchNotification,
    editingInProgress,
    setEditingInProgress,
    handleBranchChange,
    resetParentBranchSelection,
  } = useMessageEditingState();
  
  const [projects, setProjects] = useState<any[]>([]);
  
  // Data initialization hook (auth, conversations, models, projects)
  const { isInitialMount } = useDataInitialization({
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
  });

  // WHAT THIS DOES: Connect to real-time updates SSE endpoint
  // Listens for tier config and model updates from admin panel
  // Automatically refreshes user data and models when admin makes changes
  // Past conversations are NOT affected - only future UI updates
  useRealtimeUpdates({
    setUser,
    setModels,
    user,
  });

  // WHAT THIS DOES: Restore new chat draft when user data is loaded and no conversation is active
  // If user has newChatDraft, restore it to composer bar when in new chat state
  useEffect(() => {
    if (user?.newChatDraft && !currentConversation && !streaming) {
      setMessage(user.newChatDraft);
    }
  }, [user?.newChatDraft, currentConversation, streaming, setMessage]);

  // Artifact state hook
  const {
    currentArtifact,
    setCurrentArtifact,
    streamingArtifact,
    setStreamingArtifact,
  } = useArtifactState();
  
  // Deep Research state hook
  const {
    researchProgress,
    setResearchProgress,
    researchQueries,
    setResearchQueries,
    searchProgress,
    setSearchProgress,
  } = useResearchState({ currentConversation });
  
  // Sources panel state variables for web search citations
  const [currentSources, setCurrentSources] = useState<any[]>([]);
  const [highlightedSourceIndex, setHighlightedSourceIndex] = useState<number | null>(null);
  
  // PPT Template Picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pptTemplateId, setPptTemplateId] = useState<string>('');
  const [pptThemeId, setPptThemeId] = useState<string>('');
  
  // Resizable panels state for artifact panel
  // When artifact panel is open, these control the split between chat and artifact areas
  const [chatPanelWidth, setChatPanelWidth] = useState(40); // 40% for chat when artifact is open
  const [artifactPanelWidth, setArtifactPanelWidth] = useState(60); // 60% for artifact
  const [isDragging, setIsDragging] = useState(false); // Track if user is dragging the divider
  
  // Message actions hook
  const {
    copiedMessageId,
    handleCopyMessage,
    handleCitationClick,
  } = useMessageActions({ setShowSourcesPanel, setHighlightedSourceIndex });

  // Pure data structures: conversation tree metadata (no visibility logic)
  // This section contains data-layer functions that work with raw database facts
  
  // Conversation tree hook (builds tree and provides helper functions)
  const {
    conversationTree,
    getAssistantBranches,
    getUserBranches,
    getSelectedBranchIndex,
    isMessageVisible,
    getActiveAssistantParentId,
  } = useConversationTree({ currentConversation, activeBranches });
  
  // Refs for DOM elements
  const modelSelectorRef = useRef<HTMLDivElement | null>(null);
  const composerMenuRef = useRef<HTMLDivElement | null>(null);
  const regenerateMenuRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  // WHAT THIS REF DOES: Single source of truth for tracking which conversation is currently streaming
  // This prevents streaming state from one conversation appearing in another conversation
  const activeStreamingConversationIdRef = useRef<string | null>(null);
  
  // Chat handlers hook (provides all action handler functions)
  const {
    handleNewChat,
    handleAddToProject,
    handleSendMessage,
    handleStartDeepResearch,
    handleCancelResearch,
    handleRegenerateMessage,
    handleLogout,
    handleEditMessage,
  } = useChatHandlers({
    message,
    setMessage,
    streaming,
    setStreaming,
    streamedContent,
    setStreamedContent,
    currentConversation,
    setCurrentConversation,
    addConversation,
    updateConversation,
    attachedFiles,
    setAttachedFiles,
    totalMemoryUsed,
    setTotalMemoryUsed,
    selectedModel,
    setSelectedModel,
    setModelSwitchNotification,
    selectedActions,
    setSelectedActions,
    setStreamingArtifact,
    setShowArtifactPanel,
    setCurrentArtifact,
    researchProgress,
    setResearchProgress,
    researchQueries,
    setResearchQueries,
    searchProgress,
    setSearchProgress,
    setCurrentSources,
    setIsThinking,
    setThinkingContent,
    setThinkingSteps,
    setShowInitialLoader,
    hoveredUserMessageId,
    setHoveredUserMessageId,
    editingMessageId,
    setEditingMessageId,
    editedContent,
    setEditedContent,
    editingInProgress,
    setEditingInProgress,
    pendingEditedUserMessageId,
    setPendingEditedUserMessageId,
    regenerating,
    setRegenerating,
    regenerateStreamedContent,
    setRegenerateStreamedContent,
    regeneratingForParentId,
    setRegeneratingForParentId,
    showRegenerateMenu,
    setShowRegenerateMenu,
    activeBranches,
    setActiveBranches,
    setConversations,
    setConversationMenuOpen,
    setShowAddToProjectMenu,
    setSubmenuPosition,
    textareaRef,
    activeStreamingConversationIdRef,
    setCurrentEventStream,
    getActiveAssistantParentId,
    clearUserData,
    onPPTTemplateRequired: () => setShowTemplatePicker(true),
  });

  // Handle PPT template selection
  const handlePPTTemplateSelect = async (templateId: string, themeId: string) => {
    setPptTemplateId(templateId);
    setPptThemeId(themeId);
    setShowTemplatePicker(false);
    
    // Send message with template selection to continue PPT generation
    if (currentConversation) {
      setSelectedActions(prev => ({
        ...prev,
        createPPT: true,
        pptTemplateId: templateId,
        pptThemeId: themeId,
      }));
      
      // Trigger message send with template info
      await handleSendMessage();
    }
  };

  // Handle divider drag for resizing chat and artifact panels
  // This allows users to adjust the split between chat and artifact areas
  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const startX = e.clientX;
    const startChatWidth = chatPanelWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Calculate the main content container width (excluding sidebar)
      const mainContent = document.querySelector('.main-content-container');
      if (!mainContent) return;
      
      const containerRect = mainContent.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      
      // Calculate new widths with constraints (20% min, 80% max for each panel)
      const newChatWidth = Math.min(80, Math.max(20, startChatWidth + deltaPercent));
      const newArtifactWidth = 100 - newChatWidth;
      
      setChatPanelWidth(newChatWidth);
      setArtifactPanelWidth(newArtifactWidth);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Click outside handler for all dropdowns and menus
  useClickOutside({
    showModelSelector,
    setShowModelSelector,
    modelSelectorRef,
    showComposerMenu,
    setShowComposerMenu,
    composerMenuRef,
    showRegenerateMenu,
    setShowRegenerateMenu,
    regenerateMenuRef,
    conversationMenuOpen,
    setConversationMenuOpen,
    setShowAddToProjectMenu,
    setSubmenuPosition,
    editingMessageId,
    editTextareaRef,
  });

  // =======================================================================================
  // PURE DATA LAYER: Build conversation tree from raw messages (no visibility logic)
  // =======================================================================================
  
  /**
   * Builds the complete conversation tree structure from raw message data.
   * This function ONLY works with database facts and never considers visibility.
   * It calculates branch counts and identifies which messages should be visible
   * based on the current branch selection.
   */
  // =======================================================================================
  // Tree building and helper functions are now in useConversationTree hook
  // =======================================================================================

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-text-primary">
        <div className="text-sm text-text-secondary">Loading your workspace…</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary">
      {/* Sources Panel - Web Search Citations */}
      {showSourcesPanel && currentSources.length > 0 && (
        <SourcesPanel
          sources={currentSources}
          highlightedIndex={highlightedSourceIndex}
          onClose={() => setShowSourcesPanel(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        sidebarCollapsed={sidebarCollapsed}
        toggleSidebar={toggleSidebar}
        user={user}
        conversations={conversations}
        currentConversation={currentConversation}
        setCurrentConversation={setCurrentConversation}
        handleNewChat={handleNewChat}
        handleLogout={handleLogout}
        conversationMenuOpen={conversationMenuOpen}
        setConversationMenuOpen={setConversationMenuOpen}
        showAddToProjectMenu={showAddToProjectMenu}
        setShowAddToProjectMenu={setShowAddToProjectMenu}
        submenuPosition={submenuPosition}
        setSubmenuPosition={setSubmenuPosition}
        projects={projects}
        handleAddToProject={handleAddToProject}
        getConversation={async (id: string) => {
          const res = await chatApi.getConversation(id);
                    setCurrentConversation(res.data.conversation);
          
          // WHAT THIS DOES: Restore draft text when loading conversation
          // If conversation has draftText, restore it to composer bar
          if (res.data.conversation.draftText) {
            setMessage(res.data.conversation.draftText);
          } else {
            setMessage('');
          }
          
          // WHAT THIS DOES: Reset streaming state when switching conversations
          // This prevents streaming state from one conversation appearing in another
          activeStreamingConversationIdRef.current = null;
          setStreaming(false);
          setStreamedContent('');
          setIsThinking(false);
          setThinkingContent('');
          setThinkingSteps([]);
          setShowInitialLoader(false);
          setCurrentEventStream(null);
          
          // WHAT THIS DOES: Close artifact panel if switching to a conversation that doesn't own the current artifact
          // This ensures only two states: panel open (showing) or panel closed (not taking space)
          if (currentArtifact && currentArtifact.conversationId !== res.data.conversation._id) {
            setShowArtifactPanel(false);
            setCurrentArtifact(null);
          }
        }}
      />

      {/* Main content area - flexible container for chat and artifact panels */}
      <div className="flex flex-1 overflow-hidden main-content-container">
        {/* Chat panel - dynamic width based on artifact panel state */}
        <div 
          className="flex flex-col py-2 transition-all duration-300 ease-out"
          style={{ 
            width: showArtifactPanel ? `${chatPanelWidth}%` : '100%' 
          }}
        >
        <TopBar
          selectedModel={selectedModel}
          models={models}
          showModelSelector={showModelSelector}
          setShowModelSelector={setShowModelSelector}
          modelSelectorRef={modelSelectorRef}
          handleModelChange={handleModelChange}
          modelSwitchNotification={modelSwitchNotification}
          user={user}
          currentConversation={currentConversation}
        />

        {/* Calculate if we have active conversation - determines composer position */}
        {(isRestoring || streaming || streamedContent || ((currentConversation?.messages?.length ?? 0) > 0)) ? (
          <>
            <div className="relative flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background px-3 py-4 pb-32">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
                  <MessageList
                    currentConversation={currentConversation}
                    conversationTree={conversationTree}
                    user={user}
                    editingMessageId={editingMessageId}
                    editedContent={editedContent}
                    setEditedContent={setEditedContent}
                    editTextareaRef={editTextareaRef}
                    hoveredUserMessageId={hoveredUserMessageId}
                    setHoveredUserMessageId={setHoveredUserMessageId}
                    copiedMessageId={copiedMessageId}
                    setEditingMessageId={setEditingMessageId}
                    handleCopyMessage={handleCopyMessage}
                    handleEditMessage={handleEditMessage}
                    handleBranchChange={handleBranchChange}
                    regeneratingForParentId={regeneratingForParentId}
                    regenerateStreamedContent={regenerateStreamedContent}
                    showRegenerateMenu={showRegenerateMenu}
                    setShowRegenerateMenu={setShowRegenerateMenu}
                    regenerateMenuRef={regenerateMenuRef}
                    regenerating={regenerating}
                    handleRegenerateMessage={handleRegenerateMessage}
                    setCurrentArtifact={setCurrentArtifact}
                    setShowArtifactPanel={setShowArtifactPanel}
                    setCurrentSources={setCurrentSources}
                    setShowSourcesPanel={setShowSourcesPanel}
                    handleCitationClick={handleCitationClick}
                    streamedContent={streamedContent}
                    isThinking={isThinking}
                    thinkingContent={thinkingContent}
                    thinkingSteps={thinkingSteps}
                    showInitialLoader={showInitialLoader}
                    currentEventStream={currentEventStream}
                    isMessageVisible={isMessageVisible}
                    getUserBranches={getUserBranches}
                    getAssistantBranches={getAssistantBranches}
                    getSelectedBranchIndex={getSelectedBranchIndex}
                    activeBranches={activeBranches}
                  />
                                      </div>
                                    </div>

              <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-12">
                <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col items-center gap-2 px-3 pb-4">
                  <UnifiedComposerBar
                    message={message}
                    setMessage={setMessage}
                    streaming={streaming}
                    textareaRef={textareaRef}
                    attachedFiles={attachedFiles}
                    calculateMemoryPercentage={calculateMemoryPercentage}
                    getMemoryColor={getMemoryColor}
                    selectedActions={selectedActions}
                    setSelectedActions={setSelectedActions}
                    showComposerMenu={showComposerMenu}
                    setShowComposerMenu={setShowComposerMenu}
                    composerMenuRef={composerMenuRef}
                    handleFilesSelected={handleFilesSelected}
                    handleRemoveFile={handleRemoveFile}
                    handleSendMessage={handleSendMessage}
                    handleStartDeepResearch={handleStartDeepResearch}
                    user={user}
                    totalMemoryUsed={totalMemoryUsed}
                    router={router}
                    designsApi={designsApi}
                    presentationsApi={presentationsApi}
                    currentConversationId={currentConversation?._id || null}
                  />
                  <div className="text-center text-xs text-text-secondary">Enter to send • Shift + Enter for a new line</div>
                  
                  {/* Deep Research Progress Panel */}
                  {streaming && researchProgress && (
                    <ResearchProgressPanel
                      streaming={streaming}
                      researchProgress={researchProgress}
                      researchQueries={researchQueries}
                      searchProgress={searchProgress}
                      onCancel={handleCancelResearch}
                    />
                            )}
                          </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            message={message}
            setMessage={setMessage}
            streaming={streaming}
            textareaRef={textareaRef}
            attachedFiles={attachedFiles}
            handleRemoveFile={handleRemoveFile}
            calculateMemoryPercentage={calculateMemoryPercentage}
            getMemoryColor={getMemoryColor}
            selectedActions={selectedActions}
            setSelectedActions={setSelectedActions}
            showComposerMenu={showComposerMenu}
            setShowComposerMenu={setShowComposerMenu}
            composerMenuRef={composerMenuRef}
            handleFilesSelected={handleFilesSelected}
            handleSendMessage={handleSendMessage}
            handleStartDeepResearch={handleStartDeepResearch}
            user={user}
            totalMemoryUsed={totalMemoryUsed}
            router={router}
            designsApi={designsApi}
            presentationsApi={presentationsApi}
          />
        )}
                    </div>
        
        {/* Resizable divider - only show when artifact panel is open */}
        {showArtifactPanel && (
          <div
            onMouseDown={handleDividerMouseDown}
            className={`w-1 flex-shrink-0 bg-border hover:bg-blue-500 cursor-col-resize transition-colors ${isDragging ? 'bg-blue-500' : ''}`}
            title="Drag to resize panels"
          />
        )}
        
        {/* Artifact Panel - dynamic width */}
        {showArtifactPanel && (
          <div 
            className="flex-shrink-0 transition-all duration-300 ease-out"
            style={{ width: `${artifactPanelWidth}%` }}
          >
            <ArtifactPanel
              artifact={streamingArtifact || currentArtifact}
              isStreaming={!!streamingArtifact}
              onClose={() => {
                setShowArtifactPanel(false);
                setStreamingArtifact(null);
              }}
              conversationId={currentConversation?._id || ''}
            />
          </div>
        )}
      </div>
      
      {/* PPT Template Picker Modal */}
      <TemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={handlePPTTemplateSelect}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background text-text-primary">
        <div className="text-sm text-text-secondary">Loading chat...</div>
                          </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}