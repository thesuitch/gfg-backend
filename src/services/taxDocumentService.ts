import pool from '../database/connection';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface TaxDocument {
  id: number;
  member_id: number;
  file_name: string;
  original_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  document_type: string;
  tax_year: number;
  uploaded_by: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTaxDocumentRequest {
  member_id: number;
  file_name: string;
  original_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  document_type: string;
  tax_year: number;
  uploaded_by: number;
}

export class TaxDocumentService {
  async createDocument(documentData: CreateTaxDocumentRequest): Promise<TaxDocument> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO tax_documents (member_id, file_name, original_name, file_path, file_type, file_size, document_type, tax_year, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        documentData.member_id,
        documentData.file_name,
        documentData.original_name,
        documentData.file_path,
        documentData.file_type,
        documentData.file_size,
        documentData.document_type,
        documentData.tax_year,
        documentData.uploaded_by
      ]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getDocumentsByMember(memberId: number): Promise<TaxDocument[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM tax_documents 
        WHERE member_id = $1 
        ORDER BY created_at DESC
      `, [memberId]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  async getDocumentById(documentId: number): Promise<TaxDocument | null> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM tax_documents 
        WHERE id = $1
      `, [documentId]);

      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async deleteDocument(documentId: number, uploadedBy: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      // Get document info first
      const document = await this.getDocumentById(documentId);
      if (!document) {
        throw createError('Document not found', 404);
      }

      // Check if user has permission to delete (uploaded by them or admin)
      // For now, we'll allow deletion by the uploader
      if (document.uploaded_by !== uploadedBy) {
        throw createError('Unauthorized to delete this document', 403);
      }

      // Delete from database
      await client.query('DELETE FROM tax_documents WHERE id = $1', [documentId]);

      // Delete file from filesystem
      try {
        const fullPath = path.join(process.cwd(), document.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (fileError) {
        logger.error('Error deleting file from filesystem:', fileError);
        // Don't throw error here as the database record is already deleted
      }
    } finally {
      client.release();
    }
  }

  async getDocumentFile(documentId: number): Promise<{ document: TaxDocument; filePath: string }> {
    const document = await this.getDocumentById(documentId);
    if (!document) {
      throw createError('Document not found', 404);
    }

    const fullPath = path.join(process.cwd(), document.file_path);
    if (!fs.existsSync(fullPath)) {
      throw createError('File not found on disk', 404);
    }

    return { document, filePath: fullPath };
  }

  async getDocumentsByYear(memberId: number, year: number): Promise<TaxDocument[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM tax_documents 
        WHERE member_id = $1 AND tax_year = $2
        ORDER BY created_at DESC
      `, [memberId, year]);

      return result.rows;
    } finally {
      client.release();
    }
  }

  async getDocumentsByType(memberId: number, documentType: string): Promise<TaxDocument[]> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM tax_documents 
        WHERE member_id = $1 AND document_type = $2
        ORDER BY created_at DESC
      `, [memberId, documentType]);

      return result.rows;
    } finally {
      client.release();
    }
  }
}

export const taxDocumentService = new TaxDocumentService();
