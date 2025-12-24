// Conversation model using Azure Table Storage
import { conversationsTable } from '../config/tableStorage';

export interface IConversation {
  partitionKey: string; // userId
  rowKey: string; // Conversation ID (UUID)
  userId: string;
  title: string;
  currentModel?: string; // Currently selected model
  projectId?: string;
  starred: boolean;
  archived: boolean;
  messageCount: number;
  totalMemoryUsed: number; // Total bytes used by attached files
  draftText?: string; // WHAT THIS DOES: Stores draft text that user typed but hasn't sent yet - persists across devices
  deepResearchActive?: boolean; // WHAT THIS DOES: Tracks if this conversation is in deep research mode
  deepResearchPhase?: 'questions' | 'research' | null; // WHAT THIS DOES: Tracks which phase of deep research (questions or research)
  deepResearchData?: string; // WHAT THIS DOES: Stores original message and other data needed for phase 2
  pptGenerationActive?: boolean; // WHAT THIS DOES: Tracks if this conversation is in PPT generation mode
  pptGenerationPhase?: 'questions' | 'outline' | 'template_select' | 'generation' | null; // WHAT THIS DOES: Tracks which phase of PPT generation
  pptGenerationData?: string; // WHAT THIS DOES: Stores data needed across PPT generation phases (original message, questions, answers, outline)
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationTable {
  static async create(data: { userId: string; title?: string; projectId?: string }): Promise<IConversation> {
    const id = crypto.randomUUID();
    const conversation: IConversation = {
      partitionKey: data.userId,
      rowKey: id,
      userId: data.userId,
      title: data.title || 'New Chat',
      projectId: data.projectId,
      starred: false,
      archived: false,
      messageCount: 0,
      totalMemoryUsed: 0,
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await conversationsTable.createEntity(conversation as any);
    return conversation;
  }

  static async findByUserId(userId: string): Promise<IConversation[]> {
    const entities = conversationsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}'` }
    });
    
    const conversations: IConversation[] = [];
    for await (const entity of entities) {
      conversations.push(entity as unknown as IConversation);
    }
    
    // Sort conversations by lastMessageAt in descending order (most recent first)
    // Convert lastMessageAt to Date object if it's a string (from Table Storage)
    return conversations.sort((a, b) => {
      const dateA = typeof a.lastMessageAt === 'string' ? new Date(a.lastMessageAt) : a.lastMessageAt;
      const dateB = typeof b.lastMessageAt === 'string' ? new Date(b.lastMessageAt) : b.lastMessageAt;
      return dateB.getTime() - dateA.getTime();
    });
  }

  static async findById(userId: string, conversationId: string): Promise<IConversation | null> {
    try {
      const entity = await conversationsTable.getEntity(userId, conversationId);
      return entity as unknown as IConversation;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  static async update(userId: string, conversationId: string, updates: Partial<IConversation>): Promise<IConversation> {
    const conversation = await this.findById(userId, conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const updated = { 
      ...conversation, 
      ...updates, 
      updatedAt: new Date() 
    };
    await conversationsTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  static async delete(userId: string, conversationId: string): Promise<void> {
    await conversationsTable.deleteEntity(userId, conversationId);
  }

  static async deleteByProjectId(userId: string, projectId: string): Promise<void> {
    const entities = conversationsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}' and projectId eq '${projectId}'` }
    });
    
    for await (const entity of entities) {
      await conversationsTable.deleteEntity(userId, (entity as any).rowKey);
    }
  }
}

