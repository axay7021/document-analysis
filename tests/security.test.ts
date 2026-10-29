import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.JWT_SECRET = randomBytes(48).toString('hex')
process.env.DATA_STORAGE_PATH = mkdtempSync(join(tmpdir(), 'document-security-'))
process.env.FAISS_INDEX_PATH = join(process.env.DATA_STORAGE_PATH, 'faiss')
process.env.OPENAI_API_KEY = ''

void test('empty document allowlists do not search, embed or call a provider', async () => {
  const { RAGService } = await import('../services/rag.service')
  const service = new RAGService()
  for (const streaming of [false, true]) {
    const result = streaming
      ? await service.generateStreamingResponse({ message: 'private?', docIds: [] }, () => {})
      : await service.generateResponse({ message: 'private?', docIds: [] })
    assert.deepEqual(result.referencedChunks, [])
  }
})

void test('both RAG paths reject foreign chunks when requested documents have no matches', async () => {
  const { RAGService } = await import('../services/rag.service')
  const service = new RAGService() as any
  service.isInitialized = true
  let providerCalls = 0
  service.openai = { chat: { completions: { create: () => { providerCalls++; throw new Error('must not call') } } } }
  service.embeddingService = { generateEmbedding: async () => [1, 0, 0] }
  service.vectorService = {
    getStats: () => ({ totalVectors: 1 }),
    searchSimilar: () => [{ chunkId: 'foreign', score: 1, chunk: { documentId: 'other-user-document', content: 'PRIVATE OTHER USER CONTENT' } }],
  }
  for (const streaming of [false, true]) {
    const chunks: unknown[] = []
    const result = streaming
      ? await service.generateStreamingResponse({ message: 'secret?', docIds: ['my-document'] }, (c: unknown) => chunks.push(c))
      : await service.generateResponse({ message: 'secret?', docIds: ['my-document'] })
    assert.deepEqual(result.referencedChunks, [])
    assert.ok(!JSON.stringify([result, chunks]).includes('PRIVATE OTHER USER'))
  }
  assert.equal(providerCalls, 0)
})

void test('sessions remain valid after reading dates from disk and logout revokes them', async () => {
  const { AuthService } = await import('../services/auth.service')
  const service = new AuthService()
  const registration = await service.register({ email: 'synthetic@example.test', password: randomBytes(24).toString('hex'), firstName: 'Synthetic', lastName: 'Test' })
  assert.ok(await service.validateToken(registration.token))
  await service.logout(registration.token)
  assert.equal(await service.validateToken(registration.token), null)
})

void test('record IDs cannot escape the private storage root', async () => {
  const { FileStorage } = await import('../services/fileStorage.service')
  assert.throws(() => new FileStorage().getDocument('../users/private'), /Invalid record ID/)
})
