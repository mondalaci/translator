import { reactive, watch } from 'vue'

const KEY = 'translator.settings.v1'

export interface Settings {
  /** Open the keyboard as soon as the app is focused. */
  autofocus: boolean
  /** Speak the looked-up word as soon as the answer starts arriving. */
  autospeak: boolean
  /** Use the speech model on the PC instead of the phone's own voice. */
  hostSpeech: boolean
  /** Also play the clip in this browser, not just on the PC. */
  playOnPhone: boolean
  /** Preferred voice name; empty means the server default. */
  voice: string
  /** Show the model's reasoning stream when the server sends it. */
  showReasoning: boolean
  /** Hold a screen wake lock while the app is in the foreground. */
  keepAwake: boolean
  /** Target language code (see lib/languages.ts). */
  code: string
}

const DEFAULTS: Settings = {
  autofocus: true,
  autospeak: false,
  hostSpeech: true,
  playOnPhone: false,
  voice: '',
  showReasoning: false,
  keepAwake: false,
  code: 'hu',
}

function load(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>
  } catch {
    return {}
  }
}

export const settings = reactive<Settings>({ ...DEFAULTS, ...load() })

watch(
  settings,
  (value) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(value))
    } catch {
      /* private mode: settings simply do not persist */
    }
  },
  { deep: true },
)
