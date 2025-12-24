'use client';

interface ModelSwitchNotification {
  visible: boolean;
  message: string;
}

interface Model {
  _id: string;
  displayName?: string;
  name?: string;
  modelId?: string;
}

interface TopBarProps {
  selectedModel: string;
  models: Model[];
  showModelSelector: boolean;
  setShowModelSelector: (show: boolean) => void;
  modelSelectorRef: React.RefObject<HTMLDivElement | null>;
  handleModelChange: (modelId: string) => void;
  modelSwitchNotification: ModelSwitchNotification;
  user: {
    proRepliesCount?: {
      total?: number;
    };
  };
  currentConversation?: {
    title?: string;
    _id?: string;
  } | null;
}

export const TopBar = ({
  selectedModel,
  models,
  showModelSelector,
  setShowModelSelector,
  modelSelectorRef,
  handleModelChange,
  modelSwitchNotification,
  user,
  currentConversation,
}: TopBarProps) => {
  return (
    <div className="flex items-center justify-end px-6 py-4">
      <div className="flex items-center gap-3">
        {/* Model Selector */}
        <div className="relative" ref={modelSelectorRef}>
          <button
            onClick={() => setShowModelSelector(!showModelSelector)}
            className="flex items-center gap-2 rounded-xl border-0 bg-surface px-4 py-2.5 text-sm font-medium text-text-primary soft-elevated neumorphic-transition hover:soft-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            type="button"
          >
            <span>🤖</span>
            <span>
              {selectedModel === 'auto'
                ? 'Auto'
                : models.find((m) => m._id === selectedModel)?.displayName ||
                  models.find((m) => m._id === selectedModel)?.name ||
                  models.find((m) => m._id === selectedModel)?.modelId ||
                  'Select model'}
            </span>
            <span className="text-text-secondary">▼</span>
          </button>

          {modelSwitchNotification.visible && (
            <div className="absolute left-0 top-full z-20 mt-2 animate-fade-in-out">
              <div className="rounded-xl border-0 bg-accent px-4 py-2.5 soft-elevated">
                <div className="flex items-center gap-2 text-sm text-white">
                  <span className="text-lg">🧠</span>
                  <span>{modelSwitchNotification.message}</span>
                </div>
              </div>
            </div>
          )}

          {showModelSelector && (
            <div className="absolute left-0 top-full z-10 mt-2 w-64 overflow-hidden rounded-2xl border-0 bg-surface soft-elevated">
              <button
                onClick={() => {
                  handleModelChange('auto');
                  setShowModelSelector(false);
                }}
                className="block w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-surface-subtle neumorphic-transition"
                type="button"
              >
                <div className="font-medium">Auto</div>
                <div className="text-xs text-text-secondary">Best model for your tier</div>
              </button>
              {models.map((model) => (
                <button
                  key={model._id}
                  onClick={() => {
                    handleModelChange(model._id);
                    setShowModelSelector(false);
                  }}
                  className="block w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-surface-subtle neumorphic-transition"
                  type="button"
                >
                  <div className="font-medium">
                    {model.displayName || model.name || model.modelId}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pro Replies Badge */}
        <div className="rounded-full border-0 bg-surface px-4 py-2 text-xs font-medium text-text-secondary soft-elevated">
          ⚡ {user.proRepliesCount?.total || 0} Pro replies
        </div>
      </div>
    </div>
  );
};
