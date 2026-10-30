import OpenAI from 'openai'
import config from '../config'

export function aiConfigured(): boolean {
  return Boolean(
    config.AI_PROVIDER === 'google'
      ? config.GOOGLE_GENAI_API_KEY
      : config.OPENAI_API_KEY
  )
}
export function createAIClient(): OpenAI | null {
  const google = config.AI_PROVIDER === 'google'
  const apiKey = google ? config.GOOGLE_GENAI_API_KEY : config.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({
    apiKey,
    ...(google
      ? { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' }
      : {}),
  })
}
export function chatModel(): string {
  return (
    config.AI_CHAT_MODEL ||
    (config.AI_PROVIDER === 'google' ? 'gemini-3.1-flash-lite' : 'gpt-4.1')
  )
}
