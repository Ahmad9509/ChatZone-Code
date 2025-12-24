'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { designs as designsApi } from '@/lib/api';

export default function DesignsPage() {
  const router = useRouter();
  const { user } = useStore();
  const [designs, setDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('instagram-post');
  const [presets, setPresets] = useState<any>({});
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [designTitle, setDesignTitle] = useState('');

  // Load designs on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadDesigns();
    loadPresets();
  }, []);

  const loadDesigns = async () => {
    try {
      setLoading(true);
      const response = await designsApi.getDesigns();
      setDesigns(response.data.designs || []);
    } catch (error) {
      console.error('Failed to load designs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPresets = async () => {
    try {
      const response = await designsApi.getPresets();
      setPresets(response.data.presets || {});
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  };

  const handleCreateDesign = async () => {
    try {
      const preset = presets[selectedPreset];
      const width = selectedPreset === 'custom' ? customWidth : preset.width;
      const height = selectedPreset === 'custom' ? customHeight : preset.height;

      const response = await designsApi.createDesign({
        title: designTitle || 'Untitled Design',
        designType: selectedPreset,
        width,
        height,
        backgroundColor: '#FFFFFF',
      });

      const newDesign = response.data.design;
      router.push(`/designs/${newDesign._id || newDesign.designId || newDesign.rowKey}`);
    } catch (error: any) {
      console.error('Failed to create design:', error);
      alert(error.response?.data?.error || 'Failed to create design');
    }
  };

  const handleDeleteDesign = async (designId: string) => {
    if (!confirm('Are you sure you want to delete this design?')) return;

    try {
      await designsApi.deleteDesign(designId);
      setDesigns(designs.filter((d) => (d._id || d.designId || d.rowKey) !== designId));
    } catch (error) {
      console.error('Failed to delete design:', error);
      alert('Failed to delete design');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface px-6 py-4 soft-elevated">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/chat')}
                className="flex items-center justify-center rounded-xl p-2 text-text-secondary bg-surface-subtle soft-elevated neumorphic-transition hover:soft-hover hover:text-text-primary active:soft-pressed"
                aria-label="Back to chat"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
                  <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <h1 className="text-2xl font-semibold text-text-primary">🎨 Designs</h1>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-xl border-0 bg-accent px-4 py-2.5 text-sm font-semibold text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20">
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span>New Design</span>
            </button>
          </div>
        </div>
      </div>

      {/* Designs Grid */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-subtle border-t-accent soft-elevated"></div>
          </div>
        ) : designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-2xl bg-surface p-8 soft-elevated mb-4">
              <svg className="h-16 w-16 text-text-muted mx-auto" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M2 8h16M8 2v16" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No designs yet</h3>
            <p className="text-text-secondary mb-4">Create your first design to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-xl border-0 bg-accent px-4 py-2.5 text-sm font-semibold text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
            >
              Create Design
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {designs.map((design) => {
              const designId = design._id || design.designId || design.rowKey;
              return (
                <div key={designId} className="group relative rounded-2xl bg-surface p-4 soft-elevated neumorphic-transition hover:soft-hover">
                  <div 
                    className="aspect-square w-full mb-3 rounded-xl bg-surface-subtle cursor-pointer overflow-hidden soft-elevated"
                    onClick={() => router.push(`/designs/${designId}`)}
                    style={{ backgroundColor: design.backgroundColor || '#FFFFFF' }}
                  >
                    {design.thumbnail ? (
                      <img src={design.thumbnail} alt={design.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-text-muted">
                        <svg className="h-12 w-12" viewBox="0 0 20 20" fill="none">
                          <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary truncate mb-1">{design.title}</h3>
                  <p className="text-xs text-text-secondary">{design.width} × {design.height}px</p>
                  <p className="text-xs text-text-muted mt-1">
                    {new Date(design.updatedAt).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => handleDeleteDesign(designId)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-red-500/90 p-1.5 text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                      <path d="M4 6h12M8 6V4h4v2M7 6v10h6V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Design Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-surface p-6 soft-elevated">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Create New Design</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Design Title</label>
                <input
                  type="text"
                  value={designTitle}
                  onChange={(e) => setDesignTitle(e.target.value)}
                  placeholder="My Design"
                  className="w-full rounded-xl border-0 bg-surface-subtle px-4 py-3 text-sm text-text-primary soft-pressed focus:outline-none focus:ring-2 focus:ring-accent neumorphic-transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Size Preset</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                  className="w-full rounded-xl border-0 bg-surface-subtle px-4 py-3 text-sm text-text-primary soft-pressed focus:outline-none focus:ring-2 focus:ring-accent neumorphic-transition"
                >
                  {Object.entries(presets).map(([key, preset]: [string, any]) => (
                    <option key={key} value={key}>{preset.name}</option>
                  ))}
                </select>
              </div>

              {selectedPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Width (px)</label>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1080)}
                      className="w-full rounded-xl border-0 bg-surface-subtle px-4 py-3 text-sm text-text-primary soft-pressed focus:outline-none focus:ring-2 focus:ring-accent neumorphic-transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Height (px)</label>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(parseInt(e.target.value) || 1080)}
                      className="w-full rounded-xl border-0 bg-surface-subtle px-4 py-3 text-sm text-text-primary soft-pressed focus:outline-none focus:ring-2 focus:ring-accent neumorphic-transition"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border-0 bg-surface-subtle px-4 py-2.5 text-sm font-semibold text-text-primary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDesign}
                className="rounded-xl border-0 bg-accent px-4 py-2.5 text-sm font-semibold text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

