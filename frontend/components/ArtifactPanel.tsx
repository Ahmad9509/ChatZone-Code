'use client';

// ArtifactPanel - Main artifact display component with split-screen layout
// Renders different artifact types (HTML, Code, SVG, Mermaid, etc.) with controls
import React, { useState, useEffect, useRef } from 'react';
import { projects as projectsApi } from '@/lib/api';
import { handleSSEStream } from '@/lib/sseHandler';
import HTMLRenderer from './renderers/HTMLRenderer';
import CodeRenderer from './renderers/CodeRenderer';
import SVGRenderer from './renderers/SVGRenderer';
import MermaidRenderer from './renderers/MermaidRenderer';
import MarkdownRenderer from './renderers/MarkdownRenderer';
import DataRenderer from './renderers/DataRenderer';

export interface Artifact {
  _id: string;
  type: 'html' | 'code' | 'svg' | 'markdown' | 'react' | 'vue' | 'json' | 'csv' | 'mermaid' | 'document' | 'presentation';
  title: string;
  language?: string;
  content: string;
  version: number;
  messageId: string;
  conversationId?: string;
  createdAt?: string;
}

interface ArtifactPanelProps {
  artifact: Artifact | null;
  isStreaming?: boolean;
  onClose: () => void;
  conversationId: string;
}

