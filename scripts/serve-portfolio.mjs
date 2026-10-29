import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../public/portfolio/', import.meta.url))
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, 'http://localhost').pathname
    )
    const relative =
      pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
    const file = path.resolve(root, relative)
    if (!file.startsWith(root)) {
      res.writeHead(403).end()
      return
    }
    const body = await readFile(file)
    res
      .writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      })
      .end(body)
  } catch {
    res.writeHead(404).end('Not found')
  }
}).listen(Number(process.env.DEMO_PORT || 4175), '127.0.0.1', () =>
  console.log(
    'Portfolio demo: http://127.0.0.1:' + (process.env.DEMO_PORT || 4175)
  )
)
