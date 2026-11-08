import {
  CHIP_74LS83_PLACEMENT,
  DIP_SWITCHES,
  JUMPER_WIRES,
  OUTPUT_LEDS,
  POWER_SUPPLY_5V,
  RESISTORS,
  WIRE_COLORS,
} from '../data/circuitLayout';
import {
  ALL_BREADBOARD_HOLES,
  COLUMN_COUNT,
  columnToX,
  findNearestHoleXZ,
  getHoleById,
  PITCH,
  POWER_RAIL_COLUMNS,
} from './breadboard';
import type {
  DipSwitchDescriptor,
  JumperWireCategory,
  JumperWireDescriptor,
  LedDescriptor,
  PassiveOrActiveComponent,
  ResistorDescriptor,
} from './components';
import type { CircuitSolverInput, PlacedChip74LS83 } from './netlist';
import { getDip16PinHoleId, PINOUT_74LS83A } from './pinout74ls83';
import type { Point3D, TerminalHole } from './types';

/**
 * Arquitectura de circuito editable (Fase 5).
 *
 * Distingue estrictamente entre:
 * 1. `REFERENCE_CIRCUIT_STATE`: circuito canónico completo e inmutable de referencia.
 * 2. `WorkingCircuitState`: circuito de trabajo editable sobre el que opera el estudiante.
 * 3. Validaciones físicas de inserción en protoboard y conversión directa a `CircuitSolverInput`
 *    para reutilizar el mismo motor `solveCircuit` sin duplicar modelos electrónicos.
 */

export interface WorkingCircuitState {
  readonly chip: PlacedChip74LS83 | null;
  readonly dipSwitches: readonly DipSwitchDescriptor[];
  readonly resistors: readonly ResistorDescriptor[];
  readonly leds: readonly LedDescriptor[];
  readonly wires: readonly JumperWireDescriptor[];
  readonly nextWireSeq: number;
}

export const REFERENCE_CIRCUIT_STATE: WorkingCircuitState = Object.freeze({
  chip: Object.freeze({
    id: CHIP_74LS83_PLACEMENT.id,
    startColumn: CHIP_74LS83_PLACEMENT.startColumn,
    notchOrientation: CHIP_74LS83_PLACEMENT.notchOrientation,
  }),
  dipSwitches: DIP_SWITCHES,
  resistors: RESISTORS,
  leds: OUTPUT_LEDS,
  wires: JUMPER_WIRES,
  nextWireSeq: 1,
});

export function createEmptyWorkingCircuit(): WorkingCircuitState {
  return {
    chip: null,
    dipSwitches: [],
    resistors: [],
    leds: [],
    wires: [],
    nextWireSeq: 1,
  };
}

/**
 * Convierte cualquier circuito (de trabajo o de referencia) en la entrada exacta
 * requerida por `solveCircuit`, sin conexiones invisibles ni estados simulados.
 */
export function workingCircuitToSolverInput(
  circuit: WorkingCircuitState,
  switchStates: Readonly<Record<string, boolean>>,
): CircuitSolverInput {
  const isPowerSupplyOn = Boolean(switchStates[POWER_SUPPLY_5V.id] ?? true);
  return {
    powerSupply: POWER_SUPPLY_5V,
    isPowerSupplyOn,
    chip: circuit.chip,
    dipSwitches: circuit.dipSwitches,
    switchStates,
    resistors: circuit.resistors,
    leds: circuit.leds,
    wires: circuit.wires,
  };
}

// ============================================================================
// Catálogo del Kit Educativo 74LS83A y Paleta Visual de Cables
// ============================================================================

export type PlaceableKitItemType =
  | 'ic-74ls83a'
  | 'dip-sw-a'
  | 'dip-sw-b'
  | 'dip-sw-c0'
  | 'resistor-330'
  | 'resistor-1k'
  | 'led-amber'
  | 'led-green';

export type ResistorDisposition =
  | 'trench-bridge'
  | 'to-rail-gnd'
  | 'horizontal-4'
  | 'two-point';

export interface KitCatalogEntry {
  readonly type: PlaceableKitItemType;
  readonly shortLabel: string;
  readonly fullLabel: string;
  readonly totalCount: number;
  readonly hintEs: string;
}

export const EDITABLE_KIT_CATALOG: readonly KitCatalogEntry[] = [
  {
    type: 'ic-74ls83a',
    shortLabel: '74LS83A (DIP-16)',
    fullLabel: 'Circuito Integrado SN74LS83AN (DIP-16)',
    totalCount: 1,
    hintEs: 'Colócalo atravesando el canal central (filas e y f), con la muesca a la izquierda.',
  },
  {
    type: 'dip-sw-a',
    shortLabel: 'DIP-4 (Entr. A)',
    fullLabel: 'Interruptor DIP-4 · Operando A (A3..A0)',
    totalCount: 1,
    hintEs: 'Ocupa 4 columnas sobre el canal central (filas e y f).',
  },
  {
    type: 'dip-sw-b',
    shortLabel: 'DIP-4 (Entr. B)',
    fullLabel: 'Interruptor DIP-4 · Operando B (B3..B0)',
    totalCount: 1,
    hintEs: 'Ocupa 4 columnas sobre el canal central (filas e y f).',
  },
  {
    type: 'dip-sw-c0',
    shortLabel: 'DIP-1 (Cin C0)',
    fullLabel: 'Interruptor DIP-1 · Acarreo C0',
    totalCount: 1,
    hintEs: 'Ocupa 1 columna sobre el canal central (filas e y f).',
  },
  {
    type: 'resistor-330',
    shortLabel: 'Res. 330 Ω',
    fullLabel: 'Resistencia Axial 330 Ω (Pull-down)',
    totalCount: 9,
    hintEs: 'Conecta entre una pista de entrada y un riel GND (−) o entre dos pistas.',
  },
  {
    type: 'resistor-1k',
    shortLabel: 'Res. 1 kΩ',
    fullLabel: 'Resistencia Axial 1 kΩ (Serie LED)',
    totalCount: 5,
    hintEs: 'Limita corriente hacia el ánodo de un LED (p. ej. cruzando d ↔ f).',
  },
  {
    type: 'led-amber',
    shortLabel: 'LED Ámbar (C4)',
    fullLabel: 'LED 5 mm Ámbar · Acarreo C4',
    totalCount: 1,
    hintEs: 'Ocupa 2 columnas contiguas en la misma fila (+ ánodo, − cátodo con bisel).',
  },
  {
    type: 'led-green',
    shortLabel: 'LED Verde (Σ)',
    fullLabel: 'LED 5 mm Verde · Suma S3..S0',
    totalCount: 4,
    hintEs: 'Ocupa 2 columnas contiguas en la misma fila (+ ánodo, − cátodo con bisel).',
  },
] as const;

