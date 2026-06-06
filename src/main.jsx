import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'

const host = window.location.hostname

const App = host.startsWith('stayvibe')
  ? lazy(() => import('./apps/stayvibe/App.jsx'))
  : host.startsWith('rev360')
  ? lazy(() => import('./apps/rev360/App.jsx'))
  : host.startsWith('estate360')
  ? lazy(() => import('./apps/estate360/App.jsx'))
  : lazy(() => import('./apps/manage/App.jsx'))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <App />
    </Suspense>
  </React.StrictMode>
)