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

        // When a new SW installs, do NOT skip waiting automatically.
        // The update banner in App.jsx lets the user decide when to apply it.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version is ready and waiting — notify the UI via the
              // existing updateReady state in App.jsx. Do nothing else here.
              // The user will see the banner and choose "Update now" or "Later".
            }
          })
        })

        // Do NOT call reg.update() or postMessage SKIP_WAITING on visibility
        // change. That was causing forced updates regardless of user choice.
      })
      .catch(err => console.warn('SW registration failed:', err))

    // When SW controller changes (new SW activated by user choice), reload the page
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
