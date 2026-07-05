# Gea — Diseño de evolución: de motor táctico FFTA a simulador táctico profundo

> **Estado**: aprobado como dirección del proyecto · **Última revisión**: ✅ fase 0 completada
>
> Este documento es la fuente de verdad de la migración. Cada fase se marca al
> completarse y las decisiones que se tomen por el camino se anotan aquí.

## 1. Visión

Gea deja de ser únicamente un sucesor espiritual de Final Fantasy Tactics
Advance. El flujo de turnos por CT, el movimiento por casillas y el
posicionamiento siguen siendo la columna vertebral — esa claridad no se
negocia — pero la profundidad mecánica evoluciona hacia la familia
**Armored Core / BattleTech / simulación militar**: unidades compuestas por
módulos, daño localizado, energía y calor como recursos activos, munición
finita, sensores, y personalización donde dos chasis idénticos pueden
comportarse de forma completamente distinta según su configuración.

> **Relación con el juego**: el motor se mantiene genérico, pero las
> prioridades las dicta el primer juego (ver
> [GAME-DESIGN.md](GAME-DESIGN.md)). Solo se generaliza una mecánica
> cuando el juego la necesita y funciona: el motor se extrae del juego,
> no al revés. Toda mecánica nueva debe pasar antes el filtro del
> §5 de GAME-DESIGN.md (decisión nueva, historias emergentes,
> profundidad vs complejidad, rebanada mínima, coste arrastrado).

### Principios innegociables

1. **CT se mantiene** tal cual: velocidad → carga → turno al llegar a 100.
2. **Movimiento por casillas** se mantiene.
3. **Determinismo por semilla**: toda la aleatoriedad pasa por `Rng`; misma
   semilla ⇒ misma batalla, siempre. Ningún sistema nuevo puede usar otra
   fuente de entropía ni depender del orden de iteración de estructuras no
   deterministas.
4. **IA reproducible**: la IA decide solo a partir del estado de batalla y
   del `Rng` compartido.
5. **Modularidad**: cada sistema nuevo es un módulo desacoplado que se puede
   activar, desactivar y testear por separado.
6. **El núcleo es genérico**: nada en `src/core/` sabe qué es un Zoid. Los
   Zoids son *contenido* y viven en `src/data/`. El motor debe poder simular
   mechas, tanques, infantería o naves sin tocar el core.
7. **Evolución, no reescritura**: cada fase compila, pasa los tests y deja el
   juego jugable. Lo existente no se rompe.

## 2. Análisis del código actual

### 2.1 Inventario

| Módulo | Qué hace | Estado para la migración |
|---|---|---|
| `core/rng.ts` | RNG determinista (mulberry32) | ✅ Se mantiene tal cual. Única fuente de entropía. |
| `core/turn.ts` | CT + forecast, desacoplado vía `SpeedLookup` | ✅ Se mantiene. La velocidad ya se inyecta como función: las stats derivadas enchufan aquí sin tocar nada. |
| `core/pathfinding.ts` | Dijkstra con perfil `{move, jump, moveType, team}` | ✅ Se mantiene. Ya recibe un *perfil* y no una unidad: las stats recalculadas por daño a piernas entran por el mismo hueco. |
| `core/combat.ts` | Funciones puras: arcos, precisión, daño | 🔶 Se conserva como capa "estadística"; la fase 4 añade una resolución balística paralela que la reutiliza. |
| `core/grid.ts` | Mapa, tiles `{terrain, height}`, parser ASCII | 🔶 Extensible: los tiles necesitan propiedades de material (fase 3) con defaults derivados del terreno actual. |
| `core/status.ts` | 4 estados hardcodeados con bonus en funciones | 🔴 Se generaliza a un sistema de modificadores data-driven (fase 0). |
| `core/battle.ts` | Orquestador: turnos, validación, efectos, eventos | 🔴 Es el "casi-god-object" (~430 líneas). Se descompone en coordinador + hooks de sistemas (fases 0-2). |
| `core/types.ts` | Tipos compartidos | 🔴 `Stats` plano y `ZoidDefinition` en el core violan el principio 6. Se generaliza. |
| `data/*` | Catálogos de Zoids, habilidades, mapas | ✅ El patrón data-driven es exactamente el que se extiende. |
| `ai/simpleAi.ts` | IA greedy pura sobre la fachada `Battle` | 🔶 Se conserva como IA de referencia; la fase 5 añade perfiles de personalidad encima. |
| `demo/cli.ts` | Demo ASCII de punta a punta | ✅ Se convierte en el banco de pruebas visual de cada fase. |

