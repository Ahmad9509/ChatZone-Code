// Custom hook for handling click-outside behavior for dropdowns and menus
import { useEffect } from 'react';

interface UseClickOutsideParams {
  showModelSelector: boolean;
  setShowModelSelector: (show: boolean) => void;
  modelSelectorRef: React.RefObject<HTMLDivElement | null>;
  
  showComposerMenu: boolean;
  setShowComposerMenu: (show: boolean) => void;
  composerMenuRef: React.RefObject<HTMLDivElement | null>;
  
  showRegenerateMenu: string | null;
  setShowRegenerateMenu: (id: string | null) => void;
  regenerateMenuRef: React.RefObject<HTMLDivElement | null>;
  
  conversationMenuOpen: string | null;
  setConversationMenuOpen: (id: string | null) => void;
  setShowAddToProjectMenu: (id: string | null) => void;
  setSubmenuPosition: (position: { top: number; left: number } | null) => void;
  
  editingMessageId: string | null;
  editTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useClickOutside(params: UseClickOutsideParams) {
  const {
    showModelSelector,
    setShowModelSelector,
    modelSelectorRef,
    showComposerMenu,
    setShowComposerMenu,
    composerMenuRef,
    showRegenerateMenu,
    setShowRegenerateMenu,
    regenerateMenuRef,
    conversationMenuOpen,
    setConversationMenuOpen,
    setShowAddToProjectMenu,
    setSubmenuPosition,
    editingMessageId,
    editTextareaRef,
  } = params;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (showModelSelector && modelSelectorRef.current && !modelSelectorRef.current.contains(target)) {
        setShowModelSelector(false);
      }
      
      if (showComposerMenu && composerMenuRef.current && !composerMenuRef.current.contains(target)) {
        setShowComposerMenu(false);
      }
      
      if (showRegenerateMenu !== null && regenerateMenuRef.current && !regenerateMenuRef.current.contains(target)) {
        setShowRegenerateMenu(null);
      }
      
      // Close conversation menu when clicking outside
      if (conversationMenuOpen !== null) {
        const clickedInsideMenu = target instanceof Element
          ? target.closest('.conversation-menu-dropdown')
          : null;
        if (!clickedInsideMenu) {
          setConversationMenuOpen(null);
          setShowAddToProjectMenu(null);
          setSubmenuPosition(null);
        }
      }
      
      if (editingMessageId && editTextareaRef.current && !editTextareaRef.current.contains(target)) {
        // Keeps the editing state until buttons are pressed intentionally
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [
    showModelSelector,
    setShowModelSelector,
    modelSelectorRef,
    showComposerMenu,
    setShowComposerMenu,
    composerMenuRef,
    showRegenerateMenu,
    setShowRegenerateMenu,
    regenerateMenuRef,
    conversationMenuOpen,
    setConversationMenuOpen,
    setShowAddToProjectMenu,
    setSubmenuPosition,
    editingMessageId,
    editTextareaRef,
  ]);
}

