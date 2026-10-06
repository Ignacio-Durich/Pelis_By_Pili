# Decisiones tomadas fuera del plan (etapas 0 y 1)

Cada línea: decisión — motivo — costo si está mal.

## Organización
- Repo con un commit inicial solo de docs en `main`; el trabajo va en la rama `etapas-0-1` — no implementar directo en main — un merge.
- Orden de tareas: 1, 2 y 3 (código), 6, 7, 8; después 5, los pasos con claves de 2 y 3, y al final 4 y 9 — avanzar sin claves mientras Nacho crea las cuentas — ninguno, las interfaces no cambian.

## Task 1
- Vitest solo incluye `src/**/*.test.{ts,tsx}` y `scripts/**/*.test.ts` — `npm test` no debe levantar `tests/security` (necesita claves y red; corre con `npm run test:security`) — ninguno.
- `src/test/setup.ts` hace `cleanup()` de Testing Library tras cada test — Vitest sin globals no lo hace solo y los tests de UI se contaminan — ninguno.
- `typecheck` es `tsc -b` (los tsconfig de la plantilla ya traen `noEmit`); `tsconfig.node.json` incluye `pwa-assets.config.ts` y `scripts/` — así el typecheck cubre los scripts — ninguno.
- Plantilla `react-ts` de Vite generada en una carpeta temporal y copiada sin pisar `docs/`; se descartó su contenido de demo (App.css, index.css, assets, favicon.svg) — YAGNI — ninguno.
- Íconos generados con `pwa-assets-generator` y `minimal2023Preset` (64, 192, 512, maskable 512, apple-touch 180, favicon.ico); script npm `generate-pwa-assets` para regenerarlos — es el preset estándar de la herramienta — ninguno.
- `viewport-fit=cover` en el meta viewport — necesario para usar las áreas seguras del iPhone en la Task 8 — ninguno.
- Colores: `theme_color` y `background_color` `#1b1b2f`; ícono placeholder "PP" amarillo sobre fondo oscuro — el plan los deja a elección — se cambian en dos líneas.
- `registerType: 'autoUpdate'` en vite-plugin-pwa — las nuevas versiones se toman solas, sin pantalla de "actualizar" — una versión vieja puede verse hasta recargar.
- El postinstall de esbuild quedó sin aprobar (npm 11 pide aprobar scripts); `tsx` y Vite funcionan igual con el binario opcional — no correr scripts de instalación sin necesidad — si algo falla, `npm install-scripts approve esbuild`.
