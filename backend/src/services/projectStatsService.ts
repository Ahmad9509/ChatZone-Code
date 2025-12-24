// Project Statistics Service
// Centralizes project count calculation logic (conversations and documents)
// This eliminates N+1 query problems by fetching data once and counting in memory

import { Conversation } from '../models';
import Document from '../models/Document';

/**
 * Efficiently enrich multiple projects with conversation and document counts
 * 
 * What this does:
 * - Fetches ALL user conversations ONCE (not once per project)
 * - Fetches ALL document counts ONCE using MongoDB aggregation
 * - Counts in memory for each project (fast, no additional database queries)
 * 
 * Why this is better:
 * - Old way: 10 projects = 20 database queries (10 for conversations, 10 for documents)
 * - New way: 10 projects = 2 database queries (1 for conversations, 1 for documents)
 * - 10x performance improvement!
 * 
 * @param userId - The user's ID to fetch data for
 * @param projects - Array of project objects to enrich
 * @returns Projects with conversationCount and documentCount added
 */
export async function enrichProjectsWithCounts(userId: string, projects: any[]) {
  // Fetch ALL conversations for this user ONCE
  const allConversations = await Conversation.findByUserId(userId);
  
  // Fetch document counts grouped by projectId using MongoDB aggregation
  // This is much faster than counting documents for each project individually
  // Handle case when MongoDB is not available
  let docCountMap: Record<string, number> = {};
  try {
    const documentCountsResult = await Document.aggregate([
      { $match: { userId } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } }
    ]);
    
    // Create a quick lookup map: projectId -> document count
    // This allows instant lookups instead of filtering arrays
    for (const result of documentCountsResult) {
      docCountMap[result._id] = result.count;
    }
  } catch (error: any) {
    // MongoDB not available - return empty counts
    console.warn('MongoDB not available for document counts:', error.message);
    docCountMap = {};
  }
  
  // Now enrich each project with counts (all in memory, no more database calls)
  return projects.map(project => {
    // Count conversations for this specific project by filtering in memory
    const conversationCount = allConversations.filter(
      (c: any) => c.projectId === project.rowKey
    ).length;
    
    // Look up document count from our pre-built map (instant)
    const documentCount = docCountMap[project.rowKey] || 0;
    
    return {
      ...project,
      conversationCount,
      documentCount,
    };
  });
}

/**
 * Efficiently enrich a single project with conversation and document counts
 * 
 * What this does:
 * - Fetches all user conversations once
 * - Counts documents for this specific project
 * - Returns project with counts added
 * 
 * Used by: GET /api/projects/:id endpoint
 * 
 * @param userId - The user's ID
 * @param project - Single project object to enrich
 * @returns Project with conversationCount and documentCount added
 */
export async function enrichSingleProject(userId: string, project: any) {
  // Fetch all conversations for this user
  const conversations = await Conversation.findByUserId(userId);
  
  // Count conversations that belong to this project
  const conversationCount = conversations.filter(
    (c: any) => c.projectId === project.rowKey
  ).length;
  
  // Count documents for this specific project using MongoDB
  // Handle case when MongoDB is not available
  let documentCount = 0;
  try {
    documentCount = await Document.countDocuments({ 
      userId, 
      projectId: project.rowKey 
    });
  } catch (error: any) {
    // MongoDB not available - return 0 count
    console.warn('MongoDB not available for document count:', error.message);
    documentCount = 0;
  }
  
  return {
    ...project,
    conversationCount,
    documentCount,
  };
}

