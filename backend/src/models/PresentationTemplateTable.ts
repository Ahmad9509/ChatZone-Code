// Presentation Template model using Azure Table Storage
import { presentationTemplatesTable } from '../config/tableStorage';

export interface IPresentationTemplate {
  partitionKey: string; // 'TEMPLATE'
  rowKey: string; // Template ID (e.g., 'general', 'modern', 'standard', 'swift')
  name: string; // Display name
  description: string; // Template description
  isDefault: boolean; // Whether this is a default template
  isOrdered: boolean; // Whether slides must follow a specific order
  availableLayouts: string[]; // Array of layout IDs available in this template
  previewImage?: string; // URL to preview image
  createdAt: Date;
  updatedAt: Date;
}

export interface IPresentationTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  headingColor: string;
  accentColor: string;
}

export const DEFAULT_TEMPLATES = ['general', 'modern', 'standard', 'swift'];

export const DEFAULT_THEMES: IPresentationTheme[] = [
  {
    id: 'blue',
    name: 'Professional Blue',
    primaryColor: '#2563eb',
    secondaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    accentColor: '#60a5fa',
  },
  {
    id: 'green',
    name: 'Fresh Green',
    primaryColor: '#059669',
    secondaryColor: '#10b981',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    accentColor: '#34d399',
  },
  {
    id: 'purple',
    name: 'Modern Purple',
    primaryColor: '#7c3aed',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    accentColor: '#a78bfa',
  },
  {
    id: 'orange',
    name: 'Energetic Orange',
    primaryColor: '#ea580c',
    secondaryColor: '#f97316',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    headingColor: '#111827',
    accentColor: '#fb923c',
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    primaryColor: '#3b82f6',
    secondaryColor: '#60a5fa',
    backgroundColor: '#111827',
    textColor: '#f3f4f6',
    headingColor: '#ffffff',
    accentColor: '#93c5fd',
  },
];

export class PresentationTemplateTable {
  static async create(data: Omit<IPresentationTemplate, 'partitionKey' | 'createdAt' | 'updatedAt'>): Promise<IPresentationTemplate> {
    const template: IPresentationTemplate = {
      partitionKey: 'TEMPLATE',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await presentationTemplatesTable.createEntity(template as any);
    return template;
  }

  static async findById(templateId: string): Promise<IPresentationTemplate | null> {
    try {
      const entity = await presentationTemplatesTable.getEntity('TEMPLATE', templateId);
      return entity as unknown as IPresentationTemplate;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  static async findAll(): Promise<IPresentationTemplate[]> {
    const entities = presentationTemplatesTable.listEntities({
      queryOptions: { filter: `PartitionKey eq 'TEMPLATE'` }
    });
    
    const templates: IPresentationTemplate[] = [];
    for await (const entity of entities) {
      templates.push(entity as unknown as IPresentationTemplate);
    }
    
    return templates;
  }

  static async update(templateId: string, updates: Partial<IPresentationTemplate>): Promise<IPresentationTemplate> {
    const existing = await this.findById(templateId);
    if (!existing) {
      throw new Error(`Template ${templateId} not found`);
    }

    const updated: IPresentationTemplate = {
      ...existing,
      ...updates,
      partitionKey: 'TEMPLATE',
      rowKey: templateId,
      updatedAt: new Date(),
    };

    await presentationTemplatesTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  static async delete(templateId: string): Promise<void> {
    await presentationTemplatesTable.deleteEntity('TEMPLATE', templateId);
  }
}

