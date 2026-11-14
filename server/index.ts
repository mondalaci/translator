import { networkInterfaces } from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import express from 'express'
import { fileURLToPath } from 'node:url'
import { configPath, loadConfig, randomToken, saveToken, safeEqual } from './config.js'
import {
  clearedCookie,
  isAuthenticated,
  listDevices,
  requireAuth,
  sessionCookie,
  touchDevice,
} from './auth.js'
import { buildMessages } from './prompt.js'
import { OpenRouterError, streamChat } from './openrouter.js'

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const distDir = path.join(projectRoot, 'dist')

const { config, generatedToken, createdFile } = loadConfig()
let token = config.auth.token

const IGNORED_IFACES = /^(docker|veth|virbr|br-|tun|tap|tailscale|zt|wg|lo)/i
const PREFERRED_IFACES = /^(en|eth|wl|wlan|wlp)/i

function localAddress(): string {
  const candidates: { name: string; address: string }[] = []
  for (const [name, list] of Object.entries(networkInterfaces())) {
    if (IGNORED_IFACES.test(name)) continue
    for (const entry of list ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) candidates.push({ name, address: entry.address })
    }
  }
  const preferred = candidates.find((c) => PREFERRED_IFACES.test(c.name))
  return (preferred ?? candidates[0])?.address ?? '127.0.0.1'
}

function pairingUrl(): string {
  const base =
    config.server.publicUrl.trim() ||
    `http://${localAddress()}:${config.server.port}`
  return `${base.replace(/\/+$/, '')}/auth?k=${encodeURIComponent(token)}`
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', false)
app.use(express.json({ limit: '32kb' }))

/** Requests arriving on loopback are "the PC itself" and may see the pairing QR. */
function isLocalRequest(req: express.Request): boolean {
  return config.auth.allowRemotePairing || req.ip === '127.0.0.1' || req.ip === '::1'
}

app.get('/api/status', (req, res) => {
  const authenticated = isAuthenticated(req, token)
  if (authenticated) touchDevice(req)
  res.json({
    authenticated,
    pairingAvailable: isLocalRequest(req),
    local: isLocalRequest(req),
    model: config.openrouter.model,
    port: config.server.port,
    hasApiKey: Boolean(config.openrouter.apiKey),
    language: config.language,
    version: process.env.npm_package_version ?? null,
  })
})

app.get('/auth', (req, res) => {
  const provided = typeof req.query.k === 'string' ? req.query.k : ''
  if (!safeEqual(provided, token)) {
    res.status(401).send(pairingFailurePage())
    return
  }
  touchDevice(req)
  res.setHeader('Set-Cookie', sessionCookie(token, config.auth.sessionDays))
  res.redirect(302, '/')
})

app.post('/api/auth/login', (req, res) => {
  const provided = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
  if (!safeEqual(provided, token)) {
    res.status(401).json({ error: 'Wrong or expired code.' })
    return
  }
  touchDevice(req)
  res.setHeader('Set-Cookie', sessionCookie(token, config.auth.sessionDays))
  res.json({ ok: true })
})

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearedCookie())
  res.json({ ok: true })
})

app.get('/api/pair/link', (req, res) => {
  if (!isLocalRequest(req)) {
    res.status(403).json({ error: 'Pairing is only shown on the PC running translator.' })
    return
  }
  res.json({ url: pairingUrl(), model: config.openrouter.model, language: config.language })
})

app.get('/api/devices', (req, res) => {
  if (!isLocalRequest(req)) {
    res.status(403).json({ error: 'Only available on the PC running translator.' })
    return
  }
  res.json({ devices: listDevices() })
})

app.post('/api/auth/rotate', (req, res) => {
  if (!isLocalRequest(req)) {
    res.status(403).json({ error: 'Only available on the PC running translator.' })
    return
  }
  token = randomToken()
  saveToken(token)
  res.setHeader('Set-Cookie', sessionCookie(token, config.auth.sessionDays))
  res.json({ ok: true, url: pairingUrl() })
})

const hits = new Map<string, number[]>()

