# Diseño del juego (primer título sobre el motor Gea)

> Este documento es la fuente de verdad del **diseño del juego**: visión,
> filosofía, restricciones y decisiones tomadas. Su hermano
> [DESIGN.md](DESIGN.md) es la fuente de verdad de la **arquitectura del
> motor**. Las conclusiones de sesiones de exploración (con quien sea:
> ChatGPT, notas propias, playtests) se consolidan aquí; lo que no está
> aquí no está decidido.

## 1. Visión (redefinida 2026-07-05 — "diseño de afuera hacia adentro")

**La fantasía central**: ser el piloto de una bestia mecánica única,
recorrer un mundo enorme, y sentir que esa máquina es tu compañera, tu
vehículo y tu arma. **El viaje importa tanto como el combate.** No se
diseñan listas de mecánicas: se diseñan experiencias, y las mecánicas
nacen de ellas (el guion de "la primera expedición" en §1.2 es la
plantilla del método).

La base táctica sigue siendo FFT (CT, casillas, posicionamiento) con
profundidad de máquina (Armored Core / BattleTech); la inspiración Zoids
se conserva como andamio de identidad y más adelante se sustituirá por
IP original. La estrella polar no cambia: **cada expedición debe
producir recuerdos** que surgen del sistema, no de cinemáticas.

### 1.1 Los seis pilares

1. **Vínculo con la máquina** — emerge de tres condiciones diseñables:
   singularidad (mi máquina no es como la tuya), persistencia (lo que le
   pasa, le queda) y vulnerabilidad (solo te vinculas con lo que puedes
   perder). Herramienta clave: el diario automático — la biografía de la
   máquina escrita desde el log determinista de eventos.
2. **La máquina funciona como máquina** — sistemas que interactúan, con
   la regla de oro: cada sistema debe tener un SÍNTOMA legible (la
   transmisión rota cojea; los sensores rotos hacen que la UI mienta) y
   un MOMENTO de decisión. Presupuesto de atención: máximo 5 sistemas
   pidiendo decisiones a la vez (energía, calor, peso, integridad,
   munición); el resto son síntomas o piezas, no diales.
3. **Cada expedición es una aventura** — EL pilar. Preparar importa, el
   camino importa, volver se siente como sobrevivir. El mecanismo es la
   curva de presión: sales al 100%, todo te gasta, y la pregunta central
   del juego es "¿un tramo más, o volvemos?". Presión mixta: la CARGA
   (bodega limitada, volver lleno es volver rico) como zanahoria, el
   DAÑO acumulado como látigo.
4. **Las decisiones tienen consecuencias** — cadenas de compromiso
   (reactor→calor→peso), con disciplina: toda decisión de taller muestra
   sus dos caras en la misma pantalla; cadenas de 2-3 eslabones
   visibles, el resto emergencia.
5. **El mundo cuenta historias sin el jugador como protagonista** —
   degradado deliberadamente de "mundo vivo" a TEATRO al servicio del
   pilar 3: caravanas, patrullas y fauna aparecen en tu ruta con
   contexto; no se simulan cuando no las ves. Dos órdenes de magnitud
   más barato y el jugador no nota la diferencia.
6. **El piloto** — la ley vigente: solo el piloto gana XP (por pistas);
   la máquina se especializa por lo material; la sinergia entre ambos es
   la recompensa. El vínculo es entre dos que crecen juntos.

### 1.2 La compañera: maduración con techo (decisión 2026-07-05)

Hay UNA máquina que es tuya — la compañera — y máquinas de apoyo que
son ganado del modo mercenario (se compran, se venden, se lloran poco).
La compañera NO se vende en menús y NO gana experiencia: **acumula
historia**, con techo:

- **Marcas** (≈6 espacios de núcleo): rasgos permanentes grabados por
  eventos vividos — no elegidos de menú, no farmeables. Positivos,
  mixtos o cicatrices ("Forjada en el desierto": disipa mejor en clima
  árido; "La pata que nunca sanó": −1 movimiento, blindaje reforzado).
  Núcleo lleno = la máquina ya es quien es. Cada partida produce una
  compañera distinta.
- **Compenetración** (techo en ~10-12 expediciones juntos): bonos
  pequeños de manejo por conocerse. Se pierde al cambiar de máquina.
- **Cambiar de compañera**: posible y carísimo, pero el dinero es el
  menor de los costos — la nueva llega verde (sin marcas, sin
  compenetración). Como el crecimiento tiene techo, cambiar es doloroso
  pero no suicida: lo que no se puede comprar es la biografía.

### 1.3 La primera expedición (guion canónico, resumen)

Taller (montar según pronóstico, cargar bodega finita, pagar o no la
reparación de la escolta) → partida (elegir ruta en el mapa de nodos:
corta con tormenta vs. larga con ruinas) → tramo tranquilo que muestra
el mundo (pilar 5) → crisis en tormenta (posturas de energía, avería
con síntoma, gastar o guardar repuestos) → EL combate significativo
(uno inevitable por expedición; los demás evitables/emergentes), al que
se llega con las cartas ya jugadas por el viaje → decisión de presión
(botín vs. bodega vs. estado: "¿un tramo más?") → regreso alterado por
el daño → taller: diario actualizado, reparación con elección
(perfecta y cara, o barata y con marca), consecuencia narrativa nueva
en el tablón.

