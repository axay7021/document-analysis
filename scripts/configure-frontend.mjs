import { writeFileSync } from 'node:fs'
const origin = process.env.DOCUMENT_API_ORIGIN || ''
if (origin && (new URL(origin).origin !== origin || !origin.startsWith('https://'))) throw new Error('DOCUMENT_API_ORIGIN must be an HTTPS origin')
writeFileSync(new URL('../public/portfolio/config.js', import.meta.url), `window.DOCUMENT_API_ORIGIN = ${JSON.stringify(origin)};\n`)