export default function ArtifactPanel({ artifact, isStreaming = false, onClose, conversationId }: ArtifactPanelProps) {
  const [versions, setVersions] = useState<Artifact[]>([]);
  const [currentVersion, setCurrentVersion] = useState<Artifact | null>(artifact);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [copyingToProject, setCopyingToProject] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  
  // Edit mode states
  const [editMode, setEditMode] = useState<'none' | 'manual' | 'highlight' | 'ai-global'>('none');
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Presentation view mode - toggles between code and preview for presentation artifacts
  const [presentationViewMode, setPresentationViewMode] = useState<'preview' | 'code'>('preview');
  
  // Highlight edit states
  const [selectionStart, setSelectionStart] = useState<number>(0);
  const [selectionEnd, setSelectionEnd] = useState<number>(0);
  const [selectedText, setSelectedText] = useState('');
  const [highlightPrompt, setHighlightPrompt] = useState('');
  const [showHighlightPrompt, setShowHighlightPrompt] = useState(false);
  
  
  const copyDropdownRef = useRef<HTMLDivElement>(null);
  const projectSelectorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update current version when artifact changes
  useEffect(() => {
    setCurrentVersion(artifact);
    setShowVersions(false);
    setEditMode('none');
    setHasUnsavedChanges(false);
  }, [artifact]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (copyDropdownRef.current && !copyDropdownRef.current.contains(event.target as Node)) {
        setShowCopyDropdown(false);
      }
      if (projectSelectorRef.current && !projectSelectorRef.current.contains(event.target as Node)) {
        setShowProjectSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load versions when requested
  const loadVersions = async () => {
    if (!artifact || versions.length > 0) {
      setShowVersions(!showVersions);
      return;
    }

    setLoadingVersions(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/artifacts/${artifact._id}/versions?conversationId=${conversationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
        setShowVersions(true);
      }
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoadingVersions(false);
    }
  };

  // Load user's projects
  const loadProjects = async () => {
    if (projects.length > 0) {
      setShowProjectSelector(true);
      return;
    }

    setLoadingProjects(true);
    try {
      const response = await projectsApi.getProjects({ archived: false });
      setProjects(response.data || []);
      setShowProjectSelector(true);
    } catch (error) {
      console.error('Failed to load projects:', error);
      alert('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Copy to clipboard
  const handleCopyToClipboard = async () => {
    if (!currentVersion) return;

    try {
      await navigator.clipboard.writeText(currentVersion.content);
      setCopySuccess('Copied to clipboard!');
      setTimeout(() => setCopySuccess(null), 2000);
      setShowCopyDropdown(false);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Copy to project
  const handleCopyToProject = async (projectId: string, projectName: string) => {
    if (!currentVersion) return;

    setCopyingToProject(true);
    try {
      await projectsApi.copyArtifactToProject(projectId, {
        artifactId: currentVersion._id,
        conversationId: conversationId,
        title: currentVersion.title,
        content: currentVersion.content,
        type: currentVersion.type,
        language: currentVersion.language,
      });

      setCopySuccess(`Copied to ${projectName}!`);
      setTimeout(() => setCopySuccess(null), 3000);
      setShowProjectSelector(false);
      setShowCopyDropdown(false);
    } catch (error) {
      console.error('Failed to copy to project:', error);
      alert('Failed to copy to project');
    } finally {
      setCopyingToProject(false);
    }
  };

  // Convert to markdown
  const convertToMarkdown = (content: string, type: string, language?: string): string => {
    switch (type) {
      case 'markdown':
        return content;
      
      case 'code':
      case 'react':
      case 'vue':
        return `\`\`\`${language || 'text'}\n${content}\n\`\`\``;
      
      case 'html':
        // Simple HTML to markdown conversion
        let md = content;
        md = md.replace(/<h1>(.*?)<\/h1>/g, '# $1\n');
        md = md.replace(/<h2>(.*?)<\/h2>/g, '## $1\n');
        md = md.replace(/<h3>(.*?)<\/h3>/g, '### $1\n');
        md = md.replace(/<p>(.*?)<\/p>/g, '$1\n\n');
        md = md.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
        md = md.replace(/<em>(.*?)<\/em>/g, '*$1*');
        md = md.replace(/<code>(.*?)<\/code>/g, '`$1`');
        md = md.replace(/<[^>]+>/g, ''); // Strip remaining tags
        return md;
      
      case 'json':
        return `\`\`\`json\n${content}\n\`\`\``;
      
      case 'csv':
        // Convert CSV to markdown table
        const lines = content.trim().split('\n');
        if (lines.length === 0) return content;
        
        const headers = lines[0].split(',');
        let table = '| ' + headers.join(' | ') + ' |\n';
        table += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
        
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(',');
          table += '| ' + cells.join(' | ') + ' |\n';
        }
        return table;
      
      default:
        return content;
    }
  };

  // Download as markdown
  const handleDownloadAsMarkdown = () => {
    if (!currentVersion) return;

    const markdownContent = convertToMarkdown(
      currentVersion.content,
      currentVersion.type,
      currentVersion.language
    );

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentVersion.title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowCopyDropdown(false);
  };

  // Download as PDF
  const handleDownloadAsPDF = async () => {
    if (!currentVersion) return;

    // Dynamically load html2pdf library
    if (!(window as any).html2pdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.async = true;
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });
    }

    // Convert content to HTML for PDF
    let htmlContent = '';
    
    switch (currentVersion.type) {
      case 'markdown':
        // Load marked if not already loaded
        if (!(window as any).marked) {
          const markedScript = document.createElement('script');
          markedScript.src = 'https://cdn.jsdelivr.net/npm/marked@11.0.0/marked.min.js';
          markedScript.async = true;
          await new Promise((resolve) => {
            markedScript.onload = resolve;
            document.body.appendChild(markedScript);
          });
        }
        htmlContent = (window as any).marked.parse(currentVersion.content);
        break;
      
      case 'html':
        htmlContent = currentVersion.content;
        break;
      
      case 'code':
      case 'react':
      case 'vue':
        htmlContent = `<pre style="background: #2d2d2d; color: #f8f8f2; padding: 20px; border-radius: 5px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.5;"><code>${currentVersion.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        break;
      
      case 'json':
        htmlContent = `<pre style="background: #2d2d2d; color: #f8f8f2; padding: 20px; border-radius: 5px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px;"><code>${JSON.stringify(JSON.parse(currentVersion.content), null, 2)}</code></pre>`;
        break;
      
      case 'csv':
        const lines = currentVersion.content.trim().split('\n');
        const headers = lines[0].split(',');
        let tableHtml = '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        tableHtml += '<thead><tr>' + headers.map(h => `<th style="border: 1px solid #ddd; padding: 8px; background: #f2f2f2; text-align: left;">${h}</th>`).join('') + '</tr></thead>';
        tableHtml += '<tbody>';
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(',');
          tableHtml += '<tr>' + cells.map(c => `<td style="border: 1px solid #ddd; padding: 8px;">${c}</td>`).join('') + '</tr>';
        }
        tableHtml += '</tbody></table>';
        htmlContent = tableHtml;
        break;
      
      default:
        htmlContent = `<pre style="white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 12px;">${currentVersion.content}</pre>`;
    }

    // Wrap in styled HTML document
    const styledHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${currentVersion.title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; }
            h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            h2 { font-size: 1.5em; }
            p { margin-bottom: 16px; }
            code { background: #f6f8fa; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 0.9em; }
            a { color: #0366d6; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>${currentVersion.title}</h1>
          ${htmlContent}
        </body>
      </html>
    `;

    // Generate PDF
    const element = document.createElement('div');
    element.innerHTML = styledHtml;
    
    const opt = {
      margin: 10,
      filename: `${currentVersion.title.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    (window as any).html2pdf().set(opt).from(element).save();
    setShowCopyDropdown(false);
  };

  // Start manual edit mode
  const handleStartManualEdit = () => {
    if (!currentVersion) return;
    setEditMode('manual');
    setEditedContent(currentVersion.content);
    setHasUnsavedChanges(false);
    setShowCopyDropdown(false);
  };

  // Handle content change during manual edit
  const handleContentChange = (newContent: string) => {
    setEditedContent(newContent);
    setHasUnsavedChanges(newContent !== currentVersion?.content);
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        return;
      }
    }
    setEditMode('none');
    setEditedContent('');
    setHasUnsavedChanges(false);
    setShowHighlightPrompt(false);
    setHighlightPrompt('');
    setSelectedText('');
  };

  // Save manual edit
  const handleSaveManualEdit = async () => {
    if (!currentVersion || !editedContent) return;

    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/artifacts/${currentVersion._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          content: editedContent,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentVersion(data.artifact);
        setVersions([]); // Reset versions to force reload
        setEditMode('none');
        setHasUnsavedChanges(false);
        setCopySuccess('Changes saved!');
        setTimeout(() => setCopySuccess(null), 2000);
      } else {
        alert('Failed to save changes');
      }
    } catch (error) {
      console.error('Failed to save edit:', error);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Start highlight edit mode
  const handleStartHighlightEdit = () => {
    if (!currentVersion) return;
    setEditMode('highlight');
    setEditedContent(currentVersion.content);
    setShowCopyDropdown(false);
    setCopySuccess('Select/Highlight text to edit');
    setTimeout(() => setCopySuccess(null), 3000);
  };

  // Handle text selection in highlight mode
  const handleTextSelection = () => {
    if (editMode !== 'highlight' || !textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    
    if (start !== end) {
      setSelectionStart(start);
      setSelectionEnd(end);
      setSelectedText(editedContent.substring(start, end));
      setShowHighlightPrompt(true);
    }
  };

  // Apply AI edit to selection with real-time SSE streaming
  const handleApplySelectionEdit = async () => {
    if (!currentVersion || !selectedText || !highlightPrompt.trim()) {
      alert('Please select text and enter an instruction');
      return;
    }

    setIsSaving(true);
    
    // Calculate positions for streaming
    const beforeSelection = editedContent.substring(0, selectionStart);
    const afterSelection = editedContent.substring(selectionEnd);
    let streamedReplacement = '';

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/artifacts/${currentVersion._id}/apply-selection-edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          selectedText,
          startIndex: selectionStart,
          endIndex: selectionEnd,
          prompt: highlightPrompt,
        }),
      });

      // Handle SSE stream
      await handleSSEStream(response, {
        onChunk: (content) => {
          // Stream chunks directly into textarea at selection position
          streamedReplacement += content;
          const newContent = beforeSelection + streamedReplacement + afterSelection;
          setEditedContent(newContent);
          
          // Update cursor position to show streaming
          if (textareaRef.current) {
            const cursorPos = selectionStart + streamedReplacement.length;
            textareaRef.current.setSelectionRange(cursorPos, cursorPos);
          }
        },

        onComplete: async (assistantMessageId, fullResponse) => {
          // Streaming complete - create new artifact version
          try {
            const finalContent = beforeSelection + streamedReplacement + afterSelection;
            
            // Create new version by calling update endpoint
            const updateResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/artifacts/${currentVersion._id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                conversationId,
                content: finalContent,
              }),
            });

            if (updateResponse.ok) {
              const data = await updateResponse.json();
              setCurrentVersion(data.artifact);
              setVersions([]); // Reset versions to force reload
              setEditMode('none');
              setShowHighlightPrompt(false);
              setHighlightPrompt('');
              setSelectedText('');
              setCopySuccess('AI edit applied!');
              setTimeout(() => setCopySuccess(null), 2000);
            } else {
              alert('Failed to save artifact version');
            }
          } catch (error) {
            console.error('Failed to save artifact:', error);
            alert('Failed to save artifact');
          } finally {
            setIsSaving(false);
          }
        },

        onError: (error) => {
          console.error('Stream error:', error);
          alert(`AI edit failed: ${error}`);
          setIsSaving(false);
        },
      });

    } catch (error) {
      console.error('Failed to apply selection edit:', error);
      alert('Failed to apply AI edit');
      setIsSaving(false);
    }
  };


  if (!currentVersion) return null;

  return (
    <div className="h-full w-full bg-surface flex flex-col border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-text-primary truncate flex items-center gap-2">
              {currentVersion.title}
              {isStreaming && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <svg className="animate-pulse w-2 h-2 fill-current" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="4" />
                  </svg>
                  Streaming...
                </span>
              )}
            </h2>
            <p className="text-sm text-text-secondary">
              {currentVersion.type}
              {currentVersion.language && ` • ${currentVersion.language}`}
              {versions.length > 0 && ` • v${currentVersion.version}`}
            </p>
          </div>

          {/* Code/Preview Tabs - Only show for presentation artifacts */}
          {currentVersion.type === 'presentation' && editMode === 'none' && !isStreaming && (
            <div className="flex items-center gap-1 mr-2 border border-border rounded-md overflow-hidden">
              <button
                onClick={() => setPresentationViewMode('preview')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  presentationViewMode === 'preview'
                    ? 'bg-blue-600 text-white'
                    : 'text-text-primary hover:bg-surface-subtle'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setPresentationViewMode('code')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  presentationViewMode === 'code'
                    ? 'bg-blue-600 text-white'
                    : 'text-text-primary hover:bg-surface-subtle'
                }`}
              >
                Code
              </button>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2 ml-4">
            {/* Edit Mode Buttons - Disabled while streaming */}
            {editMode === 'none' && !isStreaming && (
              <>
                <button
                  onClick={handleStartManualEdit}
                  className="px-3 py-1.5 text-sm font-medium text-text-primary bg-surface-subtle hover:bg-surface-subtle rounded-md transition-colors flex items-center gap-1"
                  title="Edit manually"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                
                <button
                  onClick={handleStartHighlightEdit}
                  className="px-3 py-1.5 text-sm font-medium text-text-primary bg-surface-subtle hover:bg-surface-subtle rounded-md transition-colors flex items-center gap-1"
                  title="Highlight text and ask AI to edit it"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  AI Edit
                </button>
              </>
            )}
            
            {/* Save/Cancel Buttons in Edit Mode */}
            {(editMode === 'manual' || editMode === 'highlight') && (
              <>
                <button
                  onClick={handleSaveManualEdit}
                  disabled={isSaving || (editMode === 'manual' && !hasUnsavedChanges)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors flex items-center gap-1"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm font-medium text-text-primary bg-surface-subtle hover:bg-surface-subtle rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Copy Dropdown - Disabled while streaming */}
            {editMode === 'none' && !isStreaming && (
            <div className="relative" ref={copyDropdownRef}>
              <button
                onClick={() => setShowCopyDropdown(!showCopyDropdown)}
                className="px-3 py-1.5 text-sm font-medium text-text-primary bg-surface-subtle hover:bg-surface-subtle rounded-md transition-colors flex items-center gap-1"
              >
                Copy
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showCopyDropdown && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-10">
                  <button
                    onClick={handleCopyToClipboard}
                    className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-subtle flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy to clipboard
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowCopyDropdown(false);
                      loadProjects();
                    }}
                    disabled={loadingProjects}
                    className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-subtle flex items-center gap-2 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Copy to project
                  </button>

                  <button
                    onClick={handleDownloadAsMarkdown}
                    className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-subtle flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Download as Markdown
                  </button>

                  <button
                    onClick={handleDownloadAsPDF}
                    className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-subtle flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download as PDF
                  </button>

                  {currentVersion.type === 'presentation' && (
                    <>
                      <button
                        onClick={() => alert('PPTX export coming soon')}
                        className="w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-surface-subtle flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Export as PPTX
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            )}

            {/* Project Selector Modal */}
            {showProjectSelector && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div ref={projectSelectorRef} className="bg-surface rounded-lg shadow-xl w-full max-w-md mx-4">
                  <div className="px-6 py-4 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-primary">
                      Copy to Project
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">
                      Select a project to copy this artifact
                    </p>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto">
                    {projects.length === 0 ? (
                      <div className="px-6 py-8 text-center text-text-secondary">
                        No projects found. Create a project first.
                      </div>
                    ) : (
                      projects.map((project) => (
                        <button
                          key={project._id}
                          onClick={() => handleCopyToProject(project._id, project.name)}
                          disabled={copyingToProject}
                          className="w-full px-6 py-3 text-left hover:bg-surface-subtle disabled:opacity-50 transition-colors"
                        >
                          <div className="font-medium text-text-primary">
                            {project.name}
                          </div>
                          {project.description && (
                            <div className="text-sm text-text-secondary mt-1">
                              {project.description}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="px-6 py-4 border-t border-border">
                    <button
                      onClick={() => setShowProjectSelector(false)}
                      className="w-full px-4 py-2 text-sm font-medium text-text-primary bg-surface-subtle hover:bg-surface-subtle rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {copySuccess && (
              <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
                {copySuccess}
              </div>
            )}

            {artifact && editMode === 'none' && (
              <button
                onClick={loadVersions}
                disabled={loadingVersions}
                className="px-3 py-1.5 text-sm font-medium text-text-primary bg-surface-subtle hover:bg-surface-subtle rounded-md transition-colors disabled:opacity-50"
              >
                {loadingVersions ? '...' : 'Versions'}
              </button>
            )}
            <button
              onClick={editMode !== 'none' ? handleCancelEdit : onClose}
              className="p-2 text-text-secondary hover:text-text-primary rounded-md transition-colors"
              title={editMode !== 'none' ? 'Cancel and close' : 'Close'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Version Selector */}
        {showVersions && versions.length > 0 && (
          <div className="px-6 py-3 bg-surface-subtle border-b border-border">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-sm text-text-secondary whitespace-nowrap">
                Version:
              </span>
              {versions.map((v) => (
                <button
                  key={v._id}
                  onClick={() => setCurrentVersion(v)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    currentVersion._id === v._id
                      ? 'bg-blue-600 text-white'
                      : 'bg-surface-subtle text-text-primary hover:bg-surface-subtle'
                  }`}
                >
                  v{v.version}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Renderer or Editor */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {(editMode === 'manual' || editMode === 'highlight') ? (
            <div className="flex-1 flex flex-col p-4">
              <textarea
                ref={textareaRef}
                value={editedContent}
                onChange={(e) => handleContentChange(e.target.value)}
                onSelect={handleTextSelection}
                className="flex-1 w-full p-4 font-mono text-sm bg-background text-text-primary border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Edit your content here..."
              />
              
              {/* Highlight Edit Prompt */}
              {editMode === 'highlight' && showHighlightPrompt && selectedText && (
                <div className="mt-4 space-y-3">
                  {/* Selected Text Preview Box - Persistent Yellow Highlight */}
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg">
                    <div className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                      </svg>
                      Selected Text (will be replaced by AI)
                    </div>
                    <div className="text-sm text-yellow-900 dark:text-yellow-100 font-mono bg-white/50 dark:bg-black/20 p-2 rounded border border-yellow-300 dark:border-yellow-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {selectedText}
                    </div>
                  </div>
                  
                  {/* AI Instruction Input */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <input
                      type="text"
                      value={highlightPrompt}
                      onChange={(e) => setHighlightPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleApplySelectionEdit();
                        }
                      }}
                      placeholder="How should I edit this? (e.g., 'make it more formal', 'expand with examples')"
                      className="w-full px-3 py-2 text-sm bg-background text-text-primary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleApplySelectionEdit}
                        disabled={isSaving || !highlightPrompt.trim()}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-md transition-colors"
                      >
                        {isSaving ? 'Applying...' : 'Apply AI Edit'}
                      </button>
                      <button
                        onClick={() => {
                          setShowHighlightPrompt(false);
                          setHighlightPrompt('');
                          setSelectedText('');
                        }}
                        className="px-3 py-1.5 text-sm font-medium text-text-primary bg-surface-subtle hover:bg-surface-subtle rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
          {/* Presentation artifacts - toggle between code and preview */}
          {currentVersion.type === 'presentation' && (
            <>
              {presentationViewMode === 'preview' && (
                <HTMLRenderer content={currentVersion.content} />
              )}
              {presentationViewMode === 'code' && (
                <CodeRenderer content={currentVersion.content} language="html" />
              )}
            </>
          )}
          {currentVersion.type === 'html' && (
            <HTMLRenderer content={currentVersion.content} />
          )}
          {(currentVersion.type === 'code' || currentVersion.type === 'react' || currentVersion.type === 'vue') && (
            <CodeRenderer
              content={currentVersion.content}
              language={currentVersion.language || 'javascript'}
            />
          )}
          {currentVersion.type === 'svg' && (
            <SVGRenderer content={currentVersion.content} />
          )}
          {currentVersion.type === 'mermaid' && (
            <MermaidRenderer content={currentVersion.content} />
          )}
          {currentVersion.type === 'markdown' && (
            <MarkdownRenderer content={currentVersion.content} />
          )}
          {(currentVersion.type === 'json' || currentVersion.type === 'csv') && (
            <DataRenderer content={currentVersion.content} type={currentVersion.type} />
          )}
            </>
          )}
        </div>
        
    </div>
  );
}
