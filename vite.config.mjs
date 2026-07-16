import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const sourceMenuFiles = {
  en: path.resolve('src/data/menu.en.json'),
  el: path.resolve('src/data/menu.el.json'),
}

async function resolveMenuFile(language, dataDir) {
  if (!dataDir) return sourceMenuFiles[language]

  await fs.mkdir(dataDir, { recursive: true })
  const persistentFile = path.join(dataDir, `menu.${language}.json`)

  try {
    await fs.access(persistentFile)
  } catch {
    await fs.copyFile(sourceMenuFiles[language], persistentFile)
  }

  return persistentFile
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

async function readRequestBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie ?? '')
      .split(';')
      .map((cookie) => cookie.trim().split('='))
      .filter(([name, value]) => name && value)
      .map(([name, value]) => [name, decodeURIComponent(value)]),
  )
}

function safeEqual(left, right) {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim()
    ?? req.socket.remoteAddress
    ?? 'unknown'
}

function secureRequest(req) {
  return req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https'
}

function singleAccountAuth({ username, password }) {
  const sessions = new Map()
  const failedLogins = new Map()
  const sessionCookie = 'captain_jimmys_session'
  const sessionLifetimeSeconds = 60 * 60 * 24 * 30
  const loginWindowMs = 15 * 60 * 1000
  const maximumLoginAttempts = 5

  const authenticated = (req) => {
    const token = parseCookies(req)[sessionCookie]
    if (!token) return false
    const expiresAt = sessions.get(token)
    if (!expiresAt || expiresAt <= Date.now()) {
      sessions.delete(token)
      return false
    }
    return true
  }

  const setSessionCookie = (req, res, token) => {
    const secure = secureRequest(req) ? '; Secure' : ''
    res.setHeader(
      'set-cookie',
      `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionLifetimeSeconds}${secure}`,
    )
  }

  const clearSessionCookie = (req, res) => {
    const secure = secureRequest(req) ? '; Secure' : ''
    res.setHeader('set-cookie', `${sessionCookie}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`)
  }

  const handle = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/auth/')) return next()

    res.setHeader('cache-control', 'no-store')

    if (url.pathname === '/api/auth/session' && req.method === 'GET') {
      const isAuthenticated = authenticated(req)
      sendJson(res, 200, { authenticated: isAuthenticated, username: isAuthenticated ? username : '' })
      return
    }

    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const ip = clientIp(req)
      const now = Date.now()
      const attempt = failedLogins.get(ip)
      if (attempt && attempt.resetAt > now && attempt.count >= maximumLoginAttempts) {
        res.setHeader('retry-after', String(Math.ceil((attempt.resetAt - now) / 1000)))
        sendJson(res, 429, { error: 'Too many login attempts. Try again later.' })
        return
      }

      try {
        const body = JSON.parse(await readRequestBody(req))
        if (!safeEqual(String(body.username ?? ''), username) || !safeEqual(String(body.password ?? ''), password)) {
          const current = attempt && attempt.resetAt > now ? attempt : { count: 0, resetAt: now + loginWindowMs }
          failedLogins.set(ip, { ...current, count: current.count + 1 })
          sendJson(res, 401, { error: 'Invalid username or password.' })
          return
        }

        failedLogins.delete(ip)
        const token = randomBytes(32).toString('base64url')
        sessions.set(token, now + sessionLifetimeSeconds * 1000)
        setSessionCookie(req, res, token)
        sendJson(res, 200, { authenticated: true, username })
      } catch {
        sendJson(res, 400, { error: 'Invalid login request.' })
      }
      return
    }

    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = parseCookies(req)[sessionCookie]
      if (token) sessions.delete(token)
      clearSessionCookie(req, res)
      sendJson(res, 200, { authenticated: false })
      return
    }

    res.statusCode = 404
    res.end()
  }

  return { authenticated, handle }
}

function appApi({ username, password, dataDir }) {
  const auth = singleAccountAuth({ username, password })

  const health = (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/health') return next()
    sendJson(res, 200, { status: 'ok' })
  }

  const handle = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const match = url.pathname.match(/^\/api\/menu\/(en|el)$/)
    if (!match) return next()

    if (!auth.authenticated(req)) {
      sendJson(res, 401, { error: 'Authentication required.' })
      return
    }

    const language = match[1]

    try {
      const filePath = await resolveMenuFile(language, dataDir)

      if (req.method === 'GET') {
        const content = await fs.readFile(filePath, 'utf8')
        sendJson(res, 200, JSON.parse(content))
        return
      }

      if (req.method === 'PUT') {
        const body = JSON.parse(await readRequestBody(req))
        if (body.id !== language || !body.restaurant || !Array.isArray(body.categories)) {
          sendJson(res, 400, { error: 'Invalid menu data.' })
          return
        }

        await fs.writeFile(filePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8')
        sendJson(res, 200, { ok: true })
        return
      }

      res.statusCode = 405
      res.setHeader('allow', 'GET, PUT')
      res.end()
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : 'Menu API failed.' })
    }
  }

  return {
    name: 'captain-jimmys-app-api',
    configureServer(server) {
      server.middlewares.use(health)
      server.middlewares.use(auth.handle)
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(health)
      server.middlewares.use(auth.handle)
      server.middlewares.use(handle)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const username = env.MENU_ADMIN_USERNAME
  const password = env.MENU_ADMIN_PASSWORD
  const dataDir = env.RAILWAY_VOLUME_MOUNT_PATH || env.MENU_DATA_DIR

  if (!username || !password) {
    throw new Error('MENU_ADMIN_USERNAME and MENU_ADMIN_PASSWORD must be configured in .env.local.')
  }

  return {
    plugins: [react(), appApi({ username, password, dataDir })],
  }
})
