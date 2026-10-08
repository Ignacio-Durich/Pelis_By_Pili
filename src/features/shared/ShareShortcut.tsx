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
        {/* Entre paréntesis, los nombres de iOS en inglés. */}
        <ol>
          <li>Abrí la app Atajos (Shortcuts) y tocá "+".</li>
          <li>Arriba, tocá el nombre y poné "Pelis By Pili".</li>
          <li>Agregá la acción "Pedir entrada" (Ask for Input): tipo Texto, pregunta "¿Qué peli o serie es? (opcional)".</li>
          <li>
            Agregá "Obtener contenido de URL" (Get Contents of URL) con esta dirección:
            <code>{SHARE_URL}</code>
            <button className="secondary" onClick={() => copy(SHARE_URL, 'url')}>
              Copiar dirección
            </button>
            {copied === 'url' && <span> ¡Copiada!</span>}
            Tocá la flechita de la acción: Método (Method) POST; en Encabezados (Headers) agregá <code>x-share-key</code> con tu clave; en
            Cuerpo de la solicitud (Request Body) elegí JSON y agregá <code>shared</code> con la variable "Entrada del atajo" (Shortcut Input)
            y <code>name</code> con "Entrada proporcionada" (Provided Input).
          </li>
          <li>
            Arriba aparece el bloque "Recibir … de …" (Receive … from Nowhere): donde dice "Ningún lado" (Nowhere) elegí "Hoja para
            compartir" (Share Sheet), y en los tipos dejá solo URL y Texto (URLs and Text). Si no aparece, tocá ⓘ abajo y activá "Mostrar en la
            hoja para compartir" (Show in Share Sheet).
          </li>
          <li>Agregá "Mostrar notificación" (Show Notification) con la variable "Contenido de URL" (Contents of URL), así ves si se guardó o qué falló.</li>
          <li>Probalo: en Instagram tocá Compartir → Pelis By Pili. El nombre se puede dejar vacío.</li>
          <li>
            Para el otro iPhone: podés pasarle el Atajo por iCloud, pero antes de compartirlo, borrá tu clave del encabezado (el link de
            iCloud lo puede abrir cualquiera que lo tenga). En el otro celular se pone su propia clave.
          </li>
        </ol>
      </details>
    </section>
  )
}
