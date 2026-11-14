<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import QRCode from 'qrcode'
import { api, type PairedDevice, type Status } from '@/api'
import { toast } from '@/lib/toast'

const props = defineProps<{ status: Status }>()

const url = ref('')
const qrSvg = ref('')
const devices = ref<PairedDevice[]>([])
const loading = ref(true)
const rotating = ref(false)
const copied = ref(false)
let timer = 0

const token = computed(() => {
  const match = /[?&]k=([^&]+)/.exec(url.value)
  return match?.[1] ?? ''
})

async function loadLink(): Promise<void> {
  try {
    const link = await api.pairLink()
    url.value = link.url
    qrSvg.value = await QRCode.toString(link.url, {
      type: 'svg',
      margin: 2,
      width: 240,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Cannot build the pairing link', 'error')
  } finally {
    loading.value = false
  }
}

async function pollDevices(): Promise<void> {
  if (!props.status.pairingAvailable) return
  try {
    const next = await api.devices()
    if (next.devices.length > devices.value.length) toast('Phone paired ✓', 'success')
    devices.value = next.devices
  } catch {
    /* the server may be restarting */
  }
}

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(url.value)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1600)
  } catch {
    toast('Clipboard is blocked here', 'error')
  }
}

async function openHere(): Promise<void> {
  if (!token.value) return
  try {
    await api.login(token.value)
    location.reload()
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Could not sign in', 'error')
  }
}

async function rotate(): Promise<void> {
  rotating.value = true
  try {
    const next = await api.rotate()
    url.value = next.url
    qrSvg.value = await QRCode.toString(next.url, {
      type: 'svg',
      margin: 2,
      width: 240,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    })
    devices.value = []
    toast('New code generated — the old link is dead', 'success')
  } catch (error) {
    toast(error instanceof Error ? error.message : 'Could not rotate', 'error')
  } finally {
    rotating.value = false
  }
}

onMounted(() => {
  void loadLink()
  void pollDevices()
  timer = window.setInterval(() => void pollDevices(), 4000)
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="pair">
    <header class="pair__head">
      <h1 class="pair__title">translator</h1>
      <p class="pair__sub">
        English look-ups on your phone, answered by this PC. Model
        <span class="mono">{{ status.model }}</span>, target
        <strong>{{ status.language.targetName }}</strong>.
      </p>
    </header>

    <div v-if="!status.pairingAvailable" class="pair__panel">
      <p class="warn">
        Open <code class="mono">http://localhost:{{ status.port }}</code> on the PC to show the
        pairing QR code. This page hides it from other machines on the network on purpose.
      </p>
    </div>

    <div v-else class="pair__panel">
      <div class="qr">
        <p v-if="loading" class="qr__placeholder">building code…</p>
        <!-- QR images are sanitised by qrcode's own SVG writer. -->
        <div v-else class="qr__svg" v-html="qrSvg" />
      </div>

      <ol class="steps">
        <li>Join the phone to the same Wi-Fi as this PC.</li>
        <li>Scan the code — the phone signs in and keeps a long-lived cookie.</li>
        <li>
          Add it to your home screen (share → <em>Add to Home Screen</em>) so full screen works.
        </li>
      </ol>

      <p class="link mono">{{ url || '…' }}</p>

      <div class="pair__actions">
        <button class="ghost" @click="copyLink">{{ copied ? 'Copied' : 'Copy link' }}</button>
        <button class="ghost" @click="openHere">Use in this window</button>
        <button class="ghost" :disabled="rotating" @click="rotate">
          {{ rotating ? 'Rotating…' : 'New code' }}
        </button>
      </div>
    </div>

    <footer class="pair__foot">
      <p v-if="!status.hasApiKey" class="warn">
        No OpenRouter API key yet — put yours in <code class="mono">config.json</code> →
        <code class="mono">openrouter.apiKey</code> and restart.
      </p>
      <p v-if="devices.length" class="paired">
        paired: <span v-for="device in devices" :key="device.ip + device.userAgent">{{ device.ip }}</span>
      </p>
      <p v-else-if="status.pairingAvailable" class="paired paired--wait">waiting for a phone…</p>
    </footer>
  </div>
</template>

<style scoped>
.pair {
  max-width: 40rem;
  margin: 0 auto;
  padding: calc(28px + var(--safe-t)) 20px calc(28px + var(--safe-b));
}

.pair__title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 650;
  letter-spacing: 0.01em;
}

.pair__sub {
  margin: 0 0 22px;
  color: var(--dim);
  font-size: 15px;
}

.pair__sub strong {
  color: var(--fg);
  font-weight: 600;
}

.pair__panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}

.qr {
  align-self: center;
  padding: 12px;
  background: #ffffff;
  border-radius: 12px;
  line-height: 0;
}

.qr__svg :deep(svg) {
  display: block;
  width: 240px;
  height: 240px;
}

.qr__placeholder {
  margin: 0;
  padding: 100px 60px;
  color: #666;
  font-size: 14px;
  line-height: 1.4;
}

.steps {
  margin: 0;
  padding-left: 1.2em;
  color: var(--fg);
  font-size: 15px;
}

.steps li {
  margin-bottom: 6px;
}

.link {
  margin: 0;
  padding: 10px 12px;
  background: var(--surface-2);
  border-radius: 10px;
  color: var(--dim);
  font-size: 13px;
  word-break: break-all;
}

.pair__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pair__foot {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.warn {
  margin: 0;
  color: var(--warn);
  font-size: 14px;
}

.paired {
  margin: 0;
  color: #78d18c;
  font-size: 14px;
  display: flex;
  gap: 10px;
}

.paired--wait {
  color: var(--dimmer);
}
</style>
