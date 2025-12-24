// Add Model Modal Component
// Multi-step modal for assigning models to tiers
// WHAT THIS COMPONENT DOES:
// - Step 1: Select tier and provider
// - Step 2: Select model and configure capabilities
// - Handles model creation submission
// - Extracted from main page for reusability

'use client';

import { useState } from 'react';
import adminApi from '@/lib/api';
import { TIERS, getTierLabel } from '@/constants/tiers';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { TierSelector } from './TierSelector';
import { ProviderSelector } from './ProviderSelector';
import { ApiKeySelector } from './ApiKeySelector';
import { ModelSelector } from './ModelSelector';

interface AddModelModalProps {
  providers: any[];
  onClose: () => void;
  onSave: () => void;
}

export function AddModelModal({ providers, onClose, onSave }: AddModelModalProps) {
  // ========== STEP 1: TIER & PROVIDER SELECTION ==========
  // WHAT THESE DO:
  // step - Current modal step (1 or 2)
  // selectedTier - Which tier to assign model to
  // selectedProvider - Which provider to fetch models from
  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState('free');
  const [selectedProvider, setSelectedProvider] = useState('');

  // ========== STEP 2: MODEL SELECTION & CONFIGURATION ==========
  // WHAT THESE DO:
  // availableModels - Models fetched from provider
  // loadingModels - Shows if models are being fetched
  // selectedModel - Currently selected model
  // searchTerm - For filtering models
  // customModelId/Name - For manually entering model info
  // supportsVision/isThinking - Model capability flags
  // providerApiKeys - API keys for the selected provider
  // selectedApiKeyId - Which API key to use for the model
  // saving - Shows if form is being submitted
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [customModelName, setCustomModelName] = useState('');
  const [supportsVision, setSupportsVision] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [providerApiKeys, setProviderApiKeys] = useState<any[]>([]);
  const [selectedApiKeyId, setSelectedApiKeyId] = useState('');
  const [saving, setSaving] = useState(false);

  // WHAT THIS DOES:
  // Fetches models from the selected provider
  // Gets API keys first, then uses one to fetch models from provider
  // Moves to step 2 for model selection
  const fetchModelsFromProvider = async (providerId: string) => {
    setLoadingModels(true);
    try {
      const provider = providers.find((p: any) => p._id === providerId);

      // Step 1: Load API keys for this provider
      const apiKeysRes = await adminApi.get(`/api/admin/providers/${providerId}/api-keys`);
      const apiKeys = apiKeysRes.data.apiKeys || [];
      setProviderApiKeys(apiKeys);
      setSelectedApiKeyId('');

      // Step 1.5: Check if there are API keys available
      if (apiKeys.length === 0) {
        alert(ERROR_MESSAGES.NO_API_KEYS);
        setLoadingModels(false);
        return;
      }

      // Step 2: Use active API key to fetch models from provider
      const activeKey = apiKeys.find((k: any) => k.isActive) || apiKeys[0];

      const res = await adminApi.post('/api/admin/providers/fetch-models', {
        baseUrl: provider.baseUrl,
        apiKey: activeKey.apiKey,
      });

      setAvailableModels(res.data.models || []);
      setSearchTerm('');
      setSelectedModel(null);
      setStep(2);
    } catch (error: any) {
      console.error('Failed to fetch models:', error);
      alert(error.response?.data?.message || ERROR_MESSAGES.MODELS_FETCH_FAILED);
    } finally {
      setLoadingModels(false);
    }
  };

  // WHAT THIS DOES:
  // Submits the form to create/assign model
  // Validates that model and API key are selected
  // Sends model configuration to backend
  const handleSubmit = async () => {
    if (!selectedModel || !selectedApiKeyId) return;

    setSaving(true);
    try {
      await adminApi.post('/api/admin/models', {
        providerId: selectedProvider,
        apiKeyId: selectedApiKeyId,
        modelId: selectedModel.id,
        displayName: selectedModel.name || selectedModel.id,
        minTier: selectedTier,
        contextWindow: 8192, // Default, can be edited later
        costPer1kTokens: { input: 0, output: 0 }, // Will be configured manually
        supportsVision: supportsVision,
        isThinking: isThinking,
        isActive: true,
      });

      alert(ERROR_MESSAGES.MODEL_ASSIGN_SUCCESS);
      onSave();
    } catch (error: any) {
      console.error('Failed to assign model:', error);
      alert(error.response?.data?.message || ERROR_MESSAGES.MODEL_ASSIGN_FAILED);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* WHAT THIS DOES: Modal header with title and close button */}
        {/* Sticky header stays visible when scrolling */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">
            {step === 1 ? 'Step 1: Select Tier & Provider' : 'Step 2: Select Model'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
            ×
          </button>
        </div>

        {/* WHAT THIS DOES: Modal content area */}
        {/* Changes based on current step */}
        <div className="p-6">
          {step === 1 ? (
            // ========== STEP 1: TIER & PROVIDER SELECTION ==========
            <div className="space-y-6">
              {/* Tier selector component */}
              <TierSelector selectedTier={selectedTier} onTierSelect={setSelectedTier} />

              {/* Provider selector component */}
              <ProviderSelector
                providers={providers}
                selectedProvider={selectedProvider}
                onProviderSelect={setSelectedProvider}
              />

              {/* Next button - moves to step 2 */}
              <button
                onClick={() => selectedProvider && fetchModelsFromProvider(selectedProvider)}
                disabled={!selectedProvider || loadingModels}
                className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loadingModels ? 'Fetching Models...' : 'Next: Select Model →'}
              </button>
            </div>
          ) : (
            // ========== STEP 2: MODEL SELECTION ==========
            <div className="space-y-6">
              {/* Back button */}
              <button onClick={() => setStep(1)} className="text-indigo-400 hover:text-indigo-300 text-sm">
                ← Back to Tier & Provider Selection
              </button>

              {/* API Key selector - shows which key to use for this model */}
              <ApiKeySelector
                apiKeys={providerApiKeys}
                selectedApiKeyId={selectedApiKeyId}
                onApiKeySelect={setSelectedApiKeyId}
              />

              {/* Model selector component with search, custom model, and capabilities */}
              <ModelSelector
                availableModels={availableModels}
                selectedModel={selectedModel}
                searchTerm={searchTerm}
                customModelId={customModelId}
                customModelName={customModelName}
                supportsVision={supportsVision}
                isThinking={isThinking}
                onSearchTermChange={setSearchTerm}
                onCustomModelIdChange={setCustomModelId}
                onCustomModelNameChange={setCustomModelName}
                onModelSelect={setSelectedModel}
                onSupportsVisionChange={setSupportsVision}
                onIsThinkingChange={setIsThinking}
              />

              {/* Submit button - assigns model to tier */}
              <button
                onClick={handleSubmit}
                disabled={!selectedModel || saving}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? 'Assigning Model...' : `Assign to ${getTierLabel(selectedTier)}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

