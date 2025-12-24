// Custom hook for managing AI model selection and persistence
import { useEffect } from 'react';

interface UseModelSelectionParams {
  user: any; // Replace with actual User type
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
}

export function useModelSelection(params: UseModelSelectionParams) {
  const { user, selectedModel, setSelectedModel } = params;

  // Load user's preferred model on mount
  // This ensures the model dropdown reflects the user's saved preference across devices
  useEffect(() => {
    if (user?.preferredModelId) {
      setSelectedModel(user.preferredModelId);
    }
  }, [user, setSelectedModel]);

  // Handler to change model and persist to backend
  // Saves user's model preference so it syncs across devices
  const handleModelChange = async (newModelId: string) => {
    setSelectedModel(newModelId);
    
    // Persist to backend if not 'auto' (auto is handled by backend rotation)
    if (newModelId !== 'auto') {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user/preferences`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('cz.authToken')}`,
          },
          body: JSON.stringify({ preferredModelId: newModelId }),
        });
      } catch (error) {
        console.error('Failed to save model preference:', error);
        // Don't show error to user - preference will still work for current session
      }
    }
  };

  return {
    handleModelChange,
  };
}

