// Provider model using Azure Table Storage
import { providersTable } from '../config/tableStorage';

export interface IProvider {
  partitionKey: string; // 'PROVIDER'
  rowKey: string; // Provider ID (UUID)
  name: string;
  baseUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ProviderTable {
  static async create(data: { name: string; baseUrl: string; isActive?: boolean }): Promise<IProvider> {
    const id = crypto.randomUUID();
    const provider: IProvider = {
      partitionKey: 'PROVIDER',
      rowKey: id,
      name: data.name,
      baseUrl: data.baseUrl,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await providersTable.createEntity(provider as any);
    return provider;
  }

  static async findAll(): Promise<IProvider[]> {
    const entities = providersTable.listEntities({
      queryOptions: { filter: "PartitionKey eq 'PROVIDER'" }
    });
    
    const providers: IProvider[] = [];
    for await (const entity of entities) {
      providers.push(entity as unknown as IProvider);
    }
    return providers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  static async findById(id: string): Promise<IProvider | null> {
    try {
      const entity = await providersTable.getEntity('PROVIDER', id);
      return entity as unknown as IProvider;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  static async update(id: string, updates: Partial<IProvider>): Promise<IProvider> {
    const provider = await this.findById(id);
    if (!provider) throw new Error('Provider not found');

    const updated = { 
      ...provider, 
      ...updates, 
      updatedAt: new Date() 
    };
    await providersTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  static async delete(id: string): Promise<void> {
    await providersTable.deleteEntity('PROVIDER', id);
  }
}

