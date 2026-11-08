import { columnToX, getHoleById } from '../simulator/breadboard';
import type {
  DipSwitchDescriptor,
  JumperWireDescriptor,
  LedDescriptor,
  PassiveOrActiveComponent,
  PowerSupplyDescriptor,
  ResistorDescriptor,
} from '../simulator/components';
import type { CircuitSolverInput } from '../simulator/netlist';
import { getDip16PinHoleId, PINOUT_74LS83A } from '../simulator/pinout74ls83';
import type { PinNumber, PinSpec74LS83, Point3D } from '../simulator/types';

/**
 * Única fuente de verdad para el emplazamiento físico y eléctrico del circuito 74LS83A.
 * Compartida íntegramente entre Modo Circuito Montado y Modo Montaje Guiado.
 *
 * NOTA: Las conexiones de `JUMPER_WIRES` describen exclusivamente los terminales eléctricos
 * conectados; los puntos de control de las curvas 3D residen en `src/data/wireRouting.ts`.
 */
export const CHIP_74LS83_PLACEMENT = {
  id: 'ic-74ls83a',
  partNumber: 'SN74LS83AN',
  shortName: '74LS83A',
  description: 'Sumador binario completo de 4 bits con acarreo rápido (DIP-16)',
  startColumn: 28,
  endColumn: 35,
  notchOrientation: 'LEFT' as const,
  upperRow: 'e' as const,
  lowerRow: 'f' as const,
} as const;

export interface MountedPinTerminal {
  readonly spec: PinSpec74LS83;
  readonly holeId: string;
  readonly stripLabel: string;
}

export const CHIP_74LS83_MOUNTED_PINS: readonly MountedPinTerminal[] = PINOUT_74LS83A.map(
  (spec) => {
    const holeId = getDip16PinHoleId(spec.pinNumber, CHIP_74LS83_PLACEMENT.startColumn);
    const hole = getHoleById(holeId);
    const col = hole && hole.kind === 'terminal' ? hole.column : CHIP_74LS83_PLACEMENT.startColumn;
    const isLower = spec.pinNumber <= 8;
    return {
      spec,
      holeId,
      stripLabel: isLower ? `f${col}–j${col}` : `a${col}–e${col}`,
    };
  },
);

export function getMountedPinTerminal(pinNumber: PinNumber): MountedPinTerminal {
  const found = CHIP_74LS83_MOUNTED_PINS.find((entry) => entry.spec.pinNumber === pinNumber);
  if (!found) {
    throw new Error(`No se encontró terminal montada para el pin ${pinNumber}`);
  }
  return found;
}

export function getChipCenterX(): number {
  const xStart = columnToX(CHIP_74LS83_PLACEMENT.startColumn);
  const xEnd = columnToX(CHIP_74LS83_PLACEMENT.endColumn);
  return (xStart + xEnd) * 0.5;
}

/**
 * 1. Módulo de alimentación regulada de laboratorio (+5.0 V CC y GND).
 */
export const POWER_SUPPLY_5V: PowerSupplyDescriptor = {
  kind: 'power-supply',
  id: 'psu-5v',
  label: 'Fuente Regulada +5.0 V CC',
  nominalVoltage: 5,
  maxCurrentMa: 500,
  chassisPosition: { x: -6.6, y: 0, z: -3.95 },
  plusTerminalId: 'psu-5v:plus',
  plusTerminalPosition: { x: -7.22, y: 1.13, z: -3.48 },
  gndTerminalId: 'psu-5v:gnd',
  gndTerminalPosition: { x: -5.98, y: 1.13, z: -3.48 },
  technicalNote:
    'Suministra tensión regulada nominal de +5.0 V CC para lógica TTL de baja potencia (74LS). Alimenta los rieles de distribución de la protoboard.',
};

/**
 * 2. Interruptores DIP montados sobre el canal central (filas 'e' y 'f').
 * Orden MSB -> LSB de izquierda a derecha para lectura binaria natural.
 */
