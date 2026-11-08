import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHIP_74LS83_PLACEMENT,
  createCanonicalCircuitInput,
  JUMPER_WIRES,
  POWER_SUPPLY_5V,
  WIRE_COLORS,
} from '../../data/circuitLayout';
import {
  doesPresetMatchSwitches,
  QUICK_ADDITION_PRESETS,
} from '../../data/presets';
import {
  clearGuidedStateFromStorage,
  GUIDED_STORAGE_KEY,
  loadGuidedStateFromStorage,
  saveGuidedStateToStorage,
} from '../../store/guidedPersistence';
import { buildInitialSwitchStates, useLabStore } from '../../store/useLabStore';
import {
  evaluate74LS83Logic,
  numberToWord4,
} from '../adder74ls83';
import {
  addWireToCircuit,
  createEmptyWorkingCircuit,
  REFERENCE_CIRCUIT_STATE,
  removeWireFromCircuit,
  type WorkingCircuitState,
  workingCircuitToSolverInput,
} from '../editableCircuit';
import {
  STAGE_8_MATH_TEST_CASES,
  STAGE_9_EVALUATION_QUESTIONS,
} from '../guidedStages';
import {
  calculateGuidedProgressSummary,
  type GuidedValidationContext,
  validateStage1Breadboard,
  validateStage2Chip,
  validateStage3Power,
  validateStage4InputsAB,
  validateStage5CarryIn,
  validateStage6OutputsLeds,
  validateStage7CircuitReview,
  validateStage8FunctionalTesting,
  validateStage9Evaluation,
} from '../guidedValidation';
import { areComponentNetlistsEquivalent, solveCircuit } from '../netlist';

// Mock de localStorage en memoria para el entorno de pruebas
const createMemoryStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
};

const memStorage = createMemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: memStorage,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: { localStorage: memStorage, location: { reload: () => {} } },
  writable: true,
  configurable: true,
});

function cloneReferenceCircuit(): WorkingCircuitState {
  return {
    chip: REFERENCE_CIRCUIT_STATE.chip ? { ...REFERENCE_CIRCUIT_STATE.chip } : null,
    dipSwitches: [...REFERENCE_CIRCUIT_STATE.dipSwitches],
    resistors: [...REFERENCE_CIRCUIT_STATE.resistors],
    leds: [...REFERENCE_CIRCUIT_STATE.leds],
    wires: [...REFERENCE_CIRCUIT_STATE.wires],
    nextWireSeq: REFERENCE_CIRCUIT_STATE.nextWireSeq,
  };
}

function makeContext(
  circuit: WorkingCircuitState,
  switchStates: Readonly<Record<string, boolean>> = { [POWER_SUPPLY_5V.id]: true },
  overrides: Partial<GuidedValidationContext> = {},
): GuidedValidationContext {
  const solution = solveCircuit(workingCircuitToSolverInput(circuit, switchStates));
  return {
    circuit,
    switchStates,
    solution,
    stage1QuizAnswers: {},
    stage8TestedCases: [],
    stage9QuizAnswers: {},
    completedStagesHistory: [false, false, false, false, false, false, false, false, false],
    ...overrides,
  };
}