### 2.2 Activos que hacen viable la migración

- **Cuello de botella único de stats.** Todas las lecturas de stats pasan por
  `battle.effectiveStats()` o `zoidOf(...).stats`. Hay ~10 sitios de lectura,
  todos localizables. Convertir `effectiveStats` en un *pipeline de stats
  derivadas* es el cambio de mayor palanca de todo el plan: una vez que todo
  lee de ahí, los módulos, el calor, la energía y el daño localizado solo
  tienen que aportar modificadores a ese pipeline.
- **Eventos tipados como contrato.** `BattleEvent` ya es la interfaz con el
  exterior. Los sistemas nuevos *añaden* tipos de evento; nunca cambian los
  existentes. Un renderer viejo ignora eventos que no conoce.
- **Funciones puras.** `combat`, `pathfinding` y `turn` no tienen estado:
  se pueden envolver, extender o sustituir sin efectos colaterales.
- **Determinismo testeable.** Ya existe un test que corre una batalla entera
  con semilla y verifica reproducibilidad. Se generaliza a *golden master*
  (§4.3): la red de seguridad de cada refactor.

### 2.3 Fricciones detectadas (auditadas contra el código)

1. **`Stats` es un bloque plano** (`maxHp, atk, energyAtk, def, energyDef,
   speed, move, jump, evade`). No hay noción de *origen* de cada punto de
   stat, así que no se puede expresar "las piernas aportan move=4 y si se
   destruyen lo pierdes".
2. **HP global único.** `UnitState.hp` es la única verdad de supervivencia.
   El daño localizado exige HP por módulo con el HP global como *derivado*.
3. **Tres lecturas esquivan `effectiveStats`**: la curación
   (`battle.ts:298`), el sobrecalentamiento (`battle.ts:333`) y la IA
   (`simpleAi.ts:47`) leen `zoid.stats.maxHp` directo. La fase 0 las
   canaliza por el pipeline — si no, el maxHp modificado por módulos
   desincronizaría curaciones e IA.
4. **`applyEffects` mezcla responsabilidades**: precisión, daño, curación y
   estados en un solo método privado. Cada recurso nuevo (energía, calor,
   munición) lo engordaría más. Se descompone en un pipeline de resolución.
5. **Estados hardcodeados**: `armor-up` suma +15 dentro de una función. No
   escalan a decenas de efectos de módulos/calor/terreno.
6. **Naming "Zoid" en el core**: `ZoidDefinition`, `zoidId`, `zoidOf` viven
   en `core/types.ts` y `core/battle.ts`. Migran a `UnitDefinition` /
   `unitTypeId` / `definitionOf` con alias de compatibilidad.
7. **`AbilityDefinition` es autocontenida**: sin coste de energía, sin calor,
   sin munición, sin arma asociada. Pasa a ser un caso degenerado (coste
   cero) del modelo de armas montadas.

## 3. Decisiones arquitectónicas

### 3.1 Composición con sistemas, no ECS purista

Un ECS completo (stores de componentes por id, scheduler de sistemas,
queries) está pensado para miles de entidades por frame en tiempo real. Gea
simula ~una decena de unidades en turnos discretos: el coste de un ECS
purista sería una reescritura total a cambio de nada medible. Se adopta el
punto intermedio que da las mismas propiedades (datos componibles, sistemas
independientes, cero herencia):

- **Entidad = `UnitState` con bolsa de componentes opcionales.** Una unidad
  *puede* tener `modules`, `energy`, `heat`, `sensors`... Si no tiene un
  componente, el sistema correspondiente la ignora. Así conviven unidades
  simples (las actuales) y unidades simuladas a fondo, en la misma batalla.

```ts
interface UnitState {
  // ... campos actuales ...
  components: {
    frame?: FrameState;        // módulos y daño localizado   (fase 1)
    energy?: EnergyState;      // generador y reservas        (fase 2)
    heat?: HeatState;          // temperatura y disipación    (fase 2)
    arsenal?: ArsenalState;    // armas montadas, munición    (fase 2)
    sensors?: SensorState;     // detección                   (fase 3)
    comms?: CommsState;        // red de mando                (fase 5, interfaz)
  };
}
```

