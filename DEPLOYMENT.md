# Deployment configuration and remaining setup

Target: Vercel frontend and Render backend, account 190020107022ait@gmail.com; GitHub axay7021 copies only.

## Free evaluation deployment

The owner requested free plans only. `render.yaml` uses one free Node 22 web service, one instance, with no paid disk. Accounts, sessions, uploaded documents and the FAISS index are stored in the service's private ephemeral filesystem and are lost when Render spins the service down, restarts it or deploys a new revision. This is an evaluation deployment, not durable document storage. Do not use it as the only copy of a document. No paid resource or upgrade is authorized.

JWT_SECRET is generated securely, and the server binds 0.0.0.0:$PORT. Health: /api/v1/health.

Vercel project: repository root directory (not public/portfolio), framework Other, build command `node scripts/configure-frontend.mjs`, output directory `public/portfolio`, no install command needed. Set DOCUMENT_API_ORIGIN to the actual Render origin, without a path. This generates fixed public backend configuration; visitors do not supply backend URLs or tokens. The UI includes normal registration/login and uses the authenticated backend for upload and SSE chat. Without a configured backend, it clearly reports that setup is pending and does not run a local demo.

Security changes: removed cross-document RAG fallback in both paths; empty document allowlists never search globally; invalid record paths are rejected; revoked/expired/inactive sessions are rejected using parsed disk dates and matching user identity; insecure JWT fallback removed. The separate Socket.IO transport is disabled pending a complete session-revocation review; the deployed frontend uses SSE. Existing agent/session ownership checks remain in place. Regression tests cover both RAG paths, empty allowlists, path traversal, disk-loaded sessions and logout.

## TODO — owner adds provider key later

- [ ] Deploy the free Render configuration with no disk; disclose ephemeral storage.
- [ ] Leave OPENAI_API_KEY empty; owner adds it in Render Environment later.
- [ ] Authorize Vercel scope access, deploy frontend with actual DOCUMENT_API_ORIGIN, and set FRONTEND_URL on backend.
- [ ] Redeploy after key configuration.
- [ ] Verify real signup/login, isolation between two users, expected reset behavior after a free instance restart, OpenAI embeddings and SSE chat end to end.
- [ ] Add the real frontend URL to the portfolio only after deployment and verification.

Local passing tests do not establish live AI functionality. Runtime data, test accounts and secrets must never be committed.

## Local verification completed (29 October 2026)

TypeScript build and four security regression tests pass. HTTP checks pass with an empty OpenAI key: health 200; two separate registrations/logins; owner can read their session; second user receives 404 for that session; AI message request returns 503 AI_NOT_CONFIGURED; logout revokes access (profile returns 401). These used synthetic accounts in a temporary directory outside the repository. Both Render YAML files pass the current public Blueprint JSON schema; the Render CLI is not installed, so platform-aware validation remains pending.

## Hosting update — 30 October 2026

Vercel personal workspace access is approved. The project is created under team_VifP2fo09snOry74VZ0VlNYH. Earlier 403/access-grant notes above are historical and no longer the blocker.

Public production frontend: https://document-analysis-ivory.vercel.app
Vercel project ID: prj_PMYPfF6DSHF0FWVQSBdaiohAWsuZ

This is a real application deployment, with explicit unavailable/configuration-pending states where required services are missing. It does not imply that AI, authentication, storage or billing integrations are operational. Provider keys remain empty intentionally.

Vercel GitHub integration was unavailable for repository import. The current deployment uses a direct source wrapper that downloads an immutable public GitHub commit before installation/build. Private .env files are excluded. Automatic Git deployments remain TODO; install the Vercel GitHub integration and link this repository to enable them. Use pinned pnpm versions for both install and build, because Vercel's fallback pnpm version can be too old for these manifests.

The custom frontend domain is attached in Vercel but its Name.com DNS records have not been applied. Domain ownership verification is not proof that DNS routing or TLS is ready. Preserve existing portfolio and email records. See the task-level DNS_RECORDS.md for the returned per-project CNAME targets.
