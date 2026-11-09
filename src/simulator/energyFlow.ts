import { getHoleById } from './breadboard';
import {
  CARRY_IN_PIN,
  CARRY_OUT_PIN,
  INPUT_A_PINS,
  INPUT_B_PINS,
  SUM_OUTPUT_PINS,
} from './adder74ls83';
import type { CircuitSolution, CircuitSolverInput, ResolvedWireState } from './netlist';
import type { PinNumber, SignalCode } from './types';

/**
 * Sentido de circulación de la corriente eléctrica convencional (de mayor potencial + a menor potencial -).
 * - 'FORWARD': Fluye desde `fromTerminalId` hacia `toTerminalId`.
 * - 'REVERSE': Fluye desde `toTerminalId` hacia `fromTerminalId`.
 * - 'NONE': Conductor sin circulación neta de corriente (circuito abierto, nodo en reposo o desenergizado).
 */
export type FlowDirection = 'FORWARD' | 'REVERSE' | 'NONE';

export type FlowCategory =
  | 'VCC'
  | 'GND'
  | 'INPUT_A'
  | 'INPUT_B'
  | 'CARRY_IN'
  | 'SUM_OUT'
  | 'CARRY_OUT'
  | 'OTHER';

export interface WireFlowState {
  readonly wireId: string;
  readonly isConducting: boolean;
  readonly direction: FlowDirection;
  readonly category: FlowCategory;
  readonly colorHex: string;
  readonly speedMultiplier: number;
  readonly intensity: number;
  readonly descriptionEs: string;
}

export interface CircuitEnergyFlowState {
  readonly isPowered: boolean;
  readonly hasShortCircuit: boolean;
  readonly isChipActive: boolean;
  readonly wireFlows: Readonly<Record<string, WireFlowState>>;
  readonly activeRails: {
    readonly topPlus: boolean;
    readonly topMinus: boolean;
    readonly bottomPlus: boolean;
    readonly bottomMinus: boolean;
  };
  readonly activeLeds: ReadonlySet<string>;
  readonly activeInputsCount: number;
  readonly activeOutputsCount: number;
  readonly conductingWiresCount: number;
  readonly summaryEs: string;
}

const FLOW_COLORS = {
  vcc: '#FF4D4D',
  gnd: '#388BFF',
  inputA: '#2EB8C6',
  inputB: '#8E75FF',
  carryIn: '#FFC233',
  sumOut: '#3CE08D',
  carryOut: '#FF9533',
  other: '#A0AEC0',
} as const;

const SIGNAL_PIN_MAP: Readonly<Record<SignalCode, PinNumber>> = {
  A3: 1,
  S2: 2,
  A2: 3,
  B2: 4,
  VCC: 5,
  S1: 6,
  B1: 7,
  A1: 8,
  S0: 9,
  A0: 10,
  B0: 11,
  GND: 12,
  C0: 13,
  C4: 14,
  S3: 15,
  B3: 16,
};

/**
 * Determina el estado de flujo de energía eléctrica convencional para cada conductor
 * y elemento del circuito a partir de la entrada del simulador y de la netlist resuelta.
 * Función pura de TypeScript sin efectos secundarios ni dependencias de Three.js / React.
 */
