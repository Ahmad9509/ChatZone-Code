// Model Card Component
// Displays single model information and delete button
// WHAT THIS COMPONENT DOES:
// - Shows model name, ID, provider, context, cost
// - Displays capability badges (Vision, Thinking)
// - Provides delete button
// - Reusable across different model lists

interface ModelCardProps {
  model: any;
  onDelete: (modelId: string) => void;
}

export function ModelCard({ model, onDelete }: ModelCardProps) {
  return (
    <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
      {/* Header: Model Name + Delete Button */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          {/* Model display name (bold) */}
          <h4 className="text-white font-semibold">{model.displayName}</h4>
          
          {/* Model ID (monospace, smaller) */}
          <p className="text-gray-400 text-xs font-mono">{model.modelId}</p>
        </div>
        
        {/* Delete button */}
        <button
          onClick={() => onDelete(model._id)}
          className="text-red-400 hover:text-red-300 text-sm ml-2"
          title="Delete this model assignment"
        >
          ✕
        </button>
      </div>

      {/* WHAT THIS DOES: Model Details Section */}
      {/* Shows provider, context window, and cost information */}
      <div className="space-y-1 text-xs">
        {/* Provider info */}
        <div className="flex justify-between">
          <span className="text-gray-400">Provider:</span>
          <span className="text-white">{model.providerId?.name || 'Unknown'}</span>
        </div>

        {/* Context window size */}
        <div className="flex justify-between">
          <span className="text-gray-400">Context:</span>
          <span className="text-white">{(model.contextWindow / 1000).toFixed(0)}K tokens</span>
        </div>

        {/* Cost per 1K tokens */}
        <div className="flex justify-between">
          <span className="text-gray-400">Cost (in/out):</span>
          <span className="text-white">
            ${model.costPer1kTokens.input}/${model.costPer1kTokens.output} per 1K
          </span>
        </div>

        {/* WHAT THIS DOES: Capability Badges Section */}
        {/* Shows which features this model supports (Vision, Thinking) */}
        <div className="flex gap-2 mt-2 flex-wrap">
          {model.supportsVision && (
            <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded">
              Vision
            </span>
          )}
          {model.isThinking && (
            <span className="px-2 py-1 bg-indigo-600 text-white text-xs rounded">
              🧠 Thinking
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

