// Artifact model for Azure Table Storage
// Stores generated code, HTML, documents, and other substantial content
import { artifactsTable } from '../config/tableStorage';

export interface IArtifact {
  partitionKey: string; // conversationId
  rowKey: string; // artifact ID (UUID)
  userId: string;
  conversationId: string;
  messageId: string;
  type: 'html' | 'code' | 'svg' | 'markdown' | 'react' | 'vue' | 'json' | 'csv' | 'mermaid' | 'presentation';
  title: string;
  language?: string; // For code artifacts (javascript, python, etc)
  content: string;
  blobUrl?: string; // For large artifacts stored in Blob Storage
  version: number; // Tracks updates to same artifact
  parentArtifactId?: string; // Links to previous version
  metadata?: string; // JSON string with additional data
  createdAt: Date;
  updatedAt: Date;
}

export class ArtifactTable {
  /**
   * Create new artifact
   */
  static async create(artifactData: Partial<IArtifact>): Promise<IArtifact> {
    const artifactId = crypto.randomUUID();
    const artifact: IArtifact = {
      partitionKey: artifactData.conversationId!,
      rowKey: artifactId,
      userId: artifactData.userId!,
      conversationId: artifactData.conversationId!,
      messageId: artifactData.messageId!,
      type: artifactData.type!,
      title: artifactData.title!,
      language: artifactData.language,
      content: artifactData.content!,
      blobUrl: artifactData.blobUrl,
      version: artifactData.version || 1,
      parentArtifactId: artifactData.parentArtifactId,
      metadata: artifactData.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await artifactsTable.createEntity(artifact as any);
    return artifact;
  }

  /**
   * Find artifact by ID
   */
  static async findById(conversationId: string, artifactId: string): Promise<IArtifact | null> {
    try {
      const entity = await artifactsTable.getEntity(conversationId, artifactId);
      return entity as unknown as IArtifact;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find all artifacts in a conversation
   */
  static async findByConversationId(conversationId: string): Promise<IArtifact[]> {
    const entities = artifactsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${conversationId}'` }
    });

    const artifacts: IArtifact[] = [];
    for await (const entity of entities) {
      artifacts.push(entity as unknown as IArtifact);
    }

    // Sort by creation date
    return artifacts.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  /**
   * Find all versions of an artifact
   */
  static async findVersions(conversationId: string, artifactId: string): Promise<IArtifact[]> {
    const allArtifacts = await this.findByConversationId(conversationId);
    
    // Find the root artifact and all its descendants
    const versions: IArtifact[] = [];
    const artifact = allArtifacts.find(a => a.rowKey === artifactId);
    
    if (!artifact) return [];
    
    // If this artifact has a parent, find the root
    let rootId = artifact.parentArtifactId || artifact.rowKey;
    const root = allArtifacts.find(a => a.rowKey === rootId);
    if (root) versions.push(root);
    
    // Find all descendants
    const descendants = allArtifacts.filter(a => 
      a.parentArtifactId === rootId || 
      (a.parentArtifactId && allArtifacts.find(p => 
        p.rowKey === a.parentArtifactId && 
        (p.rowKey === rootId || p.parentArtifactId === rootId)
      ))
    );
    
    versions.push(...descendants);
    
    return versions.sort((a, b) => a.version - b.version);
  }

  /**
   * Update artifact
   */
  static async update(conversationId: string, artifactId: string, updates: Partial<IArtifact>): Promise<IArtifact> {
    const artifact = await this.findById(conversationId, artifactId);
    if (!artifact) throw new Error('Artifact not found');

    const updated = { 
      ...artifact, 
      ...updates,
      updatedAt: new Date()
    };
    
    await artifactsTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  /**
   * Delete artifact
   */
  static async delete(conversationId: string, artifactId: string): Promise<void> {
    await artifactsTable.deleteEntity(conversationId, artifactId);
  }

  /**
   * Delete all artifacts in a conversation
   */
  static async deleteByConversationId(conversationId: string): Promise<void> {
    const artifacts = await this.findByConversationId(conversationId);
    
    for (const artifact of artifacts) {
      await this.delete(conversationId, artifact.rowKey);
    }
  }

  /**
   * Find all artifacts for a user
   */
  static async findByUserId(userId: string): Promise<IArtifact[]> {
    const entities = artifactsTable.listEntities({
      queryOptions: { filter: `userId eq '${userId}'` }
    });

    const artifacts: IArtifact[] = [];
    for await (const entity of entities) {
      artifacts.push(entity as unknown as IArtifact);
    }

    return artifacts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

