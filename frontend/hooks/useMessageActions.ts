// Custom hook for message-related actions (copy, citations)
import { useState, useCallback } from 'react';

interface UseMessageActionsParams {
  setShowSourcesPanel: (show: boolean) => void;
  setHighlightedSourceIndex: (index: number | null) => void;
}

export function useMessageActions(params: UseMessageActionsParams) {
  const { setShowSourcesPanel, setHighlightedSourceIndex } = params;
  
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Copy message content with markdown and citations removed
  const handleCopyMessage = useCallback((content: string, messageId: string) => {
    // Remove markdown formatting and citations for cleaner copy
    const cleanText = content
      .replace(/\[(\d+)\]/g, '') // Remove citations [1], [2], etc.
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/`([^`]+)`/g, '$1'); // Remove inline code
    
    navigator.clipboard.writeText(cleanText);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
  }, []);

  // Handle clicking on citation numbers in messages
  // Opens sources panel and scrolls to highlighted source
  const handleCitationClick = useCallback((citationNumber: number) => {
    setShowSourcesPanel(true);
    setHighlightedSourceIndex(citationNumber - 1); // Convert to 0-based index
    
    // Scroll to the citation after panel opens
    setTimeout(() => {
      const element = document.getElementById(`source-${citationNumber}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      // Remove highlight after 2 seconds
      setTimeout(() => setHighlightedSourceIndex(null), 2000);
    }, 300); // Wait for panel animation
  }, [setShowSourcesPanel, setHighlightedSourceIndex]);

  return {
    copiedMessageId,
    handleCopyMessage,
    handleCitationClick,
  };
}

