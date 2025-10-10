import type { Request, Response } from 'express'

import type { UploadedFile } from '../middlewares/upload.middleware'
import { FileStorage } from '../services/fileStorage.service'
import { RAGService } from '../services/rag.service'
import { UploadService } from '../services/upload.service'
import { VectorDatabaseService } from '../services/vectorDatabase.service'
import type { ChatMessage, ChatSession } from '../types/types'
import httpResponse from '../utils/httpResponse'
import logger from '../utils/logger'

export class DocumentAnalysisController {
  private storage: FileStorage
  private uploadService: UploadService
  private vectorService: VectorDatabaseService
  private ragService: RAGService

  constructor() {
    this.storage = new FileStorage()
    this.uploadService = new UploadService()
    this.vectorService = new VectorDatabaseService()
    this.ragService = new RAGService()
  }

  /**
   * Upload and process document
   */
  public uploadDocument = async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        httpResponse(req, res, 400, 'No file uploaded')
        return
      }

      const { groupId } = req.body as { groupId?: string }

      // Process upload using upload service
      const result = await this.uploadService.processUpload(
        req.file as UploadedFile,
        {
          groupId,
          processDocument: true,
          validateFile: true,
        }
      )

      if (result.error) {
        httpResponse(req, res, 400, result.error)
        return
      }

      httpResponse(
        req,
        res,
        200,
        'Document uploaded and processed successfully',
        {
          document: {
            id: result.document.id,
            name: result.document.name,
            type: result.document.type,
            uploadedAt: result.document.uploadedAt,
            size: result.document.size,
            groupId: result.document.groupId,
          },
          processed: result.processed,
          chunks: result.chunks,
        }
      )
    } catch (error) {
      logger.error('Document upload failed:', error)
      httpResponse(req, res, 500, 'Failed to upload document')
    }
  }

  /**
   * Upload multiple documents
   */
  public uploadMultipleDocuments = async (req: Request, res: Response) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        httpResponse(req, res, 400, 'No files uploaded')
        return
      }

      const { groupId } = req.body as { groupId?: string }

      // Process multiple uploads
      const results = await this.uploadService.processMultipleUploads(
        req.files as UploadedFile[],
        {
          groupId,
          processDocument: true,
          validateFile: true,
        }
      )

      const successful = results.filter((r) => !r.error)
      const failed = results.filter((r) => r.error)

      httpResponse(req, res, 200, 'Multiple documents upload completed', {
        successful: successful.length,
        failed: failed.length,
        results: results.map((result) => ({
          document: result.document.id
            ? {
                id: result.document.id,
                name: result.document.name,
                type: result.document.type,
                size: result.document.size,
              }
            : null,
          processed: result.processed,
          chunks: result.chunks,
          error: result.error,
        })),
      })
    } catch (error) {
      logger.error('Multiple documents upload failed:', error)
      httpResponse(req, res, 500, 'Failed to upload documents')
    }
  }

  /**
   * Get upload statistics
   */
  public getUploadStats = (req: Request, res: Response) => {
    try {
      const stats = this.uploadService.getUploadStats()
      httpResponse(req, res, 200, 'Upload statistics retrieved', stats)
    } catch (error) {
      logger.error('Failed to get upload stats:', error)
      httpResponse(req, res, 500, 'Failed to get upload statistics')
    }
  }

  /**
   * Create a new chat session
   */
  public createChatSession = (req: Request, res: Response) => {
    try {
      const { documentIds, title, systemPromptId } = req.body as {
        documentIds?: string[]
        title?: string
        systemPromptId?: string
      }

      if (
        !documentIds ||
        !Array.isArray(documentIds) ||
        documentIds.length === 0
      ) {
        httpResponse(req, res, 400, 'Document IDs are required')
        return
      }

      // Verify documents exist
      const documents = this.storage.getAllDocuments()
      const validDocuments = documents.filter((doc) =>
        documentIds.includes(doc.id)
      )

      if (validDocuments.length !== documentIds.length) {
        httpResponse(req, res, 400, 'One or more document IDs are invalid')
        return
      }

      // Get system prompt if specified
      let systemPrompt = ''
      if (systemPromptId) {
        const prompts = this.storage.getAllSystemPrompts()
        const foundPrompt = prompts.find((p) => p.id === systemPromptId)
        if (foundPrompt) {
          systemPrompt = foundPrompt.content
        }
      }

      // Create chat session
      const chatSession: Omit<ChatSession, 'id'> = {
        title: title || `Chat with ${validDocuments.length} document(s)`,
        documentIds,
        messages: [],
        systemPrompt,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      }

      const savedSession = this.storage.saveChatSession(chatSession)

      httpResponse(req, res, 200, 'Chat session created successfully', {
        session: savedSession,
      })
    } catch (error) {
      logger.error('Chat session creation failed:', error)
      httpResponse(req, res, 500, 'Failed to create chat session')
    }
  }

  /**
   * Send message to chat session
   */
  public sendMessage = async (req: Request, res: Response) => {
    try {
      const { chatId } = req.params
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { message } = req.body

      if (!message) {
        httpResponse(req, res, 400, 'Message is required')
        return
      }

      // Get chat session
      const session = this.storage.getChatSession(chatId)
      if (!session) {
        httpResponse(req, res, 404, 'Chat session not found')
        return
      }

      // Generate response using RAG
      const ragResponse = await this.ragService.generateResponse({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        message: message,
        docIds: session.documentIds,
        customSystemPrompt: session.systemPrompt,
      })

      // Create user message
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        content: message,
        timestamp: new Date(),
      }

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: ragResponse.answer,
        timestamp: new Date(),
        referencedChunkIds: ragResponse.referencedChunks.map((c) => c.chunkId),
      }

      // Update session with new messages
      const updatedMessages = [
        ...session.messages,
        userMessage,
        assistantMessage,
      ]
      this.storage.updateChatSession(chatId, {
        messages: updatedMessages,
        updatedAt: new Date(),
      })

      httpResponse(req, res, 200, 'Message sent successfully', {
        userMessage,
        assistantMessage,
        referencedChunks: ragResponse.referencedChunks,
      })
    } catch (error) {
      logger.error('Message sending failed:', error)
      httpResponse(req, res, 500, 'Failed to send message')
    }
  }

  /**
   * Get chat session details
   */
  public getChatSession = (req: Request, res: Response) => {
    try {
      const { chatId } = req.params

      const session = this.storage.getChatSession(chatId)
      if (!session) {
        httpResponse(req, res, 404, 'Chat session not found')
        return
      }

      httpResponse(req, res, 200, 'Chat session retrieved successfully', {
        session,
      })
    } catch (error) {
      logger.error('Failed to get chat session:', error)
      httpResponse(req, res, 500, 'Failed to get chat session')
    }
  }

  /**
   * List chat sessions for documents
   */
  public listChatSessions = (req: Request, res: Response) => {
    try {
      const { documentId } = req.query

      let sessions: ChatSession[] = []

      if (documentId) {
        sessions = this.storage.getChatSessionsByDocumentId(
          documentId as string
        )
      } else {
        // For now, we'll need to implement a method to get all sessions
        // This is a limitation of our simple file storage approach
        sessions = []
      }

      // Sort by updated date (most recent first)
      const sortedSessions = sessions.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )

      const sessionSummaries = sortedSessions.map((s) => ({
        id: s.id,
        title: s.title,
        documentIds: s.documentIds,
        messageCount: s.messages.length,
        lastMessage:
          s.messages[s.messages.length - 1]?.content || 'No messages',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }))

      httpResponse(req, res, 200, 'Chat sessions retrieved successfully', {
        sessions: sessionSummaries,
        total: sessionSummaries.length,
      })
    } catch (error) {
      logger.error('Failed to list chat sessions:', error)
      httpResponse(req, res, 500, 'Failed to list chat sessions')
    }
  }

  /**
   * List documents
   */
  public listDocuments = (req: Request, res: Response) => {
    try {
      const { groupId } = req.query

      let allDocuments = this.storage.getAllDocuments()

      // Filter by group if specified
      if (groupId) {
        allDocuments = allDocuments.filter((doc) => doc.groupId === groupId)
      }

      // Sort by upload date (most recent first)
      const sortedDocuments = allDocuments
        .sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
        )
        .map((doc) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          uploadedAt: doc.uploadedAt,
          size: doc.size,
          groupId: doc.groupId,
        }))

      httpResponse(req, res, 200, 'Documents retrieved successfully', {
        documents: sortedDocuments,
        total: sortedDocuments.length,
      })
    } catch (error) {
      logger.error('Failed to list documents:', error)
      httpResponse(req, res, 500, 'Failed to list documents')
    }
  }

  /**
   * Delete document
   */
  public deleteDocument = (req: Request, res: Response) => {
    try {
      const { documentId } = req.params

      // Check if document exists
      const document = this.storage.getDocument(documentId)
      if (!document) {
        httpResponse(req, res, 404, 'Document not found')
        return
      }

      // Delete chunks and vectors
      this.storage.deleteChunksByDocumentId(documentId)
      this.vectorService.removeDocumentVectors(documentId)

      // Remove from document groups
      const groups = this.storage.getAllDocumentGroups()
      for (const group of groups) {
        if (group.documentIds.includes(documentId)) {
          const updatedDocumentIds = group.documentIds.filter(
            (id) => id !== documentId
          )
          this.storage.updateDocumentGroup(group.id, {
            documentIds: updatedDocumentIds,
            updatedAt: new Date(),
          })
        }
      }

      // Delete document
      this.storage.deleteDocument(documentId)

      httpResponse(req, res, 200, 'Document deleted successfully', {})
    } catch (error) {
      logger.error('Failed to delete document:', error)
      httpResponse(req, res, 500, 'Failed to delete document')
    }
  }

  /**
   * List system prompts
   */
  public listSystemPrompts = (req: Request, res: Response) => {
    try {
      const { type } = req.query

      const prompts = this.storage.getAllSystemPrompts()

      let filteredPrompts = prompts
      if (type) {
        filteredPrompts = prompts.filter((p) => p.type === type)
      }

      const sortedPrompts = filteredPrompts.sort((a, b) => {
        // Default prompts first, then by name
        if (a.isDefault !== b.isDefault) {
          return a.isDefault ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      httpResponse(req, res, 200, 'System prompts retrieved successfully', {
        prompts: sortedPrompts,
        total: sortedPrompts.length,
      })
    } catch (error) {
      logger.error('Failed to list system prompts:', error)
      httpResponse(req, res, 500, 'Failed to list system prompts')
    }
  }
}
