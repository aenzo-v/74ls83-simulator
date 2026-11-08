import { COLUMN_COUNT, columnToX, getHoleById } from '../simulator/breadboard';
import type { DipSwitchDescriptor, LedDescriptor } from '../simulator/components';
import type { PlacedChip74LS83 } from '../simulator/netlist';
import type { Point3D } from '../simulator/types';

/**
 * Definición puramente visual de las trayectorias 3D de los cables jumper.
 *
 * SEPARACIÓN ARQUITECTÓNICA: Este módulo contiene únicamente geometría de recorrido
 * (carriles ordenados, pasos por corredores libres y curvatura natural de conductor flexible),
 * completamente independiente de la conectividad eléctrica definida en `circuitLayout.ts`
 * y resuelta por `src/simulator/netlist.ts`.
 */

export interface WireVisualRoute {
  readonly waypoints?: readonly Point3D[];
  readonly archHeightY?: number;
}

export const WIRE_VISUAL_ROUTES: Readonly<Record<string, WireVisualRoute>> = {
  // Alimentación principal desde la fuente regulada (+5 V y GND)
  'w-psu-vcc': { archHeightY: 1.4 },
  'w-psu-gnd': { archHeightY: 1.4 },

  // Puentes perimetrales derechos paralelos entre rieles superiores e inferiores (cols 60 y 61 libres)
  'w-rail-vcc': {
    waypoints: [
      { x: columnToX(61.45), y: 1.2, z: -1.9 },
      { x: columnToX(61.55), y: 1.25, z: 0 },
      { x: columnToX(61.45), y: 1.2, z: 1.75 },
    ],
  },
  'w-rail-gnd': {
    waypoints: [
      { x: columnToX(60.15), y: 1.18, z: -1.75 },
      { x: columnToX(60.22), y: 1.23, z: 0 },
      { x: columnToX(60.15), y: 1.18, z: 1.9 },
    ],
  },

  // Alimentación directa del 74LS83A (Pin 5 VCC en f32 y Pin 12 GND en e32)
  'w-ic-vcc': { archHeightY: 1.22 },
  'w-ic-gnd': {
    waypoints: [
      { x: columnToX(31.4), y: 1.35, z: -1.78 },
      { x: columnToX(31.8), y: 1.39, z: -1.55 },
      { x: columnToX(31.98), y: 1.24, z: -1.42 },
    ],
  },

  // Puentes cortos de +5 V para los 9 canales de interruptores DIP
  'w-swa-vcc-3': { archHeightY: 1.15 },
  'w-swa-vcc-2': { archHeightY: 1.15 },
  'w-swa-vcc-1': { archHeightY: 1.15 },
  'w-swa-vcc-0': { archHeightY: 1.15 },
  'w-swb-vcc-3': { archHeightY: 1.15 },
  'w-swb-vcc-2': { archHeightY: 1.15 },
  'w-swb-vcc-1': { archHeightY: 1.15 },
  'w-swb-vcc-0': { archHeightY: 1.15 },
  'w-swc0-vcc': { archHeightY: 1.15 },

  // =========================================================================
  // CORREDORES ESCALONADOS DE ENTRADAS (A3..A0, B3..B0 y C0)
  // 4 señales pasan al banco superior (z < 0) por huecos libres del canal central;
  // 5 señales discurren por carriles paralelos separados en el banco inferior (z > 0).
  // =========================================================================

  // Carril inferior L3 (z = +0.89): A3 (h4 -> h28)
  'w-sig-a3': {
    waypoints: [
      { x: columnToX(5.3), y: 1.22, z: 0.89 },
      { x: columnToX(16.0), y: 1.28, z: 0.89 },
      { x: columnToX(26.7), y: 1.22, z: 0.89 },
    ],
  },

  // Carril inferior L2 (z = +0.75): A2 (g5 -> g30)
  'w-sig-a2': {
    waypoints: [
      { x: columnToX(6.3), y: 1.19, z: 0.74 },
      { x: columnToX(17.5), y: 1.25, z: 0.75 },
      { x: columnToX(28.7), y: 1.19, z: 0.72 },
    ],
  },

  // Carril inferior L6 exterior (z = +1.28): A1 (i6 -> i35)
  'w-sig-a1': {
    waypoints: [
      { x: columnToX(7.3), y: 1.25, z: 1.27 },
      { x: columnToX(20.5), y: 1.31, z: 1.28 },
      { x: columnToX(33.7), y: 1.25, z: 1.25 },
    ],
  },

  // Carril superior U1 exterior (z = -1.17): A0 (g7 -> b34), cruza por hueco libre col 8.5
  'w-sig-a0': {
    waypoints: [
      { x: columnToX(8.25), y: 1.22, z: 0.48 },
      { x: columnToX(8.55), y: 1.27, z: -0.35 },
      { x: columnToX(9.4), y: 1.25, z: -1.17 },
      { x: columnToX(21.2), y: 1.31, z: -1.17 },
      { x: columnToX(32.8), y: 1.24, z: -1.15 },
    ],
  },

  // Carril inferior bajo L1 (z = +0.50, y = 1.14) -> cruce libre col 22.5 -> U4 (z = -0.58): B3 (g10 -> d28)
  'w-sig-b3': {
    waypoints: [
      { x: columnToX(11.1), y: 1.14, z: 0.5 },
      { x: columnToX(16.5), y: 1.14, z: 0.5 },
      { x: columnToX(21.8), y: 1.15, z: 0.48 },
      { x: columnToX(22.5), y: 1.21, z: -0.08 },
      { x: columnToX(23.3), y: 1.2, z: -0.58 },
      { x: columnToX(26.9), y: 1.19, z: -0.61 },
    ],
  },

  // Carril inferior L4 (z = +1.03): B2 (i11 -> h31)
  'w-sig-b2': {
    waypoints: [
      { x: columnToX(12.2), y: 1.21, z: 1.03 },
      { x: columnToX(21.0), y: 1.26, z: 1.03 },
      { x: columnToX(29.8), y: 1.2, z: 0.96 },
    ],
  },

  // Carril inferior L5 (z = +1.16): B1 (i12 -> h34)
  'w-sig-b1': {
    waypoints: [
      { x: columnToX(13.3), y: 1.23, z: 1.16 },
      { x: columnToX(23.0), y: 1.29, z: 1.16 },
      { x: columnToX(32.7), y: 1.22, z: 1.02 },
    ],
  },

  // Carril superior U2 (z = -0.95): B0 (g13 -> c33), paso elevado sobre L1 y cruce libre col 14.8
  'w-sig-b0': {
    waypoints: [
      { x: columnToX(13.55), y: 1.31, z: 0.61 },
      { x: columnToX(14.45), y: 1.35, z: 0.46 },
      { x: columnToX(14.85), y: 1.34, z: -0.22 },
      { x: columnToX(15.65), y: 1.25, z: -0.95 },
      { x: columnToX(24.0), y: 1.29, z: -0.95 },
      { x: columnToX(31.8), y: 1.23, z: -0.9 },
    ],
  },

  // Carril superior U3 (z = -0.76): C0 (g17 -> c31), paso elevado sobre L1 y cruce libre col 19.0
  'w-sig-c0': {
    waypoints: [
      { x: columnToX(17.55), y: 1.31, z: 0.61 },
      { x: columnToX(18.45), y: 1.35, z: 0.46 },
      { x: columnToX(19.0), y: 1.34, z: -0.2 },
      { x: columnToX(19.8), y: 1.24, z: -0.76 },
      { x: columnToX(25.2), y: 1.27, z: -0.76 },
      { x: columnToX(30.0), y: 1.22, z: -0.83 },
    ],
  },

  // =========================================================================
  // CORREDORES PARALELOS DE SALIDAS (C4 y S3..S0) EN EL BANCO SUPERIOR DERECHO
  // =========================================================================

  // Carril salida R2 (z = -1.27, bisectriz exacta entre filas a y b): C4 (b30 -> b41)
  'w-out-c4': {
    waypoints: [
      { x: columnToX(31.0), y: 1.24, z: -1.27 },
      { x: columnToX(35.5), y: 1.29, z: -1.27 },
      { x: columnToX(40.1), y: 1.24, z: -1.26 },
    ],
  },

  // Carril salida R1 perimetral superior (z = -1.55): S3 (a29 -> a45)
  'w-out-s3': {
    waypoints: [
      { x: columnToX(30.0), y: 1.17, z: -1.55 },
      { x: columnToX(37.0), y: 1.18, z: -1.55 },
      { x: columnToX(44.0), y: 1.18, z: -1.52 },
    ],
  },

  // Carril salida R4 (z = -0.88): S2 (g29 -> c49), avanza por z = +0.50 y cruza elevado en col 39.2
  'w-out-s2': {
    waypoints: [
      { x: columnToX(29.9), y: 1.15, z: 0.5 },
      { x: columnToX(34.0), y: 1.15, z: 0.5 },
      { x: columnToX(38.3), y: 1.16, z: 0.49 },
      { x: columnToX(39.1), y: 1.34, z: -0.15 },
      { x: columnToX(39.55), y: 1.34, z: -0.85 },
      { x: columnToX(44.0), y: 1.26, z: -0.88 },
      { x: columnToX(48.0), y: 1.21, z: -0.885 },
    ],
  },

  // Carril salida R3 (z = -1.01): S1 (h33 -> b53), paso elevado en col 37.2 hacia el banco superior
  'w-out-s1': {
    waypoints: [
      { x: columnToX(34.1), y: 1.22, z: 0.74 },
      { x: columnToX(36.5), y: 1.27, z: 0.72 },
      { x: columnToX(37.15), y: 1.35, z: 0.48 },
      { x: columnToX(37.35), y: 1.35, z: -0.18 },
      { x: columnToX(37.85), y: 1.34, z: -0.95 },
      { x: columnToX(45.0), y: 1.28, z: -1.01 },
      { x: columnToX(51.6), y: 1.23, z: -1.03 },
    ],
  },

  // Carril salida R5 interno (z = -0.75): S0 (c35 -> c57)
  'w-out-s0': {
    waypoints: [
      { x: columnToX(36.2), y: 1.16, z: -0.75 },
      { x: columnToX(46.0), y: 1.2, z: -0.75 },
      { x: columnToX(55.8), y: 1.17, z: -0.77 },
    ],
  },

  // Retornos cortos de cátodo (−) de los 5 LEDs al riel negativo inferior
  'w-led-gnd-c4': { archHeightY: 1.15 },
  'w-led-gnd-s3': { archHeightY: 1.15 },
  'w-led-gnd-s2': { archHeightY: 1.15 },
  'w-led-gnd-s1': { archHeightY: 1.15 },
  'w-led-gnd-s0': { archHeightY: 1.15 },
};

