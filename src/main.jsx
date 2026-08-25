import React from 'react'
import ReactDOM from 'react-dom/client'
import { initConfig } from './config'

// Config must be in place before App's module graph evaluates: several
// screens read CONFIG at module scope, and those reads happen on import.
initConfig()
  .then(() => import('./apps/manage/App'))
  .then(({ default: App }) => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  })