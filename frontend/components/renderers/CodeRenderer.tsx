'use client';

// CodeRenderer - Syntax-highlighted code display
// Uses Prism.js for production-quality syntax highlighting
import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/app/theme/context';

interface CodeRendererProps {
  content: string;
  language: string;
}

export default function CodeRenderer({ content, language }: CodeRendererProps) {
  const codeRef = useRef<HTMLElement>(null);
  const { resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';

  useEffect(() => {
    // Dynamically load Prism if not already loaded
    const loadPrism = async () => {
      if (typeof window !== 'undefined' && !(window as any).Prism) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        // Load light or dark theme based on current theme
        link.href = isDark
          ? 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css'
          : 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
        script.async = true;
        document.body.appendChild(script);

        // Load language-specific grammar
        script.onload = () => {
          loadLanguageGrammar(language);
        };
      } else if ((window as any).Prism) {
        loadLanguageGrammar(language);
        highlightCode();
      }
    };

    const loadLanguageGrammar = (lang: string) => {
      const langMap: Record<string, string> = {
        javascript: 'javascript',
        typescript: 'typescript',
        python: 'python',
        java: 'java',
        csharp: 'csharp',
        cpp: 'cpp',
        c: 'c',
        go: 'go',
        rust: 'rust',
        ruby: 'ruby',
        php: 'php',
        swift: 'swift',
        kotlin: 'kotlin',
        sql: 'sql',
        bash: 'bash',
        shell: 'bash',
        json: 'json',
        yaml: 'yaml',
        xml: 'markup',
        html: 'markup',
        css: 'css',
        scss: 'scss',
        jsx: 'jsx',
        tsx: 'tsx',
      };

      const prismLang = langMap[lang.toLowerCase()] || 'javascript';

      if ((window as any).Prism && !(window as any).Prism.languages[prismLang]) {
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${prismLang}.min.js`;
        script.async = true;
        script.onload = highlightCode;
        document.body.appendChild(script);
      } else {
        highlightCode();
      }
    };

    const highlightCode = () => {
      if (codeRef.current && (window as any).Prism) {
        (window as any).Prism.highlightElement(codeRef.current);
      }
    };

    loadPrism();
  }, [content, language, isDark]);

  // Normalize language name for Prism CSS class
  const getPrismLanguage = (lang: string): string => {
    const langMap: Record<string, string> = {
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      java: 'java',
      csharp: 'csharp',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rust: 'rust',
      ruby: 'ruby',
      php: 'php',
      swift: 'swift',
      kotlin: 'kotlin',
      sql: 'sql',
      bash: 'bash',
      shell: 'bash',
      json: 'json',
      yaml: 'yaml',
      xml: 'markup',
      html: 'markup',
      css: 'css',
      scss: 'scss',
      jsx: 'jsx',
      tsx: 'tsx',
    };

    return langMap[lang.toLowerCase()] || 'javascript';
  };

  return (
    <div className="w-full h-full overflow-auto bg-surface">
      <pre className="!m-0 !p-6 text-sm">
        <code ref={codeRef} className={`language-${getPrismLanguage(language)}`}>
          {content}
        </code>
      </pre>
    </div>
  );
}

