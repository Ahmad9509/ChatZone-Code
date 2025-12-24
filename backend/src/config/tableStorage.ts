// Azure Table Storage configuration with local fallback
// All user data, conversations, models, etc. stored here
// MongoDB ONLY used for RAG vector embeddings
import { TableClient, TableServiceClient } from '@azure/data-tables';
import { Edm } from '@azure/data-tables';
import * as fs from 'fs';
import * as path from 'path';
import { mkdirp } from 'mkdirp';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
let useLocalFallback = false;
let localStoragePath = path.join(process.cwd(), 'tmp', 'tables');

// Try to initialize Azure clients, fallback to local if it fails
let serviceClient: TableServiceClient | null = null;

try {
  if (connectionString) {
    serviceClient = TableServiceClient.fromConnectionString(connectionString);
  } else {
    console.warn('⚠️  AZURE_STORAGE_CONNECTION_STRING not configured - using local storage fallback');
    useLocalFallback = true;
  }
} catch (error) {
  console.warn('⚠️  Failed to initialize Azure Table Storage client - using local storage fallback:', (error as Error).message);
  useLocalFallback = true;
}

// Local storage fallback implementation
class LocalTableClient {
  private tableName: string;
  private tablePath: string;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.tablePath = path.join(localStoragePath, `${tableName}.json`);
  }

  // Normalizes filter field names to match casing used in stored entities
  private normalizeFieldName(field: string): string {
    if (!field) return field;
    if (field === 'PartitionKey') return 'partitionKey';
    if (field === 'RowKey') return 'rowKey';
    return field.charAt(0).toLowerCase() + field.slice(1);
  }

  private async ensureTableFile(): Promise<void> {
    await mkdirp(localStoragePath);
    if (!fs.existsSync(this.tablePath)) {
      fs.writeFileSync(this.tablePath, JSON.stringify({ entities: [] }), 'utf8');
    }
  }

  private async readTable(): Promise<{ entities: any[] }> {
    await this.ensureTableFile();
    const data = fs.readFileSync(this.tablePath, 'utf8');
    return JSON.parse(data);
  }

  private async writeTable(data: { entities: any[] }): Promise<void> {
    await this.ensureTableFile();
    fs.writeFileSync(this.tablePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async createEntity(entity: any): Promise<void> {
    const table = await this.readTable();
    table.entities.push(this.serializeEntity(entity));
    await this.writeTable(table);
  }

  async getEntity(partitionKey: string, rowKey: string): Promise<any> {
    const table = await this.readTable();
    const entity = table.entities.find(
      (e: any) => e.partitionKey === partitionKey && e.rowKey === rowKey
    );
    if (!entity) {
      const error: any = new Error('Entity not found');
      error.statusCode = 404;
      throw error;
    }
    return this.deserializeEntity(entity);
  }

  async *listEntities(options?: { queryOptions?: { filter?: string } }): AsyncIterableIterator<any> {
    const table = await this.readTable();
    let entities = table.entities.map((entity: any) => this.deserializeEntity(entity));

    // Simple filter parsing for local storage
    if (options?.queryOptions?.filter) {
      const filter = options.queryOptions.filter;
      entities = entities.filter((entity: any) => {
        // Parse simple filters like "PartitionKey eq 'value'" or "RowKey eq 'value'"
        const partitionKeyMatch = filter.match(/PartitionKey eq '([^']+)'/);
        const rowKeyMatch = filter.match(/RowKey eq '([^']+)'/);
        const andMatch = filter.includes(' and ');

        if (andMatch) {
          const parts = filter.split(' and ');
          return parts.every((part: string) => {
            const pkMatch = part.match(/PartitionKey eq '([^']+)'/);
            const rkMatch = part.match(/RowKey eq '([^']+)'/);
            // Field filters: fieldName eq 'value' OR fieldName eq true/false
            const fieldMatch = part.match(/(\w+) eq '([^']+)'/);
            const boolMatch = part.match(/(\w+) eq (true|false)/);

              if (pkMatch) return entity.partitionKey === pkMatch[1];
              if (rkMatch) return entity.rowKey === rkMatch[1];
              if (boolMatch) {
                const fieldName = this.normalizeFieldName(boolMatch[1]);
                return entity[fieldName] === (boolMatch[2] === 'true');
              }
              if (fieldMatch) {
                const fieldName = this.normalizeFieldName(fieldMatch[1]);
                return entity[fieldName] === fieldMatch[2];
              }
            return true;
          });
        }

        if (partitionKeyMatch && entity.partitionKey !== partitionKeyMatch[1]) return false;
        if (rowKeyMatch && entity.rowKey !== rowKeyMatch[1]) return false;

        // Handle other field filters (string or boolean)
        const fieldMatch = filter.match(/(\w+) eq '([^']+)'/);
        const boolMatch = filter.match(/(\w+) eq (true|false)/);
        
        if (boolMatch) {
          const fieldName = this.normalizeFieldName(boolMatch[1]);
          if (entity[fieldName] !== (boolMatch[2] === 'true')) return false;
        }
        if (fieldMatch) {
          const fieldName = this.normalizeFieldName(fieldMatch[1]);
          if (entity[fieldName] !== fieldMatch[2]) return false;
        }

        return true;
      });
    }

    for (const entity of entities) {
      yield entity;
    }
  }

  async updateEntity(entity: any, mode: 'Merge' | 'Replace' = 'Merge'): Promise<void> {
    const table = await this.readTable();
    const index = table.entities.findIndex(
      (e: any) => e.partitionKey === entity.partitionKey && e.rowKey === entity.rowKey
    );

    if (index === -1) {
      throw new Error('Entity not found');
    }

    const storedEntity = this.serializeEntity(entity);

    if (mode === 'Merge') {
      table.entities[index] = { ...table.entities[index], ...storedEntity };
    } else {
      table.entities[index] = storedEntity;
    }

    await this.writeTable(table);
  }

  async deleteEntity(partitionKey: string, rowKey: string): Promise<void> {
    const table = await this.readTable();
    table.entities = table.entities.filter(
      (e: any) => !(e.partitionKey === partitionKey && e.rowKey === rowKey)
    );
    await this.writeTable(table);
  }

  // Converts Date fields to ISO strings before persisting to JSON fallback
  private serializeEntity(entity: any): any {
    if (!entity) return entity;
    const serialized = { ...entity };
    if (serialized.createdAt instanceof Date) {
      serialized.createdAt = serialized.createdAt.toISOString();
    }
    if (serialized.updatedAt instanceof Date) {
      serialized.updatedAt = serialized.updatedAt.toISOString();
    }
    return serialized;
  }

  // Restores ISO date strings back into Date objects when reading from disk
  private deserializeEntity(entity: any): any {
    if (!entity) return entity;
    const deserialized = { ...entity };
    if (typeof deserialized.createdAt === 'string') {
      deserialized.createdAt = new Date(deserialized.createdAt);
    }
    if (typeof deserialized.updatedAt === 'string') {
      deserialized.updatedAt = new Date(deserialized.updatedAt);
    }
    return deserialized;
  }
}

