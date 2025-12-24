// Database configuration for Azure Cosmos DB (MongoDB) with local fallback
import mongoose from 'mongoose';

// Connection state tracking
let useLocalMongoDB = false;
let isConnected = false;
const localMongoUri = 'mongodb://localhost:27017';
const dbName = process.env.DATABASE_NAME || 'chatzone';

/**
 * Connects to MongoDB - tries Azure Cosmos DB first, falls back to local MongoDB
 * Uses configuration from environment variables
 * Optimized with connection pooling for better performance
 */
export const connectDatabase = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_CONNECTION_STRING;

  // STEP 1: Try Azure Cosmos DB first (if connection string provided)
  if (mongoUri && mongoUri.trim() !== '') {
    try {
      console.log('🔍 Attempting Azure Cosmos DB connection...');
      
      await mongoose.connect(mongoUri, {
        dbName,
        // Cosmos DB specific options
        retryWrites: false,
        maxIdleTimeMS: 120000,
        serverSelectionTimeoutMS: 5000, // Quick timeout for faster fallback
        // Connection pooling for better performance
        maxPoolSize: 10,
        minPoolSize: 2,
      });
      
      isConnected = true;
      useLocalMongoDB = false;
      console.log('✅ Connected to Azure Cosmos DB (MongoDB)');
      console.log(`📊 Database: ${dbName}`);
      return; // Success! Exit function
      
    } catch (error: any) {
      // Azure failed, log and try local fallback
      console.warn('⚠️  Azure Cosmos DB unreachable - attempting local MongoDB fallback');
      console.warn(`   Error: ${error.message}`);
    }
  } else {
    console.warn('⚠️  MONGODB_CONNECTION_STRING not configured - using local MongoDB');
  }

  // STEP 2: Try Local MongoDB fallback
  try {
    console.log(`🔍 Attempting local MongoDB connection (${localMongoUri})...`);
    
    await mongoose.connect(`${localMongoUri}/${dbName}`, {
      // Standard MongoDB options (NO Cosmos DB options)
      serverSelectionTimeoutMS: 5000,
      // Connection pooling for better performance
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    
    isConnected = true;
    useLocalMongoDB = true;
    console.log('✅ Connected to local MongoDB');
    console.log(`📊 Database: ${dbName}`);
    console.log('💡 Using local MongoDB for RAG embeddings - seamless Azure migration ready');
    
  } catch (localError: any) {
    // Both failed - log and throw
    isConnected = false;
    console.error('❌ Both Azure Cosmos DB and local MongoDB unavailable');
    console.error('   To enable RAG features, install MongoDB locally:');
    console.error('   - Windows: Download MongoDB Community Server');
    console.error('   - Or use Docker: docker run -d -p 27017:27017 mongo:latest');
    throw new Error('MongoDB unavailable - RAG features disabled');
  }
};

/**
 * Handles database connection events
 */
export const setupDatabaseEvents = (): void => {
  mongoose.connection.on('error', (error) => {
    console.error('❌ MongoDB error:', error);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
  });
};

/**
 * Check if using local MongoDB fallback
 */
export function isUsingLocalMongoDB(): boolean {
  return useLocalMongoDB;
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected(): boolean {
  return isConnected;
}

