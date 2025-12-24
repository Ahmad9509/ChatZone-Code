// Unified Composer Bar Component
// Single source of truth for all composer bar implementations
'use client';

import { useEffect, useRef } from 'react';
import { FileChip } from '@/components/FileChip';
import { FileUploadHandler } from '@/components/FileUploadHandler';
import { AttachedFile } from '@/types/file';
import { chat as chatApi } from '@/lib/api';

// SVG Icons
const PlusIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
    <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const CloseIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
    <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// Props interface for UnifiedComposerBar component
interface UnifiedComposerBarProps {
  message: string;
  setMessage: (message: string) => void;
  streaming: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null> | React.MutableRefObject<HTMLTextAreaElement | null>;
  attachedFiles: AttachedFile[];
  calculateMemoryPercentage: () => number;
  getMemoryColor: () => string;
  selectedActions: {
    think: boolean;
    proSearch: boolean;
    createDoc: boolean;
    deepResearch: boolean;
    createDesign: boolean;
    createPresentation: boolean;
  };
  setSelectedActions: React.Dispatch<React.SetStateAction<{
    think: boolean;
    proSearch: boolean;
    createDoc: boolean;
    deepResearch: boolean;
    createDesign: boolean;
    createPresentation: boolean;
  }>>;
  showComposerMenu: boolean;
  setShowComposerMenu: (show: boolean) => void;
  composerMenuRef: React.RefObject<HTMLDivElement | null> | React.MutableRefObject<HTMLDivElement | null>;
  handleFilesSelected: (files: File[]) => void;
  handleRemoveFile: (fileId: string) => void;
  handleSendMessage: () => void;
  handleStartDeepResearch: () => void;
  user: any;
  totalMemoryUsed: number;
  router: any;
  designsApi: any;
  presentationsApi: any;
  currentConversationId?: string | null; // WHAT THIS DOES: Current conversation ID or null for new chat - used for draft saving
}

