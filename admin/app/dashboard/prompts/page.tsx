// System Prompts Editor
// Edit master and pro-search prompts from the admin panel
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '@/lib/api';

export default function PromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ type: string; content: string }>({ type: '', content: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
      return;
    }

    loadPrompts();
  }, [router]);

  const loadPrompts = async () => {
    try {
      const res = await adminApi.get('/api/admin/system-prompts');
      setPrompts(res.data.systemPrompts || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      setLoading(false);
    }
  };

  const handleEdit = (prompt: any) => {
    setEditing(prompt._id);
    setFormData({ type: prompt.type, content: prompt.content });
  };

  const handleCancel = () => {
    setEditing(null);
    setFormData({ type: '', content: '' });
  };

  const handleSave = async () => {
    if (!formData.content.trim()) {
      alert('Prompt content cannot be empty');
      return;
    }

    setSaving(true);
    try {
      await adminApi.put(`/api/admin/system-prompts/${editing}`, {
        content: formData.content
      });
      
      await loadPrompts();
      setEditing(null);
      setFormData({ type: '', content: '' });
      alert('System prompt updated successfully!');
    } catch (error: any) {
      console.error('Failed to save prompt:', error);
      alert(error.response?.data?.message || 'Failed to save system prompt');
    } finally {
      setSaving(false);
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
                <a href="/dashboard/models" className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md">Models</a>
                <a href="/dashboard/prompts" className="px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md">Prompts</a>
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
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">System Prompts</h2>
          <p className="text-gray-400 text-sm mt-1">
            Edit system prompts that guide the AI assistant behavior.
          </p>
          
          {/* Info Box */}
          <div className="mt-4 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
            <h3 className="text-blue-300 font-semibold mb-2">📌 How System Prompts Work:</h3>
            <ul className="text-blue-200 text-sm space-y-1">
              <li>• <strong>Master Prompt</strong>: Applied to ALL conversations. Includes web search tool instructions.</li>
              <li>• <strong>Pro Search Prompt</strong>: Applied ONLY when user activates Pro Search mode. Adds enhanced research workflow.</li>
              <li>• Both prompts can be edited at any time and changes take effect immediately.</li>
            </ul>
          </div>
        </div>

        {/* Prompts List */}
        <div className="space-y-6">
          {prompts.map((prompt: any) => (
            <div key={prompt._id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="bg-indigo-600 px-6 py-3 flex justify-between items-center">
                <div>
                <h3 className="text-white font-bold">
                    {prompt.type === 'master' ? '🤖 Master System Prompt' : '🔍 Pro Search Prompt'}
                </h3>
                  <p className="text-indigo-100 text-xs mt-1">
                    {prompt.type === 'master' 
                      ? 'Base instructions for all conversations. Web search tool is available here.' 
                      : 'Enhanced research mode instructions for Pro Search feature.'}
                  </p>
                </div>
                <span className="text-white text-sm">
                  Updated: {new Date(prompt.updatedAt).toLocaleDateString()}
                </span>
              </div>
              
              <div className="p-6">
                {editing === prompt._id ? (
                  <div className="space-y-4">
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="w-full h-64 px-4 py-2 bg-gray-900 text-white rounded border border-gray-600 focus:border-indigo-500 focus:outline-none font-mono text-sm"
                      placeholder="Enter system prompt content..."
                    />
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gray-900 rounded p-4 max-h-48 overflow-y-auto">
                      <p className="text-gray-300 text-sm whitespace-pre-wrap font-mono">{prompt.content}</p>
                    </div>
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                    >
                      Edit Prompt
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {prompts.length === 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
            <p className="text-gray-400">No system prompts found</p>
          </div>
        )}
      </main>
    </div>
  );
}
