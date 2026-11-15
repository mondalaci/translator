import { contextBridge, ipcRenderer } from 'electron'

/**
 * The only surface the renderer gets: hide me, quit, tell me your preferences.
 * No Node, no filesystem, no shell.
 */
contextBridge.exposeInMainWorld('overlay', {
  hide: () => ipcRenderer.send('overlay:hide'),
  quit: () => ipcRenderer.send('overlay:quit'),
  setHideOnBlur: (enabled) => ipcRenderer.send('overlay:hideOnBlur', Boolean(enabled)),
  onShown: (handler) => {
    ipcRenderer.on('overlay:shown', () => handler())
  },
  onHidden: (handler) => {
    ipcRenderer.on('overlay:hidden', () => handler())
  },
})
