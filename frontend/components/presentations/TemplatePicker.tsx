'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Template {
  id: string;
  name: string;
  description: string;
  previewImage?: string;
}

interface Theme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  headingColor: string;
  accentColor: string;
}

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (templateId: string, themeId: string) => void;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'general',
    name: 'General',
    description: 'A versatile template suitable for any presentation type',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'A sleek, contemporary design for professional presentations',
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'A classic, clean template for business presentations',
  },
  {
    id: 'swift',
    name: 'Swift',
    description: 'A fast-paced, dynamic template for impactful presentations',
  },
];

const DEFAULT_THEMES: Theme[] = [
  {
    id: 'blue',
    name: 'Professional Blue',
    primaryColor: '#2563eb',
    secondaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    accentColor: '#60a5fa',
  },
  {
    id: 'green',
    name: 'Fresh Green',
    primaryColor: '#059669',
    secondaryColor: '#10b981',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    accentColor: '#34d399',
  },
  {
    id: 'purple',
    name: 'Modern Purple',
    primaryColor: '#7c3aed',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    accentColor: '#a78bfa',
  },
  {
    id: 'orange',
    name: 'Energetic Orange',
    primaryColor: '#ea580c',
    secondaryColor: '#f97316',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    accentColor: '#fb923c',
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    primaryColor: '#3b82f6',
    secondaryColor: '#60a5fa',
    backgroundColor: '#111827',
    textColor: '#f3f4f6',
    headingColor: '#ffffff',
    accentColor: '#93c5fd',
  },
];

export default function TemplatePicker({ isOpen, onClose, onSelect }: TemplatePickerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('general');
  const [selectedTheme, setSelectedTheme] = useState<string>('blue');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelect(selectedTemplate, selectedTheme);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Choose Template & Theme</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Select a template style and color theme for your presentation
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Templates Section */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-medium text-text-primary">Template Style</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {DEFAULT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  selectedTemplate === template.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-surface-subtle hover:border-primary/50'
                }`}
              >
                <div className="mb-2 text-base font-semibold text-text-primary">{template.name}</div>
                <div className="text-xs text-text-secondary">{template.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Themes Section */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-medium text-text-primary">Color Theme</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {DEFAULT_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelectedTheme(theme.id)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  selectedTheme === theme.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-surface-subtle hover:border-primary/50'
                }`}
              >
                <div className="mb-3 flex gap-2">
                  <div
                    className="h-6 w-6 rounded-md"
                    style={{ backgroundColor: theme.primaryColor }}
                  />
                  <div
                    className="h-6 w-6 rounded-md"
                    style={{ backgroundColor: theme.secondaryColor }}
                  />
                  <div
                    className="h-6 w-6 rounded-md"
                    style={{ backgroundColor: theme.accentColor }}
                  />
                </div>
                <div className="text-sm font-medium text-text-primary">{theme.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

