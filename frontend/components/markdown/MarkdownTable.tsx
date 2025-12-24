'use client';

import { useState, useRef } from 'react';

interface MarkdownTableProps {
  children: React.ReactNode;
  [key: string]: any;
}

// ChatGPT-style table wrapper with sticky header and copy button
export const MarkdownTable = ({ children, ...props }: MarkdownTableProps) => {
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleCopy = () => {
    if (!tableRef.current) return;

    const rows = Array.from(tableRef.current.querySelectorAll('tr'));
    const text = rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map((c) => (c.textContent || '').trim()).join('\t');
      })
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-end border-b border-border bg-surface px-4 py-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy table
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table {...props} ref={tableRef} className="w-full border-collapse">
          {children}
        </table>
      </div>
    </div>
  );
};

