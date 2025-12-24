// Tier Selector Component
// Step 1 of Add Model Modal - Select minimum tier
// WHAT THIS COMPONENT DOES:
// - Displays grid of tier options
// - Shows tier name and who can access
// - Highlights selected tier
// - Reusable for any tier selection workflow

import { TIERS } from '@/constants/tiers';

interface TierSelectorProps {
  selectedTier: string;
  onTierSelect: (tier: string) => void;
}

export function TierSelector({ selectedTier, onTierSelect }: TierSelectorProps) {
  return (
    <div>
      {/* Label */}
      <label className="block text-sm text-gray-300 mb-2">Select Minimum Tier *</label>

      {/* WHAT THIS DOES: Grid of tier buttons */}
      {/* 2x2 grid showing all available tiers */}
      <div className="grid grid-cols-2 gap-3">
        {TIERS.map((tier) => (
          <button
            key={tier.value}
            type="button"
            onClick={() => onTierSelect(tier.value)}
            className={`px-4 py-3 rounded-lg font-medium text-left ${
              selectedTier === tier.value
                ? `${tier.color} text-white shadow-lg`
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {/* Tier label (bold) */}
            <div className="font-bold">{tier.label}</div>
            
            {/* Tier description (smaller text) */}
            <div className="text-xs opacity-75">{tier.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

