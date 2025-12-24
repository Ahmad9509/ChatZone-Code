// Custom hook for file upload management and memory tracking
import { useState, useCallback } from 'react';

interface AttachedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploadProgress: number;
}

interface UseFileManagementParams {
  user: any;
  setShowComposerMenu: (show: boolean) => void;
}

export function useFileManagement(params: UseFileManagementParams) {
  const { user, setShowComposerMenu } = params;
  
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [totalMemoryUsed, setTotalMemoryUsed] = useState(0);

  const handleFilesSelected = useCallback((files: File[]) => {
    const newFiles = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending' as const,
      uploadProgress: 0,
    }));
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    
    // Update total memory
    const additionalMemory = files.reduce((sum, f) => sum + f.size, 0);
    setTotalMemoryUsed((prev) => prev + additionalMemory);
    setShowComposerMenu(false);
  }, [setShowComposerMenu]);

  const handleRemoveFile = useCallback((fileId: string) => {
    const fileToRemove = attachedFiles.find((f) => f.id === fileId);
    if (fileToRemove) {
      setTotalMemoryUsed((prev) => prev - fileToRemove.file.size);
    }
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, [attachedFiles]);

  const calculateMemoryPercentage = useCallback((): number => {
    const tierCapacity = {
      free: 50 * 1024 * 1024,
      tier5: 150 * 1024 * 1024,
      tier10: 250 * 1024 * 1024,
      tier15: 500 * 1024 * 1024,
    };
    const capacity = tierCapacity[user?.tier as keyof typeof tierCapacity] || tierCapacity.free;
    return Math.min((totalMemoryUsed / capacity) * 100, 100);
  }, [user?.tier, totalMemoryUsed]);

  const getMemoryColor = useCallback((): string => {
    const percentage = calculateMemoryPercentage();
    if (percentage <= 60) return 'bg-green-500';
    if (percentage <= 85) return 'bg-yellow-500';
    return 'bg-red-500';
  }, [calculateMemoryPercentage]);

  return {
    attachedFiles,
    setAttachedFiles,
    totalMemoryUsed,
    setTotalMemoryUsed,
    handleFilesSelected,
    handleRemoveFile,
    calculateMemoryPercentage,
    getMemoryColor,
  };
}

