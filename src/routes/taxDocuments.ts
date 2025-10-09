import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { taxDocumentService } from '../services/taxDocumentService';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { upload, handleUploadError } from '../middleware/upload';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

const router = Router();

// Validation middleware
const validateDocumentUpload = [
  body('document_type').notEmpty().withMessage('Document type is required'),
  body('tax_year').isInt({ min: 2000, max: 2030 }).withMessage('Tax year must be between 2000 and 2030')
];

// Helper function to handle validation errors
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
    return;
  }
  next();
};

// POST /api/tax-documents/upload/:memberId
router.post('/upload/:memberId', 
  authenticateToken,
  requireAdmin,
  upload.single('file'),
  handleUploadError,
  validateDocumentUpload,
  handleValidationErrors,
  asyncHandler(async (req: Request, res: Response) => {
    const memberId = parseInt(req.params.memberId);
    const { document_type, tax_year } = req.body;
    const uploadedBy = req.user!.user_id;

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a file to upload'
      });
    }

    const documentData = {
      member_id: memberId,
      file_name: req.file.filename,
      original_name: req.file.originalname,
      file_path: req.file.path,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      document_type,
      tax_year: parseInt(tax_year),
      uploaded_by: uploadedBy
    };

    const document = await taxDocumentService.createDocument(documentData);

    return res.status(201).json({
      message: 'Document uploaded successfully',
      data: document
    });
  })
);

// GET /api/tax-documents/member/:memberId
router.get('/member/:memberId', 
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const memberId = parseInt(req.params.memberId);
    const documents = await taxDocumentService.getDocumentsByMember(memberId);

    res.json({
      message: 'Documents retrieved successfully',
      data: documents
    });
  })
);

// GET /api/tax-documents/:documentId/download
router.get('/:documentId/download', 
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.documentId);
    const { document, filePath } = await taxDocumentService.getDocumentFile(documentId);

    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${document.original_name}"`);
    res.setHeader('Content-Type', document.file_type);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      logger.error('Error streaming file:', error);
      res.status(500).json({
        error: 'File streaming error',
        message: 'Unable to download the file'
      });
    });
  })
);

// DELETE /api/tax-documents/:documentId
router.delete('/:documentId', 
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const documentId = parseInt(req.params.documentId);
    const uploadedBy = req.user!.user_id;

    await taxDocumentService.deleteDocument(documentId, uploadedBy);

    res.json({
      message: 'Document deleted successfully'
    });
  })
);

// GET /api/tax-documents/member/:memberId/year/:year
router.get('/member/:memberId/year/:year', 
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const memberId = parseInt(req.params.memberId);
    const year = parseInt(req.params.year);
    const documents = await taxDocumentService.getDocumentsByYear(memberId, year);

    res.json({
      message: 'Documents retrieved successfully',
      data: documents
    });
  })
);

// GET /api/tax-documents/member/:memberId/type/:type
router.get('/member/:memberId/type/:type', 
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const memberId = parseInt(req.params.memberId);
    const documentType = req.params.type;
    const documents = await taxDocumentService.getDocumentsByType(memberId, documentType);

    res.json({
      message: 'Documents retrieved successfully',
      data: documents
    });
  })
);

export { router as taxDocumentRoutes };
