'use client';

import { CopyIcon, CheckIcon, EditIcon } from '@/components/icons';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';

interface UserMessageProps {
  message: any;
  user: any;
  isEditing: boolean;
  editedContent: string;
  setEditedContent: (content: string) => void;
  editTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  hoveredUserMessageId: string | null;
  setHoveredUserMessageId: (id: string | null) => void;
  copiedMessageId: string | null;
  userBranchCount: number;
  userBranchLabel: string;
  selectedUserBranchIndex: number;
  userBranchParentId: string;
  handleCopyMessage: (content: string, messageId: string) => void;
  handleEditMessage: (message: any) => void;
  handleBranchChange: (parentId: string, newIndex: number) => void;
  setEditingMessageId: (id: string | null) => void;
}

export const UserMessage = ({
  message,
  user,
  isEditing,
  editedContent,
  setEditedContent,
  editTextareaRef,
  hoveredUserMessageId,
  setHoveredUserMessageId,
  copiedMessageId,
  userBranchCount,
  userBranchLabel,
  selectedUserBranchIndex,
  userBranchParentId,
  handleCopyMessage,
  handleEditMessage,
  handleBranchChange,
  setEditingMessageId,
}: UserMessageProps) => {
  const userMessageId = message.messageId;

  return (
    <div
      key={`user-${userMessageId}`}
      className="group flex flex-col items-end gap-2 animate-message-appear"
      onMouseEnter={() => setHoveredUserMessageId(userMessageId)}
      onMouseLeave={() => setHoveredUserMessageId(null)}
    >
      <div className="flex items-start gap-3 max-w-[85%] ml-auto">
        <div className="flex flex-col items-end gap-1.5 flex-1">
          {/* Message bubble */}
          <div className="rounded-2xl bg-surface-subtle px-5 py-4 text-base leading-[1.7] text-text-primary max-w-full soft-elevated neumorphic-transition hover:soft-hover">
            {isEditing ? (
              <div className="flex flex-col gap-3">
                <textarea
                  ref={editTextareaRef}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full resize-y rounded-xl border-0 bg-background px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent soft-pressed"
                  rows={Math.max(3, Math.min(12, editedContent.split('\n').length + 1))}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditingMessageId(null);
                      setEditedContent('');
                    }}
                    className="rounded-xl border-0 bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleEditMessage(message)}
                    className="rounded-xl bg-accent px-4 py-1.5 text-xs font-semibold text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                    disabled={!editedContent.trim()}
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
          
          {/* Action buttons on hover */}
          {!isEditing && hoveredUserMessageId === userMessageId && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleCopyMessage(message.content, userMessageId)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-secondary hover:bg-surface-subtle hover:text-text-primary transition-colors soft-elevated neumorphic-transition hover:soft-hover"
                aria-label="Copy"
              >
                {copiedMessageId === userMessageId ? (
                  <CheckIcon className="h-3.5 w-3.5" />
                ) : (
                  <CopyIcon className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => {
                  setEditingMessageId(userMessageId);
                  setEditedContent(message.content);
                  setTimeout(() => {
                    if (editTextareaRef.current) {
                      const textarea = editTextareaRef.current;
                      textarea.focus();
                      const length = textarea.value.length;
                      textarea.setSelectionRange(length, length);
                    }
                  }, 0);
                }}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-secondary hover:bg-surface-subtle hover:text-text-primary transition-colors soft-elevated neumorphic-transition hover:soft-hover"
                aria-label="Edit prompt"
              >
                <EditIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          
          {/* Branch navigation */}
          {userBranchCount > 1 && !isEditing && (
            <div className="flex items-center gap-1 text-xs text-text-secondary">
              <button
                onClick={() => handleBranchChange(userBranchParentId, Math.max(0, selectedUserBranchIndex - 1))}
                disabled={selectedUserBranchIndex === 0}
                className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed soft-elevated neumorphic-transition hover:soft-hover"
                aria-label="Previous prompt edit"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="px-1">{userBranchLabel}</span>
              <button
                onClick={() => handleBranchChange(userBranchParentId, Math.min(userBranchCount - 1, selectedUserBranchIndex + 1))}
                disabled={selectedUserBranchIndex === userBranchCount - 1}
                className="flex h-6 w-6 items-center justify-center rounded-lg hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed soft-elevated neumorphic-transition hover:soft-hover"
                aria-label="Next prompt edit"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