export const DIP_SWITCHES: readonly DipSwitchDescriptor[] = [
  {
    kind: 'dip-switch',
    id: 'dip-sw-a',
    label: 'Interruptor DIP-4 · Operando A',
    description: 'Selector binario de 4 bits para el primer sumando A (A3..A0).',
    startColumn: 4,
    endColumn: 7,
    channels: [
      {
        id: 'sw-a3',
        index: 1,
        signal: 'A3',
        label: 'A3 (MSB)',
        inputHoleId: 'e4',
        outputHoleId: 'f4',
        defaultOn: false,
      },
      {
        id: 'sw-a2',
        index: 2,
        signal: 'A2',
        label: 'A2',
        inputHoleId: 'e5',
        outputHoleId: 'f5',
        defaultOn: false,
      },
      {
        id: 'sw-a1',
        index: 3,
        signal: 'A1',
        label: 'A1',
        inputHoleId: 'e6',
        outputHoleId: 'f6',
        defaultOn: false,
      },
      {
        id: 'sw-a0',
        index: 4,
        signal: 'A0',
        label: 'A0 (LSB)',
        inputHoleId: 'e7',
        outputHoleId: 'f7',
        defaultOn: false,
      },
    ],
  },
  {
    kind: 'dip-switch',
    id: 'dip-sw-b',
    label: 'Interruptor DIP-4 · Operando B',
    description: 'Selector binario de 4 bits para el segundo sumando B (B3..B0).',
    startColumn: 10,
    endColumn: 13,
    channels: [
      {
        id: 'sw-b3',
        index: 1,
        signal: 'B3',
        label: 'B3 (MSB)',
        inputHoleId: 'e10',
        outputHoleId: 'f10',
        defaultOn: false,
      },
      {
        id: 'sw-b2',
        index: 2,
        signal: 'B2',
        label: 'B2',
        inputHoleId: 'e11',
        outputHoleId: 'f11',
        defaultOn: false,
      },
      {
        id: 'sw-b1',
        index: 3,
        signal: 'B1',
        label: 'B1',
        inputHoleId: 'e12',
        outputHoleId: 'f12',
        defaultOn: false,
      },
      {
        id: 'sw-b0',
        index: 4,
        signal: 'B0',
        label: 'B0 (LSB)',
        inputHoleId: 'e13',
        outputHoleId: 'f13',
        defaultOn: false,
      },
    ],
  },
  {
    kind: 'dip-switch',
    id: 'dip-sw-c0',
    label: 'Interruptor DIP-1 · Acarreo C0',
    description: 'Selector de 1 bit para el acarreo de entrada C0 (Cin).',
    startColumn: 17,
    endColumn: 17,
    channels: [
      {
        id: 'sw-c0',
        index: 1,
        signal: 'C0',
        label: 'C0 (Cin)',
        inputHoleId: 'e17',
        outputHoleId: 'f17',
        defaultOn: false,
      },
    ],
  },
] as const;

const PULLDOWN_NOTE_330 =
  'Resistencia pull-down de 330 Ω (Naranja-Naranja-Marrón-Oro). Garantiza un nivel bajo válido (< 0.8 V) ante la corriente de entrada IIL de una puerta LS-TTL cuando el interruptor está abierto (OFF).';

const LED_LIMITER_NOTE_1K =
  'Resistencia limitadora en serie de 1 kΩ (Marrón-Negro-Rojo-Oro). Limita la corriente demandada a la etapa de salida totem-pole del 74LS83A (IOH nominal = −0.4 mA) empleando LEDs de alta eficiencia.';

/**
 * 3. Conjunto completo de resistencias axiales (9 pull-down de 330 Ω + 5 limitadoras de 1 kΩ).
 */
