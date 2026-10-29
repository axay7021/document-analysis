import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

import { config } from '../config'
import type {
  Agent,
  ChatSession,
  Chunk,
  Document,
  DocumentGroup,
  SystemPrompt,
  User,
  UserSession,
} from '../types/types'

export class FileStorage {
  private dataPath: string

  constructor() {
    this.dataPath = config.DATA_STORAGE_PATH
    this.ensureDirectoriesExist()
  }

  private ensureDirectoriesExist() {
    const directories = [
      this.dataPath,
      path.join(this.dataPath, 'documents'),
      path.join(this.dataPath, 'chunks'),
      path.join(this.dataPath, 'chatSessions'),
      path.join(this.dataPath, 'systemPrompts'),
      path.join(this.dataPath, 'documentGroups'),
      path.join(this.dataPath, 'users'),
      path.join(this.dataPath, 'agents'),
      path.join(this.dataPath, 'userSessions'),
    ]

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
  }

  private safeId(id: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid record ID')
    return id
  }

  // Document operations
  saveDocument(document: Omit<Document, 'id'>): Document {
    const id = uuidv4()
    const documentWithId: Document = { ...document, id }
    const filePath = path.join(this.dataPath, 'documents', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(documentWithId, null, 2))
    return documentWithId
  }

  getDocument(id: string): Document | null {
    const filePath = path.join(this.dataPath, 'documents', `${this.safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as Document
  }

  getAllDocuments(): Document[] {
    const documentsDir = path.join(this.dataPath, 'documents')

    if (!fs.existsSync(documentsDir)) {
      return []
    }

    const files = fs
      .readdirSync(documentsDir)
      .filter((file) => file.endsWith('.json'))
    const documents: Document[] = []

    files.forEach((file) => {
      const filePath = path.join(documentsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      documents.push(JSON.parse(data) as Document)
    })

    return documents
  }

  updateDocument(id: string, update: Partial<Document>): Document | null {
    const document = this.getDocument(id)

    if (!document) {
      return null
    }

    const updatedDocument = { ...document, ...update }
    const filePath = path.join(this.dataPath, 'documents', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(updatedDocument, null, 2))
    return updatedDocument
  }

  deleteDocument(id: string): boolean {
    const filePath = path.join(this.dataPath, 'documents', `${this.safeId(id)}.json`)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }

    return false
  }

  // Chunk operations
  saveChunks(chunks: Omit<Chunk, 'id'>[]): Chunk[] {
    const chunksWithIds: Chunk[] = chunks.map((chunk) => ({
      ...chunk,
      id: uuidv4(),
    }))

    chunksWithIds.forEach((chunk) => {
      const filePath = path.join(this.dataPath, 'chunks', `${chunk.id}.json`)
      fs.writeFileSync(filePath, JSON.stringify(chunk, null, 2))
    })

    return chunksWithIds
  }

  getChunksByDocumentId(documentId: string): Chunk[] {
    const chunksDir = path.join(this.dataPath, 'chunks')

    if (!fs.existsSync(chunksDir)) {
      return []
    }

    const files = fs
      .readdirSync(chunksDir)
      .filter((file) => file.endsWith('.json'))
    const chunks: Chunk[] = []

    files.forEach((file) => {
      const filePath = path.join(chunksDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      const chunk = JSON.parse(data) as Chunk

      if (chunk.documentId === documentId) {
        chunks.push(chunk)
      }
    })

    return chunks
  }

  deleteChunksByDocumentId(documentId: string): void {
    const chunksDir = path.join(this.dataPath, 'chunks')

    if (!fs.existsSync(chunksDir)) {
      return
    }

    const files = fs
      .readdirSync(chunksDir)
      .filter((file) => file.endsWith('.json'))

    files.forEach((file) => {
      const filePath = path.join(chunksDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      const chunk = JSON.parse(data) as Chunk

      if (chunk.documentId === documentId) {
        fs.unlinkSync(filePath)
      }
    })
  }

  // Chat Session operations
  saveChatSession(session: Omit<ChatSession, 'id'>): ChatSession {
    const id = uuidv4()
    const sessionWithId: ChatSession = { ...session, id }
    const filePath = path.join(this.dataPath, 'chatSessions', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(sessionWithId, null, 2))
    return sessionWithId
  }

  getChatSession(id: string): ChatSession | null {
    const filePath = path.join(this.dataPath, 'chatSessions', `${this.safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as ChatSession
  }

  updateChatSession(
    id: string,
    updates: Partial<ChatSession>
  ): ChatSession | null {
    const session = this.getChatSession(id)

    if (!session) {
      return null
    }

    const updatedSession = { ...session, ...updates }
    const filePath = path.join(this.dataPath, 'chatSessions', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(updatedSession, null, 2))
    return updatedSession
  }

  getChatSessionsByDocumentId(documentId: string): ChatSession[] {
    const sessionsDir = path.join(this.dataPath, 'chatSessions')

    if (!fs.existsSync(sessionsDir)) {
      return []
    }

    const files = fs
      .readdirSync(sessionsDir)
      .filter((file) => file.endsWith('.json'))
    const sessions: ChatSession[] = []

    files.forEach((file) => {
      const filePath = path.join(sessionsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      const session = JSON.parse(data) as ChatSession

      if (session.documentIds.includes(documentId)) {
        sessions.push(session)
      }
    })

    return sessions
  }

  // System Prompt operations
  saveSystemPrompt(prompt: Omit<SystemPrompt, 'id'>): SystemPrompt {
    const id = uuidv4()
    const promptWithId: SystemPrompt = { ...prompt, id }
    const filePath = path.join(this.dataPath, 'systemPrompts', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(promptWithId, null, 2))
    return promptWithId
  }

  getSystemPromptById(id: string): SystemPrompt | null {
    const filePath = path.join(this.dataPath, 'systemPrompts', `${this.safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as SystemPrompt
  }

  getSystemPromptByType(type: string): SystemPrompt | null {
    const promptsDir = path.join(this.dataPath, 'systemPrompts')

    if (!fs.existsSync(promptsDir)) {
      return null
    }

    const files = fs
      .readdirSync(promptsDir)
      .filter((file) => file.endsWith('.json'))

    for (const file of files) {
      const filePath = path.join(promptsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      const prompt = JSON.parse(data) as SystemPrompt

      if (prompt.type === type) {
        return prompt
      }
    }

    return null
  }

  getDefaultSystemPrompt(documentType?: string): SystemPrompt | null {
    const promptsDir = path.join(this.dataPath, 'systemPrompts')

    if (!fs.existsSync(promptsDir)) {
      return null
    }

    const files = fs
      .readdirSync(promptsDir)
      .filter((file) => file.endsWith('.json'))

    for (const file of files) {
      const filePath = path.join(promptsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      const prompt = JSON.parse(data) as SystemPrompt

      if (prompt.isDefault && (!documentType || prompt.type === documentType)) {
        return prompt
      }
    }

    return null
  }

  getAllSystemPrompts(): SystemPrompt[] {
    const promptsDir = path.join(this.dataPath, 'systemPrompts')

    if (!fs.existsSync(promptsDir)) {
      return []
    }

    const files = fs
      .readdirSync(promptsDir)
      .filter((file) => file.endsWith('.json'))
    const prompts: SystemPrompt[] = []

    files.forEach((file) => {
      const filePath = path.join(promptsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      prompts.push(JSON.parse(data) as SystemPrompt)
    })

    return prompts
  }

  // Add missing method for ChatSessions
  getAllChatSessions(): ChatSession[] {
    const sessionsDir = path.join(this.dataPath, 'chatSessions')

    if (!fs.existsSync(sessionsDir)) {
      return []
    }

    const files = fs
      .readdirSync(sessionsDir)
      .filter((file) => file.endsWith('.json'))
    const sessions: ChatSession[] = []

    files.forEach((file) => {
      const filePath = path.join(sessionsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      sessions.push(JSON.parse(data) as ChatSession)
    })

    return sessions
  }

  // User operations
  saveUser(user: Omit<User, 'id'>): User {
    const id = uuidv4()
    const userWithId: User = { ...user, id }
    const filePath = path.join(this.dataPath, 'users', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(userWithId, null, 2))
    return userWithId
  }

  getUser(id: string): User | null {
    const filePath = path.join(this.dataPath, 'users', `${this.safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as User
  }

  getUserByEmail(email: string): User | null {
    const usersDir = path.join(this.dataPath, 'users')

    if (!fs.existsSync(usersDir)) {
      return null
    }

    const files = fs
      .readdirSync(usersDir)
      .filter((file) => file.endsWith('.json'))

    for (const file of files) {
      const filePath = path.join(usersDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      const user = JSON.parse(data) as User

      if (user.email === email) {
        return user
      }
    }

    return null
  }

  updateUser(id: string, updates: Partial<User>): User | null {
    const user = this.getUser(id)

    if (!user) {
      return null
    }

    const updatedUser = { ...user, ...updates }
    const filePath = path.join(this.dataPath, 'users', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(updatedUser, null, 2))
    return updatedUser
  }

  getAllUsers(): User[] {
    const usersDir = path.join(this.dataPath, 'users')

    if (!fs.existsSync(usersDir)) {
      return []
    }

    const files = fs
      .readdirSync(usersDir)
      .filter((file) => file.endsWith('.json'))
    const users: User[] = []

    files.forEach((file) => {
      const filePath = path.join(usersDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      users.push(JSON.parse(data) as User)
    })

    return users
  }

  // Agent operations
  saveAgent(agent: Omit<Agent, 'id'>): Agent {
    const id = uuidv4()
    const agentWithId: Agent = { ...agent, id }
    const filePath = path.join(this.dataPath, 'agents', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(agentWithId, null, 2))
    return agentWithId
  }

  getAgent(id: string): Agent | null {
    const filePath = path.join(this.dataPath, 'agents', `${this.safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as Agent
  }

  getAgentsByUserId(userId: string): Agent[] {
    const agentsDir = path.join(this.dataPath, 'agents')

    if (!fs.existsSync(agentsDir)) {
      return []
    }

    const files = fs
      .readdirSync(agentsDir)
      .filter((file) => file.endsWith('.json'))
    const agents: Agent[] = []

    files.forEach((file) => {
      const filePath = path.join(agentsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      const agent = JSON.parse(data) as Agent

      if (agent.userId === userId) {
        agents.push(agent)
      }
    })

    return agents
  }

  updateAgent(id: string, updates: Partial<Agent>): Agent | null {
    const agent = this.getAgent(id)

    if (!agent) {
      return null
    }

    const updatedAgent = { ...agent, ...updates }
    const filePath = path.join(this.dataPath, 'agents', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(updatedAgent, null, 2))
    return updatedAgent
  }

  getAllAgents(): Agent[] {
    const agentsDir = path.join(this.dataPath, 'agents')

    if (!fs.existsSync(agentsDir)) {
      return []
    }

    const files = fs
      .readdirSync(agentsDir)
      .filter((file) => file.endsWith('.json'))
    const agents: Agent[] = []

    files.forEach((file) => {
      const filePath = path.join(agentsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      agents.push(JSON.parse(data) as Agent)
    })

    return agents
  }

  deleteAgent(id: string): boolean {
    const filePath = path.join(this.dataPath, 'agents', `${this.safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      return false
    }

    fs.unlinkSync(filePath)
    return true
  }

  // UserSession operations
  saveUserSession(session: Omit<UserSession, 'id'>): UserSession {
    const id = uuidv4()
    const sessionWithId: UserSession = { ...session, id }
    const filePath = path.join(this.dataPath, 'userSessions', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(sessionWithId, null, 2))
    return sessionWithId
  }

  getUserSession(id: string): UserSession | null {
    const filePath = path.join(this.dataPath, 'userSessions', `${this.safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as UserSession
  }

  getUserSessionByToken(token: string): UserSession | null {
    const sessionsDir = path.join(this.dataPath, 'userSessions')

    if (!fs.existsSync(sessionsDir)) {
      return null
    }

    const files = fs
      .readdirSync(sessionsDir)
      .filter((file) => file.endsWith('.json'))

    for (const file of files) {
      const filePath = path.join(sessionsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      const session = JSON.parse(data) as UserSession

      if (session.token === token) {
        return session
      }
    }

    return null
  }

  getUserSessionsByUserId(userId: string): UserSession[] {
    const sessionsDir = path.join(this.dataPath, 'userSessions')

    if (!fs.existsSync(sessionsDir)) {
      return []
    }

    const files = fs
      .readdirSync(sessionsDir)
      .filter((file) => file.endsWith('.json'))
    const sessions: UserSession[] = []

    files.forEach((file) => {
      const filePath = path.join(sessionsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      const session = JSON.parse(data) as UserSession

      if (session.userId === userId) {
        sessions.push(session)
      }
    })

    return sessions
  }

  updateUserSession(
    id: string,
    updates: Partial<UserSession>
  ): UserSession | null {
    const session = this.getUserSession(id)

    if (!session) {
      return null
    }

    const updatedSession = { ...session, ...updates }
    const filePath = path.join(this.dataPath, 'userSessions', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(updatedSession, null, 2))
    return updatedSession
  }

  deleteUserSession(id: string): boolean {
    const filePath = path.join(this.dataPath, 'userSessions', `${this.safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      return false
    }

    fs.unlinkSync(filePath)
    return true
  }

  getAllUserSessions(): UserSession[] {
    const sessionsDir = path.join(this.dataPath, 'userSessions')

    if (!fs.existsSync(sessionsDir)) {
      return []
    }

    const files = fs
      .readdirSync(sessionsDir)
      .filter((file) => file.endsWith('.json'))
    const sessions: UserSession[] = []

    files.forEach((file) => {
      const filePath = path.join(sessionsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      sessions.push(JSON.parse(data) as UserSession)
    })

    return sessions
  }

  // Document Group operations
  saveDocumentGroup(group: Omit<DocumentGroup, 'id'>): DocumentGroup {
    const id = uuidv4()
    const groupWithId: DocumentGroup = { ...group, id }
    const filePath = path.join(this.dataPath, 'documentGroups', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(groupWithId, null, 2))
    return groupWithId
  }

  getDocumentGroup(id: string): DocumentGroup | null {
    const filePath = path.join(this.dataPath, 'documentGroups', `${this.safeId(id)}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const data = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(data) as DocumentGroup
  }

  updateDocumentGroup(
    id: string,
    updates: Partial<DocumentGroup>
  ): DocumentGroup | null {
    const group = this.getDocumentGroup(id)

    if (!group) {
      return null
    }

    const updatedGroup = { ...group, ...updates }
    const filePath = path.join(this.dataPath, 'documentGroups', `${this.safeId(id)}.json`)

    fs.writeFileSync(filePath, JSON.stringify(updatedGroup, null, 2))
    return updatedGroup
  }

  getAllDocumentGroups(): DocumentGroup[] {
    const groupsDir = path.join(this.dataPath, 'documentGroups')

    if (!fs.existsSync(groupsDir)) {
      return []
    }

    const files = fs
      .readdirSync(groupsDir)
      .filter((file) => file.endsWith('.json'))
    const groups: DocumentGroup[] = []

    files.forEach((file) => {
      const filePath = path.join(groupsDir, file)
      const data = fs.readFileSync(filePath, 'utf-8')
      groups.push(JSON.parse(data) as DocumentGroup)
    })

    return groups
  }
}
