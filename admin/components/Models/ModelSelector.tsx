// Model Selector Component
// Step 2 of Add Model Modal - Select model from provider
// WHAT THIS COMPONENT DOES:
// - Searchable list of available models from provider
// - Option to enter custom model ID manually
// - Capability checkboxes (Vision, Thinking)
// - Shows selected model
// - Reusable for any model selection workflow

import { ERROR_MESSAGES } from '@/constants/errorMessages';

interface ModelSelectorProps {
  availableModels: any[];
  selectedModel: any;
  searchTerm: string;
  customModelId: string;
  customModelName: string;
  supportsVision: boolean;
  isThinking: boolean;
  onSearchTermChange: (term: string) => void;
  onCustomModelIdChange: (id: string) => void;
  onCustomModelNameChange: (name: string) => void;
  onModelSelect: (model: any) => void;
  onSupportsVisionChange: (value: boolean) => void;
  onIsThinkingChange: (value: boolean) => void;
}

export function ModelSelector({
  availableModels,
  selectedModel,
  searchTerm,
  customModelId,
  customModelName,
  supportsVision,
  isThinking,
  onSearchTermChange,
  onCustomModelIdChange,
  onCustomModelNameChange,
  onModelSelect,
  onSupportsVisionChange,
  onIsThinkingChange,
}: ModelSelectorProps) {
  return (
    <div className="space-y-6">
      {/* WHAT THIS DOES: Search and Custom Model Section */}
      {/* Allows filtering models or entering custom model ID */}
      <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4 space-y-4">
        {/* WHAT THIS DOES: Search, custom ID, and display name inputs */}
        {/* 3 column grid on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search input */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Search models"
            className="w-full px-3 py-2 bg-gray-900 text-white rounded border border-gray-700 focus:border-indigo-500 focus:outline-none"
          />

          {/* Custom model ID input */}
          <input
            type="text"
            value={customModelId}
            onChange={(e) => onCustomModelIdChange(e.target.value)}
            placeholder="Custom model ID"
            className="w-full px-3 py-2 bg-gray-900 text-white rounded border border-gray-700 focus:border-indigo-500 focus:outline-none"
          />

          {/* Display name for custom model */}
          <input
            type="text"
            value={customModelName}
            onChange={(e) => onCustomModelNameChange(e.target.value)}
            placeholder="Display name (optional)"
            className="w-full px-3 py-2 bg-gray-900 text-white rounded border border-gray-700 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* WHAT THIS DOES: Help text + Use Custom Model button */}
        {/* Explains how to use custom model feature */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <p className="text-xs text-gray-400 flex-1">
            Filter the provider models above, or paste a hidden/custom model ID and optionally give
            it a friendly display name. Selecting "Use custom model" locks it in for assignment.
          </p>
          <button
            type="button"
            disabled={!customModelId.trim()}
            onClick={() => {
              const trimmedId = customModelId.trim();
              const trimmedName = customModelName.trim();
              const manual = { id: trimmedId, name: trimmedName || trimmedId, source: 'custom' };
              onModelSelect(manual);
            }}
            className="w-full md:w-auto px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Use custom model
          </button>
        </div>

        {/* WHAT THIS DOES: Model Capability Checkboxes */}
        {/* Allows selecting whether model supports Vision and Thinking */}
        <div className="flex flex-col gap-3 mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
          {/* Vision capability checkbox */}
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={supportsVision}
              onChange={(e) => onSupportsVisionChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-800"
            />
            <div>
              <span className="text-sm font-medium text-white">Supports Vision</span>
              <p className="text-xs text-gray-400">Model can process images</p>
            </div>
          </label>

          {/* Thinking capability checkbox */}
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isThinking}
              onChange={(e) => onIsThinkingChange(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-800"
            />
            <div>
              <span className="text-sm font-medium text-white">🧠 Thinking Model</span>
              <p className="text-xs text-gray-400">
                Model has reasoning/thinking capabilities (o1, o3, QwQ, DeepSeek R1, etc.)
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* WHAT THIS DOES: Scrollable list of available models */}
      {/* Shows filtered models from provider */}
      <div className="max-h-96 overflow-y-auto space-y-2">
        {availableModels
          .filter((model: any) => {
            if (!searchTerm.trim()) return true;
            const needle = searchTerm.trim().toLowerCase();
            const haystack = `${model.id || ''} ${model.name || ''}`.toLowerCase();
            return haystack.includes(needle);
          })
          .map((model: any) => (
            <button
              key={model.id}
              type="button"
              onClick={() => onModelSelect(model)}
              className={`w-full text-left px-4 py-3 rounded-lg border ${
                selectedModel?.id === model.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <div className="font-semibold text-sm">{model.name || model.id}</div>
              <div className="font-mono text-xs opacity-80">{model.id}</div>
            </button>
          ))}
      </div>

      {/* WHAT THIS DOES: Empty state */}
      {/* Shows if no models match search filter */}
      {availableModels.length === 0 && (
        <p className="text-gray-400 text-center py-8">{ERROR_MESSAGES.MODELS_NOT_FOUND}</p>
      )}
    </div>
  );
}