export const RESISTORS: readonly ResistorDescriptor[] = [
  {
    kind: 'resistor',
    id: 'r-pd-a3',
    label: 'Resistencia Pull-Down A3',
    ohms: 330,
    formattedValue: '330 Ω',
    tolerance: '±5%',
    bands: ['ORANGE', 'ORANGE', 'BROWN', 'GOLD'],
    role: 'PULL_DOWN',
    associatedSignal: 'A3',
    leadAHoleId: 'j4',
    leadBHoleId: 'rail-bottom-minus-2',
    technicalNote: PULLDOWN_NOTE_330,
  },
  {
    kind: 'resistor',
    id: 'r-pd-a2',
    label: 'Resistencia Pull-Down A2',
    ohms: 330,
    formattedValue: '330 Ω',
    tolerance: '±5%',
    bands: ['ORANGE', 'ORANGE', 'BROWN', 'GOLD'],
    role: 'PULL_DOWN',
    associatedSignal: 'A2',
    leadAHoleId: 'j5',
    leadBHoleId: 'rail-bottom-minus-3',
    technicalNote: PULLDOWN_NOTE_330,
  },
  {
    kind: 'resistor',
    id: 'r-pd-a1',
    label: 'Resistencia Pull-Down A1',
    ohms: 330,
    formattedValue: '330 Ω',
    tolerance: '±5%',
    bands: ['ORANGE', 'ORANGE', 'BROWN', 'GOLD'],
    role: 'PULL_DOWN',
    associatedSignal: 'A1',
    leadAHoleId: 'j6',
    leadBHoleId: 'rail-bottom-minus-4',
    technicalNote: PULLDOWN_NOTE_330,
  },
  {
    kind: 'resistor',
    id: 'r-pd-a0',
    label: 'Resistencia Pull-Down A0',
    ohms: 330,
    formattedValue: '330 Ω',
    tolerance: '±5%',
    bands: ['ORANGE', 'ORANGE', 'BROWN', 'GOLD'],
    role: 'PULL_DOWN',
    associatedSignal: 'A0',
    leadAHoleId: 'j7',
    leadBHoleId: 'rail-bottom-minus-5',
    technicalNote: PULLDOWN_NOTE_330,
  },
  {
    kind: 'resistor',
    id: 'r-pd-b3',
    label: 'Resistencia Pull-Down B3',
    ohms: 330,
    formattedValue: '330 Ω',
    tolerance: '±5%',
    bands: ['ORANGE', 'ORANGE', 'BROWN', 'GOLD'],
    role: 'PULL_DOWN',
    associatedSignal: 'B3',
    leadAHoleId: 'j10',
    leadBHoleId: 'rail-bottom-minus-7',
    technicalNote: PULLDOWN_NOTE_330,
  },
  {
    kind: 'resistor',
    id: 'r-pd-b2',
    label: 'Resistencia Pull-Down B2',
    ohms: 330,
    formattedValue: '330 Ω',
    tolerance: '±5%',
    bands: ['ORANGE', 'ORANGE', 'BROWN', 'GOLD'],
    role: 'PULL_DOWN',
    associatedSignal: 'B2',
    leadAHoleId: 'j11',
    leadBHoleId: 'rail-bottom-minus-8',
    technicalNote: PULLDOWN_NOTE_330,
  },
  {
    kind: 'resistor',
    id: 'r-pd-b1',
    label: 'Resistencia Pull-Down B1',
    ohms: 330,
    formattedValue: '330 Ω',
    tolerance: '±5%',
    bands: ['ORANGE', 'ORANGE', 'BROWN', 'GOLD'],
    role: 'PULL_DOWN',
    associatedSignal: 'B1',
    leadAHoleId: 'j12',
    leadBHoleId: 'rail-bottom-minus-9',
    technicalNote: PULLDOWN_NOTE_330,
  },
  {
    kind: 'resistor',
    id: 'r-pd-b0',
    label: 'Resistencia Pull-Down B0',
    ohms: 330,
    formattedValue: '330 Ω',
    tolerance: '±5%',
    bands: ['ORANGE', 'ORANGE', 'BROWN', 'GOLD'],
    role: 'PULL_DOWN',
    associatedSignal: 'B0',
    leadAHoleId: 'j13',
    leadBHoleId: 'rail-bottom-minus-10',
    technicalNote: PULLDOWN_NOTE_330,
  },
  {
    kind: 'resistor',
    id: 'r-pd-c0',
    label: 'Resistencia Pull-Down C0',
    ohms: 330,
    formattedValue: '330 Ω',
    tolerance: '±5%',
    bands: ['ORANGE', 'ORANGE', 'BROWN', 'GOLD'],
    role: 'PULL_DOWN',
    associatedSignal: 'C0',
    leadAHoleId: 'j17',
    leadBHoleId: 'rail-bottom-minus-13',
    technicalNote: PULLDOWN_NOTE_330,
  },
  {
    kind: 'resistor',
    id: 'r-led-c4',
    label: 'Resistencia Serie LED C4',
    ohms: 1000,
    formattedValue: '1 kΩ',
    tolerance: '±5%',
    bands: ['BROWN', 'BLACK', 'RED', 'GOLD'],
    role: 'LED_LIMITER',
    associatedSignal: 'C4',
    leadAHoleId: 'd41',
    leadBHoleId: 'f41',
    technicalNote: LED_LIMITER_NOTE_1K,
  },
  {
    kind: 'resistor',
    id: 'r-led-s3',
    label: 'Resistencia Serie LED S3',
    ohms: 1000,
    formattedValue: '1 kΩ',
    tolerance: '±5%',
    bands: ['BROWN', 'BLACK', 'RED', 'GOLD'],
    role: 'LED_LIMITER',
    associatedSignal: 'S3',
    leadAHoleId: 'd45',
    leadBHoleId: 'f45',
    technicalNote: LED_LIMITER_NOTE_1K,
  },
  {
    kind: 'resistor',
    id: 'r-led-s2',
    label: 'Resistencia Serie LED S2',
    ohms: 1000,
    formattedValue: '1 kΩ',
    tolerance: '±5%',
    bands: ['BROWN', 'BLACK', 'RED', 'GOLD'],
    role: 'LED_LIMITER',
    associatedSignal: 'S2',
    leadAHoleId: 'd49',
    leadBHoleId: 'f49',
    technicalNote: LED_LIMITER_NOTE_1K,
  },
  {
    kind: 'resistor',
    id: 'r-led-s1',
    label: 'Resistencia Serie LED S1',
    ohms: 1000,
    formattedValue: '1 kΩ',
    tolerance: '±5%',
    bands: ['BROWN', 'BLACK', 'RED', 'GOLD'],
    role: 'LED_LIMITER',
    associatedSignal: 'S1',
    leadAHoleId: 'd53',
    leadBHoleId: 'f53',
    technicalNote: LED_LIMITER_NOTE_1K,
  },
  {
    kind: 'resistor',
    id: 'r-led-s0',
    label: 'Resistencia Serie LED S0',
    ohms: 1000,
    formattedValue: '1 kΩ',
    tolerance: '±5%',
    bands: ['BROWN', 'BLACK', 'RED', 'GOLD'],
    role: 'LED_LIMITER',
    associatedSignal: 'S0',
    leadAHoleId: 'd57',
    leadBHoleId: 'f57',
    technicalNote: LED_LIMITER_NOTE_1K,
  },
] as const;

