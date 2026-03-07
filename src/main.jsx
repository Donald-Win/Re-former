import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/re-former/sw.js')
      .then(reg => {
        // Check for updates on each load
        reg.update()

        // When a new SW is waiting, prompt reload
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — activate immediately
              newWorker.postMessage('SKIP_WAITING')
            }
          })
        })
      })
      .catch(err => console.warn('SW registration failed:', err))

    // Reload page when new SW takes control
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
