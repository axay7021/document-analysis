import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.JWT_SECRET = randomBytes(48).toString('hex')
process.env.DATA_STORAGE_PATH = mkdtempSync(
  join(tmpdir(), 'document-security-')
)
process.env.FAISS_INDEX_PATH = join(process.env.DATA_STORAGE_PATH, 'faiss')
process.env.OPENAI_API_KEY = ''

void test('empty document allowlists do not search, embed or call a provider', async () => {
  const { RAGService } = await import('../services/rag.service')
  const service = new RAGService()
  for (const streaming of [false, true]) {
    const result = streaming
      ? await service.generateStreamingResponse(
          { message: 'private?', docIds: [] },
          () => {}
        )
      : await service.generateResponse({ message: 'private?', docIds: [] })
    assert.deepEqual(result.referencedChunks, [])
  }
})

void test('both RAG paths reject foreign chunks when requested documents have no matches', async () => {
  const { RAGService } = await import('../services/rag.service')
  const service = new RAGService() as any
  service.isInitialized = true
  let providerCalls = 0
  service.openai = {
    chat: {
      completions: {
        create: () => {
          providerCalls++
          throw new Error('must not call')
        },
      },
    },
  }
  service.embeddingService = { generateEmbedding: async () => [1, 0, 0] }
  service.vectorService = {
    getStats: () => ({ totalVectors: 1 }),
    searchSimilar: () => [
      {
        chunkId: 'foreign',
        score: 1,
        chunk: {
          documentId: 'other-user-document',
          content: 'PRIVATE OTHER USER CONTENT',
        },
      },
    ],
  }
  for (const streaming of [false, true]) {
    const chunks: unknown[] = []
    const result = streaming
      ? await service.generateStreamingResponse(
          { message: 'secret?', docIds: ['my-document'] },
          (c: unknown) => chunks.push(c)
        )
      : await service.generateResponse({
          message: 'secret?',
          docIds: ['my-document'],
        })
    assert.deepEqual(result.referencedChunks, [])
    assert.ok(!JSON.stringify([result, chunks]).includes('PRIVATE OTHER USER'))
  }
  assert.equal(providerCalls, 0)
})

void test('sessions remain valid after reading dates from disk and logout revokes them', async () => {
  const { AuthService } = await import('../services/auth.service')
  let code = ''
  const service = new AuthService({
    configured: () => true,
    send: async (_email, value) => {
      code = value
    },
  })
  const registration = await service.register({
    email: 'synthetic@example.test',
    password: randomBytes(24).toString('hex'),
    firstName: 'Synthetic',
    lastName: 'Test',
  })
  const verified = await service.verifyEmail(registration.email, code)
  assert.ok(await service.validateToken(verified.token))
  await service.logout(verified.token)
  assert.equal(await service.validateToken(verified.token), null)
})

void test('record IDs cannot escape the private storage root', async () => {
  const { FileStorage } = await import('../services/fileStorage.service')
  assert.throws(
    () => new FileStorage().getDocument('../users/private'),
    /Invalid record ID/
  )
})

void test('password signup issues no session until a one-time email code is verified', async () => {
  const { AuthService } = await import('../services/auth.service')
  const { FileStorage } = await import('../services/fileStorage.service')
  let code = '',
    sends = 0
  const service = new AuthService({
    configured: () => true,
    send: async (_email, value) => {
      code = value
      sends++
    },
  })
  const credentials = {
    email: 'verify-' + randomBytes(8).toString('hex') + '@example.test',
    password: randomBytes(24).toString('hex'),
  }
  const pending = await service.register({
    ...credentials,
    firstName: 'Verify',
    lastName: 'Test',
  })
  assert.equal(pending.requiresEmailVerification, true)
  assert.equal('token' in pending, false)
  await assert.rejects(service.login(credentials), {
    code: 'EMAIL_NOT_VERIFIED',
  })
  const storage = new FileStorage(),
    user = storage.getAllUsers().find((u) => u.email === credentials.email)!
  assert.notEqual(user.verificationHash, code)
  const wrong = code === '000000' ? '111111' : '000000'
  await assert.rejects(service.verifyEmail(credentials.email, wrong), {
    code: 'INVALID_VERIFICATION',
  })
  await service.resendVerification(credentials.email)
  assert.equal(sends, 1, 'resend is throttled')
  const verified = await service.verifyEmail(credentials.email, code)
  assert.equal(verified.user.emailVerified, true)
  assert.equal('verificationHash' in verified.user, false)
  assert.equal('password' in verified.user, false)
  await assert.rejects(service.verifyEmail(credentials.email, code), {
    code: 'INVALID_VERIFICATION',
  })
  const signedIn = await service.login(credentials)
  assert.notEqual(signedIn.token, verified.token, 'sessions have unique IDs')
  assert.ok(await service.validateToken(signedIn.token))
  await service.logout(signedIn.token)
  assert.equal(await service.validateToken(signedIn.token), null)
})

