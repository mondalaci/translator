<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RelatedImage, SessionSummary } from '@/api'
import { plainText } from '@/lib/markdown'
import MessageCard from '@/components/MessageCard.vue'

interface Bubble {
  key: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const props = defineProps<{
  bubbles: Bubble[]
  image: RelatedImage | null
  busy: boolean
  speaking: boolean
  sessions: SessionSummary[]
}>()

const emit = defineEmits<{
  send: []
  stop: []
  speak: [text: string]
  open: [id: string]
}>()

const draft = defineModel<string>('draft', { required: true })
const input = ref<HTMLTextAreaElement | null>(null)

const starters = computed(() => props.sessions.slice(0, 6))
const firstAssistantKey = computed(
  () => props.bubbles.find((bubble) => bubble.role === 'assistant')?.key ?? '',
)

function submit(): void {
  if (!draft.value.trim() || props.busy) return
  emit('send')
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
}

/** The headword of an assistant bubble, for the per-message pronounce chip. */
function headword(content: string): string {
  const match = /^\*\*(.+?)\*\*/m.exec(content)
  return match?.[1]?.replace(/\s*\*\[[^\]]*\]\*.*$/, '').trim() ?? plainText(content).slice(0, 60)
}

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div class="transcript scroll">
    <div v-if="!bubbles.length" class="empty">
      <p class="empty__lead">Type a word in either language.</p>
      <p class="empty__sub">
        English or Hungarian — the direction is detected, and follow-ups like
        <em>vs haste</em> or <em>more examples</em> stay in the same thread.
      </p>
      <div v-if="starters.length" class="empty__recent">
        <button
          v-for="entry in starters"
          :key="entry.id"
          class="pill"
          @click="emit('open', entry.id)"
        >
          {{ entry.term || entry.title }}
        </button>
      </div>
    </div>

    <template v-for="bubble in bubbles" :key="bubble.key">
      <p v-if="bubble.role === 'user'" class="said">{{ bubble.content }}</p>
      <MessageCard
        v-else
        :content="bubble.content"
        :streaming="Boolean(bubble.streaming)"
        :image="bubble.key === firstAssistantKey ? image : null"
        :speaking="speaking"
        @speak="emit('speak', $event)"
      />
    </template>
  </div>

  <form class="composer" @submit.prevent="submit">
    <textarea
      ref="input"
      v-model="draft"
      class="field composer__input"
      rows="1"
      placeholder="word or phrase — or ask a follow-up…"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      @keydown="onKeydown"
    />
    <button v-if="busy" class="composer__go" type="button" @click="emit('stop')">Stop</button>
    <button v-else class="composer__go" type="submit" :disabled="!draft.trim()">Look up</button>
  </form>
</template>

<style scoped>
.transcript {
  flex: 1;
  min-height: 0;
  padding: 16px 18px 4px;
  overflow-y: auto;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8vh 4px 0;
  color: var(--dim);
}

.empty__lead {
  margin: 0;
  color: var(--fg);
  font-size: 17px;
}

.empty__sub {
  margin: 0;
  max-width: 34rem;
  font-size: 13.5px;
  line-height: 1.6;
}

.empty__recent {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 14px;
}

.said {
  margin: 12px 0 10px auto;
  width: fit-content;
  max-width: 70%;
  padding: 7px 12px;
  color: var(--fg);
  background: var(--card-2);
  border-radius: 12px 12px 3px 12px;
  font-size: 14.5px;
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 14px 4px;
  border-top: 1px solid var(--line-soft);
}

.composer__input {
  flex: 1;
  min-height: var(--tap);
  max-height: 26vh;
  padding: 11px 13px;
  font-size: 15.5px;
  line-height: 1.45;
  resize: none;
}

.composer__go {
  flex: none;
  min-height: var(--tap);
  padding: 0 18px;
  color: var(--accent-ink);
  background: var(--accent);
  border-radius: 10px;
  font-weight: 650;
}

.composer__go:disabled {
  color: var(--dimmer);
  background: var(--card-2);
  cursor: default;
}
</style>
