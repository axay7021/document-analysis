import type { Request, Response } from 'express'

import type { AgentIdParams, UpdateAgentRequest } from '../schemas/agent.schema'
import {
  AgentService,
  type CreateAgentRequest,
} from '../services/agent.service'
import type { Document } from '../types/types'
import httpResponse from '../utils/httpResponse'
import logger from '../utils/logger'

// Initialize service
const agentService = new AgentService()

/**
 * Create a new agent (handles both JSON and multipart/form-data with files)
 */
export const createAgent = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      httpResponse(req, res, 401, 'Authentication required')
      return
    }

    const { name, description, systemPrompt, config } = req.body as {
      name: string
      description?: string
      systemPrompt: string
      config?: string | object
    }
    const files = req.files as Express.Multer.File[]

    // Parse config if it's a string (from form data), otherwise use as object (from JSON)
    let parsedConfig: CreateAgentRequest['config']
    try {
      if (typeof config === 'string') {
        parsedConfig = JSON.parse(config) as CreateAgentRequest['config']
      } else {
        parsedConfig = config as CreateAgentRequest['config']
      }
    } catch {
      parsedConfig = undefined
    }

    // If files are provided, use the file upload service
    if (files.length > 0) {
      const agentData = {
        userId: req.user.id,
        name,
        description,
        systemPrompt,
        config: parsedConfig,
        files,
      }

      const result = await agentService.createAgentWithFiles(agentData)

      httpResponse(req, res, 201, 'Agent created successfully with documents', {
        agent: result.agent,
        documents: result.documents,
        uploadResults: result.uploadResults,
        summary: {
          totalFiles: files.length,
          successfulUploads: result.uploadResults.filter((r) => r.success)
            .length,
          failedUploads: result.uploadResults.filter((r) => !r.success).length,
          documentsAssociated: result.documents.length,
        },
      })
    } else {
      // No files, create agent normally
      const agentData: CreateAgentRequest = {
        userId: req.user.id,
        name,
        description,
        systemPrompt,
        config: parsedConfig,
      }

      const agent = agentService.createAgent(agentData)
      const documents = agentService.getAgentDocuments(agent.id, req.user.id)

      httpResponse(req, res, 201, 'Agent created successfully', {
        agent,
        documents,
        summary: {
          totalFiles: 0,
          successfulUploads: 0,
          failedUploads: 0,
          documentsAssociated: documents.length,
        },
      })
    }
  } catch (error) {
    logger.error('Error creating agent:', error)
    httpResponse(req, res, 500, 'Failed to create agent')
  }
}

/**
 * Get all agents for current user~
 */
export const getUserAgents = (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      httpResponse(req, res, 401, 'Authentication required')
      return
    }

    const agents = agentService.getAgentsByUserId(req.user.id)

    // Enhance agents with document count
    const enhancedAgents = agents.map((agent) => ({
      ...agent,
      documentCount: agent.documentIds.length,
    }))

    httpResponse(req, res, 200, 'Agents retrieved successfully', {
      agents: enhancedAgents,
      count: agents.length,
    })
  } catch (error) {
    logger.error('Error fetching user agents:', error)
    httpResponse(req, res, 500, 'Failed to retrieve agents')
  }
}

/**
 * Get specific agent by ID
 */
export const getAgent = (req: Request<AgentIdParams>, res: Response) => {
  try {
    if (!req.user?.id) {
      httpResponse(req, res, 401, 'Authentication required')
      return
    }

    const { agentId } = req.params
    const agent = agentService.getAgentById(agentId, req.user.id)

    if (!agent) {
      httpResponse(req, res, 404, 'Agent not found or access denied')
      return
    }

    // Get associated documents
    const documents = agentService.getAgentDocuments(agentId, req.user.id)

    httpResponse(req, res, 200, 'Agent retrieved successfully', {
      agent,
      documents,
      documentCount: documents.length,
    })
  } catch (error) {
    logger.error('Error retrieving agent:', error)
    httpResponse(req, res, 500, 'Failed to retrieve agent')
  }
}

/**
 * Update an agent (supports both JSON and multipart/form-data with files)
 */
