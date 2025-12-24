// Presentation model for Azure Table Storage
// Stores user-created presentations (slide decks)
import { presentationsTable } from '../config/tableStorage';

export interface ISlide {
  slideId: string;
  slideNumber: number;
  layoutId: string; // template layout identifier
  elements: string; // JSON string of IDesignElement[]
  backgroundColor: string;
  notes?: string; // Speaker notes
  createdAt: Date;
  updatedAt: Date;
}

export interface IPresentation {
  partitionKey: string; // userId
  rowKey: string; // presentation ID (UUID)
  userId: string;
  title: string;
  description?: string;
  slides: string; // JSON string of ISlide[]
  theme: string; // JSON string with brandColor, fontFamily, logoUrl
  sourceConversationIds: string; // JSON string array of conversation IDs used for context
  chatConversationId?: string; // ID of embedded chat conversation in workspace
  status: 'draft' | 'completed';
  slideCount: number;
  thumbnail?: string; // URL to first slide thumbnail
  createdAt: Date;
  updatedAt: Date;
}

export class PresentationTable {
  /**
   * Create new presentation
   */
  static async create(presentationData: Partial<IPresentation>): Promise<IPresentation> {
    const presentationId = crypto.randomUUID();
    const presentation: IPresentation = {
      partitionKey: presentationData.userId!,
      rowKey: presentationId,
      userId: presentationData.userId!,
      title: presentationData.title || 'Untitled Presentation',
      description: presentationData.description,
      slides: presentationData.slides || '[]',
      theme: presentationData.theme || JSON.stringify({
        brandColor: '#3B82F6',
        fontFamily: 'Arial',
        logoUrl: null
      }),
      sourceConversationIds: presentationData.sourceConversationIds || '[]',
      chatConversationId: presentationData.chatConversationId,
      status: presentationData.status || 'draft',
      slideCount: 0,
      thumbnail: presentationData.thumbnail,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await presentationsTable.createEntity(presentation as any);
    return presentation;
  }

  /**
   * Find presentation by ID
   */
  static async findById(userId: string, presentationId: string): Promise<IPresentation | null> {
    try {
      const entity = await presentationsTable.getEntity(userId, presentationId);
      return entity as unknown as IPresentation;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find all presentations for a user
   */
  static async findByUserId(userId: string): Promise<IPresentation[]> {
    const entities = presentationsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}'` }
    });

    const presentations: IPresentation[] = [];
    for await (const entity of entities) {
      presentations.push(entity as unknown as IPresentation);
    }

    // Sort by updatedAt descending
    return presentations.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Update presentation
   */
  static async update(userId: string, presentationId: string, updates: Partial<IPresentation>): Promise<IPresentation> {
    const presentation = await this.findById(userId, presentationId);
    if (!presentation) throw new Error('Presentation not found');

    const updated = {
      ...presentation,
      ...updates,
      updatedAt: new Date()
    };

    await presentationsTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  /**
   * Delete presentation
   */
  static async delete(userId: string, presentationId: string): Promise<void> {
    await presentationsTable.deleteEntity(userId, presentationId);
  }

  /**
   * Count presentations created by user this month
   */
  static async countThisMonth(userId: string): Promise<number> {
    const presentations = await this.findByUserId(userId);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return presentations.filter(p => new Date(p.createdAt) >= startOfMonth).length;
  }
}