/**
 * 4. Indicadores LED de 5 mm dispuestos en orden MSB -> LSB (C4, S3, S2, S1, S0).
 */
export const OUTPUT_LEDS: readonly LedDescriptor[] = [
  {
    kind: 'led',
    id: 'led-c4',
    label: 'LED C4 · Acarreo de salida (Cout)',
    signal: 'C4',
    color: 'AMBER',
    anodeHoleId: 'i41',
    cathodeHoleId: 'i42',
    forwardVoltageNominal: 2.0,
    technicalNote:
      'LED ámbar de 5 mm para distinguir el bit de desbordamiento/acarreo C4 (peso 16). El bisel plano lateral identifica el cátodo (−).',
  },
  {
    kind: 'led',
    id: 'led-s3',
    label: 'LED S3 · Suma Bit 3 (MSB)',
    signal: 'S3',
    color: 'GREEN',
    anodeHoleId: 'i45',
    cathodeHoleId: 'i46',
    forwardVoltageNominal: 2.1,
    technicalNote:
      'LED verde de 5 mm para el bit S3 (peso 8). Conduce únicamente cuando el ánodo supera Vf respecto al cátodo conectado a GND.',
  },
  {
    kind: 'led',
    id: 'led-s2',
    label: 'LED S2 · Suma Bit 2',
    signal: 'S2',
    color: 'GREEN',
    anodeHoleId: 'i49',
    cathodeHoleId: 'i50',
    forwardVoltageNominal: 2.1,
    technicalNote:
      'LED verde de 5 mm para el bit S2 (peso 4). Montado con paso natural de 2.54 mm entre ánodo (+) y cátodo (−).',
  },
  {
    kind: 'led',
    id: 'led-s1',
    label: 'LED S1 · Suma Bit 1',
    signal: 'S1',
    color: 'GREEN',
    anodeHoleId: 'i53',
    cathodeHoleId: 'i54',
    forwardVoltageNominal: 2.1,
    technicalNote: 'LED verde de 5 mm para el bit S1 (peso 2).',
  },
  {
    kind: 'led',
    id: 'led-s0',
    label: 'LED S0 · Suma Bit 0 (LSB)',
    signal: 'S0',
    color: 'GREEN',
    anodeHoleId: 'i57',
    cathodeHoleId: 'i58',
    forwardVoltageNominal: 2.1,
    technicalNote: 'LED verde de 5 mm para el bit menos significativo S0 (peso 1).',
  },
] as const;

