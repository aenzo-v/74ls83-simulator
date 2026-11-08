import type {
  BreadboardHole,
  LowerTerminalRow,
  PowerRailHole,
  PowerRailId,
  TerminalHole,
  TerminalRow,
  UpperTerminalRow,
} from './types';

/**
 * Modelo geométrico y topológico de una protoboard estándar MB-102 de 830 puntos.
 *
 * Escala espacial del simulador: 1 unidad = 1 cm (10 mm).
 * Paso estándar entre perforaciones (pitch): 2.54 mm = 0.254 unidades.
 * Separación del canal central DIP (entre fila 'e' y fila 'f'): 7.62 mm = 3 * 0.254 = 0.762 unidades.
 */
export const PITCH = 0.254;
export const COLUMN_COUNT = 63;
export const CENTER_COLUMN = 32;

export const BREADBOARD_DIMENSIONS = {
  lengthX: 16.51, // 165.1 mm
  widthZ: 5.46,   // 54.6 mm
  heightY: 0.92,  // 9.2 mm
  baseHeightY: 0.62,
  trenchHalfWidthZ: 0.19,
  seamGrooveHalfWidthZ: 0.04,
} as const;

export const UPPER_TERMINAL_ROWS: readonly UpperTerminalRow[] = ['a', 'b', 'c', 'd', 'e'];
export const LOWER_TERMINAL_ROWS: readonly LowerTerminalRow[] = ['f', 'g', 'h', 'i', 'j'];
export const ALL_TERMINAL_ROWS: readonly TerminalRow[] = [
  ...UPPER_TERMINAL_ROWS,
  ...LOWER_TERMINAL_ROWS,
];

/**
 * Posición Z (en cm) de cada fila de terminales respecto al centro del canal DIP (z = 0).
 * 'e' (-1.5 * pitch) y 'f' (+1.5 * pitch) quedan exactamente a 7.62 mm (0.3") de distancia.
 */
const ROW_PITCH_MULTIPLIER: Record<TerminalRow, number> = {
  a: -5.5,
  b: -4.5,
  c: -3.5,
  d: -2.5,
  e: -1.5,
  f: 1.5,
  g: 2.5,
  h: 3.5,
  i: 4.5,
  j: 5.5,
};

const RAIL_PITCH_MULTIPLIER: Record<PowerRailId, number> = {
  'top-plus': -9.15,
  'top-minus': -8.15,
  'bottom-plus': 8.15,
  'bottom-minus': 9.15,
};

const RAIL_META: Record<
  PowerRailId,
  { polarity: 'PLUS' | 'MINUS'; stripId: string; title: string }
> = {
  'top-plus': {
    polarity: 'PLUS',
    stripId: 'rail-top-plus',
    title: 'Riel superior positivo (+)',
  },
  'top-minus': {
    polarity: 'MINUS',
    stripId: 'rail-top-minus',
    title: 'Riel superior negativo (−)',
  },
  'bottom-plus': {
    polarity: 'PLUS',
    stripId: 'rail-bottom-plus',
    title: 'Riel inferior positivo (+)',
  },
  'bottom-minus': {
    polarity: 'MINUS',
    stripId: 'rail-bottom-minus',
    title: 'Riel inferior negativo (−)',
  },
};

export function columnToX(column: number): number {
  return (column - CENTER_COLUMN) * PITCH;
}

export function rowToZ(row: TerminalRow): number {
  return ROW_PITCH_MULTIPLIER[row] * PITCH;
}

export function railToZ(rail: PowerRailId): number {
  return RAIL_PITCH_MULTIPLIER[rail] * PITCH;
}

/**
 * En una MB-102 de 830 puntos, cada riel de alimentación tiene 50 puntos organizados
 * en 10 bloques de 5 perforaciones separados por 1 paso (total 59 pasos centrados en 63 columnas:
 * columnas equivalentes 3..61).
 */
export function getPowerRailColumns(): readonly number[] {
  const columns: number[] = [];
  for (let group = 0; group < 10; group += 1) {
    const startCol = 3 + group * 6;
    for (let offset = 0; offset < 5; offset += 1) {
      columns.push(startCol + offset);
    }
  }
  return columns;
}

export const POWER_RAIL_COLUMNS: readonly number[] = getPowerRailColumns();

function buildAllBreadboardHoles(): readonly BreadboardHole[] {
  const holes: BreadboardHole[] = [];
  const surfaceY = BREADBOARD_DIMENSIONS.heightY;

  for (let col = 1; col <= COLUMN_COUNT; col += 1) {
    const x = columnToX(col);

    for (const row of ALL_TERMINAL_ROWS) {
      const isUpper = row === 'a' || row === 'b' || row === 'c' || row === 'd' || row === 'e';
      const bankName = isUpper ? 'upper' : 'lower';
      const stripRange = isUpper ? 'a–e' : 'f–j';
      const id = `${row}${col}`;
      const hole: TerminalHole = {
        kind: 'terminal',
        id,
        row,
        column: col,
        stripId: `strip-${bankName}-${col}`,
        label: `Nodo ${id} (pista ${stripRange} col. ${col})`,
        position: { x, y: surfaceY, z: rowToZ(row) },
      };
      holes.push(hole);
    }
  }

  const railIds: readonly PowerRailId[] = [
    'top-plus',
    'top-minus',
    'bottom-plus',
    'bottom-minus',
  ];

  for (const rail of railIds) {
    const meta = RAIL_META[rail];
    const z = railToZ(rail);
    POWER_RAIL_COLUMNS.forEach((equivCol, idx) => {
      const index = idx + 1;
      const hole: PowerRailHole = {
        kind: 'rail',
        id: `rail-${rail}-${index}`,
        rail,
        index,
        polarity: meta.polarity,
        stripId: meta.stripId,
        label: `${meta.title} · Punto ${index}`,
        position: { x: columnToX(equivCol), y: surfaceY, z },
      };
      holes.push(hole);
    });
  }

  return holes;
}

export const ALL_BREADBOARD_HOLES: readonly BreadboardHole[] = buildAllBreadboardHoles();

const HOLE_BY_ID = new Map<string, BreadboardHole>(
  ALL_BREADBOARD_HOLES.map((hole) => [hole.id, hole]),
);

const HOLES_BY_STRIP = new Map<string, BreadboardHole[]>();
for (const hole of ALL_BREADBOARD_HOLES) {
  const existing = HOLES_BY_STRIP.get(hole.stripId);
  if (existing) {
    existing.push(hole);
  } else {
    HOLES_BY_STRIP.set(hole.stripId, [hole]);
  }
}

export function getHoleById(id: string): BreadboardHole | undefined {
  return HOLE_BY_ID.get(id);
}

export function getStripHoles(stripId: string): readonly BreadboardHole[] {
  return HOLES_BY_STRIP.get(stripId) ?? [];
}

/**
 * Encuentra la perforación más cercana a un punto (x, z) sobre la superficie de la protoboard
 * dentro de un radio máximo de tolerancia (por defecto medio paso = 1.27 mm).
 */
export function findNearestHoleXZ(
  x: number,
  z: number,
  maxRadius = PITCH * 0.48,
): BreadboardHole | undefined {
  const maxDistSq = maxRadius * maxRadius;
  let bestHole: BreadboardHole | undefined;
  let bestDistSq = maxDistSq;

  for (const hole of ALL_BREADBOARD_HOLES) {
    const dx = hole.position.x - x;
    const dz = hole.position.z - z;
    const distSq = dx * dx + dz * dz;
    if (distSq <= bestDistSq) {
      bestDistSq = distSq;
      bestHole = hole;
    }
  }

  return bestHole;
}