- **Sistema = módulo con funciones puras + suscripción a hooks.** Nada de
  clases con estado propio: el estado vive en los componentes, el sistema es
  lógica.

```ts
interface BattleSystem {
  id: string;
  /** Hooks del ciclo de vida; todos opcionales, todos devuelven eventos. */
  onTurnStart?(unit: UnitState, ctx: SystemContext): BattleEvent[];
  onValidateAction?(action: BattleAction, ctx: SystemContext): ActionVeto | null;
  onActionResolved?(action: BattleAction, events: BattleEvent[], ctx: SystemContext): BattleEvent[];
  onTurnEnd?(unit: UnitState, ctx: SystemContext): BattleEvent[];
}
```

  `Battle` se reduce a: gestionar CT, validar la legalidad *estructural* de
  acciones, invocar los sistemas registrados **en orden fijo y determinista**
  (array, nunca un map sin orden) y acumular eventos. El sobrecalentamiento
  actual — hoy incrustado en `executeWait` — se convierte en el primer
  sistema migrado, como prueba del mecanismo.

### 3.2 Pipeline de stats derivadas (la clave de bóveda)

Toda stat pasa a calcularse así:

```
base (definición de unidad)
  → contribuciones de módulos vivos        (fase 1: piernas → move, cabeza → precisión…)
  → modificadores de estados                (fase 0: generaliza armor-up, evasion-up…)
  → penalizaciones de calor                 (fase 2)
  → penalizaciones de energía               (fase 2)
  = DerivedStats
```

```ts
interface StatModifier {
  source: string;              // 'module:left-leg', 'status:armor-up', 'heat:overload'
  stat: keyof DerivedStats;
  add?: number;                // aditivo
  mult?: number;               // multiplicativo (se aplican tras los aditivos)
}

function computeDerivedStats(unit: UnitState, ctx: DerivationContext): DerivedStats;
```

Reglas:
- **Orden de aplicación fijo**: aditivos por orden de registro del sistema,
  luego multiplicativos. Determinismo garantizado.
- **`effectiveStats()` se convierte en la fachada de este pipeline** y pasa a
  ser la ÚNICA vía de lectura de stats en todo el motor, IA y demo incluidas.
- Para una unidad sin componentes, `DerivedStats == stats base`: la
  compatibilidad es automática, sin ramas especiales.

### 3.3 Compatibilidad por envoltura, no por bifurcación

Las definiciones actuales (`ZoidDefinition` con stats planas) se adaptan
automáticamente al modelo nuevo mediante una envoltura *monocasco*: un frame
de un solo módulo (el casco) cuyo HP es el maxHp actual y que aporta todas
las stats base. Nada del contenido existente se toca; los tests actuales
siguen pasando sin modificación. El motor no distingue "unidad vieja" de
"unidad nueva": ve frames con más o menos módulos.

### 3.4 Los recursos son costes declarativos en las acciones

Las armas y acciones declaran costes; los sistemas los cobran:

```ts
interface ActionCosts {
  energy?: number;      // cobrado por EnergySystem
  heat?: number;        // añadido por HeatSystem
  ammo?: number;        // descontado por ArsenalSystem
  cooldownCt?: number;  // el arma no puede reusarse hasta pasar N ticks de CT
}
```

La validación de acciones consulta a los sistemas (`onValidateAction`):
sin energía ⇒ veto del EnergySystem; sin munición ⇒ veto del ArsenalSystem.
La IA no necesita lógica especial: pregunta al motor qué acciones son
legales, igual que hoy.

### 3.5 Balística como datos primero, física después

La petición explícita es *diseñar* la balística sin implementar proyectiles
reales todavía. El corte se hace así:

- **Ahora (fase 4)**: `ProjectileSpec` (velocidad, dispersión, penetración,
  calibre, masa, explosión, rebote, material) viaja en la definición del
  arma. La resolución sigue siendo instantánea y estadística, pero consume
  estos datos (penetración vs armadura del módulo, dispersión → precisión a
  distancia, radio de explosión → AoE) y emite un evento `projectile-fired`
  con trayectoria calculada (origen, impacto, tiempo de vuelo teórico).
