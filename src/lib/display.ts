import { onBeforeUnmount, onMounted, ref } from 'vue'

interface StandaloneNavigator extends Navigator {
  standalone?: boolean
}

/**
 * Full screen on a phone comes in two flavours:
 *  - the Fullscreen API (Android Chrome, desktop browsers)
 *  - the installed PWA running in `standalone`/`fullscreen` display mode (iOS)
 * `toggle()` prefers the API and tells you when installing is the only route.
 */
export function useDisplayMode() {
  const isFullscreen = ref(false)
  const isStandalone = ref(false)
  const canFullscreen = ref(false)

  const detectStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((navigator as StandaloneNavigator).standalone)

  const sync = () => {
    isFullscreen.value = Boolean(document.fullscreenElement)
    isStandalone.value = detectStandalone()
  }

  async function toggle(): Promise<'entered' | 'exited' | 'unsupported'> {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      sync()
      return 'exited'
    }
    if (!document.fullscreenEnabled) return 'unsupported'
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      sync()
      return 'entered'
    } catch {
      return 'unsupported'
    }
  }

  onMounted(() => {
    canFullscreen.value = document.fullscreenEnabled
    sync()
    document.addEventListener('fullscreenchange', sync)
  })

  onBeforeUnmount(() => document.removeEventListener('fullscreenchange', sync))

  return { isFullscreen, isStandalone, canFullscreen, toggle }
}
