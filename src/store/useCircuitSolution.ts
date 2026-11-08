import { useMemo } from 'react';
import { createCanonicalCircuitInput } from '../data/circuitLayout';
import {
  REFERENCE_CIRCUIT_STATE,
  type WorkingCircuitState,
  workingCircuitToSolverInput,
} from '../simulator/editableCircuit';
import { type CircuitSolution, solveCircuit } from '../simulator/netlist';
import { type SignalTraceResult, traceSignalPath } from '../simulator/signalTrace';
import type { SignalCode, SimulatorMode } from '../simulator/types';
import { useLabStore } from './useLabStore';

/**
 * Devuelve el circuito actualmente representado en escena:
 * - `REFERENCE_CIRCUIT_STATE` inmutable en modo «Circuito montado».
 * - `workingCircuit` editable en modo «Montaje guiado».
 */
export function useDisplayedCircuit(): WorkingCircuitState {
  const mode = useLabStore((s) => s.mode);
  const workingCircuit = useLabStore((s) => s.workingCircuit);
  return mode === 'mounted' ? REFERENCE_CIRCUIT_STATE : workingCircuit;
}

/**
 * Devuelve el mapa de estados mecánicos de interruptores y fuente +5 V correspondiente al modo activo.
 */
export function useActiveSwitchStates(): Readonly<Record<string, boolean>> {
  const mode = useLabStore((s) => s.mode);
  const switchStates = useLabStore((s) => s.switchStates);
  const workingSwitchStates = useLabStore((s) => s.workingSwitchStates);
  return mode === 'mounted' ? switchStates : workingSwitchStates;
}

let lastMode: SimulatorMode | null = null;
let lastSwitchStates: Readonly<Record<string, boolean>> | null = null;
let lastWorkingCircuit: WorkingCircuitState | null = null;
let lastWorkingSwitchStates: Readonly<Record<string, boolean>> | null = null;
let cachedSolution: CircuitSolution | null = null;

/**
 * Resuelve la netlist con caché referencial a nivel de aplicación para evitar
 * ejecuciones redundantes de `solveCircuit` en múltiples componentes dentro del mismo ciclo.
 */
export function resolveCurrentCircuitSolution(
  mode: SimulatorMode,
  switchStates: Readonly<Record<string, boolean>>,
  workingCircuit: WorkingCircuitState,
  workingSwitchStates: Readonly<Record<string, boolean>>,
): CircuitSolution {
  if (
    cachedSolution !== null &&
    lastMode === mode &&
    lastSwitchStates === switchStates &&
    lastWorkingCircuit === workingCircuit &&
    lastWorkingSwitchStates === workingSwitchStates
  ) {
    return cachedSolution;
  }

  const input =
    mode === 'mounted'
      ? createCanonicalCircuitInput(switchStates)
      : workingCircuitToSolverInput(workingCircuit, workingSwitchStates);

  cachedSolution = solveCircuit(input);
  lastMode = mode;
  lastSwitchStates = switchStates;
  lastWorkingCircuit = workingCircuit;
  lastWorkingSwitchStates = workingSwitchStates;
  return cachedSolution;
}

let lastTraceSolution: CircuitSolution | null = null;
let lastTraceSignal: SignalCode | null = null;
let cachedSignalTrace: SignalTraceResult | null = null;

/**
 * Resuelve el trazado de señal con caché referencial a nivel de aplicación.
 */
export function resolveCurrentSignalTrace(
  mode: SimulatorMode,
  switchStates: Readonly<Record<string, boolean>>,
  workingCircuit: WorkingCircuitState,
  workingSwitchStates: Readonly<Record<string, boolean>>,
  solution: CircuitSolution,
  tracedSignal: SignalCode | null,
): SignalTraceResult | null {
  if (!tracedSignal) {
    return null;
  }
  if (
    cachedSignalTrace !== null &&
    lastTraceSolution === solution &&
    lastTraceSignal === tracedSignal
  ) {
    return cachedSignalTrace;
  }

  const input =
    mode === 'mounted'
      ? createCanonicalCircuitInput(switchStates)
      : workingCircuitToSolverInput(workingCircuit, workingSwitchStates);

  cachedSignalTrace = traceSignalPath(input, solution, tracedSignal);
  lastTraceSolution = solution;
  lastTraceSignal = tracedSignal;
  return cachedSignalTrace;
}

/**
 * Selector derivado memoizado que resuelve en tiempo real la netlist,
 * continuidad de protoboard, lógica del 74LS83A, estados de LEDs y diagnósticos
 * sobre el circuito activo (`REFERENCE_CIRCUIT_STATE` o `workingCircuit`).
 */
export function useCircuitSolution(): CircuitSolution {
  const mode = useLabStore((s) => s.mode);
  const switchStates = useLabStore((s) => s.switchStates);
  const workingCircuit = useLabStore((s) => s.workingCircuit);
  const workingSwitchStates = useLabStore((s) => s.workingSwitchStates);

  return useMemo(
    () => resolveCurrentCircuitSolution(mode, switchStates, workingCircuit, workingSwitchStates),
    [mode, switchStates, workingCircuit, workingSwitchStates],
  );
}

/**
 * Selector derivado memoizado que resuelve los elementos físicos pertenecientes
 * al recorrido eléctrico de la señal resaltada (`tracedSignal`), sin alterar la conectividad.
 */
export function useSignalTrace(): SignalTraceResult | null {
  const mode = useLabStore((s) => s.mode);
  const switchStates = useLabStore((s) => s.switchStates);
  const workingCircuit = useLabStore((s) => s.workingCircuit);
  const workingSwitchStates = useLabStore((s) => s.workingSwitchStates);
  const tracedSignal = useLabStore((s) => s.tracedSignal);

  const solution = useCircuitSolution();

  return useMemo(
    () =>
      resolveCurrentSignalTrace(
        mode,
        switchStates,
        workingCircuit,
        workingSwitchStates,
        solution,
        tracedSignal,
      ),
    [mode, solution, switchStates, tracedSignal, workingCircuit, workingSwitchStates],
  );
}
