import type { AttackArc } from './combat.js';
import type { Rng } from './rng.js';
import type {
  BattleEvent,
  FrameSlotConfig,
  FrameState,
  ModuleDefinition,
  ModuleState,
  StatModifier,
} from './types.js';

/**
 * Lógica de unidades compuestas (fase 1, docs/DESIGN.md):
 * construcción del frame, contribuciones de módulos al pipeline de stats,
 * tabla de localización de impactos y resolución de daño localizado con
 * armadura por módulo y desbordamiento al módulo crítico.
 *
 * Todo son funciones puras sobre FrameState; el único estado mutado es el
 * frame que se recibe. Battle orquesta y emite los eventos globales
 * (damage-dealt, unit-destroyed); aquí se emiten los de módulos.
 */

export type ModuleCatalog = Record<string, ModuleDefinition>;

export function moduleDef(catalog: ModuleCatalog, moduleId: string): ModuleDefinition {
  const def = catalog[moduleId];
  if (!def) throw new Error(`Módulo desconocido: ${moduleId}`);
  return def;
}

export function buildFrameState(config: FrameSlotConfig[], catalog: ModuleCatalog): FrameState {
  const seen = new Set<string>();
  const modules: ModuleState[] = config.map((entry) => {
    if (seen.has(entry.slot)) throw new Error(`Slot duplicado en el frame: ${entry.slot}`);
    seen.add(entry.slot);
    const def = moduleDef(catalog, entry.moduleId);
    return {
      slot: entry.slot,
      moduleId: entry.moduleId,
      hp: def.hp,
      plating: def.plating ?? 0,
      destroyed: false,
    };
  });
  if (!modules.some((m) => moduleDef(catalog, m.moduleId).critical)) {
    throw new Error('El frame necesita al menos un módulo crítico (torso/núcleo)');
  }
  return { modules };
}

/** Suma de HP de los módulos de una configuración (para validar maxHp). */
export function frameMaxHp(config: FrameSlotConfig[], catalog: ModuleCatalog): number {
  return config.reduce((sum, entry) => sum + moduleDef(catalog, entry.moduleId).hp, 0);
}

/**
 * Modificadores que el frame aporta al pipeline: contribuciones de los
 * módulos operativos + penalizaciones extra de los destruidos.
 */
export function frameModifiers(frame: FrameState, catalog: ModuleCatalog): StatModifier[] {
  const mods: StatModifier[] = [];
  for (const module of frame.modules) {
    const def = moduleDef(catalog, module.moduleId);
    mods.push(...(module.destroyed ? def.onDestroyed : def.contributions));
  }
  return mods;
}

/**
 * HP global derivado del frame: 0 si algún módulo crítico está destruido
 * (la unidad queda fuera de combate), suma de HP de módulos en caso
 * contrario. Mantiene funcionando la UI y la IA actuales sin cambios.
 */
export function deriveUnitHp(frame: FrameState, catalog: ModuleCatalog): number {
  let sum = 0;
  for (const module of frame.modules) {
    if (module.destroyed && moduleDef(catalog, module.moduleId).critical) return 0;
    sum += module.hp;
  }
  return sum;
}

const REAR_EXPOSED_MULT = 2;
const PROFILE_MULT = 1.5;

/**
 * Tabla de localización de impactos: elige el módulo golpeado con pesos
 * sesgados por arco de ataque y ventaja de altura. Solo los módulos
 * operativos son objetivo. Determinista dado el Rng compartido.
 *
 *  - por la espalda, los módulos 'rear-exposed' (mochilas, colas) ×2
 *  - desde arriba, los 'high-profile' (cabeza, torso) ×1.5
 *  - desde abajo, los 'low-profile' (piernas) ×1.5
 */