export const WIRE_COLORS = {
  vcc: '#D64545',      // Rojo: +5 V
  gnd: '#2E6FBE',      // Azul: GND
  inputA: '#2EB8C6',   // Cian: Entradas A
  inputB: '#836FFF',   // Violeta: Entradas B
  carryIn: '#E5A93B',  // Ámbar: Acarreo de entrada C0
  sumOut: '#42B883',   // Verde: Salidas S0–S3
  carryOut: '#E07A38', // Naranja: Acarreo de salida C4
} as const;

/**
 * 5. Definición puramente eléctrica del cableado jumper del circuito canónico.
 * Cada par (fromTerminalId, toTerminalId) enlaza exactamente las pistas requeridas por el 74LS83A.
 */
export const JUMPER_WIRES: readonly JumperWireDescriptor[] = [
  // Alimentación principal desde la fuente regulada hacia los rieles superiores
  {
    id: 'w-psu-vcc',
    label: 'Alimentación principal +5 V a riel superior (+)',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'psu-5v:plus',
    toTerminalId: 'rail-top-plus-1',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-psu-gnd',
    label: 'Retorno principal GND a riel superior (−)',
    category: 'POWER_GND',
    signal: 'GND',
    fromTerminalId: 'psu-5v:gnd',
    toTerminalId: 'rail-top-minus-6',
    colorHex: WIRE_COLORS.gnd,
  },

  // Puentes entre rieles superiores e inferiores
  {
    id: 'w-rail-vcc',
    label: 'Puente de rieles positivos (+5 V superior ↔ inferior)',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-top-plus-50',
    toTerminalId: 'rail-bottom-plus-50',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-rail-gnd',
    label: 'Puente de rieles negativos (GND superior ↔ inferior)',
    category: 'POWER_GND',
    signal: 'GND',
    fromTerminalId: 'rail-top-minus-49',
    toTerminalId: 'rail-bottom-minus-49',
    colorHex: WIRE_COLORS.gnd,
  },

  // Alimentación dedicada del integrado 74LS83A (Pin 5 VCC en f32, Pin 12 GND en e32)
  {
    id: 'w-ic-vcc',
    label: 'Alimentación VCC (+5 V) al Pin 5 del 74LS83A',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-bottom-plus-25',
    toTerminalId: 'j32',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-ic-gnd',
    label: 'Referencia GND (0 V) al Pin 12 del 74LS83A',
    category: 'POWER_GND',
    signal: 'GND',
    fromTerminalId: 'rail-top-minus-25',
    toTerminalId: 'a32',
    colorHex: WIRE_COLORS.gnd,
  },

  // Puentes cortos de +5 V para las entradas de los interruptores DIP (A, B y C0)
  {
    id: 'w-swa-vcc-3',
    label: 'Puente +5 V a interruptor A3',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-top-plus-2',
    toTerminalId: 'a4',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-swa-vcc-2',
    label: 'Puente +5 V a interruptor A2',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-top-plus-3',
    toTerminalId: 'a5',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-swa-vcc-1',
    label: 'Puente +5 V a interruptor A1',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-top-plus-4',
    toTerminalId: 'a6',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-swa-vcc-0',
    label: 'Puente +5 V a interruptor A0',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-top-plus-5',
    toTerminalId: 'a7',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-swb-vcc-3',
    label: 'Puente +5 V a interruptor B3',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-top-plus-7',
    toTerminalId: 'a10',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-swb-vcc-2',
    label: 'Puente +5 V a interruptor B2',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-top-plus-8',
    toTerminalId: 'a11',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-swb-vcc-1',
    label: 'Puente +5 V a interruptor B1',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-top-plus-9',
    toTerminalId: 'a12',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-swb-vcc-0',
    label: 'Puente +5 V a interruptor B0',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-top-plus-10',
    toTerminalId: 'a13',
    colorHex: WIRE_COLORS.vcc,
  },
  {
    id: 'w-swc0-vcc',
    label: 'Puente +5 V a interruptor C0',
    category: 'POWER_VCC',
    signal: 'VCC',
    fromTerminalId: 'rail-top-plus-13',
    toTerminalId: 'a17',
    colorHex: WIRE_COLORS.vcc,
  },

  // Cables de señal del Operando A (A3..A0) hacia pines 1, 3, 8 y 10
  {
    id: 'w-sig-a3',
    label: 'Señal A3 (SW_A → Pin 1)',
    category: 'INPUT_A',
    signal: 'A3',
    fromTerminalId: 'h4',
    toTerminalId: 'h28',
    colorHex: WIRE_COLORS.inputA,
  },
  {
    id: 'w-sig-a2',
    label: 'Señal A2 (SW_A → Pin 3)',
    category: 'INPUT_A',
    signal: 'A2',
    fromTerminalId: 'g5',
    toTerminalId: 'g30',
    colorHex: WIRE_COLORS.inputA,
  },
  {
    id: 'w-sig-a1',
    label: 'Señal A1 (SW_A → Pin 8)',
    category: 'INPUT_A',
    signal: 'A1',
    fromTerminalId: 'i6',
    toTerminalId: 'i35',
    colorHex: WIRE_COLORS.inputA,
  },
  {
    id: 'w-sig-a0',
    label: 'Señal A0 (SW_A → Pin 10)',
    category: 'INPUT_A',
    signal: 'A0',
    fromTerminalId: 'g7',
    toTerminalId: 'b34',
    colorHex: WIRE_COLORS.inputA,
  },

  // Cables de señal del Operando B (B3..B0) hacia pines 16, 4, 7 y 11
  {
    id: 'w-sig-b3',
    label: 'Señal B3 (SW_B → Pin 16)',
    category: 'INPUT_B',
    signal: 'B3',
    fromTerminalId: 'g10',
    toTerminalId: 'd28',
    colorHex: WIRE_COLORS.inputB,
  },
  {
    id: 'w-sig-b2',
    label: 'Señal B2 (SW_B → Pin 4)',
    category: 'INPUT_B',
    signal: 'B2',
    fromTerminalId: 'i11',
    toTerminalId: 'h31',
    colorHex: WIRE_COLORS.inputB,
  },
  {
    id: 'w-sig-b1',
    label: 'Señal B1 (SW_B → Pin 7)',
    category: 'INPUT_B',
    signal: 'B1',
    fromTerminalId: 'i12',
    toTerminalId: 'h34',
    colorHex: WIRE_COLORS.inputB,
  },
  {
    id: 'w-sig-b0',
    label: 'Señal B0 (SW_B → Pin 11)',
    category: 'INPUT_B',
    signal: 'B0',
    fromTerminalId: 'g13',
    toTerminalId: 'c33',
    colorHex: WIRE_COLORS.inputB,
  },

  // Cable de señal de acarreo de entrada C0 hacia Pin 13
  {
    id: 'w-sig-c0',
    label: 'Señal C0 / Cin (SW_C0 → Pin 13)',
    category: 'CARRY_IN',
    signal: 'C0',
    fromTerminalId: 'g17',
    toTerminalId: 'c31',
    colorHex: WIRE_COLORS.carryIn,
  },

  // Cables de salida (C4 y S3..S0) hacia las resistencias limitadoras de los LEDs
  {
    id: 'w-out-c4',
    label: 'Salida C4 / Cout (Pin 14 → Etapa LED C4)',
    category: 'OUTPUT_CARRY',
    signal: 'C4',
    fromTerminalId: 'b30',
    toTerminalId: 'b41',
    colorHex: WIRE_COLORS.carryOut,
  },
  {
    id: 'w-out-s3',
    label: 'Salida Suma S3 (Pin 15 → Etapa LED S3)',
    category: 'OUTPUT_SUM',
    signal: 'S3',
    fromTerminalId: 'a29',
    toTerminalId: 'a45',
    colorHex: WIRE_COLORS.sumOut,
  },
  {
    id: 'w-out-s2',
    label: 'Salida Suma S2 (Pin 2 → Etapa LED S2)',
    category: 'OUTPUT_SUM',
    signal: 'S2',
    fromTerminalId: 'g29',
    toTerminalId: 'c49',
    colorHex: WIRE_COLORS.sumOut,
  },
  {
    id: 'w-out-s1',
    label: 'Salida Suma S1 (Pin 6 → Etapa LED S1)',
    category: 'OUTPUT_SUM',
    signal: 'S1',
    fromTerminalId: 'h33',
    toTerminalId: 'b53',
    colorHex: WIRE_COLORS.sumOut,
  },
  {
    id: 'w-out-s0',
    label: 'Salida Suma S0 (Pin 9 → Etapa LED S0)',
    category: 'OUTPUT_SUM',
    signal: 'S0',
    fromTerminalId: 'c35',
    toTerminalId: 'c57',
    colorHex: WIRE_COLORS.sumOut,
  },

  // Retornos cortos de cátodo (−) de los 5 LEDs al riel negativo inferior (GND)
  {
    id: 'w-led-gnd-c4',
    label: 'Retorno GND cátodo LED C4',
    category: 'POWER_GND',
    signal: 'GND',
    fromTerminalId: 'j42',
    toTerminalId: 'rail-bottom-minus-34',
    colorHex: WIRE_COLORS.gnd,
  },
  {
    id: 'w-led-gnd-s3',
    label: 'Retorno GND cátodo LED S3',
    category: 'POWER_GND',
    signal: 'GND',
    fromTerminalId: 'j46',
    toTerminalId: 'rail-bottom-minus-37',
    colorHex: WIRE_COLORS.gnd,
  },
  {
    id: 'w-led-gnd-s2',
    label: 'Retorno GND cátodo LED S2',
    category: 'POWER_GND',
    signal: 'GND',
    fromTerminalId: 'j50',
    toTerminalId: 'rail-bottom-minus-40',
    colorHex: WIRE_COLORS.gnd,
  },
  {
    id: 'w-led-gnd-s1',
    label: 'Retorno GND cátodo LED S1',
    category: 'POWER_GND',
    signal: 'GND',
    fromTerminalId: 'j54',
    toTerminalId: 'rail-bottom-minus-44',
    colorHex: WIRE_COLORS.gnd,
  },
  {
    id: 'w-led-gnd-s0',
    label: 'Retorno GND cátodo LED S0',
    category: 'POWER_GND',
    signal: 'GND',
    fromTerminalId: 'j58',
    toTerminalId: 'rail-bottom-minus-47',
    colorHex: WIRE_COLORS.gnd,
  },
] as const;

