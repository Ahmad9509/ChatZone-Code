import { PresentationTemplateTable, IPresentationTemplate, IPresentationTheme, DEFAULT_TEMPLATES, DEFAULT_THEMES } from '../models/PresentationTemplateTable';
import fs from 'fs';
import path from 'path';

export async function loadTemplates(): Promise<void> {
  console.log('Loading presentation templates...');
  
  const templateMetadata: Record<string, { name: string; description: string; isDefault: boolean; isOrdered: boolean }> = {
    general: {
      name: 'General',
      description: 'A versatile template suitable for any presentation type',
      isDefault: true,
      isOrdered: false,
    },
    modern: {
      name: 'Modern',
      description: 'A sleek, contemporary design for professional presentations',
      isDefault: false,
      isOrdered: false,
    },
    standard: {
      name: 'Standard',
      description: 'A classic, clean template for business presentations',
      isDefault: false,
      isOrdered: true,
    },
    swift: {
      name: 'Swift',
      description: 'A fast-paced, dynamic template for impactful presentations',
      isDefault: false,
      isOrdered: false,
    },
  };

  for (const templateId of DEFAULT_TEMPLATES) {
    const existing = await PresentationTemplateTable.findById(templateId);
    if (!existing) {
      const metadata = templateMetadata[templateId];
      await PresentationTemplateTable.create({
        rowKey: templateId,
        name: metadata.name,
        description: metadata.description,
        isDefault: metadata.isDefault,
        isOrdered: metadata.isOrdered,
        availableLayouts: [], // Will be populated when we scan template files
      });
      console.log(`Created template: ${templateId}`);
    }
  }
  
  console.log('Templates loaded successfully');
}

export async function getTemplateById(templateId: string): Promise<IPresentationTemplate | null> {
  return await PresentationTemplateTable.findById(templateId);
}

export async function listAvailableTemplates(): Promise<IPresentationTemplate[]> {
  return await PresentationTemplateTable.findAll();
}

export function listAvailableThemes(): IPresentationTheme[] {
  return DEFAULT_THEMES;
}

export function getThemeById(themeId: string): IPresentationTheme | null {
  return DEFAULT_THEMES.find(theme => theme.id === themeId) || null;
}

