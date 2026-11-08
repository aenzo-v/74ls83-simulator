import { beforeEach, describe, expect, it } from 'vitest';
import {
  POWER_SUPPLY_5V,
  WIRE_COLORS,
} from '../../data/circuitLayout';
import {
  OPERAND_A_CHANNELS_LSB_FIRST,
  OPERAND_B_CHANNELS_LSB_FIRST,
  CARRY_IN_CHANNEL_ID,
} from '../../data/presets';
import {
  GUIDED_STORAGE_KEY,
  clearGuidedStateFromStorage,
  loadGuidedStateFromStorage,
  saveGuidedStateToStorage,
} from '../../store/guidedPersistence';
import { buildInitialSwitchStates, useLabStore } from '../../store/useLabStore';
import {
  addWireToCircuit,
  createEmptyWorkingCircuit,
  placeChipInCircuit,
  REFERENCE_CIRCUIT_STATE,
  removeWireFromCircuit,
  type WorkingCircuitState,
  workingCircuitToSolverInput,
} from '../editableCircuit';
import {
  GUIDED_STAGES,
  STAGE_1_QUIZ_PAIRS,
  STAGE_8_MATH_TEST_CASES,
  STAGE_9_EVALUATION_QUESTIONS,
} from '../guidedStages';
import {
  calculateGuidedProgressSummary,
  validateStage1Breadboard,
  validateStage2Chip,
  validateStage3Power,
  validateStage4InputsAB,
  validateStage5CarryIn,
  validateStage6OutputsLeds,
  validateStage7CircuitReview,
  validateStage8FunctionalTesting,
  validateStage9Evaluation,
  type GuidedValidationContext,
} from '../guidedValidation';
import { areComponentNetlistsEquivalent, solveCircuit } from '../netlist';

// Mock de localStorage en memoria para el entorno Node/Vitest
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
  value: { localStorage: memStorage },
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

const CORRECT_STAGE_1_ANSWERS: Record<string, boolean> = {
  'pair-f10-g10': true,
  'pair-e10-f10': false,
  'pair-rail-top-plus': true,
  'pair-a5-a6': false,
};

