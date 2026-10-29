import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

import { config } from '../config'
import { FileStorage } from './fileStorage.service'
import type { AuthResponse, LoginRequest, RegisterRequest, User, UserSession } from '../types/types'
import logger from '../utils/logger'

export class AuthService {
  private storage: FileStorage
  private readonly saltRounds = 12
  private readonly jwtSecret: string
  private readonly jwtExpirationTime = '7d'

  constructor() {
    this.storage = new FileStorage()
    this.jwtSecret = config.JWT_SECRET
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    // Check if user already exists
    const existingUsers = this.storage.getAllUsers()
    const userExists = existingUsers.find((user) => user.email.toLowerCase() === userData.email.toLowerCase())
    
    if (userExists) {
      throw new Error('User with this email already exists')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, this.saltRounds)

    // Create user
    const newUser: Omit<User, 'id'> = {
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      firstName: userData.firstName,
      lastName: userData.lastName,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    }

    const savedUser = this.storage.saveUser(newUser)

    // Generate token and session
    const { token, expiresAt } = this.generateToken(savedUser.id)
    await this.createSession(savedUser.id, token, expiresAt)

    return {
      user: this.sanitizeUser(savedUser),
      token,
      expiresAt,
    }
  }

  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const users = this.storage.getAllUsers()
    const user = users.find((u) => u.email.toLowerCase() === credentials.email.toLowerCase())

    if (!user || !user.isActive) {
      throw new Error('Invalid credentials')
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
    if (!isPasswordValid) {
      throw new Error('Invalid credentials')
    }

    // Update last login
    const updatedUser = this.storage.updateUser(user.id, { lastLoginAt: new Date() })
    if (!updatedUser) {
      throw new Error('Failed to update user login time')
    }

    // Generate token and session
    const { token, expiresAt } = this.generateToken(user.id)
    await this.createSession(user.id, token, expiresAt)

    return {
      user: this.sanitizeUser(updatedUser),
      token,
      expiresAt,
    }
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(token: string): Promise<void> {
    const sessions = this.storage.getAllUserSessions()
    const session = sessions.find((s) => s.token === token && s.isActive)
    
    if (session) {
      this.storage.updateUserSession(session.id, { isActive: false })
    }
  }

  /**
   * Validate token and get user
   */
  async validateToken(token: string): Promise<User | null> {
    try {
      // Verify JWT
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string }
      
      // Check session exists and is active
      const sessions = this.storage.getAllUserSessions()
      const session = sessions.find((s) => 
        s.token === token && 
        s.userId === decoded.userId && 
        s.isActive && 
        new Date() < new Date(s.expiresAt)
      )

      if (!session) {
        return null
      }

      // Get user
      const user = this.storage.getUser(decoded.userId)
      if (!user || !user.isActive) {
        return null
      }

      return user
    } catch (error) {
      logger.error('Token validation failed:', error)
      return null
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(userId: string): { token: string; expiresAt: Date } {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

    const token = jwt.sign(
      { userId },
      this.jwtSecret,
      { 
        expiresIn: this.jwtExpirationTime,
        issuer: 'ai-chat-platform',
        subject: userId,
      }
    )

    return { token, expiresAt }
  }

  /**
   * Create user session
   */
  private async createSession(userId: string, token: string, expiresAt: Date): Promise<UserSession> {
    const session: Omit<UserSession, 'id'> = {
      userId,
      token,
      expiresAt,
      createdAt: new Date(),
      isActive: true,
    }

    return this.storage.saveUserSession(session)
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: User): Omit<User, 'password'> {
    const { password, ...sanitizedUser } = user
    return sanitizedUser
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.storage.getUser(userId)
    if (!user) {
      throw new Error('User not found')
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect')
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, this.saltRounds)

    // Update user
    this.storage.updateUser(userId, { 
      password: hashedNewPassword,
      updatedAt: new Date(),
    })
  }

  /**
   * Get user by ID (without password)
   */
  getUserById(userId: string): Omit<User, 'password'> | null {
    const user = this.storage.getUser(userId)
    if (!user) {
      return null
    }
    return this.sanitizeUser(user)
  }

  /**
   * Update user profile
   */
  updateProfile(userId: string, updates: Partial<Pick<User, 'firstName' | 'lastName'>>): Omit<User, 'password'> | null {
    const updatedUser = this.storage.updateUser(userId, {
      ...updates,
      updatedAt: new Date(),
    })

    if (!updatedUser) {
      return null
    }

    return this.sanitizeUser(updatedUser)
  }
}