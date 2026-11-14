<script setup lang="ts">
import { computed } from 'vue'
import { plainText } from '@/lib/markdown'
import { canSpeak, speak } from '@/lib/speech'
import { toast } from '@/lib/toast'

const props = defineProps<{
  query: string
  html: string
  text: string
  streaming: boolean
  targetNative: string
}>()

const speakable = computed(() => canSpeak() && props.text.trim().length > 0)
const targetLabel = computed(() => props.targetNative.split('-')[0]?.toUpperCase() ?? 'HU')

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(`${props.query}\n\n${plainText(props.text)}`)
    toast('Copied', 'success')
  } catch {
    toast('Clipboard is blocked here', 'error')
  }
}
</script>

<template>
  <article class="result">
    <header class="result__bar">
      <span class="result__query">{{ query }}</span>
      <span class="result__actions">
        <button
          class="chip"
          title="Say the English word"
          :disabled="!speakable"
          @click="speak(query, 'en-US')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h3.2L12 5.4v13.2L7.2 15H4z" />
            <path d="M15.4 8.8a4.4 4.4 0 0 1 0 6.4" />
          </svg>
          EN
        </button>
        <button
          class="chip"
          title="Read the translation aloud"
          :disabled="!speakable"
          @click="speak(text, targetNative)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h3.2L12 5.4v13.2L7.2 15H4z" />
            <path d="M15.4 8.8a4.4 4.4 0 0 1 0 6.4" />
            <path d="M17.8 6.4a7.6 7.6 0 0 1 0 11.2" />
          </svg>
          {{ targetLabel }}
        </button>
        <button class="chip" title="Copy" @click="copy">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5A1.5 1.5 0 0 0 5.5 15" />
          </svg>
          COPY
        </button>
      </span>
    </header>
    <!-- Sanitised by DOMPurify in lib/markdown.ts. -->
    <div class="md" :class="{ 'md--streaming': streaming }" v-html="html" />
  </article>
</template>

<style scoped>
.result {
  border-top: 1px solid var(--line);
  padding: 4px 0 0;
  margin-top: 6px;
}

.result__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
}

.result__query {
  font-size: 15px;
  color: var(--dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result__actions {
  display: flex;
  align-items: center;
  flex: none;
}

.result__actions .icon-btn {
  width: 42px;
  height: 42px;
  font-size: 17px;
}

.result__actions .icon-btn:disabled {
  color: var(--line);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 38px;
  padding: 0 10px;
  margin-left: 4px;
  color: var(--dim);
  background: var(--surface-2);
  border-radius: 10px;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.chip:active {
  color: var(--fg-strong);
  background: var(--line);
}

.chip:disabled {
  color: var(--dimmer);
  background: transparent;
}

.chip svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linejoin: round;
  stroke-linecap: round;
}

/* Markdown from the model: bright, large, low-clutter. */
.md {
  font-size: 18px;
  line-height: 1.6;
  color: var(--fg-strong);
  padding: 2px 0 6px;
  word-break: break-word;
}

.md :deep(p) {
  margin: 0 0 0.7em;
}

.md :deep(p:last-child) {
  margin-bottom: 0;
}

.md :deep(strong) {
  color: var(--accent);
  font-weight: 650;
}

.md :deep(em) {
  color: var(--dim);
  font-style: italic;
}

.md :deep(ol),
.md :deep(ul) {
  margin: 0 0 0.7em;
  padding-left: 1.25em;
}

.md :deep(li) {
  margin-bottom: 0.3em;
}

.md :deep(code) {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.92em;
  background: var(--surface-2);
  padding: 0.1em 0.35em;
  border-radius: 5px;
}

.md :deep(hr) {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 0.8em 0;
}

.md :deep(blockquote) {
  margin: 0 0 0.7em;
  padding-left: 0.8em;
  border-left: 2px solid var(--line);
  color: var(--dim);
}

.md--streaming :deep(p:last-child)::after {
  content: '▍';
  color: var(--accent);
  animation: blink 1s steps(2, start) infinite;
}

@keyframes blink {
  to {
    visibility: hidden;
  }
}
</style>

