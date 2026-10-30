import { existsSync } from 'node:fs';

// Full Git/CLI checkouts already contain the source. Direct uploads supply a
// deployment-specific bootstrap that fetches an immutable commit before build.
if (!existsSync(new URL('./public/portfolio/index.html', import.meta.url))) {
  throw new Error('Application source is missing. Deploy the full checkout or use the pinned source-upload workflow.');
}