export interface WireColorOption {
  readonly id: string;
  readonly label: string;
  readonly conventionEs: string;
  readonly colorHex: string;
  readonly categoryHint: JumperWireCategory;
}

export const WIRE_COLOR_PALETTE: readonly WireColorOption[] = [
  {
    id: 'red',
    label: 'Rojo',
    conventionEs: 'VCC (+5 V)',
    colorHex: WIRE_COLORS.vcc,
    categoryHint: 'POWER_VCC',
  },
  {
    id: 'blue',
    label: 'Azul',
    conventionEs: 'GND (0 V)',
    colorHex: WIRE_COLORS.gnd,
    categoryHint: 'POWER_GND',
  },
  {
    id: 'cyan',
    label: 'Cian',
    conventionEs: 'Entradas A',
    colorHex: WIRE_COLORS.inputA,
    categoryHint: 'INPUT_A',
  },
  {
    id: 'violet',
    label: 'Violeta',
    conventionEs: 'Entradas B',
    colorHex: WIRE_COLORS.inputB,
    categoryHint: 'INPUT_B',
  },
  {
    id: 'amber',
    label: 'Ámbar',
    conventionEs: 'Acarreo C0',
    colorHex: WIRE_COLORS.carryIn,
    categoryHint: 'CARRY_IN',
  },
  {
    id: 'green',
    label: 'Verde',
    conventionEs: 'Salidas Suma',
    colorHex: WIRE_COLORS.sumOut,
    categoryHint: 'OUTPUT_SUM',
  },
  {
    id: 'orange',
    label: 'Naranja',
    conventionEs: 'Salida C4',
    colorHex: WIRE_COLORS.carryOut,
    categoryHint: 'OUTPUT_CARRY',
  },
] as const;

export interface KitItemAvailability {
  readonly placedCount: number;
  readonly remainingCount: number;
  readonly totalCount: number;
  readonly nextTemplateId: string | null;
}

const RESISTOR_330_POOL = RESISTORS.filter((r) => r.ohms === 330);
const RESISTOR_1K_POOL = RESISTORS.filter((r) => r.ohms === 1000);
const LED_AMBER_POOL = OUTPUT_LEDS.filter((l) => l.color === 'AMBER');
const LED_GREEN_POOL = OUTPUT_LEDS.filter((l) => l.color === 'GREEN');

export function getKitAvailability(
  circuit: WorkingCircuitState,
): Readonly<Record<PlaceableKitItemType, KitItemAvailability>> {
  const placedDipIds = new Set(circuit.dipSwitches.map((s) => s.id));
  const placedResIds = new Set(circuit.resistors.map((r) => r.id));
  const placedLedIds = new Set(circuit.leds.map((l) => l.id));

  const nextFreeId = (ids: readonly { readonly id: string }[], used: ReadonlySet<string>) =>
    ids.find((item) => !used.has(item.id))?.id ?? null;

  const r330Placed = RESISTOR_330_POOL.filter((r) => placedResIds.has(r.id)).length;
  const r1kPlaced = RESISTOR_1K_POOL.filter((r) => placedResIds.has(r.id)).length;
  const amberPlaced = LED_AMBER_POOL.filter((l) => placedLedIds.has(l.id)).length;
  const greenPlaced = LED_GREEN_POOL.filter((l) => placedLedIds.has(l.id)).length;

  return {
    'ic-74ls83a': {
      placedCount: circuit.chip ? 1 : 0,
      remainingCount: circuit.chip ? 0 : 1,
      totalCount: 1,
      nextTemplateId: circuit.chip ? null : CHIP_74LS83_PLACEMENT.id,
    },
    'dip-sw-a': {
      placedCount: placedDipIds.has('dip-sw-a') ? 1 : 0,
      remainingCount: placedDipIds.has('dip-sw-a') ? 0 : 1,
      totalCount: 1,
      nextTemplateId: placedDipIds.has('dip-sw-a') ? null : 'dip-sw-a',
    },
    'dip-sw-b': {
      placedCount: placedDipIds.has('dip-sw-b') ? 1 : 0,
      remainingCount: placedDipIds.has('dip-sw-b') ? 0 : 1,
      totalCount: 1,
      nextTemplateId: placedDipIds.has('dip-sw-b') ? null : 'dip-sw-b',
    },
    'dip-sw-c0': {
      placedCount: placedDipIds.has('dip-sw-c0') ? 1 : 0,
      remainingCount: placedDipIds.has('dip-sw-c0') ? 0 : 1,
      totalCount: 1,
      nextTemplateId: placedDipIds.has('dip-sw-c0') ? null : 'dip-sw-c0',
    },
    'resistor-330': {
      placedCount: r330Placed,
      remainingCount: RESISTOR_330_POOL.length - r330Placed,
      totalCount: RESISTOR_330_POOL.length,
      nextTemplateId: nextFreeId(RESISTOR_330_POOL, placedResIds),
    },
    'resistor-1k': {
      placedCount: r1kPlaced,
      remainingCount: RESISTOR_1K_POOL.length - r1kPlaced,
      totalCount: RESISTOR_1K_POOL.length,
      nextTemplateId: nextFreeId(RESISTOR_1K_POOL, placedResIds),
    },
    'led-amber': {
      placedCount: amberPlaced,
      remainingCount: LED_AMBER_POOL.length - amberPlaced,
      totalCount: LED_AMBER_POOL.length,
      nextTemplateId: nextFreeId(LED_AMBER_POOL, placedLedIds),
    },
    'led-green': {
      placedCount: greenPlaced,
      remainingCount: LED_GREEN_POOL.length - greenPlaced,
      totalCount: LED_GREEN_POOL.length,
      nextTemplateId: nextFreeId(LED_GREEN_POOL, placedLedIds),
    },
  };
}

// ============================================================================
// Búsqueda de Componentes y Cables en un Circuito Arbitrario
// ============================================================================

export function findComponentInCircuit(
  circuit: WorkingCircuitState,
  componentId: string,
): PassiveOrActiveComponent | undefined {
  if (componentId === POWER_SUPPLY_5V.id) {
    return POWER_SUPPLY_5V;
  }
  const sw = circuit.dipSwitches.find((c) => c.id === componentId);
  if (sw) return sw;
  const res = circuit.resistors.find((c) => c.id === componentId);
  if (res) return res;
  const led = circuit.leds.find((c) => c.id === componentId);
  if (led) return led;
  return undefined;
}

export function findWireInCircuit(
  circuit: WorkingCircuitState,
  wireId: string,
): JumperWireDescriptor | undefined {
  return circuit.wires.find((w) => w.id === wireId);
}

// ============================================================================
// Ocupación Física de Contactos y Validación Geométrica / Topológica
// ============================================================================

