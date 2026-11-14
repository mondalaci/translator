<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { api, lookup, type Status } from '@/api'
import { addHistory } from '@/lib/history'
import { useWakeLock } from '@/lib/awake'
import { useDisplayMode } from '@/lib/display'
import { languageByCode } from '@/lib/languages'
import { plainText, renderMarkdown } from '@/lib/markdown'
import { settings } from '@/lib/settings'
import { canSpeak, speak as speakLocally, stopSpeaking } from '@/lib/speech'
import { toast } from '@/lib/toast'
import HistorySheet from './HistorySheet.vue'
import ResultCard from './ResultCard.vue'
import SettingsSheet from './SettingsSheet.vue'

const props = defineProps<{ status: Status }>()

const query = ref('')
const lastQuery = ref('')
const answer = ref('')
const reasoning = ref('')
const rendered = ref('')
const error = ref('')
const busy = ref(false)
const answered = ref(false)
const answerModel = ref('')
const reasoningOpen = ref(false)
const historyOpen = ref(false)
const settingsOpen = ref(false)
const input = ref<HTMLTextAreaElement | null>(null)
const speaking = ref(false)

let controller: AbortController | null = null
let frame = 0
let player: HTMLAudioElement | null = null

const hostSpeech = computed(() => settings.hostSpeech && props.status.tts.available)

useWakeLock(computed(() => settings.keepAwake))
const { isFullscreen, isStandalone, toggle: toggleFullscreen } = useDisplayMode()
const target = computed(() => languageByCode(settings.code))

/** Re-render Markdown at most once per animation frame while tokens stream in. */
function scheduleRender(): void {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    rendered.value = renderMarkdown(answer.value)
  })
}

async function submit(): Promise<void> {
  const text = query.value.trim()
  if (!text || busy.value) return
  abort()
  answer.value = ''
  reasoning.value = ''
  rendered.value = ''
  error.value = ''
  answered.value = false
  lastQuery.value = text
  busy.value = true
  input.value?.blur()
  if (settings.autospeak) void play('word')

  const active = new AbortController()
  controller = active
  try {
    await lookup(
      text,
      {
        onStart: (model) => {
          answerModel.value = model
        },
        onDelta: (chunk) => {
          answer.value += chunk
          scheduleRender()
        },
        onReasoning: (chunk) => {
          reasoning.value += chunk
        },
        onDone: () => {
          answered.value = true
          addHistory({ query: text, answer: answer.value })
        },
      },
      active.signal,
      { name: target.value.name, native: target.value.native },
    )
  } catch (err) {
    if (!active.signal.aborted) {
      error.value = err instanceof Error ? err.message : 'Look-up failed.'
    }
  } finally {
    if (controller === active) controller = null
    busy.value = false
    rendered.value = renderMarkdown(answer.value)
    if (answered.value) query.value = ''
  }
}

function abort(): void {
  controller?.abort()
  controller = null
  busy.value = false
}

/**
 * Speak through the PC: the phone asks the server, the server synthesises with
 * the speech model and plays it on its own speakers, so a look-up is heard in
 * the headphones you are already wearing. The phone's own voice is the fallback.
 */
async function play(scope: 'word' | 'answer' = 'word'): Promise<void> {
  if (speaking.value) {
    await stopSpeech()
    return
  }
  const text = scope === 'word' ? lastQuery.value || query.value : plainText(answer.value)
  if (!text.trim()) return

  if (!hostSpeech.value) {
    if (canSpeak()) speakLocally(text, scope === 'word' ? 'en-US' : target.value.speech)
    else toast('No speech available here.', 'error')
    return
  }

  speaking.value = true
  try {
    const result = await api.speak({
      text: text.slice(0, 1200),
      voice: settings.voice || undefined,
    })
    if (result.playError) toast(`PC playback: ${result.playError}`, 'error', 5000)
    if (settings.playOnPhone) {
      player?.pause()
      player = new Audio(result.audio)
      void player.play().catch(() => toast('This phone blocked playback.', 'error'))
    }
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Speech failed', 'error', 5000)
  } finally {
    speaking.value = false
  }
}

async function stopSpeech(): Promise<void> {
  player?.pause()
  player = null
  stopSpeaking()
  try {
    await api.stopSpeech()
  } catch {
    /* the server may be unreachable; nothing else to do */
  }
  speaking.value = false
}

function reuse(entry: { query: string; answer: string }): void {
  historyOpen.value = false
  lastQuery.value = entry.query
  query.value = entry.query
  answer.value = entry.answer
  rendered.value = renderMarkdown(entry.answer)
  reasoning.value = ''
  error.value = ''
  answered.value = true
}

async function onFullscreen(): Promise<void> {
  const result = await toggleFullscreen()
  if (result === 'unsupported') {
    toast('Install the app first: Share → Add to Home Screen', 'info', 5000)
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void submit()
    return
  }
  if (event.key === 'Escape' && busy.value) abort()
}

/**
 * Shortcuts, in two flavours so nothing steals keys while you type a word:
 *   Alt+P            play the word (works even with the caret in the box)
 *   Alt+Shift+P      read the answer
 *   P                play the word whenever the caret is not in the box — which
 *                    is the usual state right after a look-up, since submitting
 *                    blurs the input.
 */
