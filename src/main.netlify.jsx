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
        // Update banner logic (including SKIP_WAITING) is handled inside App.jsx.
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