export const updateAgent = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      httpResponse(req, res, 401, 'Authentication required')
      return
    }

    const { agentId } = req.params as AgentIdParams
    const {
      name,
      description,
      systemPrompt,
      config,
      documentIds: rawDocumentIds,
    } = req.body as {
      name?: string
      description?: string
      systemPrompt?: string
      role?: string
      config?: string | object
      documentIds?: string[] | string
    }
    const files = req.files as Express.Multer.File[]

    // Normalize documentIds to always be an array or undefined
    let documentIds: string[] | undefined
    if (rawDocumentIds !== undefined) {
      if (typeof rawDocumentIds === 'string') {
        // Single string ID - filter out empty strings
        documentIds = rawDocumentIds.trim() ? [rawDocumentIds.trim()] : []
      } else if (Array.isArray(rawDocumentIds)) {
        // Already an array - filter out empty strings and trim
        documentIds = rawDocumentIds
          .filter((id) => typeof id === 'string' && id.trim())
          .map((id) => id.trim())
      } else {
        // Invalid type, treat as undefined
        documentIds = undefined
        logger.warn('Invalid documentIds type received:', typeof rawDocumentIds)
      }
    }

    // Parse config if it's a string (from form data), otherwise use as object
    let parsedConfig: UpdateAgentRequest['config']
    try {
      if (typeof config === 'string') {
        parsedConfig = JSON.parse(config) as UpdateAgentRequest['config']
      } else {
        parsedConfig = config as UpdateAgentRequest['config']
      }
    } catch {
      parsedConfig = undefined
    }

    logger.info('Agent update request:', {
      agentId,
      rawDocumentIds,
      normalizedDocumentIds: documentIds,
      documentIdsType: typeof rawDocumentIds,
      filesCount: files.length,
      hasDocumentIds: documentIds !== undefined,
    })

    // Handle file uploads and document management
    let finalDocumentIds: string[] = []
    const uploadResults: Array<{
      success: boolean
      document?: Document
      error?: string
    }> = []

    // Process any uploaded files first
    if (files.length > 0) {
      for (const file of files) {
        try {
          const uploadResult = await agentService.uploadService.processUpload(
            file,
            {
              userId: req.user.id,
              processDocument: true,
              validateFile: true,
            }
          )

          finalDocumentIds.push(uploadResult.document.id)
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

    // Determine final document list based on user intention:
    // 1. If both files and documentIds provided: MERGE both (keep existing + add new)
    // 2. If only files uploaded: ADD to existing documents (append new files)
    // 3. If only documentIds provided: REPLACE with those documentIds
    // 4. If neither provided: REMOVE ALL documents from agent
    let shouldUpdateDocuments = files.length > 0 || documentIds !== undefined

    if (files.length > 0 && documentIds !== undefined) {
      // Both files and documentIds provided: MERGE both lists
      const combinedIds = [...documentIds, ...finalDocumentIds]
      // Remove duplicates while preserving order
      finalDocumentIds = Array.from(new Set(combinedIds))
      logger.info('Merging provided documentIds with uploaded files:', {
        providedDocumentIds: documentIds,
        uploadedDocumentIds: finalDocumentIds.filter(
          (id) => !documentIds.includes(id)
        ),
        finalCount: finalDocumentIds.length,
        finalDocumentIds: finalDocumentIds,
      })
    } else if (files.length > 0) {
      // Only files uploaded: ADD to existing documents (don't replace)
      const existingAgent = agentService.getAgentById(agentId, req.user.id)
      if (existingAgent) {
        const existingDocIds = existingAgent.documentIds
        const combinedIds = [...existingDocIds, ...finalDocumentIds]
        // Remove duplicates while preserving order
        finalDocumentIds = Array.from(new Set(combinedIds))
      }
      logger.info('Adding uploaded files to existing documents:', {
        existingCount: existingAgent?.documentIds.length || 0,
        newUploadedCount: finalDocumentIds.filter(
          (id) => !existingAgent?.documentIds.includes(id)
        ).length,
        finalCount: finalDocumentIds.length,
        finalDocumentIds: finalDocumentIds,
      })
    } else if (documentIds !== undefined) {
      // Only documentIds provided: REPLACE with those document IDs
      finalDocumentIds = [...documentIds]
      logger.info('Replacing with provided documentIds only:', {
        documentIdsCount: finalDocumentIds.length,
        documentIds: finalDocumentIds,
      })
    } else {
      // Neither files nor documentIds provided: remove all documents from agent
      finalDocumentIds = []
      shouldUpdateDocuments = true // Force document update to remove all
      logger.info(
        'No files or documentIds provided - removing all documents from agent'
      )
    }

    const updateData: UpdateAgentRequest = {}
    if (name) updateData.name = name
    if (description) updateData.description = description
    if (systemPrompt) updateData.systemPrompt = systemPrompt
    if (parsedConfig) updateData.config = parsedConfig
    if (shouldUpdateDocuments) {
      updateData.documentIds = finalDocumentIds
    }

    const updatedAgent = agentService.updateAgent(
      agentId,
      req.user.id,
      updateData
    )

    if (!updatedAgent) {
      httpResponse(req, res, 404, 'Agent not found or access denied')
      return
    }

    // Get updated documents
    const documents = agentService.getAgentDocuments(agentId, req.user.id)

    logger.info('Agent updated successfully', {
      agentId,
      userId: req.user.id,
      updatedFields: Object.keys(updateData),
      newFiles: uploadResults.filter((r) => r.success).length,
    })

    httpResponse(req, res, 200, 'Agent updated successfully', {
      agent: updatedAgent,
      documents,
      uploadResults: files.length > 0 ? uploadResults : undefined,
      summary: {
        totalFiles: files.length,
        successfulUploads: uploadResults.filter((r) => r.success).length,
        failedUploads: uploadResults.filter((r) => !r.success).length,
        documentsAssociated: documents.length,
      },
    })
  } catch (error) {
    logger.error('Failed to update agent:', error)
    httpResponse(req, res, 500, 'Failed to update agent')
  }
}

/**
 * Clean up orphaned documents (admin endpoint)
 */
export const cleanupOrphanedDocuments = (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      httpResponse(req, res, 401, 'Authentication required')
      return
    }

    const cleanedCount = agentService.cleanupOrphanedDocuments()

    httpResponse(req, res, 200, 'Orphaned documents cleaned up successfully', {
      cleanedCount,
      message: `${cleanedCount} orphaned documents were removed`,
    })
  } catch (error) {
    logger.error('Error during cleanup:', error)
    httpResponse(req, res, 500, 'Failed to cleanup orphaned documents')
  }
}

/**
 * Delete an agent
 */
export const deleteAgent = (req: Request<AgentIdParams>, res: Response) => {
  try {
    if (!req.user?.id) {
      httpResponse(req, res, 401, 'Authentication required')
      return
    }

    const { agentId } = req.params
    const success = agentService.deleteAgent(agentId, req.user.id)

    if (!success) {
      httpResponse(req, res, 404, 'Agent not found or access denied')
      return
    }

    logger.info('Agent deleted successfully', {
      agentId,
      userId: req.user.id,
    })

    httpResponse(req, res, 200, 'Agent deleted successfully')
  } catch (error) {
    logger.error('Failed to delete agent:', error)
    httpResponse(req, res, 500, 'Failed to delete agent')
  }
}
