// Design model for Azure Table Storage
// Stores user-created designs (social media graphics, posters, etc.)
import { designsTable } from '../config/tableStorage';

export interface IDesignElement {
  elementId: string;
  type: 'text' | 'image' | 'shape' | 'ai-image';
  content: string; // Text content or image URL
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  styles: string; // JSON string with font, color, etc.
}

export interface IDesign {
  partitionKey: string; // userId
  rowKey: string; // design ID (UUID)
  userId: string;
  title: string;
  designType: string; // 'instagram-post', 'facebook-post', 'custom', etc.
  width: number;
  height: number;
  elements: string; // JSON string of IDesignElement[]
  thumbnail?: string; // URL to thumbnail image
  backgroundColor: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DesignTable {
  /**
   * Create new design
   */
  static async create(designData: Partial<IDesign>): Promise<IDesign> {
    const designId = crypto.randomUUID();
    const design: IDesign = {
      partitionKey: designData.userId!,
      rowKey: designId,
      userId: designData.userId!,
      title: designData.title || 'Untitled Design',
      designType: designData.designType || 'custom',
      width: designData.width || 1080,
      height: designData.height || 1080,
      elements: designData.elements || '[]',
      thumbnail: designData.thumbnail,
      backgroundColor: designData.backgroundColor || '#FFFFFF',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await designsTable.createEntity(design as any);
    return design;
  }

  /**
   * Find design by ID
   */
  static async findById(userId: string, designId: string): Promise<IDesign | null> {
    try {
      const entity = await designsTable.getEntity(userId, designId);
      return entity as unknown as IDesign;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find all designs for a user
   */
  static async findByUserId(userId: string): Promise<IDesign[]> {
    const entities = designsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}'` }
    });

    const designs: IDesign[] = [];
    for await (const entity of entities) {
      designs.push(entity as unknown as IDesign);
    }

    // Sort by updatedAt descending
    return designs.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Update design
   */
  static async update(userId: string, designId: string, updates: Partial<IDesign>): Promise<IDesign> {
    const design = await this.findById(userId, designId);
    if (!design) throw new Error('Design not found');

    const updated = {
      ...design,
      ...updates,
      updatedAt: new Date()
    };

    await designsTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  /**
   * Delete design
   */
  static async delete(userId: string, designId: string): Promise<void> {
    await designsTable.deleteEntity(userId, designId);
  }

  /**
   * Count designs created by user this month
   */
  static async countThisMonth(userId: string): Promise<number> {
    const designs = await this.findByUserId(userId);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return designs.filter(d => new Date(d.createdAt) >= startOfMonth).length;
  }
}

