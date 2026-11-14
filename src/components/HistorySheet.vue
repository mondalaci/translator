<script setup lang="ts">
import { ref } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { clearHistory, history } from '@/lib/history'
import { plainText } from '@/lib/markdown'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [{ query: string; answer: string }] }>()
const confirming = ref(false)

function ago(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return minutes + 'm'
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours + 'h'
  return Math.round(hours / 24) + 'd'
}

function clear(): void {
  if (!confirming.value) {
    confirming.value = true
    return
  }
  clearHistory()
  confirming.value = false
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="sheet-overlay" />
      <DialogContent class="sheet" aria-describedby="history-hint">
        <header class="sheet__head">
          <DialogTitle class="sheet__title">History</DialogTitle>
          <span class="history__tools">
            <button v-if="history.length" class="ghost history__clear" @click="clear">
              {{ confirming ? 'Sure?' : 'Clear' }}
            </button>
            <DialogClose class="icon-btn" aria-label="Close">✕</DialogClose>
          </span>
        </header>
        <div class="sheet__body">
          <DialogDescription id="history-hint" class="history__hint">
            Stored on this phone only.
          </DialogDescription>
          <p v-if="!history.length" class="history__hint">Nothing looked up yet.</p>
          <ul v-else class="history__list">
            <li v-for="entry in history" :key="entry.query + entry.at">
              <button class="history__item" @click="emit('select', entry)">
                <span class="history__query">{{ entry.query }}</span>
                <span class="history__preview">{{ plainText(entry.answer).slice(0, 90) }}</span>
                <span class="history__time">{{ ago(entry.at) }}</span>
              </button>
            </li>
          </ul>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.history__tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.history__clear {
  min-height: 38px;
  padding: 0 14px;
  font-size: 14px;
}

.history__hint {
  margin: 0 0 10px;
  color: var(--dim);
  font-size: 14px;
}

.history__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.history__item {
  display: block;
  width: 100%;
  padding: 12px 0;
  text-align: left;
  border-top: 1px solid var(--line);
}

.history__item:active {
  background: var(--surface-2);
}

.history__query {
  display: block;
  color: var(--fg-strong);
  font-size: 16px;
}

.history__preview {
  display: block;
  color: var(--dim);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history__time {
  color: var(--dimmer);
  font-size: 12px;
}
</style>
