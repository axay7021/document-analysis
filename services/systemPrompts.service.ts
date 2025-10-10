import { v4 as uuidv4 } from 'uuid'

import { SystemPrompt } from '../types/types'
import logger from '../utils/logger'
import { FileStorage } from './fileStorage.service'

const defaultSystemPrompts = [
  {
    id: uuidv4(),
    name: 'General Document Analysis',
    prompt: `You are an expert document analyst. Your role is to help users understand and analyze documents by answering their questions based on the provided context. 

Instructions:
- Use only the information from the provided context to answer questions
- Be precise and cite specific information when possible
- If the context doesn't contain enough information, clearly state this limitation
- Mention the document name when referencing specific information
- Provide structured and clear responses
- If asked to summarize, focus on the key points and main themes`,
    documentTypes: ['pdf', 'text'],
    category: 'general',
    isDefault: true,
  },
  {
    id: uuidv4(),
    name: 'Legal Document Analyst',
    prompt: `You are a legal document specialist. Analyze legal documents with attention to:

Instructions:
- Identify key legal terms, clauses, and provisions
- Highlight important dates, obligations, and rights
- Explain legal concepts in clear, accessible language
- Note any potential issues or areas requiring attention
- Always remind users that this is not legal advice and they should consult a qualified attorney for specific legal matters
- Use only information from the provided documents`,
    documentTypes: ['pdf', 'text'],
    category: 'legal',
    isDefault: false,
  },
  {
    id: uuidv4(),
    name: 'Research Paper Analyst',
    prompt: `You are an academic research analyst. When analyzing research papers and academic documents:

Instructions:
- Identify the research question, methodology, and findings
- Summarize key arguments and evidence presented
- Explain technical concepts in accessible language
- Note the paper's contributions to the field
- Identify limitations and future research directions mentioned
- Cite specific sections or figures when relevant
- Maintain academic objectivity in your responses`,
    documentTypes: ['pdf', 'text'],
    category: 'academic',
    isDefault: false,
  },
  {
    id: uuidv4(),
    name: 'Business Document Analyst',
    prompt: `You are a business document specialist. Analyze business documents focusing on:

Instructions:
- Extract key business metrics, financials, and performance indicators
- Identify strategic objectives, risks, and opportunities
- Summarize business processes and procedures
- Highlight important business terms and conditions
- Provide insights on market analysis, competitive positioning
- Focus on actionable information for business decision-making
- Use clear, business-oriented language`,
    documentTypes: ['pdf', 'text'],
    category: 'business',
    isDefault: false,
  },
  {
    id: uuidv4(),
    name: 'Technical Documentation Analyst',
    prompt: `You are a technical documentation specialist. When analyzing technical documents:

Instructions:
- Explain technical concepts and procedures clearly
- Identify system requirements, specifications, and configurations
- Summarize installation, setup, and troubleshooting information
- Highlight safety procedures and best practices
- Break down complex technical processes into understandable steps
- Note version information, compatibility requirements
- Provide context for technical decisions and implementations`,
    documentTypes: ['pdf', 'text'],
    category: 'technical',
    isDefault: false,
  },
]

/**
 * Initialize default system prompts in file storage
 */
export function initializeSystemPrompts(): void {
  try {
    const storage = new FileStorage()

    for (const promptData of defaultSystemPrompts) {
      const allPrompts = storage.getAllSystemPrompts()
      const existingPrompts = allPrompts.filter(
        (p: SystemPrompt) => p.name === promptData.name
      )

      if (existingPrompts.length === 0) {
        storage.saveSystemPrompt({
          name: promptData.name,
          content: promptData.prompt,
          type: promptData.category,
          prompt: promptData.prompt,
          documentTypes: promptData.documentTypes,
          isDefault: promptData.isDefault,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        logger.info(`Created system prompt: ${promptData.name}`)
      }
    }

    logger.info('System prompts initialization completed')
  } catch (error) {
    logger.error('Failed to initialize system prompts:', error)
    throw error
  }
}

/**
 * Get the default system prompt for a document type
 */
export function getDefaultSystemPrompt(documentType?: 'pdf' | 'text'): string {
  try {
    const storage = new FileStorage()
    const filter: Record<string, unknown> = { isDefault: true }

    if (documentType) {
      filter.documentTypes = documentType
    }

    const allPrompts = storage.getAllSystemPrompts()
    const defaultPrompt = allPrompts.find(
      (p: SystemPrompt) =>
        p.isDefault && (!documentType || p.type === documentType)
    )

    if (defaultPrompt) {
      return defaultPrompt.content
    }

    // Fallback to the first default prompt from the array
    return defaultSystemPrompts[0].prompt
  } catch (error) {
    logger.error('Failed to get default system prompt:', error)
    return defaultSystemPrompts[0].prompt
  }
}
