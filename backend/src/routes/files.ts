// File upload routes
import { Router, Response } from 'express';
import multer from 'multer';
import { authenticateJWT } from '../middleware/auth';
import { FileParserService } from '../services/fileParserService';
import { MemoryService } from '../services/memoryService';
import { uploadFile } from '../config/fileStorage';
import { Conversation } from '../models';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max (validated per tier)
    files: 20,
  },
});

/**
 * Upload files to a conversation
 * POST /api/files/upload
 */
router.post(
  '/upload',
  authenticateJWT as any,
  upload.array('files', 20),
  async (req: any, res: Response) => {
    try {
      const { conversationId } = req.body;
      const user = req.user;
      const files = req.files as Express.Multer.File[];

      // Validation
      if (!conversationId || !files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Conversation ID and at least one file required',
        });
      }

      // Get conversation to check memory usage
      const conversation = await Conversation.findById(user.rowKey, conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
      }

      // Validate memory capacity
      const memoryCheck = MemoryService.checkMemoryCapacity(
        conversation.totalMemoryUsed || 0,
        files,
        user.tier || 'free'
      );

      if (!memoryCheck.available) {
        return res.status(400).json({
          success: false,
          error: `Memory full. Only ${MemoryService.formatBytes(memoryCheck.remaining)} available`,
        });
      }

      // Process each file
      const uploadedFiles = [];
      let totalNewMemory = 0;

      for (const file of files) {
        try {
          // Validate file size per tier
          const sizeValidation = MemoryService.validateFileSize(file.size, user.tier || 'free');
          if (!sizeValidation.valid) {
            uploadedFiles.push({
              fileName: file.originalname,
              status: 'error',
              error: sizeValidation.error,
            });
            continue;
          }

          // Parse file content
          const parsed = await FileParserService.parse(file.buffer, file.mimetype);

          // Determine file type
          const isImage = file.mimetype.startsWith('image/');

          // Upload to blob storage
          const fileId = `${Date.now()}-${Math.random()}`;
          const blobUrl = await uploadFile(conversationId, fileId, file.originalname, file.buffer);

          uploadedFiles.push({
            id: fileId,
            fileName: file.originalname,
            fileType: file.mimetype,
            size: file.size,
            type: isImage ? 'image' : 'text',
            content: isImage ? undefined : parsed.content,
            blobUrl,
            status: 'uploaded',
            estimatedTokens: parsed.metadata.estimatedTokens,
          });

          totalNewMemory += file.size;
        } catch (error) {
          uploadedFiles.push({
            fileName: file.originalname,
            status: 'error',
            error: `Failed to parse: ${(error as Error).message}`,
          });
        }
      }

      // Update conversation memory usage
      if (totalNewMemory > 0) {
        await Conversation.update(user.rowKey, conversationId, {
          totalMemoryUsed: (conversation.totalMemoryUsed || 0) + totalNewMemory,
        });
      }

      res.json({
        success: true,
        files: uploadedFiles,
        conversationMemory: {
          used: (conversation.totalMemoryUsed || 0) + totalNewMemory,
          capacity: MemoryService.getCapacity(user.tier || 'free'),
        },
      });
    } catch (error) {
      console.error('❌ File upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload files',
      });
    }
  }
);

export default router;
