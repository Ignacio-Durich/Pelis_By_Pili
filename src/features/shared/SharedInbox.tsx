import { useState } from 'react'
import { useMemberName } from '../couple/coupleContext'
import { dismissShared, sourceLabel, type SharedItem } from './sharedApi'

// La bandeja de la pareja: lo que llegó del menú Compartir de otras apps, esperando que alguien
// lo busque y lo agregue (o lo descarte).
export function SharedInbox({ items, onSearch }: { items: SharedItem[]; onSearch: (item: SharedItem) => void }) {
  const nameOf = useMemberName()
  const [failed, setFailed] = useState(false)

  if (items.length === 0) return null

  function dismiss(id: string) {
    setFailed(false)
    dismissShared(id).catch(() => setFailed(true))
  }

  return (
    <details className="shared-inbox">
      <summary>{`📥 Compartidos (${items.length})`}</summary>
      {failed && <p role="alert">No se pudo descartar. Probá de nuevo.</p>}
      <ul>
        {items.map((item) => {
          const label = sourceLabel(item)
          const who = `lo compartió ${nameOf(item.sharedBy)}`
          return (
            <li key={item.id}>
              {item.query && <strong>{item.query}</strong>}
              {item.body && <span>{item.body}</span>}
              <small>{label ? `${label} · ${who}` : who}</small>
              <div className="shared-actions">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    Ver el link
                  </a>
                )}
                {/* "Agregar lo compartido": el botón "+" de la lista ya se llama "Agregar". */}
                <button aria-label="Agregar lo compartido" onClick={() => onSearch(item)}>
                  Agregar
                </button>
                <button className="secondary" onClick={() => dismiss(item.id)}>
                  Descartar
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </details>
  )
}
