// API Key Selector Component
// Step 2 of Add Model Modal - Select which API key to use for model
// WHAT THIS COMPONENT DOES:
// - Dropdown to select API key from provider
// - Shows key name and active/inactive status
// - Error message if no keys available
// - Reusable for any API key selection workflow

import { ERROR_MESSAGES } from '@/constants/errorMessages';

interface ApiKeySelectorProps {
  apiKeys: any[];
  selectedApiKeyId: string;
  onApiKeySelect: (keyId: string) => void;
}

export function ApiKeySelector({
  apiKeys,
  selectedApiKeyId,
  onApiKeySelect,
}: ApiKeySelectorProps) {
  return (
    <div>
      {/* Label */}
      <label className="block text-sm text-gray-300 mb-1">
        Select API Key for this provider *
      </label>

      {/* WHAT THIS DOES: API Key dropdown */}
      {/* Select which API key to use for this model */}
      <select
        value={selectedApiKeyId}
        onChange={(e) => onApiKeySelect(e.target.value)}
        className="w-full px-3 py-2 bg-gray-900 text-white rounded border border-gray-700 focus:border-indigo-500 focus:outline-none"
        required
      >
        <option value="">-- Choose an API key --</option>
        {apiKeys.map((key: any) => (
          <option key={key._id} value={key._id}>
            {key.name} ({key.isActive ? 'active' : 'inactive'})
          </option>
        ))}
      </select>

      {/* WHAT THIS DOES: Error message if no API keys */}
      {/* Shows helpful message about where to add API keys */}
      {apiKeys.length === 0 && (
        <p className="text-xs text-red-400 mt-1">
          {ERROR_MESSAGES.NO_API_KEYS_FOR_MODEL}
        </p>
      )}
    </div>
  );
}