export type PlacementValidationCode =
  | 'VALID'
  | 'KIT_EXHAUSTED'
  | 'INVALID_TERMINAL'
  | 'SAME_TERMINAL'
  | 'SAME_STRIP'
  | 'HOLE_OCCUPIED'
  | 'OUT_OF_BOUNDS'
  | 'INVALID_TRENCH_ALIGNMENT'
  | 'INVALID_PIN_SPAN'
  | 'COMPONENT_COLLISION'
  | 'DUPLICATE_WIRE';

export interface PlacementValidationResult {
  readonly valid: boolean;
  readonly code: PlacementValidationCode;
  readonly reasonEs: string;
  readonly targetHoles: readonly string[];
}

export function isValidWireEndpoint(terminalId: string): boolean {
  if (
    terminalId === POWER_SUPPLY_5V.plusTerminalId ||
    terminalId === POWER_SUPPLY_5V.gndTerminalId
  ) {
    return true;
  }
  return getHoleById(terminalId) !== undefined;
}

/**
 * Devuelve el mapa `terminalId -> ownerId` de todos los agujeros y bornes actualmente ocupados
 * en el circuito indicado. Cada agujero admite físicamente un único terminal insertado.
 */
export function getOccupiedTerminals(
  circuit: WorkingCircuitState,
  options?: { ignoreWireId?: string; ignoreComponentId?: string },
): ReadonlyMap<string, string> {
  const occupied = new Map<string, string>();
  const ignoreComp = options?.ignoreComponentId;
  const ignoreWire = options?.ignoreWireId;

  if (circuit.chip && ignoreComp !== circuit.chip.id) {
    for (const spec of PINOUT_74LS83A) {
      const hId = getDip16PinHoleId(spec.pinNumber, circuit.chip.startColumn);
      occupied.set(hId, circuit.chip.id);
    }
  }

  for (const sw of circuit.dipSwitches) {
    if (sw.id === ignoreComp) continue;
    for (const ch of sw.channels) {
      occupied.set(ch.inputHoleId, sw.id);
      occupied.set(ch.outputHoleId, sw.id);
    }
  }

  for (const res of circuit.resistors) {
    if (res.id === ignoreComp) continue;
    occupied.set(res.leadAHoleId, res.id);
    occupied.set(res.leadBHoleId, res.id);
  }

  for (const led of circuit.leds) {
    if (led.id === ignoreComp) continue;
    occupied.set(led.anodeHoleId, led.id);
    occupied.set(led.cathodeHoleId, led.id);
  }

  for (const wire of circuit.wires) {
    if (wire.id === ignoreWire) continue;
    occupied.set(wire.fromTerminalId, wire.id);
    occupied.set(wire.toTerminalId, wire.id);
  }

  return occupied;
}

interface Box2DXZ {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

function boxesOverlapXZ(a: Box2DXZ, b: Box2DXZ): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

function segmentIntersectsBoxXZ(p1: Point3D, p2: Point3D, box: Box2DXZ): boolean {
  const steps = 20;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = p1.x + (p2.x - p1.x) * t;
    const z = p1.z + (p2.z - p1.z) * t;
    if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) {
      return true;
    }
  }
  return false;
}

function pointDistanceToSegmentXZ(px: number, pz: number, a: Point3D, b: Point3D): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-9) {
    return Math.hypot(px - a.x, pz - a.z);
  }
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / lenSq));
  const projX = a.x + t * dx;
  const projZ = a.z + t * dz;
  return Math.hypot(px - projX, pz - projZ);
}

function getStraddlingComponentBoxes(
  circuit: WorkingCircuitState,
  ignoreComponentId?: string,
): Box2DXZ[] {
  const boxes: Box2DXZ[] = [];
  if (circuit.chip && circuit.chip.id !== ignoreComponentId) {
    boxes.push({
      minX: columnToX(circuit.chip.startColumn) - 0.13,
      maxX: columnToX(circuit.chip.startColumn + 7) + 0.13,
      minZ: -0.34,
      maxZ: 0.34,
    });
  }
  for (const sw of circuit.dipSwitches) {
    if (sw.id === ignoreComponentId) continue;
    boxes.push({
      minX: columnToX(sw.startColumn) - 0.13,
      maxX: columnToX(sw.endColumn) + 0.13,
      minZ: -0.35,
      maxZ: 0.35,
    });
  }
  return boxes;
}

/**
 * Valida la colocación física del integrado SN74LS83A DIP-16 sobre el canal central.
 */
export function validateChipPlacement(
  circuit: WorkingCircuitState,
  startColumn: number,
  rowZone: 'trench' | 'off-trench' = 'trench',
): PlacementValidationResult {
  if (circuit.chip !== null) {
    return {
      valid: false,
      code: 'KIT_EXHAUSTED',
      reasonEs: 'El integrado SN74LS83A ya está colocado sobre la protoboard.',
      targetHoles: [],
    };
  }

  if (!Number.isInteger(startColumn) || startColumn < 1 || startColumn + 7 > COLUMN_COUNT) {
    return {
      valid: false,
      code: 'OUT_OF_BOUNDS',
      reasonEs: `El DIP-16 requiere 8 columnas dentro de 1–${COLUMN_COUNT} (columna inicial válida: 1–56).`,
      targetHoles: [],
    };
  }

  const targetHoles = PINOUT_74LS83A.map((spec) =>
    getDip16PinHoleId(spec.pinNumber, startColumn),
  );

  if (rowZone !== 'trench') {
    return {
      valid: false,
      code: 'INVALID_TRENCH_ALIGNMENT',
      reasonEs:
        'El DIP-16 debe montarse atravesando la ranura central (pines en filas e y f).',
      targetHoles,
    };
  }

  const occupied = getOccupiedTerminals(circuit);
  const busyHoles = targetHoles.filter((h) => occupied.has(h));
  if (busyHoles.length > 0) {
    return {
      valid: false,
      code: 'HOLE_OCCUPIED',
      reasonEs: `Conflicto físico: agujero ocupado (${busyHoles.slice(0, 3).join(', ')}).`,
      targetHoles,
    };
  }

  const candidateBox: Box2DXZ = {
    minX: columnToX(startColumn) - 0.13,
    maxX: columnToX(startColumn + 7) + 0.13,
    minZ: -0.34,
    maxZ: 0.34,
  };

  for (const box of getStraddlingComponentBoxes(circuit)) {
    if (boxesOverlapXZ(candidateBox, box)) {
      return {
        valid: false,
        code: 'COMPONENT_COLLISION',
        reasonEs: 'El encapsulado colisiona con otro componente del canal central.',
        targetHoles,
      };
    }
  }

  for (const res of circuit.resistors) {
    const hA = getHoleById(res.leadAHoleId);
    const hB = getHoleById(res.leadBHoleId);
    if (hA && hB && segmentIntersectsBoxXZ(hA.position, hB.position, candidateBox)) {
      return {
        valid: false,
        code: 'COMPONENT_COLLISION',
        reasonEs: `Colisión física con la resistencia ${res.formattedValue} (${res.leadAHoleId}–${res.leadBHoleId}).`,
        targetHoles,
      };
    }
  }

  return {
    valid: true,
    code: 'VALID',
    reasonEs: `Posición válida: SN74LS83A en columnas ${startColumn}–${startColumn + 7} (Pin 1 en f${startColumn}).`,
    targetHoles,
  };
}

