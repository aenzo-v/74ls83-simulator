import type { Point3D, SignalCode } from './types';

/**
 * Modelo declarativo de componentes electrónicos pasivos, activos y conexiones eléctricas
 * para el circuito del 74LS83A. Independiente de React y Three.js.
 *
 * NOTA ARQUITECTÓNICA: Los descriptores de cables contienen exclusivamente identidad eléctrica
 * y terminales extremos; las trayectorias curvas 3D residen por separado en `src/data/wireRouting.ts`.
 */

export type ResistorBandColor =
  | 'BLACK'
  | 'BROWN'
  | 'RED'
  | 'ORANGE'
  | 'YELLOW'
  | 'GREEN'
  | 'BLUE'
  | 'VIOLET'
  | 'GRAY'
  | 'WHITE'
  | 'GOLD';

export interface DipSwitchChannel {
  readonly id: string;
  readonly index: number;
  readonly signal: SignalCode;
  readonly label: string;
  /** Agujero en fila superior ('e') conectado a alimentación a través de puente. */
  readonly inputHoleId: string;
  /** Agujero en fila inferior ('f') conectado a la señal conmutada y resistencia pull-down. */
  readonly outputHoleId: string;
  readonly defaultOn: boolean;
}

export interface DipSwitchDescriptor {
  readonly kind: 'dip-switch';
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly startColumn: number;
  readonly endColumn: number;
  readonly channels: readonly DipSwitchChannel[];
}

export interface ResistorDescriptor {
  readonly kind: 'resistor';
  readonly id: string;
  readonly label: string;
  readonly ohms: number;
  readonly formattedValue: string;
  readonly tolerance: string;
  readonly bands: readonly [
    ResistorBandColor,
    ResistorBandColor,
    ResistorBandColor,
    ResistorBandColor,
  ];
  readonly role: 'PULL_DOWN' | 'LED_LIMITER';
  readonly associatedSignal: SignalCode;
  readonly leadAHoleId: string;
  readonly leadBHoleId: string;
  readonly technicalNote: string;
}

export type LedLensColor = 'GREEN' | 'AMBER';

export interface LedDescriptor {
  readonly kind: 'led';
  readonly id: string;
  readonly label: string;
  readonly signal: SignalCode;
  readonly color: LedLensColor;
  /** Terminal positivo (pata más larga) conectado a la salida de la resistencia limitadora. */
  readonly anodeHoleId: string;
  /** Terminal negativo (pata corta / bisel plano del encapsulado) conectado a GND. */
  readonly cathodeHoleId: string;
  readonly forwardVoltageNominal: number;
  readonly technicalNote: string;
}

export interface PowerSupplyDescriptor {
  readonly kind: 'power-supply';
  readonly id: string;
  readonly label: string;
  readonly nominalVoltage: 5;
  readonly maxCurrentMa: number;
  readonly chassisPosition: Point3D;
  readonly plusTerminalId: string;
  readonly plusTerminalPosition: Point3D;
  readonly gndTerminalId: string;
  readonly gndTerminalPosition: Point3D;
  readonly technicalNote: string;
}

export type JumperWireCategory =
  | 'POWER_VCC'
  | 'POWER_GND'
  | 'INPUT_A'
  | 'INPUT_B'
  | 'CARRY_IN'
  | 'OUTPUT_SUM'
  | 'OUTPUT_CARRY';

export interface JumperWireDescriptor {
  readonly id: string;
  readonly label: string;
  readonly category: JumperWireCategory;
  readonly signal?: SignalCode;
  /** Identificador de agujero de protoboard o terminal de fuente ('psu-5v:plus' / 'psu-5v:gnd'). */
  readonly fromTerminalId: string;
  readonly toTerminalId: string;
  readonly colorHex: string;
}

export type PassiveOrActiveComponent =
  | DipSwitchDescriptor
  | ResistorDescriptor
  | LedDescriptor
  | PowerSupplyDescriptor;
