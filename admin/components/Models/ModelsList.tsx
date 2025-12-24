// Models List Component
// Displays models grouped by tier
// WHAT THIS COMPONENT DOES:
// - Organizes models into tier sections
// - Each tier shows its color and model count
// - Uses ModelCard to display individual models
// - Shows empty state if tier has no models
// - Reusable for any models listing

import { TIERS } from '@/constants/tiers';
import { ModelCard } from './ModelCard';

interface ModelsListProps {
  models: any[];
  onDelete: (modelId: string) => void;
}

export function ModelsList({ models, onDelete }: ModelsListProps) {
  // WHAT THIS DOES:
  // Groups models by tier for display
  // Maps over TIERS and finds models assigned to each tier
  const modelsByTier = TIERS.map((tier) => ({
    tier: tier.value,
    label: tier.label,
    color: tier.color,
    models: models.filter((m) => m.minTier === tier.value),
  }));

  return (
    <div className="space-y-6">
      {/* WHAT THIS DOES: Render each tier section */}
      {/* For each tier, show header and models */}
      {modelsByTier.map(({ tier, label, color, models: tierModels }) => (
        <div key={tier} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          {/* WHAT THIS DOES: Tier header with name and count */}
          {/* Colored bar showing tier name and number of models */}
          <div className={`${color} px-6 py-3 flex justify-between items-center`}>
            <h3 className="text-white font-bold">{label}</h3>
            <span className="text-white text-sm">{tierModels.length} models</span>
          </div>

          {/* WHAT THIS DOES: Tier content - models or empty state */}
          <div className="p-6">
            {tierModels.length > 0 ? (
              // Show models in 3-column grid on large screens
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tierModels.map((model: any) => (
                  <ModelCard key={model._id} model={model} onDelete={onDelete} />
                ))}
              </div>
            ) : (
              // Show empty state if no models in tier
              <p className="text-gray-400 text-center py-4">No models assigned to this tier</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

