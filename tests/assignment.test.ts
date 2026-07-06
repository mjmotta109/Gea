import { describe, expect, it } from 'vitest';
import {
  advanceAssignment, assignmentDone, finishAssignment, resolveAssignmentCall, startAssignment,
} from '../src/game/assignment.js';
import { ASSIGNMENT_SPECS } from '../src/data/assignments.js';

const ESCOLTA = ASSIGNMENT_SPECS.find((s) => s.id === 'escolta-local')!;
const RASTREO = ASSIGNMENT_SPECS.find((s) => s.id === 'rastreo-gremio')!;

describe('destacamentos: la compañía trabaja aunque no la mires', () => {
  it('avanza por jornadas y se detiene en la llamada a base', () => {
    let a = startAssignment(ESCOLTA, 2, 'clave-1');
    a = advanceAssignment(a, ESCOLTA, 1);
    expect(a.daysDone).toBe(1);
    expect(a.pendingCall).toBeUndefined();
    // La llamada del 50% suena en la jornada 2 (de 3) y PAUSA el avance.
    a = advanceAssignment(a, ESCOLTA, 5);
    expect(a.daysDone).toBe(2);
    expect(a.pendingCall).toBeDefined();
    const paused = advanceAssignment(a, ESCOLTA, 3);
    expect(paused.daysDone).toBe(2); // el destacamento espera órdenes
  });

  it('las órdenes tienen consecuencias anunciadas (días, éxito, paga)', () => {
    let a = startAssignment(ESCOLTA, 2, 'clave-2');
    a = advanceAssignment(a, ESCOLTA, 2);
    expect(a.pendingCall).toBeDefined();
    const corto = resolveAssignmentCall(a, 'corto');
    expect(corto.totalDays).toBe(ESCOLTA.days - 1); // el paso corto ahorra un día
    expect(corto.scoreDelta).toBe(-12);
    const seguro = resolveAssignmentCall(a, 'seguro');
    expect(seguro.totalDays).toBe(ESCOLTA.days);
    expect(seguro.scoreDelta).toBe(0);
    // Tras decidir, la marcha continúa hasta el final.
    const done = advanceAssignment(seguro, ESCOLTA, 9);
    expect(assignmentDone(done)).toBe(true);
  });

  it('el rastreo largo tiene DOS llamadas: paulatinas, no una', () => {
    let a = startAssignment(RASTREO, 3, 'clave-3');
    a = advanceAssignment(a, RASTREO, 20);
    expect(a.pendingCall?.prompt).toContain('bifurca');
    a = resolveAssignmentCall(a, 'rodear');
    a = advanceAssignment(a, RASTREO, 20);
    expect(a.pendingCall?.prompt).toContain('madriguera');
    a = resolveAssignmentCall(a, 'lejos');
    a = advanceAssignment(a, RASTREO, 20);
    expect(assignmentDone(a)).toBe(true);
  });

  it('la experiencia SIEMPRE mejora el grado (monótono en niveles)', () => {
    const order = { fracaso: 0, apurado: 1, cumplido: 2, brillante: 3 };
    for (let key = 0; key < 12; key++) {
      let previous = -1;
      for (const levels of [0, 2, 4, 6, 8, 12]) {
        let a = startAssignment(RASTREO, 2, `mono-${key}`);
        a = advanceAssignment(a, RASTREO, 20);
        if (a.pendingCall) { a = resolveAssignmentCall(a, 'rodear'); a = advanceAssignment(a, RASTREO, 20); }
        if (a.pendingCall) { a = resolveAssignmentCall(a, 'lejos'); a = advanceAssignment(a, RASTREO, 20); }
        const report = finishAssignment(a, RASTREO, levels);
        expect(order[report.grade]).toBeGreaterThanOrEqual(previous);
        previous = order[report.grade];
      }
    }
  });

  it('el fracaso no paga, estresa y manda al piloto a la enfermería', () => {
    // Dificultad alta + 0 niveles + malas decisiones: fracaso garantizado
    // con alguna clave (búsqueda determinista).
    for (let i = 0; i < 60; i++) {
      let a = startAssignment(RASTREO, 2, `fail-${i}`);
      a = advanceAssignment(a, RASTREO, 20);
      if (a.pendingCall) { a = resolveAssignmentCall(a, 'cruzar'); a = advanceAssignment(a, RASTREO, 20); }
      if (a.pendingCall) { a = resolveAssignmentCall(a, 'acercarse'); a = advanceAssignment(a, RASTREO, 20); }
      const report = finishAssignment(a, RASTREO, 0);
      if (report.grade === 'fracaso') {
        expect(report.credits).toBe(0);
        expect(report.stressDelta).toBeGreaterThan(0);
        expect(report.injuryDays).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error('ninguna clave fracasó: la dificultad no muerde');
  });

  it('el XP del destacamento es real pero menor que el de usarlos', () => {
    for (const spec of ASSIGNMENT_SPECS) {
      const total = Object.values(spec.xp).reduce((n, x) => n + x, 0);
      expect(total).toBeGreaterThanOrEqual(20); // vale la pena rotar
      expect(total).toBeLessThanOrEqual(45);    // pero jugar da más
    }
  });

  it('misma clave y mismas órdenes → mismo destino (determinismo)', () => {
    const run = (): ReturnType<typeof finishAssignment> => {
      let a = startAssignment(ESCOLTA, 2, 'det');
      a = advanceAssignment(a, ESCOLTA, 2);
      a = resolveAssignmentCall(a, 'seguro');
      a = advanceAssignment(a, ESCOLTA, 9);
      return finishAssignment(a, ESCOLTA, 3);
    };
    expect(run()).toEqual(run());
  });
});