describe('Fase 6 — Montaje guiado educativo e inteligente del 74LS83A', () => {
  beforeEach(() => {
    localStorage.clear();

    useLabStore.setState({
      mode: 'guided',
      switchStates: buildInitialSwitchStates(),
      workingCircuit: createEmptyWorkingCircuit(),
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
      tracedSignal: null,
      wireDraft: null,
    });
  });

  // 1. Progreso inicial del tutorial
  it('1. inicializa el tutorial en la Etapa 1 con etapas 2..9 bloqueadas y 0 etapas completadas', () => {
    const state = useLabStore.getState();
    expect(state.guidedCurrentStageIndex).toBe(0);
    expect(state.guidedHighestUnlockedIndex).toBe(0);
    expect(state.guidedCompletedStages.every((s) => !s)).toBe(true);
    expect(state.guidedPracticeUnlocked).toBe(false);

    const ctx = makeContext(state.workingCircuit, state.switchStates);
    const summary = calculateGuidedProgressSummary(0, ctx);

    expect(summary.completedCount).toBe(0);
    expect(summary.totalStages).toBe(9);
    expect(summary.stageStatuses['stage-1-breadboard']).toBe('current');
    for (let i = 1; i < 9; i++) {
      expect(summary.stageStatuses[GUIDED_STAGES[i]!.id]).toBe('locked');
    }
  });

  // 2. Validación de pistas conectadas y aisladas (Etapa 1)
  it('2. valida correctamente las respuestas del cuestionario interactivo de continuidad MB-102 (Etapa 1)', () => {
    expect(STAGE_1_QUIZ_PAIRS).toHaveLength(4);

    const emptyCircuit = createEmptyWorkingCircuit();

    // Sin respuestas -> no pasa
    const ctxEmpty = makeContext(emptyCircuit, {}, { stage1QuizAnswers: {} });
    const emptyResult = validateStage1Breadboard(ctxEmpty);
    expect(emptyResult.passed).toBe(false);

    // Respuestas incorrectas
    const wrongAnswers: Record<string, boolean> = {
      'pair-f10-g10': false,
      'pair-e10-f10': true,
      'pair-rail-top-plus': false,
      'pair-a5-a6': true,
    };
    const ctxWrong = makeContext(emptyCircuit, {}, { stage1QuizAnswers: wrongAnswers });
    const wrongResult = validateStage1Breadboard(ctxWrong);
    expect(wrongResult.passed).toBe(false);
    expect(wrongResult.checklistResults.every((c) => !c.passed)).toBe(true);

    // Respuestas todas correctas
    const ctxCorrect = makeContext(emptyCircuit, {}, { stage1QuizAnswers: CORRECT_STAGE_1_ANSWERS });
    const correctResult = validateStage1Breadboard(ctxCorrect);
    expect(correctResult.passed).toBe(true);
    expect(correctResult.checklistResults.every((c) => c.passed)).toBe(true);
  });

  // 3. Colocación correcta e incorrecta del 74LS83A (Etapa 2)
  it('3. valida rigurosamente la colocación física del 74LS83A sobre la ranura central (Etapa 2)', () => {
    const emptyCircuit = createEmptyWorkingCircuit();
    const ctxNoChip = makeContext(emptyCircuit);
    const resNoChip = validateStage2Chip(ctxNoChip);
    expect(resNoChip.passed).toBe(false);

    // Colocar chip cruzando ranura central en columna 28
    const placedRes = placeChipInCircuit(emptyCircuit, 28, 'trench');
    expect(placedRes.ok).toBe(true);
    if (!placedRes.ok) return;

    const ctxValidChip = makeContext(placedRes.circuit);
    const resValidChip = validateStage2Chip(ctxValidChip);
    expect(resValidChip.passed).toBe(true);
    expect(resValidChip.checklistResults.every((c) => c.passed)).toBe(true);
  });

  // 4. Validación eléctrica de VCC y GND (Etapa 3)
  it('4. valida la alimentación eléctrica (Pin 5 VCC y Pin 12 GND), detectando polaridad y cortocircuitos (Etapa 3)', () => {
    let circuit = createEmptyWorkingCircuit();
    const chipRes = placeChipInCircuit(circuit, 28, 'trench');
    expect(chipRes.ok).toBe(true);
    if (!chipRes.ok) return;
    circuit = chipRes.circuit;

    // Pin 5 está en f32; la columna 32 tiene los agujeros g32, h32, i32, j32 libres en esa misma pista
    const wireVcc = addWireToCircuit(circuit, 'psu-5v:plus', 'g32', WIRE_COLORS.vcc);
    expect(wireVcc.ok).toBe(true);
    if (!wireVcc.ok) return;
    circuit = wireVcc.circuit;

    const switches = { [POWER_SUPPLY_5V.id]: true };
    let ctx = makeContext(circuit, switches);
    let resPower = validateStage3Power(ctx);
    expect(resPower.passed).toBe(false);

    // Pin 12 está en e32; la columna 32 superior tiene a32, b32, c32, d32 libres
    const wireGnd = addWireToCircuit(circuit, 'psu-5v:gnd', 'a32', WIRE_COLORS.gnd);
    expect(wireGnd.ok).toBe(true);
    if (!wireGnd.ok) return;
    circuit = wireGnd.circuit;

    ctx = makeContext(circuit, switches);
    resPower = validateStage3Power(ctx);
    expect(resPower.passed).toBe(true);
    expect(resPower.checklistResults.every((c) => c.passed)).toBe(true);

    // Si la fuente está apagada
    const ctxOff = makeContext(circuit, { [POWER_SUPPLY_5V.id]: false });
    const resOff = validateStage3Power(ctxOff);
    expect(resOff.passed).toBe(false);
  });

  // 5. Conexión correcta de las ocho entradas A y B (Etapa 4)
  it('5. verifica que las ocho entradas A0..A3 y B0..B3 tengan interruptor y pull-down resistivo (Etapa 4)', () => {
    const canonical = cloneReferenceCircuit();
    const switches = buildInitialSwitchStates();
    const ctxCanonical = makeContext(canonical, switches);

    const resCanonical = validateStage4InputsAB(ctxCanonical);
    expect(resCanonical.passed).toBe(true);
    expect(resCanonical.checklistResults.every((c) => c.passed)).toBe(true);

    // Si retiramos una resistencia pull-down de entrada
    const resistorA0 = canonical.resistors.find((r) => r.leadAHoleId === 'j10' || r.leadBHoleId === 'j10' || r.id === 'r-pd-a0');
    expect(resistorA0).toBeDefined();
    if (resistorA0) {
      const brokenResistors = canonical.resistors.filter((r) => r.id !== resistorA0.id);
      const brokenCircuit = { ...canonical, resistors: brokenResistors };
      const ctxBroken = makeContext(brokenCircuit, switches);
      const resBroken = validateStage4InputsAB(ctxBroken);
      expect(resBroken.passed).toBe(false);
    }
  });

  // 6. Validación de C0 (Etapa 5)
  it('6. comprueba la línea de acarreo inicial C0 (Pin 13) con interruptor y pull-down a masa (Etapa 5)', () => {
    const canonical = cloneReferenceCircuit();
    const switches = buildInitialSwitchStates();
    const ctxCanonical = makeContext(canonical, switches);

    const resC0 = validateStage5CarryIn(ctxCanonical);
    expect(resC0.passed).toBe(true);
    expect(resC0.checklistResults.every((c) => c.passed)).toBe(true);

    // Si retiramos el cable que conecta al Pin 13 (columna 33)
    const wireC0 = canonical.wires.find(
      (w) => w.fromTerminalId.includes('33') || w.toTerminalId.includes('33')
    );
    expect(wireC0).toBeDefined();
    if (wireC0) {
      const withoutC0 = removeWireFromCircuit(canonical, wireC0.id).circuit;
      const ctxBroken = makeContext(withoutC0, switches);
      const resBroken = validateStage5CarryIn(ctxBroken);
      expect(resBroken.passed).toBe(false);
    }
  });

  // 7. Polaridad y resistencias de LEDs (Etapa 6)
  it('7. valida los cinco LEDs indicadores con sus resistencias de 1 kΩ y polaridad hacia GND (Etapa 6)', () => {
    const canonical = cloneReferenceCircuit();
    const switches = buildInitialSwitchStates();
    const ctxCanonical = makeContext(canonical, switches);

    const resLeds = validateStage6OutputsLeds(ctxCanonical);
    expect(resLeds.passed).toBe(true);
    expect(resLeds.checklistResults.every((c) => c.passed)).toBe(true);

    // Si invertimos la polaridad del LED S0
    const ledS0 = canonical.leds.find((l) => l.id === 'led-s0');
    expect(ledS0).toBeDefined();
    if (ledS0) {
      const reversedLeds = canonical.leds.map((l) =>
        l.id === ledS0.id ? { ...l, anodeHoleId: l.cathodeHoleId, cathodeHoleId: l.anodeHoleId } : l
      );
      const reversedCircuit = { ...canonical, leds: reversedLeds };
      const ctxReversed = makeContext(reversedCircuit, switches);
      const resReversed = validateStage6OutputsLeds(ctxReversed);
      expect(resReversed.passed).toBe(false);
    }
  });

  // 8. Aceptación de agujeros eléctricamente equivalentes
  it('8. acepta conexiones en agujeros alternativos de la misma pista eléctrica', () => {
    let circuit = createEmptyWorkingCircuit();
    const chipRes = placeChipInCircuit(circuit, 28, 'trench');
    if (!chipRes.ok) return;
    circuit = chipRes.circuit;

    // Pin 5 está en f32; la columna 32 tiene g32, h32, i32, j32 libres en esa misma pista
    const wVcc = addWireToCircuit(circuit, 'rail-top-plus-15', 'j32', WIRE_COLORS.vcc);
    expect(wVcc.ok).toBe(true);
    if (!wVcc.ok) return;

    // Pin 12 está en e32; la pista superior tiene a32..d32 libres. Conectamos a a32 en vez de e32
    const wGnd = addWireToCircuit(wVcc.circuit, 'rail-top-minus-15', 'a32', WIRE_COLORS.gnd);
    expect(wGnd.ok).toBe(true);
    if (!wGnd.ok) return;

    // Puentes fuente
    const wPsuPlus = addWireToCircuit(wGnd.circuit, 'psu-5v:plus', 'rail-top-plus-2', WIRE_COLORS.vcc);
    expect(wPsuPlus.ok).toBe(true);
    if (!wPsuPlus.ok) return;

    const wPsuMinus = addWireToCircuit(wPsuPlus.circuit, 'psu-5v:gnd', 'rail-top-minus-2', WIRE_COLORS.gnd);
    expect(wPsuMinus.ok).toBe(true);
    if (!wPsuMinus.ok) return;

    const switches = { [POWER_SUPPLY_5V.id]: true };
    const ctx = makeContext(wPsuMinus.circuit, switches);
    const powerRes = validateStage3Power(ctx);

    expect(powerRes.passed).toBe(true);
    expect(powerRes.checklistResults.every((c) => c.passed)).toBe(true);
  });

  // 9. Rechazo de conexiones incorrectas con diagnóstico en español
  it('9. rechaza conexiones erróneas y proporciona diagnóstico explicativo', () => {
    let circuit = createEmptyWorkingCircuit();
    const chipRes = placeChipInCircuit(circuit, 28, 'trench');
    if (!chipRes.ok) return;
    circuit = chipRes.circuit;

    // Conectar +5V al Pin 9 (S0, salida) en g36 en vez del Pin 5 (VCC)
    const wWrong = addWireToCircuit(circuit, 'psu-5v:plus', 'g36', WIRE_COLORS.vcc);
    expect(wWrong.ok).toBe(true);
    if (!wWrong.ok) return;

    const switches = { [POWER_SUPPLY_5V.id]: true };
    const ctx = makeContext(wWrong.circuit, switches);
    const powerRes = validateStage3Power(ctx);

    expect(powerRes.passed).toBe(false);
    expect(powerRes.statusMessageEs).toBeDefined();
    expect(powerRes.statusMessageEs.length).toBeGreaterThan(0);
  });

  // 10. Detección de cortocircuitos
  it('10. detecta cortocircuito directo entre VCC y GND y bloquea la etapa con alerta crítica', () => {
    let circuit = cloneReferenceCircuit();
    // Usar agujeros de riel superiores disponibles (columna 20)
    const shortWire = addWireToCircuit(circuit, 'rail-top-plus-20', 'rail-top-minus-20', '#000000');
    expect(shortWire.ok).toBe(true);
    if (!shortWire.ok) return;

    const switches = { [POWER_SUPPLY_5V.id]: true };
    const ctx = makeContext(shortWire.circuit, switches);

    expect(ctx.solution.hasSupplyShortCircuit).toBe(true);
    const powerRes = validateStage3Power(ctx);
    expect(powerRes.passed).toBe(false);
    expect(powerRes.criticalErrorDetected).toBe(true);
    expect(powerRes.checklistResults.find((c) => c.label.includes('cortocircuito'))?.passed).toBe(false);
  });

  // 11. Navegación entre etapas con protección contra avance indebido
  it('11. bloquea el avance a etapas posteriores si la etapa actual no está completada', () => {
    expect(useLabStore.getState().guidedCurrentStageIndex).toBe(0);

    // Intentar avanzar sin responder la etapa 1
    useLabStore.getState().nextGuidedStage();
    expect(useLabStore.getState().guidedCurrentStageIndex).toBe(0);

    // Responder correctamente la etapa 1
    for (const [pairId, val] of Object.entries(CORRECT_STAGE_1_ANSWERS)) {
      useLabStore.getState().answerStage1Quiz(pairId, val);
    }

    // Comprobar etapa
    const checkResult = useLabStore.getState().checkCurrentGuidedStage();
    expect(checkResult.passed).toBe(true);

    // Ahora avanzar a etapa 2
    useLabStore.getState().nextGuidedStage();
    expect(useLabStore.getState().guidedCurrentStageIndex).toBe(1);
    expect(useLabStore.getState().guidedHighestUnlockedIndex).toBe(1);

    // Retroceder a etapa 1 para consulta
    useLabStore.getState().prevGuidedStage();
    expect(useLabStore.getState().guidedCurrentStageIndex).toBe(0);

    // Regresar a etapa 2 desbloqueada
    useLabStore.getState().setGuidedStageIndex(1);
    expect(useLabStore.getState().guidedCurrentStageIndex).toBe(1);

    // Intentar saltar directamente a etapa 5 (bloqueada)
    useLabStore.getState().setGuidedStageIndex(5);
    expect(useLabStore.getState().guidedCurrentStageIndex).toBe(1); // No cambia
  });

  // 12. Invalidación de etapas al desmontar componentes esenciales
  it('12. marca etapas como invalidadas si se desmonta un requisito previo completado', () => {
    // Historial con etapas 1, 2 y 3 registradas como completadas
    const completedHistory = [true, true, true, false, false, false, false, false, false];
    // Pero el circuito actual está vacío (se retiró el chip y cables)
    const emptyCircuit = createEmptyWorkingCircuit();

    const ctx = makeContext(emptyCircuit, { [POWER_SUPPLY_5V.id]: true }, {
      completedStagesHistory: completedHistory,
      stage1QuizAnswers: CORRECT_STAGE_1_ANSWERS,
    });

    const summary = calculateGuidedProgressSummary(3, ctx);
    expect(summary.stageStatuses['stage-1-breadboard']).toBe('completed');
    expect(summary.stageStatuses['stage-2-chip']).toBe('invalidated');
    expect(summary.stageStatuses['stage-3-power']).toBe('invalidated');
    expect(summary.invalidationWarningEs).not.toBeNull();
  });

  // 13. Funcionamiento de las pistas progresivas en 3 niveles
  it('13. alterna cíclicamente entre los 3 niveles de pistas progresivas (0 -> 1 -> 2 -> 3 -> 0)', () => {
    expect(useLabStore.getState().guidedHintLevels[0]).toBe(0);

    // Nivel 1: Orientación pedagógica
    useLabStore.getState().cycleGuidedHintLevel();
    expect(useLabStore.getState().guidedHintLevels[0]).toBe(1);

    // Nivel 2: Identificación técnica
    useLabStore.getState().cycleGuidedHintLevel();
    expect(useLabStore.getState().guidedHintLevels[0]).toBe(2);

    // Nivel 3: Asistencia visual 3D
    useLabStore.getState().cycleGuidedHintLevel();
    expect(useLabStore.getState().guidedHintLevels[0]).toBe(3);

    // Regresa a 0
    useLabStore.getState().cycleGuidedHintLevel();
    expect(useLabStore.getState().guidedHintLevels[0]).toBe(0);
  });

  // 14. Persistencia y recuperación de progreso en LocalStorage
  it('14. guarda y recupera el progreso en LocalStorage resistiendo datos corruptos', () => {
    const canonical = cloneReferenceCircuit();

    saveGuidedStateToStorage({
      workingCircuit: canonical,
      workingSwitchStates: { [POWER_SUPPLY_5V.id]: true },
      currentStageIndex: 3,
      highestUnlockedIndex: 3,
      completedStages: [true, true, true, false, false, false, false, false, false],
      hintLevels: [0, 0, 0, 2, 0, 0, 0, 0, 0],
      stage1QuizAnswers: CORRECT_STAGE_1_ANSWERS,
      stage8TestedCases: ['test-0-0-0', 'test-7-1-0'],
      stage9QuizAnswers: { 'q1-pinout-vcc': 0 },
    });

    const loaded = loadGuidedStateFromStorage();
    expect(loaded).not.toBeNull();
    expect(loaded?.currentStageIndex).toBe(3);
    expect(loaded?.highestUnlockedIndex).toBe(3);
    expect(loaded?.completedStages[0]).toBe(true);
    expect(loaded?.stage1QuizAnswers['pair-f10-g10']).toBe(true);

    // Si los datos en LocalStorage están corruptos
    localStorage.setItem(GUIDED_STORAGE_KEY, '{ json corrupto %%%');
    const corruptLoaded = loadGuidedStateFromStorage();
    expect(corruptLoaded).toBeNull();

    // Limpieza
    clearGuidedStateFromStorage();
    expect(localStorage.getItem(GUIDED_STORAGE_KEY)).toBeNull();
  });

  // 15. Equivalencia eléctrica con el circuito canónico (Etapa 7)
  it('15. comprueba que el circuito canónico cumple la equivalencia de netlist en la Etapa 7', () => {
    const canonical = cloneReferenceCircuit();
    const switches = buildInitialSwitchStates();
    const ctx = makeContext(canonical, switches);

    const resReview = validateStage7CircuitReview(ctx);
    expect(resReview.passed).toBe(true);
    expect(resReview.checklistResults.every((c) => c.passed)).toBe(true);

    const refInput = workingCircuitToSolverInput(REFERENCE_CIRCUIT_STATE, switches);
    const workInput = workingCircuitToSolverInput(canonical, switches);
    expect(areComponentNetlistsEquivalent(refInput, workInput)).toBe(true);
  });

  // 16. Ejecución de las 4 operaciones aritméticas requeridas (Etapa 8)
  it('16. verifica las cuatro operaciones aritméticas 0+0, 7+1, 15+1 y 15+15+1 en la Etapa 8', () => {
    const canonical = cloneReferenceCircuit();
    expect(STAGE_8_MATH_TEST_CASES).toHaveLength(4);

    const testedIds: string[] = [];
    for (const tc of STAGE_8_MATH_TEST_CASES) {
      const switches: Record<string, boolean> = { [POWER_SUPPLY_5V.id]: true };

      // Configurar operandA
      for (let bit = 0; bit < 4; bit++) {
        const swId = OPERAND_A_CHANNELS_LSB_FIRST[bit]!;
        switches[swId] = Boolean((tc.operandA >> bit) & 1);
      }
      // Configurar operandB
      for (let bit = 0; bit < 4; bit++) {
        const swId = OPERAND_B_CHANNELS_LSB_FIRST[bit]!;
        switches[swId] = Boolean((tc.operandB >> bit) & 1);
      }
      // Configurar Cin
      switches[CARRY_IN_CHANNEL_ID] = Boolean(tc.carryIn);

      const solution = solveCircuit(workingCircuitToSolverInput(canonical, switches));
      expect(solution.adderOutput).not.toBeNull();
      expect(solution.adderOutput?.totalValue).toBe(tc.expectedTotal);
      expect(solution.adderOutput?.sumValue).toBe(tc.expectedTotal & 0x0f);
      expect(solution.adderOutput?.carryOut).toBe((tc.expectedTotal >> 4) & 1);

      testedIds.push(tc.id);
    }

    const ctx = makeContext(canonical, { [POWER_SUPPLY_5V.id]: true }, { stage8TestedCases: testedIds });
    const resMath = validateStage8FunctionalTesting(ctx);
    expect(resMath.passed).toBe(true);
    expect(resMath.checklistResults.every((c) => c.passed)).toBe(true);
  });

  // 17. Separación entre modo montado y montaje guiado
  it('17. garantiza que las modificaciones en montaje guiado no alteren el circuito canónico del modo montado', () => {
    const initialReferenceWiresCount = REFERENCE_CIRCUIT_STATE.wires.length;
    const initialReferenceResistorsCount = REFERENCE_CIRCUIT_STATE.resistors.length;

    // Modificar workingCircuit en el store
    const empty = createEmptyWorkingCircuit();
    useLabStore.setState({ workingCircuit: empty });

    // La referencia estática del modo montado permanece inalterada
    expect(REFERENCE_CIRCUIT_STATE.wires.length).toBe(initialReferenceWiresCount);
    expect(REFERENCE_CIRCUIT_STATE.resistors.length).toBe(initialReferenceResistorsCount);
    expect(REFERENCE_CIRCUIT_STATE.chip).not.toBeNull();
  });

  // 18. Funcionamiento del circuito construido tras completar el tutorial
  it('18. desbloquea la práctica libre y mantiene la reactividad del circuito ensamblado tras completar la Etapa 9', () => {
    expect(STAGE_9_EVALUATION_QUESTIONS).toHaveLength(5);

    // Respuestas correctas
    const correctAnswers: Record<string, number> = {};
    for (const q of STAGE_9_EVALUATION_QUESTIONS) {
      correctAnswers[q.id] = q.correctOptionIndex;
    }

    const canonical = cloneReferenceCircuit();
    const ctx = makeContext(canonical, { [POWER_SUPPLY_5V.id]: true }, { stage9QuizAnswers: correctAnswers });
    const resEval = validateStage9Evaluation(ctx);

    expect(resEval.passed).toBe(true);
    expect(resEval.checklistResults.every((c) => c.passed)).toBe(true);

    // En el store: registrar respuestas y desbloquear práctica
    for (const [qId, idx] of Object.entries(correctAnswers)) {
      useLabStore.getState().answerStage9Quiz(qId, idx);
    }
    useLabStore.getState().setGuidedPracticeUnlocked(true);

    expect(useLabStore.getState().guidedPracticeUnlocked).toBe(true);

    // El circuito montado del estudiante responde interactivamente: A=5, B=10, C0=1 -> Total 16
    const studentCircuit = cloneReferenceCircuit();
    useLabStore.setState({ workingCircuit: studentCircuit });

    const switches: Record<string, boolean> = { [POWER_SUPPLY_5V.id]: true };
    for (let bit = 0; bit < 4; bit++) {
      switches[OPERAND_A_CHANNELS_LSB_FIRST[bit]!] = Boolean((5 >> bit) & 1);
      switches[OPERAND_B_CHANNELS_LSB_FIRST[bit]!] = Boolean((10 >> bit) & 1);
    }
    switches[CARRY_IN_CHANNEL_ID] = true;

    const solution = solveCircuit(workingCircuitToSolverInput(studentCircuit, switches));
    expect(solution.adderOutput).not.toBeNull();
    expect(solution.adderOutput?.totalValue).toBe(16);
    expect(solution.adderOutput?.sumValue).toBe(0);
    expect(solution.adderOutput?.carryOut).toBe(1);
    expect(solution.leds['led-c4']?.isLit).toBe(true);
  });
});
