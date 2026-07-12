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
2. Código + **tests vitest** (370 en verde tras la fusión de ramas y el taller:
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
7. **Consola de estado** (el artefacto que el director consulta): su fuente
   vive versionada en `docs/consola-estado.html`. Para actualizarla, edita ese
   archivo y republícalo con la herramienta Artifact **a la MISMA URL**
   (`url: https://claude.ai/code/artifact/43841a36-a375-47fd-b6c3-35af5035cf4a`,
   favicon 📟) para no acuñar una nueva. Mantenla al día cuando cambie el estado.

## 4. Estado al traspasar (2026-07-09)

- 338 tests en verde (`npx vitest run`), golden al día, tsc limpio, el
  cliente arranca sin errores. Herramientas de balance: `npm run
  balance:hangar` (300 duelos 4v4 IA-vs-IA, marca outliers ≥58%/≤42%) y
  `npx tsx scripts/campaign-sim.ts 100 [campaign|meta|frozen]` (valida el
  ARCO de 100 contratos — realista / techo / suelo).
- Base heredada (2026-07-07): batalla CT con objetivos, reacciones +
  vigilancia, retirada/eyección, oleadas, jefes 2×2, terreno
  destructible; expediciones con atlas (3 regiones), clima, encrucijadas,
  reputación, ciudades, destacamentos, taller/garaje; pilotos con árbol,
  manías, estrés, terapia, heridas; compañera; hoja de servicio del
  chasis; 3 vistas de batalla; siluetas.
- **Añadido esta tanda (manifiesto Flow + profundidad + curva)** — todo
  fechado en `docs/GAME-DESIGN.md` §7:
  · CALOR / REACTOR como encrucijada: solo 2 chasis con reactor
    (liger-zero-cas, geno-saurer-cp) llevan energía + calor; sobrecarga,
    atasco de armas, apagado; SÍNTOMAS legibles en ficha/registro. Armas
    TÉRMICAS (calientan) e INCENDIARIAS (prenden casillas → control de
    campo: quien cierra turno sobre fuego se quema y se calienta).
  · SUPRESIÓN: primera sinergia de escuadra (fijas al enemigo: sin
    contra ni vigilancia).
  · CT COMO TEMPO + SOBREMARCHA (regeneró golden): el turno cuesta base +
    recargo de lo cometido; sobremarcha ×1.5 cediendo el turno siguiente;
    las armas pesadas declaran `ctCost`.
  · CONTINUIDAD expedición↔combate: sales de una batalla como entras a la
    siguiente (calor/energía/munición residual); una jornada de descanso
    hace refit (evita la espiral de la muerte).
  · INERCIA (propuesta 11): APLAZADA — complejidad por complejidad; el
    propio director avisó del "síndrome del simulador".
  · IA MÁS PROFUNDA: fuego concentrado (foco de escuadra EMERGENTE, sin
    memoria compartida) + emboscada (estrena la vigilancia en la IA).
    Determinista, regeneró golden.
  · LA FACCIÓN TE FICHA: dosier determinista de tu estilo
    (melee/ranged/reactor) → escuadras que te contrarrestan por CHASIS y
    por ARMA (lanzallamas contra reactores), también en la taberna.
  · CURVA DE DIFICULTAD AMPLIA: la maestría de la IA es el TECHO del arco,
    no el suelo. Tres ejes por progreso — `campaignAiSkill`
    (contratos/25 + desfase por dificultad; escalona foco≥0.35,
    emboscada≥0.65, contra-chasis≥0.45, contra-arma≥0.7), `campaignStrength`
    (glide 0.55→1.6; el presupuesto enemigo se GASTA en élites vía
    `fillSquad`) y `wear` (desgaste por dificultad). Validada a 100
    contratos: banda 45-65% si mantienes el paso; el techo baja a ~48% al
    final y el suelo (nunca mejoras) se desmorona a 12-17%.
- **DAÑO LOCALIZADO — mitad hecho (2026-07-09).** Antes solo 2 chasis
  tenían `frame`; ahora **9** (los 2 de núcleo desnudo + 7 a medida:
  liger-zero, command-wolf, gun-sniper, gojulas, iron-kong, pteras,
  geno-saurer). Convención nueva para los 7: stats base COMPLETAS + módulo
  CARCASA (`struct` en data/modules.ts, contributions [], armor 0); la
  identidad la dan reparto de HP + tags + hitWeight + secuela (onDestroyed).
  En batalla ya SE VE (el lector de casco pinta las piezas). Regeneró el
  golden. **Queda el otro frente del hueco:** la IA sigue CIEGA al arco —no
  flanquea, no protege su espalda (nunca pasa `facing` en executeWait), no
  elige arma por penetración—; enseñarle a jugar el arco (gateado por la
  curva de destreza) es el siguiente salto de mayor palanca. Y se pueden
  dar frames a más chasis con el mismo patrón `struct`.
- **Pendiente del DIRECTOR**: conseguir arte (empezar por el felino en
  3 estilos; ENCARGO-ARTE.md). Cuando llegue: bestias → sprites/diorama;
  láminas técnicas → lector de casco con zonas separables.
- Backlog anotado (no pedido aún): memoria de dosier POR FACCIÓN (exige
  contratos etiquetados por facción); suministros por cabeza, encargos de
  destacamento por facción, quinto piloto de taberna, 4ª región (Cinturón
  de Ceniza), interiores ilustrados, coste por cambiar de escuela.

## 5. Cómo trabaja el director

Mensajes cortos en español, a veces en mayúsculas, con varias ideas a
la vez. «Aplícalo» = hazlo entero con el ritual completo, sin preguntar
por cada detalle; las decisiones de diseño ambiguas se le consultan con
opciones concretas y una recomendación. Resúmenes finales en español,
liderando con lo que ya puede tocar en el juego.
