'use client';

// MarkdownRenderer - Rich markdown display using shared chat styling
// Uses the same ReactMarkdown configuration as the main chat for consistent theming
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { markdownComponents } from '@/lib/markdown-config';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="w-full h-full overflow-auto bg-background p-8">
      <div className="prose prose-sm max-w-none break-words text-text-primary">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
