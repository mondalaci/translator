import { randomBytes, createHash, createHmac, timingSafeEqual, type BinaryLike } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

export interface Config {
  server: {
    /** TCP port the app listens on. */
    port: number
    /** Bind address. `0.0.0.0` keeps the app reachable for your phone on the LAN. */
    host: string
    /**
     * Optional override for the host shown in the pairing link / QR code, e.g.
     * `http://192.168.1.216:8787` or a tailscale name. Detected automatically when empty.
     */
    publicUrl: string
  }
  openrouter: {
    apiKey: string
    baseUrl: string
    /** Any OpenRouter model id. Default: deepseek/deepseek-v4.1-flash */
    model: string
    temperature: number
    maxTokens: number
    /**
     * Dictionary look-ups do not need a thinking budget, so reasoning is kept
     * low and hidden by default. Set `effort: "medium"`/`"high"` or
     * `exclude: false` if you want to see the reasoning stream.
     */
    reasoning: { effort: string; exclude: boolean }
    appName: string
    siteUrl: string
  }
  language: {
    /** BCP-47-ish target language code, only informational for the prompt. */
    target: string
    /** English name of the target language, used inside the prompt. */
    targetName: string
    /** Target language in its own words, e.g. "magyar". */
    nativeName: string
  }
  auth: {
    /** Shared secret. Generated and persisted on first start when empty. */
    token: string
    /** Lifetime of the phone session cookie, in days. */
    sessionDays: number
    /** Allow showing the pairing QR to non-localhost visitors. Off by default. */
    allowRemotePairing: boolean
  }
  tts: {
    enabled: boolean
    /** Only `openrouter` today: the /audio/speech endpoint on the same API key. */
    provider: string
    /** Speech model id, e.g. google/gemini-3.8-flash-tts. */
    model: string
    /** Prebuilt voice name, e.g. Kore, Puck, Charon. */
    voice: string
    /** Optional delivery direction, e.g. "calm and clear, slightly slow". */
    instructions: string
    /** Gemini TTS returns headerless PCM; this is how it gets a WAV header. */
    pcm: { sampleRate: number; channels: number; bits: number }
    /** Play the audio on the machine running the server, not just on the phone. */
    playOnHost: boolean
    /** Player command. Auto-detected (paplay, pw-play, ffplay, mpv, aplay) when empty. */
    player: string
    /** Keep synthesised files in .cache/tts and reuse them by content hash. */
    cache: boolean
  }
  rateLimit: {
    lookupsPerMinute: number
  }
}

const DEFAULTS: Config = {
  server: { port: 8787, host: '0.0.0.0', publicUrl: '' },
  openrouter: {
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'deepseek/deepseek-v4.1-flash',
    temperature: 0.2,
    maxTokens: 700,
    reasoning: { effort: 'low', exclude: true },
    appName: 'translator',
    siteUrl: '',
  },
  language: { target: 'hu', targetName: 'Hungarian', nativeName: 'magyar' },
  auth: { token: '', sessionDays: 365, allowRemotePairing: false },
  tts: {
    enabled: true,
    provider: 'openrouter',
    model: 'google/gemini-3.8-flash-tts',
    voice: 'Kore',
    instructions: '',
    pcm: { sampleRate: 24000, channels: 1, bits: 16 },
    playOnHost: true,
    player: '',
    cache: true,
  },
  rateLimit: { lookupsPerMinute: 30 },
}

export const configPath =
  process.env.TRANSLATOR_CONFIG?.trim() || path.join(projectRoot, 'config.json')

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Shallow-ish deep merge used to fill in keys added by newer versions. */
function merge<T>(base: T, override: unknown): T {
  if (!isPlainObject(override)) return base
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(override)) {
    const current = out[key]
    out[key] = isPlainObject(value) && isPlainObject(current) ? merge(current, value) : value
  }
  return out as T
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw new Error(`Cannot read ${file}: ${(error as Error).message}`)
  }
}

export function randomToken(): string {
  return randomBytes(24).toString('base64url')
}

function writeConfig(config: Config): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}

function envOverrides(): Partial<Config> {
  const out: Record<string, unknown> = {}
  const put = (pathParts: string[], value: unknown) => {
    if (value === undefined || value === '') return
    let node = out
    for (const part of pathParts.slice(0, -1)) {
      node = (node[part] ??= {}) as Record<string, unknown>
    }
    node[pathParts.at(-1)!] = value
  }

  put(['server', 'port'], process.env.PORT ? Number(process.env.PORT) : undefined)
  put(['server', 'host'], process.env.HOST)
  put(['server', 'publicUrl'], process.env.TRANSLATOR_PUBLIC_URL)
  put(['openrouter', 'apiKey'], process.env.OPENROUTER_API_KEY)
  put(['openrouter', 'model'], process.env.OPENROUTER_MODEL)
  put(['openrouter', 'baseUrl'], process.env.OPENROUTER_BASE_URL)
  put(['auth', 'token'], process.env.TRANSLATOR_TOKEN)
  return out as Partial<Config>
}

export interface LoadedConfig {
  config: Config
  /** True when the token was generated during this start. */
  generatedToken: boolean
  createdFile: boolean
}

export function loadConfig(): LoadedConfig {
  const createdFile = !fs.existsSync(configPath)
  const examplePath = path.join(projectRoot, 'config.example.json')
  const fromFile = createdFile && fs.existsSync(examplePath) ? readJson(examplePath) : readJson(configPath)

  let config = merge(merge(DEFAULTS, fromFile), envOverrides())

  const generatedToken = !config.auth.token
  if (generatedToken) config.auth.token = randomToken()

  if (createdFile || generatedToken) writeConfig(config)

  return { config, generatedToken, createdFile }
}

/** Persist a new token (used by `POST /api/auth/rotate`). */
export function saveToken(token: string): void {
  const config = merge(DEFAULTS, readJson(configPath))
  config.auth.token = token
  writeConfig(config)
}

// --- auth primitives -------------------------------------------------------

export const COOKIE_NAME = 'translator_session'

/** HMAC of the token, so the cookie never carries the shared secret itself. */
export function sessionValue(token: string): string {
  return createHmac('sha256', token).update('translator-session-v1').digest('base64url')
}

export function safeEqual(a: string | undefined, b: string): boolean {
  if (!a) return false
  const left = createHash('sha256').update(a as BinaryLike).digest()
  const right = createHash('sha256').update(b as BinaryLike).digest()
  return timingSafeEqual(left, right)
}

export function isLoopback(ip: string | undefined): boolean {
  if (!ip) return false
  const value = ip.replace(/^::ffff:/, '')
  return value === '127.0.0.1' || value === '::1' || value === 'localhost'
}
