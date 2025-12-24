// Edit User Modal Component
'use client';

import { useState } from 'react';

const TIERS = [
  { value: 'free', label: 'Free Tier', color: 'bg-cyan-600' },
  { value: 'tier5', label: '$5/$3 Tier', color: 'bg-blue-600' },
  { value: 'tier10', label: '$10 Tier', color: 'bg-purple-600' },
  { value: 'tier15', label: '$15 Tier', color: 'bg-green-600' },
];

interface EditUserModalProps {
  user: any;
  onClose: () => void;
  onUpdate: (userId: string, updates: any) => Promise<void>;
}

export default function EditUserModal({ user, onClose, onUpdate }: EditUserModalProps) {
  const [tier, setTier] = useState(user.tier || 'free');
  const [proRepliesCount, setProRepliesCount] = useState(user.proRepliesCount?.total || 0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdate(user._id, {
        tier,
        proRepliesCount,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Edit User</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* User Info Display */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-400">Name:</span>
                <div className="text-white font-medium">{user.name || 'N/A'}</div>
              </div>
              <div>
                <span className="text-sm text-gray-400">Email:</span>
                <div className="text-white font-medium">{user.email}</div>
              </div>
              {user.username && (
                <div>
                  <span className="text-sm text-gray-400">Username:</span>
                  <div className="text-white font-medium">@{user.username}</div>
                </div>
              )}
            </div>
          </div>

          {/* Current Stats Display */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Token Usage</div>
              <div className="text-white font-semibold">Total: {(user.tokenUsage?.total || 0).toLocaleString()}</div>
              <div className="text-sm text-gray-400">This Month: {(user.tokenUsage?.thisMonth || 0).toLocaleString()}</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Pro Replies</div>
              <div className="text-white font-semibold">Total: {user.proRepliesCount?.total || 0}</div>
              <div className="text-sm text-gray-400">Daily: {user.proRepliesCount?.daily || 0}</div>
            </div>
          </div>

          {/* Tier Selection */}
          <div className="mb-6">
            <label className="block text-sm text-gray-300 mb-3">Subscription Tier *</label>
            <div className="grid grid-cols-2 gap-3">
              {TIERS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTier(t.value)}
                  className={`px-4 py-3 rounded-lg font-medium text-left ${
                    tier === t.value
                      ? `${t.color} text-white shadow-lg`
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="font-bold">{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Pro Replies Count */}
          <div className="mb-6">
            <label className="block text-sm text-gray-300 mb-2">Pro Replies Count (Total)</label>
            <input
              type="number"
              value={proRepliesCount}
              onChange={(e) => setProRepliesCount(parseInt(e.target.value) || 0)}
              min="0"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">This will override the user's total pro replies count</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

