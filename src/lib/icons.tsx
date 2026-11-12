// Íconos de trazo (24×24, estilo Tabler) para las pestañas, el menú Elegir y los botones sobre los pósters.
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

const paths = {
  grid: 'M5 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15 4h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM5 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM15 14h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z',
  sparkles:
    'M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2-2a2 2 0 0 1-2-2a2 2 0 0 1-2 2zm0-12a2 2 0 0 1 2 2a2 2 0 0 1 2-2a2 2 0 0 1-2-2a2 2 0 0 1-2 2zm-7 12a6 6 0 0 1 6-6a6 6 0 0 1-6-6a6 6 0 0 1-6 6a6 6 0 0 1 6 6z',
  dice: `M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z${circle(8.5, 8.5, 0.6)}${circle(12, 12, 0.6)}${circle(15.5, 15.5, 0.6)}`,
  settings: `${circle(14, 6, 2)}M4 6h8M16 6h4${circle(8, 12, 2)}M4 12h2M10 12h10${circle(17, 18, 2)}M4 18h11M19 18h1`,
  heart: 'M19.5 12.572L12 20l-7.5-7.428a5 5 0 1 1 7.5-6.566a5 5 0 1 1 7.5 6.572',
  eyeOff:
    'M10.585 10.587a2 2 0 0 0 2.829 2.828M16.681 16.673A8.717 8.717 0 0 1 12 18c-3.6 0-6.6-2-9-6c1.272-2.12 2.712-3.678 4.32-4.674m2.86-1.146A9.055 9.055 0 0 1 12 6c3.6 0 6.6 2 9 6c-.666 1.11-1.379 2.067-2.138 2.87M3 3l18 18',
  trophy: `M8 21h8M12 17v4M7 4h10M17 4v8a5 5 0 0 1-10 0V4${circle(5, 9, 2)}${circle(19, 9, 2)}`,
  wheel: `${circle(12, 12, 9)}M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4`,
  bolt: 'M13 3v7h6l-8 11v-7H5l8-11',
  plus: 'M12 5v14M5 12h14',
  x: 'M18 6L6 18M6 6l12 12',
  check: 'M5 12l5 5L20 7',
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}