export interface WireRoutingObstacles {
  readonly chip?: PlacedChip74LS83 | null;
  readonly dipSwitches?: readonly DipSwitchDescriptor[];
  readonly leds?: readonly LedDescriptor[];
}

function deterministicHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function findNearestFreeTrenchX(
  preferredX: number,
  obstacles?: WireRoutingObstacles,
): number | null {
  const blockedColumns = new Set<number>();

  if (obstacles?.chip) {
    // Dejar margen de 1 columna a cada lado del integrado para no rozar su serigrafía
    for (let c = obstacles.chip.startColumn - 1; c <= obstacles.chip.startColumn + 8; c += 1) {
      blockedColumns.add(c);
    }
  }

  if (obstacles?.dipSwitches) {
    for (const sw of obstacles.dipSwitches) {
      for (let c = sw.startColumn - 1; c <= sw.endColumn + 1; c += 1) {
        blockedColumns.add(c);
      }
    }
  }

  let bestX: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let col = 1; col <= COLUMN_COUNT; col += 1) {
    if (blockedColumns.has(col)) continue;
    const cx = columnToX(col);
    const dist = Math.abs(cx - preferredX);
    if (dist < bestDist) {
      bestDist = dist;
      bestX = cx;
    }
  }

  return bestX;
}

function segmentCrossesTrenchComponent(
  startPos: Point3D,
  endPos: Point3D,
  obstacles?: WireRoutingObstacles,
): boolean {
  const crossesCenter =
    (startPos.z < -0.18 && endPos.z > 0.18) || (startPos.z > 0.18 && endPos.z < -0.18);
  if (!crossesCenter) {
    return false;
  }

  const t = (0 - startPos.z) / (endPos.z - startPos.z);
  const crossX = startPos.x + (endPos.x - startPos.x) * t;

  if (obstacles?.chip) {
    const minX = columnToX(obstacles.chip.startColumn) - 0.2;
    const maxX = columnToX(obstacles.chip.startColumn + 7) + 0.2;
    if (crossX >= minX && crossX <= maxX) {
      return true;
    }
  }

  if (obstacles?.dipSwitches) {
    for (const sw of obstacles.dipSwitches) {
      const minX = columnToX(sw.startColumn) - 0.18;
      const maxX = columnToX(sw.endColumn) + 0.18;
      if (crossX >= minX && crossX <= maxX) {
        return true;
      }
    }
  }

  return false;
}

