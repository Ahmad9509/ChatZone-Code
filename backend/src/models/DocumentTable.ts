// Document model using Azure Table Storage
// Note: Embeddings still stored in MongoDB for RAG
import { documentsTable } from '../config/tableStorage';

export interface IDocument {
  partitionKey: string; // userId
  rowKey: string; // Document ID (UUID)
  userId: string;
  projectId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  blobUrl: string;
  status: 'processing' | 'completed' | 'failed';
  chunkCount: number;
  totalTokens: number;
  errorMessage?: string;
  processedAt?: Date;
  createdAt: Date;
}

export class DocumentTable {
  static async create(data: {
    userId: string;
    projectId?: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    blobUrl: string;
  }): Promise<IDocument> {
    const id = crypto.randomUUID();
    const document: IDocument = {
      partitionKey: data.userId,
      rowKey: id,
      userId: data.userId,
      projectId: data.projectId,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      blobUrl: data.blobUrl,
      status: 'processing',
      chunkCount: 0,
      totalTokens: 0,
      createdAt: new Date(),
    };

    await documentsTable.createEntity(document as any);
    return document;
  }

  static async findByUserId(userId: string): Promise<IDocument[]> {
    const entities = documentsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}'` }
    });
    
    const documents: IDocument[] = [];
    for await (const entity of entities) {
      documents.push(entity as unknown as IDocument);
    }
    return documents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  static async findById(userId: string, documentId: string): Promise<IDocument | null> {
    try {
      const entity = await documentsTable.getEntity(userId, documentId);
      return entity as unknown as IDocument;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  static async findByProjectId(userId: string, projectId: string): Promise<IDocument[]> {
    const entities = documentsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}' and projectId eq '${projectId}'` }
    });
    
    const documents: IDocument[] = [];
    for await (const entity of entities) {
      documents.push(entity as unknown as IDocument);
    }
    return documents;
  }

  static async update(userId: string, documentId: string, updates: Partial<IDocument>): Promise<IDocument> {
    const document = await this.findById(userId, documentId);
    if (!document) throw new Error('Document not found');

    const updated = { ...document, ...updates };
    await documentsTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  static async delete(userId: string, documentId: string): Promise<void> {
    await documentsTable.deleteEntity(userId, documentId);
  }

  static async deleteByProjectId(userId: string, projectId: string): Promise<void> {
    const entities = documentsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}' and projectId eq '${projectId}'` }
    });
    
    for await (const entity of entities) {
      await documentsTable.deleteEntity(userId, (entity as any).rowKey);
    }
  }

  static async getTotalSizeByUserId(userId: string): Promise<number> {
    const documents = await this.findByUserId(userId);
    return documents.reduce((sum, doc) => sum + doc.fileSize, 0);
  }
}

