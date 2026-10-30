import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'
import { config } from '../config'
import { FileStorage } from './fileStorage.service'
import { AuthError } from './authError'
import {
  verificationMailer,
  type VerificationMailer,
} from './verificationMailer'
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
  PublicUser,
  VerificationPending,
} from '../types/types'

export class AuthService {
  private storage = new FileStorage()
  private readonly saltRounds = 12
  private readonly jwtSecret = config.JWT_SECRET
  constructor(
    private readonly mailer: VerificationMailer = verificationMailer
  ) {}

  async register(userData: RegisterRequest): Promise<VerificationPending> {
    if (!this.mailer.configured())
      throw new AuthError(
        'EMAIL_NOT_CONFIGURED',
        'Email verification delivery is not configured yet.',
        503
      )
    const email = userData.email.trim().toLowerCase()
    if (
      this.storage
        .getAllUsers()
        .some((user) => user.email.toLowerCase() === email)
    ) {
      throw new AuthError(
        'ACCOUNT_EXISTS',
        'An account with this email already exists. Sign in or resend verification.',
        409
      )
    }
    const password = await bcrypt.hash(userData.password, this.saltRounds)
    // Recheck after the async hash to avoid concurrent duplicate registrations.
    if (
      this.storage
        .getAllUsers()
        .some((user) => user.email.toLowerCase() === email)
    ) {
      throw new AuthError(
        'ACCOUNT_EXISTS',
        'An account with this email already exists. Sign in or resend verification.',
        409
      )
    }
    const user = this.storage.saveUser({
      email,
      password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      emailVerified: false,
    })
    await this.sendVerification(user)
    return { requiresEmailVerification: true, email }
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const user = this.storage
      .getAllUsers()
      .find(
        (u) => u.email.toLowerCase() === credentials.email.trim().toLowerCase()
      )
    if (
      !user ||
      !user.isActive ||
      !(await bcrypt.compare(credentials.password, user.password))
    ) {
      throw new AuthError(
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
        401
      )
    }
    if (!user.emailVerified)
      throw new AuthError(
        'EMAIL_NOT_VERIFIED',
        'Verify your email before signing in. Request a verification code below.',
        403
      )
    return this.issueSession(user)
  }

