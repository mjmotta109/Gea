# Gea — Motor + juego de simulación táctica profunda

Juego táctico por turnos que combina el flujo de **Final Fantasy Tactics** (CT, casillas, posicionamiento, facing) con la profundidad mecánica de **Armored Core / BattleTech**: unidades compuestas por módulos, daño localizado, energía y calor como recursos, munición finita, control del campo y una IA que se adapta a cómo juegas. El contenido usa temática **Zoids**, pero el núcleo es genérico. Ya no es solo un motor: sobre él corre un **juego de campaña** completo (contratos, economía, taller, pilotos, expediciones).

> 📐 **[docs/DESIGN.md](docs/DESIGN.md)** — arquitectura del motor y plan de fases (0-5; solo percepción avanzada queda aplazada).
> 🎮 **[docs/GAME-DESIGN.md](docs/GAME-DESIGN.md)** — visión, filosofía y TODAS las decisiones de diseño fechadas (§7).
> 🤝 **[docs/TRASPASO.md](docs/TRASPASO.md)** — léelo PRIMERO si retomas el desarrollo: estado actual y próximo paso.

El motor es **determinista y agnóstico del renderizado**: toda la simulación vive en TypeScript puro sin dependencias, se comunica mediante eventos (`BattleEvent`), y cualquier cliente (web, Godot, terminal, servidor) puede consumirlo. Un `golden master` byte-exacto vigila que el determinismo no se rompa.

## Probarlo ya

```bash
npm install
npm test              # 338 tests (vitest) — motor + juego + golden
npm run demo          # batalla IA vs IA en terminal, Enter entre turnos
npm run demo:auto     # la batalla entera de un tirón
npm run web           # genera dist/web/gea.html — el JUEGO en un solo archivo, sin red
npm run balance:hangar               # 300 duelos 4v4 IA-vs-IA, marca outliers de balance
npx tsx scripts/campaign-sim.ts 100  # simula el ARCO de 100 contratos (curva de dificultad)
```

## Mecánicas de batalla

**Movimiento y posición (herencia FFTA)**

- **Grid con alturas** y terreno (llanura, abrupto, agua, muro), mapas en ASCII (`src/data/maps.ts`). El terreno es **destructible**.
- **Turnos por Charge Time**: cada unidad carga CT según su velocidad. El coste del turno es **TEMPO**: base + recargo de lo que cometes (mover, arma pesada, sobremarcha) — esperar te adelanta, comprometerte te retrasa.
- **Turno = mover + actuar + facing**, en cualquier orden. **Sobremarcha** (×1.5 de golpe cediendo tu próximo turno): otro pacto, no un buff.
- **Facing y arcos**: golpear por flanco/espalda da bonus de precisión y daño; desde arriba bonifica, desde abajo penaliza. **Línea de visión** y **cobertura** del terreno para los disparos.
- **Reacciones y vigilancia** (overwatch), retirada y eyección del piloto, refuerzos por oleadas, jefes multi-casilla (2×2).

**Profundidad de máquina (Armored Core / BattleTech)**

- **Unidades compuestas por módulos** (`frame.ts`): daño **localizado** por pieza, blindaje por placas que se arrancan (queda EXPUESTA), penetración de proyectil y desbordamiento al núcleo. Tabla de impacto sesgada por arco y altura.
- **Recursos activos**: **energía** y **calor** en los chasis con reactor (sobrecarga, atasco de armas por calor, apagado), **munición** finita por arma. Los síntomas son **legibles** en la ficha y el registro.
- **Control del campo**: armas **incendiarias** que prenden casillas — quien cierra su turno sobre fuego se quema y se calienta (el fuego vierte calor al reactor). Armas **térmicas** que cuecen, **supresoras** que te fijan (sin contra ni vigilancia) y **humo** que rompe la línea de tiro.
- **Dos tipos de daño** (físico/blindaje y energético/escudos) con stats separadas; estados componibles.
- **RNG con semilla**: misma semilla ⇒ misma batalla. Base de replays, tests y golden.

**IA de combate** (`src/ai/simpleAi.ts`)

- Evalúa la mejor combinación de movimiento + acción valorando el arma completa (daño, calor, supresión, incendio), no solo el daño directo.
- **Coordinada**: fuego concentrado (foco de escuadra emergente, sin memoria compartida) y **emboscada** (vigilancia). Su profundidad está **escalonada por una curva de dificultad**: los grunts pelean torpes, la maestría es el TECHO del arco, no el suelo.

## El juego (campaña)

Sobre el motor corre un juego de mercenario mecánico (`src/game/`, cliente en `src/web/`):