describe('Fase 7 — Auditoría Integral, Optimización, Confiabilidad y Regresión', () => {
  beforeEach(() => {
    localStorage.clear();
    useLabStore.setState({
      mode: 'mounted',
      switchStates: buildInitialSwitchStates(),
      workingCircuit: createEmptyWorkingCircuit(),
      workingSwitchStates: buildInitialSwitchStates(),
      undoStack: [],
      redoStack: [],
      guidedCurrentStageIndex: 0,
      guidedHighestUnlockedIndex: 0,
      guidedCompletedStages: [false, false, false, false, false, false, false, false, false],
      guidedHintLevels: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      guidedStage1QuizAnswers: {},
      guidedStage8TestedCases: [],
      guidedStage9QuizAnswers: {},
      guidedActiveTab: 'guide',
      guidedPracticeUnlocked: false,
      selection: { kind: 'none' },
      hovered: { kind: 'none' },
      tracedSignal: null,
      wireDraft: null,
    });
  });

  // 1. Auditoría del motor: 512 combinaciones del sumador 74LS83A con comprobación bit a bit
  it('1. valida rigurosamente las 512 combinaciones del sumador con netlist completa y acarreos intermedios', () => {
    let tested = 0;
    for (let a = 0; a <= 15; a += 1) {
      for (let b = 0; b <= 15; b += 1) {
        for (const c0 of [0, 1] as const) {
          tested += 1;
          const expectedTotal = a + b + c0;
          const expectedSum = expectedTotal & 0x0f;
          const expectedCout = (expectedTotal >> 4) & 1;

          const logic = evaluate74LS83Logic({
            a: numberToWord4(a),
            b: numberToWord4(b),
            c0,
          });

          expect(logic.totalValue).toBe(expectedTotal);
          expect(logic.sumValue).toBe(expectedSum);
          expect(logic.carryOut).toBe(expectedCout);

          // Verificar acarreos internos columna por columna
          const c1 = (logic.operandABits[0] + logic.operandBBits[0] + c0) >> 1;
          expect(logic.intermediateCarries[1]).toBe(c1);
          const c2 = (logic.operandABits[1] + logic.operandBBits[1] + c1) >> 1;
          expect(logic.intermediateCarries[2]).toBe(c2);
          const c3 = (logic.operandABits[2] + logic.operandBBits[2] + c2) >> 1;
          expect(logic.intermediateCarries[3]).toBe(c3);
          const c4 = (logic.operandABits[3] + logic.operandBBits[3] + c3) >> 1;
          expect(logic.intermediateCarries[4]).toBe(c4);
        }
      }
    }
    expect(tested).toBe(512);
  });

  // 2. Ejemplos rápidos y sincronización con interruptores reales
  it('2. verifica que los 4 ejemplos rápidos configuren los interruptores reales y actualicen el sumador', () => {
    expect(QUICK_ADDITION_PRESETS).toHaveLength(4);

    for (const preset of QUICK_ADDITION_PRESETS) {
      useLabStore.getState().applyAdditionPreset(preset.operandA, preset.operandB, preset.carryIn);
      const activeSwitches = useLabStore.getState().switchStates;

      expect(doesPresetMatchSwitches(preset, activeSwitches)).toBe(true);
      expect(activeSwitches[POWER_SUPPLY_5V.id]).toBe(true);

      const solution = solveCircuit(createCanonicalCircuitInput(activeSwitches));
      expect(solution.adderOutput).not.toBeNull();
      expect(solution.adderOutput?.operandA).toBe(preset.operandA);
      expect(solution.adderOutput?.operandB).toBe(preset.operandB);
      expect(solution.adderOutput?.carryIn).toBe(preset.carryIn);
      expect(solution.adderOutput?.totalValue).toBe(preset.operandA + preset.operandB + preset.carryIn);
    }
  });

  // 3. Estados de la fuente de alimentación (encendido, apagado, STBY, diagnóstico)
  it('3. comprueba el comportamiento exacto ante la fuente apagada y su restauración', () => {
    // Encendida: outputs activos
    useLabStore.getState().setPowerSupplyOn(true);
    let solution = solveCircuit(createCanonicalCircuitInput(useLabStore.getState().switchStates));
    expect(solution.isPowerSupplyOn).toBe(true);
    expect(solution.isChipPowered).toBe(true);
    expect(solution.adderOutput).not.toBeNull();

    // Apagada: modo STBY, salidas inactivas, LEDs apagados
    useLabStore.getState().setPowerSupplyOn(false);
    solution = solveCircuit(createCanonicalCircuitInput(useLabStore.getState().switchStates));
    expect(solution.isPowerSupplyOn).toBe(false);
    expect(solution.isChipPowered).toBe(false);
    expect(solution.adderOutput).toBeNull();
    for (const led of Object.values(solution.leds)) {
      expect(led.isLit).toBe(false);
    }
    expect(solution.diagnostics.some((d) => d.code === 'POWER_SUPPLY_OFF')).toBe(true);

    // Conmutar mediante togglePowerSupply
    useLabStore.getState().togglePowerSupply();
    expect(useLabStore.getState().switchStates[POWER_SUPPLY_5V.id]).toBe(true);
  });

  // 4. Diagnósticos eléctricos: VCC faltante, GND faltante, cortocircuito, entradas flotantes
  it('4. diagnostica rigurosamente anomalías eléctricas (desconexión de alimentación, cortocircuito y contención)', () => {
    // 4a. VCC desconectado del Pin 5
    const withoutVccWires = JUMPER_WIRES.filter((w) => w.id !== 'w-ic-vcc');
    const solNoVcc = solveCircuit(createCanonicalCircuitInput({ [POWER_SUPPLY_5V.id]: true }, { wires: withoutVccWires }));
    expect(solNoVcc.isChipPowered).toBe(false);
    expect(solNoVcc.diagnostics.some((d) => d.code === 'IC_VCC_DISCONNECTED')).toBe(true);

    // 4b. GND desconectado del Pin 12
    const withoutGndWires = JUMPER_WIRES.filter((w) => w.id !== 'w-ic-gnd');
    const solNoGnd = solveCircuit(createCanonicalCircuitInput({ [POWER_SUPPLY_5V.id]: true }, { wires: withoutGndWires }));
    expect(solNoGnd.isChipPowered).toBe(false);
    expect(solNoGnd.diagnostics.some((d) => d.code === 'IC_GND_DISCONNECTED')).toBe(true);

    // 4c. Cortocircuito entre rieles +5V y GND
    const shortWires = [
      ...JUMPER_WIRES,
      { id: 'w-dead-short', fromTerminalId: 'rail-top-plus-25', toTerminalId: 'rail-top-minus-25' },
    ];
    const solShort = solveCircuit(createCanonicalCircuitInput({ [POWER_SUPPLY_5V.id]: true }, { wires: shortWires }));
    expect(solShort.hasSupplyShortCircuit).toBe(true);
    expect(solShort.diagnostics.some((d) => d.code === 'SHORT_CIRCUIT_SUPPLY')).toBe(true);
  });

  // 5. Sistema de Deshacer (Undo) y Rehacer (Redo) en el montaje interactivo
  it('5. comprueba el funcionamiento del historial de deshacer y rehacer en montaje guiado', () => {
    useLabStore.setState({ mode: 'guided', workingCircuit: createEmptyWorkingCircuit() });
    expect(useLabStore.getState().workingCircuit.chip).toBeNull();
    expect(useLabStore.getState().undoStack).toHaveLength(0);

    // Colocar chip en columna 28 sobre la ranura central
    useLabStore.getState().placeChipAtColumn(28, 'trench');

    expect(useLabStore.getState().workingCircuit.chip).not.toBeNull();
    expect(useLabStore.getState().undoStack.length).toBeGreaterThan(0);

    // Deshacer colocación
    expect(useLabStore.getState().undo()).toBe(true);
    expect(useLabStore.getState().workingCircuit.chip).toBeNull();
    expect(useLabStore.getState().redoStack).toHaveLength(1);

    // Rehacer colocación
    expect(useLabStore.getState().redo()).toBe(true);
    expect(useLabStore.getState().workingCircuit.chip).not.toBeNull();
    expect(useLabStore.getState().redoStack).toHaveLength(0);
  });

  // 6. Persistencia en LocalStorage: almacenamiento seguro, recuperación y resistencia a datos corruptos
  it('6. garantiza la persistencia fiable en LocalStorage y tolerancia ante datos corruptos o esquemas antiguos', () => {
    const canonical = cloneReferenceCircuit();
    const quizAnswers = {
      'pair-f10-g10': true,
      'pair-e10-f10': false,
      'pair-rail-top-plus': true,
      'pair-a5-a6': false,
    };

    const saved = saveGuidedStateToStorage({
      workingCircuit: canonical,
      workingSwitchStates: { [POWER_SUPPLY_5V.id]: true, 'sw-a0': true },
      currentStageIndex: 4,
      highestUnlockedIndex: 5,
      completedStages: [true, true, true, true, false, false, false, false, false],
      hintLevels: [0, 1, 2, 0, 0, 0, 0, 0, 0],
      stage1QuizAnswers: quizAnswers,
      stage8TestedCases: ['test-0-0-0'],
      stage9QuizAnswers: { 'q1-pinout-vcc': 0 },
    });
    expect(saved).toBe(true);

    const loaded = loadGuidedStateFromStorage();
    expect(loaded).not.toBeNull();
    expect(loaded?.currentStageIndex).toBe(4);
    expect(loaded?.highestUnlockedIndex).toBe(5);
    expect(loaded?.workingSwitchStates['sw-a0']).toBe(true);
    expect(loaded?.completedStages[3]).toBe(true);

    // Simular dato corrupto en LocalStorage
    localStorage.setItem(GUIDED_STORAGE_KEY, '<<NOT_JSON_DATA>>');
    const corruptLoaded = loadGuidedStateFromStorage();
    expect(corruptLoaded).toBeNull();

    // Limpieza
    clearGuidedStateFromStorage();
    expect(localStorage.getItem(GUIDED_STORAGE_KEY)).toBeNull();
  });

  // 7. Integridad y separación estricta entre modo montado y montaje guiado
  it('7. confirma que las modificaciones del montaje de usuario no alteran la netlist de referencia', () => {
    const initialWireCount = REFERENCE_CIRCUIT_STATE.wires.length;
    const initialLedCount = REFERENCE_CIRCUIT_STATE.leds.length;

    useLabStore.setState({ mode: 'guided' });
    // Modificar circuito de trabajo borrando todo
    useLabStore.setState({ workingCircuit: createEmptyWorkingCircuit() });

    // Cambiar a modo montado
    useLabStore.getState().setMode('mounted');
    expect(REFERENCE_CIRCUIT_STATE.wires.length).toBe(initialWireCount);
    expect(REFERENCE_CIRCUIT_STATE.leds.length).toBe(initialLedCount);
    expect(REFERENCE_CIRCUIT_STATE.chip?.id).toBe(CHIP_74LS83_PLACEMENT.id);
  });

  // 8. Validación integral de las 9 etapas educativas
  it('8. verifica la coherencia secuencial de los validadores de las 9 etapas educativas', () => {
    const canonical = cloneReferenceCircuit();
    const switches = buildInitialSwitchStates();
    const ctx = makeContext(canonical, switches, {
      stage1QuizAnswers: {
        'pair-f10-g10': true,
        'pair-e10-f10': false,
        'pair-rail-top-plus': true,
        'pair-a5-a6': false,
      },
      stage8TestedCases: STAGE_8_MATH_TEST_CASES.map((tc) => tc.id),
      stage9QuizAnswers: Object.fromEntries(
        STAGE_9_EVALUATION_QUESTIONS.map((q) => [q.id, q.correctOptionIndex]),
      ),
      completedStagesHistory: [true, true, true, true, true, true, true, true, true],
    });

    expect(validateStage1Breadboard(ctx).passed).toBe(true);
    expect(validateStage2Chip(ctx).passed).toBe(true);
    expect(validateStage3Power(ctx).passed).toBe(true);
    expect(validateStage4InputsAB(ctx).passed).toBe(true);
    expect(validateStage5CarryIn(ctx).passed).toBe(true);
    expect(validateStage6OutputsLeds(ctx).passed).toBe(true);
    expect(validateStage7CircuitReview(ctx).passed).toBe(true);
    expect(validateStage8FunctionalTesting(ctx).passed).toBe(true);
    expect(validateStage9Evaluation(ctx).passed).toBe(true);

    const summary = calculateGuidedProgressSummary(8, ctx);
    expect(summary.completedCount).toBe(9);
    expect(summary.isTutorialFinished).toBe(true);
    expect(summary.overallProgressPercent).toBe(100);
  });

  // 9. Eliminación y restitución de cables y verificación de equivalencia
  it('9. demuestra que eliminar un cable y reconectarlo a otro orificio de la misma pista mantiene la validez', () => {
    const canonical = cloneReferenceCircuit();
    const switches = buildInitialSwitchStates();

    // Eliminar jumper de entrada A3
    const wireA3 = canonical.wires.find((w) => w.id === 'w-sig-a3');
    expect(wireA3).toBeDefined();
    if (!wireA3) return;

    const removedOutcome = removeWireFromCircuit(canonical, wireA3.id);
    expect(removedOutcome.removed).toBe(true);

    // Reconectar A3 en otro orificio de la misma pista (h4 -> h28) conectando en g4 -> g28
    const reconnected = addWireToCircuit(removedOutcome.circuit, 'g4', 'g28', WIRE_COLORS.inputA);
    expect(reconnected.ok).toBe(true);
    if (!reconnected.ok) return;

    const origInput = workingCircuitToSolverInput(REFERENCE_CIRCUIT_STATE, switches);
    const newWorkInput = workingCircuitToSolverInput(reconnected.circuit, switches);
    expect(areComponentNetlistsEquivalent(origInput, newWorkInput)).toBe(true);
  });

  // 10. Desbloqueo y visibilidad del modo montaje guiado
  it('10. mantiene oculto el modo montaje guiado por defecto y conmuta su visibilidad con la acción de desbloqueo', () => {
    // Por defecto inicia bloqueado / oculto
    useLabStore.setState({ isGuidedUnlocked: false, mode: 'mounted' });
    expect(useLabStore.getState().isGuidedUnlocked).toBe(false);
    expect(useLabStore.getState().mode).toBe('mounted');

    // Desbloquear montaje guiado
    useLabStore.getState().toggleGuidedUnlocked();
    expect(useLabStore.getState().isGuidedUnlocked).toBe(true);

    // Permitir navegar a modo guiado
    useLabStore.getState().setMode('guided');
    expect(useLabStore.getState().mode).toBe('guided');

    // Al volver a bloquear, se oculta y revierte automáticamente el modo a 'mounted'
    useLabStore.getState().toggleGuidedUnlocked();
    expect(useLabStore.getState().isGuidedUnlocked).toBe(false);
    expect(useLabStore.getState().mode).toBe('mounted');
  });
});
