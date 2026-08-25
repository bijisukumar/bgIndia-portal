import React from 'react'
import ReactDOM from 'react-dom/client'
import { initConfig } from '../../config'
// Chrome fires beforeinstallprompt as soon as the page qualifies — routinely
// before React has mounted — and it never replays it. Catch it here at module
// load and park it on window so InstallAppBanner can claim it whenever it
// renders, instead of silently missing the one shot.
window.__installPrompt = null
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  window.__installPrompt = e
  window.dispatchEvent(new Event('installpromptready'))
})

// Config must be in place before App's module graph evaluates: several
// screens read CONFIG at module scope, and those reads happen on import.
initConfig()
  .then(() => import('./App'))
  .then(({ default: App }) => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  })
