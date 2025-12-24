// Providers Hook
// Centralized providers API calls with error handling
// WHAT THIS HOOK DOES:
// - Fetches providers from backend
// - Fetches API keys for a provider
// - Fetches available models from a provider
// - Provides loading and error states
// - Single source of truth for providers API logic

'use client';

import { useState, useCallback } from 'react';
import adminApi from '@/lib/api';
import { ERROR_MESSAGES } from '@/constants/errorMessages';

interface Provider {
  _id: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
}

interface ApiKey {
  _id: string;
  name: string;
  apiKey: string;
  isActive: boolean;
}

interface AvailableModel {
  id: string;
  name: string;
}

export function useProviders() {
  // WHAT THESE DO:
  // providers - Array of all providers
  // loading - Shows if providers are being fetched
  // error - Error message if fetch fails
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WHAT THIS DOES:
  // Fetches all providers from backend API
  // Only includes active providers
  // Updates state with providers or error message
  const refreshProviders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.get('/api/admin/providers');
      setProviders(res.data.providers || []);
    } catch (err: any) {
      console.error('Failed to load providers:', err);
      setError(ERROR_MESSAGES.PROVIDER_FETCH_FAILED);
    } finally {
      setLoading(false);
    }
  }, []);

  // WHAT THIS DOES:
  // Fetches API keys for a specific provider
  // Returns array of API keys with loading/error handling
  const fetchApiKeysForProvider = useCallback(async (providerId: string) => {
    try {
      const res = await adminApi.get(`/api/admin/providers/${providerId}/api-keys`);
      return { success: true, data: res.data.apiKeys || [] };
    } catch (err: any) {
      console.error('Failed to load API keys:', err);
      return { success: false, error: ERROR_MESSAGES.API_KEYS_FETCH_FAILED };
    }
  }, []);

  // WHAT THIS DOES:
  // Fetches available models from a provider
  // Uses active API key to connect to provider
  // Returns array of available models
  const fetchModelsFromProvider = useCallback(
    async (providerId: string, apiKeys: ApiKey[]) => {
      try {
        // Check if API keys exist
        if (!apiKeys || apiKeys.length === 0) {
          return { success: false, error: ERROR_MESSAGES.NO_API_KEYS };
        }

        // Get provider info
        const provider = providers.find((p) => p._id === providerId);
        if (!provider) {
          return { success: false, error: ERROR_MESSAGES.PROVIDER_NOT_FOUND };
        }

        // Use active API key or first available
        const activeKey = apiKeys.find((k: any) => k.isActive) || apiKeys[0];

        // Fetch models from provider
        const res = await adminApi.post('/api/admin/providers/fetch-models', {
          baseUrl: provider.baseUrl,
          apiKey: activeKey.apiKey,
        });

        return { success: true, data: res.data.models || [] };
      } catch (err: any) {
        console.error('Failed to fetch models from provider:', err);
        const errorMsg = err.response?.data?.message || ERROR_MESSAGES.MODELS_FETCH_FAILED;
        return { success: false, error: errorMsg };
      }
    },
    [providers]
  );

  // Return all hooks and functions for use in components
  return {
    providers,
    loading,
    error,
    refreshProviders,
    fetchApiKeysForProvider,
    fetchModelsFromProvider,
  };
}

