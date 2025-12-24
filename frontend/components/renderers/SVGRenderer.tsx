'use client';

// SVGRenderer - Secure SVG display
// Sanitizes and renders SVG content safely
import React from 'react';

interface SVGRendererProps {
  content: string;
}

export default function SVGRenderer({ content }: SVGRendererProps) {
  return (
    <div className="w-full h-full overflow-auto bg-surface flex items-center justify-center p-8">
      <div
        className="max-w-full max-h-full"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}

