export interface SpeechInfo {
  enabled: boolean
  model: string
  voice: string
  instructions: string
  playOnHost: boolean
  player: string | null
  playerFound: boolean
  available: boolean
  voices: string[]
}

export interface SpeakResult {
  ok: true
  /** Path of the cached clip, playable by this browser too. */
  audio: string
  file: string
  bytes: number
  cached: boolean
  model: string
  voice: string
  playedOnHost: boolean
  player: string | null
  playError: string | null
}

export interface Status {
  authenticated: boolean
  pairingAvailable: boolean
  local: boolean
  model: string
  port: number
  hasApiKey: boolean
  language: { target: string; targetName: string; nativeName: string }
  tts: SpeechInfo
  version: string | null
}

export interface PairedDevice {
  ip: string
  userAgent: string
  firstSeen: number
  lastSeen: number
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...init,
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? response.statusText)
  }
  return data as T
}

export const api = {
  status: () => request<Status>('/api/status'),
  login: (token: string) =>
    request<{ ok: true }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  pairLink: () =>
    request<{ url: string; model: string; language: Status['language'] }>('/api/pair/link'),
  rotate: () => request<{ ok: true; url: string }>('/api/auth/rotate', { method: 'POST' }),
  devices: () => request<{ devices: PairedDevice[] }>('/api/devices'),
  speak: (body: { text: string; voice?: string; instructions?: string }) =>
    request<SpeakResult>('/api/speak', { method: 'POST', body: JSON.stringify(body) }),
  stopSpeech: () => request<{ ok: true; stopped: boolean }>('/api/speak/stop', { method: 'POST' }),
}

export interface LookupHandlers {
  onStart?(model: string): void
  onDelta(text: string): void
  onReasoning?(text: string): void
  onDone?(): void
}

interface Event {
  type: 'start' | 'delta' | 'reasoning' | 'done' | 'error'
  text?: string
  model?: string
  message?: string
}

const NL = String.fromCharCode(10)

export async function lookup(
  query: string,
  handlers: LookupHandlers,
  signal: AbortSignal,
  target?: { name: string; native: string },
): Promise<void> {
  const response = await fetch('/api/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, targetName: target?.name, nativeName: target?.native }),
    signal,
  })

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '')
    let message = response.statusText
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? message
    } catch {
      /* keep statusText */
    }
    throw new Error(message)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handle = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const event = JSON.parse(trimmed.slice(5).trim()) as Event
    if (event.type === 'start') handlers.onStart?.(event.model ?? '')
    else if (event.type === 'reasoning' && event.text) handlers.onReasoning?.(event.text)
    else if (event.type === 'delta' && event.text) handlers.onDelta(event.text)
    else if (event.type === 'done') handlers.onDone?.()
    else if (event.type === 'error') throw new Error(event.message ?? 'Look-up failed.')
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(NL)
      buffer = lines.pop() ?? ''
      for (const line of lines) handle(line)
    }
    handle(buffer)
  } finally {
    reader.releaseLock()
  }
}

