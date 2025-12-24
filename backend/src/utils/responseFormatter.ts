// Response Formatter Utility
// Centralizes entity-to-API-response transformation logic
// This eliminates duplicated ID transformation code across all route files

/**
 * Converts a single database entity to API response format
 * 
 * What this does:
 * - Takes an entity from Azure Table Storage (which has 'rowKey')
 * - Adds an '_id' field that frontend expects
 * - Returns the entity with both fields (safe for frontend compatibility)
 * 
 * Why we need this:
 * - Azure Table Storage uses 'rowKey' as the unique identifier
 * - Frontend expects '_id' (MongoDB convention)
 * - This bridges the gap without manual conversion in every endpoint
 * 
 * @param entity - Any database entity with a rowKey field
 * @returns Entity with added _id field pointing to rowKey value
 */
export function toResponse<T extends { rowKey: string }>(entity: T): T & { _id: string } {
  return {
    ...entity,
    _id: entity.rowKey,
  };
}

/**
 * Converts an array of database entities to API response format
 * 
 * What this does:
 * - Takes an array of entities from database
 * - Transforms each one using toResponse()
 * - Returns array of transformed entities
 * 
 * Common use case:
 * - GET /conversations returns array of conversations
 * - Each conversation needs _id field added
 * - This function does it for all of them at once
 * 
 * @param entities - Array of database entities with rowKey fields
 * @returns Array of entities with added _id fields
 */
export function toResponseArray<T extends { rowKey: string }>(entities: T[]): (T & { _id: string })[] {
  return entities.map(entity => toResponse(entity));
}

