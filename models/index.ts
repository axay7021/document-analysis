// File Storage Service (replaces MongoDB models)
import { FileStorage } from '../services/fileStorage.service'
import {
  Agent,
  ChatSession,
  Chunk,
  Document,
  DocumentGroup,
  SystemPrompt,
  User,
  UserSession,
} from '../types/types'

// Create a singleton instance
const storage = new FileStorage()

// Export storage methods as model-like interface
export const DocumentModel = {
  create: (doc: Omit<Document, 'id'>): Document => storage.saveDocument(doc),
  find: (): Document[] => storage.getAllDocuments(),
  findOne: (filter: { id: string }): Document | null =>
    storage.getDocument(filter.id),
  findOneAndUpdate: (
    filter: { id: string },
    update: Partial<Document>
  ): Document | null => storage.updateDocument(filter.id, update),
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

export const UserModel = {
  create: (user: Omit<User, 'id'>): User => storage.saveUser(user),
  findById: (id: string): User | null => storage.getUser(id),
  findByEmail: (email: string): User | null => storage.getUserByEmail(email),
  findOneAndUpdate: (
    filter: { id: string },
    update: Partial<User>
  ): User | null => storage.updateUser(filter.id, update),
  find: (): User[] => storage.getAllUsers(),
}

export const AgentModel = {
  create: (agent: Omit<Agent, 'id'>): Agent => storage.saveAgent(agent),
  findById: (id: string): Agent | null => storage.getAgent(id),
  findByUserId: (userId: string): Agent[] => storage.getAgentsByUserId(userId),
  findOneAndUpdate: (
    filter: { id: string },
    update: Partial<Agent>
  ): Agent | null => storage.updateAgent(filter.id, update),
  find: (): Agent[] => storage.getAllAgents(),
  deleteOne: (filter: { id: string }): { deletedCount: number } => {
    const deleted = storage.deleteAgent(filter.id)
    return { deletedCount: deleted ? 1 : 0 }
  },
}

export const UserSessionModel = {
  create: (session: Omit<UserSession, 'id'>): UserSession =>
    storage.saveUserSession(session),
  findById: (id: string): UserSession | null => storage.getUserSession(id),
  findByToken: (token: string): UserSession | null =>
    storage.getUserSessionByToken(token),
  findByUserId: (userId: string): UserSession[] =>
    storage.getUserSessionsByUserId(userId),
  findOneAndUpdate: (
    filter: { id: string },
    update: Partial<UserSession>
  ): UserSession | null => storage.updateUserSession(filter.id, update),
  deleteOne: (filter: { id: string }): { deletedCount: number } => {
    const deleted = storage.deleteUserSession(filter.id)
    return { deletedCount: deleted ? 1 : 0 }
  },
}

// All models are now replaced with FileStorage service
