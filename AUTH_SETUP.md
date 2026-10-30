# Authentication setup

Email/password stays available, with email verification required before a session is issued. Google OAuth is an additional sign-in method. Provider credentials are intentionally blank until the owner configures them.

## Email delivery

Choose SMTP (for example Gmail with an app password) or the existing SendGrid integration. Never use a regular Gmail password.

SMTP environment variables on the Render backend:

- SMTP_HOST=smtp.gmail.com
- SMTP_PORT=587 (STARTTLS), or 465 for implicit TLS
- SMTP_USER: sender email
- SMTP_PASSWORD: app password or SMTP credential
- SMTP_FROM: authorized sender address, optional; defaults to SMTP_USER

Alternatively configure SENDGRID_API_KEY and a verified DEFAULT_FROM_EMAIL. Registration fails safely with 503 before creating an account if neither email provider is configured. No real emails were sent during development tests.

Codes expire in 15 minutes, are stored as keyed hashes, have five attempts, cannot be reused, and can be resent at most once per minute. Rate limits apply to auth endpoints. Unverified existing accounts must request a code before signing in; old unverified sessions are rejected.

## Google OAuth

Create a Google Cloud OAuth client of type Web application, requesting only openid, email and profile. Add this exact authorized redirect URI:

https://document-analysis-api-bco5.onrender.com/api/v1/auth/google/callback

Configure these Render environment variables:

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI=https://document-analysis-api-bco5.onrender.com/api/v1/auth/google/callback
- AUTH_FRONTEND_URL=https://documents.akshaydobariya.dev

Use the canonical .dev frontend for Google sign-in. The .com frontend redirects to it. Google test-mode consent may require adding test users until the consent app is published. No billing upgrade is required by this implementation.

The Google library exchanges authorization codes and verifies ID token signatures, audience, issuer and expiry. The app additionally binds state, nonce, PKCE and an expiring HttpOnly flow cookie. The browser receives a single-use, one-minute exchange code bound to a per-tab proof; no Google token or application session token is placed in a URL. Existing password accounts are never silently linked to Google. Google accounts with third-party emails without a hosted-domain claim must verify their email through the password flow.

## Deployment and verification

Set secrets in the Render environment and keep matching local values in the ignored private .env. Never commit secrets. The frontend obtains readiness booleans only from /api/v1/auth/config and keeps application tokens only in tab memory.

Unit tests use synthetic mailers and mocked Google token exchange. Real Google consent and real mailbox delivery still need the owner's credentials and an end-to-end check. The free Render service uses ephemeral storage, so accounts, verification state and sessions can reset on restart or sleep.
