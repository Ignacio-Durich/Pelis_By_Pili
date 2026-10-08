type Props = {
  // Si no hay títulos suficientes, el aviso que se muestra (y los dos botones quedan deshabilitados).
  missing: string | null
  hasPartner: boolean
  error: string | null
  onOne: () => void
  onTwo: () => void
}

// "¿Cuántos celulares van a usar?" de Bumble y Top 3 secreto.
export function PhonesChoice({ missing, hasPartner, error, onOne, onTwo }: Props) {
  return (
    <>
      <h3>¿Cuántos celulares van a usar?</h3>
      {missing && <p>{missing}</p>}
      <div className="bumble-votes">
        <button disabled={!!missing} onClick={onOne}>
          📱 Uno
        </button>
        <button disabled={!!missing || !hasPartner} onClick={onTwo}>
          📱📱 Dos
        </button>
      </div>
      {!hasPartner && <small>Para usar dos celulares, tu pareja tiene que unirse</small>}
      {error && <p role="alert">{error}</p>}
    </>
  )
}
