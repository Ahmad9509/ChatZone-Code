// TypeScript interfaces for file upload functionality

export interface AttachedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploadProgress: number;
  error?: string;
  url?: string;
}

export interface FileUploadResponse {
  success: boolean;
  file?: {
    id: string;
    name: string;
    size: number;
    type: string;
    url: string;
  };
  error?: string;
}

export interface MemoryUsage {
  used: number;
  limit: number;
  percentage: number;
}