/**
 * Valida la colocación física de un interruptor DIP sobre el canal central (filas e y f).
 */
export function validateDipSwitchPlacement(
  circuit: WorkingCircuitState,
  templateId: 'dip-sw-a' | 'dip-sw-b' | 'dip-sw-c0',
  startColumn: number,
  rowZone: 'trench' | 'off-trench' = 'trench',
): PlacementValidationResult {
  const template = DIP_SWITCHES.find((s) => s.id === templateId);
  if (!template) {
    return {
      valid: false,
      code: 'INVALID_TERMINAL',
      reasonEs: `Plantilla de interruptor desconocida: ${templateId}.`,
      targetHoles: [],
    };
  }

  if (circuit.dipSwitches.some((s) => s.id === templateId)) {
    return {
      valid: false,
      code: 'KIT_EXHAUSTED',
      reasonEs: `${template.label} ya está montado en la protoboard.`,
      targetHoles: [],
    };
  }

  const spanCols = template.channels.length;
  const endColumn = startColumn + spanCols - 1;

  if (!Number.isInteger(startColumn) || startColumn < 1 || endColumn > COLUMN_COUNT) {
    return {
      valid: false,
      code: 'OUT_OF_BOUNDS',
      reasonEs: `El interruptor sobresale de los límites de columnas (1–${COLUMN_COUNT - spanCols + 1}).`,
      targetHoles: [],
    };
  }

  const targetHoles: string[] = [];
  for (let i = 0; i < spanCols; i += 1) {
    const col = startColumn + i;
    targetHoles.push(`e${col}`, `f${col}`);
  }

  if (rowZone !== 'trench') {
    return {
      valid: false,
      code: 'INVALID_TRENCH_ALIGNMENT',
      reasonEs: 'El interruptor DIP debe montarse atravesando el canal central (filas e y f).',
      targetHoles,
    };
  }

  const occupied = getOccupiedTerminals(circuit);
  const busyHoles = targetHoles.filter((h) => occupied.has(h));
  if (busyHoles.length > 0) {
    return {
      valid: false,
      code: 'HOLE_OCCUPIED',
      reasonEs: `Conflicto físico: agujero ocupado (${busyHoles.slice(0, 3).join(', ')}).`,
      targetHoles,
    };
  }

  const candidateBox: Box2DXZ = {
    minX: columnToX(startColumn) - 0.13,
    maxX: columnToX(endColumn) + 0.13,
    minZ: -0.35,
    maxZ: 0.35,
  };

  for (const box of getStraddlingComponentBoxes(circuit)) {
    if (boxesOverlapXZ(candidateBox, box)) {
      return {
        valid: false,
        code: 'COMPONENT_COLLISION',
        reasonEs: 'Colisión física con otro componente en el canal central.',
        targetHoles,
      };
    }
  }

  for (const res of circuit.resistors) {
    const hA = getHoleById(res.leadAHoleId);
    const hB = getHoleById(res.leadBHoleId);
    if (hA && hB && segmentIntersectsBoxXZ(hA.position, hB.position, candidateBox)) {
      return {
        valid: false,
        code: 'COMPONENT_COLLISION',
        reasonEs: `Colisión física con la resistencia ${res.leadAHoleId}–${res.leadBHoleId}.`,
        targetHoles,
      };
    }
  }

  return {
    valid: true,
    code: 'VALID',
    reasonEs: `Posición válida: ${template.label} en columna${spanCols > 1 ? `s ${startColumn}–${endColumn}` : ` ${startColumn}`}.`,
    targetHoles,
  };
}

/**
 * Valida la colocación física de un diodo LED de 5 mm en dos columnas adyacentes de terminales.
 */
export function validateLedPlacement(
  circuit: WorkingCircuitState,
  templateId: string | null,
  anodeHoleId: string,
  cathodeHoleId: string,
): PlacementValidationResult {
  if (!templateId || circuit.leds.some((l) => l.id === templateId)) {
    return {
      valid: false,
      code: 'KIT_EXHAUSTED',
      reasonEs: 'No quedan LEDs de este color disponibles en la bandeja del kit.',
      targetHoles: [],
    };
  }

  const anodeHole = getHoleById(anodeHoleId);
  const cathodeHole = getHoleById(cathodeHoleId);

  if (!anodeHole || !cathodeHole) {
    return {
      valid: false,
      code: 'INVALID_TERMINAL',
      reasonEs: 'Las patas del LED deben insertarse en perforaciones existentes.',
      targetHoles: [],
    };
  }

  const targetHoles = [anodeHoleId, cathodeHoleId];

  if (anodeHole.kind !== 'terminal' || cathodeHole.kind !== 'terminal') {
    return {
      valid: false,
      code: 'INVALID_PIN_SPAN',
      reasonEs: 'Coloca el LED sobre pistas de terminales (filas a–e o f–j), no sobre los rieles.',
      targetHoles,
    };
  }

  if (
    anodeHole.row !== cathodeHole.row ||
    Math.abs(anodeHole.column - cathodeHole.column) !== 1
  ) {
    return {
      valid: false,
      code: 'INVALID_PIN_SPAN',
      reasonEs:
        'El LED de 5 mm requiere dos columnas adyacentes de la misma fila (paso 2.54 mm).',
      targetHoles,
    };
  }

  const occupied = getOccupiedTerminals(circuit);
  if (occupied.has(anodeHoleId) || occupied.has(cathodeHoleId)) {
    const busy = [anodeHoleId, cathodeHoleId].filter((h) => occupied.has(h));
    return {
      valid: false,
      code: 'HOLE_OCCUPIED',
      reasonEs: `Agujero ocupado (${busy.join(', ')}).`,
      targetHoles,
    };
  }

  const cx = (anodeHole.position.x + cathodeHole.position.x) * 0.5;
  const cz = (anodeHole.position.z + cathodeHole.position.z) * 0.5;

  // Verificar que la cápsula de 5 mm (radio ~0.245 cm) no colisione con otros LEDs, ICs o resistencias
  for (const other of circuit.leds) {
    const oA = getHoleById(other.anodeHoleId);
    const oC = getHoleById(other.cathodeHoleId);
    if (!oA || !oC) continue;
    const ox = (oA.position.x + oC.position.x) * 0.5;
    const oz = (oA.position.z + oC.position.z) * 0.5;
    if (Math.hypot(cx - ox, cz - oz) < 0.46) {
      return {
        valid: false,
        code: 'COMPONENT_COLLISION',
        reasonEs: 'La cápsula de 5 mm choca físicamente con un LED contiguo.',
        targetHoles,
      };
    }
  }

  for (const box of getStraddlingComponentBoxes(circuit)) {
    const ledBox: Box2DXZ = {
      minX: cx - 0.24,
      maxX: cx + 0.24,
      minZ: cz - 0.24,
      maxZ: cz + 0.24,
    };
    if (boxesOverlapXZ(ledBox, box)) {
      return {
        valid: false,
        code: 'COMPONENT_COLLISION',
        reasonEs: 'La cápsula del LED colisiona con un encapsulado del canal central.',
        targetHoles,
      };
    }
  }

  for (const res of circuit.resistors) {
    const hA = getHoleById(res.leadAHoleId);
    const hB = getHoleById(res.leadBHoleId);
    if (hA && hB && pointDistanceToSegmentXZ(cx, cz, hA.position, hB.position) < 0.22) {
      return {
        valid: false,
        code: 'COMPONENT_COLLISION',
        reasonEs: `Colisión física con la resistencia ${res.leadAHoleId}–${res.leadBHoleId}.`,
        targetHoles,
      };
    }
  }

  return {
    valid: true,
    code: 'VALID',
    reasonEs: `LED listo: Ánodo (+) en ${anodeHoleId}, Cátodo (−) en ${cathodeHoleId}.`,
    targetHoles,
  };
}