void test('expired codes and codes exceeding the attempt budget cannot verify accounts', async () => {
  const { AuthService } = await import('../services/auth.service')
  const { FileStorage } = await import('../services/fileStorage.service')
  let code = ''
  const service = new AuthService({
    configured: () => true,
    send: async (_email, value) => {
      code = value
    },
  })
  const email = 'expiry-' + randomBytes(8).toString('hex') + '@example.test'
  await service.register({
    email,
    password: randomBytes(24).toString('hex'),
    firstName: 'Expiry',
    lastName: 'Test',
  })
  const storage = new FileStorage(),
    user = storage.getAllUsers().find((u) => u.email === email)!
  storage.updateUser(user.id, {
    verificationExpiresAt: new Date(Date.now() - 1),
  })
  await assert.rejects(service.verifyEmail(email, code), {
    code: 'INVALID_VERIFICATION',
  })
  storage.updateUser(user.id, {
    verificationExpiresAt: new Date(Date.now() + 60000),
    verificationAttempts: 5,
  })
  await assert.rejects(service.verifyEmail(email, code), {
    code: 'INVALID_VERIFICATION',
  })
  assert.equal(storage.getUser(user.id)?.emailVerified, false)
})

void test('signup without an email delivery service fails before creating an account', async () => {
  const { AuthService } = await import('../services/auth.service')
  const { FileStorage } = await import('../services/fileStorage.service')
  const service = new AuthService({
    configured: () => false,
    send: async () => {
      throw new Error('must not send')
    },
  })
  const email =
    'not-configured-' + randomBytes(8).toString('hex') + '@example.test'
  await assert.rejects(
    service.register({
      email,
      password: 'Long-enough-test-password',
      firstName: 'Test',
      lastName: 'User',
    }),
    { code: 'EMAIL_NOT_CONFIGURED' }
  )
  assert.equal(
    new FileStorage().getAllUsers().some((u) => u.email === email),
    false
  )
})

void test('Google identity requires verified email and a matching nonce', async () => {
  const { validateGoogleIdentity } = await import(
    '../services/googleAuth.service'
  )
  const base = {
    iss: 'https://accounts.google.com',
    aud: 'synthetic',
    sub: 'synthetic-google-subject',
    iat: 0,
    exp: 9999999999,
    email: 'synthetic@gmail.com',
    email_verified: true,
    nonce: 'expected-nonce',
  }
  assert.equal(validateGoogleIdentity(base, 'expected-nonce').subject, base.sub)
  for (const candidate of [
    { ...base, nonce: 'wrong' },
    { ...base, email_verified: false },
    { ...base, email: 'third-party@example.test' },
  ]) {
    assert.throws(() => validateGoogleIdentity(candidate, 'expected-nonce'))
  }
})

void test('Google cannot silently link to an existing password account', async () => {
  const { AuthService } = await import('../services/auth.service')
  let code = ''
  const service = new AuthService({
    configured: () => true,
    send: async (_email, value) => {
      code = value
    },
  })
  const email = 'collision-' + randomBytes(8).toString('hex') + '@example.test'
  await service.register({
    email,
    password: 'Long-enough-test-password',
    firstName: 'Test',
    lastName: 'User',
  })
  await service.verifyEmail(email, code)
  await assert.rejects(
    service.loginWithGoogle({
      subject: 'other-google-subject',
      email,
      firstName: 'Google',
      lastName: 'User',
    }),
    { code: 'USE_PASSWORD' }
  )
})

