# Document Analysis — RAG API & Evidence Workspace

A TypeScript/Express document intelligence backend with a new portfolio interface for document selection, uploads, chat and source evidence. The repository contains **both backend and frontend**; the frontend is in `public/portfolio`.

## Try the browser demo

```sh
node scripts/serve-portfolio.mjs
```

Open `http://127.0.0.1:4175/?preview=1` to review the full-height chat redesign with a clearly labelled fictional document and sample responses. No account, install or AI key is required, and preview mode sends no requests to the live backend. Try a suggested question, Sources, the collapsible library and New chat. Preview mode is restricted to localhost/127.0.0.1.

Open `http://127.0.0.1:4175/` for the standard connected interface. Uploads and live answers use the existing backend and require sign-in.

See [UI_DESIGN.md](UI_DESIGN.md) for the proposed flow and verification scope. The redesign includes responsive library/source drawers and light/dark appearance controls. The owner has approved production release.

![Chat workspace redesign](docs/chat-redesign-desktop.png)

## Existing backend capabilities

- PDF, TXT and Markdown ingestion, chunking and embeddings.
- FAISS vector search and retrieval-augmented chat.
- Agent/prompt management, file-backed application records and JWT authentication.
- Streaming answers over Server-Sent Events and Socket.IO.

```mermaid
flowchart LR
  UI[Evidence workspace] --> API[Express API]
  API --> Auth[JWT authentication]
  API --> Ingest[Extract / chunk / embed]
  Ingest --> Index[(FAISS)]
  API --> RAG[Retrieve context]
  Index --> RAG
  RAG --> Model[Configured AI provider]
  Model --> SSE[Streaming answer + source references]
  SSE --> UI
```

## Run the connected backend

Use Node.js 20+, pnpm and a host that supports native `faiss-node` bindings. FAISS and the embedding pipeline have native/model dependencies; a static-only host cannot run this backend.

```sh
pnpm install
cp .env.example .env
# Set a strong JWT_SECRET and the model provider keys used by the services.
pnpm dev
```

The example port is 3000. API health: `/api/v1/health`. With the backend running, open `/portfolio/index.html` on the same origin, or use **Connect backend** in the standalone demo. Enter the backend origin and an account you registered through `POST /api/v1/auth/register`:

```json
{"email":"you@example.com","password":"your-own-strong-password","firstName":"Your","lastName":"Name"}
```

The UI signs in through `/api/v1/auth/login`, uploads to `/api/v1/prompts/create`, creates a chat session and consumes the existing message SSE stream. Uploads support PDF/TXT/Markdown up to 10 MB per file. Connected mode sends documents to your backend. Tokens are kept only in tab memory; remote backend connections require HTTPS.

## Public copy hygiene and verification limits

Runtime user records, sessions, stored prompts, uploads and vector indexes were removed from the **copied Git history** before publication. Original source repositories and local archives were not modified. Generated data is ignored going forward. Commit hashes differ from the original because of this cleanup.

The portfolio UI is tested with a mocked API contract. A live end-to-end model response still requires native dependencies, valid service credentials and an operational backend. The existing RAG and authentication code is a proof of concept and has not been audited for public multi-user production use.
