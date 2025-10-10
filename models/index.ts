// File Storage Service (replaces MongoDB models)
import { FileStorage } from '../services/fileStorage.service'
import {
  ChatSession,
  Chunk,
  Document,
  DocumentGroup,
  SystemPrompt,
} from '../types/types'

// Create a singleton instance
const storage = new FileStorage()

// Export storage methods as model-like interface
export const DocumentModel = {
  create: (doc: Omit<Document, 'id'>): Document => storage.saveDocument(doc),
  find: (): Document[] => storage.getAllDocuments(),
  findOne: (filter: { id: string }): Document | null =>
    storage.getDocument(filter.id),
  deleteOne: (filter: { id: string }): { deletedCount: number } => {
    const deleted = storage.deleteDocument(filter.id)
    return { deletedCount: deleted ? 1 : 0 }
  },
}

export const ChunkModel = {
  insertMany: (chunks: Omit<Chunk, 'id'>[]): Chunk[] =>
    storage.saveChunks(chunks),
  find: (filter: { documentId?: string } = {}): Chunk[] => {
    if (filter.documentId) {
      return storage.getChunksByDocumentId(filter.documentId)
    }
    // Return empty array for now - could be extended to return all chunks
    return []
  },
  findOne: (filter: { id: string }): Chunk | null => {
    // We need to search through all chunks to find by ID
    const allDocuments = storage.getAllDocuments()
    for (const doc of allDocuments) {
      const chunks = storage.getChunksByDocumentId(doc.id)
      const chunk = chunks.find((c: Chunk) => c.id === filter.id)
      if (chunk) return chunk
    }
    return null
  },
  deleteMany: (filter: { documentId: string }): { deletedCount: number } => {
    storage.deleteChunksByDocumentId(filter.documentId)
    return { deletedCount: 1 }
  },
}

export const ChatSessionModel = {
  create: (session: Omit<ChatSession, 'id'>): ChatSession =>
    storage.saveChatSession(session),
  find: (filter: { documentIds?: { $in: string[] } } = {}): ChatSession[] => {
    if (filter.documentIds?.$in) {
      // Find sessions that include any of the document IDs
      return storage.getChatSessionsByDocumentId(filter.documentIds.$in[0])
    }
    return []
  },
  findOne: (filter: { id: string }): ChatSession | null =>
    storage.getChatSession(filter.id),
  save: (session: ChatSession): ChatSession => {
    if (session.id) {
      const updated = storage.updateChatSession(session.id, session)
      return updated || session
    } else {
      return storage.saveChatSession(session)
    }
  },
}

export const SystemPromptModel = {
  create: (prompt: Omit<SystemPrompt, 'id'>): SystemPrompt =>
    storage.saveSystemPrompt(prompt),
  find: (): SystemPrompt[] => storage.getAllSystemPrompts(),
  findOne: (filter: { type: string }): SystemPrompt | null =>
    storage.getSystemPromptByType(filter.type),
}

export const DocumentGroupModel = {
  create: (group: Omit<DocumentGroup, 'id'>): DocumentGroup =>
    storage.saveDocumentGroup(group),
  find: (): DocumentGroup[] => storage.getAllDocumentGroups(),
  findOneAndUpdate: (
    filter: { id: string },
    update: Partial<DocumentGroup>
  ): DocumentGroup | null => storage.updateDocumentGroup(filter.id, update),
  updateMany: (
    filter: Record<string, unknown>,
    update: Partial<DocumentGroup>
  ): DocumentGroup[] => {
    const groups = storage.getAllDocumentGroups()
    const updatedGroups: DocumentGroup[] = []
    groups.forEach((group: DocumentGroup) => {
      const updated = storage.updateDocumentGroup(group.id, update)
      if (updated) {
        updatedGroups.push(updated)
      }
    })
    return updatedGroups
  },
}

// All models are now replaced with FileStorage service
