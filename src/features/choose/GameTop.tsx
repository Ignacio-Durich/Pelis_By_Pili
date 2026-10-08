// La fila de arriba en una partida (Bumble, Top 3 secreto): volver al menú y, si se puede, terminar.
export function GameTop({ onBack, onEnd }: { onBack: () => void; onEnd?: () => void }) {
  return (
    <div className="bumble-top">
      <button className="back" onClick={onBack}>
        Volver a los modos
      </button>
      {onEnd && (
        <button className="back" onClick={onEnd}>
          Terminar
        </button>
      )}
    </div>
  )
}
