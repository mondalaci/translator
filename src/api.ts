export interface SessionSummary {
  id: string
  title: string
  direction: 'en-hu' | 'hu-en'
  term: string | null
  imageUrl: string | null
  imageCredit: string | null
  createdAt: number
  updatedAt: number
  turns: number
}

export interface Message {
  id: number
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export interface RelatedImage {
  src: string
  credit: string | null
  title: string | null
}

export interface Status {
  model: string
  hotkey: string
  hasApiKey: boolean
  languages: { source: { native: string }; target: { native: string } }
  images: { enabled: boolean; wiki: string }
  tts: {
    enabled: boolean
    model: string
    voice: string
    instructions: string
    playOnHost: boolean
    player: string | null
    playerFound: boolean
    available: boolean
  }
  database: string
  configFile: string
  usingDefaults: boolean
  counts: { sessions: number; messages: number; images: number }
  version: string | null
}

export interface SpeakResult {
  ok: true
  audio: string
  bytes: number
  cached: boolean
  model: string
  voice: string
  playedOnHost: boolean
  player: string | null
  playError: string | null
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
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
  sessions: (q = '') => request<{ sessions: SessionSummary[] }>(`/api/sessions?q=${encodeURIComponent(q)}`),
  session: (id: string) =>
    request<{ session: SessionSummary; messages: Message[]; image: RelatedImage | null }>(
      `/api/sessions/${id}`,
    ),
  removeSession: (id: string) =>
    request<{ ok: boolean }>(`/api/sessions/${id}`, { method: 'DELETE' }),
  setDirection: (id: string, direction: 'en-hu' | 'hu-en') =>
    request<{ ok: true; direction: string }>(`/api/sessions/${id}/direction`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    }),
  speak: (body: { text: string; voice?: string }) =>
    request<SpeakResult>('/api/speak', { method: 'POST', body: JSON.stringify(body) }),
  stopSpeech: () => request<{ ok: true; stopped: boolean }>('/api/speak/stop', { method: 'POST' }),
}

export type ChatEvent =
  | {
      type: 'meta'
      sessionId: string
      direction: 'en-hu' | 'hu-en'
      term: string | null
      fresh: boolean
      userMessageId: number | null
      image: RelatedImage | null
    }
  | { type: 'delta'; text: string }
  | { type: 'done'; usage: Record<string, unknown> | null; model: string }
  | { type: 'error'; status: number; message: string }

const NL = String.fromCharCode(10)

/** Streams one turn. The caller appends deltas as they arrive. */
export async function chat(
  body: { text: string; sessionId?: string; direction?: 'en-hu' | 'hu-en' },
  onEvent: (event: ChatEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
    const event = JSON.parse(trimmed.slice(5).trim()) as ChatEvent
    if (event.type === 'error') throw new Error(event.message)
    onEvent(event)
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