  async resendVerification(email: string): Promise<void> {
    if (!this.mailer.configured())
      throw new AuthError(
        'EMAIL_NOT_CONFIGURED',
        'Email verification delivery is not configured yet.',
        503
      )
    const user = this.storage
      .getAllUsers()
      .find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!user || !user.isActive || user.emailVerified) return
    const elapsed =
      Date.now() - new Date(user.verificationSentAt || 0).getTime()
    if (elapsed < 60000) return
    await this.sendVerification(user)
  }

  private async sendVerification(user: User): Promise<void> {
    const code = randomInt(0, 1000000).toString().padStart(6, '0')
    const verificationHash = createHash('sha256')
      .update(code + ':' + user.id + ':' + this.jwtSecret)
      .digest('hex')
    this.storage.updateUser(user.id, {
      verificationHash,
      verificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      verificationSentAt: new Date(),
      verificationAttempts: 0,
    })
    try {
      await this.mailer.send(user.email, code)
    } catch (error) {
      this.storage.updateUser(user.id, {
        verificationHash: undefined,
        verificationSentAt: undefined,
      })
      throw error
    }
  }

  async verifyEmail(email: string, code: string): Promise<AuthResponse> {
    const user = this.storage
      .getAllUsers()
      .find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    const invalid = () =>
      new AuthError(
        'INVALID_VERIFICATION',
        'The code is invalid or expired. Request a new code.',
        400
      )
    if (
      !/^\d{6}$/.test(code) ||
      !user ||
      !user.isActive ||
      user.emailVerified ||
      !user.verificationHash ||
      Date.now() >= new Date(user.verificationExpiresAt || 0).getTime() ||
      (user.verificationAttempts || 0) >= 5
    )
      throw invalid()
    const supplied = createHash('sha256')
      .update(code + ':' + user.id + ':' + this.jwtSecret)
      .digest()
    const stored = Buffer.from(user.verificationHash, 'hex')
    this.storage.updateUser(user.id, {
      verificationAttempts: (user.verificationAttempts || 0) + 1,
    })
    if (stored.length !== supplied.length || !timingSafeEqual(stored, supplied))
      throw invalid()
    const verified = this.storage.updateUser(user.id, {
      emailVerified: true,
      verificationHash: undefined,
      verificationExpiresAt: undefined,
      verificationAttempts: undefined,
      verificationSentAt: undefined,
      updatedAt: new Date(),
    })
    if (!verified) throw invalid()
    return this.issueSession(verified)
  }

  async loginWithGoogle(identity: {
    subject: string
    email: string
    firstName: string
    lastName: string
  }): Promise<AuthResponse> {
    const users = this.storage.getAllUsers()
    let user = users.find((u) => u.googleSubject === identity.subject)
    if (user && (!user.isActive || !user.emailVerified))
      throw new AuthError(
        'ACCOUNT_DISABLED',
        'This account is not available.',
        403
      )
    if (!user) {
      // Never silently link a Google identity to an existing password account.
      if (
        users.some(
          (u) => u.email.toLowerCase() === identity.email.toLowerCase()
        )
      ) {
        throw new AuthError(
          'USE_PASSWORD',
          'An account with this email already exists. Please sign in with your password.',
          409
        )
      }
      const password = await bcrypt.hash(
        randomBytes(48).toString('hex'),
        this.saltRounds
      )
      const current = this.storage.getAllUsers()
      user = current.find((u) => u.googleSubject === identity.subject)
      if (
        !user &&
        current.some(
          (u) => u.email.toLowerCase() === identity.email.toLowerCase()
        )
      )
        throw new AuthError(
          'USE_PASSWORD',
          'Please sign in with your existing password.',
          409
        )
      if (!user)
        user = this.storage.saveUser({
          email: identity.email.toLowerCase(),
          password,
          firstName: identity.firstName,
          lastName: identity.lastName,
          googleSubject: identity.subject,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        })
    }
    return this.issueSession(user)
  }

  private issueSession(user: User): AuthResponse {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const token = jwt.sign({ userId: user.id }, this.jwtSecret, {
      expiresIn: '7d',
      issuer: 'ai-chat-platform',
      audience: 'document-analysis',
      subject: user.id,
      jwtid: randomUUID(),
    })
    this.storage.saveUserSession({
      userId: user.id,
      token,
      expiresAt,
      createdAt: new Date(),
      isActive: true,
    })
    const updated =
      this.storage.updateUser(user.id, { lastLoginAt: new Date() }) || user
    return { user: this.sanitizeUser(updated), token, expiresAt }
  }

  async logout(token: string): Promise<void> {
    for (const session of this.storage
      .getAllUserSessions()
      .filter((s) => s.token === token && s.isActive)) {
      this.storage.updateUserSession(session.id, { isActive: false })
    }
  }

  async validateToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'ai-chat-platform',
        audience: 'document-analysis',
      }) as { userId: string }
      const session = this.storage
        .getAllUserSessions()
        .find(
          (s) =>
            s.token === token &&
            s.userId === decoded.userId &&
            s.isActive &&
            Date.now() < new Date(s.expiresAt).getTime()
        )
      if (!session) return null
      const user = this.storage.getUser(decoded.userId)
      return user?.isActive && user.emailVerified ? user : null
    } catch {
      return null
    }
  }

  private sanitizeUser(user: User): PublicUser {
    const {
      password,
      verificationHash,
      verificationExpiresAt,
      verificationSentAt,
      verificationAttempts,
      googleSubject,
      ...publicUser
    } = user
    return publicUser
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = this.storage.getUser(userId)
    if (!user) {
      throw new Error('User not found')
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    )
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
  getUserById(userId: string): PublicUser | null {
    const user = this.storage.getUser(userId)
    if (!user) {
      return null
    }
    return this.sanitizeUser(user)
  }

  /**
   * Update user profile
   */
  updateProfile(
    userId: string,
    updates: Partial<Pick<User, 'firstName' | 'lastName'>>
  ): PublicUser | null {
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
