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
| Progresión piloto ↔ Zoid separadas; árbol de habilidades con especializaciones | visión original | ✅ motor (core/progression.ts) y ✅ web: pilotos persistentes en localStorage, XP repartida al terminar cada batalla (resumen en el overlay con avisos de nivel), pistas visibles en el garaje y sinergia señalada en la vista previa. ✅ árbol visual (pantalla 🧠 Pilotos: 4 pistas × 5 perks nombrados, desbloqueo por XP) y ✅ MANÍAS estilo Darkest Dungeon: la memoria del piloto cuenta lo vivido (batallas, bajas, castigo, apagados, esquivas, reparaciones, roces con ≤20% HP) y al cruzar umbrales se graban rasgos permanentes — bendiciones, cicatrices o mixtos (Curtido, Miedo al calor, Gatillo fácil, Paranoia...), tope 4, números modestos: son personalidad, no poder. Pendiente: respec |
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
- **2026-07-05** — CAPA DE VIAJE (rebanada del pilar 3, ✅ jugable):
  región del Paso de Sal dibujada a mano (7 lugares, 9 tramos), y los
  contratos ya no despliegan batallas: asignan un LUGAR objetivo según
  la dificultad (escolta cerca, caza en lo profundo) y hay que viajar
  nodo a nodo. Cada tramo consume suministros (se compran en la
  intendencia del cuartel) y trae eventos deterministas: el puente roto
  que corta el tramo y obliga a rodear, hallazgos para la bodega (tope
  4, se venden al volver al taller) y tormentas que fuerzan el clima de
  la siguiente batalla. Sin suministros: marcha forzada (8% maxHp por
  jornada, nunca mata). EL combate ocurre al llegar; la victoria
  devuelve al mapa (seguir o volver — la decisión de presión); la
  derrota es retirada y cierra la expedición. Un mapa del editor cuyo
  nombre coincida con el del lugar se convierte en su campo de batalla.
  Pendiente: marcas/compenetración, eventos de combate opcionales en
  ruta, editor del mapa de mundo, más regiones.
- **2026-07-05** — SISTEMA DE GUARDADO con mentalidad de juego de PC:
  la partida completa (pilotos con manías, campaña, expedición, garaje,
  mapas del editor) es UN documento versionado (src/game/save.ts, puro
  y con migraciones previstas). Tres ranuras en el navegador con
  metadatos (nombre, fecha, créditos, contratos, día de expedición,
  niveles de pilotos) + EXPORTAR a archivo .json e IMPORTAR desde
  archivo — la partida sobrevive a limpiezas del navegador y viaja
  entre máquinas; será el formato nativo cuando haya build de
  escritorio. Cargar aplica el documento y rearranca por el camino
  normal de inicio (un solo código de carga).
- **2026-07-05** — ESTRÉS DE PILOTOS, CIUDADES Y RUINAS (dirección del
  usuario):
  - Estrés (0-100, temporal — las manías son lo permanente): sube con
    el castigo encajado, los apagados, ver caer aliados, perder la
    máquina y las marchas forzadas; la victoria alivia un poco. Tramos
    con síntoma (solo aplica el más alto): Tenso 50+ (−2 PUNT), Al
    límite 75+ (−4 PUNT −3 EVA), Quebrado 95+ (−6/−5/−1 MOV). Se
    descansa en las ciudades.
  - Ciudades con NIVELES (1 aldea → 3 capital): menos nivel = barato
    pero peor (el taller de aldea solo repara al 70%, el catre alivia
    poco, la bodega se malvende al 80%); más nivel = eficaz y caro.
    Especializaciones: FÁBRICAS de armas (catálogo especializado con
    descuento) y de piezas (venden PLANOS de módulos aftermarket — se
    compran una vez y desbloquean el montaje en campaña; ya no son
    gratis). Tres ciudades en el Paso de Sal: Villa Brasa (aldea),
    Puesto Cardo (aldea + fábrica de piezas), Porto Azul (ciudad +
    fábrica de armas).
  - Ruinas EXPLORABLES: un día por exploración, determinista por
    contrato/lugar, una vez por expedición: hallazgo valioso (45%),
    polvo (25%) o susto (+12 estrés a todos, a veces con botín).
  Pendiente: capital nivel 3 en la próxima región, manías ligadas al
  estrés (quebrarse debería dejar cicatriz), descanso en el taller
  propio.
- **2026-07-05** — MARCAS Y COMPENETRACIÓN DE LA COMPAÑERA (cierre del
  corazón del Pilar 1, tal como se decidió en §1.2): el hueco 1 del
  roster ES la compañera. Motor: UnitSpawn.modifiers (genérico —
  modificadores adjuntos al desplegar). Juego: núcleo con 6 espacios de
  marcas grabadas por lo vivido — Forjada en el desierto (2 batallas en
  tormenta), Corazón de hierro (2 apagados), Cazadora de reyes (2
  comandantes derribados por ella), La que vuelve (3 roces), Cicatriz
  del taller (reconstrucción: +DEF −VEL, mixta), Diente mellado, Vieja
  guardia — y compenetración (expediciones cumplidas, techo 12) con
  tramos: Se entienden → Una sola pieza → Leyenda del taller. Cambiar
  el chasis de la compañera pide confirmación y BORRA la biografía (la
  nueva llega verde). El parte de batalla anuncia cada marca grabada;
  la biografía se ve en el hangar (núcleo, huecos libres, tramo).
- **2026-07-05** — DESAHOGOS Y PSICOLOGÍA (dirección del usuario). Los
  tipos de descanso en ciudad, cada uno con carácter: Vela junto al
  núcleo (gratis, −8, y es un momento con la compañera), Pensión (por
  nivel de ciudad), Cantina — alcohol y parranda (−25 por ⌾60, pero la
  ronda a veces se alarga +50% y CUENTA PARRANDAS: 4 → manía Juerguista,
  mixta) y Casa Farol Rojo (nivel 2+, −40 por ⌾180, discreta). Y el
  CONSULTORIO (nivel 2+): terapia que trata el trauma con una regla de
  diseño deliberada — **la terapia no borra la manía: la REENCUADRA en
  su versión aprendida** (Paranoia→Vigilancia, Miedo al calor→Templanza,
  Gatillo fácil→Fuego disciplinado, Juerguista→Alma de la compañía),
  cuesta ⌾350 y 2 días, y funciona SIEMPRE: con la salud mental no se
  juega a los dados — el coste en tiempo y dinero es el balance. Las
  manías reencuadradas solo se alcanzan por terapia (umbral infinito).
  Pendiente: desahogos con preferencias por piloto (a quien no le gusta
  la cantina), terapia de grupo, y el consultorio del taller propio.
- **2026-07-05** — LA CIUDAD ES UNA PANTALLA PROPIA + HAMBRE DE
  SUMINISTROS (dirección del usuario):
  - Sin suministros, la tripulación SOLO acepta rutas que acerquen a la
    civilización (ciudad o taller más cercano, por Dijkstra); las demás
    se bloquean con candado. La marcha forzada sigue castigando. Válvula
    anti-quiebra: el jornal del muelle (+⌾40 por día) garantiza que
    siempre se puede remontar.
  - Entrar a una ciudad abre SU PANTALLA, agrupada por establecimientos:
    ⚒ Taller (arreglos básicos SIEMPRE, eligiendo cuánto gastar: 25/50/
    100% de lo reparable hasta el tope del nivel; la munición se repone
    al desplegar), 🏪 Mercader (suministros, bodega, armas de segunda
    mano, jornal), 🏭 Fábrica (armas o planos, según especialidad),
    🏗 Fabricación de Zoids (encargo con retoma, nivel 2+), 🔧
    Modificación/tunear (armas del arsenal y módulos con plano), 😴
    Descansos y consultorio (pensión, vela, cantina, Farol Rojo,
    terapia), y 🍻 Taberna y gremio.
  - TABERNA: encargos NO oficiales — un combate local (3 enemigos,
    determinista por ciudad y ciclo) que paga menos que el gremio, no
    toca la misión oficial ni el ciclo de contratos, se hace una vez por
    ciudad por expedición, y perderlo no cancela la expedición. Los
    contratos oficiales siguen firmándose en el cuartel.
- **2026-07-05** — SEPARACIÓN JUEGO / SANDBOX (dirección del usuario):
  el JUEGO arranca SIEMPRE en ciudad — el cuartel, o el lugar de la
  expedición en curso (con su pantalla urbana si es ciudad) — y el
  tablero de batalla solo se alcanza JUGANDO: llegar al objetivo de un
  contrato, un trabajo de taberna, o exploración. Esc en las pantallas
  raíz abre el menú principal, nunca revela un tablero suelto. Todo el
  sandbox de batallas (semilla, mapa, clima, garaje libre, editor,
  "Nueva batalla") vive en su propio modo ⚔ ESCARAMUZA, accesible solo
  desde el menú de inicio o el enlace del cuartel; en modo campaña esos
  controles desaparecen de la interfaz. No se guarda en medio de una
  batalla: cargar siempre aterriza en ciudad/mundo.
