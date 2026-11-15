import { reactive } from 'vue'

export type ToastKind = 'info' | 'success' | 'error'

export interface ToastEntry {
  id: number
  message: string
  kind: ToastKind
}

let nextId = 1

export const toasts = reactive<ToastEntry[]>([])

export function toast(message: string, kind: ToastKind = 'info', ms = 4000): void {
  const entry: ToastEntry = { id: nextId++, message, kind }
  toasts.push(entry)
  if (toasts.length > 3) toasts.shift()
  window.setTimeout(() => {
    const index = toasts.findIndex((item) => item.id === entry.id)
    if (index >= 0) toasts.splice(index, 1)
  }, ms)
}
