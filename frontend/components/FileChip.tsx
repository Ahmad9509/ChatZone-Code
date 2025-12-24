import React, { useState } from 'react';

interface FileChipProps {
  fileName: string;
  fileSize: number;
  fileType: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploadProgress?: number;
  error?: string;
  onRemove: () => void;
}

const getFileIcon = (fileType: string): string => {
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType === 'application/pdf') return '📄';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('sheet') || fileType.includes('excel')) return '📊';
  if (fileType.startsWith('text/')) return '📋';
  return '📎';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const CloseIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const FileChip: React.FC<FileChipProps> = ({
  fileName,
  fileSize,
  fileType,
  status,
  uploadProgress = 0,
  error,
  onRemove,
}) => {
  const [isHovering, setIsHovering] = useState(false);
  const icon = getFileIcon(fileType);
  const sizeStr = formatFileSize(fileSize);

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200
        ${error
          ? 'bg-red-50 border-red-200 text-red-700'
          : status === 'uploading'
            ? 'bg-blue-50 border-blue-200'
            : status === 'uploaded'
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-100 border-gray-200'
        }
      `}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      title={error ? error : `${fileName} - ${sizeStr}`}
    >
      {/* File Icon */}
      <span className="text-base">{icon}</span>

      {/* File Info */}
      <div className="flex flex-col">
        <span className="text-xs font-medium truncate max-w-[150px]">{fileName}</span>
        <span className="text-xs opacity-70">{sizeStr}</span>
      </div>

      {/* Status Indicator */}
      {status === 'uploading' && (
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
          <span className="text-xs">{uploadProgress}%</span>
        </div>
      )}

      {status === 'error' && (
        <span className="text-xs font-semibold">⚠️</span>
      )}

      {/* Remove Button */}
      <button
        onClick={onRemove}
        disabled={status === 'uploading'}
        className={`
          ml-auto p-1 rounded hover:bg-current hover:bg-opacity-20 transition-colors
          ${status === 'uploading' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-label="Remove file"
      >
        <CloseIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