- **Contratos y economía**: tiers de encargo (escolta → asalto → caza → incursión → defensa), chatarra por derribo, taller/garaje para reparar, reforzar blindaje, comprar chasis y montar armas.
- **La facción te ficha**: un **dosier** determinista aprende tu estilo (cuerpo a cuerpo / a distancia / reactor) y compone escuadras que te **contrarrestan** — por chasis y por arma (te traen lanzallamas si abusas del reactor).
- **Curva de dificultad amplia**: la competencia de la IA y la fuerza del enemigo suben suave con los contratos; validada a 100 contratos (banda 45-65% si mantienes el paso, sin muros de Dark Souls).
- **Expediciones** con atlas (regiones, clima, encrucijadas, reputación de facciones, ciudades-lugar), **pilotos** con árbol de habilidades, manías, estrés, terapia y heridas, y **hoja de servicio** del chasis con cicatrices.
- **Continuidad**: sales de una batalla como entras a la siguiente (calor/energía/munición residual); una jornada de descanso repone.

## Los Zoids como "jobs" (~25 chasis)

Cada chasis (`src/data/zoids.ts`) define stats, tipo de movimiento y habilidades:

| Zoid | Rol | Perfil |
|---|---|---|
| Liger Zero | Asalto | Rápido, melee devastador (Strike Laser Claw) |
| Command Wolf | Escaramuza | Equilibrado, cañón medio + humo |
| Gojulas | Tanque | Lento, mucho HP, misiles en área |
| Gun Sniper | Francotirador | Frágil, rifle en línea de largo alcance |
| Pteras | Volador | Ignora terreno, hoja aturdidora |
| Gustav | Soporte | Drones de reparación, buffs |
| Geno Saurer CP | Asalto pesado | Reactor + cañón de partículas; frame por módulos |
| Molga | Grunt | Barato, carne de cañón |

Añadir un Zoid, arma o habilidad es tocar solo los catálogos de datos (`src/data/`), no el motor. La **biblioteca de armas** anexa (montables en cualquier chasis) se documenta en [docs/WEAPON-LIBRARY.md](docs/WEAPON-LIBRARY.md).

## Arquitectura

```
src/
  core/            El motor puro (sin dependencias, determinista)
    types.ts       Tipos, acciones y eventos compartidos
    rng.ts         RNG determinista (mulberry32)
    grid.ts        Mapa, terrenos, alturas, parser ASCII
    los.ts         Línea de visión y cobertura
    pathfinding.ts Dijkstra de movimiento, rangos y áreas
    combat.ts      Fórmulas: arcos, precisión, daño
    frame.ts       Unidad compuesta: módulos, daño localizado, blindaje
    physics.ts     Balística/empuje descriptivos
    status.ts      Estados y su expiración
    systems.ts     BattleSystems (calor/strain, campo/fuego, vetos)
    wear.ts        Desgaste de combate por dificultad
    turn.ts        Sistema de CT/tempo y forecast de turnos
    battle.ts      Orquestador: valida acciones, corre sistemas, emite eventos
  game/            Capa de campaña (mercenario, economía, dosier) — pura
  data/            Contenido (Zoids, habilidades, armas, mapas, economía)
  ai/              IA de sparring y de campaña
  web/             Cliente monolito (genera dist/web/gea.html)
  demo/            Demo ASCII en terminal
tests/             Suite de vitest (+ golden master byte-exacto)
scripts/           Herramientas: build web, balance:hangar, campaign-sim
```

El contrato con el exterior es pequeño y todo pasa por eventos:

```ts
const battle = new Battle({ map, spawns, unitCatalog, abilityCatalog, weaponCatalog, moduleCatalog, seed });
battle.nextTurn();                        // → BattleEvent[]
const unit = battle.getActiveUnit()!;
battle.legalMoves(unit.id);               // opciones de movimiento con caminos
battle.legalTargets(unit.id, abilityId);  // objetivos válidos
battle.execute({ type: 'ability', ... }); // → BattleEvent[] para animar
battle.execute({ type: 'wait', unitId: unit.id, facing: 'north' });
```

Los `BattleEvent` son la fuente de verdad para el renderer: describen todo lo que pasó (movimientos con camino completo, daños por módulo, calor, fuego, estados, destrucciones) para animarlo o reproducirlo.

## Estado y frontera

Fases 0-5 del motor completadas (composición, daño localizado, recursos, balística, IA con mando); solo la percepción avanzada (niebla/sensores) queda **aplazada por decisión del director**. El juego de campaña está jugable de punta a punta.

**Próximo movimiento de mayor palanca** (diagnóstico en `docs/TRASPASO.md`): **sacarle partido al daño localizado**. El sistema es profundo pero está medio dormido — solo 2 de ~25 chasis tienen `frame`, y la IA es ciega al arco (no flanquea ni protege su espalda). Enseñar a la IA a jugar el arco, gateado por la curva, convertiría el posicionamiento en un duelo de dos sin sistemas nuevos.

Aplazados por decisión del director (no reproponer): niebla de guerra/sensores y 3D real. Pendiente del director: encargar el arte ([docs/ENCARGO-ARTE.md](docs/ENCARGO-ARTE.md)).
