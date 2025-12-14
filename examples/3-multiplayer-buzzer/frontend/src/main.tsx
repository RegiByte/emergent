import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// Don't start system here - let App decide when based on role!
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

