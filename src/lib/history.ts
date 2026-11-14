import { reactive, watch } from 'vue'

const KEY = 'translator.history.v1'
const LIMIT = 60

export interface HistoryEntry {
  query: string
  answer: string
  at: number
}

function load(): HistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as HistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Most recent look-ups first. Kept on the phone only. */
export const history = reactive<HistoryEntry[]>(load())

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(history))
  } catch {
    /* ignore quota / private mode */
  }
}

export function addHistory(entry: Omit<HistoryEntry, 'at'>): void {
  const at = Date.now()
  const index = history.findIndex((item) => item.query.toLowerCase() === entry.query.toLowerCase())
  if (index >= 0) history.splice(index, 1)
  history.unshift({ ...entry, at })
  if (history.length > LIMIT) history.splice(LIMIT)
  persist()
}

export function clearHistory(): void {
  history.splice(0)
  persist()
}

watch(history, persist, { deep: true })
