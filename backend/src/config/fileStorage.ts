// Azure Blob Storage configuration with local fallback
// Handles temporary file storage for chat attachments
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import * as fs from 'fs';
import * as path from 'path';
import { mkdirp } from 'mkdirp';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = 'chat-files';
let useLocalFallback = false;
let localStoragePath = path.join(process.cwd(), 'tmp', 'uploads');

let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ContainerClient | null = null;

// Try to initialize Azure Blob Storage
try {
  if (connectionString && connectionString.trim() !== '' && !connectionString.includes('your-')) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  } else {
    console.warn('⚠️  Azure Blob Storage connection string not configured - using local storage fallback');
    useLocalFallback = true;
  }
} catch (error) {
  console.warn('⚠️  Failed to initialize Azure Blob Storage client - using local storage fallback:', (error as Error).message);
  useLocalFallback = true;
}

/**
 * Initialize blob storage container with fallback
 */
export const initializeBlobStorage = async (): Promise<void> => {
  if (useLocalFallback) {
    console.log('📁 Initializing local file storage...');
    await mkdirp(localStoragePath);
    console.log(`✅ Local file storage ready at ${localStoragePath}`);
    return;
  }

  try {
    containerClient = blobServiceClient!.getContainerClient(containerName);
    
    // Create container if it doesn't exist
    const exists = await containerClient.exists();
    if (!exists) {
      console.log(`📁 Creating blob container: ${containerName}`);
      await blobServiceClient!.createContainer(containerName, {
        access: 'container', // Allow anonymous read access
      });
      console.log(`✅ Blob container ${containerName} created`);
    } else {
      console.log(`✅ Blob container ${containerName} exists`);
    }
  } catch (error: any) {
    if (error.statusCode === 409) {
      // Container already exists
      containerClient = blobServiceClient!.getContainerClient(containerName);
      console.log(`✅ Blob container ${containerName} already exists`);
    } else if (error.code === 'ENOTFOUND' || error.name === 'RestError') {
      console.warn('⚠️  Azure Blob Storage unreachable - switching to local file storage');
      useLocalFallback = true;
      await mkdirp(localStoragePath);
      console.log(`✅ Local file storage ready at ${localStoragePath}`);
    } else {
      console.error('❌ Error initializing blob storage:', error);
      // Fallback to local storage on any error
      console.warn('⚠️  Falling back to local file storage due to initialization error');
      useLocalFallback = true;
      await mkdirp(localStoragePath);
      console.log(`✅ Local file storage ready at ${localStoragePath}`);
    }
  }
};

/**
 * Upload file with automatic fallback to local storage
 * Returns: file URL (blob URL or local file path)
 */
export const uploadFile = async (
  conversationId: string,
  fileId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> => {
  // Local storage fallback
  if (useLocalFallback || !containerClient) {
    try {
      const fileDir = path.join(localStoragePath, 'conversations', conversationId, fileId);
      await mkdirp(fileDir);
      const filePath = path.join(fileDir, fileName);
      fs.writeFileSync(filePath, buffer);
      
      // Return local URL path
      const localUrl = `/local-files/conversations/${conversationId}/${fileId}/${fileName}`;
      console.log(`✅ File uploaded to local storage: ${localUrl}`);
      return localUrl;
    } catch (error) {
      console.error('❌ Error uploading file to local storage:', error);
      throw new Error(`Failed to upload file locally: ${(error as Error).message}`);
    }
  }

  // Azure Blob Storage
  try {
    const blobName = `conversations/${conversationId}/${fileId}/${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload with content type auto-detect
    await blockBlobClient.upload(buffer, buffer.length);

    console.log(`✅ File uploaded to Azure Blob Storage: ${blobName}`);
    return blockBlobClient.url;
  } catch (error: any) {
    // On any Azure error, fallback to local storage
    if (error.code === 'ENOTFOUND' || error.name === 'RestError' || error.code === 'ETIMEDOUT') {
      console.warn('⚠️  Azure Blob Storage upload failed - using local fallback');
      useLocalFallback = true;
      
      const fileDir = path.join(localStoragePath, 'conversations', conversationId, fileId);
      await mkdirp(fileDir);
      const filePath = path.join(fileDir, fileName);
      fs.writeFileSync(filePath, buffer);
      
      const localUrl = `/local-files/conversations/${conversationId}/${fileId}/${fileName}`;
      console.log(`✅ File uploaded to local storage (fallback): ${localUrl}`);
      return localUrl;
    }

    console.error('❌ Error uploading file to blob storage:', error);
    throw new Error(`Failed to upload file: ${(error as Error).message}`);
  }
};

/**
 * Download file with automatic fallback
 */
export const downloadFile = async (fileUrl: string): Promise<Buffer> => {
  // Check if it's a local file URL
  if (fileUrl.startsWith('/local-files/')) {
    const filePath = path.join(localStoragePath, fileUrl.replace('/local-files/', ''));
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    throw new Error(`Local file not found: ${filePath}`);
  }

  // Azure Blob Storage download
  if (!blobServiceClient) {
    throw new Error('Azure Blob Storage not available and file is not local');
  }

  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const containerName = pathParts[0];
    const blobName = pathParts.slice(1).join('/');

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    const downloadResponse = await blobClient.download();
    
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody as NodeJS.ReadableStream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error('❌ Error downloading file from blob storage:', error);
    throw new Error(`Failed to download file: ${(error as Error).message}`);
  }
};

/**
 * Delete file with automatic fallback
 */
export const deleteFile = async (conversationId: string, fileId: string, fileName: string): Promise<void> => {
  // Local storage
  if (useLocalFallback || !containerClient) {
    try {
      const filePath = path.join(localStoragePath, 'conversations', conversationId, fileId, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted local file: ${filePath}`);
      }
      return;
    } catch (error) {
      console.error('❌ Error deleting local file:', error);
      // Don't throw - file might already be deleted
      return;
    }
  }

  // Azure Blob Storage
  try {
    const blobName = `conversations/${conversationId}/${fileId}/${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.delete();
    console.log(`🗑️  Deleted blob: ${blobName}`);
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log(`File not found: ${conversationId}/${fileId}/${fileName}`);
    } else {
      console.error('❌ Error deleting file from blob storage:', error);
      // Don't throw - file might already be deleted
    }
  }
};

/**
 * Delete all files for a conversation
 */
export const deleteConversationFiles = async (conversationId: string): Promise<void> => {
  // Local storage
  if (useLocalFallback || !containerClient) {
    try {
      const conversationDir = path.join(localStoragePath, 'conversations', conversationId);
      if (fs.existsSync(conversationDir)) {
        fs.rmSync(conversationDir, { recursive: true, force: true });
        console.log(`🗑️  Deleted local conversation files: ${conversationDir}`);
      }
      return;
    } catch (error) {
      console.error('❌ Error deleting local conversation files:', error);
      return;
    }
  }

  // Azure Blob Storage
  try {
    const prefix = `conversations/${conversationId}/`;
    
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
      await blockBlobClient.delete();
      console.log(`🗑️  Deleted blob: ${blob.name}`);
    }
  } catch (error) {
    console.error('❌ Error deleting conversation files:', error);
    // Don't throw - continue with other operations
  }
};

export { containerClient };

