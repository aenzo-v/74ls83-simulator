import type { PinNumber, PinSpec74LS83, SignalCode } from './types';

/**
 * Mapa de pines canónico del circuito integrado SN74LS83A / 74LS83A (DIP-16, vista superior).
 *
 * IMPORTANTE: No confundir con el 74LS283. En el 74LS83A la alimentación está en
 * Pin 5 (VCC, +5 V) y Pin 12 (GND), no en las esquinas.
 *
 * Equivalencia con hojas de datos TI/Motorola:
 *   A0..A3 <-> A1..A4 (de LSB a MSB)
 *   B0..B3 <-> B1..B4 (de LSB a MSB)
 *   S0..S3 <-> Σ1..Σ4 (de LSB a MSB)
 *   C0     <-> Cin
 *   C4     <-> Cout
 */
export const PINOUT_74LS83A: readonly PinSpec74LS83[] = [
  {
    pinNumber: 1,
    signal: 'A3',
    datasheetAlias: 'A4',
    role: 'INPUT_A',
    direction: 'INPUT',
    bitIndex: 3,
    shortLabel: 'Entrada A · Bit 3 (MSB)',
    summary: 'Bit más significativo (peso 8) del primer sumando binario A.',
    educationalNote:
      'Junto con B3 (pin 16) y el acarreo interno del bit 2, determina el bit de suma S3 y el acarreo final C4.',
  },
  {
    pinNumber: 2,
    signal: 'S2',
    datasheetAlias: 'Σ3',
    role: 'SUM_OUT',
    direction: 'OUTPUT',
    bitIndex: 2,
    shortLabel: 'Salida Suma · Bit 2',
    summary: 'Tercer bit de la suma binaria (peso 4).',
    educationalNote:
      'Salida TTL de la tercera etapa sumadora completa interna (A2 + B2 + acarreo interno C2).',
  },
  {
    pinNumber: 3,
    signal: 'A2',
    datasheetAlias: 'A3',
    role: 'INPUT_A',
    direction: 'INPUT',
    bitIndex: 2,
    shortLabel: 'Entrada A · Bit 2',
    summary: 'Tercer bit (peso 4) del operando A.',
    educationalNote:
      'En tecnología LS-TTL, una entrada desconectada tiende a flotar en nivel alto por su emisor multiemisor interno, pero nunca debe dejarse abierta en un diseño fiable.',
  },
  {
    pinNumber: 4,
    signal: 'B2',
    datasheetAlias: 'B3',
    role: 'INPUT_B',
    direction: 'INPUT',
    bitIndex: 2,
    shortLabel: 'Entrada B · Bit 2',
    summary: 'Tercer bit (peso 4) del operando B.',
    educationalNote:
      'Se suma con A2 (pin 3) y el acarreo propagado desde los bits inferiores.',
  },
  {
    pinNumber: 5,
    signal: 'VCC',
    datasheetAlias: 'VCC (+5 V)',
    role: 'POWER',
    direction: 'SUPPLY',
    shortLabel: 'Alimentación positiva (+5 V)',
    summary: 'Alimentación nominal de +5 V CC (rango recomendado 4.75 V a 5.25 V).',
    educationalNote:
      'Rasgo distintivo del 74LS83A: VCC se ubica en el pin central 5 (y GND en el pin 12), a diferencia del 74LS283 que usa el pin 16.',
  },
  {
    pinNumber: 6,
    signal: 'S1',
    datasheetAlias: 'Σ2',
    role: 'SUM_OUT',
    direction: 'OUTPUT',
    bitIndex: 1,
    shortLabel: 'Salida Suma · Bit 1',
    summary: 'Segundo bit de la suma binaria (peso 2).',
    educationalNote:
      'Refleja el resultado parcial de A1 + B1 más el acarreo generado en el bit menos significativo.',
  },
  {
    pinNumber: 7,
    signal: 'B1',
    datasheetAlias: 'B2',
    role: 'INPUT_B',
    direction: 'INPUT',
    bitIndex: 1,
    shortLabel: 'Entrada B · Bit 1',
    summary: 'Segundo bit (peso 2) del operando B.',
    educationalNote: 'Forma par con la entrada A1 (pin 8) en la segunda etapa del sumador.',
  },
  {
    pinNumber: 8,
    signal: 'A1',
    datasheetAlias: 'A2',
    role: 'INPUT_A',
    direction: 'INPUT',
    bitIndex: 1,
    shortLabel: 'Entrada A · Bit 1',
    summary: 'Segundo bit (peso 2) del operando A.',
    educationalNote:
      'Ubicado en la esquina inferior derecha cuando la muesca del encapsulado DIP-16 apunta a la izquierda.',
  },
  {
    pinNumber: 9,
    signal: 'S0',
    datasheetAlias: 'Σ1',
    role: 'SUM_OUT',
    direction: 'OUTPUT',
    bitIndex: 0,
    shortLabel: 'Salida Suma · Bit 0 (LSB)',
    summary: 'Bit menos significativo (peso 1) del resultado de la suma.',
    educationalNote:
      'Calcula A0 ⊕ B0 ⊕ C0. Es la primera salida que cambia cuando se incrementa en 1 cualquiera de los sumandos o C0.',
  },
  {
    pinNumber: 10,
    signal: 'A0',
    datasheetAlias: 'A1',
    role: 'INPUT_A',
    direction: 'INPUT',
    bitIndex: 0,
    shortLabel: 'Entrada A · Bit 0 (LSB)',
    summary: 'Bit menos significativo (peso 1) del operando A.',
    educationalNote: 'Se combina con B0 (pin 11) y el acarreo de entrada C0 (pin 13).',
  },
  {
    pinNumber: 11,
    signal: 'B0',
    datasheetAlias: 'B1',
    role: 'INPUT_B',
    direction: 'INPUT',
    bitIndex: 0,
    shortLabel: 'Entrada B · Bit 0 (LSB)',
    summary: 'Bit menos significativo (peso 1) del operando B.',
    educationalNote: 'Se combina con A0 (pin 10) y el acarreo de entrada C0 (pin 13).',
  },
  {
    pinNumber: 12,
    signal: 'GND',
    datasheetAlias: 'GND (0 V)',
    role: 'GROUND',
    direction: 'SUPPLY',
    shortLabel: 'Referencia de tierra (0 V)',
    summary: 'Retorno común de referencia eléctrica (0 V) para alimentación y señales.',
    educationalNote:
      'Se ubica frente al pin 5 (VCC) al otro lado del canal central. Sin conexión efectiva a GND el integrado queda inoperativo.',
  },
  {
    pinNumber: 13,
    signal: 'C0',
    datasheetAlias: 'C0 (Cin)',
    role: 'CARRY_IN',
    direction: 'INPUT',
    shortLabel: 'Acarreo de entrada (Cin)',
    summary: 'Acarreo inicial de peso 1 que ingresa a la etapa menos significativa.',
    educationalNote:
      'Permite encadenar dos 74LS83A para sumar palabras de 8 bits, o sumar +1 en operaciones en complemento a dos. Si no se usa acarreo previo, debe fijarse a GND (0).',
  },
  {
    pinNumber: 14,
    signal: 'C4',
    datasheetAlias: 'C4 (Cout)',
    role: 'CARRY_OUT',
    direction: 'OUTPUT',
    shortLabel: 'Acarreo de salida (Cout)',
    summary: 'Acarreo final de peso 16 generado por lógica de acarreo anticipado (look-ahead).',
    educationalNote:
      'Se activa (nivel 1) cuando A + B + C0 >= 16. El 74LS83A calcula C4 mediante acarreo rápido interno sin esperar propagación en cascada.',
  },
  {
    pinNumber: 15,
    signal: 'S3',
    datasheetAlias: 'Σ4',
    role: 'SUM_OUT',
    direction: 'OUTPUT',
    bitIndex: 3,
    shortLabel: 'Salida Suma · Bit 3 (MSB)',
    summary: 'Bit más significativo de 4 bits (peso 8) de la suma.',
    educationalNote:
      'Junto con C4 (peso 16) y S2..S0 representa el total completo de 5 bits (rango 0 a 31).',
  },
  {
    pinNumber: 16,
    signal: 'B3',
    datasheetAlias: 'B4',
    role: 'INPUT_B',
    direction: 'INPUT',
    bitIndex: 3,
    shortLabel: 'Entrada B · Bit 3 (MSB)',
    summary: 'Bit más significativo (peso 8) del operando B.',
    educationalNote:
      'Situado frente al pin 1 (A3) en la fila superior del encapsulado DIP-16.',
  },
] as const;