export const ALL_PASSIVE_ACTIVE_COMPONENTS: readonly PassiveOrActiveComponent[] = [
  POWER_SUPPLY_5V,
  ...DIP_SWITCHES,
  ...RESISTORS,
  ...OUTPUT_LEDS,
];

const COMPONENT_BY_ID = new Map<string, PassiveOrActiveComponent>(
  ALL_PASSIVE_ACTIVE_COMPONENTS.map((comp) => [comp.id, comp]),
);

const WIRE_BY_ID = new Map<string, JumperWireDescriptor>(
  JUMPER_WIRES.map((wire) => [wire.id, wire]),
);

export function getComponentById(id: string): PassiveOrActiveComponent | undefined {
  return COMPONENT_BY_ID.get(id);
}

export function getWireById(id: string): JumperWireDescriptor | undefined {
  return WIRE_BY_ID.get(id);
}

/**
 * Construye la entrada completa del motor eléctrico a partir de la definición canónica
 * y el estado actual de los interruptores.
 */
export function createCanonicalCircuitInput(
  switchStates: Readonly<Record<string, boolean>>,
  overrides?: Partial<CircuitSolverInput>,
): CircuitSolverInput {
  const isPowerSupplyOn =
    overrides?.isPowerSupplyOn ?? Boolean(switchStates[POWER_SUPPLY_5V.id] ?? true);

  return {
    powerSupply: POWER_SUPPLY_5V,
    isPowerSupplyOn,
    chip: {
      id: CHIP_74LS83_PLACEMENT.id,
      startColumn: CHIP_74LS83_PLACEMENT.startColumn,
      notchOrientation: CHIP_74LS83_PLACEMENT.notchOrientation,
    },
    dipSwitches: DIP_SWITCHES,
    switchStates,
    resistors: RESISTORS,
    leds: OUTPUT_LEDS,
    wires: JUMPER_WIRES,
    ...overrides,
  };
}

