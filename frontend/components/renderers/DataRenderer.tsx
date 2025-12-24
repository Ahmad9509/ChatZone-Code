'use client';

// DataRenderer - JSON and CSV data display
// Renders structured data with tables
import React, { useState, useMemo } from 'react';

interface DataRendererProps {
  content: string;
  type: 'json' | 'csv';
}

export default function DataRenderer({ content, type }: DataRendererProps) {
  const [view, setView] = useState<'table' | 'raw'>('table');
  const [error, setError] = useState<string | null>(null);

  // Parse and format data
  const parsedData = useMemo(() => {
    try {
      if (type === 'json') {
        const json = JSON.parse(content);
        
        // Handle arrays
        if (Array.isArray(json)) {
          if (json.length === 0) return { headers: [], rows: [] };
          
          // Extract headers from first object
          const headers = Object.keys(json[0]);
          const rows = json.map(obj => headers.map(h => obj[h]));
          
          return { headers, rows };
        }
        
        // Handle objects
        const headers = ['Key', 'Value'];
        const rows = Object.entries(json).map(([key, value]) => [
          key,
          typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
        ]);
        
        return { headers, rows };
      }
      
      // CSV parsing
      const lines = content.trim().split('\n');
      if (lines.length === 0) return { headers: [], rows: [] };
      
      const headers = lines[0].split(',').map(h => h.trim());
      const rows = lines.slice(1).map(line => 
        line.split(',').map(cell => cell.trim())
      );
      
      return { headers, rows };
    } catch (err) {
      setError(`Failed to parse ${type.toUpperCase()}`);
      return { headers: [], rows: [] };
    }
  }, [content, type]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface p-8">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">{error}</p>
          <button
            onClick={() => setView('raw')}
            className="text-sm text-blue-600 hover:underline"
          >
            View raw content
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface">
      {/* View Toggle */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-2">
        <button
          onClick={() => setView('table')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === 'table'
              ? 'bg-blue-600 text-white'
              : 'bg-surface-subtle text-text-primary hover:bg-surface-subtle'
          }`}
        >
          Table View
        </button>
        <button
          onClick={() => setView('raw')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === 'raw'
              ? 'bg-blue-600 text-white'
              : 'bg-surface-subtle text-text-primary hover:bg-surface-subtle'
          }`}
        >
          Raw
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-surface-subtle">
                <tr>
                  {parsedData.headers.map((header, i) => (
                    <th
                      key={i}
                      className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border">
                {parsedData.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="px-6 py-4 whitespace-nowrap text-sm text-text-primary"
                      >
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}

