import { useRef, useState } from 'react'
import { useCouple } from '../couple/coupleContext'
import { filterOptions } from '../titles/filters'
import { imdbScore, rtScore } from '../titles/ratings'
import { TitleCard } from '../titles/TitleCard'
import { TitleDetail } from '../titles/TitleDetail'
import { useTitles } from '../titles/useTitles'
import { MOODS, NO_ANSWERS, quickPick, TIME_OPTIONS, type Answers, type MoodId } from './quickPick'

export function QuickQuestions() {
  const { coupleId } = useCouple()
  const { titles, offline, load } = useTitles(coupleId)
  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS)
  const [detailId, setDetailId] = useState<string | null>(null)
  const scroll = useRef(0)

  const toWatch = titles?.filter((t) => t.status === 'to_watch') ?? []
  const { picks, filled } = quickPick(titles ?? [], answers)
  const detail = titles?.find((t) => t.id === detailId)
  const set = (patch: Partial<Answers>) => setAnswers({ ...answers, ...patch })
  const toggleMood = (id: MoodId) =>
    set({ moods: answers.moods.includes(id) ? answers.moods.filter((m) => m !== id) : [...answers.moods, id] })

  function openDetail(id: string) {
    scroll.current = window.scrollY
    setDetailId(id)
    window.scrollTo(0, 0)
  }

  function closeDetail() {
    setDetailId(null)
    requestAnimationFrame(() => window.scrollTo(0, scroll.current))
  }

  return (
    <>
      {/* Oculta (no desmontada) mientras se ve un detalle: se conservan las respuestas. */}
      <section className="quick" hidden={!!detail}>
        <h2>Preguntas rápidas</h2>
        <span>¿Cuánto tiempo tienen?</span>
        <div className="chips">
          {TIME_OPTIONS.map((o) => (
            <button key={o.label} className="chip" aria-pressed={answers.maxMinutes === o.minutes} onClick={() => set({ maxMinutes: o.minutes })}>
              {o.label}
            </button>
          ))}
        </div>
        <span>¿Qué ánimo tienen?</span>
        <div className="chips">
          {MOODS.map((m) => (
            <button key={m.id} className="chip" aria-pressed={answers.moods.includes(m.id)} onClick={() => toggleMood(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <span>¿Dónde lo ven?</span>
        <div className="chips">
          {[null, ...filterOptions(toWatch).platforms].map((p) => (
            <button key={p ?? 'any'} className="chip" aria-pressed={answers.platform === p} onClick={() => set({ platform: p })}>
              {p ?? 'Cualquiera'}
            </button>
          ))}
        </div>

        {offline && (
          <>
            <p role="alert">Sin conexión. Probá de nuevo.</p>
            <button onClick={load}>Reintentar</button>
          </>
        )}
        {titles === null && !offline && <p>Cargando…</p>}
        {titles !== null && (
          <>
            <h3>Les sugerimos</h3>
            {filled && <p>No encontramos 3 con ese ánimo; sumamos estas</p>}
            {picks.length === 0 && <p>Ningún título entra en ese tiempo y plataforma</p>}
            <ul className="title-list">
              {picks.map((t) => (
                <li key={t.id} data-testid="suggestion">
                  <TitleCard title={t.title} originalTitle={t.originalTitle} year={t.year} mediaType={t.mediaType} posterPath={t.posterPath}>
                    <small>{`IMDb ${imdbScore(t.imdbRating)} · RT ${rtScore(t.rottenTomatoes)}`}</small>
                  </TitleCard>
                  <button className="secondary" aria-label={`Ver detalle de ${t.title}`} onClick={() => openDetail(t.id)}>
                    Ver detalle
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {detail && <TitleDetail title={detail} onClose={closeDetail} />}
    </>
  )
}
