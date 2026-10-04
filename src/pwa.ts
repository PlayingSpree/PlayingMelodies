// The service worker (DESIGN.md §2). A new version downloads in the
// background and waits; Home offers a reload once it's ready (§7.1), and
// closing every window of the app still lets it take over on its own.

import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { registerSW } from 'virtual:pwa-register'

const updateStore = createStore<{ ready: boolean }>(() => ({ ready: false }))
let applyUpdate = () => {}

export function startServiceWorker(): void {
  const update = registerSW({
    onNeedRefresh: () => updateStore.setState({ ready: true }),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return
      // iOS resumes an installed app rather than relaunching it, so a
      // launch-time check alone would rarely see a new version.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        registration.update().catch(() => {})
      })
    },
  })
  applyUpdate = () => void update(true)
}

export const useUpdateReady = () => useStore(updateStore, (s) => s.ready)

// Activates the waiting version and reloads into it.
export const reloadToUpdate = () => applyUpdate()
