<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
  SwitchRoot,
  SwitchThumb,
} from 'reka-ui'
import { api, type Status } from '@/api'
import { LANGUAGES, languageByCode } from '@/lib/languages'
import { settings } from '@/lib/settings'
import { toast } from '@/lib/toast'

const open = defineModel<boolean>('open', { required: true })
defineProps<{ status: Status }>()

const TOGGLES = [
  { key: 'autofocus', label: 'Focus the input on open', hint: 'Keyboard is ready before you tap' },
  { key: 'autospeak', label: 'Read the word aloud', hint: 'English voice, slightly slowed' },
  { key: 'keepAwake', label: 'Keep the screen awake', hint: 'No dimming while the app is open' },
  { key: 'showReasoning', label: 'Show the model thinking', hint: 'When the server sends it' },
] as const

async function unpair(): Promise<void> {
  try {
    await api.logout()
    location.reload()
  } catch {
    toast('Could not unpair', 'error')
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="sheet-overlay" />
      <DialogContent class="sheet">
        <header class="sheet__head">
          <DialogTitle class="sheet__title">Settings</DialogTitle>
          <DialogClose class="icon-btn" aria-label="Close">✕</DialogClose>
        </header>
        <div class="sheet__body">
          <section class="group">
            <label class="group__label" for="target-language">Translate into</label>
            <SelectRoot v-model="settings.code">
              <SelectTrigger id="target-language" class="select">
                <SelectValue>
                  {{ languageByCode(settings.code).native }}
                  <span class="select__en">{{ languageByCode(settings.code).name }}</span>
                </SelectValue>
                <span aria-hidden="true" class="select__chevron">⌄</span>
              </SelectTrigger>
              <!-- Kept inside the dialog: a portaled popover inherits the dialog's
                   pointer-events lock and would be untappable on a phone. -->
              <SelectPortal disabled>
                <SelectContent class="select__content" position="popper" :side-offset="6">
                  <SelectViewport class="select__viewport">
                    <SelectItem
                      v-for="language in LANGUAGES"
                      :key="language.code"
                      class="select__item"
                      :value="language.code"
                    >
                      <SelectItemText>
                        {{ language.native }}
                        <span class="select__en">{{ language.name }}</span>
                      </SelectItemText>
                      <SelectItemIndicator class="select__tick">✓</SelectItemIndicator>
                    </SelectItem>
                  </SelectViewport>
                </SelectContent>
              </SelectPortal>
            </SelectRoot>
          </section>

          <section class="group">
            <span class="group__label">Look-up</span>
            <ul class="toggles">
              <li v-for="toggle in TOGGLES" :key="toggle.key" class="toggles__row">
                <span class="toggles__text">
                  <span class="toggles__label">{{ toggle.label }}</span>
                  <span class="toggles__hint">{{ toggle.hint }}</span>
                </span>
                <SwitchRoot v-model="settings[toggle.key]" class="switch">
                  <SwitchThumb class="switch__thumb" />
                </SwitchRoot>
              </li>
            </ul>
          </section>

          <section class="group group--footer">
            <p class="foot">{{ status.model }}</p>
            <p v-if="!status.hasApiKey" class="warn">
              No OpenRouter API key in config.json — look-ups will fail until you add one.
            </p>
            <button class="ghost foot__btn" @click="unpair">Unpair this phone</button>
          </section>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.group {
  padding: 14px 0;
  border-top: 1px solid var(--line);
}

.group:first-child {
  border-top: 0;
  padding-top: 4px;
}

.group__label {
  display: block;
  margin-bottom: 8px;
  color: var(--dim);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--tap);
  padding: 0 14px;
  color: var(--fg-strong);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  font-size: 17px;
}

.select__en {
  margin-left: 8px;
  color: var(--dim);
  font-size: 14px;
}

.select__chevron {
  color: var(--dim);
}

/* The Reka Select content is not a plain template element, so scoped rules
   never reach it — :deep() keeps these styles where they are needed. */
:deep(.select__content) {
  z-index: 60;
  overflow: hidden;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.9);
}

:deep(.select__viewport) {
  max-height: min(55dvh, 22rem);
  padding: 6px;
  overflow-y: auto;
}

.select__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px;
  border-radius: 10px;
  font-size: 16px;
  cursor: pointer;
  outline: none;
}

.select__item[data-highlighted] {
  background: #1b1b1b;
}

.select__tick {
  color: var(--accent);
}

.toggles {
  margin: 0;
  padding: 0;
  list-style: none;
}

.toggles__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 11px 0;
}

.toggles__text {
  display: flex;
  flex-direction: column;
}

.toggles__label {
  font-size: 16px;
}

.toggles__hint {
  color: var(--dim);
  font-size: 13px;
}

.switch {
  flex: none;
  width: 52px;
  height: 32px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 999px;
  transition: background 0.15s ease;
}

.switch[data-state='checked'] {
  background: var(--accent);
  border-color: var(--accent);
}

.switch__thumb {
  display: block;
  width: 26px;
  height: 26px;
  margin-left: 2px;
  background: var(--fg);
  border-radius: 50%;
  transition: transform 0.15s ease;
}

.switch[data-state='checked'] .switch__thumb {
  transform: translateX(20px);
  background: #06172e;
}

.group--footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.foot {
  margin: 0;
  color: var(--dimmer);
  font-size: 12px;
}

.warn {
  margin: 0;
  color: var(--warn);
  font-size: 14px;
}

.foot__btn {
  align-self: flex-start;
}
</style>
