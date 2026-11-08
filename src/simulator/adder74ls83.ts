import { PINOUT_74LS83A } from './pinout74ls83';
import type { PinNumber } from './types';

/**
 * Motor lógico digital puro del sumador binario completo de 4 bits SN74LS83A.
 * Independiente de React y Three.js.
 */

export type BitValue = 0 | 1;

/** Palabra binaria de 4 bits ordenada de LSB a MSB: [bit0, bit1, bit2, bit3]. */
export type Word4Bits = readonly [BitValue, BitValue, BitValue, BitValue];

export interface Adder74LS83Input {
  readonly a: Word4Bits;
  readonly b: Word4Bits;
  readonly c0: BitValue;
}

/**
 * Detalle didáctico de una columna (etapa de 1 bit) del sumador completo:
 * A_k + B_k + C_k = S_k + 2 * C_{k+1}
 */
export interface FullAdderStage {
  readonly bitIndex: 0 | 1 | 2 | 3;
  readonly weight: 1 | 2 | 4 | 8;
  readonly aSignal: 'A0' | 'A1' | 'A2' | 'A3';
  readonly bSignal: 'B0' | 'B1' | 'B2' | 'B3';
  readonly sumSignal: 'S0' | 'S1' | 'S2' | 'S3';
  readonly carryInName: 'C0' | 'C1' | 'C2' | 'C3';
  readonly carryOutName: 'C1' | 'C2' | 'C3' | 'C4';
  readonly aBit: BitValue;
  readonly bBit: BitValue;
  readonly carryIn: BitValue;
  readonly columnTotal: 0 | 1 | 2 | 3;
  readonly sumBit: BitValue;
  readonly carryOut: BitValue;
}

export interface FormattedAdderReadout {
  /** Representación binaria de 4 bits MSB→LSB de A (p. ej. "0111"). */
  readonly aBinary4: string;
  /** Representación binaria de 4 bits MSB→LSB de B (p. ej. "0001"). */
  readonly bBinary4: string;
  /** Representación binaria de 4 bits MSB→LSB de S3..S0 (p. ej. "1000"). */
  readonly sumBinary4: string;
  /** Resultado completo de 5 bits C4 S3 S2 S1 S0 (p. ej. "01000"). */
  readonly totalBinary5: string;
  /** Representación hexadecimal de 1 dígito para A (p. ej. "0x7"). */
  readonly aHex: string;
  /** Representación hexadecimal de 1 dígito para B (p. ej. "0x1"). */
  readonly bHex: string;
  /** Representación hexadecimal de 1 dígito para S3..S0 (p. ej. "0x8"). */
  readonly sumHex: string;
  /** Representación hexadecimal de 2 dígitos para el total de 5 bits (p. ej. "0x08" o "0x1F"). */
  readonly totalHex: string;
}

export interface Adder74LS83Output {
  readonly operandA: number;
  readonly operandB: number;
  readonly carryIn: BitValue;
  readonly operandABits: Word4Bits;
  readonly operandBBits: Word4Bits;
  /** Bits de suma [S0, S1, S2, S3] de menos a más significativo. */
  readonly sumBits: Word4Bits;
  /** Valor entero de 4 bits (0..15) representado por S3..S0. */
  readonly sumValue: number;
  /** Acarreo de salida C4 (Cout): 1 cuando A + B + C0 >= 16. */
  readonly carryOut: BitValue;
  /** Resultado aritmético total de 5 bits (0..31). */
  readonly totalValue: number;
  /** Cadena completa de acarreos [C0, C1, C2, C3, C4] de LSB a Cout. */
  readonly intermediateCarries: readonly [BitValue, BitValue, BitValue, BitValue, BitValue];
  /** Desglose columna por columna [etapa0, etapa1, etapa2, etapa3] de LSB a MSB. */
  readonly stages: readonly [FullAdderStage, FullAdderStage, FullAdderStage, FullAdderStage];
  /** Cadenas pre-formateadas en binario y hexadecimal listas para mostrar en interfaz. */
  readonly formatted: FormattedAdderReadout;
}

/** Mapa canónico de pines físicos de entrada del operando A [A0, A1, A2, A3]. */
export const INPUT_A_PINS: readonly [PinNumber, PinNumber, PinNumber, PinNumber] = [10, 8, 3, 1];

/** Mapa canónico de pines físicos de entrada del operando B [B0, B1, B2, B3]. */
export const INPUT_B_PINS: readonly [PinNumber, PinNumber, PinNumber, PinNumber] = [11, 7, 4, 16];

/** Pin físico de acarreo de entrada C0 (Cin). */
export const CARRY_IN_PIN: PinNumber = 13;

/** Mapa canónico de pines físicos de suma [S0, S1, S2, S3]. */
export const SUM_OUTPUT_PINS: readonly [PinNumber, PinNumber, PinNumber, PinNumber] = [9, 6, 2, 15];

