import { reactive } from 'vue'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  message: string
  kind: ToastKind
  open: boolean
}

let nextId = 1

export const toasts = reactive<Toast[]>([])

export function toast(message: string, kind: ToastKind = 'info', ms = 3200): void {
  const entry: Toast = { id: nextId++, message, kind, open: true }
  toasts.push(entry)
  if (toasts.length > 3) toasts.shift()
  window.setTimeout(() => dismiss(entry.id), ms)
}

export function dismiss(id: number): void {
  const entry = toasts.find((item) => item.id === id)
  if (entry) entry.open = false
  window.setTimeout(() => {
    const index = toasts.findIndex((item) => item.id === id)
    if (index >= 0) toasts.splice(index, 1)
  }, 220)
}