function onGlobalKey(event: KeyboardEvent): void {
  if (event.key === 'Escape' && speaking.value) {
    void stopSpeech()
    return
  }
  const key = event.key.toLowerCase()
  if (key !== 'p') return
  const target = event.target as HTMLElement | null
  const typing = Boolean(
    target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable),
  )
  const modifier = event.altKey || event.ctrlKey || event.metaKey

  if (modifier) {
    event.preventDefault()
    void play(event.shiftKey ? 'answer' : 'word')
    return
  }
  if (typing) return
  if (lastQuery.value || query.value || answer.value) {
    event.preventDefault()
    void play('word')
  }
}

onMounted(() => {
  if (settings.autofocus) void nextTick(() => input.value?.focus())
  window.addEventListener('keydown', onGlobalKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
  abort()
  void stopSpeech()
  if (frame) cancelAnimationFrame(frame)
})

</script>

<template>
  <div class="app">
    <header class="bar">
      <div class="bar__title">
        <span class="dot" :class="{ 'dot--busy': busy, 'dot--off': !status.hasApiKey }" />
        <strong>translator</strong>
        <span class="bar__target">{{ target.native }}</span>
      </div>
      <nav class="bar__actions">
        <button
          class="icon-btn"
          title="Full screen"
          :aria-pressed="isFullscreen || isStandalone"
          @click="onFullscreen"
        >
          <span aria-hidden="true">⤢</span><span class="sr-only">Full screen</span>
        </button>
        <button class="icon-btn" title="History" @click="historyOpen = true">
          <span aria-hidden="true">≡</span><span class="sr-only">History</span>
        </button>
        <button class="icon-btn" title="Settings" @click="settingsOpen = true">
          <span aria-hidden="true">⚙</span><span class="sr-only">Settings</span>
        </button>
      </nav>
    </header>

    <main class="main">
      <form class="ask" @submit.prevent="submit">
        <textarea
          ref="input"
          v-model="query"
          class="ask__input"
          rows="1"
          placeholder="English word or phrase"
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="search"
          @keydown="onKeydown"
        />
        <button v-if="busy" class="ask__go ghost" type="button" @click="abort">Stop</button>
        <button v-else class="ask__go primary" type="submit" :disabled="!query.trim()">
          Look up
        </button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>

      <p v-if="!answer && !busy && !error" class="hint">
        Type an English word, phrase, idiom or piece of slang. The answer streams in as it is
        written.
      </p>

      <ResultCard
        v-if="answer"
        :query="lastQuery"
        :html="rendered"
        :text="answer"
        :streaming="busy"
        :target-native="target.speech"
        :speaking="speaking"
        :host-speech="hostSpeech"
        @play="play"
      />

      <CollapsibleRoot v-if="settings.showReasoning && reasoning" v-model:open="reasoningOpen" class="think">
        <CollapsibleTrigger class="think__trigger">thinking…</CollapsibleTrigger>
        <CollapsibleContent class="think__body">{{ reasoning }}</CollapsibleContent>
      </CollapsibleRoot>

      <p v-if="answerModel && answer" class="meta">{{ answerModel }}</p>
    </main>

    <HistorySheet v-model:open="historyOpen" @select="reuse" />
    <SettingsSheet v-model:open="settingsOpen" :status="status" />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  padding: var(--safe-t) var(--safe-r) var(--safe-b) var(--safe-l);
}

.bar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg);
}

.bar__title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 16px;
  letter-spacing: 0.01em;
}

.bar__target {
  color: var(--dim);
  font-size: 14px;
  font-weight: 400;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-dim);
}

.dot--busy {
  background: var(--warn);
  animation: pulse 1.1s ease-in-out infinite;
}

.dot--off {
  background: var(--danger);
}

.bar__actions {
  display: flex;
  align-items: center;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 46rem;
  margin: 0 auto;
  padding: 6px 16px 20px;
}

.ask {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.ask__input {
  flex: 1;
  min-height: var(--tap);
  max-height: 32vh;
  padding: 13px 14px;
  font-size: 17px;
  line-height: 1.4;
  resize: none;
  color: var(--fg-strong);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.ask__input:focus {
  border-color: var(--accent-dim);
  outline: none;
}

.ask__input::placeholder {
  color: var(--dimmer);
}

.ask__go {
  flex: none;
  min-width: 100px;
}

.hint,
.error {
  margin: 6px 2px;
  font-size: 15px;
}

.hint {
  color: var(--dim);
}

.error {
  color: var(--danger);
}

.meta {
  margin: auto 0 0;
  padding-top: 10px;
  text-align: center;
  color: var(--dimmer);
  font-size: 12px;
}

.think__trigger {
  padding: 8px 0;
  color: var(--dim);
  font-size: 14px;
}

.think__body {
  padding-left: 10px;
  border-left: 2px solid var(--line);
  color: var(--dim);
  font-size: 13px;
  white-space: pre-wrap;
}

@keyframes pulse {
  50% {
    opacity: 0.25;
  }
}
</style>
