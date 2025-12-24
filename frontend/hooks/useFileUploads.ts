// Custom hook for managing file uploads in conversations
// Handles file selection, validation, memory tracking, and removal

import { useState } from 'react';
import { AttachedFile } from '@/types/file';

interface UseFileUploads {
  attachedFiles: AttachedFile[];
  totalMemoryUsed: number;
  handleFilesSelected: (files: File[]) => void;
  handleRemoveFile: (fileId: string) => void;
  calculateMemoryPercentage: () => number;
  getMemoryColor: () => string;
}

const TIER_LIMITS = {
  free: { memoryCapacity: 50 * 1024 * 1024 }, // 50MB
  pro: { memoryCapacity: 150 * 1024 * 1024 }, // 150MB
  premium: { memoryCapacity: 500 * 1024 * 1024 }, // 500MB
};

export const useFileUploads = (userTier: string = 'free'): UseFileUploads => {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [totalMemoryUsed, setTotalMemoryUsed] = useState(0);

  const memoryLimit = TIER_LIMITS[userTier as keyof typeof TIER_LIMITS]?.memoryCapacity || TIER_LIMITS.free.memoryCapacity;

  const handleFilesSelected = (files: File[]) => {
    const newFiles: AttachedFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      uploadProgress: 0,
    }));
    
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    
    // Update total memory
    const additionalMemory = files.reduce((sum, f) => sum + f.size, 0);
    setTotalMemoryUsed((prev) => prev + additionalMemory);
  };

  const handleRemoveFile = (fileId: string) => {
    const fileToRemove = attachedFiles.find((f) => f.id === fileId);
    if (fileToRemove) {
      setTotalMemoryUsed((prev) => prev - fileToRemove.file.size);
    }
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const calculateMemoryPercentage = (): number => {
    return (totalMemoryUsed / memoryLimit) * 100;
  };

  const getMemoryColor = (): string => {
    const percentage = calculateMemoryPercentage();
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-accent';
  };

  return {
    attachedFiles,
    totalMemoryUsed,
    handleFilesSelected,
    handleRemoveFile,
    calculateMemoryPercentage,
    getMemoryColor,
  };
};

