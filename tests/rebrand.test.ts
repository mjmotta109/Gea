import { describe, expect, it } from 'vitest';
import { LEGACY_TERMS, migrateLegacyJson } from '../src/game/rebrand.js';
import { YANTRAS } from '../src/data/yantras.js';
import { MODULES } from '../src/data/modules.js';
import { LINEAGE, TRADITIONS, lineageOf } from '../src/data/lineage.js';
import { NIGHT_VISION_BASE } from '../src/core/battle.js';

// El rebranding: los guardados de la etapa prototipo migran al universo
// propio, y todo chasis del catálogo tiene linaje (tradición + matrícula).

describe('migración de guardados', () => {
  it('reescribe ids, módulos, nombres de fábrica y pilotos del prototipo', () => {
    const old = JSON.stringify({
      roster: [
        { unitTypeId: 'liger-zero', slots: { casco: 'lz-casco' }, weapons: ['w-strike-laser-claw'] },
        { unitTypeId: 'gun-sniper-naomi', slots: {}, weapons: [] },
      ],
      armory: { 'w-charged-particle-gun': 1 },
      pilots: [{ name: 'Van' }, { name: 'Fiona' }],
      spawn: { name: 'Liger Zero CAS' },
    });
    const migrated = JSON.parse(migrateLegacyJson(old));
    expect(migrated.roster[0].unitTypeId).toBe('centella');
    expect(migrated.roster[0].slots.casco).toBe('ce-casco');
    expect(migrated.roster[0].weapons).toEqual(['w-induction-claws']);
    expect(migrated.roster[1].unitTypeId).toBe('visor-c');
    expect(migrated.armory).toEqual({ 'w-fel-laser': 1 });
    expect(migrated.pilots.map((p: { name: string }) => p.name)).toEqual(['Iria', 'Tamsin']);
    expect(migrated.spawn.name).toBe('Centella-M');
    // Todo lo migrado existe en los catálogos nuevos.
    expect(YANTRAS[migrated.roster[0].unitTypeId]).toBeDefined();
    expect(MODULES[migrated.roster[0].slots.casco]).toBeDefined();
  });

  it('respeta el texto libre y lo que no es del prototipo; es idempotente', () => {
    const text = JSON.stringify({
      chronicle: ['Día 3 — Van repara el Liger Zero bajo la lluvia.'],
      name: 'Compañía del Este', unitTypeId: 'centella',
    });
    const once = migrateLegacyJson(text);
    expect(once).toBe(text); // ni la crónica ni lo nuevo se tocan
    const old = JSON.stringify({ a: 'gojulas' });
    expect(migrateLegacyJson(migrateLegacyJson(old))).toBe(migrateLegacyJson(old));
  });

  it('la tabla cubre los términos del prototipo', () => {
    expect(LEGACY_TERMS).toBeGreaterThanOrEqual(100);
  });
});

describe('linaje de los yantras', () => {
  it('todo chasis del catálogo tiene tradición y matrícula, y viceversa', () => {
    for (const id of Object.keys(YANTRAS)) {
      expect(LINEAGE[id], `linaje de ${id}`).toBeDefined();
    }
    for (const id of Object.keys(LINEAGE)) {
      expect(YANTRAS[id], `chasis de ${id}`).toBeDefined();
    }
  });

  it('la matrícula lleva el prefijo de su tradición (los remiendos, sin licencia)', () => {
    for (const [id, lineage] of Object.entries(LINEAGE)) {
      const prefix = TRADITIONS[lineage.tradition].prefix;
      expect(lineage.designation.startsWith(prefix), `${id}: ${lineage.designation}`).toBe(true);
    }
    expect(lineageOf('navaja')?.designation).toBe('s/l');
    expect(lineageOf('no-existe')).toBeUndefined();
  });

  it('las cuatro escuelas tienen máquinas', () => {
    const used = new Set(Object.values(LINEAGE).map((l) => l.tradition));
    expect([...used].sort()).toEqual(['albion', 'argos', 'remiendo', 'yamato']);
  });

  it('la tradición se juega: toda máquina Argos ve más allá de la base de noche', () => {
    for (const [id, lineage] of Object.entries(LINEAGE)) {
      if (lineage.tradition !== 'argos') continue;
      expect(YANTRAS[id]!.vision ?? NIGHT_VISION_BASE, `${id} (Argos)`).toBeGreaterThan(NIGHT_VISION_BASE);
    }
  });
});

describe('el arsenal: ciencia ficción dura y nada de la franquicia', () => {
  // Términos vetados: la franquicia del prototipo y la ciencia ficción
  // blanda (plasma de mano, filos monomoleculares, escudos de energía...).
  // «Cortador de plasma» es la excepción: la antorcha de arco de plasma
  // industrial existe y corta acero a alcance de brazo.
  const BANNED = /strike|laser claw|part[ií]culas|shock|e-shield|escudo de energ|smoke discharger|monomolec|vibrator|pilote|\bAZ\b|carabina de plasma|hacha de plasma|lanzallamas de plasma|i[oó]nic|haz de reparaci|proyector de barrera/i;

  it('ninguna habilidad, arma ni módulo usa un término vetado', async () => {
    const { withWeaponLibrary } = await import('../src/data/weaponLibrary.js');
    const { ABILITIES } = await import('../src/data/abilities.js');
    const { WEAPONS } = await import('../src/data/weapons.js');
    const all = withWeaponLibrary(ABILITIES, WEAPONS);
    const texts: string[] = [];
    for (const a of Object.values(all.abilityCatalog)) texts.push(a.id, a.name, a.description);
    for (const w of Object.values(all.weaponCatalog)) texts.push(w.id, w.name);
    for (const m of Object.values(MODULES)) texts.push(m.id, m.name);
    for (const text of texts) expect(BANNED.test(text), text).toBe(false);
  });

  it('un guardado de la etapa prototipo salta directo al arsenal final', () => {
    const old = JSON.stringify({ armory: { 'w-strike-laser-claw': 1, 'w-charged-particle-gun': 1, 'lib-w-pile-bunker': 2 } });
    expect(JSON.parse(migrateLegacyJson(old)).armory).toEqual({
      'w-induction-claws': 1, 'w-fel-laser': 1, 'lib-w-shaped-charge-lance': 2,
    });
  });
});
