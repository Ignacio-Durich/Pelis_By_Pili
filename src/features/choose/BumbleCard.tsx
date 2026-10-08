import { useRef, useState, type PointerEvent } from 'react'
import { fetchTitleDetail } from '../titles/detailApi'
import type { Title } from '../titles/titlesApi'
import { TitleFacts } from './TitleFacts'

const VOTE_PX = 100
const TAP_PX = 10

// `undo`: el botón de deshacer entre el No y el Sí, como el "rewind" de Bumble.
type Props = { title: Title; onVote: (liked: boolean) => void; undo?: { onClick: () => void; disabled: boolean } }

// Carta tipo Tinder/Bumble: se arrastra para votar y se toca para ver la sinopsis.
export function BumbleCard({ title, onVote, undo }: Props) {
  const start = useRef<number | null>(null)
  const [dx, setDx] = useState(0)
  // Guardados por id: una carta nueva arranca de frente y sin sinopsis.
  const [flippedId, setFlippedId] = useState<string | null>(null)
  const [synopsis, setSynopsis] = useState<{ id: string; text: string | null } | null>(null)
  const flipped = flippedId === title.id

  function flip() {
    if (flipped) return setFlippedId(null)
    setFlippedId(title.id)
    if (synopsis?.id === title.id) return
    const id = title.id
    setSynopsis({ id, text: null })
    fetchTitleDetail(id).then(
      (d) => setSynopsis((s) => (s?.id === id ? { id, text: d.overview || 'Sin sinopsis' } : s)),
      () => setSynopsis((s) => (s?.id === id ? { id, text: 'No se pudo cargar la sinopsis' } : s)),
    )
  }

  function down(e: PointerEvent) {
    start.current = e.clientX
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function move(e: PointerEvent) {
    if (start.current !== null) setDx(e.clientX - start.current)
  }
  function up(e: PointerEvent) {
    if (start.current === null) return
    const d = e.clientX - start.current
    start.current = null
    setDx(0)
    if (d > VOTE_PX) onVote(true)
    else if (d < -VOTE_PX) onVote(false)
    else if (Math.abs(d) < TAP_PX) flip()
  }

  return (
    <div className="bumble">
      <div
        className={flipped ? 'bumble-card flipped' : 'bumble-card'}
        data-testid="bumble-card"
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Volver al frente de la carta' : 'Ver sinopsis'}
        style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 20}deg)` : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          start.current = null
          setDx(0)
        }}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && flip()}
      >
        {flipped ? (
          <div className="bumble-back">
            <h3>Sinopsis</h3>
            <p>{synopsis?.text ?? 'Cargando…'}</p>
          </div>
        ) : (
          <>
            {title.posterPath && <img src={`https://image.tmdb.org/t/p/w500${title.posterPath}`} alt="" draggable={false} />}
            <div className="bumble-info">
              <TitleFacts title={title} />
            </div>
          </>
        )}
      </div>
      <div className="bumble-votes">
        <button className="secondary" onClick={() => onVote(false)}>
          👎 No
        </button>
        {undo && (
          <button className="secondary undo" aria-label="Deshacer" disabled={undo.disabled} onClick={undo.onClick}>
            ↩️
          </button>
        )}
        <button onClick={() => onVote(true)}>👍 Sí</button>
      </div>
    </div>
  )
}