/**
 * Resuelve la posición 3D exacta de cualquier terminal del circuito
 * (agujeros de la protoboard o bornes de la fuente de alimentación).
 */
export function resolveTerminalPosition(terminalId: string): Point3D | undefined {
  if (terminalId === POWER_SUPPLY_5V.plusTerminalId) {
    return POWER_SUPPLY_5V.plusTerminalPosition;
  }
  if (terminalId === POWER_SUPPLY_5V.gndTerminalId) {
    return POWER_SUPPLY_5V.gndTerminalPosition;
  }
  return getHoleById(terminalId)?.position;
}

export interface GuidedStageSummary {
  readonly stepNumber: number;
  readonly title: string;
  readonly objective: string;
}

/**
 * Secuencia canónica de 9 etapas del modo Montaje Guiado (se activará interactivamente en Fase 6).
 */
export const GUIDED_ASSEMBLY_OUTLINE: readonly GuidedStageSummary[] = [
  {
    stepNumber: 1,
    title: 'Identificación de la protoboard',
    objective: 'Reconocer rieles de alimentación (+/−), pistas verticales de 5 nodos y canal central DIP.',
  },
  {
    stepNumber: 2,
    title: 'Colocación del integrado 74LS83A',
    objective: 'Insertar el DIP-16 sobre el canal central (columnas 28–35) con muesca hacia la izquierda.',
  },
  {
    stepNumber: 3,
    title: 'Alimentación VCC (+5 V) y GND',
    objective: 'Conectar el Pin 5 a +5 V y el Pin 12 a GND respetando el pinout específico del 74LS83A.',
  },
  {
    stepNumber: 4,
    title: 'Conexión de operandos A y B',
    objective: 'Cablear los 4 bits del sumando A (A0–A3) y los 4 bits del sumando B (B0–B3) desde interruptores.',
  },
  {
    stepNumber: 5,
    title: 'Conexión del acarreo de entrada C0',
    objective: 'Enlazar la entrada C0 (Pin 13) para definir un nivel lógico válido (0 o 1).',
  },
  {
    stepNumber: 6,
    title: 'Resistencias limitadoras y LEDs',
    objective: 'Ubicar las 5 etapas indicadoras de salida con resistencias adecuadas para familia LS-TTL.',
  },
  {
    stepNumber: 7,
    title: 'Cableado de salidas S0–S3 y C4',
    objective: 'Tender jumpers ordenados desde los pines 9, 6, 2, 15 (suma) y 14 (Cout) hacia los LEDs.',
  },
  {
    stepNumber: 8,
    title: 'Validación eléctrica integral',
    objective: 'Verificar continuidad de redes, ausencia de cortocircuitos y entradas sin flotación.',
  },
  {
    stepNumber: 9,
    title: 'Ejecución de sumas binarias',
    objective: 'Operar A, B y C0 en tiempo real comprobando las salidas S0–S3 y el acarreo C4.',
  },
] as const;
