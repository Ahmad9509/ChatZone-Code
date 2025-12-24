// Service for project-related operations
import { chat as chatApi } from '@/lib/api';

interface AddToProjectParams {
  conversationId: string;
  projectId: string;
  setConversations: (conversations: any[]) => void;
  setConversationMenuOpen: (id: string | null) => void;
  setShowAddToProjectMenu: (id: string | null) => void;
  setSubmenuPosition: (position: { top: number; left: number } | null) => void;
}

export async function addConversationToProject(params: AddToProjectParams): Promise<void> {
  const {
    conversationId,
    projectId,
    setConversations,
    setConversationMenuOpen,
    setShowAddToProjectMenu,
    setSubmenuPosition,
  } = params;
  
  try {
    console.log('🔗 Adding conversation to project:', { conversationId, projectId });
    await chatApi.updateConversation(conversationId, { projectId } as any);
    
    // Refresh conversations to show updated project assignment
    const res = await chatApi.getConversations();
    setConversations(res.data.conversations || []);
    setConversationMenuOpen(null);
    setShowAddToProjectMenu(null);
    setSubmenuPosition(null);
    console.log('✅ Successfully added conversation to project');
  } catch (error) {
    console.error('❌ Failed to add conversation to project:', error);
  }
}

