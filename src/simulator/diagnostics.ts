import type { PinNumber, SignalCode } from './types';

/**
 * Modelo estructurado de diagnósticos eléctricos para el circuito del 74LS83A.
 * Independiente de React y Three.js; textos orientados a retroalimentación didáctica en español.
 */

export type DiagnosticSeverity = 'ERROR' | 'WARNING';

export type DiagnosticCode =
  | 'SHORT_CIRCUIT_SUPPLY'
  | 'OUTPUT_CONTENTION'
  | 'POWER_SUPPLY_OFF'
  | 'IC_MISSING'
  | 'IC_REVERSE_POLARITY'
  | 'IC_VCC_DISCONNECTED'
  | 'IC_GND_DISCONNECTED'
  | 'FLOATING_INPUT'
  | 'INVALID_TERMINAL'
  | 'DISCONNECTED_WIRE'
  | 'WRONG_PIN_CONNECTION'
  | 'LED_WITHOUT_RESISTOR'
  | 'LED_REVERSE_POLARITY'
  | 'UNDRIVEN_OUTPUT';

export interface ElectricalDiagnostic {
  readonly code: DiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly title: string;
  readonly message: string;
  readonly signal?: SignalCode;
  readonly relatedTerminals?: readonly string[];
  readonly relatedPins?: readonly PinNumber[];
  readonly relatedComponentIds?: readonly string[];
  readonly relatedWireIds?: readonly string[];
}
