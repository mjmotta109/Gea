# Traspaso de sesión — léeme PRIMERO

Este documento es para el asistente (IA o humano) que retome el
desarrollo de Gea. El director del proyecto es arquitecto, no
programador: él dirige en español, tú desarrollas. Léelo entero antes
de tocar una línea.

## 1. Qué es esto

**Gea**: motor de RPG táctico + juego de bestias mecánicas (sucesor
espiritual de FFT con profundidad Armored Core/BattleTech). La visión
completa, los seis pilares y TODAS las decisiones fechadas viven en
`docs/GAME-DESIGN.md` — es la constitución del proyecto. Léelo después
de este archivo.

## 2. Leyes permanentes (no negociables)

1. **Motor separado del juego**: `src/core` no conoce el universo
   (cero vocabulario de Zoids). `src/game` es puro y determinista.
   `src/data` es contenido (lo PROVISIONAL está marcado). `src/web` es
   el cliente.
2. **Determinismo total**: sin dados escondidos; azar por clave grabada
   en el estado. El golden master (`tests/golden/`) vigila el motor:
   solo se regenera con `npm run golden:update` en un commit que lo
   declare y explique.
3. **La máquina NO gana experiencia** — solo el piloto. (La máquina sí
   gana HISTORIA: hoja de servicio y cicatrices.)
4. **Consecuencias anunciadas**: toda elección muestra su precio en el
   botón. Sin letra pequeña.
5. **Todo autocontenido**: `npm run web` genera `dist/web/gea.html`
   (un solo archivo, sin red). Gráficos procedurales (SVG/canvas),
   sonido WebAudio. Cero archivos externos hasta que llegue el arte
   encargado (`docs/ENCARGO-ARTE.md`, buzón `art/`).
6. **Aplazados por decisión del director**: niebla de guerra/sensores
   y 3D real. No los propongas de nuevo salvo que él los pida.

## 3. El ritual de cada bloque de trabajo

1. Lee el código antes de editar; toca con bisturí.
2. Código + **tests vitest** (230 en verde al momento del traspaso:
   `npx vitest run`). `npx tsc --noEmit` limpio.
3. **Verificación Playwright** del flujo real: Chromium en
   `/opt/pw-browsers/chromium`; guiones de ejemplo en el scratchpad de
   la sesión anterior (patrón: sembrar localStorage, acelerar
   setTimeout a 5ms, capturas que se REVISAN visualmente antes de
   commitear). Los diálogos del juego son propios (#dlg): nada de
   confirm/prompt nativos, el artifact los bloquea.
4. Commit en **español**, descriptivo, y push a la rama de trabajo.
5. Reconstruir y republicar el artifact si el juego cambió.
6. Anotar decisiones nuevas en `docs/GAME-DESIGN.md` §7 con fecha.

## 4. Estado al traspasar (2026-07-07)

- 230 tests en verde, golden al día, artifact publicado.
- Sistemas vivos: batalla CT con objetivos (eliminar/asesinar/proteger/
  llegar/aguantar), reacciones + vigilancia XCOM, retirada/eyección,
  refuerzos por oleadas, jefes 2×2, terreno destructible; expediciones
  con atlas (3 regiones, ferry/lanzadera), clima regional con peso,
  encrucijadas, reputación de facciones, ciudades-lugar, destacamentos,
  taller/garaje; pilotos con árbol (básica + principal/secundaria),
  manías, estrés, terapia, heridas; compañera con marcas; hoja de
  servicio del chasis con cicatrices; 3 vistas de batalla (plana, mesa,
  diorama giratorio con clima dibujado); 12 arquetipos de silueta.
- **Pendiente del DIRECTOR**: conseguir arte (empezar por el felino en
  3 estilos; ver flujo de compra en ENCARGO-ARTE.md). Cuando llegue,
  integrarlo: bestias → sprites/diorama; láminas técnicas → lector de
  casco con zonas separables.
- Backlog anotado (no pedido aún): suministros por cabeza, encargos de
  destacamento por facción, quinto piloto de taberna, 4ª región
  (Cinturón de Ceniza), interiores ilustrados, coste por cambiar de
  escuela del piloto.

## 5. Cómo trabaja el director

Mensajes cortos en español, a veces en mayúsculas, con varias ideas a
la vez. «Aplícalo» = hazlo entero con el ritual completo, sin preguntar
por cada detalle; las decisiones de diseño ambiguas se le consultan con
opciones concretas y una recomendación. Resúmenes finales en español,
liderando con lo que ya puede tocar en el juego.