export default function UnifiedComposerBar({
  message,
  setMessage,
  streaming,
  textareaRef,
  attachedFiles,
  calculateMemoryPercentage,
  getMemoryColor,
  selectedActions,
  setSelectedActions,
  showComposerMenu,
  setShowComposerMenu,
  composerMenuRef,
  handleFilesSelected,
  handleRemoveFile,
  handleSendMessage,
  handleStartDeepResearch,
  user,
  totalMemoryUsed,
  router,
  designsApi,
  presentationsApi,
  currentConversationId,
}: UnifiedComposerBarProps) {
  // Check if any action is currently selected
  // This is used to show/hide the plus button and determine layout spacing
  const hasAnyActionSelected = Object.values(selectedActions).some(value => value === true);

  // WHAT THIS DOES: Save draft text in real-time as user types
  // Saves immediately on every keystroke (no debouncing)
  // Uses 'new' as conversation ID if no conversation exists yet
  const saveDraftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // WHAT THIS DOES: Clear any pending save when component unmounts or conversation changes
    if (saveDraftTimeoutRef.current) {
      clearTimeout(saveDraftTimeoutRef.current);
    }

    // WHAT THIS DOES: Don't save draft if streaming (message is being sent)
    if (streaming) return;

    // WHAT THIS DOES: Determine conversation ID - use 'new' if no conversation exists
    const conversationId = currentConversationId || 'new';

    // WHAT THIS DOES: Save draft immediately (real-time, no debouncing)
    const saveDraft = async () => {
      try {
        await chatApi.saveDraft(conversationId, message);
      } catch (error) {
        // WHAT THIS DOES: Silently fail - draft saving shouldn't interrupt user experience
        console.error('Failed to save draft:', error);
      }
    };

    saveDraft();

    return () => {
      if (saveDraftTimeoutRef.current) {
        clearTimeout(saveDraftTimeoutRef.current);
      }
    };
  }, [message, currentConversationId, streaming]);

  const handleSendClick = async () => {
    if (selectedActions.deepResearch) {
      handleStartDeepResearch();
      setSelectedActions(prev => ({ ...prev, deepResearch: false }));
    } else if (selectedActions.createDesign) {
      // Navigate to designs and create new design
      try {
        const response = await designsApi.createDesign({
          title: message.trim() || 'New Design',
          designType: 'custom',
          width: 1080,
          height: 1080,
        });
        const newDesign = response.data.design;
        router.push(`/designs/${newDesign.designId}`);
      } catch (error) {
        console.error('Failed to create design:', error);
        alert('Failed to create design. Please try again.');
      }
    } else if (selectedActions.createPresentation) {
      // Create presentation as artifact (not redirect to presentations page)
      // This will trigger artifact mode with code/preview tabs
      setSelectedActions(prev => ({ ...prev, createPresentation: false }));
      handleSendMessage();
    } else if (selectedActions.createDoc) {
      // Create doc as artifact - triggers artifact mode via forceArtifact flag
      // The forceArtifact flag is passed to backend which adds artifact instructions to system prompt
      setSelectedActions(prev => ({ ...prev, createDoc: false }));
      handleSendMessage();
    } else {
      handleSendMessage();
    }
  };

  return (
    <div className="relative flex w-full flex-col rounded-2xl border-0 bg-surface soft-elevated neumorphic-transition">
      {/* File chips display - shows attached files with upload progress */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          {attachedFiles.map((file) => (
            <FileChip
              key={file.id}
              fileName={file.file.name}
              fileSize={file.file.size}
              fileType={file.file.type}
              status={file.status}
              uploadProgress={file.uploadProgress}
              error={file.error}
              onRemove={() => handleRemoveFile(file.id)}
            />
          ))}
        </div>
      )}

      {/* Memory usage bar - shows how much context memory is used */}
      {attachedFiles.length > 0 && (
        <div className="px-4 pb-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              Memory: {calculateMemoryPercentage().toFixed(0)}% full
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-subtle soft-pressed">
            <div
              className={`h-full transition-all duration-300 ${getMemoryColor()}`}
              style={{ width: `${calculateMemoryPercentage()}%` }}
            />
          </div>
        </div>
      )}

      {/* Main composer area with textarea and buttons */}
      <div className={`px-3 py-3 ${hasAnyActionSelected ? 'space-y-2' : ''}`}>
        <div className="flex items-end gap-2">
          {/* Plus button for file upload/actions menu - only show when no badges active */}
          {!hasAnyActionSelected && (
            <div className="relative" ref={composerMenuRef}>
              <button
                onClick={() => setShowComposerMenu(!showComposerMenu)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface text-text-secondary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Open menu"
                type="button"
              >
                <PlusIcon className="h-5 w-5" />
              </button>

              {/* File upload and actions dropdown menu */}
              {showComposerMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-2xl border-0 bg-surface soft-elevated z-10" ref={composerMenuRef}>
                  <FileUploadHandler
                    onFilesSelected={handleFilesSelected}
                    tier={user?.tier || 'free'}
                    tierConfig={user?.tierConfig || null}
                    currentMemoryUsage={totalMemoryUsed}
                    onActionSelected={(action) => {
                      setSelectedActions(prev => ({
                        ...prev,
                        [action]: true
                      }));
                      setShowComposerMenu(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Textarea for message input - auto-grows vertically as user types */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendClick(); // WHAT THIS DOES: Use same logic as send button to handle all actions (Deep Research, Create Design, Create Presentation, etc.)
              }
            }}
            placeholder="Ask anything…"
            disabled={streaming}
            rows={1}
            className="flex-1 max-h-[40vh] resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-base leading-[1.7] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-0"
            style={{
              height: 'auto',
              minHeight: '44px',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, window.innerHeight * 0.4)}px`;
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSendClick}
            disabled={!message.trim() || streaming}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            aria-label="Send message"
            type="button"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
              <path d="M3 10l14-7-7 14-2-7-5-0z" />
            </svg>
          </button>
        </div>

        {/* Secondary row for action badges when active */}
        {hasAnyActionSelected && (
          <div className="flex items-center gap-2">
            {/* Plus button on second row when badges are active */}
            <div className="relative" ref={composerMenuRef}>
              <button
                onClick={() => setShowComposerMenu(!showComposerMenu)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text-secondary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label="Open menu"
                type="button"
              >
                <PlusIcon className="h-4.5 w-4.5" />
              </button>

              {/* File upload and actions dropdown menu for second row */}
              {showComposerMenu && (
                <div className="absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-2xl border-0 bg-surface soft-elevated z-10" ref={composerMenuRef}>
                  <FileUploadHandler
                    onFilesSelected={handleFilesSelected}
                    tier={user?.tier || 'free'}
                    tierConfig={user?.tierConfig || null}
                    currentMemoryUsage={totalMemoryUsed}
                    onActionSelected={(action) => {
                      setSelectedActions(prev => ({
                        ...prev,
                        [action]: true
                      }));
                      setShowComposerMenu(false);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Think badge - removable */}
            {selectedActions.think && (
              <div className="flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent soft-elevated">
                <span>Think</span>
                <button
                  type="button"
                  onClick={() => setSelectedActions(prev => ({ ...prev, think: false }))}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-accent hover:bg-accent/20 neumorphic-transition"
                  aria-label="Remove Think"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Pro Search badge - removable */}
            {selectedActions.proSearch && (
              <div className="flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-500 soft-elevated">
                <span>Pro Search</span>
                <button
                  type="button"
                  onClick={() => setSelectedActions(prev => ({ ...prev, proSearch: false }))}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-blue-500 hover:bg-blue-500/20 neumorphic-transition"
                  aria-label="Remove Pro Search"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Create Doc badge - removable */}
            {selectedActions.createDoc && (
              <div className="flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-500 soft-elevated">
                <span>Create Doc</span>
                <button
                  type="button"
                  onClick={() => setSelectedActions(prev => ({ ...prev, createDoc: false }))}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-purple-500 hover:bg-purple-500/20 neumorphic-transition"
                  aria-label="Remove Create Doc"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Deep Research badge - removable */}
            {selectedActions.deepResearch && (
              <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500 soft-elevated">
                <span>Deep Research</span>
                <button
                  type="button"
                  onClick={() => setSelectedActions(prev => ({ ...prev, deepResearch: false }))}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-emerald-500 hover:bg-emerald-500/20 neumorphic-transition"
                  aria-label="Remove Deep Research"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Create Design badge - removable */}
            {selectedActions.createDesign && (
              <div className="flex items-center gap-2 rounded-full bg-pink-500/10 px-3 py-1.5 text-xs font-medium text-pink-500 soft-elevated">
                <span>🎨 Create Design</span>
                <button
                  type="button"
                  onClick={() => setSelectedActions(prev => ({ ...prev, createDesign: false }))}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-pink-500 hover:bg-pink-500/20 neumorphic-transition"
                  aria-label="Remove Create Design"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Create Presentation badge - removable */}
            {selectedActions.createPresentation && (
              <div className="flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-500 soft-elevated">
                <span>📊 Create Presentation</span>
                <button
                  type="button"
                  onClick={() => setSelectedActions(prev => ({ ...prev, createPresentation: false }))}
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-cyan-500 hover:bg-cyan-500/20 neumorphic-transition"
                  aria-label="Remove Create Presentation"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

