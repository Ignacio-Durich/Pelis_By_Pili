// La fila de arriba en una partida (Bumble, Top 3 secreto): volver al menú y, si se puede, terminar.
export function GameTop({ onBack, onEnd }: { onBack: () => void; onEnd?: () => void }) {
  return (
    <div className="bumble-top">
      <button className="back" onClick={onBack}>
        Volver a Elegir
      </button>
      {onEnd && (
        <button className="end" onClick={onEnd}>
          Terminar
        </button>
      )}
    </div>
  )
}
