// Project model using Azure Table Storage
import { projectsTable } from '../config/tableStorage';

export interface IProjectFileReference {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: Date;
}

export interface IProject {
  partitionKey: string; // userId
  rowKey: string; // Project ID (UUID)
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  starred: boolean;
  archived: boolean;
  customInstructions?: string;
  conversationCount: number;
  documentCount: number;
  lastAccessedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  fileCount: number;
}

export class ProjectTable {
  static async create(data: { userId: string; name: string; description?: string; icon?: string; customInstructions?: string }): Promise<IProject> {
    const id = crypto.randomUUID();
    const project: IProject = {
      partitionKey: data.userId,
      rowKey: id,
      userId: data.userId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      customInstructions: data.customInstructions,
      starred: false,
      archived: false,
      conversationCount: 0,
      documentCount: 0,
      fileCount: 0,
      lastAccessedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await projectsTable.createEntity(project as any);
    return project;
  }

  static async findByUserId(userId: string): Promise<IProject[]> {
    const entities = projectsTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${userId}'` }
    });
    
    const projects: IProject[] = [];
    for await (const entity of entities) {
      projects.push(entity as unknown as IProject);
    }
    
    // Sort projects by lastAccessedAt in descending order (most recent first)
    // Convert lastAccessedAt to Date object if it's a string (from Table Storage)
    return projects.sort((a, b) => {
      const dateA = typeof a.lastAccessedAt === 'string' ? new Date(a.lastAccessedAt) : a.lastAccessedAt;
      const dateB = typeof b.lastAccessedAt === 'string' ? new Date(b.lastAccessedAt) : b.lastAccessedAt;
      return dateB.getTime() - dateA.getTime();
    });
  }

  static async findById(userId: string, projectId: string): Promise<IProject | null> {
    try {
      const entity = await projectsTable.getEntity(userId, projectId);
      return entity as unknown as IProject;
    } catch (error: any) {
      if (error.statusCode === 404) return null;
      throw error;
    }
  }

  static async countByUserId(userId: string): Promise<number> {
    const projects = await this.findByUserId(userId);
    return projects.length;
  }

  static async update(userId: string, projectId: string, updates: Partial<IProject>): Promise<IProject> {
    const project = await this.findById(userId, projectId);
    if (!project) throw new Error('Project not found');

    const updated = { 
      ...project, 
      ...updates, 
      updatedAt: new Date() 
    };
    await projectsTable.updateEntity(updated as any, 'Merge');
    return updated;
  }

  static async delete(userId: string, projectId: string): Promise<void> {
    await projectsTable.deleteEntity(userId, projectId);
  }
}

