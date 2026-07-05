# Diseño del juego (primer título sobre el motor Gea)

> Este documento es la fuente de verdad del **diseño del juego**: visión,
> filosofía, restricciones y decisiones tomadas. Su hermano
> [DESIGN.md](DESIGN.md) es la fuente de verdad de la **arquitectura del
> motor**. Las conclusiones de sesiones de exploración (con quien sea:
> ChatGPT, notas propias, playtests) se consolidan aquí; lo que no está
> aquí no está decidido.

## 1. Visión

Un RPG táctico por turnos que tome el flujo de **Final Fantasy Tactics**
(CT, casillas, posicionamiento, orientación) y la profundidad de
**Armored Core / BattleTech** (máquinas por piezas, recursos, ensamblaje),
ambientado en **Zoids**. No es un clon de FFT: es una evolución moderna
del género.

**La estrella polar: cada batalla debe producir recuerdos.** Historias que
surgen del sistema, no de cinemáticas:

- una unidad perdió una pierna y aun así logró escapar
- un disparo destruyó los sensores enemigos y sus tiros dejaron de entrar
- un piloto se quedó sin energía en el peor momento
- una decisión de posicionamiento cambió el combate entero

*(Varias de estas ya ocurren en el prototipo actual — el listón es que
ocurran cada partida y que el jugador se dé cuenta de que ocurrieron.)*

## 2. Relación motor ↔ juego

El motor se mantiene genérico — nada del universo Zoids en `src/core/`, y
hay verificación de ello — pero **las prioridades las dicta este juego**.
Solo se generaliza una mecánica cuando el juego la necesita y ha
demostrado funcionar. El motor es una consecuencia de hacer un gran
juego, no un objetivo en sí mismo: los buenos motores se *extraen* de
juegos terminados, no se diseñan en abstracto.

## 3. Restricciones de producción

Toda propuesta de diseño se evalúa dentro de estas restricciones:

- **Equipo**: una persona (dirección de diseño) + IA (desarrollo).
- **Presupuesto**: ~0. Nada que dependa de comprar assets, outsourcing o
  licencias.
- **Plataforma primera**: navegador. Escritorio después, si acaso.
- **Techo gráfico**: estilizado (low-poly 3D o 2.5D isométrico). Nunca
  realismo AAA. El *game feel* (impacto, ritmo, sonido, legibilidad) va
  antes que los polígonos.
- **Rebanadas mínimas**: toda mecánica nueva debe tener una versión
  mínima jugable/testeable en aproximadamente una semana de trabajo. Si
  no la tiene, se parte en fases o se descarta.
- **Pocas mecánicas profundas** bien balanceadas antes que muchas
  superficiales.

## 4. Filosofía de diseño

- Profundo pero comprensible: la complejidad vive en las interacciones
  entre sistemas simples, no en reglas enrevesadas.
- Las decisiones tácticas importan más que los números.
- El posicionamiento importa más que el nivel.
- La preparación (ensamblaje, composición del equipo) importa más que el
  farmeo.
- La gestión de recursos genera decisiones interesantes, no burocracia.
- El determinismo es también una mecánica: repeticiones compartibles,
  desafíos con semilla común, batallas reproducibles para aprender.

### Lo que NO queremos

- números inflados ni progresiones infinitas
- grindeo obligatorio
- RNG excesivo (el azar sazona, no decide)
- builds únicas dominantes / meta resuelta
- habilidades que rompan el equilibrio
- complejidad que no añada decisiones

## 5. Criterio de evaluación de mecánicas (filtro oficial)

Toda mecánica propuesta — venga de donde venga — debe responder:

1. **¿Qué decisión nueva genera** en el jugador?
2. **¿Qué problema resuelve** del juego actual?
3. **¿Qué historias emergentes produce?**
4. **¿Hace el juego más profundo o solo más complejo?**
5. **¿Cuál es su rebanada mínima demostrable?** (≈1 semana)
6. **¿Qué arrastra?** — clasificar como pequeña / mediana / grande según
   el contenido, balance y UI que exige, no solo el código.
7. ¿Encaja con la filosofía de simulación? ¿Es generalizable al motor
   sin contaminarlo de universo?

Si solo añade complejidad sin añadir decisiones, no entra.

## 6. Backlog de diseño (ideas aceptadas a exploración, sin comprometer)

Pendientes de pasar el filtro del §5 con una propuesta concreta:

