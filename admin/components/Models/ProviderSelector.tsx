// Provider Selector Component
// Step 1 of Add Model Modal - Select provider
// WHAT THIS COMPONENT DOES:
// - Dropdown list of active providers
// - Shows provider name and base URL
// - Handles provider selection
// - Reusable for any provider selection workflow

interface ProviderSelectorProps {
  providers: any[];
  selectedProvider: string;
  onProviderSelect: (providerId: string) => void;
}

export function ProviderSelector({
  providers,
  selectedProvider,
  onProviderSelect,
}: ProviderSelectorProps) {
  return (
    <div>
      {/* Label */}
      <label className="block text-sm text-gray-300 mb-2">Select Provider *</label>

      {/* WHAT THIS DOES: Provider dropdown */}
      {/* Select from active providers */}
      <select
        value={selectedProvider}
        onChange={(e) => onProviderSelect(e.target.value)}
        className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-indigo-500 focus:outline-none"
        required
      >
        <option value="">-- Choose a provider --</option>
        {providers
          .filter((p: any) => p.isActive)
          .map((provider: any) => (
            <option key={provider._id} value={provider._id}>
              {provider.name} ({provider.baseUrl})
            </option>
          ))}
      </select>
    </div>
  );
}

