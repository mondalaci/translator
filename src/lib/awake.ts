import { ref, watch, type Ref } from 'vue'

const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

/**
 * Keeps the screen on while the app is in the foreground — handy when the phone
 * sits next to the keyboard during a game and you only glance at it now and then.
 */
export function useWakeLock(enabled: Ref<boolean>) {
  const active = ref(false)
  let sentinel: WakeLockSentinel | null = null

  async function acquire(): Promise<void> {
    if (!supported || document.visibilityState !== 'visible') return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      active.value = true
      sentinel.addEventListener('release', () => {
        active.value = false
      })
    } catch {
      active.value = false
    }
  }

  async function release(): Promise<void> {
    try {
      await sentinel?.release()
    } catch {
      /* already gone */
    }
    sentinel = null
    active.value = false
  }

  watch(enabled, (on) => (on ? void acquire() : void release()), { immediate: true })

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (enabled.value && document.visibilityState === 'visible') void acquire()
    })
  }

  return { supported, active }
}
