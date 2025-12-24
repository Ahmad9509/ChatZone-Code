// Message model using Azure Table Storage
import { messagesTable } from '../config/tableStorage';
import { MessageSerializer } from '../utils/messageSerializer';

export interface AttachedFile {
  id: string;
  name: string;
  type: 'text' | 'image';
  content?: string;      // For text files
  blobUrl?: string;      // For blob storage reference
  size: number;
}

export interface IMessage {
  partitionKey: string; // conversationId
  rowKey: string; // Message ID (UUID + timestamp for ordering)
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelName?: string;
  tokenCount: number;
  branchIndex: number;
  parentMessageId?: string;
  sources?: any[]; // Deserialized array (stored as JSON string in database)
  attachedFiles?: AttachedFile[]; // Deserialized array (stored as JSON string in database)
  artifactId?: string; // Reference to created artifact
  eventStream?: any[]; // Deserialized array (stored as JSON string in database) - chronological event stream
  createdAt: Date;
}

export class MessageTable {
  static async create(data: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    modelName?: string;
    tokenCount?: number;
    branchIndex?: number;
    parentMessageId?: string;
    sources?: any;
    attachedFiles?: AttachedFile[];
    artifactId?: string;
    eventStream?: any[];
  }): Promise<IMessage> {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const rowKey = `${timestamp}_${id}`; // Ensures chronological ordering

    // Serialize complex fields for storage
    const serializedMessage = MessageSerializer.serialize({
      partitionKey: data.conversationId,
      rowKey,
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      modelName: data.modelName,
      tokenCount: data.tokenCount || 0,
      branchIndex: data.branchIndex || 0,
      parentMessageId: data.parentMessageId,
      sources: data.sources,
      attachedFiles: data.attachedFiles,
      artifactId: data.artifactId,
      eventStream: data.eventStream,
      createdAt: new Date(),
    });

    await messagesTable.createEntity(serializedMessage as any);
    
    // Return deserialized version for application use
    return MessageSerializer.deserialize(serializedMessage);
  }

  static async findByConversationId(conversationId: string, limit?: number): Promise<IMessage[]> {
    const entities = messagesTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${conversationId}'` }
    });
    
    const messages: IMessage[] = [];
    for await (const entity of entities) {
      // Deserialize complex fields after reading from storage
      messages.push(MessageSerializer.deserialize(entity as unknown as IMessage));
      
      // PERFORMANCE OPTIMIZATION: Stop loading once we have enough messages
      // This prevents loading 1000+ messages into RAM when we only need last 30
      // Break early if limit specified and we've loaded more than needed
      if (limit && messages.length >= limit * 2) {
        break; // Load 2x limit to ensure we get the last N after sorting
      }
    }
    // Already sorted by rowKey (timestamp)
    // If limit specified, return only the last N messages
    return limit ? messages.slice(-limit) : messages;
  }

  static async findById(conversationId: string, messageId: string): Promise<IMessage | null> {
    try {
      const entity = await messagesTable.getEntity(conversationId, messageId);
      return MessageSerializer.deserialize(entity as unknown as IMessage);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  static async delete(partitionKey: string, rowKey: string): Promise<void> {
    await messagesTable.deleteEntity(partitionKey, rowKey);
  }

  static async deleteByConversationId(conversationId: string): Promise<void> {
    const entities = messagesTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${conversationId}'` }
    });
    
    for await (const entity of entities) {
      await messagesTable.deleteEntity(conversationId, (entity as any).rowKey);
    }
  }

  static async update(rowKey: string, conversationId: string, updates: Partial<IMessage>): Promise<void> {
    const entity = await messagesTable.getEntity(conversationId, rowKey);
    
    // Serialize any complex fields in updates
    const serializedUpdates = MessageSerializer.serialize(updates);
    
    const updatedEntity = { ...entity, ...serializedUpdates };
    await messagesTable.updateEntity(updatedEntity, 'Merge');
  }
}

