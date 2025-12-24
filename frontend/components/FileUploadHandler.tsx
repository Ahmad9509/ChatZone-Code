import React, { useRef, useState } from 'react';
import { useStore } from '@/lib/store';

const SUPPORTED_FORMATS = {
  documents: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/csv',
    'text/html',
    'application/rtf',
    'application/epub+zip',
    'application/json',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ],
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

const ALL_SUPPORTED = [...SUPPORTED_FORMATS.documents, ...SUPPORTED_FORMATS.images];

interface TierConfig {
  _id: string;
  tierName: string;
  displayName: string;
  deepResearch?: {
    hasDeepResearch: boolean;
    deepResearchLimit: number;
    deepResearchMaxSources: number;
  };
  designs?: {
    hasDesigns: boolean;
    designsLimit: number;
    aiImageGenerationsLimit: number;
    canUseQwen: boolean;
    canUseImagen: boolean;
    canExportPNG: boolean;
    canExportJPG: boolean;
    canExportPDF: boolean;
  };
  presentations?: {
    hasPresentations: boolean;
    presentationsLimit: number;
    maxSlidesPerPresentation: number;
    canExportPPTX: boolean;
    canExportPDF: boolean;
  };
  features?: {
    hasRAG: boolean;
    hasProjects: boolean;
    hasProReplies: boolean;
    hasVision: boolean;
  };
}

interface FileUploadHandlerProps {
  onFilesSelected: (files: File[]) => void;
  tier: string;
  tierConfig?: TierConfig | null;
  currentMemoryUsage: number;
  onActionSelected?: (action: 'think' | 'proSearch' | 'createDoc' | 'deepResearch' | 'createDesign' | 'createPresentation') => void;
}

export const FileUploadHandler: React.FC<FileUploadHandlerProps> = ({
  onFilesSelected,
  tier,
  tierConfig,
  currentMemoryUsage,
  onActionSelected,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Tier-based limits
  const tierLimits = {
    free: { maxFileSize: 10 * 1024 * 1024, memoryCapacity: 50 * 1024 * 1024 },
    tier5: { maxFileSize: 30 * 1024 * 1024, memoryCapacity: 150 * 1024 * 1024 },
    tier10: { maxFileSize: 50 * 1024 * 1024, memoryCapacity: 250 * 1024 * 1024 },
    tier15: { maxFileSize: 100 * 1024 * 1024, memoryCapacity: 500 * 1024 * 1024 },
  };

  const limits = tierLimits[tier as keyof typeof tierLimits] || tierLimits.free;
  const availableMemory = limits.memoryCapacity - currentMemoryUsage;

  const validateFiles = (filesToValidate: File[]): File[] => {
    const errors: string[] = [];
    const validFiles: File[] = [];

    filesToValidate.forEach((file, index) => {
      if (!ALL_SUPPORTED.includes(file.type)) {
        errors.push(`File ${index + 1}: "${file.name}" - Unsupported format`);
        return;
      }

      if (file.size > limits.maxFileSize) {
        const maxSizeMB = limits.maxFileSize / (1024 * 1024);
        errors.push(
          `File ${index + 1}: "${file.name}" exceeds max size (${maxSizeMB}MB)`
        );
        return;
      }

      if (file.size > availableMemory) {
        errors.push(
          `File ${index + 1}: "${file.name}" exceeds available memory (${availableMemory / (1024 * 1024)}MB remaining)`
        );
        return;
      }

      validFiles.push(file);
    });

    setValidationErrors(errors);

    if (errors.length > 0) {
      // Show toast or error message
      console.warn('File validation errors:', errors);
    }

    return validFiles;
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (selectedFiles.length === 0) return;

    // Limit to 20 files
    if (selectedFiles.length > 20) {
      setValidationErrors(['Maximum 20 files allowed per message']);
      return;
    }

    const validFiles = validateFiles(selectedFiles);

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALL_SUPPORTED.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Upload files"
      />
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
        title={`Upload files (Max: ${limits.maxFileSize / (1024 * 1024)}MB per file)`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 13h6m-3-3v6m5.228-10.395l-4.95-4.95a2 2 0 0 0-2.828 0l-4.95 4.95m13.778 2.842A2 2 0 0 0 20 7m0 14H4m16-5.5v5.5H4v-5.5" />
        </svg>
        <span className="text-text-primary">Add photos & files</span>
      </button>
      {onActionSelected && (
        <>
          <button
            onClick={() => onActionSelected('think')}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
          >
            <span>🧠</span>
            <span className="text-text-primary">Think</span>
          </button>
          <button
            onClick={() => onActionSelected('proSearch')}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
          >
            <span>🔍</span>
            <span className="text-text-primary">Pro Search</span>
          </button>
          <button
            onClick={() => onActionSelected('createDoc')}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
          >
            <span>📄</span>
            <span className="text-text-primary">Create Doc</span>
          </button>
          {tierConfig?.deepResearch?.hasDeepResearch && (
          <button
            onClick={() => onActionSelected('deepResearch')}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
          >
            <span>🔬</span>
            <span className="text-text-primary">Deep Research</span>
          </button>
          )}
          {/* Create Design - Hidden */}
          {/* {tierConfig?.designs?.hasDesigns && (
          <button
            onClick={() => onActionSelected('createDesign')}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
          >
            <span>🎨</span>
            <span className="text-text-primary">Create Design</span>
          </button>
          )} */}
          {/* Create Presentation - Hidden */}
          {/* {tierConfig?.presentations?.hasPresentations && (
          <button
            onClick={() => onActionSelected('createPresentation')}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-subtle"
          >
            <span>📊</span>
            <span className="text-text-primary">Create Presentation</span>
          </button>
          )} */}
        </>
      )}
    </>
  );
};
