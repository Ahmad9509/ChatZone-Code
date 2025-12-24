'use client';

import UnifiedComposerBar from '@/components/UnifiedComposerBar';
import { AttachedFile } from '@/types/file';

interface SelectedActions {
  think: boolean;
  proSearch: boolean;
  createDoc: boolean;
  deepResearch: boolean;
  createDesign: boolean;
  createPresentation: boolean;
}

interface EmptyStateProps {
  message: string;
  setMessage: (message: string) => void;
  streaming: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  attachedFiles: AttachedFile[];
  handleRemoveFile: (fileId: string) => void;
  calculateMemoryPercentage: () => number;
  getMemoryColor: () => string;
  selectedActions: SelectedActions;
  setSelectedActions: React.Dispatch<React.SetStateAction<SelectedActions>>;
  showComposerMenu: boolean;
  setShowComposerMenu: (show: boolean) => void;
  composerMenuRef: React.RefObject<HTMLDivElement | null>;
  handleFilesSelected: (files: File[]) => void;
  handleSendMessage: () => void;
  handleStartDeepResearch: () => void;
  user: any;
  totalMemoryUsed: number;
  router: any;
  designsApi: any;
  presentationsApi: any;
}

export const EmptyState = ({
  message,
  setMessage,
  streaming,
  textareaRef,
  attachedFiles,
  handleRemoveFile,
  calculateMemoryPercentage,
  getMemoryColor,
  selectedActions,
  setSelectedActions,
  showComposerMenu,
  setShowComposerMenu,
  composerMenuRef,
  handleFilesSelected,
  handleSendMessage,
  handleStartDeepResearch,
  user,
  totalMemoryUsed,
  router,
  designsApi,
  presentationsApi,
}: EmptyStateProps) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-3">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-text-primary">Where should we begin?</h1>
      </div>
      <div className="w-full max-w-3xl">
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
          currentConversationId={null}
        />
        <div className="mt-2 text-center text-xs text-text-secondary">Enter to send • Shift + Enter for a new line</div>
      </div>
    </div>
  );
};