// Initialize all tables
export const initializeTables = async () => {
  const tables = [
    'Users',
    'Conversations', 
    'Messages',
    'Projects',
    'Documents',
    'ProjectInstructions',
    'Models',
    'Providers',
    'ApiKeys',
    'TierConfigs',
    'SystemPrompts',
    'Artifacts',
    'ResearchJobs',
    'Designs',
    'Presentations',
    'PresentationTemplates',
  ];

  if (useLocalFallback) {
    console.log('📊 Initializing local table storage...');
    await mkdirp(localStoragePath);
    for (const tableName of tables) {
      // Create or validate the JSON file for each table
      const tablePath = path.join(localStoragePath, `${tableName}.json`);
      let needsCreation = false;

      if (fs.existsSync(tablePath)) {
        // File exists - validate structure
        try {
          const existingData = JSON.parse(fs.readFileSync(tablePath, 'utf8'));
          // ONLY recreate if completely invalid (not an object or null)
          if (!existingData || typeof existingData !== 'object') {
            console.warn(`⚠️  Table ${tableName} has invalid data, recreating...`);
            needsCreation = true;
          } else if (!existingData.entities) {
            // If entities array missing, add it but preserve other data
            console.log(`📝 Adding entities array to ${tableName}...`);
            existingData.entities = [];
            fs.writeFileSync(tablePath, JSON.stringify(existingData, null, 2), 'utf8');
          }
          // If entities exists but is not an array, fix it
          else if (!Array.isArray(existingData.entities)) {
            console.warn(`⚠️  Table ${tableName} has non-array entities, fixing...`);
            existingData.entities = [];
            fs.writeFileSync(tablePath, JSON.stringify(existingData, null, 2), 'utf8');
          }
        } catch (error) {
          console.warn(`⚠️  Table ${tableName} has corrupted JSON, recreating...`);
          needsCreation = true; // Only recreate on JSON parse error
        }
      } else {
        needsCreation = true; // File doesn't exist
      }

      if (needsCreation) {
        fs.writeFileSync(tablePath, JSON.stringify({ entities: [] }, null, 2), 'utf8');
      }
      console.log(`✅ Local table ${tableName} ready`);
    }
    // Re-create all table clients with local fallback after detection
    initializeTableClients();
    return;
  }

  for (const tableName of tables) {
    try {
      await serviceClient!.createTable(tableName);
      console.log(`✅ Table ${tableName} ready`);
    } catch (error: any) {
      if (error.statusCode === 409) {
        console.log(`✅ Table ${tableName} already exists`);
      } else if (error.code === 'ENOTFOUND' || error.name === 'RestError') {
        console.warn(`⚠️  Azure Table Storage unreachable for ${tableName} - switching to local fallback`);
        useLocalFallback = true;
        await mkdirp(localStoragePath);
        // Create or validate JSON files for all tables since we're switching to local fallback
        for (const tableName of tables) {
          const tablePath = path.join(localStoragePath, `${tableName}.json`);
          let needsCreation = false;

          if (fs.existsSync(tablePath)) {
            // File exists - validate structure
            try {
              const existingData = JSON.parse(fs.readFileSync(tablePath, 'utf8'));
              // ONLY recreate if completely invalid (not an object or null)
              if (!existingData || typeof existingData !== 'object') {
                console.warn(`⚠️  Table ${tableName} has invalid data, recreating...`);
                needsCreation = true;
              } else if (!existingData.entities) {
                // If entities array missing, add it but preserve other data
                console.log(`📝 Adding entities array to ${tableName}...`);
                existingData.entities = [];
                fs.writeFileSync(tablePath, JSON.stringify(existingData, null, 2), 'utf8');
              }
              // If entities exists but is not an array, fix it
              else if (!Array.isArray(existingData.entities)) {
                console.warn(`⚠️  Table ${tableName} has non-array entities, fixing...`);
                existingData.entities = [];
                fs.writeFileSync(tablePath, JSON.stringify(existingData, null, 2), 'utf8');
              }
            } catch (error) {
              console.warn(`⚠️  Table ${tableName} has corrupted JSON, recreating...`);
              needsCreation = true; // Only recreate on JSON parse error
            }
          } else {
            needsCreation = true; // File doesn't exist
          }

          if (needsCreation) {
            fs.writeFileSync(tablePath, JSON.stringify({ entities: [] }, null, 2), 'utf8');
          }
          console.log(`✅ Local table ${tableName} ready`);
        }
        // Break out and re-initialize all clients with local fallback
        break;
      } else {
        console.error(`❌ Error creating table ${tableName}:`, error);
      }
    }
  }
  
  // Re-create all table clients after fallback detection
  initializeTableClients();
};

