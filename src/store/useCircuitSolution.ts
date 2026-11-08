import { useMemo } from 'react';
import { createCanonicalCircuitInput } from '../data/circuitLayout';
import {
  REFERENCE_CIRCUIT_STATE,
  type WorkingCircuitState,
  workingCircuitToSolverInput,
} from '../simulator/editableCircuit';
import { type CircuitSolution, solveCircuit } from '../simulator/netlist';
import { type SignalTraceResult, traceSignalPath } from '../simulator/signalTrace';
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

  return useMemo(() => {
    const input =
      mode === 'mounted'
        ? createCanonicalCircuitInput(switchStates)
        : workingCircuitToSolverInput(workingCircuit, workingSwitchStates);
    return solveCircuit(input);
  }, [mode, switchStates, workingCircuit, workingSwitchStates]);
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

  return useMemo(() => {
    if (!tracedSignal) {
      return null;
    }
    const input =
      mode === 'mounted'
        ? createCanonicalCircuitInput(switchStates)
        : workingCircuitToSolverInput(workingCircuit, workingSwitchStates);
    return traceSignalPath(input, solution, tracedSignal);
  }, [mode, solution, switchStates, tracedSignal, workingCircuit, workingSwitchStates]);
}
