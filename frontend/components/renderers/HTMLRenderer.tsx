'use client';

// HTMLRenderer - Secure iframe-based HTML renderer
// Sandboxes HTML content to prevent security issues
import React, { useRef, useEffect } from 'react';

interface HTMLRendererProps {
  content: string;
}

export default function HTMLRenderer({ content }: HTMLRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;

      if (doc) {
        doc.open();
        doc.write(content);
        doc.close();
      }
    }
  }, [content]);

  return (
    <div className="w-full h-full">
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
        className="w-full h-full border-0"
        title="HTML Preview"
      />
    </div>
  );
}

