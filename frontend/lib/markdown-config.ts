// Shared markdown components configuration for consistent styling across chat and artifacts
import React from 'react';
import { CodeBlock } from '@/components/markdown/CodeBlock';
import { MarkdownTable } from '@/components/markdown/MarkdownTable';

export const markdownComponents = {
  code({ node, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match;
    return !isInline ? (
      React.createElement(CodeBlock, { className, children: String(children).replace(/\n$/, '') })
    ) : (
      React.createElement('code', { className: `${className} rounded bg-surface px-1.5 py-0.5 text-xs`, ...props }, children)
    );
  },
  table({ children, ...props }: any) {
    return React.createElement(MarkdownTable, { ...props }, children);
  },
  thead({ children }: any) {
    return React.createElement('thead', { className: 'bg-surface-subtle sticky top-0 z-0' }, children);
  },
  tbody({ children }: any) {
    return React.createElement('tbody', null, children);
  },
  tr({ children, ...props }: any) {
    return React.createElement('tr', { className: 'border-b border-border last:border-0', ...props }, children);
  },
  th({ children, ...props }: any) {
    return React.createElement('th', { className: 'px-4 py-3 text-left text-xs font-semibold text-text-primary', ...props }, children);
  },
  td({ children, ...props }: any) {
    return React.createElement('td', { className: 'px-4 py-3 text-sm text-text-primary', ...props }, children);
  },
};
