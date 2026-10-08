// Temas de color. Cada celular elige el suyo en Ajustes y se guarda en el celular. `applyTheme`
// pone los colores como variables CSS; styles.css las usa (sus valores por defecto son los de
// "Azul noche", el tema de siempre).

export type Theme = {
  id: string
  name: string
  bg: string
  surface: string
  border: string
  accent: string
  onAccent: string
  text: string
  muted: string
  tabs: string
  light?: boolean
}

export const THEMES: Theme[] = [
  { id: 'noche', name: 'Azul noche', bg: '#1b1b2f', surface: '#2a2a45', border: '#44446a', accent: '#ffb703', onAccent: '#1b1b2f', text: '#f4f4f8', muted: '#b8b8d0', tabs: '#14142a' },
  { id: 'cine', name: 'Rojo cine', bg: '#1a0b10', surface: '#2e1219', border: '#5a2430', accent: '#f2c14e', onAccent: '#3a0d14', text: '#f8eef0', muted: '#c9a9ae', tabs: '#12070a' },
  { id: 'electrico', name: 'Azul eléctrico', bg: '#0b1324', surface: '#15213d', border: '#2b3f6b', accent: '#3b82f6', onAccent: '#ffffff', text: '#eef3ff', muted: '#a6b4d4', tabs: '#070d1a' },
  { id: 'violeta', name: 'Violeta y rosa', bg: '#1a1030', surface: '#2a1b4a', border: '#4a3475', accent: '#f472b6', onAccent: '#3b0a24', text: '#f7f0ff', muted: '#c3b3e0', tabs: '#120a22' },
  { id: 'esmeralda', name: 'Verde esmeralda', bg: '#0c1f1a', surface: '#143229', border: '#24584a', accent: '#34d399', onAccent: '#052e22', text: '#ecfdf5', muted: '#a7cfc0', tabs: '#081612' },
  { id: 'dorado', name: 'Negro y dorado', bg: '#0b0b0b', surface: '#1b1b1b', border: '#3a3a3a', accent: '#d4a017', onAccent: '#1a1404', text: '#f5f5f5', muted: '#a3a3a3', tabs: '#050505' },
  { id: 'coral', name: 'Crema y coral', bg: '#fbf7f2', surface: '#ffffff', border: '#eadfd3', accent: '#ff6b4a', onAccent: '#ffffff', text: '#2b2118', muted: '#7d6b5c', tabs: '#f3ece3', light: true },
  { id: 'oceano', name: 'Océano', bg: '#071a22', surface: '#0e2a36', border: '#1f4d5e', accent: '#22d3ee', onAccent: '#042a33', text: '#ecfeff', muted: '#9cc5cf', tabs: '#04131a' },
  { id: 'atardecer', name: 'Atardecer', bg: '#1f1020', surface: '#33182f', border: '#5a2c4f', accent: '#fb923c', onAccent: '#3a1206', text: '#fff4ec', muted: '#d1a9b8', tabs: '#160b17' },
  { id: 'blanco', name: 'Blanco y azul', bg: '#f5f7fb', surface: '#ffffff', border: '#d9e0ec', accent: '#2563eb', onAccent: '#ffffff', text: '#111827', muted: '#64748b', tabs: '#eaeef6', light: true },
  { id: 'bordo', name: 'Bordó y crema', bg: '#2a0f17', surface: '#3d1621', border: '#6b2a3a', accent: '#f5e6c8', onAccent: '#2a0f17', text: '#fbf3ea', muted: '#cfb3b8', tabs: '#1d0910' },
  { id: 'menta', name: 'Menta', bg: '#f1faf6', surface: '#ffffff', border: '#cfe9df', accent: '#0f9d76', onAccent: '#ffffff', text: '#0f2a22', muted: '#5f7d72', tabs: '#e4f4ed', light: true },
  { id: 'lavanda', name: 'Lavanda', bg: '#f6f3ff', surface: '#ffffff', border: '#e0d8f7', accent: '#7c3aed', onAccent: '#ffffff', text: '#1e1533', muted: '#6b5f86', tabs: '#ece6fb', light: true },
  { id: 'grafito', name: 'Grafito y lima', bg: '#121212', surface: '#1f1f1f', border: '#383838', accent: '#a3e635', onAccent: '#1a2e05', text: '#f4f4f5', muted: '#a1a1aa', tabs: '#0a0a0a' },
  { id: 'arena', name: 'Arena y terracota', bg: '#f7f1e8', surface: '#fffaf3', border: '#e8dccb', accent: '#c2410c', onAccent: '#ffffff', text: '#2f241b', muted: '#85715f', tabs: '#efe6d8', light: true },
]

export const DEFAULT_THEME = 'noche'
const KEY = 'pelis-theme'

const find = (id: string) => THEMES.find((t) => t.id === id)

export function applyTheme(id: string): void {
  const theme = find(id) ?? find(DEFAULT_THEME)!
  const style = document.documentElement.style
  const vars: Record<string, string> = {
    '--bg': theme.bg,
    '--surface': theme.surface,
    '--border': theme.border,
    '--accent': theme.accent,
    '--on-accent': theme.onAccent,
    '--text': theme.text,
    '--muted': theme.muted,
    '--tabs': theme.tabs,
    // En los temas claros el rojo de los avisos va más oscuro, para que se lea.
    '--danger': theme.light ? '#b42318' : '#ff8a80',
  }
  for (const [name, value] of Object.entries(vars)) style.setProperty(name, value)
  style.colorScheme = theme.light ? 'light' : 'dark'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg)
}

export function savedTheme(): string {
  try {
    const id = localStorage.getItem(KEY)
    return id && find(id) ? id : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function saveTheme(id: string): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Sin almacenamiento el tema dura hasta cerrar la app.
  }
}
