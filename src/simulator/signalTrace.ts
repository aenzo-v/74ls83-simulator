import { getHoleById } from './breadboard';
import type { CircuitSolution, CircuitSolverInput } from './netlist';
import { getDip16PinHoleId, getPinSpecBySignal } from './pinout74ls83';
import type { PinNumber, SignalCode } from './types';

/**
 * Trazador topológico de rutas eléctricas por señal.
 * Opera en modo estrictamente de solo lectura sobre `CircuitSolverInput` y `CircuitSolution`,
 * sin alterar en ningún caso la conectividad ni el estado eléctrico del circuito.
 */

export interface SignalTraceResult {
  readonly signal: SignalCode;
  readonly pinNumber: PinNumber;
  readonly wireIds: ReadonlySet<string>;
  readonly componentIds: ReadonlySet<string>;
  readonly subChannelIds: ReadonlySet<string>;
  readonly stripIds: ReadonlySet<string>;
  readonly highlightedHoleIds: ReadonlySet<string>;
  readonly summaryEs: string;
}

export function traceSignalPath(
  input: CircuitSolverInput,
  solution: CircuitSolution,
  signal: SignalCode,
): SignalTraceResult {
  const pinSpec = getPinSpecBySignal(signal);
  const wireIds = new Set<string>();
  const componentIds = new Set<string>();
  const subChannelIds = new Set<string>();
  const stripIds = new Set<string>();
  const highlightedHoleIds = new Set<string>();

  const pinHoleId = input.chip
    ? getDip16PinHoleId(pinSpec.pinNumber, input.chip.startColumn)
    : null;

  if (pinHoleId) {
    highlightedHoleIds.add(pinHoleId);
    const pinHole = getHoleById(pinHoleId);
    if (pinHole) {
      stripIds.add(pinHole.stripId);
    }
  }

  // Caso 1: Redes globales de alimentación VCC (+5 V) y referencia GND (0 V)
  if (signal === 'VCC' || signal === 'GND') {
    componentIds.add(input.powerSupply.id);
    const sourceTermId =
      signal === 'VCC'
        ? input.powerSupply.plusTerminalId
        : input.powerSupply.gndTerminalId;
    const targetNetId = solution.terminalToNetId[sourceTermId];

    for (const wire of input.wires) {
      const wireNetId = solution.wires[wire.id]?.netId;
      const matchesSupply =
        wire.signal === signal ||
        (wire.signal === undefined && targetNetId !== undefined && wireNetId === targetNetId);

      if (matchesSupply && wireNetId === targetNetId) {
        wireIds.add(wire.id);
        if (getHoleById(wire.fromTerminalId)) {
          highlightedHoleIds.add(wire.fromTerminalId);
          stripIds.add(getHoleById(wire.fromTerminalId)!.stripId);
        }
        if (getHoleById(wire.toTerminalId)) {
          highlightedHoleIds.add(wire.toTerminalId);
          stripIds.add(getHoleById(wire.toTerminalId)!.stripId);
        }
      }
    }

    if (signal === 'GND') {
      for (const res of input.resistors) {
        const netA = solution.terminalToNetId[res.leadAHoleId];
        const netB = solution.terminalToNetId[res.leadBHoleId];
        if (targetNetId && (netA === targetNetId || netB === targetNetId)) {
          componentIds.add(res.id);
          highlightedHoleIds.add(res.leadAHoleId);
          highlightedHoleIds.add(res.leadBHoleId);
        }
      }
    }

    const summaryEs =
      signal === 'VCC'
        ? 'Distribución +5.0 V (VCC): Borne rojo de fuente → Rieles positivos (+) → Pin 5 del 74LS83A y entradas de interruptores DIP.'
        : 'Referencia 0 V (GND): Borne azul de fuente → Rieles negativos (−) → Pin 12 del 74LS83A, resistencias pull-down y cátodos LED.';

    return {
      signal,
      pinNumber: pinSpec.pinNumber,
      wireIds,
      componentIds,
      subChannelIds,
      stripIds,
      highlightedHoleIds,
      summaryEs,
    };
  }

  // Caso 2: Señales lógicas individuales de entrada (A0..A3, B0..B3, C0) o salida (S0..S3, C4).
  // Recorrido en anchura (BFS) sobre pistas locales de terminales, deteniéndose al tocar rieles globales.
  const queue: string[] = [];
  const visitedTerminalStrips = new Set<string>();

  const enqueueTerminalHoleStrip = (holeId: string) => {
    const hole = getHoleById(holeId);
    if (!hole) {
      return;
    }
    highlightedHoleIds.add(holeId);
    if (hole.kind === 'terminal' && !visitedTerminalStrips.has(hole.stripId)) {
      visitedTerminalStrips.add(hole.stripId);
      stripIds.add(hole.stripId);
      queue.push(hole.stripId);
    }
  };

  if (pinHoleId) {
    enqueueTerminalHoleStrip(pinHoleId);
  }

  while (queue.length > 0) {
    const currentStripId = queue.shift()!;

    // 1. Seguir cables jumper conectados a esta pista local
    for (const wire of input.wires) {
      const fromHole = getHoleById(wire.fromTerminalId);
      const toHole = getHoleById(wire.toTerminalId);

      if (fromHole?.stripId === currentStripId) {
        wireIds.add(wire.id);
        highlightedHoleIds.add(wire.fromTerminalId);
        if (toHole) {
          enqueueTerminalHoleStrip(toHole.id);
        }
      } else if (toHole?.stripId === currentStripId) {
        wireIds.add(wire.id);
        highlightedHoleIds.add(wire.toTerminalId);
        if (fromHole) {
          enqueueTerminalHoleStrip(fromHole.id);
        }
      }
    }

    // 2. Seguir canales de interruptores DIP conectados a esta pista local
    for (const sw of input.dipSwitches) {
      for (const ch of sw.channels) {
        const inHole = getHoleById(ch.inputHoleId);
        const outHole = getHoleById(ch.outputHoleId);

        if (inHole?.stripId === currentStripId || outHole?.stripId === currentStripId) {
          componentIds.add(sw.id);
          subChannelIds.add(ch.id);
          if (inHole) enqueueTerminalHoleStrip(inHole.id);
          if (outHole) enqueueTerminalHoleStrip(outHole.id);
        }
      }
    }

    // 3. Seguir resistencias axiales (pull-down o limitadora en serie de LED)
    for (const res of input.resistors) {
      const holeA = getHoleById(res.leadAHoleId);
      const holeB = getHoleById(res.leadBHoleId);

      if (holeA?.stripId === currentStripId || holeB?.stripId === currentStripId) {
        componentIds.add(res.id);
        if (holeA) enqueueTerminalHoleStrip(holeA.id);
        if (holeB) enqueueTerminalHoleStrip(holeB.id);
      }
    }

    // 4. Seguir diodos LED en serie hacia su pista de cátodo/ánodo
    for (const led of input.leds) {
      const anodeHole = getHoleById(led.anodeHoleId);
      const cathodeHole = getHoleById(led.cathodeHoleId);

      if (anodeHole?.stripId === currentStripId || cathodeHole?.stripId === currentStripId) {
        componentIds.add(led.id);
        if (anodeHole) enqueueTerminalHoleStrip(anodeHole.id);
        if (cathodeHole) enqueueTerminalHoleStrip(cathodeHole.id);
      }
    }
  }

  const summaryEs =
    pinSpec.direction === 'INPUT'
      ? `Ruta de entrada ${signal}: Riel +5 V → Interruptor ${signal} (con pull-down 330 Ω a GND) → Cable jumper → Pin ${pinSpec.pinNumber} (${pinHoleId ?? '—'}) del 74LS83A.`
      : `Ruta de salida ${signal}: Pin ${pinSpec.pinNumber} (${pinHoleId ?? '—'}) del 74LS83A → Cable jumper → Resistencia serie 1 kΩ → LED ${signal} → Retorno GND.`;

  return {
    signal,
    pinNumber: pinSpec.pinNumber,
    wireIds,
    componentIds,
    subChannelIds,
    stripIds,
    highlightedHoleIds,
    summaryEs,
  };
}
