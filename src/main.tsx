import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './app/styles.css'
import { applyTheme, savedTheme } from './lib/theme'

// El tema de este celular, antes de dibujar: así no se ve un parpadeo de colores al abrir.
applyTheme(savedTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
