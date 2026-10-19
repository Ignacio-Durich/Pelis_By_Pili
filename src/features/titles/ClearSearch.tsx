import type { RefObject } from 'react'

// La ✕ para vaciar un buscador (Safari en iPhone no la muestra sola). Va dentro de un .search-field,
// encima del campo, y deja el cursor ahí para escribir lo siguiente.
export function ClearSearch({ value, onClear, input }: { value: string; onClear: () => void; input: RefObject<HTMLInputElement | null> }) {
  if (!value) return null
  return (
    <button
      type="button"
      className="search-clear"
      aria-label="Borrar lo escrito"
      onClick={() => {
        onClear()
        input.current?.focus()
      }}
    >
      ✕
    </button>
  )
}
