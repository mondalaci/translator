import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')

// Offline shell: the app itself opens without the network, look-ups still need the PC.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
