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
  reconocible a 46px (felino, lobo, raptor, terópodo, oruga, caracol,
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
