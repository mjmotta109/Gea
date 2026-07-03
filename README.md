# Gea — Motor táctico estilo FFTA con temática Zoids

Base de un RPG táctico por turnos inspirado en **Final Fantasy Tactics Advance**, donde los "jobs" son chasis de **Zoids**. Es un remake espiritual: tomamos las mecánicas de FFTA como punto de partida para luego evolucionar hacia un juego propio.

El motor es **determinista y agnóstico del renderizado**: toda la simulación vive en TypeScript puro sin dependencias, se comunica mediante eventos, y cualquier cliente (PixiJS, Godot, terminal, servidor) puede consumirlo.

## Probarlo ya

```bash
npm install
npm test          # 32 tests del motor
npm run demo      # batalla IA vs IA, pulsa Enter entre turnos
npm run demo:auto # la batalla entera de un tirón
```

## Mecánicas implementadas (herencia FFTA)

- **Grid con alturas**: tiles con terreno (llanura, abrupto, agua, muro) y altura. Los mapas se definen en ASCII (`src/data/maps.ts`).
- **Turnos por Charge Time**: cada unidad carga CT según su velocidad; al llegar a 100 actúa. Terminar el turno sin moverse o sin actuar devuelve CT (vuelves antes). Hay `forecast()` para pintar la timeline de turnos en la UI.
- **Turno = mover + actuar + facing**: una vez cada uno, en cualquier orden, y al esperar eliges hacia dónde miras.
- **Facing y arcos de ataque**: golpear por el flanco o la espalda da bonus de precisión y daño, como en FFTA.
- **Altura en combate**: atacar desde arriba bonifica el daño; desde abajo penaliza.
- **Movimiento con salto**: `move`/`jump` por chasis, coste doble en terreno abrupto, agua solo para voladores/anfibios, los voladores ignoran alturas. No se atraviesan enemigos; los aliados sí, pero no puedes terminar sobre ellos.
- **Dos tipos de daño**: físico (blindaje) y energético (escudos), con stats de ataque y defensa separadas.
- **Habilidades data-driven**: rango mín/máx, forma (single/línea), área de efecto, precisión, y efectos componibles (daño, curación, estados).
- **Estados**: sobrecalentamiento (daño por turno), blindaje reforzado, evasión mejorada, aturdimiento (pierde el turno).
- **RNG con semilla**: misma semilla ⇒ misma batalla. Base para replays, tests y multijugador.
- **IA básica** (`src/ai/simpleAi.ts`): busca la mejor combinación de movimiento + ataque, o avanza hacia el enemigo. Sirve de sparring y de referencia.

## Los Zoids como "jobs"

Cada chasis (`src/data/zoids.ts`) define stats, tipo de movimiento y habilidades, cubriendo los roles clásicos:

| Zoid | Rol | Perfil |
|---|---|---|
| Liger Zero | Asalto | Rápido, melee devastador (Strike Laser Claw) |
| Command Wolf | Escaramuza | Equilibrado, cañón medio + humo |
| Gojulas | Tanque | Lento, mucho HP, misiles en área |
| Gun Sniper | Francotirador | Frágil, rifle en línea de largo alcance |
| Pteras | Volador | Ignora terreno, hoja aturdidora |
| Gustav | Soporte | Drones de reparación, buffs |
| Geno Saurer | Asalto pesado | Cañón de partículas que sobrecalienta |
| Molga | Grunt | Barato, carne de cañón enemiga |

Añadir un Zoid o habilidad nueva es tocar solo los catálogos de datos, no el motor.

## Arquitectura

```
src/
  core/            El motor puro (sin dependencias)
    types.ts       Tipos compartidos, acciones y eventos
    rng.ts         RNG determinista (mulberry32)
    grid.ts        Mapa, terrenos, alturas, parser ASCII
    pathfinding.ts Dijkstra de movimiento, rangos y áreas
    combat.ts      Fórmulas: arcos, precisión, daño
    status.ts      Estados y su expiración
    turn.ts        Sistema de CT y forecast de turnos
    battle.ts      Orquestador: valida acciones, emite eventos
  data/            Contenido (Zoids, habilidades, mapas)
  ai/              IA de sparring
  demo/            Demo ASCII en terminal
tests/             Suite de vitest
```

El contrato con el exterior es pequeño:

```ts
const battle = new Battle({ map, spawns, zoidCatalog, abilityCatalog, seed });
battle.nextTurn();                        // → BattleEvent[]
const unit = battle.getActiveUnit()!;
battle.legalMoves(unit.id);               // opciones de movimiento con caminos
battle.legalTargets(unit.id, abilityId);  // objetivos válidos
battle.execute({ type: 'ability', ... }); // → BattleEvent[] para animar
battle.execute({ type: 'wait', unitId: unit.id, facing: 'north' });
```

Los `BattleEvent` son la fuente de verdad para el renderer: describen todo lo que pasó (movimientos con camino completo, daños, estados, destrucciones) para poder animarlo o reproducirlo.

## Roadmap sugerido

- [ ] **Renderer**: cliente PixiJS/canvas isométrico consumiendo `BattleEvent`
- [ ] **Progresión**: experiencia, niveles, y aprendizaje de habilidades (estilo AP de FFTA)
- [ ] **Piloto + Zoid**: separar piloto (crece) de chasis (se equipa), con arsenal intercambiable (CAS del Liger Zero)
- [ ] **Más profundidad táctica**: línea de visión para disparos, ataques de oportunidad, empuje/knockback
- [ ] **Reacciones y pasivas**: contraataques, habilidades de soporte equipables
- [ ] **Modo campaña**: mapa del mundo, misiones, clan/equipo persistente
- [ ] **Leyes/jueces de FFTA** → reinterpretar como "reglas de combate" de torneos Zoids
- [ ] **IA seria**: evaluación de amenaza, focus fire, uso de coberturas y soporte
- [ ] **Multijugador**: el determinismo por semilla ya permite lockstep/replays
