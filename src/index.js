const { createServer } = require('http')
const { readFile, stat } = require('fs').promises
const { join, extname } = require('path')
const url = require('url')

const PUBLIC = join(__dirname, '..', 'public')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain',
}

async function serveStatic(reqPath, res) {
  const filePath = join(PUBLIC, reqPath === '/' ? '/index.html' : reqPath)
  try {
    const st = await stat(filePath)
    if (st.isDirectory()) {
      const idx = join(filePath, 'index.html')
      await stat(idx)
      return sendFile(idx, reqPath, res)
    }
    return sendFile(filePath, reqPath, res)
  } catch {
    return sendFile(join(PUBLIC, 'index.html'), '/', res)
  }
}

async function sendFile(filePath, reqPath, res) {
  const ext = extname(filePath).toLowerCase()
  const ct = MIME[ext] || 'application/octet-stream'
  const content = await readFile(filePath)
  res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'public, max-age=0, must-revalidate' })
  res.end(content)
}

const server = createServer(async (req, res) => {
  try {
    const { pathname } = url.parse(req.url)
    if (pathname.startsWith('/api/')) {
      const mod = pathname.slice(1).replace(/\//g, '_')
      try {
        const handler = require('./api/' + mod)
        if (typeof handler === 'function') {
          req.body = []
          req.on('data', chunk => req.body.push(chunk))
          req.on('end', async () => {
            try {
              req.body = req.body.length ? JSON.parse(Buffer.concat(req.body)) : {}
              await handler(req, res)
            } catch(e) {
              res.writeHead(500); res.end(JSON.stringify({ error: 'Handler error' }))
            }
          })
        } else {
          res.writeHead(404); res.end('Not found')
        }
      } catch {
        res.writeHead(404); res.end(JSON.stringify({ error: 'API not found' }))
      }
    } else {
      await serveStatic(pathname, res)
    }
  } catch(e) {
    res.writeHead(500); res.end('Internal error')
  }
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log('RESET MCR listening on', PORT))
