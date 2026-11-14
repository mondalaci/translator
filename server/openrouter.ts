import type { Config } from './config.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamSink {
  /** Visible answer text. */
  onDelta(text: string): void
  /** Reasoning tokens, only emitted when `openrouter.reasoning.exclude` is false. */
  onReasoning?(text: string): void
}

export interface StreamResult {
  model: string
  finishReason: string | null
  usage: Record<string, unknown> | null
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'OpenRouterError'
  }
}

interface Delta {
  content?: string | null
  reasoning?: string | null
}

interface Chunk {
  id?: string
  model?: string
  choices?: { delta?: Delta; finish_reason?: string | null }[]
  usage?: Record<string, unknown> | null
  error?: { message?: string; code?: number | string } | string
}

function describeError(error: Chunk['error']): string | undefined {
  if (!error) return undefined
  if (typeof error === 'string') return error
  const code = error.code ? ` (${error.code})` : ''
  return `${error.message ?? 'unknown OpenRouter error'}${code}`
}

function buildBody(config: Config, messages: ChatMessage[]) {
  const { openrouter } = config
  const reasoning = openrouter.reasoning ?? {}
  return {
    model: openrouter.model,
    messages,
    stream: true,
    temperature: openrouter.temperature,
    max_tokens: openrouter.maxTokens,
    usage: { include: true },
    ...(reasoning.effort
      ? { reasoning: { effort: reasoning.effort, exclude: reasoning.exclude !== false } }
      : {}),
  }
}

const DONE_MARKER = ['[', 'DONE', ']'].join('')
const NL = String.fromCharCode(10)

function safeParse(value: string): Chunk | undefined {
  try {
    return JSON.parse(value) as Chunk
  } catch {
    return undefined
  }
}

export async function streamChat(
  config: Config,
  messages: ChatMessage[],
  sink: StreamSink,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const { openrouter } = config
  if (!openrouter.apiKey) {
    throw new OpenRouterError(
      'No OpenRouter API key. Put it in config.json (openrouter.apiKey) or OPENROUTER_API_KEY.',
      400,
    )
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${openrouter.apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }
  if (openrouter.siteUrl) headers['HTTP-Referer'] = openrouter.siteUrl
  if (openrouter.appName) headers['X-Title'] = openrouter.appName

  const response = await fetch(`${openrouter.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildBody(config, messages)),
    signal,
  })

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '')
    const message =
      describeError(safeParse(text)?.error) ||
      text.slice(0, 300) ||
      `${response.status} ${response.statusText}`
    throw new OpenRouterError(message, response.status)
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let model = openrouter.model
  let finishReason: string | null = null
  let usage: Record<string, unknown> | null = null

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === DONE_MARKER) return
    const chunk = safeParse(payload)
    if (!chunk) return
    const problem = describeError(chunk.error)
    if (problem) throw new OpenRouterError(problem, 502)
    if (chunk.model) model = chunk.model
    if (chunk.usage) usage = chunk.usage
    const choice = chunk.choices?.[0]
    if (choice?.finish_reason) finishReason = choice.finish_reason
    const delta = choice?.delta
    if (delta?.reasoning) sink.onReasoning?.(delta.reasoning)
    if (delta?.content) sink.onDelta(delta.content)
  }

  const reader = response.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(NL)
      buffer = lines.pop() ?? ''
      lines.forEach(handleLine)
    }
    handleLine(buffer)
  } finally {
    reader.releaseLock()
  }

  return { model, finishReason, usage }
}


