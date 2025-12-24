// Error message constants
// Centralized error text for consistency and easy maintenance
// WHAT THIS FILE DOES:
// - Defines all error messages in one place
// - Easy to update messages without searching codebase
// - Can be used for translations in future

export const ERROR_MESSAGES = {
  // Authentication errors
  AUTH_REQUIRED: 'Authentication required. Please log in.',
  AUTH_FAILED: 'Authentication failed. Please try again.',
  INVALID_TOKEN: 'Invalid or expired token.',
  
  // Model errors
  MODEL_NOT_FOUND: 'Model not found.',
  MODEL_DELETE_FAILED: 'Failed to delete model.',
  MODEL_DELETE_CONFIRM: 'Delete this model assignment?',
  MODEL_ASSIGN_SUCCESS: 'Model assigned successfully! Edit costs and settings as needed.',
  MODEL_ASSIGN_FAILED: 'Failed to assign model.',
  
  // Provider errors
  PROVIDER_NOT_FOUND: 'Provider not found.',
  PROVIDER_FETCH_FAILED: 'Failed to fetch providers.',
  PROVIDER_DELETE_FAILED: 'Failed to delete provider.',
  NO_API_KEYS: 'This provider has no API keys. Please add at least one API key in the Providers page before fetching models.',
  NO_API_KEYS_FOR_MODEL: 'No API keys found for this provider. Add one under Providers → Edit → API Keys first.',
  API_KEYS_FETCH_FAILED: 'Failed to load API keys for this provider.',
  
  // Model fetching errors
  MODELS_FETCH_FAILED: 'Failed to fetch models from provider.',
  MODELS_NOT_FOUND: 'No models found from this provider.',
  
  // Generic errors
  GENERIC_ERROR: 'An error occurred. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  LOAD_DATA_FAILED: 'Failed to load data. Please refresh the page.',
};

// Function to get error message with optional fallback
export function getErrorMessage(key: keyof typeof ERROR_MESSAGES, fallback?: string): string {
  return ERROR_MESSAGES[key] || fallback || ERROR_MESSAGES.GENERIC_ERROR;
}

