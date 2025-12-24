'use client';

// MermaidRenderer - Renders Mermaid diagrams
// Converts Mermaid syntax to SVG diagrams
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/app/theme/context';

interface MermaidRendererProps {
  content: string;
}

export default function MermaidRenderer({ content }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        // Dynamically load Mermaid
        if (typeof window !== 'undefined' && !(window as any).mermaid) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
          script.async = true;
          script.onload = () => initMermaid();
          document.body.appendChild(script);
        } else if ((window as any).mermaid) {
          initMermaid();
        }
      } catch (err) {
        setError('Failed to load Mermaid');
        console.error('Mermaid load error:', err);
      }
    };

    const initMermaid = async () => {
      try {
        const mermaid = (window as any).mermaid;
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
        });

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          const { svg } = await mermaid.render('mermaid-diagram', content);
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        setError('Failed to render diagram');
        console.error('Mermaid render error:', err);
      }
    };

    renderDiagram();
  }, [content, isDark]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface p-8">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">Error Rendering Diagram</p>
          <p className="text-sm text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto bg-surface flex items-center justify-center p-8">
      <div ref={containerRef} className="mermaid-container" />
    </div>
  );
}

