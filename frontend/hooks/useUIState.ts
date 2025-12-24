// Custom hook for managing general UI state (dropdowns, panels, menus)
import { useState } from 'react';

export function useUIState() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showComposerMenu, setShowComposerMenu] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [isActionHovered, setIsActionHovered] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [conversationMenuOpen, setConversationMenuOpen] = useState<string | null>(null);
  const [showAddToProjectMenu, setShowAddToProjectMenu] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [showArtifactPanel, setShowArtifactPanel] = useState(false);
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);

  return {
    sidebarCollapsed,
    setSidebarCollapsed,
    showComposerMenu,
    setShowComposerMenu,
    showModelSelector,
    setShowModelSelector,
    isActionHovered,
    setIsActionHovered,
    isRestoring,
    setIsRestoring,
    conversationMenuOpen,
    setConversationMenuOpen,
    showAddToProjectMenu,
    setShowAddToProjectMenu,
    submenuPosition,
    setSubmenuPosition,
    showArtifactPanel,
    setShowArtifactPanel,
    showSourcesPanel,
    setShowSourcesPanel,
  };
}