void test('OAuth callback rejects forged flow cookies and handoff rejects an untrusted origin', async () => {
  const { GoogleAuthService } = await import('../services/googleAuth.service')
  const service = new GoogleAuthService()
  await assert.rejects(service.callback('forged', 'state', 'code'), {
    code: 'INVALID_FLOW',
  })
  assert.throws(
    () =>
      service.exchange(
        'x'.repeat(43),
        'y'.repeat(43),
        'https://attacker.example'
      ),
    { code: 'INVALID_ORIGIN' }
  )
  assert.throws(
    () =>
      service.exchange(
        'x'.repeat(43),
        'y'.repeat(43),
        'https://documents.akshaydobariya.dev'
      ),
    { code: 'INVALID_FLOW' }
  )
})

void test('Google authorization code flow binds state, PKCE, nonce and a single-use frontend handoff', async () => {
  const { GoogleAuthService } = await import('../services/googleAuth.service')
  const { OAuth2Client } = await import('google-auth-library')
  const { createHash } = await import('node:crypto')
  const jwt = (await import('jsonwebtoken')).default
  const previousId = process.env.GOOGLE_CLIENT_ID,
    previousSecret = process.env.GOOGLE_CLIENT_SECRET
  process.env.GOOGLE_CLIENT_ID = 'synthetic-client'
  process.env.GOOGLE_CLIENT_SECRET = 'synthetic-secret'
  const prototype = OAuth2Client.prototype as any
  const previousGet = prototype.getToken,
    previousVerify = prototype.verifyIdToken
  try {
    const service = new GoogleAuthService(),
      verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const flow = await service.begin(challenge)
    const payload = jwt.verify(flow.cookie, process.env.JWT_SECRET!, {
      issuer: 'document-google-flow',
      audience: 'document-google-callback',
    }) as any
    const authorization = new URL(flow.url)
    assert.equal(
      authorization.searchParams.get('code_challenge_method'),
      'S256'
    )
    assert.equal(authorization.searchParams.get('state'), payload.state)
    let tokenCalls = 0
    prototype.getToken = async (options: any) => {
      tokenCalls++
      assert.equal(options.codeVerifier, payload.verifier)
      return { tokens: { id_token: 'synthetic-id-token' } }
    }
    prototype.verifyIdToken = async (options: any) => {
      assert.equal(options.audience, 'synthetic-client')
      return {
        getPayload: () => ({
          sub: randomBytes(16).toString('hex'),
          email: 'oauth-' + randomBytes(8).toString('hex') + '@gmail.com',
          email_verified: true,
          nonce: payload.nonce,
        }),
      }
    }
    await assert.rejects(
      service.callback(flow.cookie, 'incorrect-state', 'synthetic-code'),
      { code: 'INVALID_FLOW' }
    )
    assert.equal(tokenCalls, 0)
    const redirect = new URL(
      await service.callback(flow.cookie, payload.state, 'synthetic-code')
    )
    const code = new URLSearchParams(redirect.hash.slice(1)).get('auth_code')!
    assert.throws(
      () =>
        service.exchange(
          code,
          randomBytes(32).toString('base64url'),
          redirect.origin
        ),
      { code: 'INVALID_FLOW' }
    )
    const response = service.exchange(code, verifier, redirect.origin)
    assert.equal(response.user.emailVerified, true)
    assert.throws(() => service.exchange(code, verifier, redirect.origin), {
      code: 'INVALID_FLOW',
    })
  } finally {
    prototype.getToken = previousGet
    prototype.verifyIdToken = previousVerify
    if (previousId === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = previousId
    if (previousSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET
    else process.env.GOOGLE_CLIENT_SECRET = previousSecret
  }
})
