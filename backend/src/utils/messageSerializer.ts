// Message Serializer - Centralized serialization/deserialization for complex Message fields
// Ensures consistent handling of JSON fields (sources, attachedFiles) between database and application

/**
 * Handles conversion between database storage format (JSON strings) and application format (objects/arrays)
 * Used by Message model to normalize data on read/write operations
 */
export class MessageSerializer {
  /**
   * Deserialize a message from database format to application format
   * Converts JSON string fields to parsed objects/arrays
   * 
   * @param message - Raw message entity from Azure Table Storage
   * @returns Message with parsed complex fields
   */
  static deserialize(message: any): any {
    if (!message) return message;
    
    return {
      ...message,
      sources: this.parseField(message.sources),
      attachedFiles: this.parseField(message.attachedFiles),
      eventStream: this.parseField(message.eventStream),
    };
  }

  /**
   * Serialize a message from application format to database format
   * Converts objects/arrays to JSON strings for storage
   * 
   * @param message - Message data with object fields
   * @returns Message with stringified complex fields
   */
  static serialize(message: any): any {
    if (!message) return message;
    
    return {
      ...message,
      sources: this.stringifyField(message.sources),
      attachedFiles: this.stringifyField(message.attachedFiles),
      eventStream: this.stringifyField(message.eventStream),
    };
  }

  /**
   * Parse a field that might be a string or already parsed
   * Handles both cases gracefully
   * 
   * @param field - Field that might be string or object/array
   * @returns Parsed object/array or undefined
   */
  private static parseField(field: any): any {
    // Null/undefined - return as-is
    if (field === null || field === undefined) {
      return undefined;
    }
    
    // Already an object or array - return as-is
    if (typeof field === 'object') {
      return field;
    }
    
    // String - attempt to parse
    if (typeof field === 'string') {
      // Empty string - return undefined
      if (field.trim() === '') {
        return undefined;
      }
      
      try {
        return JSON.parse(field);
      } catch (error) {
        // Invalid JSON - log warning and return undefined
        console.warn('Failed to parse JSON field:', field, error);
        return undefined;
      }
    }
    
    // Other types (number, boolean, etc.) - return undefined
    return undefined;
  }

  /**
   * Stringify a field for database storage
   * Handles already-stringified fields gracefully
   * 
   * @param field - Field to stringify
   * @returns JSON string or undefined
   */
  private static stringifyField(field: any): string | undefined {
    // Null/undefined - return undefined
    if (field === null || field === undefined) {
      return undefined;
    }
    
    // Already a string - return as-is
    if (typeof field === 'string') {
      return field;
    }
    
    // Object or array - stringify
    if (typeof field === 'object') {
      try {
        return JSON.stringify(field);
      } catch (error) {
        // Circular reference or other error - log warning and return undefined
        console.warn('Failed to stringify field:', field, error);
        return undefined;
      }
    }
    
    // Other types - return undefined
    return undefined;
  }
}

