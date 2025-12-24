// Tier Configuration Management
// Configure pricing, token limits, models, and features per tier
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { tiers, models as modelsApi } from '@/lib/api';

export default function TiersPage() {
  const router = useRouter();
  const [tierConfigs, setTierConfigs] = useState<any[]>([]);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      router.push('/login');
      return;
    }

    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const [tiersRes, modelsRes] = await Promise.all([
        tiers.list(),
        modelsApi.list(),
      ]);
      
      setTierConfigs(tiersRes.data.tiers || []);
      setAvailableModels(modelsRes.data.models || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  };

  const handleUpdate = async (tierName: string, updates: any) => {
    try {
      await tiers.update(tierName, updates);
      await loadData();
      setEditing(null);
      alert('Tier configuration updated successfully');
    } catch (error) {
      console.error('Failed to update tier:', error);
      alert('Failed to update tier configuration');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const tierNames = ['free', 'tier5', 'tier10', 'tier15'];
  const displayNames: any = {
    free: 'Free',
    tier5: '$5 Tier ($3 developing)',
    tier10: '$10 Tier',
    tier15: '$15 Tier',
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Tier Configuration</h1>

        <div className="grid gap-6">
          {tierNames.map((tierName) => {
            const config = tierConfigs.find((t) => t.tierName === tierName) || {
              tierName,
              displayName: displayNames[tierName],
              priceUSD: tierName === 'free' ? 0 : parseInt(tierName.replace('tier', '')),
              priceDeveloping: tierName === 'tier5' ? 3 : tierName === 'free' ? 0 : parseInt(tierName.replace('tier', '')),
              tokenLimit: 0,
              isUnlimitedTokens: false,
              defaultModel: '',
              defaultVisionModel: '',
              allowedModels: [],
              maxProjects: 0,
              ragStorageLimit: 0,
              // File upload limits
              maxFileSize: tierName === 'free' ? 10 : tierName === 'tier5' ? 30 : tierName === 'tier10' ? 50 : 100,
              memoryCapacity: tierName === 'free' ? 50 : tierName === 'tier5' ? 150 : tierName === 'tier10' ? 250 : 500,
              features: {
                hasRAG: false,
                hasProjects: false,
                hasProReplies: false,
                hasVision: false,
              },
              deepResearch: {
                hasDeepResearch: false,
                deepResearchLimit: 0,
                deepResearchMaxSources: 20,
              },
            };

            const isEditing = editing === tierName;

            return (
              <div key={tierName} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-white">{displayNames[tierName]}</h2>
                  <button
                    onClick={() => setEditing(isEditing ? null : tierName)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {isEditing ? (
                  <EditTierForm
                    config={config}
                    availableModels={availableModels}
                    onSave={(updates) => handleUpdate(tierName, updates)}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <ViewTierConfig config={config} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ViewTierConfig({ config }: { config: any }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-gray-300">
      <div>
        <strong>Price (USD):</strong> ${config.priceUSD}
      </div>
      <div>
        <strong>Price (Developing):</strong> ${config.priceDeveloping}
      </div>
      <div>
        <strong>Token Limit:</strong>{' '}
        {config.isUnlimitedTokens ? 'Unlimited' : config.tokenLimit.toLocaleString()}
      </div>
      <div>
        <strong>Max Projects:</strong> {config.maxProjects}
      </div>
      <div>
        <strong>RAG Storage:</strong> {(config.ragStorageLimit / (1024 * 1024 * 1024)).toFixed(2)} GB
      </div>
      <div>
        <strong>Max File Size:</strong> {config.maxFileSize} MB
      </div>
      <div>
        <strong>Memory Capacity:</strong> {config.memoryCapacity} MB
      </div>
      <div className="col-span-2">
        <strong>Default Model:</strong> {config.defaultModel || 'Not set'}
      </div>
      <div className="col-span-2">
        <strong>Default Vision Model:</strong> {config.defaultVisionModel || 'Not set'}
      </div>
      <div className="col-span-2">
        <strong>Features:</strong>
        <div className="flex gap-2 mt-2">
          {config.features?.hasRAG && <span className="px-2 py-1 bg-green-600 rounded text-sm">RAG</span>}
          {config.features?.hasProjects && <span className="px-2 py-1 bg-blue-600 rounded text-sm">Projects</span>}
          {config.features?.hasProReplies && <span className="px-2 py-1 bg-purple-600 rounded text-sm">Pro Replies</span>}
          {config.features?.hasVision && <span className="px-2 py-1 bg-orange-600 rounded text-sm">Vision</span>}
        </div>
      </div>
      <div className="col-span-2">
        <strong>Deep Research:</strong>
        {config.deepResearch?.hasDeepResearch ? (
          <div className="text-emerald-400 mt-2">
            ✓ Enabled - {config.deepResearch.deepResearchLimit === 0 ? 'Unlimited' : `${config.deepResearch.deepResearchLimit}/month`} 
            {' '}(Max {config.deepResearch.deepResearchMaxSources} sources per query)
          </div>
        ) : (
          <div className="text-gray-500 mt-2">✗ Disabled</div>
        )}
      </div>
      <div className="col-span-2">
        <strong>Designs:</strong>
        {config.designs?.hasDesigns ? (
          <div className="text-purple-400 mt-2">
            ✓ Enabled - {config.designs.designsLimit === 0 ? 'Unlimited' : `${config.designs.designsLimit}/month`}
            {' '}• AI Images: {config.designs.aiImageGenerationsLimit === 0 ? 'Unlimited' : `${config.designs.aiImageGenerationsLimit}/month`}
            {' '}• Models: {[config.designs.canUseQwen && 'Qwen', config.designs.canUseImagen && 'Imagen'].filter(Boolean).join(', ') || 'None'}
          </div>
        ) : (
          <div className="text-gray-500 mt-2">✗ Disabled</div>
        )}
      </div>
      <div className="col-span-2">
        <strong>Presentations:</strong>
        {config.presentations?.hasPresentations ? (
          <div className="text-blue-400 mt-2">
            ✓ Enabled - {config.presentations.presentationsLimit === 0 ? 'Unlimited' : `${config.presentations.presentationsLimit}/month`}
            {' '}• Max {config.presentations.maxSlidesPerPresentation} slides/presentation
          </div>
        ) : (
          <div className="text-gray-500 mt-2">✗ Disabled</div>
        )}
      </div>
    </div>
  );
}

function EditTierForm({
  config,
  availableModels,
  onSave,
  onCancel,
}: {
  config: any;
  availableModels: any[];
  onSave: (updates: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(config);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(formData);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Price (USD)</label>
          <input
            type="number"
            value={formData.priceUSD}
            onChange={(e) => setFormData({ ...formData, priceUSD: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Price (Developing Markets)</label>
          <input
            type="number"
            value={formData.priceDeveloping}
            onChange={(e) => setFormData({ ...formData, priceDeveloping: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">
            <input
              type="checkbox"
              checked={formData.isUnlimitedTokens}
              onChange={(e) => setFormData({ ...formData, isUnlimitedTokens: e.target.checked })}
              className="mr-2"
            />
            Unlimited Tokens
          </label>
          {!formData.isUnlimitedTokens && (
            <input
              type="number"
              value={formData.tokenLimit}
              onChange={(e) => setFormData({ ...formData, tokenLimit: parseInt(e.target.value) })}
              placeholder="Token limit (input+output combined)"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded mt-2"
            />
          )}
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Max Projects</label>
          <input
            type="number"
            value={formData.maxProjects}
            onChange={(e) => setFormData({ ...formData, maxProjects: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">RAG Storage (GB)</label>
          <input
            type="number"
            step="0.1"
            value={(formData.ragStorageLimit / (1024 * 1024 * 1024)).toFixed(2)}
            onChange={(e) =>
              setFormData({
                ...formData,
                ragStorageLimit: parseFloat(e.target.value) * 1024 * 1024 * 1024,
              })
            }
            className="w-full px-3 py-2 bg-gray-700 text-white rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Max File Size (MB)</label>
          <input
            type="number"
            value={formData.maxFileSize}
            onChange={(e) => setFormData({ ...formData, maxFileSize: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Memory Capacity (MB)</label>
          <input
            type="number"
            value={formData.memoryCapacity}
            onChange={(e) => setFormData({ ...formData, memoryCapacity: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Default Model</label>
          <select
            value={formData.defaultModel}
            onChange={(e) => setFormData({ ...formData, defaultModel: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded"
          >
            <option value="">Select model</option>
            {availableModels.map((model) => (
              <option key={model._id} value={model.name}>
                {model.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Default Vision Model (for images)</label>
          <select
            value={formData.defaultVisionModel}
            onChange={(e) => setFormData({ ...formData, defaultVisionModel: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded"
          >
            <option value="">Select vision model</option>
            {availableModels
              .filter((model) => model.supportsVision)
              .map((model) => (
                <option key={model._id} value={model.name}>
                  {model.displayName}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Pro Search Configuration */}
      <div className="p-4 bg-gray-900 rounded-lg border border-gray-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">🔍 Pro Search Settings</h4>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Default Pro Search Model</label>
          <select
            value={formData.defaultProSearchModelId || ''}
            onChange={(e) => setFormData({ ...formData, defaultProSearchModelId: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded"
          >
            <option value="">None (keep user's selected model)</option>
            {availableModels
              .filter((model) => model.isThinking)
              .map((model) => (
                <option key={model._id} value={model._id}>
                  🧠 {model.displayName}
                </option>
              ))}
          </select>
          <p className="text-xs text-gray-400 mt-1.5">
            When a user enables Pro Search with a non-thinking model, automatically switch to this model.
            <strong> Only thinking models are shown here.</strong>
          </p>
        </div>
      </div>

      {/* Deep Research Configuration */}
      <div className="p-4 bg-gray-900 rounded-lg border border-emerald-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">🔬 Deep Research Settings</h4>
        <div className="space-y-3">
          <div>
            <label className="flex items-center text-gray-300">
              <input
                type="checkbox"
                checked={formData.deepResearch?.hasDeepResearch || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deepResearch: { 
                      ...formData.deepResearch,
                      hasDeepResearch: e.target.checked,
                      deepResearchLimit: formData.deepResearch?.deepResearchLimit || 0,
                      deepResearchMaxSources: formData.deepResearch?.deepResearchMaxSources || 20,
                    },
                  })
                }
                className="mr-2"
              />
              <span className="font-medium">Enable Deep Research</span>
            </label>
          </div>
          
          {formData.deepResearch?.hasDeepResearch && (
            <>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Monthly Limit (0 = Unlimited)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.deepResearch?.deepResearchLimit || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deepResearch: {
                        ...formData.deepResearch,
                        deepResearchLimit: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                  placeholder="0 for unlimited"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Number of Deep Research requests allowed per month. Set to 0 for unlimited.
                </p>
              </div>
              
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Max Sources Per Query
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={formData.deepResearch?.deepResearchMaxSources || 20}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deepResearch: {
                        ...formData.deepResearch,
                        deepResearchMaxSources: parseInt(e.target.value) || 20,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                  placeholder="20"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Maximum number of search results per query (5-100). Higher = more comprehensive but slower.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Designs Configuration */}
      <div className="p-4 bg-gray-900 rounded-lg border border-purple-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">🎨 Designs Settings</h4>
        <div className="space-y-3">
          <div>
            <label className="flex items-center text-gray-300">
              <input
                type="checkbox"
                checked={formData.designs?.hasDesigns || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    designs: { 
                      ...formData.designs,
                      hasDesigns: e.target.checked,
                      designsLimit: formData.designs?.designsLimit || 0,
                      aiImageGenerationsLimit: formData.designs?.aiImageGenerationsLimit || 0,
                      canUseQwen: formData.designs?.canUseQwen || false,
                      canUseImagen: formData.designs?.canUseImagen || false,
                      canExportPNG: formData.designs?.canExportPNG || true,
                      canExportJPG: formData.designs?.canExportJPG || true,
                      canExportPDF: formData.designs?.canExportPDF || false,
                    },
                  })
                }
                className="mr-2"
              />
              <span className="font-medium">Enable Designs</span>
            </label>
          </div>
          
          {formData.designs?.hasDesigns && (
            <>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Monthly Designs Limit (0 = Unlimited)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.designs?.designsLimit || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      designs: {
                        ...formData.designs,
                        designsLimit: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                  placeholder="0 for unlimited"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  AI Image Generations Limit (0 = Unlimited)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.designs?.aiImageGenerationsLimit || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      designs: {
                        ...formData.designs,
                        aiImageGenerationsLimit: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                  placeholder="0 for unlimited"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-300 mb-1">AI Models Access</label>
                <label className="flex items-center text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.designs?.canUseQwen || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        designs: {
                          ...formData.designs,
                          canUseQwen: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span>Can use Qwen AI Model</span>
                </label>
                <label className="flex items-center text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.designs?.canUseImagen || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        designs: {
                          ...formData.designs,
                          canUseImagen: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span>Can use Google Imagen Model</span>
                </label>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-300 mb-1">Export Formats</label>
                <label className="flex items-center text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.designs?.canExportPNG !== false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        designs: {
                          ...formData.designs,
                          canExportPNG: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span>PNG Export</span>
                </label>
                <label className="flex items-center text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.designs?.canExportJPG !== false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        designs: {
                          ...formData.designs,
                          canExportJPG: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span>JPG Export</span>
                </label>
                <label className="flex items-center text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.designs?.canExportPDF || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        designs: {
                          ...formData.designs,
                          canExportPDF: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span>PDF Export</span>
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Presentations Configuration */}
      <div className="p-4 bg-gray-900 rounded-lg border border-blue-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">📊 Presentations Settings</h4>
        <div className="space-y-3">
          <div>
            <label className="flex items-center text-gray-300">
              <input
                type="checkbox"
                checked={formData.presentations?.hasPresentations || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    presentations: { 
                      ...formData.presentations,
                      hasPresentations: e.target.checked,
                      presentationsLimit: formData.presentations?.presentationsLimit || 0,
                      maxSlidesPerPresentation: formData.presentations?.maxSlidesPerPresentation || 50,
                      canExportPPTX: formData.presentations?.canExportPPTX || true,
                      canExportPDF: formData.presentations?.canExportPDF || false,
                    },
                  })
                }
                className="mr-2"
              />
              <span className="font-medium">Enable Presentations</span>
            </label>
          </div>
          
          {formData.presentations?.hasPresentations && (
            <>
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Monthly Presentations Limit (0 = Unlimited)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.presentations?.presentationsLimit || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      presentations: {
                        ...formData.presentations,
                        presentationsLimit: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                  placeholder="0 for unlimited"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Max Slides Per Presentation
                </label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={formData.presentations?.maxSlidesPerPresentation || 50}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      presentations: {
                        ...formData.presentations,
                        maxSlidesPerPresentation: parseInt(e.target.value) || 50,
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded"
                  placeholder="50"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-300 mb-1">Export Formats</label>
                <label className="flex items-center text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.presentations?.canExportPPTX !== false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        presentations: {
                          ...formData.presentations,
                          canExportPPTX: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span>PowerPoint (.pptx) Export</span>
                </label>
                <label className="flex items-center text-gray-300">
                  <input
                    type="checkbox"
                    checked={formData.presentations?.canExportPDF || false}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        presentations: {
                          ...formData.presentations,
                          canExportPDF: e.target.checked,
                        },
                      })
                    }
                    className="mr-2"
                  />
                  <span>PDF Export</span>
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-300 mb-2">Features</label>
        <div className="space-y-2">
          {['hasRAG', 'hasProjects', 'hasProReplies', 'hasVision'].map((feature) => (
            <label key={feature} className="flex items-center text-gray-300">
              <input
                type="checkbox"
                checked={formData.features?.[feature] || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    features: { ...formData.features, [feature]: e.target.checked },
                  })
                }
                className="mr-2"
              />
              {feature.replace('has', '')}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <button type="submit" className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          Save Changes
        </button>
        <button type="button" onClick={onCancel} className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

