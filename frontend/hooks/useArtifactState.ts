// Custom hook for managing artifact state
import { useState } from 'react';
import { Artifact } from '@/types/artifact';

export function useArtifactState() {
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null);
  const [streamingArtifact, setStreamingArtifact] = useState<Artifact | null>(null);

  return {
    currentArtifact,
    setCurrentArtifact,
    streamingArtifact,
    setStreamingArtifact,
  };
}

