// API Key model using Azure Table Storage
// Allows multiple API keys per provider
import { apiKeysTable } from '../config/tableStorage';

export interface IApiKey {
  partitionKey: string; // 'APIKEY'
  rowKey: string; // API Key ID (UUID)
  providerId: string; // Link to provider (for grouping)
  name: string; // Descriptive name like "OpenRouter Free Tier Key"
  apiKey: string; // The actual API key
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ApiKeyTable {
  static async create(data: { 
    providerId: string; 
    name: string; 
    apiKey: string; 
    isActive?: boolean 
  }): Promise<IApiKey> {
    const id = crypto.randomUUID();
    const apiKeyEntry: IApiKey = {
      partitionKey: 'APIKEY',
      rowKey: id,
      providerId: data.providerId,
      name: data.name,
      apiKey: data.apiKey,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await apiKeysTable.createEntity(apiKeyEntry as any);
    return apiKeyEntry;
  }

  static async findAll(): Promise<IApiKey[]> {
    const entities = apiKeysTable.listEntities({
      queryOptions: { filter: "PartitionKey eq 'APIKEY'" }
    });
    
    const apiKeys: IApiKey[] = [];
    for await (const entity of entities) {
      apiKeys.push(entity as unknown as IApiKey);
    }
    return apiKeys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  static async findByProviderId(providerId: string): Promise<IApiKey[]> {
    const entities = apiKeysTable.listEntities({
      queryOptions: { filter: `PartitionKey eq 'APIKEY' and providerId eq '${providerId}'` }
    });
    
    const apiKeys: IApiKey[] = [];
    for await (const entity of entities) {
      apiKeys.push(entity as unknown as IApiKey);
    }
    return apiKeys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  static async findById(id: string): Promise<IApiKey | null> {
    try {
      const entity = await apiKeysTable.getEntity('APIKEY', id);
      return entity as unknown as IApiKey;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  static async update(id: string, updates: Partial<IApiKey>): Promise<IApiKey> {
    const apiKey = await this.findById(id);
    if (!apiKey) throw new Error('API Key not found');

    const updated = { 
      ...apiKey, 
      ...updates, 
      updatedAt: new Date() 
    };
    await apiKeysTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  static async delete(id: string): Promise<void> {
    await apiKeysTable.deleteEntity('APIKEY', id);
  }

  static async deleteByProviderId(providerId: string): Promise<void> {
    const entities = apiKeysTable.listEntities({
      queryOptions: { filter: `PartitionKey eq 'APIKEY' and providerId eq '${providerId}'` }
    });
    
    for await (const entity of entities) {
      await apiKeysTable.deleteEntity('APIKEY', (entity as any).rowKey);
    }
  }
}