/**
 * Valida la colocación física de una resistencia axial entre dos agujeros de la protoboard.
 */
export function validateResistorPlacement(
  circuit: WorkingCircuitState,
  templateId: string | null,
  leadAHoleId: string,
  leadBHoleId: string,
): PlacementValidationResult {
  if (!templateId || circuit.resistors.some((r) => r.id === templateId)) {
    return {
      valid: false,
      code: 'KIT_EXHAUSTED',
      reasonEs: 'Ya se han colocado todas las resistencias de este valor del kit.',
      targetHoles: [],
    };
  }

  const holeA = getHoleById(leadAHoleId);
  const holeB = getHoleById(leadBHoleId);

  if (!holeA || !holeB) {
    return {
      valid: false,
      code: 'INVALID_TERMINAL',
      reasonEs: 'Ambas patas de la resistencia deben insertarse en agujeros válidos.',
      targetHoles: [],
    };
  }

  if (leadAHoleId === leadBHoleId) {
    return {
      valid: false,
      code: 'SAME_TERMINAL',
      reasonEs: 'No es posible insertar ambas terminales en el mismo agujero.',
      targetHoles: [leadAHoleId],
    };
  }

  const targetHoles = [leadAHoleId, leadBHoleId];

  if (holeA.stripId === holeB.stripId) {
    return {
      valid: false,
      code: 'SAME_STRIP',
      reasonEs:
        'Ambas patas caen en la misma pista conductora (la resistencia quedaría en cortocircuito).',
      targetHoles,
    };
  }

  const dist = Math.hypot(
    holeB.position.x - holeA.position.x,
    holeB.position.z - holeA.position.z,
  );
  if (dist < PITCH * 0.95 || dist > PITCH * 9.5) {
    return {
      valid: false,
      code: 'INVALID_PIN_SPAN',
      reasonEs: 'Separación física inválida para el cuerpo axial (admitido: 1 a 9 pasos).',
      targetHoles,
    };
  }

  const occupied = getOccupiedTerminals(circuit);
  if (occupied.has(leadAHoleId) || occupied.has(leadBHoleId)) {
    const busy = targetHoles.filter((h) => occupied.has(h));
    return {
      valid: false,
      code: 'HOLE_OCCUPIED',
      reasonEs: `Agujero ocupado (${busy.join(', ')}).`,
      targetHoles,
    };
  }

  // Comprobar colisión con encapsulados DIP o cápsulas de LEDs
  for (const box of getStraddlingComponentBoxes(circuit)) {
    if (segmentIntersectsBoxXZ(holeA.position, holeB.position, box)) {
      return {
        valid: false,
        code: 'COMPONENT_COLLISION',
        reasonEs: 'El cuerpo de la resistencia atraviesa un componente del canal central.',
        targetHoles,
      };
    }
  }

  for (const led of circuit.leds) {
    const lA = getHoleById(led.anodeHoleId);
    const lC = getHoleById(led.cathodeHoleId);
    if (!lA || !lC) continue;
    const lx = (lA.position.x + lC.position.x) * 0.5;
    const lz = (lA.position.z + lC.position.z) * 0.5;
    if (pointDistanceToSegmentXZ(lx, lz, holeA.position, holeB.position) < 0.22) {
      return {
        valid: false,
        code: 'COMPONENT_COLLISION',
        reasonEs: `El cuerpo de la resistencia choca con el LED en ${led.anodeHoleId}/${led.cathodeHoleId}.`,
        targetHoles,
      };
    }
  }

  return {
    valid: true,
    code: 'VALID',
    reasonEs: `Resistencia alineada entre ${leadAHoleId} y ${leadBHoleId}.`,
    targetHoles,
  };
}

/**
 * Valida la creación o reemplazo de un cable jumper entre dos contactos existentes.
 */
export function validateWireConnection(
  circuit: WorkingCircuitState,
  fromTerminalId: string,
  toTerminalId: string,
  options?: { replaceWireId?: string },
): PlacementValidationResult {
  if (!isValidWireEndpoint(fromTerminalId) || !isValidWireEndpoint(toTerminalId)) {
    return {
      valid: false,
      code: 'INVALID_TERMINAL',
      reasonEs: 'Uno de los extremos seleccionados no corresponde a un contacto válido.',
      targetHoles: [],
    };
  }

  if (fromTerminalId === toTerminalId) {
    return {
      valid: false,
      code: 'SAME_TERMINAL',
      reasonEs: 'El origen y el destino del cable deben ser contactos distintos.',
      targetHoles: [fromTerminalId],
    };
  }

  const targetHoles = [fromTerminalId, toTerminalId];
  const occupied = getOccupiedTerminals(circuit, { ignoreWireId: options?.replaceWireId });

  if (occupied.has(fromTerminalId)) {
    return {
      valid: false,
      code: 'HOLE_OCCUPIED',
      reasonEs: `El contacto de origen (${fromTerminalId}) ya está ocupado.`,
      targetHoles,
    };
  }

  if (occupied.has(toTerminalId)) {
    return {
      valid: false,
      code: 'HOLE_OCCUPIED',
      reasonEs: `El contacto de destino (${toTerminalId}) ya está ocupado.`,
      targetHoles,
    };
  }

  const duplicate = circuit.wires.some(
    (w) =>
      w.id !== options?.replaceWireId &&
      ((w.fromTerminalId === fromTerminalId && w.toTerminalId === toTerminalId) ||
        (w.fromTerminalId === toTerminalId && w.toTerminalId === fromTerminalId)),
  );
  if (duplicate) {
    return {
      valid: false,
      code: 'DUPLICATE_WIRE',
      reasonEs: 'Ya existe un cable entre esos dos mismos contactos.',
      targetHoles,
    };
  }

  return {
    valid: true,
    code: 'VALID',
    reasonEs: `Conexión válida: ${fromTerminalId} → ${toTerminalId}.`,
    targetHoles,
  };
}

