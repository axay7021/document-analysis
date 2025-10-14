import fs from 'fs'
import path from 'path'

import type { UploadedFile } from '../middlewares/upload.middleware'
import type { Document } from '../types/types'
import logger from '../utils/logger'
import { DocumentIngestionService } from './documentIngestion.service'
import { FileStorage } from './fileStorage.service'

export interface UploadOptions {
  userId: string
  agentIds?: string[]
  groupId?: string
  processDocument?: boolean
  validateFile?: boolean
}

export interface UploadResult {
  document: Document
  processed: boolean
  chunks?: number
  error?: string
}

export class UploadService {
  private storage: FileStorage
  private ingestionService: DocumentIngestionService

  constructor() {
    this.storage = new FileStorage()
    this.ingestionService = new DocumentIngestionService()
  }

  /**
   * Process uploaded file and create document record
   */
  async processUpload(
    file: UploadedFile,
    options: UploadOptions
  ): Promise<UploadResult> {
    const {
      userId,
      agentIds = [],
      processDocument = true,
      validateFile = true,
    } = options

    try {
      // Validate file if requested
      if (validateFile) {
        this.validateUploadedFile(file)
      }

      // Create document record
      const document: Omit<Document, 'id'> = {
        userId,
        agentIds,
        name: file.originalname,
        content: '', // Will be filled by ingestion service
        type: this.determineDocumentType(file.originalname),
        uploadedAt: new Date(),
        updatedAt: new Date(),
        size: file.size,
        metadata: {
          filePath: file.path,
          mimeType: file.mimetype,
          originalName: file.originalname,
        },
      }

      // Save document to storage
      const savedDocument = this.storage.saveDocument(document)

      let processed = false
      let chunks = 0

      // Process document if requested
      if (processDocument) {
        try {
          // Use full ingestion pipeline instead of just text extraction
          const chunksWithEmbeddings =
            await this.ingestionService.ingestDocument(savedDocument)
          processed = true
          chunks = chunksWithEmbeddings.length

          logger.info(
            `Document processed successfully: ${savedDocument.id}, ${chunks} chunks created`
          )
        } catch (error) {
          logger.error(`Failed to process document ${savedDocument.id}:`, error)
          // Don't fail the upload, just mark as not processed
        }
      }

      return {
        document: savedDocument,
        processed,
        chunks,
      }
    } catch (error) {
      logger.error('Upload processing failed:', error)

      // Clean up file if it exists
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path)
        } catch (cleanupError) {
          logger.error('Failed to cleanup uploaded file:', cleanupError)
        }
      }

      throw error
    }
  }

  /**
   * Process multiple files
   */
  async processMultipleUploads(
    files: UploadedFile[],
    options: UploadOptions
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = []

    for (const file of files) {
      try {
        const result = await this.processUpload(file, options)
        results.push(result)
      } catch (error) {
        logger.error(`Failed to process file ${file.originalname}:`, error)
        results.push({
          document: {} as Document,
          processed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return results
  }

  /**
   * Validate uploaded file
   */
  private validateUploadedFile(file: UploadedFile): void {
    // Check file size
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 10MB limit')
    }

    // Check file type
    const allowedTypes = ['.pdf', '.txt', '.md']
    const fileExt = path.extname(file.originalname).toLowerCase()
    if (!allowedTypes.includes(fileExt)) {
      throw new Error(
        'Invalid file type. Only PDF, TXT, and MD files are allowed'
      )
    }

    // Check if file exists
    if (!fs.existsSync(file.path)) {
      throw new Error('Uploaded file not found')
    }

    // Check file is readable
    try {
      fs.accessSync(file.path, fs.constants.R_OK)
    } catch {
      throw new Error('Uploaded file is not readable')
    }
  }

  /**
   * Determine document type from filename
   */
  private determineDocumentType(filename: string): 'pdf' | 'text' {
    const ext = path.extname(filename).toLowerCase()
    return ext === '.pdf' ? 'pdf' : 'text'
  }

  /**
   * Clean up temporary files
   */
  cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        logger.debug(`Cleaned up temporary file: ${filePath}`)
      }
    } catch (error) {
      logger.error(`Failed to cleanup temporary file ${filePath}:`, error)
    }
  }

  /**
   * Get upload statistics
   */
  getUploadStats(): {
    totalDocuments: number
    totalSize: number
    documentsByType: Record<string, number>
  } {
    const documents = this.storage.getAllDocuments()

    return {
      totalDocuments: documents.length,
      totalSize: documents.reduce((sum, doc) => sum + doc.size, 0),
      documentsByType: documents.reduce<Record<string, number>>((acc, doc) => {
        acc[doc.type] = (acc[doc.type] || 0) + 1
        return acc
      }, {}),
    }
  }
}
