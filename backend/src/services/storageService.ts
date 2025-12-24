// Azure Blob Storage service for document uploads with local fallback
// Handles file upload, retrieval, and deletion
import { BlobServiceClient } from '@azure/storage-blob';
import * as fs from 'fs';
import * as path from 'path';
import { mkdirp } from 'mkdirp';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const localFilesBasePath = path.join(process.cwd(), 'tmp', 'uploads');
const localProjectFilesPath = path.join(localFilesBasePath, 'rag-documents');
let useLocalFallback = false;
let localStoragePath = localProjectFilesPath;

if (!connectionString || connectionString.trim() === '' || connectionString.includes('your-')) {
  console.warn('⚠️  Azure Storage connection string not configured - using local storage fallback');
  useLocalFallback = true;
}

const blobServiceClient = (connectionString && connectionString.trim() !== '' && !connectionString.includes('your-'))
  ? BlobServiceClient.fromConnectionString(connectionString)
  : null;

// Container names
const DOCUMENTS_CONTAINER = 'user-documents';

/**
 * Upload a file to Azure Blob Storage (or local fallback)
 * Returns the blob URL (or local file path)
 */
export const uploadFile = async (
  file: Buffer,
  fileName: string,
  userId: string,
  containerName: string = DOCUMENTS_CONTAINER
): Promise<string> => {
  // Local storage fallback
  if (useLocalFallback || !blobServiceClient) {
    try {
      const fileDir = path.join(localStoragePath, containerName, userId);
      await mkdirp(fileDir);
      const timestamp = Date.now();
      const filePath = path.join(fileDir, `${timestamp}-${fileName}`);
      fs.writeFileSync(filePath, file);
      
      // Return local URL path
      const localUrl = `/local-files/rag-documents/${containerName}/${userId}/${timestamp}-${fileName}`;
      console.log(`✅ RAG file uploaded to local storage: ${localUrl}`);
      return localUrl;
    } catch (error) {
      console.error('❌ Error uploading file to local storage:', error);
      throw new Error(`Failed to upload file locally: ${(error as Error).message}`);
    }
  }

  // Azure Blob Storage
  try {
    // Get container client
    const containerClient = blobServiceClient.getContainerClient(containerName);

    // Ensure container exists
    await containerClient.createIfNotExists();

    // Generate unique blob name
    const blobName = `${userId}/${Date.now()}-${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload file
    await blockBlobClient.upload(file, file.length, {
      blobHTTPHeaders: {
        blobContentType: getContentType(fileName),
      },
    });

    console.log(`✅ RAG file uploaded to Azure Blob Storage: ${blobName}`);
    return blockBlobClient.url;
  } catch (error: any) {
    // On any Azure error, fallback to local storage
    if (error.code === 'ENOTFOUND' || error.name === 'RestError' || error.code === 'ETIMEDOUT') {
      console.warn('⚠️  Azure Blob Storage upload failed - using local fallback');
      useLocalFallback = true;
      
      const fileDir = path.join(localStoragePath, containerName, userId);
      await mkdirp(fileDir);
      const timestamp = Date.now();
      const filePath = path.join(fileDir, `${timestamp}-${fileName}`);
      fs.writeFileSync(filePath, file);
      
      const localUrl = `/local-files/rag-documents/${containerName}/${userId}/${timestamp}-${fileName}`;
      console.log(`✅ RAG file uploaded to local storage (fallback): ${localUrl}`);
      return localUrl;
    }

    console.error('❌ File upload error:', error);
    throw new Error('Failed to upload file');
  }
};

/**
 * Download a file from Azure Blob Storage (or local fallback)
 * Returns the file buffer
 */
export const downloadFile = async (blobUrl: string): Promise<Buffer> => {
  // Check if it's a local file URL
  if (blobUrl.startsWith('/local-files/')) {
    const filePath = path.join(
      process.cwd(),
      'tmp',
      'uploads',
      blobUrl.replace('/local-files/', '')
    );
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    throw new Error(`Local file not found: ${filePath}`);
  }

  // Azure Blob Storage download
  if (!blobServiceClient) {
    throw new Error('Azure Storage not configured and file is not local');
  }

  try {
    // Parse blob URL to extract container and blob name
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const containerName = pathParts[0];
    const blobName = pathParts.slice(1).join('/');

    // Get blob client
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    // Download blob
    const downloadResponse = await blobClient.download();
    
    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody as NodeJS.ReadableStream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error('❌ File download error:', error);
    throw new Error('Failed to download file');
  }
};

/**
 * Delete a file from Azure Blob Storage (or local fallback)
 */
export const deleteFile = async (blobUrl: string): Promise<void> => {
  // Check if it's a local file URL
  if (blobUrl.startsWith('/local-files/')) {
    try {
      const filePath = path.join(
        process.cwd(),
        'tmp',
        'uploads',
        blobUrl.replace('/local-files/', '')
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted local RAG file: ${filePath}`);
      }
      return;
    } catch (error) {
      console.error('❌ Error deleting local file:', error);
      // Don't throw - file might already be deleted
      return;
    }
  }

  // Azure Blob Storage
  if (!blobServiceClient) {
    console.warn('⚠️  Azure Storage not configured, cannot delete file');
    return;
  }

  try {
    // Parse blob URL
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const containerName = pathParts[0];
    const blobName = pathParts.slice(1).join('/');

    // Delete blob
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);
    await blobClient.delete();
    console.log(`🗑️  Deleted blob: ${blobName}`);
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log(`File not found: ${blobUrl}`);
    } else {
      console.error('❌ File deletion error:', error);
      // Don't throw - file might already be deleted
    }
  }
};

/**
 * Get content type based on file extension
 */
const getContentType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const contentTypes: { [key: string]: string } = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    csv: 'text/csv',
    md: 'text/markdown',
    html: 'text/html',
    json: 'application/json',
    xml: 'application/xml',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };

  return contentTypes[ext || ''] || 'application/octet-stream';
};

/**
 * Check if file is an image
 */
export const isImageFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  return imageExtensions.includes(ext || '');
};

/**
 * Extract text from uploaded file
 * Handles all file types - text extraction for RAG, images flagged for vision models
 */
export const extractTextFromFile = async (
  fileBuffer: Buffer,
  fileName: string
): Promise<string> => {
  const ext = fileName.split('.').pop()?.toLowerCase();

  try {
    switch (ext) {
      case 'txt':
      case 'md':
      case 'csv':
      case 'log':
      case 'xml':
      case 'yaml':
      case 'yml':
        return fileBuffer.toString('utf-8');

      case 'html':
      case 'htm':
        const html = fileBuffer.toString('utf-8');
        return html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      case 'json':
        const json = JSON.parse(fileBuffer.toString('utf-8'));
        return JSON.stringify(json, null, 2);

      case 'pdf':
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(fileBuffer);
        return pdfData.text || '';

      case 'docx':
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return result.value || '';

      case 'py':
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'java':
      case 'cpp':
      case 'c':
      case 'cs':
      case 'go':
      case 'rs':
      case 'php':
      case 'rb':
      case 'swift':
      case 'kt':
      case 'scala':
      case 'r':
      case 'sql':
      case 'sh':
      case 'bash':
        return fileBuffer.toString('utf-8');

      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'bmp':
      case 'svg':
        return `[IMAGE:${fileName}]`;

      default:
        return fileBuffer.toString('utf-8');
    }
  } catch (error: any) {
    console.error('Text extraction error:', error);
    return `[ERROR: Failed to process ${fileName}]`;
  }
};

