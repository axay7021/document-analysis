import { AgentModel, DocumentModel } from '../models'
import type { Agent, Document } from '../types/types'
import logger from '../utils/logger'
import { DocumentIngestionService } from './documentIngestion.service'
import { UploadService } from './upload.service'

export interface CreateAgentRequest {
  userId: string
  name: string
  description?: string
  systemPrompt: string
  documentIds?: string[]
  config?: {
    temperature?: number
    maxTokens?: number
    model?: string
  }
  files?: Express.Multer.File[]
}

export interface UpdateAgentRequest {
  name?: string
  description?: string
  systemPrompt?: string
  role?: string
  documentIds?: string[]
  config?: {
    temperature?: number
    maxTokens?: number
    model?: string
  }
  isActive?: boolean
}

export class AgentService {
  public uploadService: UploadService
  private ingestionService: DocumentIngestionService

  constructor() {
    this.uploadService = new UploadService()
    this.ingestionService = new DocumentIngestionService()
  }

  /**
   * Create a new agent for a user
   */
  createAgent(agentData: CreateAgentRequest): Agent {
    try {
      // Validate and filter documents if provided
      const validDocumentIds: string[] = []
      if (agentData.documentIds && agentData.documentIds.length > 0) {
        for (const documentId of agentData.documentIds) {
          const document = DocumentModel.findOne({ id: documentId })
          if (document && document.userId === agentData.userId) {
            validDocumentIds.push(documentId)
          } else {
            logger.warn(
              `Document ${documentId} not found or access denied for user ${agentData.userId}`
            )
          }
        }
      }

      const newAgent: Omit<Agent, 'id'> = {
        userId: agentData.userId,
        name: agentData.name,
        description: agentData.description,
        systemPrompt: agentData.systemPrompt,
        documentIds: validDocumentIds,
        config: agentData.config || {
          temperature: 0.7,
          maxTokens: 2048,
          model: 'gpt-3.5-turbo',
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const savedAgent = AgentModel.create(newAgent)

      // Update documents to include this agent in their agentIds
      for (const documentId of validDocumentIds) {
        const document = DocumentModel.findOne({ id: documentId })
        if (document) {
          const updatedAgentIds = document.agentIds.includes(savedAgent.id)
            ? document.agentIds
            : [...document.agentIds, savedAgent.id]

          DocumentModel.findOneAndUpdate(
            { id: documentId },
            {
              agentIds: updatedAgentIds,
              updatedAt: new Date(),
            }
          )
        }
      }

      logger.info(
        `Agent created successfully: ${savedAgent.id} with ${validDocumentIds.length} documents`
      )
      return savedAgent
    } catch (error) {
      logger.error('Error creating agent:', error)
      throw new Error('Failed to create agent')
    }
  }

  /**
   * Create a new agent with uploaded files
   */
  async createAgentWithFiles(agentData: CreateAgentRequest): Promise<{
    agent: Agent
    documents: Document[]
    uploadResults: Array<{
      success: boolean
      document?: Document
      error?: string
    }>
  }> {
    try {
      const { files, ...agentInfo } = agentData
      const uploadResults: Array<{
        success: boolean
        document?: Document
        error?: string
      }> = []
      const documentIds: string[] = []

      // First, upload and process all files if provided
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            const uploadResult = await this.uploadService.processUpload(file, {
              userId: agentData.userId,
              processDocument: true,
              validateFile: true,
            })

            documentIds.push(uploadResult.document.id)
            uploadResults.push({
              success: true,
              document: uploadResult.document,
            })
          } catch (error) {
            logger.error(`Failed to upload file ${file.originalname}:`, error)
            uploadResults.push({
              success: false,
              error: error instanceof Error ? error.message : 'Upload failed',
            })
          }
        }
      }

      // Add any existing document IDs to the list
      if (agentInfo.documentIds) {
        documentIds.push(...agentInfo.documentIds)
      }

      // Create the agent with all document IDs
      const agent = this.createAgent({
        ...agentInfo,
        documentIds,
      })

      // Get the final document list
      const documents = this.getAgentDocuments(agent.id, agentData.userId)

      logger.info(
        `Agent created with files: ${agent.id}, ${uploadResults.length} files processed, ${documents.length} documents associated`
      )

      return {
        agent,
        documents,
        uploadResults,
      }
    } catch (error) {
      logger.error('Error creating agent with files:', error)
      throw new Error('Failed to create agent with files')
    }
  }

  /**
   * Get all agents for a specific user
   */
  getAgentsByUserId(userId: string): Agent[] {
    try {
      const agents = AgentModel.findByUserId(userId)
      return agents.filter((agent) => agent.isActive)
    } catch (error) {
      logger.error('Error fetching user agents:', error)
      throw new Error('Failed to fetch agents')
    }
  }

  /**
   * Get a specific agent by ID (with user authorization check)
   */
  getAgentById(agentId: string, userId: string): Agent | null {
    try {
      const agent = AgentModel.findById(agentId)

      if (!agent || agent.userId !== userId) {
        return null
      }

      return agent
    } catch (error) {
      logger.error('Error fetching agent:', error)
      throw new Error('Failed to fetch agent')
    }
  }

  /**
   * Find agent by name (for @mentions)
   */
  getAgentByName(agentName: string, userId: string): Agent | null {
    try {
      const userAgents = AgentModel.findByUserId(userId)
      return (
        userAgents.find(
          (agent) => agent.name.toLowerCase() === agentName.toLowerCase()
        ) || null
      )
    } catch (error) {
      logger.error('Error finding agent by name:', error)
      return null
    }
  }

  /**
   * Update an existing agent with document management
   */
  updateAgent(
    agentId: string,
    userId: string,
    updates: UpdateAgentRequest
  ): Agent | null {
    try {
      // Check if agent exists and belongs to user
      const existingAgent = this.getAgentById(agentId, userId)
      if (!existingAgent) {
        return null
      }

      const { documentIds, ...baseUpdates } = updates
      const otherUpdates: UpdateAgentRequest = { ...baseUpdates }

      // Handle document updates if provided
      if (documentIds !== undefined) {
        // Validate all new document IDs belong to the user
        const validDocumentIds: string[] = []
        for (const documentId of documentIds) {
          const document = DocumentModel.findOne({ id: documentId })
          if (document && document.userId === userId) {
            validDocumentIds.push(documentId)
          } else {
            logger.warn(
              `Document ${documentId} not found or access denied for user ${userId}`
            )
          }
        }

        // Remove agent from old documents that are no longer associated
        const oldDocumentIds = existingAgent.documentIds
        const documentsToRemove = oldDocumentIds.filter(
          (id) => !validDocumentIds.includes(id)
        )
        const documentsToAdd = validDocumentIds.filter(
          (id) => !oldDocumentIds.includes(id)
        )

        // Remove agent from old documents and cleanup orphaned files
        for (const docId of documentsToRemove) {
          const document = DocumentModel.findOne({ id: docId })
          if (document) {
            const updatedAgentIds = document.agentIds.filter(
              (id) => id !== agentId
            )

            DocumentModel.findOneAndUpdate(
              { id: docId },
              {
                agentIds: updatedAgentIds,
                updatedAt: new Date(),
              }
            )

            // If no more agents are associated with this document, delete it entirely
            if (updatedAgentIds.length === 0) {
              logger.info(`Deleting orphaned document: ${docId}`)

              // Delete the physical file
              if (document.metadata?.filePath) {
                try {
                  this.uploadService.cleanupTempFile(
                    document.metadata.filePath as string
                  )
                } catch (fileError) {
                  logger.warn(
                    `Failed to delete file for document ${docId}:`,
                    fileError
                  )
                }
              }

              // Delete document chunks from vector database
              try {
                this.ingestionService.deleteDocumentChunks(docId)
              } catch (chunkError) {
                logger.warn(
                  `Failed to delete chunks for document ${docId}:`,
                  chunkError
                )
              }

              // Delete the document record
              DocumentModel.deleteOne({ id: docId })
            }
          }
        }

        // Add agent to new documents
        for (const docId of documentsToAdd) {
          const document = DocumentModel.findOne({ id: docId })
          if (document) {
            const updatedAgentIds = document.agentIds.includes(agentId)
              ? document.agentIds
              : [...document.agentIds, agentId]
            DocumentModel.findOneAndUpdate(
              { id: docId },
              {
                agentIds: updatedAgentIds,
                updatedAt: new Date(),
              }
            )
          }
        }

        // Update agent with new document IDs
        otherUpdates.documentIds = validDocumentIds
      }

      const updatedAgent = AgentModel.findOneAndUpdate(
        { id: agentId },
        {
          ...otherUpdates,
          updatedAt: new Date(),
        }
      )

      if (updatedAgent) {
        logger.info(
          `Agent updated successfully: ${agentId}, documents: ${JSON.stringify({
            old: existingAgent.documentIds.length,
            new: updatedAgent.documentIds.length,
          })}`
        )
      }

      return updatedAgent
    } catch (error) {
      logger.error('Error updating agent:', error)
      throw new Error('Failed to update agent')
    }
  }

  /**
   * Delete an agent and remove all associated documents
   */
  deleteAgent(agentId: string, userId: string): boolean {
    try {
      // Check if agent exists and belongs to user
      const existingAgent = this.getAgentById(agentId, userId)
      if (!existingAgent) {
        return false
      }

      // Get all documents associated with this agent
      const associatedDocuments = this.getAgentDocuments(agentId, userId)

      // Remove agent from all associated documents
      for (const document of associatedDocuments) {
        const updatedAgentIds = document.agentIds.filter((id) => id !== agentId)
        DocumentModel.findOneAndUpdate(
          { id: document.id },
          {
            agentIds: updatedAgentIds,
            updatedAt: new Date(),
          }
        )
      }

      // Delete all documents that belong only to this agent (no other agents)
      const documentsToDelete = associatedDocuments.filter(
        (doc) => doc.agentIds.length === 1 && doc.agentIds[0] === agentId
      )

      for (const document of documentsToDelete) {
        // Delete document chunks from vector database
        try {
          this.ingestionService.deleteDocumentChunks(document.id)
        } catch (chunkError) {
          logger.warn(
            `Failed to delete chunks for document ${document.id}:`,
            chunkError
          )
        }

        // Hard delete the document since it's only associated with this agent
        DocumentModel.deleteOne({ id: document.id })

        // Also delete the physical file if it exists
        if (document.metadata?.filePath) {
          try {
            this.uploadService.cleanupTempFile(
              document.metadata.filePath as string
            )
          } catch (fileError) {
            logger.warn(`Failed to delete file at path:`, fileError)
          }
        }
      }

      // Soft delete the agent
      const updatedAgent = AgentModel.findOneAndUpdate(
        { id: agentId },
        {
          isActive: false,
          documentIds: [], // Clear document associations
          updatedAt: new Date(),
        }
      )

      if (updatedAgent) {
        logger.info(
          `Agent deleted successfully: ${agentId}, ${associatedDocuments.length} documents processed, ${documentsToDelete.length} documents deleted`
        )
        return true
      }

      return false
    } catch (error) {
      logger.error('Error deleting agent:', error)
      throw new Error('Failed to delete agent')
    }
  }

  /**
   * Clean up orphaned documents (documents with no associated agents)
   */
  cleanupOrphanedDocuments(): number {
    try {
      const allDocuments = DocumentModel.find()
      let cleanedCount = 0

      for (const document of allDocuments) {
        // Check if document has any active agent associations
        if (document.agentIds.length === 0) {
          logger.info(`Cleaning up orphaned document: ${document.id}`)

          // Delete document chunks from vector database
          try {
            this.ingestionService.deleteDocumentChunks(document.id)
          } catch (chunkError) {
            logger.warn(
              `Failed to delete chunks for orphaned document ${document.id}:`,
              chunkError
            )
          }

          // Delete the physical file
          if (document.metadata?.filePath) {
            try {
              this.uploadService.cleanupTempFile(
                document.metadata.filePath as string
              )
            } catch (fileError) {
              logger.warn(
                `Failed to delete file for orphaned document ${document.id}:`,
                fileError
              )
            }
          }

          // Delete the document record
          DocumentModel.deleteOne({ id: document.id })
          cleanedCount++
        }
      }

      logger.info(
        `Cleanup completed: ${cleanedCount} orphaned documents removed`
      )
      return cleanedCount
    } catch (error) {
      logger.error('Error during orphaned document cleanup:', error)
      throw new Error('Failed to cleanup orphaned documents')
    }
  }

  /**
   * Associate a document with an agent
   */
  associateDocument(
    agentId: string,
    userId: string,
    documentId: string
  ): boolean {
    try {
      // Check if agent exists and belongs to user
      const agent = this.getAgentById(agentId, userId)
      if (!agent) {
        throw new Error('Agent not found or access denied')
      }

      // Check if document exists and belongs to user
      const document = DocumentModel.findOne({ id: documentId })
      if (!document || document.userId !== userId) {
        throw new Error('Document not found or access denied')
      }

      // Add document to agent if not already associated
      if (!agent.documentIds.includes(documentId)) {
        AgentModel.findOneAndUpdate(
          { id: agentId },
          {
            documentIds: [...agent.documentIds, documentId],
            updatedAt: new Date(),
          }
        )

        // Also update document to include agent
        if (!document.agentIds.includes(agentId)) {
          DocumentModel.findOneAndUpdate(
            { id: documentId },
            {
              agentIds: [...document.agentIds, agentId],
              updatedAt: new Date(),
            }
          )
        }

        logger.info(`Document ${documentId} associated with agent ${agentId}`)
        return true
      }

      return true
    } catch (error) {
      logger.error('Error associating document with agent:', error)
      throw new Error('Failed to associate document with agent')
    }
  }

  /**
   * Remove document association from an agent
   */
  removeDocumentAssociation(
    agentId: string,
    userId: string,
    documentId: string
  ): boolean {
    try {
      // Check if agent exists and belongs to user
      const agent = this.getAgentById(agentId, userId)
      if (!agent) {
        throw new Error('Agent not found or access denied')
      }

      // Remove document from agent's document list
      const updatedDocumentIds = agent.documentIds.filter(
        (id) => id !== documentId
      )
      AgentModel.findOneAndUpdate(
        { id: agentId },
        {
          documentIds: updatedDocumentIds,
          updatedAt: new Date(),
        }
      )

      // Also remove agent from document's agent list
      const document = DocumentModel.findOne({ id: documentId })
      if (document) {
        const updatedAgentIds = document.agentIds.filter((id) => id !== agentId)
        DocumentModel.findOneAndUpdate(
          { id: documentId },
          {
            agentIds: updatedAgentIds,
            updatedAt: new Date(),
          }
        )
      }

      logger.info(`Document ${documentId} removed from agent ${agentId}`)
      return true
    } catch (error) {
      logger.error('Error removing document association:', error)
      throw new Error('Failed to remove document association')
    }
  }

  /**
   * Get all documents associated with an agent
   */
  getAgentDocuments(agentId: string, userId: string): Document[] {
    try {
      // Check if agent exists and belongs to user
      const agent = this.getAgentById(agentId, userId)
      if (!agent) {
        return []
      }

      const documents: Document[] = []
      for (const docId of agent.documentIds) {
        const document = DocumentModel.findOne({ id: docId })
        if (document && document.userId === userId) {
          documents.push(document)
        }
      }

      return documents
    } catch (error) {
      logger.error('Error fetching agent documents:', error)
      throw new Error('Failed to fetch agent documents')
    }
  }

  /**
   * Get agent context (agent + associated documents) for chat
   */
  getAgentContext(
    agentId: string,
    userId: string
  ): {
    agent: Agent
    documents: Document[]
  } | null {
    try {
      const agent = this.getAgentById(agentId, userId)
      if (!agent) {
        return null
      }

      const documents = this.getAgentDocuments(agentId, userId)

      return {
        agent,
        documents,
      }
    } catch (error) {
      logger.error('Error fetching agent context:', error)
      throw new Error('Failed to fetch agent context')
    }
  }

  /**
   * Get complete agent information for AI interactions
   * This includes agent details, system prompt, and all associated document content
   */
  getAgentForAI(
    agentId: string,
    userId: string
  ): {
    agent: Agent
    documents: Document[]
    contextSummary: string
  } | null {
    try {
      const context = this.getAgentContext(agentId, userId)
      if (!context) {
        return null
      }

      const { agent, documents } = context

      // Create a context summary for the AI
      const documentSummaries = documents.map(
        (doc) =>
          `Document: ${doc.name} (${doc.type})\nContent: ${doc.content.substring(0, 500)}${doc.content.length > 500 ? '...' : ''}`
      )

      const contextSummary = `
Agent Information:
- Name: ${agent.name}
- Role: ${agent.role}
- Description: ${agent.description || 'No description provided'}
- System Prompt: ${agent.systemPrompt}

Associated Documents (${documents.length}):
${documentSummaries.join('\n\n')}
      `.trim()

      return {
        agent,
        documents,
        contextSummary,
      }
    } catch (error) {
      logger.error('Error fetching agent for AI:', error)
      throw new Error('Failed to fetch agent for AI')
    }
  }
}
