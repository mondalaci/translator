/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/** Exposed by electron/preload.mjs. Absent when the UI runs in a browser. */
interface OverlayBridge {
  hide(): void
  quit(): void
  onShown(handler: () => void): void
  onHidden(handler: () => void): void
  setHideOnBlur(enabled: boolean): void
}

interface Window {
  overlay?: OverlayBridge
}