- **2026-07-05** — ASISTENTE DE FUNDACIÓN DE COMPAÑÍA (dirección del
  usuario: "agrega la configuración necesaria para iniciar un juego
  nuevo desde cero"). "Juego nuevo" ya no crea la partida al instante:
  abre un asistente donde el jugador funda su compañía. Se elige:
  (1) nombre de la compañía — aparece en el cuartel y como nombre por
  defecto al guardar la ranura; (2) dificultad — Cadete ⌾3400/12
  suministros, Mercenario ⌾2500/8, Leyenda ⌾1600/5 (solo cambia el
  punto de partida económico, nunca las reglas de combate: el
  determinismo es ley); (3) compañera inicial — 4 chasis curados
  (Liger Zero, Shield Liger, Zaber Fang, Rev Raptor) con sus stats de
  fábrica a la vista, ocupa el slot 0 del roster; (4) nombres de los
  4 pilotos. El resto del roster inicial es fijo (Command Wolf, Gun
  Sniper, Gustav) para que la elección de compañera sea identidad, no
  ventaja. Fundar borra las claves vivas y aterriza directo en el
  cuartel sin pasar por el menú. Motor y capa de juego intactos:
  `newCampaign` solo ganó un parámetro opcional de overrides
  (créditos/suministros/roster), el contenido vive en `src/data`.
- **2026-07-05** — EXPLORACIÓN LIBRE (bug de diseño detectado por el
  usuario al estrenar el asistente: "¿por qué no puedo salir de
  expedición al iniciar partida?"). La ley decía "explorar libremente
  O tomar un contrato", pero la única salida del cuartel era el
  contrato: el botón quedaba apagado hasta elegir uno, sin explicación.
  Arreglo en dos partes: (1) el botón de contrato ahora se llama
  "⚑ Partir al contrato" y cuando está apagado dice "(elige uno)";
  (2) nuevo botón "🧭 Explorar libremente" — sale de expedición SIN
  contrato ni objetivo: mismo mapa, mismos suministros, mismos
  eventos de ruta, ruinas, ciudades y trabajos de taberna, y volver
  al taller cierra el viaje sin contar como abandono (missionDone
  nace en true). La clave de la expedición libre siembra los eventos
  y queda grabada en el estado: determinismo intacto a partir de ahí.
- **2026-07-05** — EFECTOS DE COMBATE (dirección del usuario: "agrega
  efectos en disparos golpes desplazamientos"). Capa #fx sobre el
  tablero, SOLO presentación (el estado ya está resuelto cuando el
  efecto nace): trazadoras que siguen el evento projectile-fired del
  motor (energía = haz cian instantáneo, balística = trazo cálido con
  tiempo de vuelo), fogonazo en la boca del arma, impactos con anillo
  expansivo y chispas, tajo blanco en cuerpo a cuerpo (ataque sin
  proyectil), polvo por casilla recorrida al moverse, explosión con
  metralla y humo al caer una unidad o un muro, y sacudida del tablero
  en golpes serios. prefers-reduced-motion lo apaga todo.
- **2026-07-05** — GENERADOR PROCEDURAL DE CAMPOS DE BATALLA (el
  usuario levanta el aplazamiento: "crea el tema para que sea
  procedural", refinado vendrá después). src/game/mapgen.ts, capa de
  juego sin motor, determinista por clave (misma clave → mismo campo).
  5 biomas (Vega con río y vado, Dunas, Espesura con lago, Páramo,
  Ruinas) que dictan densidades de bosque/abrupto/lomas/muros — sabor,
  no reglas. Garantías: flancos de despliegue limpios, 4 spawns por
  bando sobre llanura, y conectividad por tierra verificada con BFS
  (pasillo de rescate si el terreno cercó). Cableado: la CAMPAÑA
  genera el campo con contrato|lugar|día — nunca dos batallas sobre el
  mismo terreno, y recargar la partida no lo cambia; en ESCARAMUZA hay
  opción "🎲 Procedural (según semilla)"; el EDITOR gana el botón
  "🎲 Generar" (el generador propone, el jugador retoca). Un mapa del
  editor con el nombre del lugar sigue mandando sobre el generado.
- **2026-07-05** — PUNTERÍA POR CERCANÍA Y TECHO DEL 99% (dirección
  del usuario). proximityBonus: +4% por casilla por debajo de 5, hasta
  +16 a bocajarro — acercarse siempre paga y se suma a la dispersión
  balística por arma (alejarse castiga doble con proyectiles). hitChance
  se acota a [5,99]: LA CERTEZA NO EXISTE, el 99 deja siempre sitio al
  desastre. Golden master actualizado y declarado en el commit.
- **2026-07-05** — DIAGRAMA DE ESTADO DEL ZOID (dirección del usuario:
  "quiero ver un diagrama del estatus con cada parte a la vista"). En
  la lista de unidades, cada Zoid con frame muestra un esquema lateral
  (morro a la derecha): mochila/torso/cabeza/arma/patas como piezas
  coloreadas por HP (verde ≥70, ámbar ≥35, rojo <35, gris ✕ destruido)
  con el número dentro y tooltip. Asignación por patrón de slot: los
  chasis futuros no rompen el diagrama.
- **2026-07-05** — ENCRUCIJADAS (dirección del usuario: "la historia
  es muy bonita pero agrega elección"). La ruta ahora PREGUNTA: banda
  del 12% por tramo con tres clases de encuentro (caravana varada,
  manada salvaje, piloto perdido), cada una con 2-3 opciones cuyas
  consecuencias van ANUNCIADAS en el botón — se decide informado, sin
  letra pequeña ni dados escondidos (resolveEncounter es determinista).
  Las consecuencias usan las monedas ya existentes: jornadas, bodega,
  suministros y estrés. La elección es obligatoria (Escape no escapa,
  teclas 1-9 eligen). Filosofía: elegir entre tiempo, dinero y cabeza
  es el corazón del viaje; nada de "opción correcta".
- **2026-07-05** — REPUTACIÓN POR FACCIONES + ENCUENTROS MORALES
  (dirección del usuario: "que no todo sean 3 opciones, mete opciones
  morales, y crea el sistema de reputación entre facciones y ciudades
  — por lo pronto créalo, ya rellenamos"). El SISTEMA es definitivo,
  el CONTENIDO es relleno provisional:
  · src/game/reputation.ts: facción → −100..+100 en CampaignState
    (migración automática de partidas viejas), tramos de trato
    Odiado/Hostil/Neutral/Apreciado/Aliado, solo cambia por decisiones
    visibles — nunca por dados escondidos.
  · src/data/factions.ts (RELLENO, rebautizar no toca reglas): Gremio
    de Mercenarios, Liga de Colonos, Clanes Chatarreros; PLACE_FACTIONS
    adscribe cada lugar habitado (Base Arcadia → gremio; las tres
    ciudades → colonos). La ciudad muestra a quién responde y el trato.
  · Encuentros con recuento VARIABLE: manada 2, caravana 3, perdido 3,
    peaje 4. Opciones MORALES marcadas ☠ (saquear la caravana, unirse
    al expolio del peaje): pagan mejor que la opción honrada, cuestan
    reputación con testigos y cargan estrés — la tentación es real y
    el precio también. Deltas siempre anunciados en el botón.
  · Cuartel: panel de reputación (tarjeta por facción con tramo y
    barra ±). Efectos mecánicos del trato (precios, contratos, acceso)
    quedan para cuando la dirección cree las facciones definitivas.
- **2026-07-06** — BLOQUE "APLICA TODO" (dirección del usuario tras el
  resumen ejecutivo): seis piezas en seis commits.
  1. REPUTACIÓN CON DIENTES: priceFactor por tramo (Aliado −10% …
     Odiado +30%) sobre taller/mercader/descansos en territorio de la
     facción dueña; la taberna cierra a Odiados y no confía encargos a
     Hostiles; el Gremio pone 3/2/1 contratos según trato (nunca 0).
  2. DIARIO DE LA COMPAÑÍA (pilar 1, la herramienta clave): crónica
     persistente en la campaña alimentada por el diario de a bordo de
     cada expedición (también las retiradas), las marcas de la
     compañera y la fundación. Pantalla 📜 en el cuartel. 400 líneas.
  3. POSTURAS DE ENERGÍA (motor) + SÍNTOMAS: acción libre 'stance' —
     Cazador (punt +10/eva −5), Galope (mov +2/def −10), Tortuga
     (defensas +10/mov −2); persiste, no consume turno. Averías que se
     VEN: insignias 🦵 cojea / 📡 sensores rotos / 🔫 arma inutilizada,
     y con sensores destruidos la consola MIENTE (% con ruido ±20
     determinista, marcado "≈…%?"; el motor usa el real).
  4. HERIDAS DE PILOTO (pilar 6): Zoid a 0 en batalla de campaña →
     piloto herido 3 jornadas + estrés +15, determinista y anunciado.
     Los heridos no despliegan; el tiempo (viaje/descanso) cura.
     Nunca muerte permanente sin aviso.
  5. SONIDO SINTETIZADO: WebAudio al vuelo (disparo, haz, impacto,
     tajo, explosión, pasos, reparación, campanita, click), botón
     🔊/🔇 persistente. Cero archivos: el build sigue autocontenido.
  6. CONTENIDO: capital ESPEJO DEL NORTE (nivel 3, fábrica de armas,
     3 caminos, de los Colonos); BIOMAS de tramo (vega/dunas/sierra)
     que dictan la piscina de encuentros (los peajes viven en la
     sierra, las caravanas en la vega); el tier del contrato escala el
     campo de batalla (escolta 12-13 → caza 14-15 de ancho, más lomas
     y restos en la caza).
- **2026-07-06** — EL ATLAS: CONTINENTES, REGIONES Y TRANSPORTES
  (dirección del usuario: "amplía el mundo por regiones y continentes
  y ferris o lanzaderas que unan esos continentes").
  · Capa de juego: WorldAtlas {continents, regions, links}; toda
    región pertenece a un continente y la expedición lleva regionId
    (migración: las antiguas viven en el Paso de Sal). Enlaces de tres
    clases — CAMINO (marcha normal: consume suministros, gratis),
    FERRY (con horario: pasaje ⌾, sin eventos ni suministros a bordo)
    y LANZADERA (cara y rápida: cruza en 1 jornada). useLink es
    determinista y simétrico.
  · Mundo inicial: continente ARCADIA (Paso de Sal + COSTA ESMERALDA,
    con Puerto Esmeralda nivel 2) y continente EL HIERRO (MESETA DEL
    HIERRO: tierra chatarrera con Forja Alta nivel 2 y el Muelle del
    Óxido). Camino Cruce del Río↔Marjal de la Luz; ferry Puerto
    Esmeralda↔Muelle del Óxido (3 jornadas, ⌾120); lanzadera Espejo
    del Norte↔Forja Alta (1 jornada, ⌾300). Contenido de primera
    pasada: la dirección lo repoblará.
  · Web: la región activa sigue a la expedición; el título del mapa
    dice Continente · Región; los transportes aparecen como rutas
    especiales (🛤/⛴/🚀) con jornadas y pasaje a la vista.
- **2026-07-06** — LA BASE VIAJA CONTIGO (cierre del atlas, dirección
  del usuario: "hagamos eso"):
  · CUARTEL ITINERANTE: homeRegionId en la campaña (migración: Paso
    de Sal). Cerrar expedición en el taller de otra región MUDA la
    base allí — el diario lo registra — y los contratos y salidas
    libres parten del taller de la base actual. Los contratos apuntan
    a lugares de ESA región: el mismo Gremio, otra tierra.
  · ENCUENTROS POR CONTINENTE: en El Hierro aflora la CHATARRA (veta
    tras un derrumbe, 3 opciones: excavar ⌾240 +1 día / avisar a los
    clanes (Chatarreros +8) / ni tocarlo). Arcadia no la conoce.
  · TRABAJOS DE CLANES: en ciudad chatarrera el trabajo sucio de
    taberna paga un 25% mejor y nadie hace preguntas.
- **2026-07-06** — SILUETAS Y TERRENO (dirección del usuario: "estoy
  cansado de ver bloques moviéndose"). Las fichas dejan de ser
  bloques: cada FAMILIA de chasis tiene una silueta lateral SVG
  reconocible a 46px (felino, lobo, raptor, terópodo, oruga, tortuga,
  volador, gorila, bisonte, escorpión, cuellilargo, torreta), morro
  hacia su facing (oeste voltea, norte/sur inclinan), coloreada por
  bando vía currentColor, con sombra, etiqueta pequeña y barra de
  vida. Son siluetas de LECTURA, no ilustraciones: distinguirse de un
  vistazo es el requisito. El terreno gana textura: agua con ondas
  animadas, bosque con copas, abrupto punteado, muros con trama
  diagonal, cotas de altura como filos de luz y damero sutil. Todo
  inline: cero archivos, build autocontenido.
- **2026-07-06** — VISTA DE MESA (prueba del escalón 2 de la escalera
  estética, a petición del usuario antes de decidir el escalón 3).
  Botón 🧊 ISO en la cabecera de batalla (persistente): el tablero se
  inclina 46° como mesa de guerra, las COTAS suben como escalones
  físicos (translateZ por nivel), los muros se levantan, y las bestias
  quedan DE PIE como figuras (contra-rotación desde los pies, escala
  +25%). El picking del ratón funciona inclinado (el hit-testing del
  navegador respeta transformaciones). Es un ensayo de dirección: la
  decisión pendiente es el escalón 3 (renderer isométrico real en
  canvas estilo FFT, prismas de altura procedurales + billboards).
- **2026-07-06** — EL DIORAMA (escalón 3, "muéstrame el 3d isométrico"):
  renderer isométrico REAL en canvas (src/web/iso.ts), fórmula FFT:
  · Terreno en rombos 2:1 con la ALTURA como prismas apilados (por fin
    las colinas SE VEN), caras laterales sombreadas, agua hundida que
    ondula, árboles y piedras procedurales por casilla (deterministas).
  · Bestias como BILLBOARDS: las siluetas SVG se hornean a imagen con
    el color del bando y se plantan de pie con sombra elíptica, barra
    de vida y etiqueta. Todo procedural: cero archivos.
  · Paridad táctica completa: rangos de movimiento/boost/objetivo
    tintados en los rombos, camino punteado, ⌖ de tiro, flechas de
    orientación, % sobre el objetivo, cursor y confirmación. El ratón
    hace picking real en rombos CON elevación; el teclado, como
    siempre. Números flotantes y efectos se proyectan al diorama.
  · Tres vistas ciclables y persistentes en la cabecera de batalla:
    🗺 plana (DOM) → 🧊 mesa (CSS) → 🏔 diorama (canvas). El motor no
    cambió ni una línea: el diorama solo PINTA estado resuelto.
- **2026-07-06** — EL DIORAMA POR DEFECTO + MARCHA + LECTOR DE CASCO
  (dirección del usuario: "pásalo a 3D" y "mejora los diagramas de
  estado, están muy básicos").
  · El diorama es la VISTA POR DEFECTO de batalla (quien eligió otra,
    la conserva).
  · MARCHA INTERPOLADA: las bestias CAMINAN por su camino casilla a
    casilla (110 ms/casilla, saltito de zancada, la elevación se
    interpola entre cotas). reduced-motion la apaga.
  · LECTOR DE CASCO: el diagrama de módulos se rehace como consola de
    cabina — la SILUETA del propio chasis en fantasma de fondo, cada
    módulo como nodo-anilla (la anilla es la fracción de HP) cableado
    al torso, ✕ pulsante en destruidos, parpadeo en críticos,
    esquinas de visor y rejilla de fósforo. Arte procedural: cuando
    exista arte encargado, se sustituye pieza a pieza.
- **2026-07-06** — DESTACAMENTOS (dirección del usuario: "somos una
  compañía — enviemos miembros a encargos donde ganan experiencia y
  todo a menor nivel, con llamadas a base para decidir seguir o
  volver"). Sistema completo en src/game/assignment.ts (contenido de
  primera pasada en src/data/assignments.ts):
  · Se destaca UN piloto CON su máquina (huecos 2-4; la compañera no
    se separa de ti): ese hueco no despliega hasta que vuelve — la
    rotación es el coste y el punto.
  · El encargo avanza con las JORNADAS de expedición: la compañía
    tiene que vivir para que el mundo trabaje.
  · LLAMADAS A BASE en puntos de control (1-2 según duración): el
    encargo se PAUSA hasta decidir — seguir/volver/arriesgar, con
    días, paga y éxito anunciados en cada opción.
  · GRADO de éxito (brillante/cumplido/apurado/fracaso): la
    experiencia SIEMPRE mejora el resultado (+7 por nivel de pista,
    test de monotonía). El fracaso no paga, estresa y deja 2 jornadas
    de baja.
  · Recompensas al recibir el regreso en el cuartel: créditos, XP por
    pista (20-45 total: menor que jugar, suficiente para rotar),
    reputación, y línea en el diario.
  · 3 encargos iniciales: Escolta local (3j, defensa), Prospección
    (4j, apoyo, con galería tentadora), Rastreo del Gremio (5j,
    tirador, DOS llamadas).
- **2026-07-06** — REORGANIZACIÓN DE MENÚS + CIUDAD-LUGAR + FORMACIÓN
  (dirección del usuario tras revisar el mapa de menús):
  · BARRA DE SISTEMA ÚNICA: 💾 · 🔊 · ☰, mismo orden, en cuartel,
    mundo y ciudad. La batalla pierde "Partidas"; "nueva campaña" y
    "modo escaramuza" salen del cuartel (Juego nuevo y el menú de
    inicio ya los cubren).
  · CUARTEL EN 3 PESTAÑAS (se recuerda la última): ⚑ Operaciones
    (contratos + destacamentos + partir), ⚙ Hangar (roster + armería),
    🏢 Compañía (reputación + pilotos + diario embebidos — los botones
    🧠/📜 desaparecen de la cabecera).
  · LA CIUDAD ES UN LUGAR (a lo Darkest Dungeon): horizonte procedural
    propio (tejados y ventanas deterministas por id, acento del color
    de su facción), y una PLAZA con puertas-edificio (Taller, Mercader,
    Fábrica si la hay, Fabricación si nivel 2+, Modificación,
    Descansos, Taberna, Formación). Se ENTRA a cada edificio y se
    vuelve a la plaza (Esc también); los mostradores ya no son un
    scroll.
  · FORMACIÓN DE SALIDA (regla nueva): al partir (contrato o libre) se
    ELIGE quiénes van — la compañera va siempre: tú pilotas — y las
    batallas de la expedición despliegan SOLO a la formación. No se
    reorganiza en ruta: únicamente en el edificio Formación de una
    ciudad. Expediciones guardadas de antes: van todos (migración).
- **2026-07-06** — DIRECCIÓN DE ARTE PROCEDURAL ("está MUY plano:
  necesita más diseño y arte"). Escenas, no paneles — todo dibujado
  con código, cero archivos:
  · PORTADA: paisaje nocturno con estrellas, dos lunas, dunas en
    capas y la compañera en la cresta mirando el cielo; los botones
    flotan sobre la escena.
  · CUARTEL: escena del hangar (costillas estructurales, foco cenital,
    cajas con balizas) con la compañera aparcada en silueta rim-light.
  · CIUDAD: cielo de atardecer con sol/luna del color de la facción y
    tejados en DOS capas; las puertas de la plaza son FACHADAS
    dibujadas (taller a dos aguas, mercader con toldo, fábrica de
    dientes de sierra, grúa, persiana, pensión, taberna con cartel,
    banderín de formación) — fuera los emojis planos.
  · MUNDO: brújula de carta de navegación en el mapa.
  · GLOBAL: grano de película sutil (feTurbulence), titulares como
    placas estarcidas con muesca ámbar/cian, CTAs de partir con franja
    de rayas de peligro.
- **2026-07-06** — "APLICA TODO": el bloque grande del motor de combate
  (los seis huecos del repaso, en un solo golpe). Golden regenerado y
  declarado — las rondas y reacciones cambian el flujo de las batallas
  de referencia.
  · OBJETIVOS DE BATALLA (core, BattleObjective): eliminate (clásico),
    assassinate (cae el señalado y se acabó), protect (si cae el
    protegido se pierde), reach (plantar una unidad en la zona) y
    survive (aguantar N rondas). La aniquilación propia siempre es
    derrota y la ajena siempre victoria (regla de gracia). RONDAS:
    cada unidad actúa ~una vez por ronda (evento round-started, a la
    vista en el HUD).
  · CONTRATOS CON REGLAS PROPIAS: caza = derriba al cabecilla (bestia
    2×2 'Gran Brontes', PROVISIONAL); escolta = protege al carguero
    W1 (chasis 'carguero-colono', speed 0, PROVISIONAL); asalto =
    segunda oleada enemiga en la ronda 3. Briefing anunciado al abrir
    el registro táctico: sin letra pequeña.
  · REACCIONES (1 por ronda, se recupera al abrir turno propio):
    ataque de oportunidad al despegarse de un enemigo en contacto y
    contraataque al sobrevivir un golpe a bocajarro. Tiro instintivo:
    no gasta recursos (los vetos de sistemas sí aplican), pega al 60%
    y JAMÁS encadena otra reacción. El posicionamiento por fin cuesta.
  · RETIRADA Y EYECCIÓN (perder sin game over): retirarse exige borde
    del mapa y salva la máquina con su daño; eyectar sacrifica la
    máquina y el piloto vuelve con 1 jornada de baja (no 3) y menos
    estrés. El comandante que se va deja al equipo sin red de mando.
    Si el actor cae en su PROPIO turno (contraataque letal), el motor
    cierra el turno solo.
  · REFUERZOS POR OLEADAS (BattleConfig.reinforcements): entran al
    arrancar su ronda en la casilla libre más cercana (anillos
    deterministas); mientras haya oleada en camino, su equipo no
    pierde por aniquilación — barrer la vanguardia no cierra el asalto.
  · MULTI-CASILLA (UnitDefinition.size): bestias 2×2 ancladas en su
    esquina noroeste; ocupan y bloquean su huella entera, se les
    apunta a cualquier casilla, la cercanía cuenta desde la casilla
    más próxima, un área les pega UNA sola vez y son inmunes al
    empuje. Sin precio en tienda: no se pilotan.
  · TERRENO QUE SUFRE: las explosiones ya derribaban muros; ahora
    también ARRASAN el bosque (terrain-razed): la cobertura muere con
    él.
- **2026-07-06** — VIGILANCIA + CONTRATOS NUEVOS + ÁRBOL DEL PILOTO
  ("me parece aplícalos / vigilancia a lo XCOM / árbol: uno básico y
  especializaciones, solo una principal y una secundaria").
  · VIGILANCIA (XCOM): acción que renuncia a actuar y cierra el turno
    al acecho — dispara al PRIMER enemigo que se mueva a su alcance
    real (rango + línea de visión). Es un disparo PLANEADO: paga
    munición/energía/enfriamiento, pega al 75% y consume también el
    reflejo del tirador (nada de doble castigo). Expira al abrir el
    turno propio. Botón 👁 y tecla V.
  · CONTRATOS QUE USAN reach/survive: INCURSIÓN (paga bien, chatarra
    corta: planta cualquier máquina en la línea del fondo, marcada ⚑
    en plana y diorama, sin obligación de derribar) y DEFENSA (aguanta
    4 rondas; la oleada del asedio llega en la ronda 2). La mesa de
    contratos ROTA por ciclo (determinista) para que con cupo limitado
    se vean los cinco tipos de encargo.
  · ÁRBOL DEL PILOTO: pista BÁSICA de pilotaje (+1 puntería/+1 evasión
    por nivel; aprende de TODO: 30% de cada ganancia) + cuatro
    escuelas de especialización de las que solo UNA PRINCIPAL (XP al
    100%, árbol activo, sinergia de equipo) y UNA SECUNDARIA (XP al
    60%, árbol activo) pueden estar elegidas. La XP dirigida a pistas
    no elegidas fluye entera a la básica; la bancada en pistas que
    dejan de estar elegidas queda DORMIDA (no se borra). Sin elegir
    escuela no hay perks: elegir es despertar lo bancado. Se elige y
    se cambia en Compañía (sin coste, por ahora). Migración: básica =
    25% de lo vivido; principal = pista dominante; secundaria = la
    segunda con XP real.
- **2026-07-06** — De los 12 arquetipos de silueta, el CARACOL pasa a
  TORTUGA ("es más aesthetic"): caparazón abovedado con banda de
  placas, cabeza corta al frente y patas rechonchas. La llevan el
  Gustav y el carguero de escolta. El encargo de arte se actualiza.
- **2026-07-06** — DIORAMA GIRATORIO + CLIMA CON PESO Y PRESENCIA.
  · GIRO DE CÁMARA: el diorama rota en cuartos de vuelta (botón ⟳ y
    tecla Q, persistido). La cámara gira, el mundo no: el motor sigue
    sin enterarse; proyección, orden del pintor, facing de sprites y
    picking giran juntos (tests de ida y vuelta en tests/iso.test.ts).
  · CLIMA VISIBLE: la lluvia raya y azulea el campo; la tormenta de
    arena arrastra velos de polvo y entibia la luz. Capa final del
    canvas, determinista respecto al reloj de escena.
  · CLIMA REGIONAL CON PESO: cada región tiene su perfil de cielos
    (Paso de Sal traga arena, Costa Esmeralda llueve, la Meseta del
    Hierro respira polvo). weatherFor(región, día) es determinista:
    recargar no cambia el tiempo, viajar sí. Las batallas de campaña
    pelean bajo el cielo del día (la tormenta que nos siguió en ruta
    aún manda); el selector de la cabecera queda para escaramuzas.
    El PESO: en batalla ya restaba (lluvia disipa calor, arena ciega
    a distancia); ahora viajar bajo tormenta come +1 suministro, y el
    mapa de mundo anuncia el cielo del día (☀/🌧/🌪).
- **2026-07-07** — HOJA DE SERVICIO DEL CHASIS + CICATRICES ("¿qué pasó
  con las marcas de batalla en el zoid?" → aplícalo). La LEY se mantiene:
  la máquina NO gana experiencia — pero sí HISTORIA.
  · ZoidRecord por máquina: batallas servidas, derribos, reconstrucciones,
    eyecciones y retiradas. Se graba al liquidar cada batalla (los
    derribos se atribuyen por el log de eventos) y en el taller (cada
    reconstrucción queda anotada). Guardados viejos: hoja a cero, sin
    migración (lectura con huecos por defecto).
  · VETERANÍA del chasis por batallas: a estrenar → curtido (3) →
    veterano (8) → leyenda del taller (15). Cruzar tramo deja línea en
    el diario de expedición.
  · CICATRICES COSMÉTICAS: nivel 0-4 (una por cada 4 batallas + una por
    reconstrucción, tope 4). Marcas deterministas sobre la silueta —
    zarpazos oscuros y parches soldados alternados — visibles en vista
    plana, mesa, diorama y en la carta del hangar (silueta + resumen).
    Las máquinas de escaramuza no llevan historial: cicatrices solo en
    campaña.
- **2026-07-07** — TODO ZOID ESTÁ VIVO ("todos los zoids tienen historia
  y núcleo, no solo el mío"). Ley de universo: cada máquina del roster
  tiene NÚCLEO — marcas grabadas por lo vivido y compenetración con su
  piloto — no solo la compañera.
  · OwnedZoid.core (misma forma que el de la compañera); guardados
    viejos leen núcleo verde, sin migración.
  · CORE_TABLE (data/marks.ts): mismas marcas, pero el vínculo menor
    tiene TECHOS más bajos — 3 espacios de marca (vs 6) y compenetración
    6 (vs 12); los tramos altos ('Una sola pieza', 'Leyenda del taller')
    son SOLO de la compañera. El viaje sigue siendo con ella.
  · Graban: cada batalla desplegada (tormentas, apagados, bajas, cazas,
    roces — anunciado al liquidar y en el diario), cada reconstrucción
    en el taller, y cada expedición cumplida estrecha la compenetración
    de TODA la formación que fue.
  · Sus marcas y tramos aportan modificadores al desplegar, como la
    biografía de la compañera.
  · El hangar enseña el núcleo de las cuatro cartas; cambiar de chasis
    con historia grabada pide confirmación (el nuevo llega verde).
- **2026-07-07** — EL DÍA DE LOS CUATRO BLOQUES ("aplica la 1 2 3 y 4").
  · IA CON EL ARSENAL NUEVO (commit propio): vigilancia cuando no hay
    tiro y el enemigo se acerca; retirada REAL del malherido prudente
    (corre al borde y abandona — se te puede escapar la presa); olfato
    de misión en escoltas (+40 de utilidad al carguero protegido).
    Golden regenerado y declarado. Nota de diseño: dos bandos pasivos
    aún pueden empatar sin fin (los Gordos que mantienen posición);
    contra un jugador que avanza no ocurre — vigilar si molesta.
  · HABILIDADES ACTIVAS POR ESCUELA (commit propio): usesPerBattle en
    el motor + extraAbilityIds por spawn; Embestida / Tiro calibrado /
    Reparación de emergencia / Postura de hierro (PROVISIONAL), una por
    batalla, otorgadas al desplegar con la escuela elegida a N1+.
  · REPETICIONES: el determinismo las regala. GameMap.toAscii (inverso
    exacto de fromAscii, testeado), receta = config serializada +
    acciones en orden (execTracked es la única puerta de ejecución), y
    «📼 Ver repetición» en el parte final reconstruye el motor y repite
    las órdenes a 260ms/acción (Esc sale). Los pilotos van fotografiados
    en la receta: la XP ganada después no altera la repetición.
  · TUTORIAL DE PRIMERA BATALLA: siete lecciones del instructor en una
    tarjeta fija (objetivo/rondas, mover, disparar sin certezas,
    posturas+vigilancia, reacciones, retirada/eyección, memoria del
    metal), con Saltar; se guarda en localStorage y no vuelve a sonar.
- **2026-07-07** — ESTADO DEL DESTACAMENTO EN BATALLA ("me gustaría ver
  el estado de mis zoids mientras peleo"). El panel Unidades deja de ser
  una lista plana: los TUYOS van primero con carta completa — piloto a
  los mandos (nombre, escuela principal/secundaria con nivel, 💢 si el
  estrés pesa), barras, munición por arma, estados, cupo de escuela
  (✦ Embestida — lista/gastada) y diagrama de módulos si el chasis lo
  tiene. Debajo, «— fuerzas hostiles —»: del enemigo solo lo que verían
  tus sensores (casco, estados, 👁 vigila). Sellos de salida: 🏳 RETIRADO
  / 💺 EYECTADO en vez de un genérico "no está". La carta del que actúa
  se resalta, y CLIC en cualquier carta salta el cursor a esa unidad en
  el campo (localizar de un vistazo). De regalo, un bug real cazado: la
  tecla Q nunca giraba el diorama porque el case de cancelar la
  capturaba antes (case duplicado = código muerto); ahora Q gira en
  diorama y cancela en vista plana.
- **2026-07-07** — PULIDO DE LA REVISIÓN ("revisa los últimos cambios →
  aplica"). Cuatro arreglos del panel de destacamento: la repetición
  enseña al piloto FOTOGRAFIADO en la receta (no al del presente, que ya
  cobró XP y estrés); las barras ⚡/🔥 enemigas desaparecen — energía y
  calor son telemetría de a bordo, solo de los tuyos; la leyenda dice
  «Q gira el diorama» (en vista plana Q cancela); y las cartas de los
  que ya salieron del campo no calculan stats que nadie pinta.
- **2026-07-07** — TERRENO TRANSITABLE: EL AGUA SE VADEA Y TODO SE ESCALA
  (dirección del usuario: "necesito que los mapas puedan ser transitables
  de un lado a otro —encuentro algunos con el paso cortado—; haz que sea
  posible entrar al agua, pero en el agua el ataque y la movilidad
  limitados, y que todo se pueda escalar aunque cueste"). El ÚNICO terreno
  que corta el paso pasa a ser el MURO.
  · AGUA VADEABLE (core/grid.ts): el coste de entrar al agua para
    terrestres deja de ser Infinity y vale WATER_WADE_COST=3 (más que el
    abrupto: la movilidad dentro del agua queda limitada por el coste).
    Voladores y anfibios la cruzan por 1. El vado del río deja de ser un
    muro y pasa a ser el cruce BARATO — decisión táctica, no puerta.
  · ATAQUE LIMITADO EN EL AGUA (core/combat.ts + battle.ts hitContext): un
    terrestre que dispara o golpea vadeando sufre −WATER_ATTACK_PENALTY
    (=20) de puntería (sin suelo firme). Anfibios y voladores exentos. Se
    refleja en el % del pronóstico: consecuencia anunciada. El agua sigue
    dando +5 de cobertura al que la ocupa — te oculta las piernas pero
    apuntas peor: tensión nueva.
  · ESCALADA SIN TOPE (core/pathfinding.ts): desaparece el tope duro de
    salto. Cualquier desnivel se sube o baja; el salto (jump) es cuántos
    niveles se salvan GRATIS y cada nivel de más cuesta
    CLIMB_COST_PER_LEVEL (=2) de movimiento. Los muros (altura 99, coste
    Infinity) siguen sin escalarse; los voladores siguen ignorando la
    altura.
  · CONECTIVIDAD GARANTIZADA DE VERDAD (game/mapgen.ts): como solo el muro
    corta, la garantía se vuelve fiable. El BFS de rescate esquiva ahora
    solo muros (no agua) y conecta TODOS los spawns de ambos bandos —no
    solo los enemigos— desde el primero del jugador; el pasillo de rescate
    derriba los muros que cruce. Verificado con el pathfinding real: 1400
    spawns en 200 mapas generados, 0 inalcanzables.
  · Golden master regenerado y DECLARADO: en el valle, con el río ya
    vadeable y el cañón de partículas del Geno castigando a quien cruza a
    campo abierto con −20, las tres batallas de referencia se inclinan al
    enemigo (terminan en 26-44 turnos). Es señal de BALANCE del escenario,
    no de rotura: el motor sigue determinista. Los números (3 / 20 / 2)
    quedan calibrables.
- **2026-07-07** — MUNDO AMPLIADO + RUINAS SECRETAS Y DESCUBRIMIENTO
  (dirección del usuario: "amplía continentes y regiones; quiero ruinas y
  ruinas secretas y partes del mapa que requieran explorar").
  · TERCER CONTINENTE — EL VELO, con la región CINTURÓN DE CENIZA
    (src/data/world.ts): tierra volcánica de escoria, la más dura y la que
    más esconde. Capital nivel 3 (Catedral Fundida), fábrica de piezas
    (Ciudad de Hollín), puerto de ferry y dos secretos. Enlazada al mundo
    por un ferry (Puerto Esmeralda↔Puerto de Brea, ⌾220) y una lanzadera
    (Forja Alta↔Catedral Fundida, ⌾380). Contenido de primera pasada.
  · DESCUBRIMIENTO DEL MUNDO (game/expedition.ts, capa pura — NO es la
    niebla de guerra táctica, que sigue aplazada): los nodos pueden ser
    `hidden` (no se dibujan ni se viajan hasta descubrirlos) y sus tramos
    quedan LATENTES; un lugar puede `reveals` otros al explorarlo. Estado
    persistente `CampaignState.discovered` (migración: ausente = nada
    descubierto). Helpers isNodeVisible/visibleNodes/isEdgeVisible;
    availableEdges y canExplore reciben `discovered`; assignTarget NUNCA
    apunta a un nodo oculto (no se encarga lo que no está en el mapa).
  · RUINAS SECRETAS (`hidden` + `secret`): 4, una por región — Cripta de
    Sal, Templo Sumergido, Bóveda Imantada y la Sima de los Primeros. Se
    revelan explorando la ruina normal vecina (o registrando un paraje con
    secretos, como el Foso de Vidrio). Botín SECRET_RUIN_FINDS (640-900,
    vs 300-500 de las normales) y mejores probabilidades, pero el susto
    muerde más. Explorar un PARAJE con secretos ahora también es una acción
    ("registrar el lugar"): descubre sin dar botín.
  · Web: el mapa de mundo filtra nodos/tramos/rutas por visibilidad; el
    botón de explorar se adapta (ruina / ruina secreta / registrar); lo
    descubierto se persiste y se queda para siempre. Todo determinista por
    clave; consecuencias anunciadas. Tests: exploration.test.ts (5) +
    atlas/expedition intactos.
- **2026-07-07** — DESGASTE DE COMBATE Y DIFICULTAD SIN ESPONJAS
  (aclaración del usuario: "no quiero esponjas de balas en dificultades
  altas; con tanto desgaste visible en cada Zoid, que cueste y que cada
  impacto deje marca — sin una pata te mueves menos y apuntas peor —, más
  dinámico pero con reglas claras y opciones"). La dificultad deja de ser
  solo el punto de partida económico y pasa a escalar la CONSECUENCIA del
  daño, NUNCA el HP.
  · WEAR (core/wear.ts): función pura del HP, sin azar. Tramos por fracción
    — entera (>66%), CASTIGADA (≤66%: −6 punt/−4 eva/−1 mov a severidad 1)
    y MALHERIDA (≤33%: −14/−8/−2). Entra al pipeline de stats como un
    modificador más. `BattleConfig.wear` (severidad, 0 por defecto) la fija
    la campaña; el motor genérico no sabe de dificultad. Con severidad 0,
    comportamiento y golden IDÉNTICOS (verificado). No toca maxHp jamás.
  · DIFICULTAD (data/economy.ts): Cadete wear 0.5, Mercenario 1, Leyenda
    1.6 — mismo Zoid al 15% de HP: −7/−14/−22 de puntería, el HP intacto en
    los tres. Escaramuza usa el desgaste base (Mercenario). Guardada en
    CampaignState.difficulty (migración: ausente = mercenario).
  · SIN UNA PATA (data/modules.ts): las cuatro patas (Liger CAS, Geno CP)
    ganan onDestroyed −10 de puntería: perder un tren no solo quita
    movimiento (contribución perdida) — además cuesta apuntar. El retroceso
    fuerte ya existe (physics.ts knockback), ahora con más sentido (el agua
    es vadeable: te pueden empujar dentro).
  · SÍNTOMA LEGIBLE (web): insignias ⚠ castigada / 🩸 malherida junto a las
    de avería; el % de acierto y el rango de movimiento ya reflejan el
    desgaste. Reglas claras, decisión del piloto (aguantar/replegarse/
    cambiar de postura). Tests: wear.test.ts (5). Golden intacto.
- **2026-07-07** — PASADA DE BALANCE (revisión con datos tras el terreno,
  el mundo y el desgaste). Las herramientas de balance vuelven a correr:
  · ARREGLADO npm run balance:hangar (roto desde que se añadieron las
    unidades de escenario): (a) el driver ejecutaba el plan entero de una
    unidad aunque un contraataque letal cerrara su turno a mitad ("No es el
    turno de…") — ahora usa el guard de scriptedBattle; (b) el POOL incluía
    bestias 2×2 y el carguero inmóvil, que se salían del mapa o no combaten
    — ahora solo chasis pilotables (size 1, speed>0).
  · MEDICIÓN (wear 0 en las herramientas, aíslan el terreno): el valle
    queda 44% jugador / 56% enemigo — DENTRO de la banda 42-58%. El terreno
    (agua vadeable, escalada) NO rompió el escenario; las 3 semillas golden
    inclinadas a enemy eran muestreo, no tendencia.
  · HANGAR (800 batallas 4v4 aleatorias): banda ~40-60%. Fuertes gun-sniper
    (~60%), dibison y geno-saurer (~59%); débiles rev-raptor (~40%, muere
    92%) y liger-zero-cas (~42%, muere 90%) — melee frágil que cruza campo
    abierto contra fuego. Consistente con el límite conocido de la IA greedy
    (favorece el standoff), que la dirección ya decidió NO sobre-ajustar.
  · DECISIÓN: valorada la penalización de vadeo (−20→−15): no mueve el
    balance (43.7% vs 44.0%, ruido), se mantiene −20 por claridad de feel.
    NO se tocan stats de chasis: los outliers están a ~2pp de la banda y
    nerfear al gun-sniper (fuerte en el hangar) hundiría al jugador del
    valle (donde lo pilota) — conflicto entre escenarios. Herramientas
    listas para una pasada medida futura. Flags para la dirección:
    gun-sniper/dibison/geno (por arriba), rev-raptor (por abajo).
- **2026-07-07** — BLINDAJE POR PARTES: LA CAPA QUE SE GASTA (dirección del
  usuario: "el blindaje, que al momento que se acaba realmente empiezan a
  sufrir, por partes del cuerpo"). Profundiza el daño localizado del frame
  (core/frame.ts) con dos capas por módulo, estilo BattleTech:
  · BLINDAJE (ModuleDefinition.plating, ModuleState.plating): capa de placas
    que se GASTA absorbiendo daño. Mientras aguanta, la armadura mitiga y la
    estructura interna está PROTEGIDA (el HP global no baja). Al agotarse se
    emite `module-armor-broken`: la pieza queda EXPUESTA.
  · EXPUESTA = sufre de verdad: la estructura recibe el daño ÍNTEGRO, sin
    mitigación de armadura, hasta destruirse (con su onDestroyed: la pata
    quita movimiento y puntería, la cabeza puntería, etc.). Ejemplo real
    (torso Liger CAS, blindaje 16 / armadura 3): golpes de 12 → 9 al
    blindaje (HP global intacto); roto el blindaje, cada 12 son 12 íntegros
    a la estructura. Cada impacto deja marca, por zona.
  · deriveUnitHp sigue la ESTRUCTURA (el blindaje es capa extra): el HP
    global se protege mientras el blindaje aguanta y cae cuando se rompe —
    la lectura que pedía el usuario. maxHp y la equivalencia framed↔monocasco
    intactas; los módulos SIN plating se comportan como siempre (la armadura
    mitiga cada golpe) → golden y tests clásicos idénticos.
  · Blindaje en los 18 módulos (12 de frame + 6 aftermarket), ~35-40% de la
    estructura (defensivos más). BALANCE: da a los 2 chasis framed (débiles,
    42-46%) algo de aguante temprano, compensado porque expuestos mueren más
    rápido (sin mitigación). Valores TUNEABLES; medir con el hangar.
  · LECTOR DE CASCO (web): anilla exterior cian = blindaje; punteada roja =
    EXPUESTO; el registro avisa "🛡✕ blindaje ROTO". Tests: plating.test.ts
    (5). 273 tests en verde, tsc limpio, golden intacto.
- **2026-07-07** — REFUERZO DE BLINDAJE: BÚNKER MONTABLE EN EL TALLER
  (dirección del usuario: "que el blindaje se repare en el taller; puedes
  dar extra blindaje para una misión pero serás más lento"). El hermano de
  CAMPAÑA del blindaje por módulos: un búnker a nivel de máquina que vale
  para TODO chasis (también los monocasco).
  · MOTOR (core: UnitSpawn.armor → UnitState.armor): un búnker de placas que
    absorbe daño ANTES que el casco o los módulos. La penetración del
    proyectil se cuela sin gastarlo; el resto lo frena hasta agotarse (evento
    unit-armor-broken). Absorbe también el daño de reacciones. Con armor 0
    (por defecto) el motor se comporta idéntico: golden INTACTO.
  · TALLER (game/mercenary.ts + data/economy.ts): OwnedZoid.reinforced +
    armor. `reinforceArmor` monta el búnker (⌾400, 30 de placas), `repairArmor`
    lo repara a tope (⌾3/punto gastado), `stripReinforcement` lo quita. El
    blindaje gastado en batalla PERSISTE (resolveContract.finalArmor) y se
    repara en el taller — igual que el HP.
  · EL PRECIO: reforzar resta MOV −1 y velocidad −3 al desplegar
    (reinforcementModifiers, sumados a las marcas de la compañera). Extra
    aguante a cambio de ir más lento — consecuencia anunciada. Verificado:
    Command Wolf reforzado MOV 5→4 con 30 de búnker; vuelve a 8/30 y el
    taller lo repara a 30/30 por ⌾66.
  · WEB: el hangar del cuartel gana Reforzar / Reparar blindaje / Quitar
    refuerzo por máquina; el despliegue aplica búnker + penalización; el
    registro avisa cuando el búnker se agota. Tests: armor.test.ts (6).
    279 tests en verde, tsc limpio, golden intacto.
- **2026-07-07** — ARREGLOS (reporte del usuario): fin de contrato y
  descansos. Verificado en el juego real (Playwright headless).
  · FIN DE CONTRATO: al volver al mapa o al cuartel, el overlay de
    Victoria/Derrota NO se cerraba (solo lo cerraba startBattle); como
    #world/#merc lo tapan por z-index, "a veces" parecía no volver. Ahora
    restart() cierra el overlay SIEMPRE. Además el destino de vuelta se fija
    al inicio de settleContract (antes de liquidar nada: un fallo al repartir
    ya no manda a una escaramuza suelta), y el botón/subtítulo del overlay
    DICEN a dónde se vuelve ("🗺 Volver al mapa" / "⚒ Volver al cuartel")
    en vez del engañoso "Nueva batalla".
  · DESCANSOS: estaban TODOS deshabilitados cuando ningún piloto tenía
    estrés (maxStress===0) — es decir, en cuanto la tripulación estaba
    tranquila (y en toda partida recién fundada). Ahora descansar solo se
    limita por el bolsillo: pasa una jornada (cura heridas, avanza
    destacamentos), alivia el estrés que haya y la vela es un momento con la
    compañera. La vela, además, es GRATIS de verdad (0, no el mínimo de px).
- **2026-07-08** — EL REACTOR Y EL CALOR COMO ENCRUCIJADA (respuesta a las
  propuestas del director para "evolucionar el motor": profundidad por
  INTERACCIÓN entre sistemas ya existentes, no sistemas nuevos). Todo se
  apoya en el componente de calor (solo lo tienen los chasis con reactor,
  liger-zero-cas y geno-saurer-cp): los monocascos —y el golden master— no
  se enteran. Tres piezas, un solo recurso compartido (el calor):
  · SOBRECARGA DEL REACTOR (el "pacto con el diablo", propuesta 2): acción
    LIBRE que no gasta turno (como la postura). Mientras esté puesta da
    +2 mov / +4 iniciativa / +8 daño físico y de energía vía el pipeline de
    stats (overclockModifiers), pero el reactor pega un tirón de +15 de calor
    al engancharla y suma +18 cada turno que sigue puesta. El castigo NO es
    una barra nueva: es el apagado de emergencia que ya existía. Sostenerla
    sin refrigerar termina en shutdown, y el propio apagado la corta solo
    (el reactor se protege) — evita el bucle de recalentarse en cadena.
  · CALOR ↔ ARSENAL (interacción, propuesta 1): un arma cuyo calor
    desbordaría el reactor no se puede disparar (la máquina se protege). Es
    simétrico: cocer al enemigo con calor le ATASCA las armas pesadas. El
    veto cede la razón al arsenal si además hay munición/enfriamiento (razón
    más específica primero); solo veta un arma que por lo demás sí dispararía.
  · POSICIÓN ↔ CALOR (interacción, propuesta 5, versión mecánica NO moral):
    operar rodeado (≥2 enemigos adyacentes) recalienta +10 al cerrar el
    turno. El cerco ya no es solo daño entrante: fuerza a la máquina.
  Implementación fiel al núcleo: nuevo `strainSystem` (registrado ANTES que
  heat para que el calor que añade se evalúe el mismo turno), acción
  `overclock` y evento `overclock-changed` (eventos solo se AÑADEN), bono por
  StatModifier con `source:'overclock'`, todo gated en hasReactor(). Ningún
  sistema conoce a otro: strain solo escribe en el componente de calor
  compartido. 7 tests nuevos (tests/overclock.test.ts), 286 en verde, golden
  intacto, tsc limpio. Cliente cableado (botón 🔥 Sobrecarga + tecla O + líneas
  de registro que NOMBRAN la consecuencia) y verificado en el juego real
  (Playwright headless: enganche, bono, apagado que la corta, toggle).
  Aplazadas para siguientes bloques: CT como recurso (propuesta 4), sinergias
  de escuadra (6) y control del campo (7).
- **2026-07-08** — LEER LA MÁQUINA: SÍNTOMAS DEL CALOR Y EL REACTOR (propuesta
  8, "información por síntomas" — NO niebla, que sigue aplazada). El sistema de
  síntomas ya existía (cojea / sensores rotos / arma inutilizada / desgaste),
  pero era CIEGO a lo que introdujo el bloque anterior. Ampliado, y es puro
  cliente (cero motor, golden intacto): la tensión térmica ahora se DELATA a la
  vista, también en el enemigo —
  · 🔥 reactor forzado (sobrecarga puesta), 🌋 al rojo vivo (calor crítico
    ≥85%), ♨ humea (calor alto ≥70%): en color de calor, usando los MISMOS
    umbrales del motor (HEAT_HIGH/CRITICAL_THRESHOLD), no números mágicos del
    cliente.
  · 🔋 sin fuerza (energía a cero: sus penalizaciones defensivas están vivas),
    🛡 expuesto (una pieza agotó su blindaje pero aún no cae: la costura por
    donde entra el próximo golpe).
  Las insignias salen en la ficha del roster Y en el panel de análisis al
  posar el cursor sobre cualquier unidad ("lectura: …"). No se ocultan las
  barras numéricas (la niebla sigue aplazada): es una CAPA de lectura, no un
  recorte de información. Cierra el lazo con el bloque del reactor — un rival
  humeante o sobrecargado se lee de un vistazo y se castiga. Verificado en el
  juego real (Playwright headless: la insignia aparece al enganchar la
  sobrecarga, con el color de calor).
- **2026-07-08** — ARMA TÉRMICA: EL OTRO LADO DEL CALOR (propuesta 9 —
  identidad extrema de armas — y el ejemplo estrella de la propuesta 1,
  "provocar sobrecalentamiento para inutilizar armas pesadas"). Nuevo tipo de
  efecto de habilidad `{ kind: 'heat', amount }`: en vez de tirar HP, VIERTE
  calor en el reactor del OBJETIVO, empujándolo hacia el atasco de armas y el
  apagado que ya existen. Cierra el bucle del calor en los dos sentidos (tu
  calor te atasca a ti; ahora puedes forzar el del rival). Decisiones de diseño:
  · El calor vertido es un rider GARANTIZADO (no tira azar propio): así el
    golden master queda intacto —los monocasco no tienen reactor que cocer, el
    efecto sale sin tocar el RNG— y el arma es una presión FIABLE, su identidad.
  · Primera arma: 🔥 Lanzallamas de plasma (biblioteca, `lib-plasma-flamer`):
    daño mínimo (16) + mucho calor (26), alcance 2. Reconocible sin ficha: es
    el arma tras la que el enemigo empieza a humear y se le atascan las armas.
    Híbrida a propósito (lleva daño) para que la IA la use como ofensiva (el
    planificador clasifica por el efecto de daño); contra monocasco es solo su
    daño mínimo — es un anti-reactor de nicho, no un arma general.
    Corre caliente también para el TIRADOR (coste de calor): usarla alimenta tu
    propio riesgo de sobrecarga.
  Fiel al núcleo: efecto declarativo nuevo (no un sistema), evento reutilizado
  (`heat-changed` con razón 'weapon'), sin que ninguna capa conozca a otra. 5
  tests nuevos (incluido el arma REAL cociendo un reactor +26 pase o no el
  daño), 290 en verde, golden intacto, tsc limpio. Cliente: línea de registro
  "es COCIDO" y verificado que el arma se equipa, aparece y se dispara en el
  juego real sin errores.
- **2026-07-08** — SUPRESIÓN: LA PRIMERA SINERGIA DE ESCUADRA (propuesta 6,
  "supresión para que otro aliado remate"; versión enfocada). Nuevo estado
  `suprimido` — la máquina, fijada por fuego, mantiene la cabeza gacha:
  · apunta peor (−15 de puntería, vía statusModifiers, como cualquier estado);
  · y NO PUEDE REACCIONAR — ni contraatacar ni disparar en vigilancia. Esto
    último lo resuelve Battle leyendo el estado compartido en reactionStrike y
    en overwatchShots (misma vía que el 'stunned'); ninguna capa nueva, ningún
    sistema conoce a otro.
  Es la primera mecánica pensada para el ESCUADRÓN y no para la unidad suelta:
  una máquina fija al rival (que deja de morder al que se acerca) y otra entra
  a rematar SEGURA. Genera la historia "lo clavé para que mi pesado entrara sin
  comerse el contraataque". Primera arma: 🔫 Ráfaga de supresión
  (`lib-suppressor`): daño mínimo (20) + 'suprimido' al 80%, cargador de fuego
  sostenido. Híbrida (lleva daño) para que la IA la use. 6 tests nuevos
  (incluye los controles: sin supresión SÍ hay contraataque y vigilancia), 297
  en verde, golden intacto, tsc limpio. El estado se lee solo en ficha y
  registro (vía STATUS_DEFINITIONS). Pendiente/aplazado: que la IA COORDINE la
  supresión (hoy la usa como daño flojo con el estado de regalo) y las demás
  sinergias (romper blindaje antes del golpe pesado ya emerge del sistema de
  placas; designación de objetivos, fuego concentrado).
- **2026-07-08** — CONTROL DEL CAMPO: CASILLAS DE FUEGO (propuesta 7). Un arma
  incendiaria PRENDE su zona de impacto; quien CIERRA su turno sobre fuego se
  quema. Diseño vetado por un flujo de diseño+crítica adversarial (workflow de
  subagentes) antes de tocar código. Reglas:
  · El fuego es estado dinámico de casilla (`Tile.fire`), reutilizando el
    precedente de demolish/raze; el agua y los muros NO prenden (huir al agua
    apaga el fuego bajo los pies). Decae un turno por RONDA (determinista).
  · Interactúa con el eje de calor ya construido: el fuego VIERTE calor (+12)
    en el reactor de quien lo pisa —empujándolo hacia el atasco de armas y el
    apagado— además de un daño de brasas (5% de HP máx.) que muerde también a
    los monocasco. `fieldSystem` va al FINAL del bus: el calor del fuego se
    suma TRAS la disipación (lo arrastra al turno siguiente), para que el
    fuego amenace de verdad y no lo apague la ventilación el mismo turno.
  · Se crea con `AbilityDefinition.ignites` (propiedad declarativa, resuelta a
    nivel de casilla en executeAbility junto a demolish/raze — NO un efecto por
    víctima). Eventos nuevos (solo añadir): tile-ignited/tile-extinguished/
    unit-burned; el calor reutiliza heat-changed razón 'fire'.
  Golden-safe FUERTE (verificado byte-exacto por la crítica): sin arma que
  incendie, fieldSystem es no-op puro y no consume azar → los mapas del golden
  nunca arden. Corregido un bug que halló la crítica: el fuego NO quema
  cadáveres (guarda hp<=0) para no emitir un unit-destroyed doble si un DoT
  anterior tumbó a la unidad ese mismo cierre. Primera arma: 🔥 Mortero
  incendiario (napalm de área, alcance 6). 7 tests nuevos, 304 en verde, golden
  intacto, tsc limpio. Cliente: la casilla ardiendo se VE (brasa pulsante +
  llama) y el registro la nombra. (Verificación en motor: 34 objetivos legales
  y enterAbility correcto; el disparo incendiario en vivo no pudo escenificarse
  en el arnés headless —el pilotaje pasivo pierde la batalla antes— pero la
  mecánica y el objetivo están probados de forma determinista.)
- **2026-07-08** — CT COMO RECURSO / TEMPO + SOBREMARCHA (propuesta 4).
  REGENERADO EL GOLDEN MASTER (autorizado por el director): el coste del turno
  cambia de un umbral fijo con "refund" ad-hoc a TEMPO por acción. Diseño
  vetado por el flujo diseño+crítica adversarial. Reglas (todo determinista,
  cero azar nuevo — verificado: regenerar dos veces da byte-idéntico):
  · El turno cuesta CT_TURN_BASE (60) + el recargo de lo que cometes: mover
    +30, disparo/recarga/vigilancia estándar +40, arma pesada/boost +70. Así
    ESPERAR te adelanta (cuesta 60, bancas 40), un disparo normal es neutro
    (60+40=100=umbral) y mover+pesado te retrasa (160). Decisión nueva de
    ritmo, misma que el "compromiso" del reactor y la sobrecarga.
  · SOBREMARCHA (tecla X): un golpe ×1.5 AHORA a cambio de +100 de tempo (cedes
    tu próximo turno). No es un buff: es otro pacto. Reutiliza el powerMult que
    applyEffects ya tenía → NO consume azar extra. Solo en golpes (lanza si no).
  · Identidad del PESO: las armas pesadas declaran `ctCost` (cañón de
    partículas, martillo Gauss, pilote, hacha de plasma, railgun, morteros...):
    pegan fuerte, calientan Y te retrasan. Las ligeras/medias heredan el ligero.
  · El único punto de cobro sigue siendo executeWait (no hay BattleSystem
    nuevo); tempoSpent es un flag del turno como hasMoved. Corregido lo que
    halló la crítica: VIGILANCIA ahora cuesta tempo de acción (si no, salía más
    barata que disparar y regalaba un tiro reactivo); postura y sobrecarga
    siguen a tempo 0 a propósito (son acciones libres que no cierran el turno).
  Eventos nuevos (solo añadir): tempo-spent (por turno) y overdrive-used. La
  regeneración del golden es LEGÍTIMA: al cambiar el orden de turnos la batalla
  entera diverge (otras unidades actúan en otro momento → otros blancos, otros
  daños); no es una regresión, y se verificó que el motor sigue siendo
  determinista y que las batallas terminan. Cliente: la línea de turnos se
  REORDENA en vivo con lo comprometido + etiqueta "tempo N", y la sobremarcha
  se arma con X (anunciada en el registro). 9 tests nuevos, 313 en verde, tsc
  limpio. Verificado en el juego real (etiqueta de tempo y armado de X).
- **2026-07-08** — CONTINUIDAD EXPEDICIÓN↔COMBATE: el motor lo PERMITE
  (propuesta 10). La propuesta pide que el motor —sin conocer la campaña—
  permita transportar estado residual a la batalla. Implementado como campos
  OPT-IN en UnitSpawn: initialHeat, initialEnergy y ammo (munición por arma).
  Ausentes = de fábrica (calor 0, energía llena, cargadores llenos) → golden
  byte-idéntico (verificado). Acotados a [0,max] con saneo de NaN (helper
  initClamp: un guardado corrupto cae a fábrica, no propaga basura — endureci-
  miento que pidió la crítica). El calor residual entra a tope SIN apagar el
  turno 1 (se acota a max, no por encima). Interactúa con lo ya construido sin
  tocar sistemas: calor residual = riesgo de atasco/apagado (heat+strain),
  energía baja = penalización y vetos (energy), cargador a medias = veto de
  arsenal. 6 tests nuevos, 319 en verde, tsc limpio. PENDIENTE (capa de
  campaña, no motor): que la liquidación de batalla grabe el estado residual de
  los supervivientes y el despliegue lo relea — con enfriado/reabastecimiento
  en el taller para evitar la "espiral de la muerte" que señaló la crítica. Es
  diseño de campaña con implicaciones de balance; se hará en su propia pasada.
- **2026-07-08** — INERCIA / PERSONALIDAD MECÁNICA (propuesta 11): APLAZADA.
  El propio director avisa del riesgo de "síndrome del simulador", y el flujo
  de diseño+crítica lo confirmó: la inercia-de-movimiento (giro, derrape,
  aceleración) es complejidad por complejidad; la única versión mínima
  planteada (masa que resiste el empuje) refina un efecto ya nicho —el
  knockback ni siquiera dispara en el golden— y su "decisión nueva" es la más
  débil de las 11. No entra: la identidad de las máquinas ya la dan sus stats,
  su reactor (o su ausencia), su peso de tempo (ctCost) y sus armas. Se revisará
  solo si aparece una regla mínima que genere una decisión de verdad.
- **2026-07-08** — REVISIÓN ADVERSARIAL del lote entero (flujo de subagentes:
  4 lentes —determinismo/golden, interacciones, desacoplo/eventos, cliente— con
  verificación adversarial de cada hallazgo). Confirmó 3 bugs reales, ya
  corregidos con test de regresión:
  · SOBRECARGA repetible reinyectaba calor: al ser acción libre, re-emitir
    `overclock on:true` ya sobrecargado volvía a cobrar el tirón de +15 (doble
    clic = calor gratis hacia un apagado no querido). Arreglo: strainSystem veta
    el enganche redundante (no-op ⇒ ilegal), así el tirón solo se cobra en la
    transición real.
  · Muertes por SISTEMAS (fuego, apagado del reactor, DoT) no degradaban la red
    de mando: solo la muerte por arma llamaba a afterDestruction. Un comandante
    quemado/apagado no dejaba a su equipo sin coordinación. Arreglo: Battle
    centraliza la consecuencia (linkCommandDeaths tras runSystems); golden-safe
    (ningún comandante del golden muere por estas vías).
  · La SOBREMARCHA armada (cliente) se filtraba: vigilar cerraba el turno sin
    resetear el flag. Arreglo: reset en doOverwatch y, como red de seguridad, en
    advance() (nunca cruza de turno/unidad). Verificado en el juego real.
  Un 4º hallazgo (el veto de calor bloquearía un contraataque) resultó FALSO
  POSITIVO (el reflejo no paga calor). 321 tests en verde, golden intacto.
- **2026-07-08** — "APLICA LO PENDIENTE" (dirección del usuario): cerrados los
  tres cabos que dejé apuntados. Tres bloques:
  · BALANCE — pasada con datos (npm run balance:hangar). Cuatro chasis melee/
    voladores frágiles morían el 86-95% y ganaban <42% (cerrar bajo fuego + el
    tempo pesado los frena): +HP y +evasión medidos a storm-sworder, rev-raptor,
    pteras y guysak. Suelo sano en 42.9%, sin débiles; único borde fuerte
    liger-zero 58.7% (marginal, no se toca). pteras está en el golden → su buff
    REGENERA el golden (dato, determinismo verificado byte-idéntico).
  · IA — valoraba solo el daño directo: infravaloraba el arma térmica, la
    incendiaria y el supresor, y caminaba sobre el fuego. Ahora valora el arma
    completa (cocer un reactor —desbordarlo = apagado = oro—, incendiar,
    suprimir), remata al SUPRIMIDO (no contraataca) y al COCIDO, y evita cerrar
    turno sobre fuego. Golden-safe: fuera del golden no hay fuego/calor/supresión
    /reactores enemigos, así que su IA no cambia (verificado byte-idéntico).
  · CONTINUIDAD, CAPA DE CAMPAÑA — el motor ya lo aceptaba; ahora la campaña lo
    USA. Al liquidar una batalla, cada SUPERVIVIENTE graba su estado residual
    (calor, energía, munición en cargador) en el roster (OwnedZoid.residualHeat/
    residualEnergy/ammo). Al desplegar la SIGUIENTE batalla se relee por
    initialHeat/initialEnergy/ammo: entras como saliste (caliente, con el
    cargador a medias). Una JORNADA DE DESCANSO hace refit (refitZoid: el
    reactor se enfría, se reabastece) — es lo que impide la espiral de la
    muerte. Retro-compatible (campos opt-in; guardados viejos, iguales) y
    golden-safe (el golden no toca la campaña). Verificado en el juego real: un
    Liger con calor residual 80 despliega a 80/100 y humea de salida.
  327 tests en verde (+6 desde la revisión), tsc limpio, golden regenerado
  (balance) y por lo demás intacto.
- **2026-07-08** — IA MÁS PROFUNDA: ESCUADRA + EMBOSCADA (dirección del usuario:
  "¿puedes hacer que la IA aprenda / sea más profunda?"). Aclaración honesta: el
  "aprendizaje" tipo ML rompería el determinismo/replays/golden del motor; lo
  que SÍ encaja —y aporta mucho más aquí— es una IA COORDINADA (y, en el futuro,
  adaptación de campaña: enemigos que traen contras a tu estilo, heurística
  determinista). Implementado el salto de profundidad:
  · FUEGO CONCENTRADO: cada unidad calcula el mismo FOCO de escuadra (función
    pura del estado — presa rematable / ya debilitada / que más aliados
    alcanzan) y sesga su ataque hacia él. Coordinación EMERGENTE sin memoria
    compartida: convergen solos, deterministas. Antes cada unidad peleaba
    aislada; ahora concentran para cerrar presas.
  · EMBOSCADA: un centinela sin tiro este turno, al ver venir a un enemigo MÁS
    agresivo (asimetría que garantiza que el más agresivo de cada pareja SIEMPRE
    avanza → nunca hay doble-vigilancia mutua ni empate por estancamiento), se
    queda en VIGILANCIA en vez de caminar a ciegas. Estrena la vigilancia en la
    IA (antes solo la usaba el jugador): 11 emboscadas en las batallas del
    golden nuevo.
  Determinista (verificado byte-idéntico) y las batallas siguen terminando
  (sin empates por estancamiento). REGENERA EL GOLDEN (mejora intencional de IA;
  ambos equipos la usan, es simétrica). 6 tests de IA (foco, emboscada,
  agresivo-no-embosca + los previos). BALANCE: el fuego concentrado premia a los
  pegadores (esperado y simétrico), lo que ensanchó el abanico; compresión de
  extremos alcanzable sin tocar el golden — gojulas atk 60→52 (dominaba con
  foco), storm-sworder evasión 38→44 (la evasión alta lo hace difícil de FIJAR).
  El resto de fuertes (gun-sniper, geno, liger-zero) están en el golden y
  reflejan la dinámica legítima "los pegadores rinden con coordinación"; no se
  tocan. 330 tests en verde, tsc limpio, verificado en el juego real.
- **2026-07-08** — LA FACCIÓN TE FICHA: ADAPTACIÓN DE CAMPAÑA ("vamos a ello").
  La forma de "aprendizaje" que SÍ encaja en un motor determinista: no ML, sino
  un DOSIER (conteos) que la facción enemiga acumula de tu estilo a lo largo de
  los contratos y usa para componer escuadras que te CONTRARRESTAN. Todo en la
  capa de campaña (src/game/mercenary.ts + src/web) → el motor de batalla no se
  toca, GOLDEN-SAFE por construcción; y es determinista (conteos + selección
  ponderada con la misma semilla).
  · DOSIER (CampaignState.dossier, opt-in): al liquidar cada batalla cuenta los
    golpes del jugador de cerca (alcance ≤1) vs de lejos (≥3) y las veces que
    enganchó la sobrecarga. readStyle() exige muestra (≥2 batallas / ≥4 golpes)
    antes de decidir 'melee' / 'ranged' / 'reactor' / 'balanced'.
  · CONTRAS (counterRoles): melee→sniper/flyer (kiters que castigan el rush);
    ranged→assault/skirmisher (cerradores); reactor→assault/skirmisher (presión
    temprana). contractOffers acepta un weightOf opcional que sesga la selección
    ponderada hacia esos roles (sin él, generación IDÉNTICA a antes → tests y
    partidas viejas intactos).
  · HISTORIA: el tablero de contratos muestra la inteligencia ("te han fichado
    peleando de cerca: esta escuadra trae más fuego a distancia"). El enemigo
    deja de ser aleatorio y RESPONDE a cómo juegas.
  Retro-compatible (dossier ausente = no adapta), golden-safe. 3 tests nuevos
  (dosier/readStyle, counterRoles, sesgo determinista de contractOffers), 333 en
  verde, tsc limpio. Verificado en el juego real: con dosier 'melee', las
  escuadras ofertadas se llenan de voladores y francotiradores y sale el aviso.
- **2026-07-08** — ADAPTACIÓN: CONTRAS POR ARMA + TABERNA ("de una"). Segundo
  escalón de la adaptación de facción:
  · CONTRA POR ARMA (no solo por chasis): a los "especialistas" de la escuadra
    enemiga (índices pares) se les monta un arma de biblioteca que castiga tu
    estilo — counterWeapons(): reactor→🔥 lanzallamas/incendiario (te cuecen el
    reactor), melee→supresor (te FIJAN al cargar: sin contra ni vigilancia),
    ranged→mortero de humo (sobreviven tu hostigamiento). Las armas 'lib-w-*'
    no tienen mountSlot: caben en cualquier chasis, y la IA (que ya valora
    calor/supresión) las USA. La frase de inteligencia lo canta: "se han
    hartado de tus reactores forzados — vienen con LANZALLAMAS para cocerte".
  · TABERNA: tavernJob acepta el mismo weightOf; los trabajos sucios también
    se adaptan (antes solo los contratos oficiales).
  Golden-safe (capa de campaña), retro-compatible (sin dosier, loadouts de
  fábrica). 1 test nuevo (counterWeapons), 334 en verde, tsc limpio. Verificado
  en el juego real: con dosier 'reactor', un enemigo entra a la batalla con el
  Lanzallamas de plasma montado. Futuro real restante: memoria de dosier POR
  FACCIÓN (exige contratos etiquetados por facción).
- **2026-07-08** — CURVA DE DIFICULTAD AMPLIA (dirección del usuario: "no soy
  una máquina… no es un Dark Souls; que sea satisfactorio pero que cueste"). La
  IA genio desde el minuto uno es injusta: su profundidad ahora es el TECHO de
  una curva, no el suelo. Nuevo `BattleConfig.aiSkill` (0..1, por defecto 1 =
  plena → golden idéntico) que ESCALONA la competencia de la IA:
  · < 0.35: grunts torpes, cada uno a lo suyo (sin fuego concentrado).
  · ≥ 0.35: coordina el fuego (foco de escuadra).
  · ≥ 0.65: además EMBOSCA (vigilancia).
  Y la adaptación de facción sigue la misma curva (capa de campaña): contras por
  CHASIS desde skill 0.45, contras por ARMA (lanzallamas) desde 0.7. La campaña
  calcula el skill con `campaignAiSkill()` = contratos cumplidos/15 + desfase de
  dificultad (cadete −0.2 espabila tarde; mercenario 0; leyenda +0.35 arranca ya
  coordinada). Así el jugador APRENDE contra grunts, siente la coordinación
  hacia el contrato ~5, la emboscada ~10 y la máquina completa (coordina +
  embosca + te ficha + te trae lanzallamas) solo al final, con un buen roster.
  El desgaste (wear) ya escalaba con la dificultad; ahora también la INTELIGENCIA.
  Golden-safe (defecto 1), 2 tests nuevos (skill bajo NO concentra ni embosca),
  336 en verde, tsc limpio. Verificado en el juego real: mismo dosier 'reactor',
  a contractsDone 0 el enemigo NO trae lanzallamas ni sale el aviso; a 12 (skill
  0.8) sí. Satisfactorio: cuesta, pero se aprende antes de que apriete.
- **2026-07-09** — 100 CONTRATOS: VALIDAR Y AFINAR EL ARCO (dirección del
  usuario: "hagamos 100 contratos"). Construido un SIMULADOR de campaña
  (scripts/campaign-sim.ts) que juega N contratos seguidos —jugador competente
  (IA a tope, skill 1) contra la curva + adaptación— y reporta la tasa de
  victoria por decenas y dificultad. Tres modos que ACOTAN la experiencia:
  `campaign` (arco realista: el roster CRECE por tramos y toma encargos acordes
  a su progreso), `meta` (roster de élite CONGELADO = el TECHO) y `frozen`
  (roster de arranque congelado = el SUELO). Cada decil junta 10·REPEATS
  batallas (6 semillas) para una lectura estable, no anecdótica.
  El simulador DESTAPÓ dos fallos que el ojo no veía:
  · La FUERZA no tenía músculo pasado 1.0: la escuadra enemiga son siempre 4
    unidades y el relleno gastaba mal el presupuesto (compraba 4 skirmishers
    baratos y DESPERDICIABA el resto), así que un final con roster de élite era
    un paseo (90% de victorias). Arreglo: `fillSquad` (extraído y compartido por
    contractOffers y tavernJob) ahora GASTA el hueco —afinidad de precio ∝
    (precio/hueco)²— de modo que un contrato rico trae ÉLITES, no chatarra. La
    caza de élite (presupuesto 7200) por fin se siente de élite, y la fuerza
    importa hasta el final. (Sin sesgo ni fuerza, retro-compatible: los tests de
    composición y de escalado por tramo siguen en verde.)
  · La rampa de destreza era demasiado ESTRECHA (contratos/15: precisión total
    hacia el contrato 15, media partida) y la fuerza tenía MESETA temprana
    (0.6→1.3 y plano). Reajuste hacia una GLIDE ANCHA: `campaignAiSkill` pasa a
    contratos/25 (la maestría es el final del arco, no su mitad) y
    `campaignStrength` a 0.55 + c/45 con techo 1.6 (floja al empezar, SIN meseta,
    apretando de verdad al final).
  ENVOLVENTE validada (mercenario): TECHO (élite desde el día 1) 80% al principio
  → la curva lo alcanza → 48% al final (no se compra la partida); SUELO (nunca
  mejoras) 57% → se desmorona a 12-17% (hay que invertir); REALISTA (mantienes el
  paso) una banda de 45-65% de principio a fin. Eso es "amplia, satisfactoria,
  pero que cuesta". Todo en la capa de campaña + una constante del cliente →
  GOLDEN-SAFE (verificado byte-idéntico) y el override de skill por equipo en
  planTurn es opt-in (por defecto = el de la batalla = 1). 2 tests nuevos
  (glide de campaignStrength; la fuerza compra chasis mejores), 338 en verde,
  tsc limpio, cliente arranca sin errores.
- **2026-07-09** — QUE EL DAÑO LOCALIZADO SE VEA (dirección del usuario: "haz que
  el daño localizado se vea"). El sistema de frames —impactos por zona, blindaje
  por placa que se arranca, secuela al perder una pieza, desbordamiento al núcleo—
  solo lo tenían 2 de 25 chasis (Liger CAS, Geno CP), así que la mayoría de
  batallas eran de barra de HP única. El director eligió la opción B: frames a
  MEDIDA para 7 chasis comunes, con IDENTIDAD legible.
  · Chasis: Liger Zero, Command Wolf, Gun Sniper, Gojulas, Iron Kong, Pteras y
    Geno Saurer. Cada uno con su carácter: el Gojulas guarda el HP en un TORSO
    grueso, el Iron Kong lleva la MOCHILA de misiles a la espalda (rear-exposed
    ×2), la Pteras tiene ALAS frágiles y fáciles de acertar (rómpele un ala y
    pierde evasión/vuelo), al Gun Sniper la COLA-sensor le da la puntería, al Geno
    el CAÑÓN de partículas es su pegada energética.
  · Convención NUEVA (coexiste con la de "núcleo desnudo" del CAS): el chasis
    conserva sus stats base COMPLETAS y el módulo es CARCASA pura (`struct` en
    data/modules.ts: contributions [], armor 0 para no mitigar doble). La
    identidad la dan el reparto de HP, las tags, el hitWeight y la SECUELA
    (onDestroyed): sin patas frenas y desapuntas, sin ala no esquivas, sin cañón
    pierdes tu pegada. El HP de las piezas SUMA el maxHp (lo exige el motor).
  · Arreglado un fallo REAL que el frame masivo destapó: un chasis se despliega
    ya dañado (continuidad), pero el frame venía con las piezas LLENAS → el HP
    global (derivado de la estructura) se "curaba" al primer golpe. Nuevo
    `applyInitialDamage` reparte el daño de despliegue por las piezas
    (proporcional, núcleo ≥1), determinista.
  REGENERA EL GOLDEN (5 de los 7 están en la batalla de referencia; cada impacto
  ahora tira localización → azar nuevo, declarado y AUTORIZADO por el director).
  Verificado determinista byte-idéntico y que las batallas terminan (8-9 tiradas
  de localización y ~9 piezas destruidas por batalla del golden). BALANCE
  (balance:hangar): el blindaje por placa engordó a los duros —gojulas 59.5%,
  se recortó su placa (banda 54%)— y el meta se movió; zaber-fang subió a 61%
  (atk 40→37). Los 7 chasis con frame quedan en banda (43-56%). El cliente ya
  tenía el lector de casco: en batalla, Command Wolf y Gun Sniper YA se ven como
  piezas (10/40/15/15 y 8/30/16), no una barra. 9 tests nuevos (integridad de
  cada frame), 347 en verde, tsc limpio, verificado en el juego real.
  PENDIENTE (el otro frente del hueco nº1): la IA sigue CIEGA al arco —no
  flanquea ni protege su espalda—; darle eso es el siguiente salto.
- **2026-07-09** — NAVEGAR PINCHANDO EL MAPA (dirección del usuario). El mapa de
  expedición ya dibujaba los nodos y los tramos, pero solo se viajaba por la
  LISTA de rutas (botones). Ahora el destino se PINCHA directo en el mapa: los
  nodos vecinos alcanzables se resaltan (anillo verde, cursor de mano, título con
  las jornadas) y al clicarlos se viaja (equivale a su ruta). Respeta las reglas:
  sin suministros solo se marcan las rutas hacia la civilización (los demás
  quedan atenuados y no clicables), y los tramos rotos avisan del vadeo (+1 día).
  La lista de rutas SE MANTIENE (lleva el detalle de coste/relato y los enlaces
  interregionales de ferry/lanzadera, que van a otra región y no están en este
  mapa). Cambio solo de cliente (renderWorld + CSS de .wnode), sin tocar el motor
  de viaje. Verificado en el juego real: clicar 'Base Arcadia' viaja (Cruce del
  Río → Base Arcadia, Día 0 → 1). tsc limpio, 347 tests en verde.
- **2026-07-09** — EMBOSCADAS DE RUTA: peleas aleatorias al viajar (dirección del
  usuario: "enemigos fáciles y medio bobos… para aumentar exp"). Tras un tramo
  por tierra hay un ~35% (determinista por nodo+día) de EMBOSCADA: una chusma de
  2-3 grunts baratos (molga/guysak/rev-raptor) con la IA a `aiSkill 0.15` —flojos
  y BOBOS: cada uno a lo suyo, sin coordinar ni vigilar (la curva de destreza que
  ya teníamos, puesta al mínimo). Objetivo por defecto (derribar a todos). Sirve
  para CURTIR a los pilotos: la XP la reparte el flujo normal (renderXpSummary),
  que dispara para cualquier batalla. Sin emboscada en el HQ (refugio), ni en el
  nodo-objetivo (ya trae su batalla), ni sin party viva, ni en ferry/lanzadera
  (pasaje seguro), ni cuando el tramo ya trae una encrucijada (un evento por
  viaje). Nuevo `settleSkirmish` (sin contrato): persiste HP + residual de
  continuidad y las heridas igual que un contrato, da una chatarra menor de
  saqueo (30/derribo) y vuelve al mapa. `startBattle` acepta un `aiSkill` de
  brief (override de la curva). Solo cliente; el motor no se toca. Verificado en
  el juego: a los 5 viajes salta la emboscada —4 máquinas (con su daño arrastrado)
  contra 2 grunts— y se resuelve devolviendo al mapa. tsc limpio, 347 en verde.
- **2026-07-09** — EL CASCO, SOLO DEL SELECCIONADO (dirección del usuario: "solo
  si lo selecciono, así no ocupamos tanto espacio"). El panel de UNIDADES pintaba
  el DIAGRAMA de casco (silueta + módulos) de CADA zoid framed, y con el reparto
  de frames a 9 chasis eso llenaba la columna. Ahora el diagrama sale solo para el
  zoid SELECCIONADO —por defecto el que tiene el turno—; el resto va compacto
  (nombre + barras) con una pista '▸ ver casco'. Clic en cualquier tarjeta la abre
  (y la cierra al reclicar, volviendo al activo); un seleccionado muerto cae de
  vuelta al activo. Uno a la vez → caben todas las unidades en la misma altura que
  antes ocupaban 3 diagramas. Solo cliente (renderRoster + CSS .ucard). Verificado
  en el juego: 1 diagrama visible, clicar P2 lo mueve a P2. tsc limpio, 347 verde.
- **2026-07-12** — LA FUSIÓN DE LAS DOS LÍNEAS DE TIEMPO. La rama del
  relevo (Opus 4.8, 33 commits: terreno vadeable, mundo con secretos,
  desgaste, blindaje por partes, reactor/tempo/supresión/fuego,
  IA de escuadra con curva y adaptación, frames en 9 chasis, simulador
  de campaña) se fusiona con la nuestra (IA que se retira y vigila,
  escuelas activas ✦, repeticiones 📼, tutorial, núcleo universal,
  cartas del destacamento). Decisiones de la costura:
  · IA unificada: valorador de arma completa (calor/supresión/fuego) +
    olfato de escolta (+40 al protegido); la vigilancia de cobertura
    nuestra queda SUJETA a las reglas de la emboscada de Opus (curva de
    destreza + asimetría de agresión) — sin doble-vigilancia mutua y
    los grunts siguen bobos.
  · Repeticiones: TODAS las acciones nuevas (sobrecarga, sobremarcha)
    pasan por execTracked; la receta graba además wear y aiSkill (el
    desgaste cambia los impactos: sin él la repetición divergiría).
  · Panel de unidades: cartas ricas (piloto, ✦, munición, sellos,
    telemetría solo propia) + el casco SOLO del seleccionado; un clic
    localiza en el mapa Y despliega el casco.
  · Spawns de campaña: biografía del núcleo + búnker de refuerzo +
    continuidad residual + escuelas del piloto, todo en el mismo spawn.
  · Tutorial: 8 pasos (nuevo: el tempo y el pacto del reactor).
  REGENERADO EL GOLDEN MASTER (declarado): las dos ramas lo habían
  regenerado por caminos distintos (tempo/frames vs reacciones/IA); el
  fusionado une ambas IAs y los 9 frames. Verificado determinista
  (regenerar dos veces = byte-idéntico). 365 tests en verde (la suma de
  las dos suites), tsc limpio, verificado en el juego real: tutorial
  1/8, ✦ Embestida, casco del seleccionado, tempo en la línea de
  turnos, sobrecarga con tecla O e insignia, batalla completa con
  repetición, y el viaje pinchando el mapa. Cero errores de consola.
- **2026-07-12** — TALLER DE CONTENIDO ("créame un editor de personajes,
  habilidades, campañas"). La mesa del director, dentro del juego (menú
  de inicio → 🛠 Taller de contenido), con la validación pura en
  src/game/taller.ts: NADA de lo creado a mano puede colar basura a una
  batalla (todo se acota; lo irrescatable se descarta en silencio).
  · PERSONAJES: los 4 pilotos editables de arriba abajo — nombre,
    escuela principal/secundaria, XP por pista y básica, estrés, días
    de baja y olvido de manías. Toca a la tripulación viva.
  · HABILIDADES: crear/editar habilidades propias (prefijo tx-, nunca
    pisan contenido de fábrica): alcance, forma, área, precisión, usos
    por batalla, tempo, incendiaria y hasta 3 efectos (daño, curación,
    estado, calor al reactor). Se OTORGAN por piloto al desplegar —la
    misma vía que las de escuela (extraAbilityIds)— y salen en la barra
    con su cupo ✦. El motor no distingue: le llegan por el catálogo.
  · CAMPAÑAS: contratos propios (txc-) que aparecen SIEMPRE en el
    tablero del cuartel marcados 🛠 — tipo (caza/escolta/asalto/
    incursión/defensa: cada uno ya se juega distinto), recompensa,
    chatarra y escuadra enemiga de hasta 4 chasis del catálogo.
  · ARCHIVO: exportar/importar el taller entero como JSON (validado).
  Bug real arreglado por el camino: las pantallas de debajo (tablero de
  contratos) se pintaban al arrancar y el cierre del taller no las
  refrescaba — closeTaller ahora repinta cuartel/mapa. 370 tests en
  verde (5 nuevos del taller), tsc limpio, verificado en el juego real:
  crear habilidad → otorgarla → verla con ✦1 en batalla; crear contrato
  → verlo 🛠 en el tablero; renombrar piloto → persistido.
- **2026-07-12** — LAS CUATRO BÁSCULAS + EL INVENTARIO DEL REBRANDING
  (dirección: "4 tiers de chasis, de lo extraligero a lo extrapesado" y
  "lista completa de elementos a cambiar"; rumbo de lore: más mecánico
  que animal, con base bestial — el camino del cañón de cuatro patas).
  · CLASES DE PESO (core/types.ts WeightClass): extraligero / ligero /
    pesado / extrapesado, con el ROL como subcategoría. Los 25 chasis
    clasificados en data (4/9/7/5). Vocabulario genérico: el motor no
    gana palabras de universo.
  · CON DIENTES (core/physics.ts): el empuje respeta la báscula — el
    EXTRAPESADO no lo mueve un cañonazo (como las bestias 2×2) y el
    EXTRALIGERO sale volando UNA CASILLA MÁS si el camino sigue libre
    (muros y ocupantes lo frenan en la primera). Golden-safe verificado:
    el knockback no dispara en las batallas de referencia. La Molga del
    test de balística ahora vuela dos casillas: el test lo celebra.
  · UI: el selector del garaje agrupa por báscula (▖▚▜█), los dos
    selectores de compra enseñan [báscula], el análisis del cursor y las
    cartas del hangar dicen «▜ pesado · asalto».
  · docs/RENOMBRES.md: inventario COMPLETO del rebranding anti-Zoids
    por báscula — 22 chasis IP + 4 pilotos del anime + 3 armas/módulos
    + la palabra «Zoid» en ~6 textos visibles; con columnas en blanco
    para que la dirección bautice y el plan del bloque de aplicación.
  374 tests en verde (4 nuevos de báscula), tsc limpio, verificado en el
  juego real (optgroups del garaje y báscula en el análisis).
- **2026-07-12** — EL RELOJ DE EXPEDICIÓN ("agrega paso del tiempo, un
  reloj; cada trayecto cuesta, cada decisión y batalla consume; siempre
  puedes descansar o esperar"). El tiempo deja de ser solo un contador
  de jornadas: ahora tiene HORAS y se mueve con todo lo que haces.
  · MOTOR DE CAMPAÑA (game/expedition.ts, puro): hour (0-23) en el
    estado; advanceHours devuelve los días cumplidos al cruzar la
    medianoche — y la campaña los convierte en el tick diario de
    siempre (curación, refit, destacamentos). hoursUntilDawn para la
    acampada. Guardados viejos: sin hora = amanecer (07:00).
  · COSTES: la marcha llega a las 17:00 (se sale al alba); cada batalla
    (contrato, taberna o emboscada) consume 3 horas, anotadas en el
    diario; cada decisión de encrucijada, 1 hora. La derrota que pierde
    la expedición se lleva su diario consigo — como debe ser.
  · SIEMPRE EN EL MAPA: «⏳ Esperar 2 horas» y «🛏 Acampar hasta el
    alba (+1 suministro)» — la acampada es descanso DE VERDAD (cura,
    enfría reactores, avanza destacamentos) y sin raciones no se acampa
    (consecuencia anunciada en el botón).
  · INSIGNIA: 🌅 alba / ☀ día / 🌆 tarde / 🌙 noche + hora en punto, en
    la cabecera del mapa junto al clima. La noche todavía no muerde
    (sensores/niebla siguen aplazados): el terreno queda listo.
  380 tests en verde (6 nuevos del reloj), tsc limpio, verificado en el
  juego real: migración, esperar, acampar (día+1, ración −1) y las 3
  horas de una emboscada real grabadas en el diario (hora 17→20).
- **2026-07-12** — COMBATE NOCTURNO CON NIEBLA DE SENSORES ("agrega
  combate nocturno, ahí sí pongamos niebla" — la dirección levanta el
  aplazamiento de la niebla, SOLO para la noche). El reloj manda: las
  batallas entre las 21:00 y las 05:00 son nocturnas.
  · MOTOR (BattleConfig.night): cada máquina emite una burbuja de
    sensores (vision, por defecto NIGHT_VISION_BASE=6) COMPARTIDA por su
    equipo — el enlace táctico ilumina para todos (el explorador
    adelantado da solución de tiro al tirador de atrás). Fuera de la
    burbuja NO se ve ni se puede apuntar: veto en legalTargets (ejecutar
    es ilegal) y en canTargetFrom (IA, vigilancia y ⌖ planean con la
    posición hipotética). De día, motor idéntico: GOLDEN INTACTO.
  · OJOS DE LA NOCHE (data): König Wolf visión 9 (cazador nocturno);
    Gun Sniper/custom (cola-sensor) y los tres voladores, 8.
  · IA: solo DISPARA a lo visible (foco, emboscada y vigilancia
    incluidos), pero AVANZA por el rumor de los motores — la niebla no
    congela la batalla en un empate ciego.
  · CLIENTE: la niebla se pinta (casillas apagadas en plana y mesa,
    tinte azul nocturno en el diorama), el enemigo oculto no existe —
    ni chip en el campo, ni ficha (un eco «?? fuera de sensores»), ni
    nombre en la línea de turnos («??») —, el análisis calla sobre
    casillas a oscuras, la barra anuncia 🌙 NOCTURNO y la receta de la
    repetición graba la noche. En escaramuza, toggle «🌙 noche».
  · La espera del reloj gana su primer uso táctico real: acampar hasta
    el alba ANTES de entablar combate evita la noche — o al revés, se
    busca a propósito.
  386 tests en verde (6 nuevos de noche), tsc limpio, golden intacto,
  verificado en el juego real (plana y diorama, ecos que se despejan al
  acercarse, toggle de escaramuza persistido).
- **2026-07-12** — LA BIBLIA DEL UNIVERSO (la dirección entrega el canon
  y nombra Lead Game Designer / Narrative Director / World Designer).
  Prathama (la Primera Civilización caída), Sarvatantra (el Estado que
  censura en nombre de la estabilidad), Āryam (los ocultos del legado
  genético). Regla primera: «GEA es primero un videojuego» — Gameplay >
  Narrativa > Lore, y cada idea responde «¿hace mejor al juego?».
  Todo en docs/LORE.md, incluidos: el mapeo de sistemas YA hechos que
  ahora son canon (ruinas=Prathama, núcleos=tecnología incomprendida,
  dosier=vigilancia del Estado, crónica=manuscrito del jugador), cinco
  propuestas con veredicto (fragmentos coleccionables, la segunda
  moneda de la censura, el arco de cierre «El Archivo», las tres
  señales de Āryam, la nomenclatura burocracia/taller que alimenta
  RENOMBRES) y los guardarraíles de escritura (voz de documento, sin
  monólogos expositivos, UNA línea de horror cósmico por juego).
- **2026-07-12** — EL MUNDO ABIERTO ("amplía el mundo: más que una
  pantalla de selección de mapa, algo más grande y abierto — se siente
  limitado"). El grafo de nodos se convierte en GEOGRAFÍA:
  · TERRITORIO (game/overworld.ts, puro): cada región es una rejilla
    continua 36×24 determinista — dunas donde manda la arena, verde
    donde llueve, relieve, lagunas — y las viejas aristas del diseño se
    TALLAN como caminos visibles y baratos de andar: la conectividad
    diseñada queda garantizada, pero ya no es una jaula.
  · VIAJE LIBRE: se pincha CUALQUIER punto transitable. Primer clic
    propone (cinta con la ruta A* punteada, horas de marcha, hora de
    llegada y 🌙 si llegarás de noche); segundo clic parte. El reloj
    cobra las horas, las jornadas cumplidas comen raciones (marcha
    forzada si no hay), y también se puede acampar en mitad de la nada.
  · TODO nodo visible con ruta es destino — se acabó "solo vecinos".
    En campo abierto (`at: campo:x,y`) hay Esperar y Acampar; los nodos
    conservan sus acciones (taller, explorar, ciudad).
  · AVISTAMIENTOS: lo oculto entra al mapa al pasar a ≤3 celdas (⚑ en
    el diario). Explorar es literalmente ANDAR el territorio — la
    exploración de las ruinas de Prathama hecha geografía (LORE §3).
  · EVENTOS DE TRAMO (legEvent, extraído de travel() y compartiendo sus
    mesas): hallazgos, tormentas que te siguen y encrucijadas en las
    marchas largas; las emboscadas de ruta saltan igual que siempre —
    verificado VIVO: una marcha de 12 h acabó en emboscada real.
  · Los transportes interregionales (ferry/lanzadera) siguen como
    estaban; los puentes rotos mueren como mecánica (el terreno manda).
  394 tests en verde (8 nuevos del overworld), tsc limpio, golden
  intacto, verificado en el juego real: terreno pintado, 9 destinos
  desde un nodo, viaje libre con reloj, ciudad lejana en un clic,
  avistamiento de la Cripta de Sal y emboscada en ruta.
- **2026-07-12** — LA INTERFAZ DESPIERTA ("dame algo más bonito; se ve
  tan genérica, tan oscura y apagada — ¿le puedes meter ganas?"). Pasada
  estética completa SIN traicionar el tono (LORE: serio y melancólico no
  es muerto — es consolas que brillan en la penumbra):
  · PALETA: fondo con profundidad (gradiente atmosférico + rejilla de
    consola + viñeta fija), acentos con voltaje y un ÁMBAR DE CABINA
    nuevo (--accent) para lo que importa: objetivos, contratos, cupos.
  · IDENTIDAD: el logo GEA arde en gradiente cian→verde→ámbar; los
    títulos de pantalla igual; cada panel lleva cabecera con banda de
    luz y su marcador ▮ ámbar.
  · TACTO: botones con relieve, glow y respuesta (hover se enciende y
    levanta); cartas de contrato/garaje que se alzan al pasar; barras
    de HP/energía/calor como instrumentos (gradiente + brillo + venda
    animada al cambiar).
  · HUD: la barra de objetivo es una cinta ámbar de misión; el banner
    de turno lleva gradiente por bando; el tablero y el territorio del
    mundo van enmarcados con viñeta interior y borde luminoso.
  Solo CSS (page.html): cero cambios de lógica, textos intactos (los
  asserts de Playwright siguen en verde), reduced-motion respetado.
- **2026-07-30** — LA LEY DEL CASCO ("me están matando de un tiro; debe
  ser algo medio: puedo cagarla un poco pero puedo recuperarme").
  Diagnóstico con datos (sonda del alfa): en las primeras batallas hubo
  9 derribos de UN golpe — el Mordisco universal multiplicado por el
  ataque de los pesados borra un ligero entero sin ventana de reacción.
  Eso rompe el pilar del juego: castigo sí, sentencia no.
  · LA LEY (core/combat.ts): MAX_HIT_FRACTION = 0.7 — ningún impacto
    limpio puede superar el 70% del casco MÁXIMO del objetivo. El
    primer golpe siempre deja máquina para retirarse, eyectar o
    responder; el SEGUNDO sí mata. Simétrica: también protege a la IA.
    El daño acumulado, el fuego de casilla y la caída de módulos quedan
    fuera de la ley — la muerte por desgaste sigue siendo negocio.
  · UN SOLO PUNTO: el tope se aplica en el único punto de daño de
    battle.ts (el dado se tira ENTERO: mismo consumo de azar, los
    replays antiguos no se corrompen) y en attackPreview — el
    pronóstico ANUNCIA el tope, nunca promete de más. El instructor
    la enseña en el paso 3 del tutorial.
  · REBALANCE MEDIDO (balance:hangar, ~300 batallas por pasada, 3
    pasadas): la ley beneficia a los gordos lentos (nadie los borra) y
    castiga a los cañones de un tiro, así que se compensó: Gran
    Brontes atk 60→48 (el jefe inicial muerde, no ejecuta), zaber-fang
    atk 37→33 y speed 14→13, gojulas/gordos maxHp 160→175 y atk 40→46,
    iron-kong maxHp 190→210 (con ik-nucleo 78→98: los módulos SUMAN el
    casco, invariante respetado), pteras evade 28→33, gustav atk
    20→28. Banda final sana: centro 46–58%, fuertes marginales dibison
    58.8 y naomi 58.2 (vigilar), débiles conocidos y aceptados
    rev-raptor 40.2 (cristal en manos de la IA greedy) y brachios 40.0
    (soporte que la métrica de winrate infravalora).
  · La fracción es UN número en UN sitio: si el medio se queda corto o
    largo en Early Access, se gira 0.7 y listo.
  GOLDEN REGENERADO (declarado: la ley cambia todo derribo temprano) y
  verificado byte-idéntico en doble regeneración. 398 tests en verde
  (4 nuevos de la ley: tope anunciado, el golpe absurdo no mata desde
  casco entero, el segundo sí, pronóstico acotado).
- **2026-07-30** — EL CUARTEL DE PILOTOS ("quiero que sea posible reclutar
  gente: en el bar, una agencia gubernamental, salvarlos en eventos —haz
  varios, extra dificultad mejor piloto— o que aparezcan solicitando").
  La compañía deja de ser cuatro sillas fijas: hay PLANTILLA (hasta 8) y
  BANQUILLO, y se decide quién tripula cada máquina.
  · EL CREW (cliente): cada hueco P1-P4 tiene su piloto ASIGNADO
    ('gea-crew-v1'); el resto espera en el banquillo, viaja con la
    caravana (descansa, se estresa y se cura como todos) y RELEVA en el
    cuartel — un herido ya no bloquea su máquina: se sienta otro.
  · CUATRO VÍAS (game/barracks.ts, puro y determinista):
    1. TABERNA — gente sin verificar, barata, por (ciudad, ciclo); la
       capital siempre tiene a alguien con horas de cabina.
    2. AGENCIA DE COLOCACIÓN (ciudades nivel 2+, puerta propia en la
       plaza) — pilotos certificados del Estado: caros, formados, y "el
       sello no dice para quién informan" (Sarvatantra sin decirlo:
       LORE §2 — la vigilancia entra en tu nómina; veta futura).
    3. RESCATES EN RUTA (3 encrucijadas nuevas): el cerco al repetidor
       (combate fácil → CURTIDO), el convoy-prisión de los clanes
       (combate duro o 4 suministros → VETERANO; asaltarlo cuesta
       Chatarreros −10) y la cabina de élite entre carroñeros (combate
       MUY duro → AS). La regla pedida es LEY: el tier del combate ES la
       calidad del recluta, y el riesgo va anunciado en el botón. Sin
       sitio en plantilla, su gremio salda la deuda en créditos.
    4. ASPIRANTES — tras cerrar contratos, a veces alguien llama a la
       puerta del cuartel (determinista por ciclo; la fama sube la
       probabilidad). Gratis: se acepta o se despide.
  · CALIDADES novato/curtido/veterano/as: XP de firma por debajo del
    umbral siguiente (llegan hechos pero con carrera); los de oficio
    llegan con su escuela YA elegida. Nombres/frases PROVISIONALES
    (RENOMBRES-safe, la dirección repoblará con LORE.md).
  · Guardados viejos migran solos: fundadores intactos, crew por
    defecto, reclutas (rec-*) del almacén.
- **2026-07-30** — EL PRONÓSTICO DE REACCIÓN ("dame más info del enemigo
  antes de atacarlo: que sepa si hay riesgo de que reaccione o no").
  El contraataque dejaba de ser sorpresa solo después de comértelo.
  · counterForecast (motor): espeja EXACTAMENTE las condiciones de
    reactionStrike (adyacencia, reacción lista, ni aturdido ni
    suprimido, arma pagable a bocajarro) y estima el tiro instintivo
    con la MISMA cuenta de puntería del disparo real (hitContext con la
    orientación PREVISTA tras encarar) al 60% de potencia y con la ley
    del casco. Solo lectura: cero azar consumido, golden intacto.
  · opportunityRisk (motor): quiénes te clavarían el tiro de
    oportunidad si te despegas hasta esa casilla.
  · UI: el pronóstico de disparo añade UNA línea — "⚠ si sobrevive,
    CONTRAATACA: arma · % · daño" o "✓ no reaccionará: <motivo>" —, la
    carta del enemigo en reposo canta "reacción LISTA/gastada", y el
    modo mover avisa del tiro de oportunidad antes de pisar la casilla.
  409 tests en verde (11 nuevos: 5 del pronóstico, 6 del cuartel),
  golden intacto, verificado VIVO con Playwright: banquillo y relevo en
  el cuartel, aspirante alistado, taberna y agencia contratando en
  Espejo del Norte, y el pronóstico cantando "no reaccionará: fuera de
  su alcance de reacción" junto al daño.
- **2026-07-31** — EL TRASLADO CON NIEBLA Y LOS HITOS DEL CAMINO ("debe
  haber una dirección de viaje y un traslado; en ese traslado hay niebla
  y conforme se avanza se van viendo cosas — además de los eventos,
  elementos puntuales dignos de exploración que acarrean peleas o
  decisiones que afectan los puntos de facción").
  · LA NIEBLA DEL TERRITORIO (overworld.ts): la compañía tiene una CARTA
    DE RUTAS —los caminos y los lugares conocidos— y el campo abierto es
    niebla (~75% del mapa al empezar). Máscara de bits hexadecimal por
    región, PERSISTENTE en la campaña: lo visto, visto se queda.
  · EL TRASLADO: el primer clic sigue proponiendo (dirección de viaje,
    cinta con horas/ETA) y el segundo parte — pero ahora la marcha
    VENTEA todo el corredor (radio de vista por celda del camino), la
    caravana se ve recorrerlo (animación, respeta reduced-motion), los
    lugares ocultos se avistan DESDE cualquier punto del trayecto (antes
    solo desde el destino) y el diario canta lo que asoma.
  · LOS HITOS (overworld siembra, game/landmarks.ts resuelve): 7 por
    región, deterministas, en campo abierto y dormidos bajo la niebla.
    Cinco clases PROVISIONALES: pecio de guerra (desguazar Chatarreros−
    / avisar Chatarreros+), campamento de asaltantes (COMBATE; al
    vencer botín y Colonos+), antena de los Primeros (registrar botín+
    estrés / vender coordenadas Gremio+ — Prathama sin nombrarla, LORE
    §1), caravana asediada (COMBATE fácil; ignorar Colonos−: estas
    cosas se saben) y santuario del camino (velar estrés− / saquear
    botín y Colonos−). Toda consecuencia ANUNCIADA en el botón; los
    combates de hito se cierran AL VENCER (si pierdes, el hito sigue en
    la carta y se vuelve con más hierro). Llegar a un hito ES el evento
    de esa marcha: no se apila con encrucijadas.
  · ARREGLO de paso: loadExpedition rechazaba los guardados en campo
    abierto (at='campo:x,y') — recargar en mitad de la nada PERDÍA la
    expedición. Ahora un guardado en el campo es tan válido como uno en
    un nodo.
  416 tests en verde (7 nuevos de territorio: máscara, carta inicial,
  siembra de hitos, cartas anunciadas, combates deterministas), golden
  intacto, verificado VIVO: niebla 75%→61% tras una marcha, cinta de
  propuesta, llegada al santuario con su carta, diario con «en el
  camino asoma», y el asalto al campamento lanzando combate real (3
  enemigos).
