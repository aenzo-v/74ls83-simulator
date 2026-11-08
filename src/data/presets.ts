import { type BitValue, numberToWord4 } from '../simulator/adder74ls83';

/**
 * Casos demostrativos rápidos para el Modo Circuito Montado.
 * Aplican posiciones reales sobre los interruptores DIP virtuales (A3..A0, B3..B0 y C0);
 * el resultado lo resuelve íntegramente el motor eléctrico del 74LS83A.
 */

export interface QuickAdditionPreset {
  readonly id: string;
  readonly label: string;
  readonly operandA: number;
  readonly operandB: number;
  readonly carryIn: BitValue;
  readonly description: string;
}

export const QUICK_ADDITION_PRESETS: readonly QuickAdditionPreset[] = [
  {
    id: 'preset-0-0',
    label: '0 + 0',
    operandA: 0,
    operandB: 0,
    carryIn: 0,
    description: 'Estado base en reposo: todas las entradas en nivel bajo (0000 + 0000 + 0 = 0).',
  },
  {
    id: 'preset-7-1',
    label: '7 + 1',
    operandA: 7,
    operandB: 1,
    carryIn: 0,
    description:
      'Propagación de acarreo interno en las 3 etapas bajas hacia S3 (0111 + 0001 = 01000₂ = 8).',
  },
  {
    id: 'preset-15-1',
    label: '15 + 1',
    operandA: 15,
    operandB: 1,
    carryIn: 0,
    description:
      'Desbordamiento de 4 bits con propagación completa a Cout C4 (1111 + 0001 = 10000₂ = 16).',
  },
  {
    id: 'preset-15-15-1',
    label: '15 + 15 + 1',
    operandA: 15,
    operandB: 15,
    carryIn: 1,
    description:
      'Capacidad máxima de 5 bits con acarreo inicial C0 activo (1111 + 1111 + 1 = 11111₂ = 31).',
  },
] as const;

/** Canales reales de interruptores DIP ordenados de LSB (bit 0) a MSB (bit 3). */
export const OPERAND_A_CHANNELS_LSB_FIRST = ['sw-a0', 'sw-a1', 'sw-a2', 'sw-a3'] as const;
export const OPERAND_B_CHANNELS_LSB_FIRST = ['sw-b0', 'sw-b1', 'sw-b2', 'sw-b3'] as const;
export const CARRY_IN_CHANNEL_ID = 'sw-c0' as const;

/**
 * Comprueba si el estado mecánico actual de los 9 interruptores DIP coincide
 * exactamente con la configuración de un ejemplo rápido.
 */
export function doesPresetMatchSwitches(
  preset: QuickAdditionPreset,
  switchStates: Readonly<Record<string, boolean>>,
): boolean {
  const expectedA = numberToWord4(preset.operandA);
  const expectedB = numberToWord4(preset.operandB);

  for (let i = 0; i < 4; i += 1) {
    if (Boolean(switchStates[OPERAND_A_CHANNELS_LSB_FIRST[i]]) !== (expectedA[i] === 1)) {
      return false;
    }
    if (Boolean(switchStates[OPERAND_B_CHANNELS_LSB_FIRST[i]]) !== (expectedB[i] === 1)) {
      return false;
    }
  }

  return Boolean(switchStates[CARRY_IN_CHANNEL_ID]) === (preset.carryIn === 1);
}
