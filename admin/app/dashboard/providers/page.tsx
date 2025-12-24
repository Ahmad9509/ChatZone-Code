// API Providers Management  
// Section 1: Add/manage OpenAI-compatible API providers
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '@/lib/api';

export default function ProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  // State for API key management modal and data
  const [apiKeyManagerProvider, setApiKeyManagerProvider] = useState<any>(null);
  const [apiKeyManagerKeys, setApiKeyManagerKeys] = useState<any[]>([]);
  const [apiKeyManagerLoading, setApiKeyManagerLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
      return;
    }

    loadProviders();
  }, [router]);

  const loadProviders = async () => {
    try {
      const res = await adminApi.get('/api/admin/providers');
      const providersData = res.data.providers || [];
      const providersWithKeys = await Promise.all(
        providersData.map(async (provider: any) => {
          try {
            const keysRes = await adminApi.get(`/api/admin/providers/${provider._id}/api-keys`);
            return { ...provider, apiKeys: keysRes.data.apiKeys || [] };
          } catch (error) {
            console.error('Failed to load API keys for provider:', provider._id, error);
            return { ...provider, apiKeys: [] };
          }
        })
      );
      setProviders(providersWithKeys);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load providers:', error);
      setLoading(false);
    }
  };

  // Open the API key manager for a provider and pull keys from backend
  const openApiKeyManager = async (provider: any) => {
    try {
      setApiKeyManagerProvider(provider);
      setApiKeyManagerLoading(true);
      const res = await adminApi.get(`/api/admin/providers/${provider._id}/api-keys`);
      setApiKeyManagerKeys(res.data.apiKeys || []);
    } catch (error) {
      console.error('Failed to load API keys for provider:', error);
      alert('Failed to load API keys for this provider.');
      setApiKeyManagerProvider(null);
    } finally {
      setApiKeyManagerLoading(false);
    }
  };

  const closeApiKeyManager = () => {
    setApiKeyManagerProvider(null);
    setApiKeyManagerKeys([]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this provider? All associated models will also be deleted.')) return;
    
    try {
      await adminApi.delete(`/api/admin/providers/${id}`);
      await loadProviders();
      alert('Provider deleted successfully');
    } catch (error) {
      console.error('Failed to delete provider:', error);
      alert('Failed to delete provider');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">ChatZone Admin</h1>
              <div className="ml-10 flex space-x-4">
                <a href="/dashboard" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md">Dashboard</a>
                <a href="/dashboard/providers" className="px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md">Providers</a>
                <a href="/dashboard/models" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md">Models & Tiers</a>
                <a href="/dashboard/users" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md">Users</a>
                <a href="/dashboard/tiers" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md">Tiers</a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  localStorage.removeItem('adminToken');
                  router.push('/login');
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-md"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">API Providers</h2>
            <p className="text-gray-400 text-sm mt-1">Add OpenAI-compatible API providers with base URLs and API keys</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
          >
            + Add Provider
          </button>
        </div>

        {providers.some((p) => p.apiKey && p.apiKey.trim() !== '') && (
          <div className="bg-yellow-900/40 border border-yellow-600 text-yellow-200 text-sm rounded-lg p-4 mb-6">
            <p className="font-semibold">Legacy API key detected</p>
            <p className="mt-1">
              One or more providers still store an old API key. Remove it manually after recreating the key through “Manage API Keys”.
            </p>
          </div>
        )}

        {/* Providers List */}
        <div className="space-y-4">
          {providers.map((provider) => (
            <div key={provider._id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-bold text-white">{provider.name}</h3>
                    {!provider.isActive && (
                      <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">Inactive</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-400">Base URL</div>
                      <div className="text-sm text-white font-mono">{provider.baseUrl}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">API Keys</div>
                      <div className="text-sm text-gray-300 font-mono">
                        {Array.isArray(provider.apiKeys) && provider.apiKeys.length > 0
                          ? `${provider.apiKeys.length} key${provider.apiKeys.length === 1 ? '' : 's'}`
                          : 'No keys yet'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => openApiKeyManager(provider)}
                    className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-500"
                  >
                    Manage API Keys
                  </button>
                  <button
                    onClick={() => setEditingProvider(provider)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(provider._id)}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {providers.length === 0 && (
            <div className="bg-gray-800 rounded-lg p-12 border border-gray-700 text-center">
              <p className="text-gray-400">No providers configured yet. Add your first provider to get started.</p>
            </div>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {(showAddModal || editingProvider) && (
        <ProviderFormModal
          provider={editingProvider}
          onClose={() => {
            setShowAddModal(false);
            setEditingProvider(null);
          }}
          onSave={async () => {
            await loadProviders();
            setShowAddModal(false);
            setEditingProvider(null);
          }}
        />
      )}

      {apiKeyManagerProvider && (
        <ApiKeyManagerModal
          provider={apiKeyManagerProvider}
          keys={apiKeyManagerKeys}
          loading={apiKeyManagerLoading}
          onClose={() => {
            closeApiKeyManager();
          }}
          onReload={async () => {
            try {
              setApiKeyManagerLoading(true);
              const res = await adminApi.get(`/api/admin/providers/${apiKeyManagerProvider._id}/api-keys`);
              setApiKeyManagerKeys(res.data.apiKeys || []);
              await loadProviders();
            } catch (error) {
              console.error('Failed to reload API keys:', error);
              alert('Failed to refresh API keys.');
            } finally {
              setApiKeyManagerLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}

// Provider Form Modal
function ProviderFormModal({ provider, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    name: provider?.name || '',
    baseUrl: provider?.baseUrl || '',
    isActive: provider?.isActive !== undefined ? provider.isActive : true,
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (provider) {
        await adminApi.put(`/api/admin/providers/${provider._id}`, formData);
        alert('Provider updated successfully');
      } else {
        await adminApi.post('/api/admin/providers', formData);
        alert('Provider created successfully');
      }
      onSave();
    } catch (error: any) {
      console.error('Failed to save provider:', error);
      alert(error.response?.data?.message || 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full">
        <div className="border-b border-gray-700 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">
            {provider ? 'Edit Provider' : 'Add New Provider'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Provider Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-indigo-500 focus:outline-none"
              placeholder="OpenAI"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Base URL * (OpenAI-compatible)</label>
              <input
                type="url"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-indigo-500 focus:outline-none font-mono text-sm"
                placeholder="https://api.openai.com/v1"
                required
              />
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded p-3 text-sm text-gray-200">
              <p className="font-semibold text-white">API Keys Managed Separately</p>
              <p className="text-xs text-gray-300 mt-1">
                API keys are no longer entered here. Save the provider, then use “Manage API Keys” to add or remove keys.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-300">Active</span>
          </div>

          <div className="pt-4 border-t border-gray-700 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Saving...' : provider ? 'Update Provider' : 'Create Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// API Key Manager Modal
function ApiKeyManagerModal({ provider, keys, loading, onClose, onReload }: any) {
  const [formData, setFormData] = useState({ name: '', apiKey: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const sortedKeys = useMemo(() => {
    return [...keys].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [keys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.apiKey.trim()) {
      alert('Name and API key are required.');
      return;
    }

    setSaving(true);
    try {
      await adminApi.post(`/api/admin/providers/${provider._id}/api-keys`, {
        name: formData.name.trim(),
        apiKey: formData.apiKey.trim(),
        isActive: formData.isActive,
      });
      setFormData({ name: '', apiKey: '', isActive: true });
      await onReload();
      alert('API key added successfully.');
    } catch (error: any) {
      console.error('Failed to add API key:', error);
      alert(error.response?.data?.message || 'Failed to add API key');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this API key? Models using this key will need to be updated.')) return;

    setDeleting(id);
    try {
      await adminApi.delete(`/api/admin/api-keys/${id}`);
      await onReload();
      alert('API key deleted successfully.');
    } catch (error: any) {
      console.error('Failed to delete API key:', error);
      alert(error.response?.data?.message || 'Failed to delete API key');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Manage API Keys – {provider.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-900/40 border border-blue-700 rounded p-4 text-sm text-blue-100">
            <p className="font-semibold text-blue-200">What you need to know</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>You can store multiple API keys for this provider.</li>
              <li>When assigning models, you will choose which key to use.</li>
              <li>Remove keys that should no longer be used to avoid accidents.</li>
            </ul>
          </div>

          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-4">
            <h4 className="text-white font-semibold">Add New API Key</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Key Label *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-indigo-500 focus:outline-none"
                  placeholder="Production Key"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">API Key *</label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-indigo-500 focus:outline-none font-mono text-sm"
                  placeholder="sk-..."
                  required
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-300">Active</span>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Add API Key'}
              </button>
            </div>
          </form>

          <div className="bg-gray-900 border border-gray-700 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-700 flex justify-between items-center">
              <h4 className="text-white font-semibold">Existing API Keys</h4>
              <button
                onClick={onReload}
                className="px-3 py-1 text-sm text-indigo-300 hover:text-white border border-indigo-500 rounded"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-center text-gray-400">Loading keys…</div>
            ) : keys.length === 0 ? (
              <div className="p-6 text-center text-gray-400">No API keys stored yet.</div>
            ) : (
              <ul className="divide-y divide-gray-700">
                {sortedKeys.map((key: any) => (
                  <li key={key._id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-white font-semibold">{key.name}</p>
                      <p className="text-sm text-gray-400 font-mono break-all">
                        {key.apiKey.substring(0, 10)}…{key.apiKey.substring(key.apiKey.length - 4)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created {new Date(key.createdAt).toLocaleString()} · Updated {new Date(key.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3 mt-3 md:mt-0">
                      <span className={`text-xs px-2 py-1 rounded ${key.isActive ? 'bg-emerald-600 text-white' : 'bg-gray-600 text-gray-200'}`}>
                        {key.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => handleDelete(key._id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-500 disabled:opacity-50"
                        disabled={deleting === key._id}
                      >
                        {deleting === key._id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

