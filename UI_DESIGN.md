# Research workspace interface

Design guidance: UI UX Pro Max (nextlevelbuilder/ui-ux-pro-max-skill), reviewed 30 October 2026.

Direction: a light research workspace with slate text, restrained blue accents and three columns for library, conversation and source evidence. The broad document-search query initially suggested an irrelevant marketplace pattern; a narrower document-management query informed the trusted blue palette and light surfaces. Generic marketing/glass effects were not used for dense research controls.

Existing live backend, auth, upload and SSE handlers are retained. All handler IDs are preserved. Mobile layouts stack sections without horizontal overflow. Native dialog keyboard behavior is retained, registration name fields appear only in registration mode, and clear empty/error/status states explain required setup. No documents or AI answers are fabricated. Temporary free-tier storage and provider setup requirements remain visible.

Checks: JavaScript syntax, responsive visual review at 375/768/1024/1440, sign-in dialog/registration toggle/Escape dismissal, unauthenticated question feedback, and reduced motion. Live indexing/answers require the owner-supplied AI key.