// ============================================================================
// Snapping Magnético a la Cuadrícula de 2.54 mm para Previsualización 3D
// ============================================================================

export function snapPointToColumn(x: number): number {
  return Math.round(x / PITCH + 32);
}

export function resolveDipFootprintAtPoint(
  x: number,
  z: number,
  spanColumns: number,
): { readonly startColumn: number; readonly rowZone: 'trench' | 'off-trench' } {
  const halfOffset = Math.floor((spanColumns - 1) * 0.5);
  const rawCol = snapPointToColumn(x) - halfOffset;
  const rowZone: 'trench' | 'off-trench' = Math.abs(z) <= 1.08 ? 'trench' : 'off-trench';
  return { startColumn: rawCol, rowZone };
}

export function resolveLedFootprintAtPoint(
  x: number,
  z: number,
  reversedPolarity = false,
): { readonly anodeHoleId: string; readonly cathodeHoleId: string } | null {
  const nearest = findNearestHoleXZ(x, z, PITCH * 0.95);
  if (!nearest) {
    return null;
  }
  if (nearest.kind !== 'terminal') {
    return { anodeHoleId: nearest.id, cathodeHoleId: nearest.id };
  }
  const leftCol = Math.min(COLUMN_COUNT - 1, Math.max(1, nearest.column));
  const rightCol = leftCol + 1;
  const leftId = `${nearest.row}${leftCol}`;
  const rightId = `${nearest.row}${rightCol}`;
  return reversedPolarity
    ? { anodeHoleId: rightId, cathodeHoleId: leftId }
    : { anodeHoleId: leftId, cathodeHoleId: rightId };
}

export function findNearestRailHoleForColumn(
  column: number,
  railId: 'top-minus' | 'bottom-minus' | 'top-plus' | 'bottom-plus',
): string | null {
  let bestIdx = -1;
  let bestDiff = Number.POSITIVE_INFINITY;
  POWER_RAIL_COLUMNS.forEach((railCol, idx) => {
    const diff = Math.abs(railCol - column);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = idx + 1;
    }
  });
  if (bestIdx < 1 || bestDiff > 1.5) {
    return null;
  }
  return `rail-${railId}-${bestIdx}`;
}

export function resolveResistorPresetFootprintAtPoint(
  x: number,
  z: number,
  disposition: Exclude<ResistorDisposition, 'two-point'>,
): { readonly leadAHoleId: string; readonly leadBHoleId: string } | null {
  const col = snapPointToColumn(x);

  if (disposition === 'trench-bridge') {
    if (col < 1 || col > COLUMN_COUNT) {
      return null;
    }
    return {
      leadAHoleId: `d${col}`,
      leadBHoleId: `f${col}`,
    };
  }

  const nearest = findNearestHoleXZ(x, z, PITCH * 1.15);
  if (!nearest) {
    return null;
  }

  if (disposition === 'to-rail-gnd') {
    const isLowerSide = z >= 0;
    const clampedCol = Math.max(1, Math.min(COLUMN_COUNT, col));
    const termRow = isLowerSide ? 'j' : 'a';
    const railId = isLowerSide ? 'bottom-minus' : 'top-minus';
    const railHoleId = findNearestRailHoleForColumn(clampedCol, railId);
    if (!railHoleId) {
      return { leadAHoleId: `${termRow}${clampedCol}`, leadBHoleId: `${termRow}${clampedCol}` };
    }
    return {
      leadAHoleId: `${termRow}${clampedCol}`,
      leadBHoleId: railHoleId,
    };
  }

  // 'horizontal-4': 4 pasos horizontales sobre la misma fila de terminales
  if (nearest.kind !== 'terminal') {
    return { leadAHoleId: nearest.id, leadBHoleId: nearest.id };
  }
  const startCol = Math.max(1, Math.min(COLUMN_COUNT - 4, (nearest as TerminalHole).column));
  const endCol = startCol + 4;
  return {
    leadAHoleId: `${nearest.row}${startCol}`,
    leadBHoleId: `${nearest.row}${endCol}`,
  };
}

// ============================================================================
// Mutaciones Inmutables Puras del Circuito de Trabajo
// ============================================================================

export type CircuitMutationOutcome<TExtra = object> =
  | ({
      readonly ok: true;
      readonly circuit: WorkingCircuitState;
      readonly summaryEs: string;
    } & TExtra)
  | {
      readonly ok: false;
      readonly code: PlacementValidationCode;
      readonly reasonEs: string;
    };

export function placeChipInCircuit(
  circuit: WorkingCircuitState,
  startColumn: number,
  rowZone: 'trench' | 'off-trench' = 'trench',
): CircuitMutationOutcome<{ readonly placedComponentId: string }> {
  const check = validateChipPlacement(circuit, startColumn, rowZone);
  if (!check.valid) {
    return { ok: false, code: check.code, reasonEs: check.reasonEs };
  }

  const placed: PlacedChip74LS83 = {
    id: CHIP_74LS83_PLACEMENT.id,
    startColumn,
    notchOrientation: 'LEFT',
  };

  return {
    ok: true,
    placedComponentId: placed.id,
    summaryEs: `Integrado SN74LS83A colocado en columnas ${startColumn}–${startColumn + 7}.`,
    circuit: {
      ...circuit,
      chip: placed,
    },
  };
}

export function placeDipSwitchInCircuit(
  circuit: WorkingCircuitState,
  templateId: 'dip-sw-a' | 'dip-sw-b' | 'dip-sw-c0',
  startColumn: number,
  rowZone: 'trench' | 'off-trench' = 'trench',
): CircuitMutationOutcome<{ readonly placedComponentId: string }> {
  const check = validateDipSwitchPlacement(circuit, templateId, startColumn, rowZone);
  if (!check.valid) {
    return { ok: false, code: check.code, reasonEs: check.reasonEs };
  }

  const template = DIP_SWITCHES.find((s) => s.id === templateId)!;
  const spanCols = template.channels.length;
  const endColumn = startColumn + spanCols - 1;

  const placed: DipSwitchDescriptor = {
    ...template,
    startColumn,
    endColumn,
    channels: template.channels.map((ch, idx) => ({
      ...ch,
      inputHoleId: `e${startColumn + idx}`,
      outputHoleId: `f${startColumn + idx}`,
    })),
  };

  return {
    ok: true,
    placedComponentId: placed.id,
    summaryEs: `${placed.label} colocado en columna${spanCols > 1 ? `s ${startColumn}–${endColumn}` : ` ${startColumn}`}.`,
    circuit: {
      ...circuit,
      dipSwitches: [...circuit.dipSwitches, placed],
    },
  };
}