/** Pin físico de acarreo de salida C4 (Cout). */
export const CARRY_OUT_PIN: PinNumber = 14;

/** Pines físicos de alimentación del SN74LS83A (distintos del 74LS283). */
export const VCC_PIN: PinNumber = 5;
export const GND_PIN: PinNumber = 12;

export function word4ToNumber(bits: Word4Bits): number {
  return bits[0] | (bits[1] << 1) | (bits[2] << 2) | (bits[3] << 3);
}

export function numberToWord4(value: number): Word4Bits {
  const clamped = value & 0b1111;
  return [
    (clamped & 1) as BitValue,
    ((clamped >> 1) & 1) as BitValue,
    ((clamped >> 2) & 1) as BitValue,
    ((clamped >> 3) & 1) as BitValue,
  ];
}

export function word4ToBinaryString(bits: Word4Bits): string {
  return `${bits[3]}${bits[2]}${bits[1]}${bits[0]}`;
}

function buildStage(
  bitIndex: 0 | 1 | 2 | 3,
  aBit: BitValue,
  bBit: BitValue,
  carryIn: BitValue,
): FullAdderStage {
  const weights = [1, 2, 4, 8] as const;
  const aNames = ['A0', 'A1', 'A2', 'A3'] as const;
  const bNames = ['B0', 'B1', 'B2', 'B3'] as const;
  const sNames = ['S0', 'S1', 'S2', 'S3'] as const;
  const cInNames = ['C0', 'C1', 'C2', 'C3'] as const;
  const cOutNames = ['C1', 'C2', 'C3', 'C4'] as const;

  const columnTotal = (aBit + bBit + carryIn) as 0 | 1 | 2 | 3;
  const sumBit = (columnTotal & 1) as BitValue;
  const carryOut = ((columnTotal >> 1) & 1) as BitValue;

  return {
    bitIndex,
    weight: weights[bitIndex],
    aSignal: aNames[bitIndex],
    bSignal: bNames[bitIndex],
    sumSignal: sNames[bitIndex],
    carryInName: cInNames[bitIndex],
    carryOutName: cOutNames[bitIndex],
    aBit,
    bBit,
    carryIn,
    columnTotal,
    sumBit,
    carryOut,
  };
}

/**
 * Evalúa la función aritmética, booleana y de acarreos por etapa del SN74LS83A
 * para entradas lógicas definidas y chip correctamente alimentado.
 */
export function evaluate74LS83Logic(input: Adder74LS83Input): Adder74LS83Output {
  const operandA = word4ToNumber(input.a);
  const operandB = word4ToNumber(input.b);
  const carryIn = input.c0;

  const stage0 = buildStage(0, input.a[0], input.b[0], carryIn);
  const stage1 = buildStage(1, input.a[1], input.b[1], stage0.carryOut);
  const stage2 = buildStage(2, input.a[2], input.b[2], stage1.carryOut);
  const stage3 = buildStage(3, input.a[3], input.b[3], stage2.carryOut);

  const sumBits: Word4Bits = [
    stage0.sumBit,
    stage1.sumBit,
    stage2.sumBit,
    stage3.sumBit,
  ];
  const carryOut = stage3.carryOut;
  const sumValue = word4ToNumber(sumBits);
  const totalValue = operandA + operandB + carryIn;

  const sumBinary4 = word4ToBinaryString(sumBits);

  return {
    operandA,
    operandB,
    carryIn,
    operandABits: input.a,
    operandBBits: input.b,
    sumBits,
    sumValue,
    carryOut,
    totalValue,
    intermediateCarries: [
      carryIn,
      stage0.carryOut,
      stage1.carryOut,
      stage2.carryOut,
      carryOut,
    ],
    stages: [stage0, stage1, stage2, stage3],
    formatted: {
      aBinary4: word4ToBinaryString(input.a),
      bBinary4: word4ToBinaryString(input.b),
      sumBinary4,
      totalBinary5: `${carryOut}${sumBinary4}`,
      aHex: `0x${operandA.toString(16).toUpperCase()}`,
      bHex: `0x${operandB.toString(16).toUpperCase()}`,
      sumHex: `0x${sumValue.toString(16).toUpperCase()}`,
      totalHex: `0x${totalValue.toString(16).toUpperCase().padStart(2, '0')}`,
    },
  };
}

/** Verifica que las constantes rápidas coincidan siempre con la tabla canónica PINOUT_74LS83A. */
export function getAllLogicInputPins(): readonly PinNumber[] {
  return PINOUT_74LS83A.filter((p) => p.direction === 'INPUT').map((p) => p.pinNumber);
}

export function getAllLogicOutputPins(): readonly PinNumber[] {
  return PINOUT_74LS83A.filter((p) => p.direction === 'OUTPUT').map((p) => p.pinNumber);
}