- **Futuro**: un `ProjectileSimulator` alternativo puede resolver el mismo
  `ProjectileSpec` con vuelo real por el mapa. El contrato de eventos ya lo
  soporta: el renderer anima la trayectoria desde el evento, sea calculada o
  simulada. Nada del código de fase 4 se tira.

### 3.6 Terreno como propiedades de material

`Tile` pasa de `{terrain, height}` a incluir un `MaterialProfile`
(resistencia, conductividad, fricción, cobertura, temperatura, humedad,
destructibilidad, firma sensorial). Los cuatro terrenos actuales se
convierten en *presets* de material, así el parser ASCII y todos los mapas
existentes siguen funcionando. Los sistemas consumen propiedades, nunca el
nombre del terreno: `HeatSystem` lee `tile.material.temperature`, no
`terrain === 'desert'`.

## 4. Plan de migración por fases

Cada fase: compila, `npm test` en verde, demo jugable, se mergea entera.
Ninguna fase depende de una posterior. El orden interno de cada fase lista
los PRs/commits naturales.

---

### ✅ Fase 0 — Fundamentos (sin cambio de comportamiento observable) — COMPLETADA

*Objetivo: crear los raíles sobre los que corre todo lo demás. Riesgo bajo,
valor estructural máximo.*

1. **Golden master**: test que corre 3 batallas completas con semillas fijas
   y compara el log de eventos serializado contra archivos de referencia.
   Es la red de seguridad de TODA la migración: cualquier refactor que
   cambie el comportamiento sin querer, lo detecta este test.
2. **Genericización del core**: `ZoidDefinition → UnitDefinition`,
   `zoidId → unitTypeId`, `zoidOf → definitionOf`, con alias `deprecated`
   para no romper imports. "Zoid" queda solo en `src/data/` y en la demo.
3. **Pipeline de stats derivadas** (§3.2): `core/derived.ts`. Los estados
   actuales (`armor-up`, `evasion-up`) se convierten en `StatModifier`
   data-driven; `status.ts` deja de tener números incrustados. Las 3
   lecturas que esquivan `effectiveStats` (§2.3.3) se canalizan.
4. **Bus de sistemas** (§3.1): `Battle` acepta `systems: BattleSystem[]`.
   El sobrecalentamiento se extrae de `executeWait` al primer sistema
   (`OverheatSystem`) como prueba del mecanismo.

**Hecho cuando**: golden master idéntico antes y después; cero referencias a
"zoid" en `src/core/`; los 32 tests actuales pasan sin modificarse.

**Resultado (2026-07-03)**: completada en 4 commits (golden master →
genericización → pipeline → bus de sistemas). Golden master idéntico en los
tres pasos de refactor. Desvíos del plan, anotados:
- Los tests existentes SÍ se tocaron, pero solo mecánicamente (renombrado
  `zoidId`→`unitTypeId`, `zoidCatalog`→`unitCatalog` en literales); ninguna
  aserción cambió. El criterio real de no-regresión lo cubre el golden master.
- `onValidateAction` recibe también la unidad actora además de la acción,
  y `SystemContext` expone `effectiveStats` + `units` en lugar de la Battle
  completa: contexto mínimo hasta que un sistema real pida más.
- El pipeline aplica `Math.round` y clamp a ≥0 al final; con el contenido
  actual (aditivos enteros) es un no-op, verificado por el golden master.

---

### ✅ Fase 1 — Unidad compuesta y daño localizado — COMPLETADA

*Objetivo: la unidad deja de ser un bloque de stats; el daño golpea módulos.*

1. **Modelo de módulos**:

```ts
interface ModuleDefinition {
  id: string;
  name: string;
  slot: SlotId;               // 'head' | 'torso' | 'arm-l' | 'arm-r' | 'leg-l' | 'leg-r'
                              // | 'tail' | 'generator' | 'sensors' | 'backpack'
                              // | 'weapon-1' | 'weapon-2' | 'aux' | ...
  hp: number;
  armor: number;              // reducción plana antes de dañar HP del módulo
  weight: number;             // consumido por estabilidad/energía en fases 2 y 4
  material: MaterialId;
  critical: boolean;          // si se destruye, la unidad muere (torso/núcleo)
  contributions: StatModifier[];  // qué aporta al pipeline mientras vive
  onDestroyed: StatModifier[];    // penalizaciones extra al destruirse
  tags: string[];             // 'locomotion', 'sensor', 'weapon-mount:weapon-1'...
}

interface FrameDefinition {
  id: string;
  slots: SlotId[];            // qué slots existen en este chasis (la cola es opcional aquí)
}

type Loadout = Record<SlotId, string /* moduleId */>;
```