function nudgePointAwayFromLeds(
  pt: Point3D,
  obstacles?: WireRoutingObstacles,
): Point3D {
  if (!obstacles?.leds || obstacles.leds.length === 0) {
    return pt;
  }

  let x = pt.x;
  let z = pt.z;
  const minClearance = 0.31;

  for (const led of obstacles.leds) {
    const a = getHoleById(led.anodeHoleId);
    const c = getHoleById(led.cathodeHoleId);
    if (!a || !c) continue;
    const lx = (a.position.x + c.position.x) * 0.5;
    const lz = (a.position.z + c.position.z) * 0.5;
    const dx = x - lx;
    const dz = z - lz;
    const dist = Math.hypot(dx, dz);
    if (dist < minClearance) {
      if (dist < 1e-4) {
        z += lz >= 0 ? -minClearance : minClearance;
      } else {
        const push = minClearance - dist;
        x += (dx / dist) * push;
        z += (dz / dist) * push;
      }
    }
  }

  return { x, y: pt.y, z };
}

function buildDynamicUserWireWaypoints(
  wireId: string,
  startPos: Point3D,
  endPos: Point3D,
  startTopY: number,
  endTopY: number,
  obstacles?: WireRoutingObstacles,
): readonly Point3D[] {
  const dist = Math.hypot(endPos.x - startPos.x, endPos.z - startPos.z);
  const hash = deterministicHash(`${wireId}:${startPos.x.toFixed(2)},${startPos.z.toFixed(2)}->${endPos.x.toFixed(2)},${endPos.z.toFixed(2)}`);
  const laneStep = (hash % 5) - 2; // -2 .. +2
  const heightJitter = (hash % 4) * 0.024;

  const basePeakY = Math.min(
    1.46,
    Math.max(startTopY, endTopY) + 0.055 + dist * 0.036 + heightJitter,
  );

  // Si el cable cruza entre el semibloque superior e inferior sobre el 74LS83A o un DIP switch,
  // desviarlo limpiamente por la columna libre más cercana del canal central para no cubrir la serigrafía.
  if (segmentCrossesTrenchComponent(startPos, endPos, obstacles)) {
    const preferredX = (startPos.x + endPos.x) * 0.5;
    const freeCrossX = findNearestFreeTrenchX(preferredX, obstacles);

    if (freeCrossX !== null) {
      const startBankCorridorZ =
        startPos.z < 0
          ? Math.min(-0.62, Math.max(-1.48, startPos.z + laneStep * 0.05))
          : Math.max(0.62, Math.min(1.48, startPos.z + laneStep * 0.05));
      const endBankCorridorZ =
        endPos.z < 0
          ? Math.min(-0.62, Math.max(-1.48, endPos.z - laneStep * 0.05))
          : Math.max(0.62, Math.min(1.48, endPos.z - laneStep * 0.05));

      const rawWaypoints: Point3D[] = [
        {
          x: startPos.x + (freeCrossX - startPos.x) * 0.25,
          y: basePeakY,
          z: startBankCorridorZ,
        },
        {
          x: freeCrossX,
          y: basePeakY + 0.03,
          z: startBankCorridorZ * 0.45,
        },
        {
          x: freeCrossX,
          y: basePeakY + 0.03,
          z: endBankCorridorZ * 0.45,
        },
        {
          x: endPos.x + (freeCrossX - endPos.x) * 0.25,
          y: basePeakY,
          z: endBankCorridorZ,
        },
      ];

      return rawWaypoints.map((pt) => nudgePointAwayFromLeds(pt, obstacles));
    }

    // Sin hueco libre en todo el canal central: elevar limpiamente por encima de los encapsulados
    const highY = 1.56 + heightJitter;
    return [
      {
        x: startPos.x + (endPos.x - startPos.x) * 0.28,
        y: highY,
        z: startPos.z + (endPos.z - startPos.z) * 0.28,
      },
      {
        x: (startPos.x + endPos.x) * 0.5,
        y: highY + 0.03,
        z: (startPos.z + endPos.z) * 0.5,
      },
      {
        x: startPos.x + (endPos.x - startPos.x) * 0.72,
        y: highY,
        z: startPos.z + (endPos.z - startPos.z) * 0.72,
      },
    ];
  }

  // Tramo en el mismo semibloque o puente corto: escalonar suavemente el carril lateral en tramos medios/largos
  const lateralZOffset = dist > 1.8 ? laneStep * 0.065 : 0;
  const rawPts: Point3D[] = [
    {
      x: startPos.x + (endPos.x - startPos.x) * 0.26,
      y: basePeakY,
      z: startPos.z + (endPos.z - startPos.z) * 0.26 + lateralZOffset * 0.7,
    },
    {
      x: (startPos.x + endPos.x) * 0.5,
      y: basePeakY + 0.022,
      z: (startPos.z + endPos.z) * 0.5 + lateralZOffset,
    },
    {
      x: startPos.x + (endPos.x - startPos.x) * 0.74,
      y: basePeakY,
      z: startPos.z + (endPos.z - startPos.z) * 0.74 + lateralZOffset * 0.7,
    },
  ];

  // Mantener fuera del canal central si ambos extremos están en el mismo lado
  const sameSideSign = startPos.z < -0.18 && endPos.z < -0.18 ? -1 : startPos.z > 0.18 && endPos.z > 0.18 ? 1 : 0;
  return rawPts.map((pt) => {
    let adjustedZ = pt.z;
    if (sameSideSign === -1 && adjustedZ > -0.46) {
      adjustedZ = -0.46;
    } else if (sameSideSign === 1 && adjustedZ < 0.46) {
      adjustedZ = 0.46;
    }
    return nudgePointAwayFromLeds({ x: pt.x, y: pt.y, z: adjustedZ }, obstacles);
  });
}

