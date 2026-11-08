import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  ALL_PASSIVE_ACTIVE_COMPONENTS,
  CHIP_74LS83_MOUNTED_PINS,
  CHIP_74LS83_PLACEMENT,
  DIP_SWITCHES,
  JUMPER_WIRES,
  OUTPUT_LEDS,
  POWER_SUPPLY_5V,
  RESISTORS,
  resolveTerminalPosition,
  WIRE_COLORS,
} from '../../data/circuitLayout';
import { buildWireSplinePoints } from '../../data/wireRouting';
import {
  BREADBOARD_DIMENSIONS,
  columnToX,
  getHoleById,
  PITCH,
} from '../breadboard';
import type { SignalCode } from '../types';

function createWireCurve(wireId: string, fromId: string, toId: string): THREE.CatmullRomCurve3 {
  const startPos = resolveTerminalPosition(fromId);
  const endPos = resolveTerminalPosition(toId);
  if (!startPos || !endPos) {
    throw new Error(`Terminales inválidos para curva ${wireId}: ${fromId} -> ${toId}`);
  }
  const controlPts = buildWireSplinePoints(wireId, startPos, endPos);
  return new THREE.CatmullRomCurve3(
    controlPts.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    false,
    'centripetal',
    0.35,
  );
}

describe('Modelado declarativo, emplazamiento físico y geometría 3D del cableado', () => {
  it('define identificadores únicos y respeta la convención cromática funcional', () => {
    const componentIds = ALL_PASSIVE_ACTIVE_COMPONENTS.map((c) => c.id);
    expect(new Set(componentIds).size).toBe(componentIds.length);

    const wireIds = JUMPER_WIRES.map((w) => w.id);
    expect(new Set(wireIds).size).toBe(wireIds.length);

    const channelIds = DIP_SWITCHES.flatMap((sw) => sw.channels.map((ch) => ch.id));
    expect(channelIds).toHaveLength(9); // A3..A0, B3..B0 y C0
    expect(new Set(channelIds).size).toBe(9);

    for (const wire of JUMPER_WIRES) {
      switch (wire.category) {
        case 'POWER_VCC':
          expect(wire.colorHex).toBe(WIRE_COLORS.vcc);
          break;
        case 'POWER_GND':
          expect(wire.colorHex).toBe(WIRE_COLORS.gnd);
          break;
        case 'INPUT_A':
          expect(wire.colorHex).toBe(WIRE_COLORS.inputA);
          break;
        case 'INPUT_B':
          expect(wire.colorHex).toBe(WIRE_COLORS.inputB);
          break;
        case 'CARRY_IN':
          expect(wire.colorHex).toBe(WIRE_COLORS.carryIn);
          break;
        case 'OUTPUT_SUM':
          expect(wire.colorHex).toBe(WIRE_COLORS.sumOut);
          break;
        case 'OUTPUT_CARRY':
          expect(wire.colorHex).toBe(WIRE_COLORS.carryOut);
          break;
      }
    }
  });

  it('asocia cada terminal de componente y extremo de cable a un contacto válido sin colisiones', () => {
    const occupiedBreadboardHoles: string[] = [];

    // 1. Pines del 74LS83A (16)
    for (const pin of CHIP_74LS83_MOUNTED_PINS) {
      expect(getHoleById(pin.holeId)).toBeDefined();
      occupiedBreadboardHoles.push(pin.holeId);
    }

    // 2. Pines de interruptores DIP (9 canales x 2 = 18)
    for (const sw of DIP_SWITCHES) {
      for (const ch of sw.channels) {
        const topHole = getHoleById(ch.inputHoleId);
        const bottomHole = getHoleById(ch.outputHoleId);
        expect(topHole).toBeDefined();
        expect(bottomHole).toBeDefined();
        if (topHole && bottomHole) {
          expect(bottomHole.position.z - topHole.position.z).toBeCloseTo(3 * PITCH, 6);
        }
        occupiedBreadboardHoles.push(ch.inputHoleId, ch.outputHoleId);
      }
    }

    // 3. Terminales de resistencias (14 x 2 = 28)
    expect(RESISTORS).toHaveLength(14);
    for (const res of RESISTORS) {
      expect(getHoleById(res.leadAHoleId)).toBeDefined();
      expect(getHoleById(res.leadBHoleId)).toBeDefined();
      occupiedBreadboardHoles.push(res.leadAHoleId, res.leadBHoleId);
    }

    // 4. Terminales de LEDs de salida (5 x 2 = 10) con paso exacto de 2.54 mm
    expect(OUTPUT_LEDS).toHaveLength(5);
    for (const led of OUTPUT_LEDS) {
      const anode = getHoleById(led.anodeHoleId);
      const cathode = getHoleById(led.cathodeHoleId);
      expect(anode).toBeDefined();
      expect(cathode).toBeDefined();
      if (anode && cathode) {
        expect(cathode.position.x - anode.position.x).toBeCloseTo(PITCH, 6);
        expect(cathode.position.z).toBeCloseTo(anode.position.z, 6);
      }
      occupiedBreadboardHoles.push(led.anodeHoleId, led.cathodeHoleId);
    }

    // 5. Extremos de cables jumper
    for (const wire of JUMPER_WIRES) {
      expect(resolveTerminalPosition(wire.fromTerminalId)).toBeDefined();
      expect(resolveTerminalPosition(wire.toTerminalId)).toBeDefined();

      if (
        wire.fromTerminalId !== POWER_SUPPLY_5V.plusTerminalId &&
        wire.fromTerminalId !== POWER_SUPPLY_5V.gndTerminalId
      ) {
        expect(getHoleById(wire.fromTerminalId)).toBeDefined();
        occupiedBreadboardHoles.push(wire.fromTerminalId);
      }
      if (
        wire.toTerminalId !== POWER_SUPPLY_5V.plusTerminalId &&
        wire.toTerminalId !== POWER_SUPPLY_5V.gndTerminalId
      ) {
        expect(getHoleById(wire.toTerminalId)).toBeDefined();
        occupiedBreadboardHoles.push(wire.toTerminalId);
      }
    }

    // Ningún agujero de la protoboard recibe dos terminales físicos en el mismo contacto
    const uniqueOccupied = new Set(occupiedBreadboardHoles);
    expect(uniqueOccupied.size).toBe(occupiedBreadboardHoles.length);
  });

  it('garantiza que las curvas 3D terminen en sus contactos y no atraviesen componentes ni la protoboard', () => {
    const chipMinX = columnToX(CHIP_74LS83_PLACEMENT.startColumn) - 0.14;
    const chipMaxX = columnToX(CHIP_74LS83_PLACEMENT.endColumn) + 0.14;
    const chipHalfZ = 0.33;

    const switchBoxes = DIP_SWITCHES.map((sw) => ({
      id: sw.id,
      minX: columnToX(sw.startColumn) - 0.15,
      maxX: columnToX(sw.endColumn) + 0.15,
      halfZ: 0.34,
    }));

    const ledCenters = OUTPUT_LEDS.map((led) => {
      const a = getHoleById(led.anodeHoleId)!;
      const c = getHoleById(led.cathodeHoleId)!;
      return {
        id: led.id,
        cx: (a.position.x + c.position.x) * 0.5,
        cz: (a.position.z + c.position.z) * 0.5,
        radiusXZ: 0.25,
      };
    });

    for (const wire of JUMPER_WIRES) {
      const startPos = resolveTerminalPosition(wire.fromTerminalId)!;
      const endPos = resolveTerminalPosition(wire.toTerminalId)!;
      const curve = createWireCurve(wire.id, wire.fromTerminalId, wire.toTerminalId);

      // Extremos exactos alineados con sus terminales asignados
      const p0 = curve.getPointAt(0);
      const p1 = curve.getPointAt(1);
      expect(p0.x).toBeCloseTo(startPos.x, 5);
      expect(p0.z).toBeCloseTo(startPos.z, 5);
      expect(p1.x).toBeCloseTo(endPos.x, 5);
      expect(p1.z).toBeCloseTo(endPos.z, 5);

      // Muestreo denso a lo largo del tramo aéreo del cable
      const sampleCount = 60;
      for (let i = 0; i <= sampleCount; i += 1) {
        const t = i / sampleCount;
        const pt = curve.getPointAt(t);

        // Siempre por encima de la superficie superior de la protoboard y a altura realista
        expect(pt.y).toBeGreaterThan(BREADBOARD_DIMENSIONS.heightY + 0.04);
        expect(pt.y).toBeLessThan(1.52);

        // Fuera de la serigrafía y encapsulado DIP-16 del 74LS83A
        const insideChip =
          pt.x >= chipMinX &&
          pt.x <= chipMaxX &&
          pt.z >= -chipHalfZ &&
          pt.z <= chipHalfZ;
        expect(insideChip).toBe(false);

        // Fuera de las carcasas de los interruptores DIP
        for (const box of switchBoxes) {
          const insideSw =
            pt.x >= box.minX &&
            pt.x <= box.maxX &&
            pt.z >= -box.halfZ &&
            pt.z <= box.halfZ;
          expect(insideSw).toBe(false);
        }

        // Fuera de las cápsulas de los LEDs de 5 mm
        for (const led of ledCenters) {
          const distLedXZ = Math.hypot(pt.x - led.cx, pt.z - led.cz);
          expect(distLedXZ).toBeGreaterThan(led.radiusXZ);
        }
      }
    }
  });

  it('separa espacialmente todos los cables jumper sin superposiciones ni intersecciones 3D entre conductores', () => {
    const wireSamples = JUMPER_WIRES.map((wire) => {
      const curve = createWireCurve(wire.id, wire.fromTerminalId, wire.toTerminalId);
      const samples: THREE.Vector3[] = [];
      const steps = 64;
      for (let i = 0; i <= steps; i += 1) {
        samples.push(curve.getPointAt(i / steps));
      }
      return { id: wire.id, samples };
    });

    // Diámetro exterior del conductor = 2 * 0.050 = 0.100 cm; verificamos holgura real entre ejes
    const minAllowedCenterDistance = 0.105;

    for (let i = 0; i < wireSamples.length; i += 1) {
      for (let j = i + 1; j < wireSamples.length; j += 1) {
        let minPairDist = Number.POSITIVE_INFINITY;
        const ptsA = wireSamples[i]!.samples;
        const ptsB = wireSamples[j]!.samples;

        for (const a of ptsA) {
          for (const b of ptsB) {
            const d = a.distanceTo(b);
            if (d < minPairDist) {
              minPairDist = d;
            }
          }
        }

        expect(
          minPairDist,
          `Superposición detectada entre ${wireSamples[i]!.id} y ${wireSamples[j]!.id} (dist=${minPairDist.toFixed(4)} cm)`,
        ).toBeGreaterThan(minAllowedCenterDistance);
      }
    }
  });

  it('prepara correctamente la alineación de pistas para las 9 entradas, alimentación y 5 salidas', () => {
    const pinStripBySignal = new Map<SignalCode, string>();
    for (const mounted of CHIP_74LS83_MOUNTED_PINS) {
      const hole = getHoleById(mounted.holeId);
      expect(hole).toBeDefined();
      if (hole) {
        pinStripBySignal.set(mounted.spec.signal, hole.stripId);
      }
    }

    for (const sw of DIP_SWITCHES) {
      for (const ch of sw.channels) {
        const swOutStrip = getHoleById(ch.outputHoleId)?.stripId;
        const targetPinStrip = pinStripBySignal.get(ch.signal);
        const matchingWire = JUMPER_WIRES.find(
          (w) =>
            w.signal === ch.signal &&
            getHoleById(w.fromTerminalId)?.stripId === swOutStrip &&
            getHoleById(w.toTerminalId)?.stripId === targetPinStrip,
        );
        expect(matchingWire).toBeDefined();
      }
    }

    for (const led of OUTPUT_LEDS) {
      const icOutStrip = pinStripBySignal.get(led.signal);
      const limiter = RESISTORS.find(
        (r) => r.role === 'LED_LIMITER' && r.associatedSignal === led.signal,
      );
      expect(limiter).toBeDefined();
      if (limiter) {
        const resInStrip = getHoleById(limiter.leadAHoleId)?.stripId;
        const resOutStrip = getHoleById(limiter.leadBHoleId)?.stripId;
        const anodeStrip = getHoleById(led.anodeHoleId)?.stripId;

        expect(resOutStrip).toBe(anodeStrip);

        const outWire = JUMPER_WIRES.find(
          (w) =>
            w.signal === led.signal &&
            getHoleById(w.fromTerminalId)?.stripId === icOutStrip &&
            getHoleById(w.toTerminalId)?.stripId === resInStrip,
        );
        expect(outWire).toBeDefined();
      }
    }
  });
});