2. **Localización de impactos**: tabla de pesos por slot, sesgada por arco
   (por la espalda es más fácil golpear mochila/generador) y desnivel (desde
   arriba, cabeza y torso; desde abajo, piernas). Tirada con el `Rng` común.
3. **Resolución de daño localizada**: daño → armadura del módulo → HP del
   módulo → *overflow* al torso. Módulo a 0 ⇒ `destroyed`, aplica
   `onDestroyed` y desactiva sus tags (arma montada en brazo destruido ⇒
   inutilizada; piernas ⇒ move/estabilidad; cabeza ⇒ sensores/precisión;
   generador ⇒ energía a cero cuando exista la fase 2).
4. **HP global pasa a ser derivado** (suma ponderada, para UI y para la IA
   actual) y la muerte pasa a ser "módulo crítico destruido". La envoltura
   monocasco (§3.3) mantiene el comportamiento actual exacto para unidades
   sin frame: un solo módulo crítico cuyo HP es el maxHp de siempre.
5. **Eventos nuevos**: `module-damaged`, `module-destroyed`,
   `hit-location-rolled`.
6. **Contenido**: 2-3 Zoids del catálogo se remodelan con frames completos
   como demostración (Liger Zero con CAS es el candidato natural); el resto
   sigue monocasco.

**Hecho cuando**: una batalla de la demo muestra piernas/armas destruidas
con efectos visibles; los Zoids monocasco se comportan idéntico al golden
master; tests de localización, overflow y contribuciones.

**Resultado (2026-07-04)**: completada en 2 commits (motor de frames →
contenido framed). Golden master intacto en ambos. Desvíos anotados:
- El monocasco se implementó como *ausencia* de frame (ruta de HP global
  clásica) en vez de materializar un frame de un módulo: mismo concepto,
  cero riesgo para el golden master.
- El overflow al núcleo transfiere solo el 50% del exceso menos la
  armadura del núcleo (regla estilo BattleTech). Con transferencia total,
  cualquier impacto grande mataba a la unidad a través de su módulo más
  débil y el daño localizado perdía el sentido.
- Nueva stat `accuracy` con signo (única exenta del clamp ≥0 del
  pipeline): corrección de puntería, negativa con sensores destruidos.
- El frame se define inline en la unidad (`frame: FrameSlotConfig[]`);
  el FrameDefinition separado con slots válidos queda para cuando la
  personalización (intercambio de módulos) lo necesite.
- Las versiones framed son IDs nuevos (`liger-zero-cas`, `geno-saurer-cp`)
  calibrados para rendir idéntico a sus monocascos intactos (test de
  equivalencia); las referencias del golden master siguen usando los
  monocascos originales.
- Pendiente de balance para fase 2+: el cañón de partículas (~100 daño)
  one-shotea torsos de 46-52 HP en impacto directo al núcleo; el daño de
  las armas pesadas y el reparto de HP por módulo necesitan la herramienta
  de simulación por lotes.

---

### ✅ Fase 2 — Recursos activos: energía, calor y munición — COMPLETADA

*Objetivo: cada acción tiene un precio; gestionar recursos ES el juego.*

1. **EnergySystem**: `EnergyState {capacity, current, outputPerTurn}` —
   producción al inicio del turno (del generador vivo), coste declarativo
   por acción (§3.4), movimiento con coste por casilla, acción `boost`
   (movimiento extra, coste alto). Energía a cero ⇒ veto a armas
   energéticas/boost y penalización defensiva vía pipeline.
2. **HeatSystem**: `HeatState {current, max, dissipationPerTurn}` — cada
   acción suma calor; disipación al final del turno según radiadores
   (módulos con tag `radiator`), clima y terreno. Umbrales: >70% precisión
   reducida, >85% movilidad reducida (modificadores en el pipeline), >100%
   apagado forzoso (reutiliza la semántica de `stunned`) y daño interno.
   El `overheat` de fase 0 se absorbe aquí como caso particular.
3. **ArsenalSystem**: las armas dejan de ser habilidades infinitas.

