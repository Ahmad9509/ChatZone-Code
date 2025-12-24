'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { ThinkingUI } from './ThinkingUI';
import { EventStreamRenderer } from './EventStreamRenderer';
import { CodeBlock } from '../markdown/CodeBlock';
import { MarkdownTable } from '../markdown/MarkdownTable';
import { shouldShowThinkingUI } from '@/utils/thinkingUtils';
import { MessageEventStream } from '@/types/eventStream';

interface MessageListProps {
  currentConversation: any;
  conversationTree: any;
  user: any;
  // User message props
  editingMessageId: string | null;
  editedContent: string;
  setEditedContent: (content: string) => void;
  editTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  hoveredUserMessageId: string | null;
  setHoveredUserMessageId: (id: string | null) => void;
  copiedMessageId: string | null;
  setEditingMessageId: (id: string | null) => void;
  handleCopyMessage: (content: string, messageId: string) => void;
  handleEditMessage: (message: any) => void;
  handleBranchChange: (parentId: string, newIndex: number) => void;
  // Assistant message props
  regeneratingForParentId: string | null;
  regenerateStreamedContent: string;
  showRegenerateMenu: string | null;
  setShowRegenerateMenu: (id: string | null) => void;
  regenerateMenuRef: React.RefObject<HTMLDivElement | null>;
  regenerating: boolean;
  handleRegenerateMessage: (msgIndex: number, directive: string) => void;
  setCurrentArtifact: (artifact: any) => void;
  setShowArtifactPanel: (show: boolean) => void;
  setCurrentSources: (sources: any[]) => void;
  setShowSourcesPanel: (show: boolean) => void;
  handleCitationClick: (citationNum: number) => void;
  // Streaming message
  streamedContent: string;
  // Thinking state props
  isThinking?: boolean;
  thinkingContent?: string;
  thinkingSteps?: Array<{
    id: number;
    text: string;
    status: 'streaming' | 'complete';
    type?: 'thinking' | 'search';
    query?: string;
    results?: Array<{ title: string; url: string }>;
    resultsCount?: number;
  }>;
  showInitialLoader?: boolean;
  // Event stream for dynamic rendering
  currentEventStream?: MessageEventStream | null;
  // Branching helpers
  isMessageVisible: (messageId: string) => boolean;
  getUserBranches: (parentId: string) => string[];
  getAssistantBranches: (userMessageId: string) => string[];
  getSelectedBranchIndex: (parentId: string, branchCount: number) => number;
  activeBranches: Record<string, number>;
}

