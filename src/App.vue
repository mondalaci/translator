<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ToastProvider, ToastRoot, ToastViewport } from 'reka-ui'
import { api, type Status } from '@/api'
import LookupView from '@/components/LookupView.vue'
import PairScreen from '@/components/PairScreen.vue'
import { dismiss, toasts } from '@/lib/toast'

const status = ref<Status | null>(null)
const failure = ref('')

async function loadStatus(): Promise<void> {
  try {
    status.value = await api.status()
  } catch (error) {
    failure.value = error instanceof Error ? error.message : 'Cannot reach the server.'
  }
}

onMounted(loadStatus)
</script>

<template>
  <ToastProvider>
    <p v-if="failure" class="boot boot--error">{{ failure }}</p>
    <p v-else-if="!status" class="boot">connecting…</p>
    <LookupView v-else-if="status.authenticated" :status="status" />
    <PairScreen v-else :status="status" />

    <ToastRoot
      v-for="item in toasts"
      :key="item.id"
      v-model:open="item.open"
      :class="['toast', 'toast--' + item.kind]"
      @update:open="dismiss(item.id)"
    >
      {{ item.message }}
    </ToastRoot>
    <ToastViewport class="toast-viewport" />
  </ToastProvider>
</template>

<style scoped>
.boot {
  margin: 0;
  padding: 40vh 20px 0;
  text-align: center;
  color: var(--dim);
  font-size: 15px;
}

.boot--error {
  padding-top: 30vh;
  color: var(--danger);
}
</style>