```ts
interface WeaponDefinition {
  id: string;
  ability: AbilityDefinition;   // reutiliza targeting/efectos actuales
  costs: ActionCosts;           // energía, calor, munición, cooldown
  magazine: number;             // disparos por cargador
  reserves: number;             // cargadores totales
  reloadCostCt: number;         // recargar consume turno/CT
  projectile?: ProjectileSpec;  // se rellena en fase 4
}
```

   Estado por instancia (`ArsenalState`): munición restante, cooldown, arma
   operativa o no (ligado al módulo que la monta). Nueva acción `reload`.
   Las habilidades innatas actuales (mordisco, garra) quedan como armas de
   coste cero y munición infinita ⇒ compatibilidad total.
4. **IA**: se enseña a la IA de referencia a no dispararse a la bancarrota
   energética (filtro de acciones vetadas — gratis, porque pregunta al
   motor) y a recargar cuando no tiene tiro.

**Hecho cuando**: en la demo se ve a un Geno Saurer gestionar el calor de su
cañón de partículas y a un Gun Sniper quedarse sin munición y recargar; el
golden master de unidades sin componentes sigue intacto.

**Resultado (2026-07-04)**: completada en 2 commits (sistemas → contenido +
IA). Golden master intacto. Desvíos anotados:
- El movimiento cuesta energía PLANA por acción (5), no por casilla: el
  coste por casilla exigía exponer el pathfinding a los vetos y no
  aportaba decisión táctica proporcional. El boost (20) es el movimiento
  "caro" real.
- El cooldown se cuenta en turnos propios, no en ticks de CT: mucho más
  simple de razonar para el jugador y para la IA; el conteo interno suma
  +1 porque el decremento de inicio de turno consume primero el turno del
  propio disparo.
- Los costes se cobran en onActionResolved de cada sistema (como pedía el
  diseño §3.4), pero reload/boost mantienen su mutación estructural en
  Battle (munición repuesta, posición) — los sistemas cobran recursos, la
  batalla resuelve acciones.
- El estado 'overheat' (DoT del cañón de partículas) se mantiene separado
  del recurso calor: son mecánicas distintas (daño interno persistente vs
  presión térmica gestionable). El DoT ahora daña el núcleo en unidades
  con frame.
- Semilla 30 de la demo para ver recarga/boost/cooldown; la 42 sigue de
  referencia para módulos.
- Confirmado el desequilibrio del cañón de partículas (fase 1): en la
  semilla 30 el Geno CP gana 4v4 sin un rasguño. La herramienta de
  balance por lotes sube de prioridad para la fase 3.

---

### Fase 3 — Percepción y terreno rico

*Objetivo: dejar de ver el mapa como costes de movimiento; dejar de ver al
enemigo gratis.*

1. **`MaterialProfile` en tiles** (§3.6) con presets para los terrenos
   actuales. Parser ASCII intacto; formato de mapa extendido opcional (JSON)
   para mapas con materiales explícitos.
2. **Línea de visión**: Bresenham 3D contra alturas + `cover` del material.
   Primera consecuencia táctica inmediata: los disparos ya no atraviesan
   colinas, y la cobertura reduce precisión. (Es el cambio de mayor impacto
   en la sensación de juego de toda la migración.)
3. **SensorSystem**: `SensorSuite {visual, radar, thermal, em}` por unidad
   (módulo con tag `sensor`); firma detectable por unidad (masa, calor
   actual — sinergia con fase 2); **clima** como estado de batalla (niebla ⇒
   visual↓, arena ⇒ radar↓, bosque ⇒ térmico↓). Conocimiento por equipo:
   memoria de últimas posiciones conocidas, determinista.
4. **IA sobre percepción**: la IA de referencia pasa de omnisciente a operar
   sobre `battle.knownEnemies(team)`. Mismo contrato, información filtrada.

**Hecho cuando**: en la demo, un Gun Sniper detrás de una colina es
inalcanzable e invisible hasta que alguien gana línea de visión; con niebla
la batalla se decide a corta distancia.

---

### Fase 4 — Balística descriptiva y preparación física

*Objetivo: resolver el combate con datos físicos, sin simular proyectiles
en vuelo todavía (§3.5).*

1. **`ProjectileSpec`** completo en las armas; la resolución estadística
   consume: penetración vs armadura+material del módulo (perforar ⇒ daño
   interno directo), dispersión creciente con distancia, radio explosivo ⇒
   AoE con caída radial, masa/calibre ⇒ empuje (hook para knockback).
