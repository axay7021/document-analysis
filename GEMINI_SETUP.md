# Gemini document analysis

Document Analysis supports Gemini through Google’s OpenAI-compatible endpoint, retaining the existing SSE protocol and ownership filtering. Set AI_PROVIDER=google, GOOGLE_GENAI_API_KEY, AI_CHAT_MODEL=gemini-3.1-flash-lite and AI_EMBEDDING_MODEL=gemini-embedding-001. Embeddings request exactly 1536 dimensions and are normalized before cosine retrieval. Use a separate FAISS_INDEX_PATH for a provider migration; never mix OpenAI and Gemini vectors in one index, even if dimensions match. Old indexes are not deleted.

A synthetic text-generation request and embedding request passed using the owner-authorized Finance Management Gemini key. No source financial data was sent. Secrets remain in hosting settings and private ignored .env files.
