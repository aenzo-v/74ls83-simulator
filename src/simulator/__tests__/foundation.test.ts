import { describe, expect, it } from 'vitest';
import {
  ALL_BREADBOARD_HOLES,
  findNearestHoleXZ,
  getHoleById,
  getStripHoles,
  PITCH,
} from '../breadboard';
import {
  getDip16ColumnForPin,
  getDip16PinHoleId,
   getPinSpec74LS83,
  PINOUT_74LS83A,
} from '../pinout74ls83';
import type { PinNumber } from '../types';

describe('Fase 1 — Patillaje canónico del SN74LS83A (DIP-16)', () => {
  it('define exactamente los 16 pines sin duplicados', () => {
    expect(PINOUT_74LS83A).toHaveLength(16);
    const numbers = new Set(PINOUT_74LS83A.map((p) => p.pinNumber));
    const signals = new Set(PINOUT_74LS83A.map((p) => p.signal));
    expect(numbers.size).toBe(16);
    expect(signals.size).toBe(16);
  });

  it('respeta la correspondencia exacta pin <-> señal del 74LS83A (distinta del 74LS283)', () => {
    const expectedMap: Record<PinNumber, string> = {
      1: 'A3',
      2: 'S2',
      3: 'A2',
      4: 'B2',
      5: 'VCC',
      6: 'S1',
      7: 'B1',
      8: 'A1',
      9: 'S0',
      10: 'A0',
      11: 'B0',
      12: 'GND',
      13: 'C0',
      14: 'C4',
      15: 'S3',
      16: 'B3',
    };

    for (let pin = 1 as PinNumber; pin <= 16; pin = (pin + 1) as PinNumber) {
      expect(getPinSpec74LS83(pin).signal).toBe(expectedMap[pin]);
    }
  });

  it('monta el DIP-16 sobre el canal central (filas e y f) respetando numeración antihoraria', () => {
    const startCol = 28;
    expect(getDip16PinHoleId(1, startCol)).toBe('f28');
    expect(getDip16PinHoleId(5, startCol)).toBe('f32');
    expect(getDip16PinHoleId(8, startCol)).toBe('f35');
    expect(getDip16PinHoleId(9, startCol)).toBe('e35');
    expect(getDip16PinHoleId(12, startCol)).toBe('e32');
    expect(getDip16PinHoleId(16, startCol)).toBe('e28');

    // Invariante física DIP-16: los pines enfrentados en la misma columna suman 17
    for (let bottomPin = 1 as PinNumber; bottomPin <= 8; bottomPin = (bottomPin + 1) as PinNumber) {
      const topPin = (17 - bottomPin) as PinNumber;
      expect(getDip16ColumnForPin(bottomPin, startCol)).toBe(
        getDip16ColumnForPin(topPin, startCol),
      );
    }
  });
});

describe('Fase 1 — Topología y geometría de la protoboard MB-102 (830 puntos)', () => {
  it('genera exactamente 830 perforaciones (630 terminales + 200 rieles) con IDs únicos', () => {
    expect(ALL_BREADBOARD_HOLES).toHaveLength(830);

    const terminalHoles = ALL_BREADBOARD_HOLES.filter((h) => h.kind === 'terminal');
    const railHoles = ALL_BREADBOARD_HOLES.filter((h) => h.kind === 'rail');
    expect(terminalHoles).toHaveLength(630);
    expect(railHoles).toHaveLength(200);

    const ids = new Set(ALL_BREADBOARD_HOLES.map((h) => h.id));
    expect(ids.size).toBe(830);
  });

  it('mantiene 7.62 mm (3 pasos de 2.54 mm) a través del canal central entre filas e y f', () => {
    const e28 = getHoleById('e28');
    const f28 = getHoleById('f28');
    expect(e28).toBeDefined();
    expect(f28).toBeDefined();
    if (e28 && f28) {
      const spanZ = f28.position.z - e28.position.z;
      expect(spanZ).toBeCloseTo(3 * PITCH, 6);
      expect(e28.stripId).not.toBe(f28.stripId);
    }
  });

  it('agrupa cada semicolumna en 5 contactos internos aislados del lado opuesto', () => {
    const e32 = getHoleById('e32');
    const f32 = getHoleById('f32');
    expect(e32).toBeDefined();
    expect(f32).toBeDefined();
    if (e32 && f32) {
      const upperPeers = getStripHoles(e32.stripId).map((h) => h.id);
      const lowerPeers = getStripHoles(f32.stripId).map((h) => h.id);
      expect(upperPeers).toEqual(['a32', 'b32', 'c32', 'd32', 'e32']);
      expect(lowerPeers).toEqual(['f32', 'g32', 'h32', 'i32', 'j32']);
    }
  });

  it('localiza correctamente la perforación más cercana a una coordenada (x, z)', () => {
    const target = getHoleById('f28');
    expect(target).toBeDefined();
    if (target) {
      const found = findNearestHoleXZ(target.position.x + 0.04, target.position.z - 0.03);
      expect(found?.id).toBe('f28');
      const outOfBounds = findNearestHoleXZ(0, 0); // centro del canal DIP vacío
      expect(outOfBounds).toBeUndefined();
    }
  });
});
