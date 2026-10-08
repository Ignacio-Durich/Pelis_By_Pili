import { useEffect, useState } from 'react'
import { createShareKey, SHARE_URL, shareKeyCreatedAt } from './sharedApi'

// Ajustes → "Atajo para compartir": la clave personal y la guía para armar el Atajo de iOS.
export function ShareShortcut() {
  // undefined = cargando; null = todavía no creó una
  const [createdAt, setCreatedAt] = useState<string | null | undefined>(undefined)
  const [key, setKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState<'key' | 'url' | null>(null)

  useEffect(() => {
    shareKeyCreatedAt().then(setCreatedAt, () => setCreatedAt(null))
  }, [])

  async function create() {
    setBusy(true)
    setError(false)
    try {
      setKey(await createShareKey())
      setCreatedAt(new Date().toISOString())
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  async function copy(text: string, what: 'key' | 'url') {
    await navigator.clipboard.writeText(text)
    setCopied(what)
  }

  return (
    <section className="share-shortcut">
      <h2>Atajo para compartir</h2>
      <p>Guardá en Pelis By Pili lo que ves en Instagram, TikTok o donde sea, desde el menú Compartir.</p>
      {key ? (
        <>
          <input readOnly aria-label="Tu clave" value={key} onFocus={(e) => e.target.select()} />
          <button onClick={() => copy(key, 'key')}>Copiar clave</button>
          {copied === 'key' && <p>¡Copiada!</p>}
          <p>Guardala en el Atajo ahora: después no se vuelve a mostrar</p>
        </>
      ) : createdAt ? (
        <>
          <p>{`Tu clave se creó el ${new Date(createdAt).toLocaleDateString('es-AR')}`}</p>
          <button className="secondary" disabled={busy} onClick={create}>
            Crear otra clave
          </button>
          <small>La clave anterior deja de funcionar</small>
        </>
      ) : (
        createdAt === null && (
          <button disabled={busy} onClick={create}>
            Crear mi clave
          </button>
        )
      )}
      {error && <p role="alert">No se pudo crear la clave. Probá de nuevo.</p>}
      <details>
        <summary>Cómo armar el Atajo</summary>
        <ol>
          <li>Abrí la app Atajos y tocá "+".</li>
          <li>Arriba, tocá el nombre y poné "Pelis By Pili".</li>
          <li>Tocá ⓘ (o "Detalles"), activá "Mostrar en la hoja para compartir" y en "Tipos" dejá solo "URL" y "Texto".</li>
          <li>Agregá la acción "Pedir entrada": tipo Texto, pregunta "¿Qué peli o serie es? (opcional)".</li>
          <li>
            Agregá "Obtener contenido de URL" con esta dirección:
            <code>{SHARE_URL}</code>
            <button className="secondary" onClick={() => copy(SHARE_URL, 'url')}>
              Copiar dirección
            </button>
            {copied === 'url' && <span> ¡Copiada!</span>}
            Tocá "Mostrar más": Método POST; en Encabezados agregá <code>x-share-key</code> con tu clave; en Cuerpo de la solicitud elegí
            JSON y agregá <code>shared</code> = "Entrada del atajo" y <code>name</code> = "Entrada proporcionada".
          </li>
          <li>Agregá "Mostrar notificación" con "Guardado en Pelis By Pili".</li>
          <li>Probalo: en Instagram tocá Compartir → Pelis By Pili.</li>
          <li>Para el otro iPhone: compartí el Atajo por iCloud, y en el otro celular cambiá la clave por la suya.</li>
        </ol>
      </details>
    </section>
  )
}