export function computeCircuitEnergyFlow(
  input: CircuitSolverInput,
  solution: CircuitSolution,
): CircuitEnergyFlowState {
  const isPowered = solution.isPowerSupplyOn && !solution.hasSupplyShortCircuit;
  const isChipActive = solution.isChipPowered;
  const hasShortCircuit = solution.hasSupplyShortCircuit;

  const activeLeds = new Set<string>();
  if (isPowered) {
    for (const [ledId, state] of Object.entries(solution.leds)) {
      if (state.isLit) {
        activeLeds.add(ledId);
      }
    }
  }

  // Identificar rieles de alimentación activos
  const plusTermNet = solution.terminalToNetId[input.powerSupply.plusTerminalId];
  const gndTermNet = solution.terminalToNetId[input.powerSupply.gndTerminalId];

  const activeRails = {
    topPlus: isPowered && plusTermNet !== undefined && solution.terminalToNetId['rail-top-plus-1'] === plusTermNet,
    topMinus: isPowered && gndTermNet !== undefined && solution.terminalToNetId['rail-top-minus-1'] === gndTermNet,
    bottomPlus: isPowered && plusTermNet !== undefined && solution.terminalToNetId['rail-bottom-plus-1'] === plusTermNet,
    bottomMinus: isPowered && gndTermNet !== undefined && solution.terminalToNetId['rail-bottom-minus-1'] === gndTermNet,
  };

  // Contabilizar entradas activas en nivel ALTO (1)
  let activeInputsCount = 0;
  if (isPowered) {
    const inputPins = [...INPUT_A_PINS, ...INPUT_B_PINS, CARRY_IN_PIN];
    for (const pinNum of inputPins) {
      if (solution.pins[pinNum]?.logicLevel === 1) {
        activeInputsCount += 1;
      }
    }
  }

  // Contabilizar salidas de suma y acarreo activas en nivel ALTO (1)
  let activeOutputsCount = 0;
  if (isChipActive) {
    const outputPins = [...SUM_OUTPUT_PINS, CARRY_OUT_PIN];
    for (const pinNum of outputPins) {
      if (solution.pins[pinNum]?.logicLevel === 1) {
        activeOutputsCount += 1;
      }
    }
  }

  // Mapear cada canal de interruptor DIP a su estado mecánico
  const switchStates = input.switchStates;

  // Analizar cada conductor del circuito
  const wireFlows: Record<string, WireFlowState> = {};
  let conductingWiresCount = 0;

  for (const wire of input.wires) {
    const wireState: ResolvedWireState | undefined = solution.wires[wire.id];
    const wireSignal: SignalCode | undefined = wire.signal;

    // Conductor desconectado, flotante o sin alimentación
    if (!wireState || !wireState.isValidEndpoints || wireState.isDangling || !isPowered) {
      wireFlows[wire.id] = {
        wireId: wire.id,
        isConducting: false,
        direction: 'NONE',
        category: (wireSignal as FlowCategory) ?? 'OTHER',
        colorHex: wireSignal ? (FLOW_COLORS[wireSignal as keyof typeof FLOW_COLORS] ?? FLOW_COLORS.other) : FLOW_COLORS.other,
        speedMultiplier: 1.0,
        intensity: 0,
        descriptionEs: hasShortCircuit
          ? 'Conductor bloqueado por disparo de protección ante cortocircuito'
          : !solution.isPowerSupplyOn
            ? 'Sin conducción · Fuente de alimentación apagada'
            : 'Conductor desconectado o nodo flotante (sin circulación de corriente)',
      };
      continue;
    }

    // Clasificar según la función eléctrica del conductor
    let category: FlowCategory = 'OTHER';
    let colorHex: string = FLOW_COLORS.other;
    let isConducting = false;
    let direction: FlowDirection = 'NONE';
    let speedMultiplier = 1.0;
    let intensity = 1.0;
    let descriptionEs = '';

    // 1. Entradas del Operando A (A3..A0)
    if (wireSignal === 'A0' || wireSignal === 'A1' || wireSignal === 'A2' || wireSignal === 'A3') {
      category = 'INPUT_A';
      colorHex = FLOW_COLORS.inputA;
      speedMultiplier = 1.25;

      const pinNum = SIGNAL_PIN_MAP[wireSignal];
      const isHigh = solution.pins[pinNum]?.logicLevel === 1;

      isConducting = isHigh;
      direction = isHigh ? 'FORWARD' : 'NONE';
      intensity = 0.95;
      descriptionEs = isHigh
        ? `Señal lógica ALTA (+5.0 V) desde interruptor A hacia Pin ${pinNum} (${wireSignal}) del 74LS83A`
        : `Entrada ${wireSignal} en nivel BAJO (0 V) mediante resistencia pull-down 330 Ω · Sin corriente`;
    }

    // 2. Entradas del Operando B (B3..B0)
    else if (wireSignal === 'B0' || wireSignal === 'B1' || wireSignal === 'B2' || wireSignal === 'B3') {
      category = 'INPUT_B';
      colorHex = FLOW_COLORS.inputB;
      speedMultiplier = 1.25;

      const pinNum = SIGNAL_PIN_MAP[wireSignal];
      const isHigh = solution.pins[pinNum]?.logicLevel === 1;

      isConducting = isHigh;
      direction = isHigh ? 'FORWARD' : 'NONE';
      intensity = 0.95;
      descriptionEs = isHigh
        ? `Señal lógica ALTA (+5.0 V) desde interruptor B hacia Pin ${pinNum} (${wireSignal}) del 74LS83A`
        : `Entrada ${wireSignal} en nivel BAJO (0 V) mediante resistencia pull-down 330 Ω · Sin corriente`;
    }

    // 3. Entrada de Acarreo C0 / Cin
    else if (wireSignal === 'C0') {
      category = 'CARRY_IN';
      colorHex = FLOW_COLORS.carryIn;
      speedMultiplier = 1.25;

      const isHigh = solution.pins[CARRY_IN_PIN]?.logicLevel === 1;

      isConducting = isHigh;
      direction = isHigh ? 'FORWARD' : 'NONE';
      intensity = 0.95;
      descriptionEs = isHigh
        ? `Acarreo de entrada C0 / Cin en nivel ALTO (1) hacia Pin 13 del 74LS83A`
        : `Acarreo de entrada C0 en nivel BAJO (0) mediante resistencia pull-down 330 Ω · Sin corriente`;
    }

    // 4. Salidas de Suma (S3..S0)
    else if (wireSignal === 'S0' || wireSignal === 'S1' || wireSignal === 'S2' || wireSignal === 'S3') {
      category = 'SUM_OUT';
      colorHex = FLOW_COLORS.sumOut;
      speedMultiplier = 1.35;

      const pinNum = SIGNAL_PIN_MAP[wireSignal];
      const isHigh = isChipActive && solution.pins[pinNum]?.logicLevel === 1;

      isConducting = isHigh;
      direction = isHigh ? 'FORWARD' : 'NONE';
      intensity = 1.0;
      descriptionEs = isHigh
        ? `Salida de suma ${wireSignal} en nivel ALTO (1) energizando el LED verde indicador`
        : isChipActive
          ? `Salida de suma ${wireSignal} en nivel BAJO (0) · LED apagado`
          : `74LS83A sin alimentación · Salida ${wireSignal} inactiva`;
    }

    // 5. Salida de Acarreo C4 / Cout
    else if (wireSignal === 'C4') {
      category = 'CARRY_OUT';
      colorHex = FLOW_COLORS.carryOut;
      speedMultiplier = 1.35;

      const isHigh = isChipActive && solution.pins[CARRY_OUT_PIN]?.logicLevel === 1;

      isConducting = isHigh;
      direction = isHigh ? 'FORWARD' : 'NONE';
      intensity = 1.0;
      descriptionEs = isHigh
        ? `Acarreo de salida C4 / Cout en nivel ALTO (1) energizando el LED ámbar indicador de desbordamiento`
        : isChipActive
          ? `Acarreo de salida C4 en nivel BAJO (0) · Sin desbordamiento`
          : `74LS83A sin alimentación · Salida C4 inactiva`;
    }

    // 6. Redes de alimentación VCC (+5.0 V)
    else if (wireSignal === 'VCC' || wireState.drive === 'STRONG_HIGH') {
      category = 'VCC';
      colorHex = FLOW_COLORS.vcc;
      speedMultiplier = 1.1;

      if (wire.fromTerminalId === input.powerSupply.plusTerminalId) {
        // Alimentación principal de la fuente al riel
        isConducting = true;
        direction = 'FORWARD';
        intensity = 1.0;
        descriptionEs = 'Alimentación principal +5.0 V desde el borne rojo de la fuente hacia el riel superior (+)';
      } else if (
        wire.fromTerminalId.startsWith('rail-top-plus') &&
        wire.toTerminalId.startsWith('rail-bottom-plus')
      ) {
        // Puente entre rieles positivos
        isConducting = true;
        direction = 'FORWARD';
        intensity = 0.95;
        descriptionEs = 'Puente de distribución +5.0 V (Riel positivo superior → Riel positivo inferior)';
      } else if (wire.toTerminalId === 'j32' || wire.toTerminalId.endsWith('32')) {
        // Alimentación Pin 5 del 74LS83A
        isConducting = true;
        direction = 'FORWARD';
        intensity = 1.0;
        descriptionEs = 'Alimentación VCC (+5.0 V) al Pin 5 del 74LS83A para polarizar la lógica interna';
      } else if (wire.toTerminalId.startsWith('a') && parseInt(wire.toTerminalId.slice(1), 10) <= 20) {
        // Puentes a entradas de interruptores DIP
        // Conducen corriente continua hacia el circuito si el canal correspondiente está en ON
        const col = parseInt(wire.toTerminalId.slice(1), 10);
        const associatedSwitch = input.dipSwitches.flatMap((s) => s.channels).find((ch) => {
          const chHole = getHoleById(ch.inputHoleId);
          return chHole && chHole.kind === 'terminal' && chHole.column === col;
        });

        const isSwitchClosed = associatedSwitch ? Boolean(switchStates[associatedSwitch.id]) : false;
        isConducting = isSwitchClosed;
        direction = isSwitchClosed ? 'FORWARD' : 'NONE';
        intensity = 0.85;
        descriptionEs = isSwitchClosed
          ? `Puente de polarización +5.0 V alimentando interruptor ${associatedSwitch?.signal ?? ''} (Cerrado · Conduciendo)`
          : `Interruptor en columna ${col} abierto · Sin demanda de corriente`;
      } else {
        isConducting = true;
        direction = 'FORWARD';
        intensity = 0.9;
        descriptionEs = 'Conductor de distribución +5.0 V polarizado en nivel ALTO';
      }
    }

    // 7. Redes de referencia GND (0 V)
    else if (wireSignal === 'GND' || wireState.drive === 'STRONG_LOW') {
      category = 'GND';
      colorHex = FLOW_COLORS.gnd;
      speedMultiplier = 0.95;

      if (wire.fromTerminalId === input.powerSupply.gndTerminalId) {
        // Retorno hacia borne azul de la fuente
        isConducting = true;
        direction = 'REVERSE'; // La corriente convencional entra hacia el borne GND
        intensity = 1.0;
        descriptionEs = 'Retorno principal de corriente de referencia hacia el borne azul GND de la fuente';
      } else if (
        wire.fromTerminalId.startsWith('rail-top-minus') &&
        wire.toTerminalId.startsWith('rail-bottom-minus')
      ) {
        // Retorno entre rieles negativos
        isConducting = true;
        direction = 'REVERSE'; // Desde riel inferior hacia riel superior hacia la fuente
        intensity = 0.9;
        descriptionEs = 'Retorno de corriente GND (Riel inferior → Riel superior de referencia)';
      } else if (wire.fromTerminalId.startsWith('rail-top-minus') && (wire.toTerminalId === 'a32' || wire.toTerminalId.endsWith('32'))) {
        // Retorno Pin 12 del 74LS83A
        isConducting = isChipActive;
        direction = isChipActive ? 'REVERSE' : 'NONE'; // Sale del chip hacia el riel GND
        intensity = 0.95;
        descriptionEs = isChipActive
          ? 'Retorno de corriente de polarización del 74LS83A desde Pin 12 (GND) hacia riel de referencia'
          : 'Pin 12 (GND) inactivo · Integrado sin polarización';
      } else if (wire.id.startsWith('w-led-gnd-')) {
        // Retorno de cátodos LED a riel GND
        const ledSignal = wire.id.replace('w-led-gnd-', '');
        const targetLed = input.leds.find((l) => l.id.endsWith(ledSignal) || l.signal.toLowerCase() === ledSignal.toLowerCase());
        const isLedLit = targetLed ? activeLeds.has(targetLed.id) : false;

        isConducting = isLedLit;
        direction = isLedLit ? 'FORWARD' : 'NONE'; // Del cátodo hacia el riel GND
        intensity = 0.9;
        descriptionEs = isLedLit
          ? `Retorno de corriente del cátodo LED ${ledSignal.toUpperCase()} hacia la referencia GND (0 V)`
          : `LED ${ledSignal.toUpperCase()} apagado · Sin corriente de retorno en cátodo`;
      } else {
        isConducting = true;
        direction = 'FORWARD';
        intensity = 0.8;
        descriptionEs = 'Conductor de retorno conectado a referencia 0 V (GND)';
      }
    }

    // 8. Otros conductores
    else {
      category = 'OTHER';
      colorHex = FLOW_COLORS.other;
      const isLogicHigh = wireState.logicLevel === 1;
      isConducting = isLogicHigh;
      direction = isLogicHigh ? 'FORWARD' : 'NONE';
      intensity = 0.8;
      descriptionEs = isLogicHigh
        ? `Conductor auxiliar con nivel lógico ALTO (+5.0 V)`
        : `Conductor auxiliar en reposo`;
    }

    if (isConducting) {
      conductingWiresCount += 1;
    }

    wireFlows[wire.id] = {
      wireId: wire.id,
      isConducting,
      direction,
      category,
      colorHex,
      speedMultiplier,
      intensity,
      descriptionEs,
    };
  }

  // Resumen didáctico general del estado de energía
  let summaryEs: string;
  if (!solution.isPowerSupplyOn) {
    summaryEs = 'Fuente de alimentación en espera (STBY). El circuito no recibe tensión eléctrica.';
  } else if (hasShortCircuit) {
    summaryEs = '¡Alerta de cortocircuito! La fuente interrumpió el suministro por seguridad.';
  } else if (!isChipActive) {
    summaryEs = 'Fuente conectada (+5 V), pero el 74LS83A no está polarizado correctamente (revisar Pin 5 VCC y Pin 12 GND).';
  } else {
    summaryEs = `Circuito polarizado y activo · ${activeInputsCount} entradas en ALTO · ${activeOutputsCount} salidas activas · ${conductingWiresCount} conductores con flujo continuo (+5 V → GND)`;
  }

  return {
    isPowered,
    hasShortCircuit,
    isChipActive,
    wireFlows,
    activeRails,
    activeLeds,
    activeInputsCount,
    activeOutputsCount,
    conductingWiresCount,
    summaryEs,
  };
}
