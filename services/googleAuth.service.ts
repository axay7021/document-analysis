import {
  OAuth2Client,
  CodeChallengeMethod,
  type TokenPayload,
} from 'google-auth-library'
import jwt from 'jsonwebtoken'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { config } from '../config'
import { AuthService } from './auth.service'
import { AuthError } from './authError'
import type { AuthResponse } from '../types/types'

const digest = (value: string) =>
  createHash('sha256').update(value).digest('base64url')
const equal = (left: string, right: string) => {
  const a = Buffer.from(left),
    b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
interface Flow {
  state: string
  nonce: string
  verifier: string
  challenge: string
}
interface Handoff {
  response: AuthResponse
  challenge: string
  expires: number
}
const handoffs = new Map<string, Handoff>()
const frontend = () =>
  new URL(
    process.env.AUTH_FRONTEND_URL || 'https://documents.akshaydobariya.dev'
  ).origin
const redirectUri = () =>
  process.env.GOOGLE_REDIRECT_URI ||
  'https://document-analysis-api-bco5.onrender.com/api/v1/auth/google/callback'

export function validateGoogleIdentity(
  payload: (TokenPayload & { nonce?: string }) | undefined,
  nonce: string
) {
  if (
    !payload?.sub ||
    !payload.email ||
    payload.email_verified !== true ||
    !equal(payload.nonce || '', nonce)
  ) {
    throw new AuthError(
      'INVALID_GOOGLE_IDENTITY',
      'Google could not verify this sign-in. Please try again.',
      401
    )
  }
  // For third-party email addresses Google may not be authoritative, even with email_verified.
  if (!payload.email.toLowerCase().endsWith('@gmail.com') && !payload.hd) {
    throw new AuthError(
      'EMAIL_PROOF_REQUIRED',
      'Use email and password to verify this email address directly.',
      403
    )
  }
  return {
    subject: payload.sub,
    email: payload.email,
    firstName: payload.given_name || 'Google',
    lastName: payload.family_name || 'User',
  }
}

export class GoogleAuthService {
  configured() {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    )
  }
  private client() {
    if (!this.configured())
      throw new AuthError(
        'GOOGLE_NOT_CONFIGURED',
        'Google sign-in is not configured yet.',
        503
      )
    return new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri()
    )
  }
  async begin(challenge: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(challenge))
      throw new AuthError(
        'INVALID_FLOW',
        'Start Google sign-in from the application.',
        400
      )
    const client = this.client()
    const { codeVerifier, codeChallenge } =
      await client.generateCodeVerifierAsync()
    if (!codeChallenge) throw new Error('Missing PKCE challenge')
    const state = randomBytes(32).toString('base64url'),
      nonce = randomBytes(32).toString('base64url')
    const cookie = jwt.sign(
      { state, nonce, verifier: codeVerifier, challenge },
      config.JWT_SECRET,
      {
        issuer: 'document-google-flow',
        audience: 'document-google-callback',
        expiresIn: '10m',
        algorithm: 'HS256',
      }
    )
    const url = client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account',
    })
    return { cookie, url }
  }
  async callback(cookie: string, state: string, code: string) {
    let flow: Flow
    try {
      flow = jwt.verify(cookie, config.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'document-google-flow',
        audience: 'document-google-callback',
      }) as Flow
    } catch {
      throw new AuthError(
        'INVALID_FLOW',
        'Google sign-in expired. Please start again.',
        400
      )
    }
    if (!state || !code || !equal(flow.state, state))
      throw new AuthError(
        'INVALID_FLOW',
        'Google sign-in could not be validated. Please start again.',
        400
      )
    const client = this.client()
    const { tokens } = await client.getToken({
      code,
      codeVerifier: flow.verifier,
      redirect_uri: redirectUri(),
    })
    if (!tokens.id_token)
      throw new AuthError(
        'INVALID_GOOGLE_IDENTITY',
        'Google did not return an identity token.',
        401
      )
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const identity = validateGoogleIdentity(ticket.getPayload(), flow.nonce)
    const response = await new AuthService().loginWithGoogle(identity)
    for (const [key, item] of handoffs)
      if (item.expires <= Date.now()) handoffs.delete(key)
    if (handoffs.size >= 1000)
      throw new AuthError('BUSY', 'Please try again shortly.', 503)
    const handoff = randomBytes(32).toString('base64url')
    handoffs.set(digest(handoff), {
      response,
      challenge: flow.challenge,
      expires: Date.now() + 60000,
    })
    return frontend() + '/#auth_code=' + encodeURIComponent(handoff)
  }
  exchange(
    code: string,
    verifier: string,
    requestOrigin: string
  ): AuthResponse {
    if (requestOrigin !== frontend())
      throw new AuthError(
        'INVALID_ORIGIN',
        'Sign in from the application domain.',
        403
      )
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(code) ||
      !/^[A-Za-z0-9_-]{43}$/.test(verifier)
    )
      throw new AuthError(
        'INVALID_FLOW',
        'Google sign-in expired. Please start again.',
        400
      )
    const key = digest(code),
      item = handoffs.get(key)
    if (
      !item ||
      item.expires <= Date.now() ||
      !equal(item.challenge, digest(verifier))
    )
      throw new AuthError(
        'INVALID_FLOW',
        'Google sign-in expired. Please start again.',
        400
      )
    handoffs.delete(key)
    return item.response
  }
  errorRedirect(code: string) {
    return frontend() + '/#auth_error=' + encodeURIComponent(code)
  }
}
