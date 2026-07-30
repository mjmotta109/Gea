import { describe, expect, it } from 'vitest';
import {
  agencyRecruits, MAX_PILOTS, QUALITY_LABELS, recruitPilot, rescueBounty,
  rescueOpposition, rescuePilot, RESCUE_TIERS, seedXp, tavernRecruits, walkInApplicant,
} from '../src/game/barracks.js';
import { trackLevel } from '../src/core/progression.js';
import { resolveEncounter, startFreeExpedition, type Encounter } from '../src/game/expedition.js';
import { SALT_PASS_REGION } from '../src/data/world.js';
import { ZOIDS } from '../src/data/zoids.js';

// El cuartel: reclutar por taberna, agencia, rescate y aspirantes.
// Todo determinista; la calidad del rescatado ES el riesgo corrido.

describe('el cuartel de pilotos', () => {
  it('las ofertas son deterministas: misma ciudad y ciclo, misma gente', () => {
    expect(tavernRecruits('c-sal', 2, 5)).toEqual(tavernRecruits('c-sal', 2, 5));
    expect(agencyRecruits('c-cap', 3, 5)).toEqual(agencyRecruits('c-cap', 3, 5));
    // Ciclos distintos rotan la barra.
    const a = JSON.stringify(tavernRecruits('c-sal', 2, 5));
    const b = JSON.stringify(tavernRecruits('c-sal', 2, 6));
    expect(a).not.toBe(b);
  });

  it('la agencia exige ciudad nivel 2+ y cobra el papeleo', () => {
    expect(agencyRecruits('aldea', 1, 3)).toHaveLength(0);
    for (let cycle = 0; cycle < 10; cycle++) {
      for (const offer of agencyRecruits('capital', 3, cycle)) {
        expect(offer.origin).toBe('agencia');
        expect(offer.quality).toBeGreaterThanOrEqual(1);
        expect(offer.fee).toBeGreaterThan(0);
      }
    }
  });

  it('la calidad manda en la XP de firma: el as llega hecho, el novato no', () => {
    expect(seedXp(0)).toEqual({ basics: 0, track: 0 });
    const as = seedXp(3);
    expect(trackLevel(as.track)).toBe(3);
    const novato = recruitPilot({
      id: 'rec-x', name: 'X', origin: 'taberna', quality: 0, fee: 0, blurb: '',
    });
    expect(novato.mainSpec).toBeUndefined();
    expect(novato.basics).toBe(0);
    const veterano = recruitPilot({
      id: 'rec-y', name: 'Y', origin: 'agencia', quality: 2, spec: 'sniper', fee: 900, blurb: '',
    });
    expect(veterano.mainSpec).toBe('sniper'); // llega con su oficio elegido
    expect(trackLevel(veterano.tracks.sniper)).toBe(2);
  });

  it('el aspirante es determinista, gratis, y no viene todos los ciclos', () => {
    const seen: Array<string | null> = [];
    for (let c = 0; c < 30; c++) {
      const offer = walkInApplicant(c);
      expect(offer).toEqual(walkInApplicant(c)); // mismo ciclo, misma puerta
      if (offer) expect(offer.fee).toBe(0);
      seen.push(offer?.id ?? null);
    }
    expect(seen.some((x) => x !== null)).toBe(true);
    expect(seen.some((x) => x === null)).toBe(true);
  });

  it('a más riesgo, mejor piloto: el tier del rescate ES la calidad', () => {
    for (const tier of [1, 2, 3] as const) {
      const saved = rescuePilot(`clave-${tier}`, tier);
      expect(saved.quality).toBe(tier);
      expect(saved.fee).toBe(0); // te debe la vida
      const { squad, aiSkill } = rescueOpposition(`clave-${tier}`, tier);
      expect(squad.length).toBe(RESCUE_TIERS[tier].count);
      expect(aiSkill).toBe(RESCUE_TIERS[tier].aiSkill);
      for (const id of squad) {
        expect(RESCUE_TIERS[tier].pool).toContain(id);
        expect(ZOIDS[id], `chasis real: ${id}`).toBeDefined();
      }
    }
    expect(RESCUE_TIERS[3].aiSkill).toBeGreaterThan(RESCUE_TIERS[1].aiSkill);
    expect(rescueBounty(3)).toBeGreaterThan(rescueBounty(1));
    expect(QUALITY_LABELS[3]).toBe('as');
    expect(MAX_PILOTS).toBe(8);
  });

  it('las encrucijadas de rescate anuncian el combate y el tier', () => {
    const exp = startFreeExpedition(SALT_PASS_REGION, 'prueba');
    const mk = (kind: Encounter['kind']): Encounter => ({ id: 'x', kind, prompt: '', options: [] });
    const cerco = resolveEncounter(exp, mk('rescate-cerco'), 'combate');
    expect(cerco.rescue).toEqual({ tier: 1, fight: true });
    const convoy = resolveEncounter(exp, mk('rescate-convoy'), 'combate');
    expect(convoy.rescue).toEqual({ tier: 2, fight: true });
    expect(convoy.reputation).toEqual([{ factionId: 'chatarreros', delta: -10 }]);
    const pagado = resolveEncounter(exp, mk('rescate-convoy'), 'pagar');
    expect(pagado.rescue).toEqual({ tier: 2, fight: false });
    expect(pagado.supplyDelta).toBe(-4); // la libertad se paga en raciones
    const as = resolveEncounter(exp, mk('rescate-as'), 'combate');
    expect(as.rescue).toEqual({ tier: 3, fight: true });
    // Seguir de largo nunca alista a nadie.
    expect(resolveEncounter(exp, mk('rescate-cerco'), 'seguir').rescue).toBeUndefined();
  });
});
