# Deployment configuration and remaining setup

Target: Vercel frontend and Render backend, account 190020107022ait@gmail.com; GitHub axay7021 copies only.

## Prepared paid resource — not created

`render.yaml`: one Node 22 web service `document-analysis-api`, Oregon, plan 0.5c-512mb (512 MB RAM, 0.5 CPU), one instance, 1 GB private disk mounted at /var/data. Current list price: $7/month compute + $0.25/month disk = $7.25/month before tax or usage overages. Source: https://render.com/pricing (checked 29 October 2026). Owner approval is required before applying this paid configuration. If actual FAISS workload needs more RAM, any plan upgrade requires approval separately.

Persist accounts/documents/sessions in /var/data/storage, FAISS in /var/data/faiss and uploads in /var/data/uploads/documents. Free Render web services cannot attach disks and lose local state, so they are unsuitable for this file-backed app. Do not expose uploads from a static/public directory. The service uses a generated strong JWT_SECRET and binds 0.0.0.0:$PORT. Health: /api/v1/health. One process and one instance only for file-backed consistency.

Vercel project: repository root directory (not public/portfolio), framework Other, build command `node scripts/configure-frontend.mjs`, output directory `public/portfolio`, no install command needed. Set DOCUMENT_API_ORIGIN to the actual Render origin, without a path. This generates fixed public backend configuration; visitors do not supply backend URLs or tokens. The UI includes normal registration/login and uses the authenticated backend for upload and SSE chat. Without a configured backend, it clearly reports that setup is pending and does not run a local demo.

Security changes: removed cross-document RAG fallback in both paths; empty document allowlists never search globally; invalid record paths are rejected; revoked/expired/inactive sessions are rejected using parsed disk dates and matching user identity; insecure JWT fallback removed. The separate Socket.IO transport is disabled pending a complete session-revocation review; the deployed frontend uses SSE. Existing agent/session ownership checks remain in place. Regression tests cover both RAG paths, empty allowlists, path traversal, disk-loaded sessions and logout.

## TODO — owner adds provider key later

- [ ] Approve $7.25/month Render configuration, then apply render.yaml.
- [ ] Leave OPENAI_API_KEY empty; owner adds it in Render Environment later.
- [ ] Authorize Vercel scope access, deploy frontend with actual DOCUMENT_API_ORIGIN, and set FRONTEND_URL on backend.
- [ ] Redeploy after key configuration.
- [ ] Verify real signup/login, isolation between two users, upload/index persistence across restart, OpenAI embeddings and SSE chat end to end.
- [ ] Add the real frontend URL to the portfolio only after deployment and verification.

Local passing tests do not establish live AI functionality. Runtime data, test accounts and secrets must never be committed.
