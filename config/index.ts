import dotenvFlow from 'dotenv-flow'

dotenvFlow.config()

const config = {
  // General
  ENV: process.env.ENV as string,
  PORT: process.env.PORT,

  // Email Configuration
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY as string,
  DEFAULT_FROM_EMAIL: process.env.DEFAULT_FROM_EMAIL as string,

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL as string,

  // AI Integration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY as string,
  GOOGLE_GENAI_API_KEY: process.env.GOOGLE_GENAI_API_KEY as string,

  // Authentication
  JWT_SECRET:
    process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',

  // File Storage
  DATA_STORAGE_PATH: process.env.DATA_STORAGE_PATH || './data/storage',
  FAISS_INDEX_PATH: process.env.FAISS_INDEX_PATH || './data/faiss',

  companyName: 'Softcolon',

  TOKEN_HEADER_NAME: 'authorization',
}

export { config }
export default config
