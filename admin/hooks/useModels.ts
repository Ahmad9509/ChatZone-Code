// Models Hook
// Centralized models API calls with error handling
// WHAT THIS HOOK DOES:
// - Fetches models from backend
// - Handles model deletion with confirmation
// - Handles model creation
// - Provides loading and error states
// - Single source of truth for models API logic

'use client';

import { useState, useCallback } from 'react';
import adminApi from '@/lib/api';
import { ERROR_MESSAGES } from '@/constants/errorMessages';

interface Model {
  _id: string;
  displayName: string;
  modelId: string;
  minTier: string;
  contextWindow: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  supportsVision: boolean;
  isThinking: boolean;
  providerId: any;
}

export function useModels() {
  // WHAT THESE DO:
  // models - Array of all models
  // loading - Shows if models are being fetched
  // error - Error message if fetch fails
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WHAT THIS DOES:
  // Fetches all models from backend API
  // Updates state with models or error message
  const refreshModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.get('/api/admin/models');
      setModels(res.data.models || []);
    } catch (err: any) {
      console.error('Failed to load models:', err);
      setError(ERROR_MESSAGES.MODELS_FETCH_FAILED);
    } finally {
      setLoading(false);
    }
  }, []);

  // WHAT THIS DOES:
  // Deletes a model by ID
  // Shows confirmation dialog before deleting
  // Refreshes models list after successful deletion
  const deleteModel = useCallback(async (modelId: string) => {
    const confirmed = confirm(ERROR_MESSAGES.MODEL_DELETE_CONFIRM);
    if (!confirmed) return;

    try {
      await adminApi.delete(`/api/admin/models/${modelId}`);
      // Refresh models list to show deletion
      await refreshModels();
    } catch (err: any) {
      console.error('Failed to delete model:', err);
      alert(ERROR_MESSAGES.MODEL_DELETE_FAILED);
    }
  }, [refreshModels]);

  // WHAT THIS DOES:
  // Creates/assigns a new model to a tier
  // Sends model configuration to backend
  // Returns success/error result
  const addModel = useCallback(async (modelConfig: any) => {
    try {
      const res = await adminApi.post('/api/admin/models', modelConfig);
      // Refresh models list to show new model
      await refreshModels();
      return { success: true, data: res.data };
    } catch (err: any) {
      console.error('Failed to assign model:', err);
      const errorMsg = err.response?.data?.message || ERROR_MESSAGES.MODEL_ASSIGN_FAILED;
      return { success: false, error: errorMsg };
    }
  }, [refreshModels]);

  // Return all hooks and functions for use in components
  return {
    models,
    loading,
    error,
    refreshModels,
    deleteModel,
    addModel,
  };
}

