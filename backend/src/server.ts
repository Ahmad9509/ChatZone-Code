// Server entry point for ChatZone.ai backend
// Deployed to Azure App Service

// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import path from 'path';

// Explicitly point to .env file location
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { createApp } from './app';
import { connectDatabase, setupDatabaseEvents } from './config/database';
import { initializeTables } from './config/tableStorage';
import { initializeBlobStorage } from './config/fileStorage';
import { seedTestUsers } from './utils/seedTestUsers';
import { SystemPrompt, TierConfig } from './models';

/**
 * Start the Express server
 * - Azure Table Storage for user data, conversations, models, etc.
 * - Azure Blob Storage for temporary file uploads
 * - MongoDB (Cosmos DB) ONLY for RAG vector embeddings
 * - Background worker for Deep Research job processing
 */
const startServer = async (): Promise<void> => {
  try {
    // Initialize Azure Table Storage (main data storage) with local fallback
    console.log('📊 Initializing Table Storage...');
    await initializeTables();
    console.log('✅ Table Storage ready');

    // Initialize Azure Blob Storage (file uploads) with local fallback
    console.log('📁 Initializing File Storage...');
    await initializeBlobStorage();
    console.log('✅ File Storage ready');

    // Seed system prompts if missing
    console.log('📝 Seeding system prompts...');
    await SystemPrompt.seedDefaults();
    console.log('✅ System prompts ready');

    // Seed/update tier configurations
    console.log('⚙️  Seeding tier configurations...');
    await TierConfig.seedDefaults();
    console.log('✅ Tier configurations ready');

    // Seed test users (only runs if ENABLE_TEST_USERS=true in .env)
    // Disabled after initial seed to prevent duplicates
    await seedTestUsers();

    // Connect to MongoDB ONLY for RAG embeddings
    console.log('🔍 Initializing MongoDB for RAG embeddings...');
    try {
      await connectDatabase();
      setupDatabaseEvents();
      console.log('✅ MongoDB ready for RAG features');
    } catch (error) {
      console.log('⚠️  MongoDB unavailable - RAG features disabled');
      console.log('   Main app will continue with Table Storage and Blob Storage');
    }

    // Create Express app
    const app = createApp();

    // Get port from environment (Azure App Service sets PORT automatically)
    const PORT = process.env.PORT || 5000;

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 ChatZone.ai Backend API running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Backend URL: https://${process.env.BACKEND_API_URL}`);
      console.log(`🎨 Frontend URL: https://${process.env.FRONTEND_URL}`);
      console.log(`⚙️  Admin URL: https://${process.env.ADMIN_URL}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