export function placeResistorInCircuit(
  circuit: WorkingCircuitState,
  ohms: 330 | 1000,
  leadAHoleId: string,
  leadBHoleId: string,
): CircuitMutationOutcome<{ readonly placedComponentId: string }> {
  const availability = getKitAvailability(circuit);
  const poolKey = ohms === 330 ? 'resistor-330' : 'resistor-1k';
  const templateId = availability[poolKey].nextTemplateId;

  const check = validateResistorPlacement(circuit, templateId, leadAHoleId, leadBHoleId);
  if (!check.valid || !templateId) {
    return { ok: false, code: check.code, reasonEs: check.reasonEs };
  }

  const template = RESISTORS.find((r) => r.id === templateId)!;
  const placed: ResistorDescriptor = {
    ...template,
    label:
      ohms === 330
        ? `Resistencia 330 Ω (${leadAHoleId}–${leadBHoleId})`
        : `Resistencia 1 kΩ (${leadAHoleId}–${leadBHoleId})`,
    leadAHoleId,
    leadBHoleId,
  };

  return {
    ok: true,
    placedComponentId: placed.id,
    summaryEs: `Resistencia ${placed.formattedValue} insertada en ${leadAHoleId}–${leadBHoleId}.`,
    circuit: {
      ...circuit,
      resistors: [...circuit.resistors, placed],
    },
  };
}

export function placeLedInCircuit(
  circuit: WorkingCircuitState,
  color: 'AMBER' | 'GREEN',
  anodeHoleId: string,
  cathodeHoleId: string,
): CircuitMutationOutcome<{ readonly placedComponentId: string }> {
  const availability = getKitAvailability(circuit);
  const poolKey = color === 'AMBER' ? 'led-amber' : 'led-green';
  const templateId = availability[poolKey].nextTemplateId;

  const check = validateLedPlacement(circuit, templateId, anodeHoleId, cathodeHoleId);
  if (!check.valid || !templateId) {
    return { ok: false, code: check.code, reasonEs: check.reasonEs };
  }

  const template = OUTPUT_LEDS.find((l) => l.id === templateId)!;
  const placed: LedDescriptor = {
    ...template,
    label:
      color === 'AMBER'
        ? `LED Ámbar 5 mm (+${anodeHoleId} / −${cathodeHoleId})`
        : `LED Verde 5 mm (+${anodeHoleId} / −${cathodeHoleId})`,
    anodeHoleId,
    cathodeHoleId,
  };

  return {
    ok: true,
    placedComponentId: placed.id,
    summaryEs: `${color === 'AMBER' ? 'LED Ámbar' : 'LED Verde'} insertado (+${anodeHoleId} / −${cathodeHoleId}).`,
    circuit: {
      ...circuit,
      leds: [...circuit.leds, placed],
    },
  };
}

function inferVisualWireCategory(colorHex: string): JumperWireCategory {
  const match = WIRE_COLOR_PALETTE.find(
    (c) => c.colorHex.toLowerCase() === colorHex.toLowerCase(),
  );
  return match?.categoryHint ?? 'INPUT_A';
}

export function addWireToCircuit(
  circuit: WorkingCircuitState,
  fromTerminalId: string,
  toTerminalId: string,
  colorHex: string,
): CircuitMutationOutcome<{ readonly createdWire: JumperWireDescriptor }> {
  const check = validateWireConnection(circuit, fromTerminalId, toTerminalId);
  if (!check.valid) {
    return { ok: false, code: check.code, reasonEs: check.reasonEs };
  }

  const wireId = `uw-${circuit.nextWireSeq}`;
  const createdWire: JumperWireDescriptor = {
    id: wireId,
    label: `Cable ${wireId} (${fromTerminalId} → ${toTerminalId})`,
    category: inferVisualWireCategory(colorHex),
    fromTerminalId,
    toTerminalId,
    colorHex,
  };

  return {
    ok: true,
    createdWire,
    summaryEs: `Cable conectado: ${fromTerminalId} → ${toTerminalId}.`,
    circuit: {
      ...circuit,
      wires: [...circuit.wires, createdWire],
      nextWireSeq: circuit.nextWireSeq + 1,
    },
  };
}

export function replaceWireInCircuit(
  circuit: WorkingCircuitState,
  wireId: string,
  newFromTerminalId: string,
  newToTerminalId: string,
  colorHex?: string,
): CircuitMutationOutcome<{ readonly updatedWire: JumperWireDescriptor }> {
  const existing = circuit.wires.find((w) => w.id === wireId);
  if (!existing) {
    return {
      ok: false,
      code: 'INVALID_TERMINAL',
      reasonEs: `No existe el cable ${wireId} para reemplazar.`,
    };
  }

  const check = validateWireConnection(circuit, newFromTerminalId, newToTerminalId, {
    replaceWireId: wireId,
  });
  if (!check.valid) {
    return { ok: false, code: check.code, reasonEs: check.reasonEs };
  }

  const nextColor = colorHex ?? existing.colorHex;
  const updatedWire: JumperWireDescriptor = {
    ...existing,
    label: `Cable ${existing.id} (${newFromTerminalId} → ${newToTerminalId})`,
    fromTerminalId: newFromTerminalId,
    toTerminalId: newToTerminalId,
    colorHex: nextColor,
    category: inferVisualWireCategory(nextColor),
  };

  return {
    ok: true,
    updatedWire,
    summaryEs: `Cable ${wireId} reconectado: ${newFromTerminalId} → ${newToTerminalId}.`,
    circuit: {
      ...circuit,
      wires: circuit.wires.map((w) => (w.id === wireId ? updatedWire : w)),
    },
  };
}

export function updateWireColorInCircuit(
  circuit: WorkingCircuitState,
  wireId: string,
  colorHex: string,
): WorkingCircuitState {
  return {
    ...circuit,
    wires: circuit.wires.map((w) =>
      w.id === wireId
        ? { ...w, colorHex, category: inferVisualWireCategory(colorHex) }
        : w,
    ),
  };
}

export function removeWireFromCircuit(
  circuit: WorkingCircuitState,
  wireId: string,
): { readonly removed: boolean; readonly circuit: WorkingCircuitState; readonly summaryEs: string } {
  const target = circuit.wires.find((w) => w.id === wireId);
  if (!target) {
    return {
      removed: false,
      circuit,
      summaryEs: `El cable ${wireId} no se encontró en el circuito.`,
    };
  }

  return {
    removed: true,
    summaryEs: `Cable eliminado (${target.fromTerminalId} → ${target.toTerminalId}).`,
    circuit: {
      ...circuit,
      wires: circuit.wires.filter((w) => w.id !== wireId),
    },
  };
}

