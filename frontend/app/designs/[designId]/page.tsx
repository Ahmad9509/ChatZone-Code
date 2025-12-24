'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { designs as designsApi } from '@/lib/api';

export default function DesignEditorPage() {
  const router = useRouter();
  const params = useParams();
  const designId = params.designId as string;
  const { user } = useStore();
  
  const [design, setDesign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [elements, setElements] = useState<any[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

  // Load design on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    loadDesign();
  }, [designId]);

  const loadDesign = async () => {
    try {
      setLoading(true);
      const response = await designsApi.getDesign(designId);
      const designData = response.data.design;
      
      setDesign(designData);
      setTitle(designData.title);
      setBackgroundColor(designData.backgroundColor || '#FFFFFF');
      
      // Parse elements from JSON string
      const parsedElements = designData.elements ? JSON.parse(designData.elements) : [];
      setElements(parsedElements);
    } catch (error) {
      console.error('Failed to load design:', error);
      alert('Failed to load design');
      router.push('/designs');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await designsApi.updateDesign(designId, {
        title,
        elements,
        backgroundColor,
      });
      alert('Design saved successfully!');
    } catch (error) {
      console.error('Failed to save design:', error);
      alert('Failed to save design');
    } finally {
      setSaving(false);
    }
  };

  const handleAddText = () => {
    const newElement = {
      elementId: `text-${Date.now()}`,
      type: 'text',
      content: 'Double-click to edit',
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      rotation: 0,
      opacity: 1,
      zIndex: elements.length,
      styles: JSON.stringify({
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#000000',
        fontWeight: 'normal',
        textAlign: 'left',
      }),
    };
    setElements([...elements, newElement]);
  };

  const handleAddShape = (shapeType: 'rectangle' | 'circle') => {
    const newElement = {
      elementId: `shape-${Date.now()}`,
      type: 'shape',
      content: shapeType,
      x: 100,
      y: 100,
      width: 150,
      height: 150,
      rotation: 0,
      opacity: 1,
      zIndex: elements.length,
      styles: JSON.stringify({
        fill: '#3B82F6',
        stroke: '#1E40AF',
        strokeWidth: '2px',
      }),
    };
    setElements([...elements, newElement]);
  };

  const handleDeleteElement = () => {
    if (!selectedElement) return;
    setElements(elements.filter((el) => el.elementId !== selectedElement));
    setSelectedElement(null);
  };

  const handleExport = () => {
    // TODO: Implement export functionality (PNG, JPG, PDF)
    alert('Export functionality will be available after installing required dependencies');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-surface-subtle border-t-accent soft-elevated"></div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-text-secondary">Design not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-surface px-6 py-4 soft-elevated">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/designs')}
            className="flex items-center justify-center rounded-xl p-2 text-text-secondary bg-surface-subtle soft-elevated neumorphic-transition hover:soft-hover hover:text-text-primary active:soft-pressed"
            aria-label="Back to designs"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
              <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-lg font-semibold text-text-primary outline-none rounded-xl px-3 py-1.5 focus:bg-surface-subtle neumorphic-transition"
            placeholder="Untitled Design"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="rounded-xl border-0 bg-surface-subtle px-4 py-2.5 text-sm font-semibold text-text-primary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
          >
            Export
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl border-0 bg-accent px-4 py-2.5 text-sm font-semibold text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-16 bg-surface flex flex-col items-center py-4 gap-4 soft-elevated">
          <button
            onClick={handleAddText}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-text-secondary bg-surface-subtle soft-elevated neumorphic-transition hover:soft-hover hover:text-text-primary active:soft-pressed"
            title="Add Text"
          >
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none">
              <path d="M4 4h12M10 4v12M7 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={() => handleAddShape('rectangle')}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-text-secondary bg-surface-subtle soft-elevated neumorphic-transition hover:soft-hover hover:text-text-primary active:soft-pressed"
            title="Add Rectangle"
          >
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="3" width="14" height="14" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <button
            onClick={() => handleAddShape('circle')}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-text-secondary bg-surface-subtle soft-elevated neumorphic-transition hover:soft-hover hover:text-text-primary active:soft-pressed"
            title="Add Circle"
          >
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          {selectedElement && (
            <button
              onClick={handleDeleteElement}
              className="flex h-12 w-12 items-center justify-center rounded-xl text-red-500 bg-surface-subtle soft-elevated neumorphic-transition hover:soft-hover hover:bg-red-500/10 active:soft-pressed"
              title="Delete Element"
            >
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="none">
                <path d="M4 6h12M8 6V4h4v2M7 6v10h6V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto bg-surface-subtle p-8">
          <div className="mx-auto" style={{ width: `${design.width}px` }}>
            <div
              className="relative shadow-2xl"
              style={{
                width: `${design.width}px`,
                height: `${design.height}px`,
                backgroundColor: backgroundColor,
              }}
            >
              {/* Canvas placeholder - Will be replaced with actual canvas editor */}
              {elements.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-400">
                  <div className="text-center">
                    <svg className="mx-auto h-16 w-16 mb-4" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M2 8h16M8 2v16" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    <p className="text-sm">Click the tools on the left to add elements</p>
                  </div>
                </div>
              ) : (
                <div className="relative h-full">
                  {elements.map((element) => (
                    <div
                      key={element.elementId}
                      onClick={() => setSelectedElement(element.elementId)}
                      className={`absolute cursor-move ${
                        selectedElement === element.elementId ? 'ring-2 ring-accent' : ''
                      }`}
                      style={{
                        left: `${element.x}px`,
                        top: `${element.y}px`,
                        width: `${element.width}px`,
                        height: `${element.height}px`,
                        transform: `rotate(${element.rotation}deg)`,
                        opacity: element.opacity,
                        zIndex: element.zIndex,
                      }}
                    >
                      {element.type === 'text' && (
                        <div
                          className="h-full w-full"
                          style={element.styles ? JSON.parse(element.styles) : {}}
                        >
                          {element.content}
                        </div>
                      )}
                      {element.type === 'shape' && element.content === 'rectangle' && (
                        <div
                          className="h-full w-full"
                          style={element.styles ? JSON.parse(element.styles) : {}}
                        />
                      )}
                      {element.type === 'shape' && element.content === 'circle' && (
                        <div
                          className="h-full w-full rounded-full"
                          style={element.styles ? JSON.parse(element.styles) : {}}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="w-64 bg-surface p-4 overflow-y-auto soft-elevated">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Design Properties</h3>
          
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-subtle p-3 soft-elevated">
              <label className="block text-xs font-medium text-text-secondary mb-2">Canvas Size</label>
              <p className="text-sm text-text-primary">{design.width} × {design.height}px</p>
            </div>

            <div className="rounded-xl bg-surface-subtle p-3 soft-elevated">
              <label className="block text-xs font-medium text-text-secondary mb-2">Background Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="h-8 w-12 rounded-xl border-0 bg-background soft-pressed"
                />
                <input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="flex-1 rounded-xl border-0 bg-background px-3 py-2 text-xs text-text-primary soft-pressed focus:outline-none focus:ring-2 focus:ring-accent neumorphic-transition"
                />
              </div>
            </div>

            <div className="rounded-xl bg-surface-subtle p-3 soft-elevated">
              <label className="block text-xs font-medium text-text-secondary mb-2">Elements</label>
              <p className="text-sm text-text-primary">{elements.length} element(s)</p>
            </div>

            {selectedElement && (
              <div className="pt-4 border-t border-border">
                <p className="text-xs font-medium text-text-secondary mb-2">Selected Element</p>
                <p className="text-sm text-text-primary">
                  {elements.find((el) => el.elementId === selectedElement)?.type || 'Unknown'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 p-3 bg-accent-soft rounded-xl soft-elevated">
            <p className="text-xs text-accent">
              📝 <strong>Note:</strong> Full canvas editing with drag-and-drop, advanced styling, and AI image generation will be available after installing the required dependencies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

