import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Capture beforeinstallprompt BEFORE React mounts.
window.__pwaInstallPrompt = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__pwaInstallPrompt = e
  window.dispatchEvent(new Event('pwaPromptReady'))
})
window.addEventListener('appinstalled', () => {
  window.__pwaInstallPrompt = null
  window.dispatchEvent(new Event('pwaInstalled'))
})

// Register service worker — Netlify serves from root, not /re-former/
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        reg.update()

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })

        document.addEventListener('visibilitychange', async () => {
          if (document.visibilityState !== 'visible') return
          try {
            await reg.update()
            setTimeout(() => {
              if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
            }, 500)
          } catch { /* ignore */ }
        })
      })
      .catch(err => console.warn('SW registration failed:', err))

    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload() }
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