2. **Evento `projectile-fired`** con trayectoria teórica (origen, impacto,
   tiempo de vuelo) — el renderer del futuro anima sin cambiar el motor.
3. **Interfaces de física** (`interfaces/physics.ts`): estabilidad (peso
   total vs piernas vivas), centro de gravedad, retroceso, empuje. Solo
   contratos + una implementación mínima de ejemplo (knockback de 1 casilla
   por impacto masivo contra unidad inestable) para validar que las
   interfaces sirven.
4. **Destructibilidad del terreno**: los materiales con `destructible: true`
   pueden degradarse (muro → escombros). Gancho consumido por explosiones.

**Hecho cuando**: las armas del catálogo tienen specs balísticas y los
números de daño salen de ellas; existe el evento de trayectoria; el
knockback de ejemplo funciona y está testeado.

---

### Fase 5 — IA con personalidad y arquitectura de mando

*Objetivo: que las unidades peleen distinto por quiénes son, no solo por lo
que montan.*

1. **`AIProfile`** data-driven:

```ts
interface AIProfile {
  aggression: number;      // 0-1: presionar vs esperar
  selfPreservation: number;// retirarse dañado, evitar overheat
  discipline: number;      // mantener posición/rol vs perseguir oportunidades
  riskTolerance: number;   // aceptar tiros de baja probabilidad, exponerse
  targetPriority: TargetHeuristic[]; // 'weakest' | 'closest' | 'support-first' | 'commander' ...
}
```

2. **IA por utilidad**: la greedy actual se reescribe como puntuación de
   utilidad donde el perfil pesa los términos (daño esperado, riesgo
   recibido, coste de recursos, valor posicional). Con perfil neutro ≈
   comportamiento actual. Mismo `planTurn(battle, unit)`.
3. **CommsSystem (solo arquitectura, como se pidió)**: `CommsState` (red de
   mando, quién es comandante, alcance de enlace), evento
   `command-link-lost`, y un único efecto mínimo demostrativo: perder al
   comandante aplica un modificador de precisión/coordinación vía pipeline.
   La coordinación real de escuadras queda para el futuro.

**Hecho cuando**: dos escuadras de composición idéntica y perfiles opuestos
(agresiva vs conservadora) producen batallas visiblemente distintas y
reproducibles por semilla.

---

## 5. Reglas transversales (aplican a todas las fases)

1. **Golden master siempre en verde** para unidades sin componentes nuevos.
   Si una fase cambia deliberadamente el comportamiento base, se regeneran
   los archivos de referencia en un commit propio que lo declare.
2. **Los eventos solo se añaden**, nunca se renombran ni cambian de forma.
3. **`index.ts` es la API pública**: lo exportado no se rompe; lo deprecado
   se marca y sobrevive al menos una fase.
4. **Ningún sistema conoce a otro sistema**: se comunican por componentes,
   modificadores del pipeline y eventos. (El HeatSystem no importa el
   EnergySystem; si el calor debe frenar la regeneración de energía, lo hace
   con un `StatModifier` sobre `energyOutput`.)
5. **Todo número de juego vive en `src/data/`** o en la definición del
   sistema como constante nombrada — nunca incrustado en la lógica.
6. **Iteración determinista**: arrays ordenados, nunca `Object.keys` sin
   ordenar ni `Map` cuyo orden dependa de la inserción variable.
7. **Cada fase actualiza este documento**: decisiones tomadas, desvíos del
   plan y el porqué.

## 6. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| El pipeline de stats se vuelve lento al recalcularse por lectura | Con ~10 unidades es irrelevante; si crece, cachear por unidad e invalidar al cambiar componentes (los puntos de mutación están centralizados en los sistemas). |
| Explosión combinatoria de balance (módulos × armas × calor × energía) | La demo automática + semillas fijas permiten simular miles de batallas por lote para detectar degeneraciones (herramienta de balance en fase 2+). |
| `Battle` vuelve a engordar con cada sistema | El bus de hooks (fase 0) es la barrera: si un cambio necesita tocar `battle.ts` en vez de un sistema, es una señal de diseño incorrecto. |
| La IA de utilidad (fase 5) se vuelve intesteable | Cada término de utilidad es una función pura testeada por separado; los perfiles son data. |
