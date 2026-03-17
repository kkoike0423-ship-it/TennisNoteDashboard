import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ManagedPlayerProvider } from './contexts/ManagedPlayerContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ManagedPlayerProvider>
      <App />
    </ManagedPlayerProvider>
  </StrictMode>,
)