| Idea | Origen | Estado |
|---|---|---|
| Controles de teclado (WASD + confirmación) y flujo de UI estilo XCOM: seleccionar → previsualizar → confirmar | feedback del primer playtest | explorando |
| Bonus defensivo/sensorial por tipo de terreno ocupado (bosque, agua somera) en lugar de cobertura direccional XCOM | feedback del primer playtest | encaja con fase 3 del motor (terreno rico); pendiente de números |
| Ensamblaje de Zoids ("garaje"): intercambiar módulos y armas por unidad entre batallas | visión original | ✅ motor (UnitSpawn.loadout) y ✅ UI web: pantalla de garaje con selección de chasis (todo el hangar), hasta 3 armas del catálogo mezclado, recambios aftermarket por slot y vista previa de stats en vivo (deltas vs fábrica), persistida en localStorage. Pendiente: reglas de peso/energía |
| Progresión piloto ↔ Zoid separadas; árbol de habilidades con especializaciones | visión original | ✅ motor (core/progression.ts) y ✅ web: pilotos persistentes en localStorage, XP repartida al terminar cada batalla (resumen en el overlay con avisos de nivel), pistas visibles en el garaje y sinergia señalada en la vista previa. Pendiente: buffs como XP de soporte, árbol visual, respec |
| Generador de mapas/escenarios (aleatorio y dirigido) | feedback | aplazado explícitamente ("ahora no") |
| Gráficos: investigar punto dulce estilizado + game feel satisfactorio | feedback | investigación pendiente |

## 7. Decisiones tomadas

*(Se anotan aquí con fecha y motivo cuando se toman. Las decisiones de
arquitectura del motor van en DESIGN.md.)*

- **2026-07-05** — Separación formal de documentos: GAME-DESIGN.md (juego)
  y DESIGN.md (motor), espejo de la separación técnica core/contenido que
  existe desde la fase 0.
- **2026-07-05** — Adoptado el criterio de evaluación del §5 como filtro
  obligatorio para aceptar mecánicas, tanto aquí como en el motor.
- **2026-07-05** — Tras probar la línea de visión y la cobertura: el
  combate "se siente bien" sin niebla de guerra. Sensores/niebla quedan
  APLAZADOS hasta nueva orden; el clima entra ya (lluvia refrigera,
  tormenta de arena degrada la puntería a distancia).
- **2026-07-05** — Progresión (ley del usuario): el Zoid NO gana XP, solo
  el piloto; el piloto se especializa por pistas y el Zoid "se especializa
  hacia el mismo lado" mediante piezas/mods etiquetados — la sinergia
  piloto↔máquina es la recompensa (tope 2 piezas para evitar builds
  degeneradas). Números modestos: el posicionamiento sigue mandando.
- **2026-07-05** — Primer ciclo de balance con datos (npm run balance):
  cañón de partículas 60→36 de potencia y alcance mínimo 2; el escenario
  del valle pasa de 81.5% enemigo a 55/45 jugador. Detectados los
  siguientes objetivos: rifle del francotirador sobre-rendido y Geno
  demasiado frágil una vez nerfeado su cañón.
- **2026-07-05** — Ciclo de balance del HANGAR COMPLETO (nueva herramienta
  `npm run balance:hangar`: 4v4 aleatorios deterministas, 1500 batallas,
  ±2pp de error). Lecciones y cambios:
  - Con 300 batallas (±10pp) se persigue ruido; las decisiones se toman
    solo con la muestra grande.
  - El rifle innato gratuito del Gun Sniper stock era la unidad más
    fuerte del juego (69.6%): pasó a arma montada con munición, como
    su variante custom. El golden master se regeneró declarándolo.
  - La IA aprendió a usar SOPORTE (curas y buffs a aliados bajo amenaza,
    con utilidad menor que un buen disparo): el arquetipo de apoyo por
    fin pulsa sus botones y se vuelve balanceable.
  - Ajustados: König Wolf (5 nerfs; su patrón de fuego a distancia 6 se
    asienta en ~59.6% — VIGILAR: es un límite de la IA greedy, que no
    sabe castigar el standoff, tanto como un problema de números),
    aguja térmica (cargador 4→3, proc de calor 45%→30%), Zaber Fang,
    Dibison, y buffs a Storm Sworder, Guysak, Gordos, Gojulas, Brachios.
  - Aceptados como débiles POR DISEÑO: Molga (carne de cañón) y Gustav
    (transporte). Anotado: las variantes framed pagan ~7pp de "impuesto
    de módulos" frente a sus gemelas monocasco.
  - Banda final: 21 de 23 chasis en 42–58% de victoria; el valle queda
    en 55.5% jugador (el soporte nuevo favorece a su composición).