**Sistemas que este guion exige (y ninguno más)**: capa estratégica de
viaje (nodos/jornadas/eventos), suministros y bodega, posturas de
energía (Cazador/Galope/Tortuga — presets con nombre, no sliders),
averías con síntoma persistentes en viaje, marcas+compenetración, y
diario automático. Todo lo demás ya existe.

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

**Endurecimiento (2026-07-05, contra el "síndrome del simulador")**:

- **Prueba de la historia**: si no se puede escribir la anécdota de
  taberna que el sistema produce ("...y entonces el reactor..."), no
  entra.
- **Presupuesto de atención**: máximo 5 sistemas pidiendo decisiones a
  la vez. Un sistema visible nuevo = uno existente pasa a ser síntoma.
- La pregunta es siempre "¿qué experiencia genera?", nunca "¿qué tan
  realista es?".

## 6. Backlog de diseño (ideas aceptadas a exploración, sin comprometer)

Pendientes de pasar el filtro del §5 con una propuesta concreta:

| Idea | Origen | Estado |
|---|---|---|
| Controles de teclado (WASD + confirmación) y flujo de UI estilo XCOM: seleccionar → previsualizar → confirmar | feedback del primer playtest | explorando |
| Bonus defensivo/sensorial por tipo de terreno ocupado (bosque, agua somera) en lugar de cobertura direccional XCOM | feedback del primer playtest | encaja con fase 3 del motor (terreno rico); pendiente de números |
| Ensamblaje de Zoids ("garaje"): intercambiar módulos y armas por unidad entre batallas | visión original | ✅ motor (UnitSpawn.loadout) y ✅ UI web: pantalla de garaje con selección de chasis (todo el hangar), hasta 3 armas del catálogo mezclado, recambios aftermarket por slot y vista previa de stats en vivo (deltas vs fábrica), persistida en localStorage. Pendiente: reglas de peso/energía |
| Progresión piloto ↔ Zoid separadas; árbol de habilidades con especializaciones | visión original | ✅ motor (core/progression.ts) y ✅ web: pilotos persistentes en localStorage, XP repartida al terminar cada batalla (resumen en el overlay con avisos de nivel), pistas visibles en el garaje y sinergia señalada en la vista previa. Pendiente: árbol visual, respec (los buffs a aliados ya puntúan como soporte desde el ciclo mercenario) |
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
- **2026-07-05** — MODO MERCENARIO (rebanada de campaña): contratos →
  batalla → créditos → tienda/reparaciones, con daño persistente entre
  batallas. Arquitectura: nueva capa `src/game/` (lógica pura de campaña,
  ni motor ni cliente) + `src/data/economy.ts` (precios derivados del
  ciclo de balance) + pantalla de cuartel en la web. Reglas de la
  rebanada: 3 ofertas deterministas por ciclo (escolta/asalto/caza, con
  escuadras enemigas muestreadas por presupuesto), recompensa solo al
  ganar + chatarra por baja enemiga, reparar cuesta 2⌾/HP, un Zoid
  destruido no se despliega hasta reconstruirlo (60% del precio), las
  armas son propiedad (comprar/vender/montar con validación de arsenal)
  y cambiar de chasis incluye retoma del actual según su estado. El
  motor solo aportó `UnitSpawn.hp`. Pendiente: daño de módulos
  persistente, precios de módulos, misiones con objetivos distintos.
- **2026-07-05** — REDEFINICIÓN DE LA VISIÓN (dirección del usuario,
  "diseño de afuera hacia adentro"): la fantasía central es el viaje
  con una bestia mecánica compañera, no solo el combate. Seis pilares
  (§1.1), filtro endurecido contra el síndrome del simulador (§5),
  guion canónico de la primera expedición (§1.3) como método: las
  mecánicas nacen de experiencias escritas, no al revés. Decisiones:
  compañera única con maduración con techo (marcas + compenetración,
  §1.2) frente a flota de apoyo desechable; cambiar de compañera es
  carísimo y la nueva llega sin biografía; UN combate inevitable por
  expedición; presión de retorno mixta carga/daño; estructura de
  exploración = capa estratégica de nodos y rutas sobre la capa
  táctica existente (descartados mundo abierto y regiones artesanales
  gigantes por costo indie). El modo mercenario actual se reorienta:
  los contratos pasan de "menú de batallas" a "motivos para salir de
  expedición"; comprar/vender solo aplica a las máquinas de apoyo.
- **2026-07-05** — Matices del usuario tras aceptar la redefinición:
  (a) las MARCAS también pueden nacer de momentos excepcionales DEL
  COMBATE (sobrevivir a un apagado rodeada, matar al comandante con el
  último disparo del cargador) — el log determinista permite detectarlos;
  referencia de tono: Darkest Dungeon, pero la hazaña marca a la máquina;
  (b) el viaje es A→B con eventos y rodeos forzados (el puente roto), y
  al completar la misión se ofrece la opción de seguir explorando... o
  no (la curva de presión decide); (c) HERRAMIENTA COMPROMETIDA: editor
  de mapas — primero el de mapas de combate (✅ hecho: pinta el formato
  ASCII del motor, spawns, guardado local, selector en cabecera usado
  por escaramuzas y contratos), después el del mapa de mundo cuando
  exista la capa de viaje.
