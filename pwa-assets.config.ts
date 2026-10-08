import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// El ícono de iPhone y el "maskable" sin el margen blanco del preset: todo el fondo azul de la app.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#1b1b2f' } },
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#1b1b2f' } },
  },
  images: ['public/icon.svg'],
})
