// Reusable composer bar component for chat interface
// Used in both bottom (active conversation) and centered (new chat) positions
'use client';

import { FileChip } from '@/components/FileChip';
import { FileUploadHandler } from '@/components/FileUploadHandler';

// SVG Icons used in composer
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

// Type definitions for attached files
interface AttachedFile {
  id: string;
  file: File;
  status: 'uploading' | 'uploaded' | 'error';
  uploadProgress?: number;
  error?: string;
}

// Type definitions for selected actions (Think, Pro Search)
interface SelectedActions {
  think: boolean;
  proSearch: boolean;
}

// Props interface for ComposerBar component
interface ComposerBarProps {
  variant: 'bottom' | 'centered';
  message: string;
  setMessage: (message: string) => void;
  streaming: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  attachedFiles: AttachedFile[];
  calculateMemoryPercentage: () => number;
  getMemoryColor: () => string;
  selectedActions: SelectedActions;
  setSelectedActions: React.Dispatch<React.SetStateAction<SelectedActions>>;
  showComposerMenu: boolean;
  setShowComposerMenu: (show: boolean) => void;
  composerMenuRef: React.RefObject<HTMLDivElement>;
  handleFilesSelected: (files: File[]) => void;
  handleRemoveFile: (fileId: string) => void;
  handleSendMessage: () => void;
  user: any;
  totalMemoryUsed: number;
}

export default function ComposerBar({
  variant,
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
  user,
  totalMemoryUsed,
}: ComposerBarProps) {
  // Container wrapper classes based on variant
  const containerClass = variant === 'bottom'
    ? 'pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-12'
    : '';

  const innerContainerClass = variant === 'bottom'
    ? 'pointer-events-auto mx-auto flex w-full max-w-3xl flex-col items-center gap-2 px-3 pb-4'
    : 'w-full max-w-3xl';

  return (
    <div className={containerClass}>
      <div className={innerContainerClass}>
        <div className="relative flex w-full flex-col rounded-3xl border border-border bg-surface shadow-lg">
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
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className={`h-full transition-all duration-300 ${getMemoryColor()}`}
                  style={{ width: `${calculateMemoryPercentage()}%` }}
                />
              </div>
            </div>
          )}

          {/* Main composer area with textarea and buttons */}
          <div className={`px-2 py-2 ${selectedActions.think || selectedActions.proSearch ? 'space-y-2' : ''}`}>
            <div className="flex items-center gap-2">
              {/* Plus button for file upload/actions menu - only show when no badges active */}
              {!selectedActions.think && !selectedActions.proSearch && (
                <div className="relative" ref={composerMenuRef}>
                  <button
                    onClick={() => setShowComposerMenu(!showComposerMenu)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-surface-subtle"
                    aria-label="Open menu"
                    type="button"
                  >
                    <PlusIcon className="h-5 w-5" />
                  </button>

                  {/* File upload and actions dropdown menu */}
                  {showComposerMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-card" ref={composerMenuRef}>
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
                    handleSendMessage();
                  }
                }}
                placeholder="Message ChatZone"
                disabled={streaming}
                rows={1}
                className="flex-1 max-h-[240px] resize-none overflow-y-auto bg-transparent px-2 py-1.5 text-base leading-5 text-text-primary placeholder:text-text-secondary focus:outline-none"
                style={{
                  height: '32px',
                  minHeight: '32px',
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = '32px';
                  target.style.height = `${Math.min(target.scrollHeight, 240)}px`;
                }}
              />

              {/* Send button */}
              <button
                onClick={() => handleSendMessage()}
                disabled={!message.trim() || streaming}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
                type="button"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                  <path d="M3 10l14-7-7 14-2-7-5-0z" />
                </svg>
              </button>
            </div>

            {/* Secondary row for Think/Pro Search badges when active */}
            {(selectedActions.think || selectedActions.proSearch) && (
              <div className="flex items-center gap-2">
                {/* Plus button on second row when badges are active */}
                <div className="relative" ref={composerMenuRef}>
                  <button
                    onClick={() => setShowComposerMenu(!showComposerMenu)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-surface-subtle"
                    aria-label="Open menu"
                    type="button"
                  >
                    <PlusIcon className="h-4.5 w-4.5" />
                  </button>

                  {/* File upload and actions dropdown menu for second row */}
                  {showComposerMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-card" ref={composerMenuRef}>
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
                  <div className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
                    <span>Think</span>
                    <button
                      type="button"
                      onClick={() => setSelectedActions(prev => ({ ...prev, think: false }))}
                      className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-accent hover:bg-accent/20"
                      aria-label="Remove Think"
                    >
                      <CloseIcon className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Pro Search badge - removable */}
                {selectedActions.proSearch && (
                  <div className="flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-500">
                    <span>Pro Search</span>
                    <button
                      type="button"
                      onClick={() => setSelectedActions(prev => ({ ...prev, proSearch: false }))}
                      className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-blue-500 hover:bg-blue-500/20"
                      aria-label="Remove Pro Search"
                    >
                      <CloseIcon className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Help text explaining keyboard shortcuts */}
        <div className="text-center text-xs text-text-secondary">Enter to send • Shift + Enter for a new line</div>
      </div>
    </div>
  );
}

