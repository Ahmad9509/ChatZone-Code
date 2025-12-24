// Models & Tier Assignment Page
// Production-ready models management interface
// WHAT THIS PAGE DOES:
// - Shows all AI models grouped by tier
// - Allows assigning new models to tiers
// - Allows deleting model assignments
// - Provides clean interface using extracted components
//
// REFACTORING NOTES:
// - Was 518 lines, now 120 lines (77% reduction)
// - All logic extracted to reusable components and hooks
// - No duplication with other admin pages
// - Better maintainability and testability

'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useModels } from '@/hooks/useModels';
import { useProviders } from '@/hooks/useProviders';
import { AddModelModal } from '@/components/Models/AddModelModal';
import { ModelsList } from '@/components/Models/ModelsList';

export default function ModelsPage() {
  // ========== AUTHENTICATION ==========
  // Check if user is authenticated and load admin profile
  useAdminAuth();

  // ========== STATE ==========
  // showAddModal - Controls visibility of add model modal
  const [showAddModal, setShowAddModal] = useState(false);

  // ========== DATA FETCHING ==========
  // Use hooks for all API logic with error handling
  // This replaces 150+ lines of duplicated code
  const { models, loading: modelsLoading, error: modelsError, deleteModel, refreshModels } = useModels();
  const { providers, loading: providersLoading, refreshProviders } = useProviders();

  // WHAT THIS DOES:
  // Initialize data loading when component mounts
  useEffect(() => {
    refreshModels();
    refreshProviders();
  }, [refreshModels, refreshProviders]);

  // ========== RENDERING ==========

  // Show loading spinner while fetching data
  if (modelsLoading || providersLoading) {
    return <LoadingSpinner message="Loading models and providers..." />;
  }

  return (
    <AdminLayout activeTab="models">
      <div className="space-y-6">
        {/* ========== PAGE HEADER ========== */}
        {/* Title, description, and add button */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Models & Tier Assignment</h2>
            <p className="text-gray-400 text-sm mt-1">
              Assign models to tiers. Models cascade automatically to higher tiers.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            + Assign Model
          </button>
        </div>

        {/* ========== ERROR DISPLAY ========== */}
        {/* Show error if models fail to load */}
        {modelsError && <ErrorDisplay error={modelsError} onRetry={refreshModels} />}

        {/* ========== TIER CASCADING INFO ========== */}
        {/* Explains how tier cascading works */}
        <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
          <h3 className="text-blue-300 font-semibold mb-2">📌 How Tier Cascading Works:</h3>
          <ul className="text-blue-200 text-sm space-y-1">
            <li>• Models in <strong>Free</strong> tier → Available to ALL tiers</li>
            <li>• Models in <strong>$5/$3</strong> tier → Available to $5/$3, $10, and $15 tiers</li>
            <li>• Models in <strong>$10</strong> tier → Available to $10 and $15 tiers only</li>
            <li>• Models in <strong>$15</strong> tier → Available to $15 tier only</li>
          </ul>
        </div>

        {/* ========== MODELS LIST ========== */}
        {/* Displays all models grouped by tier */}
        {/* Extracted to separate component for clarity */}
        <ModelsList models={models} onDelete={deleteModel} />

        {/* ========== ADD MODEL MODAL ========== */}
        {/* Multi-step modal for assigning new models */}
        {/* Only shown when showAddModal state is true */}
        {showAddModal && (
          <AddModelModal
            providers={providers}
            onClose={() => setShowAddModal(false)}
            onSave={() => {
              setShowAddModal(false);
              // Refresh models list to show new assignment
              refreshModels();
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
