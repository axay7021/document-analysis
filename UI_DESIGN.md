# Document Analysis chat redesign

Design guidance: UI/UX Pro Max, 31 October 2026. The design-system search recommended Minimalism & Swiss Style: light surfaces, slate text, restrained blue accents and generous reading space. Its generic marketing-page pattern was not applied; this is a document conversation tool.

## Proposed experience

Open directly into the full-height workspace. The left sidebar contains the document library, upload, new chat and account controls. The center holds a readable conversation with a composer that remains visible while history scrolls. Sources open on demand beside the chat on wide screens, and as an accessible drawer at smaller widths. The library collapses for additional reading room and becomes a drawer on mobile. No extra navigation page is required to start chatting.

Long-form answers use 16px text, structured headings and lists. Assistant messages use the canvas rather than cramped cards. User questions are visually distinct. Answers offer copy and source actions. Desktop Enter submits; Shift + Enter inserts a line break. Mobile keyboards retain multiline entry with a separate send button. A document's current conversation and server session stay separate from other documents in the current browser tab. New chat resets only the selected document's conversation. This does not add persistent chat history across refreshes.

## Appearance

Light and dark modes share semantic surface and text tokens. The top-right toggle saves an explicit preference in browser storage; otherwise the workspace follows system appearance, including system changes while open. Theme initialization runs before the stylesheet to avoid a bright flash. The same theme covers chat, source and library drawers, and authentication dialogs.

## Review locally

Run `node scripts/serve-portfolio.mjs` and open:

- `http://127.0.0.1:4175/?preview=1`: labelled fictional document and sample responses; no login, AI call or live backend traffic. Choose a suggested question, open Sources, collapse the library and try New chat.
- `http://127.0.0.1:4175/`: standard interface using the existing configured backend and sign-in flow.

The sample module is loaded only when the hostname is localhost/127.0.0.1 and `preview=1` is explicitly requested. Sample text is never presented as a generated answer in the normal workspace.

## Verification

Browser checks cover 375px, 768px, 1024px and 1440px plus landscape, readable long answers, independent chat scrolling, a visible composer, drawer focus management and Escape dismissal. Existing authentication, document upload, session creation and SSE response contracts are checked with an intercepted API; tests send no documents or credentials to the live backend. Markdown is escaped before formatting. Accessibility checks cover WCAG A/AA rules in desktop and mobile states.

Live model generation and indexing have not been exercised as part of this layout review. The owner reviewed the local preview and approved production release. The labelled sample remains available only on localhost; the published workspace uses the configured backend.