export function rollHitLocation(
  frame: FrameState,
  catalog: ModuleCatalog,
  arc: AttackArc,
  heightAdvantage: number,
  rng: Rng,
): ModuleState {
  const candidates = frame.modules.filter((m) => !m.destroyed);
  if (candidates.length === 0) throw new Error('Frame sin módulos operativos');

  const weights = candidates.map((m) => {
    const def = moduleDef(catalog, m.moduleId);
    let weight = def.hitWeight;
    if (arc === 'back' && def.tags.includes('rear-exposed')) weight *= REAR_EXPOSED_MULT;
    if (heightAdvantage > 0 && def.tags.includes('high-profile')) weight *= PROFILE_MULT;
    if (heightAdvantage < 0 && def.tags.includes('low-profile')) weight *= PROFILE_MULT;
    return weight;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}

/**
 * Fracción del daño excedente que se transfiere al módulo crítico cuando
 * la pieza golpeada se destruye: el resto se disipa en la sección
 * arrancada (regla de transferencia estilo BattleTech). Sin esta
 * atenuación, cualquier impacto grande mataría a la unidad a través de
 * su módulo más débil y el daño localizado dejaría de tener sentido.
 */
const OVERFLOW_TRANSFER = 0.5;

/**
 * Aplica daño localizado a un módulo en DOS capas:
 *  1. BLINDAJE: mientras quedan placas, la armadura mitiga (menos la
 *     penetración) y el blindaje absorbe el golpe — la estructura no sufre.
 *     Al agotarse el blindaje se emite `module-armor-broken`: la pieza queda
 *     EXPUESTA.
 *  2. ESTRUCTURA: una vez expuesta (o si la pieza nunca tuvo blindaje), el
 *     daño va al HP interno. Expuesta = SIN mitigación: el daño íntegro
 *     muerde. Si la pieza se destruye, la mitad del exceso (menos la
 *     armadura del núcleo) desborda al módulo crítico.
 * Un módulo sin `plating` se comporta como siempre (la armadura mitiga cada
 * golpe). Devuelve los eventos de módulo; el llamador deriva el HP global.
 */
export function applyDamageToModule(
  frame: FrameState,
  catalog: ModuleCatalog,
  target: ModuleState,
  rawDamage: number,
  targetUnitId: string,
  /** Puntos de armadura que el proyectil ignora (fase 4: penetración). */
  penetration = 0,
): BattleEvent[] {
  const events: BattleEvent[] = [];
  const def = moduleDef(catalog, target.moduleId);
  const hadPlating = (def.plating ?? 0) > 0;

  let toStructure: number;
  if (target.plating > 0) {
    // Capa de blindaje: la armadura mitiga y las placas absorben.
    const effectiveArmor = Math.max(0, def.armor - penetration);
    const afterArmor = Math.max(1, rawDamage - effectiveArmor);
    const platingHit = Math.min(target.plating, afterArmor);
    target.plating -= platingHit;
    events.push({
      type: 'module-armor-damaged',
      targetUnitId,
      slot: target.slot,
      amount: platingHit,
      plating: target.plating,
    });
    if (target.plating === 0) {
      events.push({ type: 'module-armor-broken', targetUnitId, slot: target.slot });
    }
    // El exceso que las placas no frenaron pasa a la estructura.
    toStructure = afterArmor - platingHit;
  } else if (hadPlating) {
    // EXPUESTA: el blindaje ya cayó. Daño íntegro, sin mitigación.
    toStructure = Math.max(1, rawDamage);
  } else {
    // Sin blindaje de fábrica: comportamiento clásico (la armadura mitiga).
    const effectiveArmor = Math.max(0, def.armor - penetration);
    toStructure = Math.max(1, rawDamage - effectiveArmor);
  }

  const absorbed = Math.min(toStructure, target.hp);
  const overflow = toStructure - absorbed;

  if (absorbed > 0) {
    target.hp -= absorbed;
    events.push({
      type: 'module-damaged',
      targetUnitId,
      slot: target.slot,
      amount: absorbed,
      moduleHp: target.hp,
    });
  }
  if (target.hp === 0 && !target.destroyed) {
    target.destroyed = true;
    events.push({ type: 'module-destroyed', targetUnitId, slot: target.slot });
  }

  if (overflow > 0 && !def.critical) {
    const core = frame.modules.find(
      (m) => !m.destroyed && moduleDef(catalog, m.moduleId).critical,
    );
    const coreDef = core ? moduleDef(catalog, core.moduleId) : undefined;
    const transferred = Math.max(0, Math.floor(overflow * OVERFLOW_TRANSFER) - (coreDef?.armor ?? 0));
    if (core && transferred > 0) {
      const coreHit = Math.min(transferred, core.hp);
      core.hp -= coreHit;
      events.push({
        type: 'module-damaged',
        targetUnitId,
        slot: core.slot,
        amount: coreHit,
        moduleHp: core.hp,
      });
      if (core.hp === 0) {
        core.destroyed = true;
        events.push({ type: 'module-destroyed', targetUnitId, slot: core.slot });
      }
    }
  }
  return events;
}

/**
 * Reparte un HP objetivo sobre los módulos de un frame recién construido:
 * la continuidad de campaña despliega chasis ya dañados (spawn.hp < maxHp),
 * pero buildFrameState viene con las piezas LLENAS. Sin repartir, el HP
 * global (deriveUnitHp = suma de estructura) valdría el máximo y el primer
 * golpe "curaría" al chasis al rederivarlo. Reparto PROPORCIONAL, el núcleo
 * nunca baja de 1 (desplegar no mata ni arranca piezas: chasis tocado pero
 * operativo). Puro y determinista (sin azar). No hace nada si viene sano.
 */
export function applyInitialDamage(
  frame: FrameState,
  catalog: ModuleCatalog,
  targetHp: number,
): void {
  const full = deriveUnitHp(frame, catalog);
  if (full <= 0 || targetHp >= full) return;
  const clamped = Math.max(1, targetHp);
  const ratio = clamped / full;
  let running = 0;
  let biggest = frame.modules[0]!;
  for (const module of frame.modules) {
    module.hp = Math.max(1, Math.round(module.hp * ratio));
    running += module.hp;
    if (module.hp > biggest.hp) biggest = module;
  }
  // Corrige el redondeo contra el módulo mayor (el núcleo) para clavar el objetivo.
  const drift = clamped - running;
  if (drift !== 0) biggest.hp = Math.max(1, biggest.hp + drift);
}

/**
 * Reparación de campo: restaura el módulo operativo más dañado (mayor HP
 * perdido; empate → orden del frame). Los módulos destruidos no se pueden
 * reparar en combate. Devuelve null si no hay nada que reparar.
 */
export function repairFrame(
  frame: FrameState,
  catalog: ModuleCatalog,
  power: number,
): { slot: string; amount: number } | null {
  let best: ModuleState | undefined;
  let bestMissing = 0;
  for (const module of frame.modules) {
    if (module.destroyed) continue;
    const missing = moduleDef(catalog, module.moduleId).hp - module.hp;
    if (missing > bestMissing) {
      bestMissing = missing;
      best = module;
    }
  }
  if (!best) return null;

  const amount = Math.min(power, bestMissing);
  best.hp += amount;
  return { slot: best.slot, amount };
}
