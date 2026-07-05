import { describe, expect, it } from 'vitest';
import { newPilot, trackLevel } from '../src/core/progression.js';
import { createSave, describeSave, serializeSave, validateSave, SAVE_VERSION } from '../src/game/save.js';
import { newCampaign } from '../src/game/mercenary.js';
import { startExpedition } from '../src/game/expedition.js';
import { ECONOMY } from '../src/data/economy.js';
import { SALT_PASS_REGION } from '../src/data/world.js';
import { ZOIDS } from '../src/data/zoids.js';

const factoryLoadout = (unitTypeId: string) => ({
  weapons: [...(ZOIDS[unitTypeId]!.weapons ?? [])],
  slots: {},
});

function samplePayload() {
  const van = newPilot('pilot-1', 'Van');
  van.tracks.assault = 300;
  van.quirks = ['curtido'];
  return {
    name: 'La compañía del este',
    pilots: { 'pilot-1': van },
    campaign: newCampaign(ECONOMY, factoryLoadout),
    expedition: startExpedition(SALT_PASS_REGION, 'c0-caza', 'caza'),
    client: { garage: [{ unitTypeId: 'liger-zero' }], maps: {}, selectedMap: '' },
  };
}

describe('sistema de guardado', () => {
  it('la partida sobrevive al viaje de ida y vuelta por archivo', () => {
    const save = createSave(samplePayload(), new Date('2026-07-05T08:00:00Z'));
    const restored = validateSave(serializeSave(save));
    expect(restored).toEqual(save);
    expect(restored!.version).toBe(SAVE_VERSION);
    expect(restored!.pilots['pilot-1']!.quirks).toEqual(['curtido']);
    expect(restored!.expedition!.targetNodeId).toBeDefined();
    expect(restored!.client['garage']).toEqual([{ unitTypeId: 'liger-zero' }]);
  });

  it('rechaza basura sin lanzar: JSON roto, versiones imposibles, objetos ajenos', () => {
    expect(validateSave('{no es json')).toBeNull();
    expect(validateSave(null)).toBeNull();
    expect(validateSave({ hola: 'mundo' })).toBeNull();
    expect(validateSave({ ...createSave(samplePayload()), version: 999 })).toBeNull();
    expect(validateSave({ ...createSave(samplePayload()), savedAt: 'ayer' })).toBeNull();
  });

  it('el resumen de ranura cuenta el progreso sin cargar la partida', () => {
    const save = createSave(samplePayload(), new Date('2026-07-05T08:00:00Z'));
    const summary = describeSave(save, trackLevel);
    expect(summary.name).toBe('La compañía del este');
    expect(summary.credits).toBe(ECONOMY.startingCredits);
    expect(summary.contractsDone).toBe(0);
    expect(summary.expeditionDay).toBe(0);
    expect(summary.pilotNames).toEqual(['Van']);
    expect(summary.totalPilotLevels).toBe(2); // asalto 300 XP = nivel 2
  });

  it('una partida sin campaña (solo escaramuzas) también es válida', () => {
    const save = createSave({ ...samplePayload(), campaign: null, expedition: null });
    const restored = validateSave(serializeSave(save));
    expect(restored!.campaign).toBeNull();
    expect(restored!.expedition).toBeNull();
  });
});