/**
 * Obtiene las pistas locales (terminales de 5 nodos) donde se insertan las patas de un componente,
 * así como los cables jumper conectados directamente a esas pistas locales.
 */
export function findWiresAssociatedWithComponent(
  circuit: WorkingCircuitState,
  componentId: string,
): readonly JumperWireDescriptor[] {
  const terminalHoleIds: string[] = [];

  if (circuit.chip && circuit.chip.id === componentId) {
    for (const spec of PINOUT_74LS83A) {
      terminalHoleIds.push(getDip16PinHoleId(spec.pinNumber, circuit.chip.startColumn));
    }
  } else {
    const sw = circuit.dipSwitches.find((s) => s.id === componentId);
    if (sw) {
      for (const ch of sw.channels) {
        terminalHoleIds.push(ch.inputHoleId, ch.outputHoleId);
      }
    }
    const res = circuit.resistors.find((r) => r.id === componentId);
    if (res) {
      terminalHoleIds.push(res.leadAHoleId, res.leadBHoleId);
    }
    const led = circuit.leds.find((l) => l.id === componentId);
    if (led) {
      terminalHoleIds.push(led.anodeHoleId, led.cathodeHoleId);
    }
  }

  // Considerar únicamente pistas locales de terminales (no rieles globales de 50 puntos)
  const localStrips = new Set<string>();
  for (const hId of terminalHoleIds) {
    const hole = getHoleById(hId);
    if (hole && hole.kind === 'terminal') {
      localStrips.add(hole.stripId);
    }
  }

  if (localStrips.size === 0) {
    return [];
  }

  return circuit.wires.filter((w) => {
    const fromStrip = getHoleById(w.fromTerminalId)?.stripId;
    const toStrip = getHoleById(w.toTerminalId)?.stripId;
    return (
      (fromStrip !== undefined && localStrips.has(fromStrip)) ||
      (toStrip !== undefined && localStrips.has(toStrip))
    );
  });
}

/**
 * Retira un componente del circuito de trabajo, liberando sus perforaciones,
 * devolviendo los canales de interruptor eliminados (para limpiar `switchStates` sin dejar
 * continuidad fantasma) y retirando opcionalmente los cables asociados a sus pistas locales.
 */
export function removeComponentFromCircuit(
  circuit: WorkingCircuitState,
  componentId: string,
  options?: { cascadeWires?: boolean },
): {
  readonly removed: boolean;
  readonly circuit: WorkingCircuitState;
  readonly removedWireIds: readonly string[];
  readonly removedSwitchChannelIds: readonly string[];
  readonly summaryEs: string;
} {
  if (componentId === POWER_SUPPLY_5V.id) {
    return {
      removed: false,
      circuit,
      removedWireIds: [],
      removedSwitchChannelIds: [],
      summaryEs: 'La fuente regulada de +5 V es un instrumento fijo del banco.',
    };
  }

  const associatedWires = options?.cascadeWires
    ? findWiresAssociatedWithComponent(circuit, componentId)
    : [];
  const wireIdsToRemove = new Set(associatedWires.map((w) => w.id));
  const remainingWires =
    wireIdsToRemove.size > 0
      ? circuit.wires.filter((w) => !wireIdsToRemove.has(w.id))
      : circuit.wires;

  if (circuit.chip && circuit.chip.id === componentId) {
    return {
      removed: true,
      removedWireIds: [...wireIdsToRemove],
      removedSwitchChannelIds: [],
      summaryEs:
        wireIdsToRemove.size > 0
          ? `SN74LS83A retirado junto con ${wireIdsToRemove.size} cable(s) asociado(s).`
          : 'Integrado SN74LS83A retirado de la protoboard.',
      circuit: {
        ...circuit,
        chip: null,
        wires: remainingWires,
      },
    };
  }

  const targetSw = circuit.dipSwitches.find((s) => s.id === componentId);
  if (targetSw) {
    const removedSwitchChannelIds = targetSw.channels.map((ch) => ch.id);
    return {
      removed: true,
      removedWireIds: [...wireIdsToRemove],
      removedSwitchChannelIds,
      summaryEs:
        wireIdsToRemove.size > 0
          ? `${targetSw.label} retirado junto con ${wireIdsToRemove.size} cable(s).`
          : `${targetSw.label} retirado de la protoboard.`,
      circuit: {
        ...circuit,
        dipSwitches: circuit.dipSwitches.filter((s) => s.id !== componentId),
        wires: remainingWires,
      },
    };
  }

  const targetRes = circuit.resistors.find((r) => r.id === componentId);
  if (targetRes) {
    return {
      removed: true,
      removedWireIds: [...wireIdsToRemove],
      removedSwitchChannelIds: [],
      summaryEs:
        wireIdsToRemove.size > 0
          ? `${targetRes.label} retirada junto con ${wireIdsToRemove.size} cable(s).`
          : `${targetRes.label} retirada de la protoboard.`,
      circuit: {
        ...circuit,
        resistors: circuit.resistors.filter((r) => r.id !== componentId),
        wires: remainingWires,
      },
    };
  }

  const targetLed = circuit.leds.find((l) => l.id === componentId);
  if (targetLed) {
    return {
      removed: true,
      removedWireIds: [...wireIdsToRemove],
      removedSwitchChannelIds: [],
      summaryEs:
        wireIdsToRemove.size > 0
          ? `${targetLed.label} retirado junto con ${wireIdsToRemove.size} cable(s).`
          : `${targetLed.label} retirado de la protoboard.`,
      circuit: {
        ...circuit,
        leds: circuit.leds.filter((l) => l.id !== componentId),
        wires: remainingWires,
      },
    };
  }

  return {
    removed: false,
    circuit,
    removedWireIds: [],
    removedSwitchChannelIds: [],
    summaryEs: `No se encontró el componente ${componentId} en el circuito de trabajo.`,
  };
}

/**
 * Construye los terminales de los 16 pines del 74LS83A para cualquier columna de inserción.
 */
export function getChipMountedTerminalsForColumn(startColumn: number) {
  return PINOUT_74LS83A.map((spec) => {
    const holeId = getDip16PinHoleId(spec.pinNumber, startColumn);
    const hole = getHoleById(holeId);
    const col = hole && hole.kind === 'terminal' ? hole.column : startColumn;
    const isLower = spec.pinNumber <= 8;
    return {
      spec,
      holeId,
      stripLabel: isLower ? `f${col}–j${col}` : `a${col}–e${col}`,
    };
  });
}

// Garantizar que la constante ALL_BREADBOARD_HOLES esté inicializada al cargar el módulo
void ALL_BREADBOARD_HOLES.length;