/** Small in-memory limiter: keeps a stuck key-tapping loop from burning credits. */
function allowLookup(ip: string | undefined): boolean {
  const key = ip ?? 'unknown'
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((at) => now - at < 60_000)
  if (recent.length >= config.rateLimit.lookupsPerMinute) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

const NL = String.fromCharCode(10)

app.post('/api/lookup', requireAuth(token), async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
  if (!query) {
    res.status(400).json({ error: 'Nothing to look up.' })
    return
  }
  if (query.length > 1000) {
    res.status(413).json({ error: 'Too long. Keep it to a phrase.' })
    return
  }
  if (!allowLookup(req.ip)) {
    res.status(429).json({ error: 'Slow down a little.' })
    return
  }

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (payload: unknown) => {
    if (!res.writableEnded) res.write('data: ' + JSON.stringify(payload) + NL + NL)
  }

  const abort = new AbortController()
  // `req` fires `close` as soon as the body has been read, so watch the response instead.
  res.on('close', () => {
    if (!res.writableEnded) abort.abort()
  })
  const heartbeat = setInterval(() => res.write(': ping' + NL), 15_000)

  try {
    send({ type: 'start', model: config.openrouter.model })
    const result = await streamChat(
      config,
      buildMessages(config, {
        query,
        targetName: typeof req.body?.targetName === 'string' ? req.body.targetName : undefined,
        nativeName: typeof req.body?.nativeName === 'string' ? req.body.nativeName : undefined,
      }),
      {
        onDelta: (text) => send({ type: 'delta', text }),
        onReasoning: (text) => send({ type: 'reasoning', text }),
      },
      abort.signal,
    )
    send({ type: 'done', model: result.model, usage: result.usage })
  } catch (error) {
    if (!abort.signal.aborted) {
      const known = error instanceof OpenRouterError
      send({
        type: 'error',
        status: known ? error.status : 500,
        message: known ? error.message : 'Look-up failed. Check the server log.',
      })
      console.error('[lookup]', error)
    }
  } finally {
    clearInterval(heartbeat)
    res.end()
  }
})

const hasBuild = fs.existsSync(path.join(distDir, 'index.html'))
if (hasBuild) {
  app.use(express.static(distDir, { index: false, maxAge: '1h' }))
} else {
  app.use('/api', (_req, res) => {
    res.status(503).json({ error: 'No production build. Run `npm run build`.' })
  })
}

app.use((req, res) => {
  if (req.method !== 'GET') {
    res.status(404).json({ error: 'Not found' })
    return
  }
  if (hasBuild) {
    res.sendFile(path.join(distDir, 'index.html'))
    return
  }
  res.status(503).type('html').send(noBuildPage())
})

function pageShell(title: string, body: string): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="theme-color" content="#000000">' +
    '<title>' + title + '</title>' +
    '<style>html,body{margin:0;height:100%;background:#000;color:#e8e8e8;' +
    'font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;display:grid;place-items:center}' +
    'main{max-width:28rem;padding:1.5rem}a{color:#7ab7ff}code{background:#141414;padding:.15rem .35rem;' +
    'border-radius:.3rem;word-break:break-all}</style></head><body><main>' +
    body +
    '</main></body></html>'
  )
}

function noBuildPage(): string {
  return pageShell(
    'translator — build missing',
    '<h1>No build yet</h1><p>Run <code>npm run dev</code> for development, or ' +
      '<code>npm run build &amp;&amp; npm start</code> to serve the app from here.</p>',
  )
}

function pairingFailurePage(): string {
  return pageShell(
    'translator — pairing failed',
    '<h1>Pairing link is not valid</h1><p>The code in the QR link no longer matches. ' +
      'Open <code>http://localhost:' +
      config.server.port +
      '</code> on the PC and scan the QR code again.</p>',
  )
}

const server = app.listen(config.server.port, config.server.host, () => {
  const lan = `http://${localAddress()}:${config.server.port}`
  const lines = [
    '',
    '  translator is running',
    `  pc      ${config.server.publicUrl || `http://localhost:${config.server.port}`}`,
    `  phone   ${lan}`,
    `  model   ${config.openrouter.model}`,
    `  target  ${config.language.targetName} (${config.language.nativeName})`,
    `  config  ${configPath}`,
  ]
  if (!config.openrouter.apiKey) {
    lines.push('', '  ! no OpenRouter API key yet — add openrouter.apiKey to config.json')
  }
  if (createdFile) lines.push('', '  created config.json — tune it and restart if you like')
  if (generatedToken) lines.push('  generated a new auth token')
  lines.push('', `  pair    ${pairingUrl()}`, '')
  console.log(lines.join('\n'))
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}