const PIN_MAP_BY_NUMBER = new Map<PinNumber, PinSpec74LS83>(
  PINOUT_74LS83A.map((spec) => [spec.pinNumber, spec]),
);

const PIN_MAP_BY_SIGNAL = new Map<SignalCode, PinSpec74LS83>(
  PINOUT_74LS83A.map((spec) => [spec.signal, spec]),
);

export function getPinSpec74LS83(pinNumber: PinNumber): PinSpec74LS83 {
  const spec = PIN_MAP_BY_NUMBER.get(pinNumber);
  if (!spec) {
    throw new Error(`Pin inválido para DIP-16: ${pinNumber}`);
  }
  return spec;
}

export function getPinSpecBySignal(signal: SignalCode): PinSpec74LS83 {
  const spec = PIN_MAP_BY_SIGNAL.get(signal);
  if (!spec) {
    throw new Error(`Señal desconocida para SN74LS83A: ${signal}`);
  }
  return spec;
}

/**
 * Calcula el identificador de agujero de la protoboard donde inserta cada pin
 * cuando el DIP-16 se monta horizontalmente sobre el canal central (filas 'e' y 'f')
 * con la muesca de orientación hacia la izquierda (columna menor = startColumn).
 *
 * - Pines 1..8  -> fila inferior 'f', columnas startColumn .. startColumn + 7
 * - Pines 9..16 -> fila superior 'e', columnas startColumn + 7 .. startColumn
 */
export function getDip16PinHoleId(pinNumber: PinNumber, startColumn: number): string {
  if (pinNumber <= 8) {
    const col = startColumn + (pinNumber - 1);
    return `f${col}`;
  }
  const col = startColumn + (16 - pinNumber);
  return `e${col}`;
}

export function getDip16ColumnForPin(pinNumber: PinNumber, startColumn: number): number {
  return pinNumber <= 8 ? startColumn + (pinNumber - 1) : startColumn + (16 - pinNumber);
}