export const MessageList = ({
  currentConversation,
  conversationTree,
  user,
  // User message props
  editingMessageId,
  editedContent,
  setEditedContent,
  editTextareaRef,
  hoveredUserMessageId,
  setHoveredUserMessageId,
  copiedMessageId,
  setEditingMessageId,
  handleCopyMessage,
  handleEditMessage,
  handleBranchChange,
  // Assistant message props
  regeneratingForParentId,
  regenerateStreamedContent,
  showRegenerateMenu,
  setShowRegenerateMenu,
  regenerateMenuRef,
  regenerating,
  handleRegenerateMessage,
  setCurrentArtifact,
  setShowArtifactPanel,
  setCurrentSources,
  setShowSourcesPanel,
  handleCitationClick,
  // Streaming
  streamedContent,
  // Thinking state
  isThinking = false,
  thinkingContent = '',
  thinkingSteps = [],
  showInitialLoader = false,
  currentEventStream = null,
  // Branching helpers
  isMessageVisible,
  getUserBranches,
  getAssistantBranches,
  getSelectedBranchIndex,
  activeBranches,
}: MessageListProps) => {
  const messages = currentConversation?.messages || [];
  const renderedPairs: React.JSX.Element[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === 'user') {
      const userMessageId = msg.messageId;
      const userBranchParentId = msg.parentMessageId || 'root';

      if (!isMessageVisible(userMessageId)) {
        i++;
        continue;
      }

      const userBranches = getUserBranches(userBranchParentId);
      const userBranchCount = userBranches.length;
      const userBranchIndex = userBranches.findIndex((branchId) => branchId === userMessageId);
      const selectedUserBranchIndex = getSelectedBranchIndex(userBranchParentId, userBranchCount);
      const userBranchLabel = `${selectedUserBranchIndex + 1} / ${userBranchCount || 1}`;
      const isEditing = editingMessageId === userMessageId;

      renderedPairs.push(
        <UserMessage
          key={`user-${userMessageId}`}
          message={msg}
          user={user}
          isEditing={isEditing}
          editedContent={editedContent}
          setEditedContent={setEditedContent}
          editTextareaRef={editTextareaRef}
          hoveredUserMessageId={hoveredUserMessageId}
          setHoveredUserMessageId={setHoveredUserMessageId}
          copiedMessageId={copiedMessageId}
          userBranchCount={userBranchCount}
          userBranchLabel={userBranchLabel}
          selectedUserBranchIndex={selectedUserBranchIndex}
          userBranchParentId={userBranchParentId}
          handleCopyMessage={handleCopyMessage}
          handleEditMessage={handleEditMessage}
          handleBranchChange={handleBranchChange}
          setEditingMessageId={setEditingMessageId}
        />
      );

      const assistantBranches = getAssistantBranches(userMessageId);
      const assistantBranchCount = assistantBranches.length;
      const activeAssistantBranchIndex = getSelectedBranchIndex(userMessageId, assistantBranchCount);

      const activeAssistantMsgId = assistantBranches[activeAssistantBranchIndex];
      const activeAssistantMsg = activeAssistantMsgId
        ? messages.find((m: any) => m.messageId === activeAssistantMsgId)
        : null;

      if (activeAssistantMsg) {
        const isRegeneratingThis = regeneratingForParentId === userMessageId;
        
        renderedPairs.push(
          <AssistantMessage
            key={`assistant-${userMessageId}-${activeAssistantMsg.messageId}`}
            message={activeAssistantMsg}
            userMessageId={userMessageId}
            isRegenerating={isRegeneratingThis}
            regenerateStreamedContent={regenerateStreamedContent}
            copiedMessageId={copiedMessageId}
            showRegenerateMenu={showRegenerateMenu}
            setShowRegenerateMenu={setShowRegenerateMenu}
            regenerateMenuRef={regenerateMenuRef}
            regenerating={regenerating}
            messages={messages}
            assistantBranchCount={assistantBranchCount}
            activeAssistantBranchIndex={activeAssistantBranchIndex}
            currentConversation={currentConversation}
            handleCopyMessage={handleCopyMessage}
            handleRegenerateMessage={handleRegenerateMessage}
            handleBranchChange={handleBranchChange}
            setCurrentArtifact={setCurrentArtifact}
            setShowArtifactPanel={setShowArtifactPanel}
            setCurrentSources={setCurrentSources}
            setShowSourcesPanel={setShowSourcesPanel}
            handleCitationClick={handleCitationClick}
            isThinking={isThinking}
            thinkingContent={thinkingContent}
            thinkingSteps={thinkingSteps}
            showInitialLoader={showInitialLoader}
          />
        );
      }

      i++;
    } else if (msg.role === 'assistant' && !msg.parentMessageId) {
      // Legacy assistant message (old format without branching)
      renderedPairs.push(
        <div key={`legacy-assistant-${i}`} className="flex flex-col gap-3 animate-message-appear">
          <div className="prose prose-sm max-w-none break-words text-text-primary rounded-2xl bg-surface-subtle px-5 py-4 leading-[1.7] soft-elevated">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content}
            </ReactMarkdown>
          </div>
        </div>
      );
      i++;
    } else {
      i++;
    }
  }

  return (
    <>
      {renderedPairs}

      {/* Streaming message - appears while AI is responding in real-time */}
      {streamedContent && (
        <div className="flex flex-col gap-3 animate-message-appear">
          {/* WHAT THIS SECTION DOES: Render events dynamically in chronological order */}
          {/* Uses EventStreamRenderer when event stream exists, falls back to legacy rendering */}
          {currentEventStream && currentEventStream.events.length > 0 ? (
            <EventStreamRenderer
              events={currentEventStream.events}
              isThinking={isThinking}
              thinkingContent={thinkingContent}
              thinkingSteps={thinkingSteps}
            />
          ) : (
            <>
              {/* WHAT THIS DOES: Legacy rendering fallback when event stream not available */}
              {shouldShowThinkingUI({
                isThinking,
                showInitialLoader,
                thinkingSteps,
                currentConversation,
                streamedContent
              }) && (
                <ThinkingUI
                  isThinking={isThinking}
                  thinkingContent={thinkingContent}
                  thinkingSteps={thinkingSteps}
                  showInitialLoader={showInitialLoader}
                />
              )}
              
              <div className="prose prose-sm max-w-none break-words text-text-primary rounded-2xl bg-surface-subtle px-5 py-4 leading-[1.7] soft-elevated">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match;
                      return !isInline ? (
                        <CodeBlock className={className}>
                          {String(children).replace(/\n$/, '')}
                        </CodeBlock>
                      ) : (
                        <code className={`${className} rounded bg-surface px-1.5 py-0.5 text-xs`} {...props}>
                          {children}
                        </code>
                      );
                    },
                    table({ children, ...props }: any) {
                      return <MarkdownTable {...props}>{children}</MarkdownTable>;
                    },
                    thead({ children }: any) {
                      return <thead className="bg-surface-subtle sticky top-0 z-0">{children}</thead>;
                    },
                    tbody({ children }: any) {
                      return <tbody>{children}</tbody>;
                    },
                    tr({ children, ...props }: any) {
                      return (
                        <tr className="border-b border-border last:border-0" {...props}>
                          {children}
                        </tr>
                      );
                    },
                    th({ children, ...props }: any) {
                      return (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-primary" {...props}>
                          {children}
                        </th>
                      );
                    },
                    td({ children, ...props }: any) {
                      return (
                        <td className="px-4 py-3 text-sm text-text-primary" {...props}>
                          {children}
                        </td>
                      );
                    },
                  }}
                >
                  {streamedContent}
                </ReactMarkdown>
              </div>
            </>
          )}
          
          <div className="text-sm text-accent">▌</div>
        </div>
      )}
    </>
  );
};