/**
 * Construye la secuencia de puntos 3D de control para un cable jumper,
 * asegurando entrada vertical limpia en ambos contactos y curvatura flexible natural.
 */
export function buildWireSplinePoints(
  wireId: string,
  startPos: Point3D,
  endPos: Point3D,
  obstacles?: WireRoutingObstacles,
): readonly Point3D[] {
  const route = WIRE_VISUAL_ROUTES[wireId];
  const startTopY = startPos.y + 0.145;
  const endTopY = endPos.y + 0.145;

  const points: Point3D[] = [
    { x: startPos.x, y: startPos.y + 0.05, z: startPos.z },
    { x: startPos.x, y: startTopY, z: startPos.z },
  ];

  if (route?.waypoints && route.waypoints.length > 0) {
    for (const wp of route.waypoints) {
      points.push(wp);
    }
  } else if (route?.archHeightY !== undefined) {
    const peakY = route.archHeightY;
    points.push(
      {
        x: startPos.x + (endPos.x - startPos.x) * 0.26,
        y: peakY,
        z: startPos.z + (endPos.z - startPos.z) * 0.26,
      },
      {
        x: (startPos.x + endPos.x) * 0.5,
        y: peakY + 0.022,
        z: (startPos.z + endPos.z) * 0.5,
      },
      {
        x: startPos.x + (endPos.x - startPos.x) * 0.74,
        y: peakY,
        z: startPos.z + (endPos.z - startPos.z) * 0.74,
      },
    );
  } else {
    const dynamicWaypoints = buildDynamicUserWireWaypoints(
      wireId,
      startPos,
      endPos,
      startTopY,
      endTopY,
      obstacles,
    );
    for (const wp of dynamicWaypoints) {
      points.push(wp);
    }
  }

  points.push(
    { x: endPos.x, y: endTopY, z: endPos.z },
    { x: endPos.x, y: endPos.y + 0.05, z: endPos.z },
  );

  return points;
}

/**
 * Curva ligera de 5 puntos para la previsualización fluida en vivo durante el tendido de un cable.
 */
export function buildPreviewWireSplinePoints(
  startPos: Point3D,
  endPos: Point3D,
): readonly Point3D[] {
  const dist = Math.hypot(endPos.x - startPos.x, endPos.z - startPos.z);
  const startTopY = startPos.y + 0.145;
  const endTopY = endPos.y + 0.145;
  const peakY = Math.min(1.52, Math.max(startTopY, endTopY) + 0.08 + dist * 0.045);

  return [
    { x: startPos.x, y: startPos.y + 0.05, z: startPos.z },
    { x: startPos.x, y: startTopY, z: startPos.z },
    {
      x: (startPos.x + endPos.x) * 0.5,
      y: peakY,
      z: (startPos.z + endPos.z) * 0.5,
    },
    { x: endPos.x, y: endTopY, z: endPos.z },
    { x: endPos.x, y: endPos.y + 0.05, z: endPos.z },
  ];
}
