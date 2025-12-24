// Custom hook for managing artifact state and operations
// Handles artifact display, streaming, and panel visibility

import { useState } from 'react';
import { Artifact } from '@/types/artifact';

interface UseArtifacts {
  currentArtifact: Artifact | null;
  setCurrentArtifact: React.Dispatch<React.SetStateAction<Artifact | null>>;
  showArtifactPanel: boolean;
  setShowArtifactPanel: React.Dispatch<React.SetStateAction<boolean>>;
  streamingArtifact: Artifact | null;
  setStreamingArtifact: React.Dispatch<React.SetStateAction<Artifact | null>>;
  closeArtifactPanel: () => void;
}

export const useArtifacts = (): UseArtifacts => {
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null);
  const [showArtifactPanel, setShowArtifactPanel] = useState(false);
  const [streamingArtifact, setStreamingArtifact] = useState<Artifact | null>(null);

  const closeArtifactPanel = () => {
    setShowArtifactPanel(false);
    setStreamingArtifact(null);
  };

  return {
    currentArtifact,
    setCurrentArtifact,
    showArtifactPanel,
    setShowArtifactPanel,
    streamingArtifact,
    setStreamingArtifact,
    closeArtifactPanel,
  };
};

