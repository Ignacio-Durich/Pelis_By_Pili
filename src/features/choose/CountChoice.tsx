// "¿Cuántas…?" al empezar un modo: Top 3 secreto, Bumble y el Torneo.
export function CountChoice({ label, options, value, onChange }: { label: string; options: readonly number[]; value: number; onChange: (n: number) => void }) {
  return (
    <>
      <h3>{label}</h3>
      <div className="segmented">
        {options.map((n) => (
          <button key={n} aria-pressed={value === n} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
    </>
  )
}