// Create table client with fallback support
function createTableClient(tableName: string): any {
  if (useLocalFallback) {
    return new LocalTableClient(tableName);
  }
  
  try {
    if (!connectionString) {
      useLocalFallback = true;
      return new LocalTableClient(tableName);
    }
    return TableClient.fromConnectionString(connectionString, tableName);
  } catch (error) {
    console.warn(`⚠️  Failed to create Azure table client for ${tableName} - using local fallback`);
    useLocalFallback = true;
    return new LocalTableClient(tableName);
  }
}

// Export function to check if using local fallback
export function isUsingLocalFallback(): boolean {
  return useLocalFallback;
}

// Declare table client variables (will be initialized after fallback detection)
export let usersTable: any;
export let conversationsTable: any;
export let messagesTable: any;
export let projectsTable: any;
export let documentsTable: any;
export let modelsTable: any;
export let providersTable: any;
export let apiKeysTable: any;
export let tierConfigsTable: any;
export let systemPromptsTable: any;
export let artifactsTable: any;
export let researchJobsTable: any;
export let designsTable: any;
export let presentationsTable: any;
export let presentationTemplatesTable: any;

// Function to initialize/re-initialize all table clients
// This is called AFTER fallback detection in initializeTables()
function initializeTableClients(): void {
  usersTable = createTableClient('Users');
  conversationsTable = createTableClient('Conversations');
  messagesTable = createTableClient('Messages');
  projectsTable = createTableClient('Projects');
  documentsTable = createTableClient('Documents');
  modelsTable = createTableClient('Models');
  providersTable = createTableClient('Providers');
  apiKeysTable = createTableClient('ApiKeys');
  tierConfigsTable = createTableClient('TierConfigs');
  systemPromptsTable = createTableClient('SystemPrompts');
  artifactsTable = createTableClient('Artifacts');
  researchJobsTable = createTableClient('ResearchJobs');
  designsTable = createTableClient('Designs');
  presentationsTable = createTableClient('Presentations');
  presentationTemplatesTable = createTableClient('PresentationTemplates');
}
