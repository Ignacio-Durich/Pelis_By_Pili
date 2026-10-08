import { useState } from 'react'
import { applyTheme, savedTheme, saveTheme, THEMES } from '../../lib/theme'

// Ajustes → Tema: cada celular elige el suyo y la app cambia al instante.
export function ThemePicker() {
  const [current, setCurrent] = useState(savedTheme)

  function choose(id: string) {
    applyTheme(id)
    saveTheme(id)
    setCurrent(id)
  }

  return (
    <section className="themes">
      <h2>Tema</h2>
      <div className="theme-grid" role="group" aria-label="Tema">
        {THEMES.map((t) => (
          <button key={t.id} className="theme-option" aria-pressed={current === t.id} onClick={() => choose(t.id)}>
            {/* Una mini pantalla con los colores del tema. */}
            <span className="theme-swatch" aria-hidden="true" style={{ background: t.bg, borderColor: t.border }}>
              <span style={{ background: t.surface }} />
              <span style={{ background: t.accent }} />
            </span>
            {t.name}
          </button>
        ))}
      </div>
    </section>
  )
}
