/**
 * Tipos fundamentales de dominio para el simulador 3D del 74LS83A.
 * Independiente de React y Three.js.
 */

export type SimulatorMode = 'mounted' | 'guided';

export type PinNumber =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16;

export type SignalCode =
  | 'A0'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'B0'
  | 'B1'
  | 'B2'
  | 'B3'
  | 'C0'
  | 'S0'
  | 'S1'
  | 'S2'
  | 'S3'
  | 'C4'
  | 'VCC'
  | 'GND';

export type PinRole = 'INPUT_A' | 'INPUT_B' | 'CARRY_IN' | 'SUM_OUT' | 'CARRY_OUT' | 'POWER' | 'GROUND';

export type PinDirection = 'INPUT' | 'OUTPUT' | 'SUPPLY';

export type ElectricalState = 'UNCONNECTED' | 'LOW' | 'HIGH' | 'FLOATING' | 'SHORT_CIRCUIT';

export interface PinSpec74LS83 {
  readonly pinNumber: PinNumber;
  readonly signal: SignalCode;
  /** Notación alternativa de hojas de datos clásicas TI/Fairchild (A1–A4, B1–B4, Σ1–Σ4). */
  readonly datasheetAlias: string;
  readonly role: PinRole;
  readonly direction: PinDirection;
  /** Índice de bit 0..3 cuando aplica a operandos A, B o suma S. */
  readonly bitIndex?: 0 | 1 | 2 | 3;
  readonly shortLabel: string;
  readonly summary: string;
  readonly educationalNote: string;
}

export type UpperTerminalRow = 'a' | 'b' | 'c' | 'd' | 'e';
export type LowerTerminalRow = 'f' | 'g' | 'h' | 'i' | 'j';
export type TerminalRow = UpperTerminalRow | LowerTerminalRow;

export type PowerRailId = 'top-plus' | 'top-minus' | 'bottom-plus' | 'bottom-minus';

export interface Point3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TerminalHole {
  readonly kind: 'terminal';
  /** Ejemplo: 'e28', 'f32'. */
  readonly id: string;
  readonly row: TerminalRow;
  readonly column: number;
  /** Identificador de la pista vertical de 5 contactos conectados internamente. */
  readonly stripId: string;
  readonly label: string;
  readonly position: Point3D;
}

export interface PowerRailHole {
  readonly kind: 'rail';
  /** Ejemplo: 'rail-top-plus-1'. */
  readonly id: string;
  readonly rail: PowerRailId;
  readonly index: number;
  readonly polarity: 'PLUS' | 'MINUS';
  /** Identificador del bus de alimentación compartido. */
  readonly stripId: string;
  readonly label: string;
  readonly position: Point3D;
}

export type BreadboardHole = TerminalHole | PowerRailHole;
