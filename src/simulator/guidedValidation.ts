import {
  createCanonicalCircuitInput,
  POWER_SUPPLY_5V,
} from '../data/circuitLayout';
import type { CircuitSolution } from './netlist';
import { areComponentNetlistsEquivalent } from './netlist';
import { getDip16PinHoleId } from './pinout74ls83';
import {
  type WorkingCircuitState,
  workingCircuitToSolverInput,
} from './editableCircuit';
import {
  GUIDED_STAGES,
  type GuidedStageId,
  type GuidedStageStatus,
  STAGE_1_QUIZ_PAIRS,
  STAGE_8_MATH_TEST_CASES,
  STAGE_9_EVALUATION_QUESTIONS,
} from './guidedStages';

/**
 * FASE 6 — Motor de Validación Eléctrica y Pedagógica para Montaje Guiado.
 *
 * Evalúa el circuito editable real, la netlist, las polarizaciones y los resultados
 * lógicos del 74LS83A, admitiendo conexiones eléctricamente equivalentes y
 * detectando invalidaciones acumulativas si el estudiante desconecta partes esenciales.
 */

export interface StageChecklistResult {
  readonly label: string;
  readonly passed: boolean;
  readonly feedbackEs?: string;
}

export interface StageValidationResult {
  readonly stageId: GuidedStageId;
  readonly passed: boolean;
  readonly severity: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR';
  readonly statusMessageEs: string;
  readonly technicalDetailsEs: string;
  readonly checklistResults: readonly StageChecklistResult[];
  readonly criticalErrorDetected: boolean;
  readonly canProceed: boolean;
}

export interface GuidedProgressSummary {
  readonly stageStatuses: Readonly<Record<GuidedStageId, GuidedStageStatus>>;
  readonly currentStageId: GuidedStageId;
  readonly completedCount: number;
  readonly totalStages: number;
  readonly overallProgressPercent: number;
  readonly isTutorialFinished: boolean;
  readonly invalidationWarningEs: string | null;
}

export interface GuidedValidationContext {
  readonly circuit: WorkingCircuitState;
  readonly switchStates: Readonly<Record<string, boolean>>;
  readonly solution: CircuitSolution;
  readonly stage1QuizAnswers: Readonly<Record<string, boolean>>;
  readonly stage8TestedCases: readonly string[];
  readonly stage9QuizAnswers: Readonly<Record<string, number>>;
  readonly completedStagesHistory: readonly boolean[]; // Index 0..8
}

// ============================================================================
// Validadores específicos por Etapa (1 a 9)
// ============================================================================

export function validateStage1Breadboard(
  ctx: GuidedValidationContext,
): StageValidationResult {
  const stage = GUIDED_STAGES[0]!;
  const answers = ctx.stage1QuizAnswers;

  let allAnswered = true;
  let allCorrect = true;
  const checklistResults: StageChecklistResult[] = [];

  for (const pair of STAGE_1_QUIZ_PAIRS) {
    const ans = answers[pair.id];
    if (ans === undefined) {
      allAnswered = false;
      checklistResults.push({
        label: `Evaluar continuidad entre ${pair.labelA} y ${pair.labelB}`,
        passed: false,
        feedbackEs: 'Pendiente de clasificar.',
      });
    } else if (ans === pair.expectedConnected) {
      checklistResults.push({
        label: `Par ${pair.labelA} y ${pair.labelB}: Correcto (${pair.expectedConnected ? 'Conectados' : 'Aislados'})`,
        passed: true,
        feedbackEs: pair.explanationEs,
      });
    } else {
      allCorrect = false;
      checklistResults.push({
        label: `Par ${pair.labelA} y ${pair.labelB}: Incorrecto`,
        passed: false,
        feedbackEs: `Seleccionaste "${ans ? 'Conectados' : 'Aislados'}". ${pair.explanationEs}`,
      });
    }
  }

  const passed = allAnswered && allCorrect;
  return {
    stageId: stage.id,
    passed,
    severity: passed ? 'SUCCESS' : allAnswered ? 'ERROR' : 'INFO',
    statusMessageEs: passed
      ? '¡Excelente! Comprendes la continuidad interna de las pistas y el aislamiento del canal central.'
      : allAnswered
        ? 'Revisa tus respuestas: algunos pares de contactos no coinciden con la topología real de la protoboard.'
        : 'Responde la clasificación de continuidad para los 4 pares de contactos de la protoboard.',
    technicalDetailsEs:
      'Las pistas de terminales forman columnas verticales de 5 nodos. El canal central aísla los semibloques superior e inferior.',
    checklistResults,
    criticalErrorDetected: false,
    canProceed: passed,
  };
}

export function validateStage2Chip(
  ctx: GuidedValidationContext,
): StageValidationResult {
  const stage = GUIDED_STAGES[1]!;
  const chip = ctx.circuit.chip;

  const isPlaced = chip !== null;
  const isColumnValid =
    chip !== null && chip.startColumn >= 1 && chip.startColumn <= 56;
  const isOrientationLeft = chip !== null && chip.notchOrientation === 'LEFT';

  const checklistResults: StageChecklistResult[] = [
    {
      label: 'Integrado SN74LS83AN colocado en la protoboard',
      passed: isPlaced,
      feedbackEs: isPlaced
        ? `Insertado con Pin 1 en columna ${chip.startColumn}.`
        : 'Usa la herramienta «Colocar» y selecciona el 74LS83A del kit.',
    },
    {
      label: 'Montado a horcajadas sobre la ranura central (filas e y f)',
      passed: isPlaced,
      feedbackEs: isPlaced
        ? 'Alineado correctamente entre filas e y f.'
        : 'Debe insertarse atravesando el canal central DIP.',
    },
    {
      label: 'Columna inicial válida dentro de los límites de la protoboard (1..56)',
      passed: isColumnValid,
      feedbackEs: isColumnValid
        ? `Columnas ocupadas: ${chip.startColumn} a ${chip.startColumn + 7}.`
        : 'El chip requiere 8 columnas útiles sin salirse de la matriz.',
    },
    {
      label: 'Muesca de orientación hacia la izquierda (Pin 1 en fila f)',
      passed: isOrientationLeft,
      feedbackEs: isOrientationLeft
        ? 'Orientación canónica correcta.'
        : 'Verifica la muesca lateral.',
    },
  ];

  const passed = isPlaced && isColumnValid && isOrientationLeft;
  return {
    stageId: stage.id,
    passed,
    severity: passed ? 'SUCCESS' : isPlaced ? 'WARNING' : 'INFO',
    statusMessageEs: passed
      ? '¡74LS83A correctamente insertado sobre el canal central!'
      : 'Coloca el integrado 74LS83A atravesando la ranura central de la protoboard.',
    technicalDetailsEs: isPlaced
      ? `Pin 1 ubicado en f${chip.startColumn}, Pin 16 en e${chip.startColumn}. Todas sus patas tienen acceso a pistas de 5 alvéolos.`
      : 'El encapsulado DIP-16 debe cruzar la ranura de 7.62 mm para aislar sus terminales opuestos.',
    checklistResults,
    criticalErrorDetected: false,
    canProceed: passed,
  };
}

export function validateStage3Power(
  ctx: GuidedValidationContext,
): StageValidationResult {
  const stage = GUIDED_STAGES[2]!;
  const chip = ctx.circuit.chip;
  const solution = ctx.solution;

  if (!chip) {
    return {
      stageId: stage.id,
      passed: false,
      severity: 'ERROR',
      statusMessageEs: 'Se requiere el integrado 74LS83A colocado en la etapa previa.',
      technicalDetailsEs: 'El chip debe estar montado para validar la llegada de VCC y GND.',
      checklistResults: [
        { label: 'Integrado 74LS83A montado', passed: false },
        { label: 'Borne +5 V conectado a riel', passed: false },
        { label: 'Borne GND conectado a riel', passed: false },
        { label: 'Pin 5 (VCC) alimentado con +5.0 V', passed: false },
        { label: 'Pin 12 (GND) conectado a tierra', passed: false },
        { label: 'Fuente encendida y sin cortocircuitos', passed: false },
      ],
      criticalErrorDetected: false,
      canProceed: false,
    };
  }

  const vccHole = getDip16PinHoleId(5, chip.startColumn);
  const gndHole = getDip16PinHoleId(12, chip.startColumn);
  const vccNetId = solution.terminalToNetId[vccHole];
  const gndPinNetId = solution.terminalToNetId[gndHole];

  const plusNetId = solution.terminalToNetId[POWER_SUPPLY_5V.plusTerminalId];
  const gndNetId = solution.terminalToNetId[POWER_SUPPLY_5V.gndTerminalId];

  const hasShortCircuit = solution.hasSupplyShortCircuit;
  const isPsuOn = solution.isPowerSupplyOn;

  const vccConnected = !hasShortCircuit && vccNetId !== undefined && vccNetId === plusNetId;
  const gndConnected = !hasShortCircuit && gndPinNetId !== undefined && gndPinNetId === gndNetId;

  const hasReversePolarity = solution.diagnostics.some(
    (d) => d.code === 'IC_REVERSE_POLARITY',
  );

  const checklistResults: StageChecklistResult[] = [
    {
      label: 'Sin cortocircuito entre alimentación (+5 V) y tierra (GND)',
      passed: !hasShortCircuit,
      feedbackEs: hasShortCircuit
        ? '¡CORTOCIRCUITO DETECTADO! Hay un cable uniendo directamente +5 V y GND.'
        : 'Aislamiento de rieles correcto.',
    },
    {
      label: 'Polaridad correcta en pines de alimentación (sin inversión)',
      passed: !hasReversePolarity,
      feedbackEs: hasReversePolarity
        ? 'Polaridad invertida: Pin 5 o Pin 12 están conectados al riel opuesto.'
        : 'Polaridad nominal correcta.',
    },
    {
      label: `Pin 5 (VCC) conectado a +5.0 V (nodo ${vccHole})`,
      passed: vccConnected,
      feedbackEs: vccConnected
        ? 'Continuidad +5 V verificada en Pin 5.'
        : 'Falta cable desde el riel positivo (+) hacia la pista del Pin 5.',
    },
    {
      label: `Pin 12 (GND) conectado a tierra (nodo ${gndHole})`,
      passed: gndConnected,
      feedbackEs: gndConnected
        ? 'Continuidad GND verificada en Pin 12.'
        : 'Falta cable desde el riel negativo (−) hacia la pista del Pin 12.',
    },
    {
      label: 'Fuente regulada de +5.0 V encendida',
      passed: isPsuOn,
      feedbackEs: isPsuOn
        ? 'Fuente activa suministrando +5.0 V nominal.'
        : 'La fuente está apagada (STBY). Enciéndela para energizar el circuito.',
    },
  ];

  const passed =
    !hasShortCircuit &&
    !hasReversePolarity &&
    vccConnected &&
    gndConnected &&
    isPsuOn;

  return {
    stageId: stage.id,
    passed,
    severity: hasShortCircuit
      ? 'ERROR'
      : passed
        ? 'SUCCESS'
        : !isPsuOn && vccConnected && gndConnected
          ? 'WARNING'
          : 'INFO',
    statusMessageEs: hasShortCircuit
      ? '¡Peligro de cortocircuito! Retira el cable que une +5 V y GND.'
      : passed
        ? '¡Alimentación de +5.0 V y GND verificada correctamente en el 74LS83A!'
        : !isPsuOn && vccConnected && gndConnected
          ? 'Cables conectados. Enciende la fuente de +5.0 V para completar la etapa.'
          : 'Conecta VCC al Pin 5 y GND al Pin 12 del 74LS83A.',
    technicalDetailsEs:
      'Pinout crítico del 74LS83A: Pin 5 = VCC (+5 V) en fila f; Pin 12 = GND (0 V) en fila e.',
    checklistResults,
    criticalErrorDetected: hasShortCircuit || hasReversePolarity,
    canProceed: passed,
  };
}

export function validateStage4InputsAB(
  ctx: GuidedValidationContext,
): StageValidationResult {
  const stage = GUIDED_STAGES[3]!;
  const solution = ctx.solution;

  // Comprobar pre-requisito de alimentación
  const powerResult = validateStage3Power(ctx);
  if (!powerResult.passed) {
    return {
      stageId: stage.id,
      passed: false,
      severity: 'ERROR',
      statusMessageEs: 'Primero debes completar y mantener la alimentación válida (Etapa 3).',
      technicalDetailsEs: powerResult.statusMessageEs,
      checklistResults: [
        { label: 'Alimentación VCC y GND de Etapa 3 activa', passed: false },
        { label: 'Interruptores DIP-4 de A y B montados', passed: false },
        { label: '8 entradas A3..A0 y B3..B0 cableadas', passed: false },
        { label: 'Resistencias pull-down de 330 Ω instaladas', passed: false },
        { label: 'Sin entradas flotantes en A ni en B', passed: false },
      ],
      criticalErrorDetected: powerResult.criticalErrorDetected,
      canProceed: false,
    };
  }

  const placedDipIds = new Set(ctx.circuit.dipSwitches.map((s) => s.id));
  const hasDipA = placedDipIds.has('dip-sw-a');
  const hasDipB = placedDipIds.has('dip-sw-b');

  const inputPinsA = [
    { pin: 10, sig: 'A0' },
    { pin: 8, sig: 'A1' },
    { pin: 3, sig: 'A2' },
    { pin: 1, sig: 'A3' },
  ] as const;

  const inputPinsB = [
    { pin: 11, sig: 'B0' },
    { pin: 7, sig: 'B1' },
    { pin: 4, sig: 'B2' },
    { pin: 16, sig: 'B3' },
  ] as const;

  const floatingPins = new Set(
    solution.diagnostics
      .filter((d) => d.code === 'FLOATING_INPUT')
      .flatMap((d) => d.relatedPins ?? []),
  );

  const wrongConnectionPins = new Set(
    solution.diagnostics
      .filter((d) => d.code === 'WRONG_PIN_CONNECTION')
      .flatMap((d) => d.relatedPins ?? []),
  );

  let aPinsValid = true;
  for (const item of inputPinsA) {
    const pinState = solution.pins[item.pin as 1 | 3 | 8 | 10];
    if (
      !pinState ||
      pinState.drive === 'FLOATING' ||
      pinState.drive === 'UNPOWERED' ||
      floatingPins.has(item.pin as 1 | 3 | 8 | 10) ||
      wrongConnectionPins.has(item.pin as 1 | 3 | 8 | 10)
    ) {
      aPinsValid = false;
      break;
    }
  }

  let bPinsValid = true;
  for (const item of inputPinsB) {
    const pinState = solution.pins[item.pin as 4 | 7 | 11 | 16];
    if (
      !pinState ||
      pinState.drive === 'FLOATING' ||
      pinState.drive === 'UNPOWERED' ||
      floatingPins.has(item.pin as 4 | 7 | 11 | 16) ||
      wrongConnectionPins.has(item.pin as 4 | 7 | 11 | 16)
    ) {
      bPinsValid = false;
      break;
    }
  }

  // Contabilizar resistencias de 330 Ω en el circuito
  const r330Count = ctx.circuit.resistors.filter((r) => r.ohms === 330).length;

  const checklistResults: StageChecklistResult[] = [
    {
      label: 'Interruptores DIP-4 de A y B montados en la protoboard',
      passed: hasDipA && hasDipB,
      feedbackEs: hasDipA && hasDipB ? 'DIP-4 A y B montados.' : 'Falta colocar DIP-4 A o B.',
    },
    {
      label: '4 líneas de entrada de A (A3..A0) cableadas a pines 1, 3, 8 y 10',
      passed: aPinsValid,
      feedbackEs: aPinsValid ? 'Operando A conectado y polarizado.' : 'Líneas de A incompletas o flotantes.',
    },
    {
      label: '4 líneas de entrada de B (B3..B0) cableadas a pines 16, 4, 7 y 11',
      passed: bPinsValid,
      feedbackEs: bPinsValid ? 'Operando B conectado y polarizado.' : 'Líneas de B incompletas o flotantes.',
    },
    {
      label: `Al menos 8 resistencias pull-down de 330 Ω conectadas a GND (${r330Count}/8)`,
      passed: r330Count >= 8,
      feedbackEs: r330Count >= 8
        ? `${r330Count} resistencias de 330 Ω instaladas.`
        : `Tienes ${r330Count} de 8 resistencias pull-down mínimas instaladas.`,
    },
    {
      label: 'Ninguna de las 8 entradas presenta flotación ni contención',
      passed: aPinsValid && bPinsValid,
      feedbackEs: aPinsValid && bPinsValid
        ? 'Niveles lógicos definidos en todas las entradas.'
        : 'Hay entradas en estado flotante (revisa conexión a interruptor y resistencia pull-down).',
    },
  ];

  const passed = hasDipA && hasDipB && aPinsValid && bPinsValid && r330Count >= 8;

  return {
    stageId: stage.id,
    passed,
    severity: passed ? 'SUCCESS' : !hasDipA || !hasDipB ? 'INFO' : 'WARNING',
    statusMessageEs: passed
      ? '¡Las 8 entradas de operandos A y B están perfectamente cableadas y polarizadas!'
      : 'Conecta los interruptores de A y B a los pines del 74LS83A con resistencias pull-down de 330 Ω.',
    technicalDetailsEs:
      'Pines de entrada: A3=Pin 1, A2=Pin 3, A1=Pin 8, A0=Pin 10; B3=Pin 16, B2=Pin 4, B1=Pin 7, B0=Pin 11.',
    checklistResults,
    criticalErrorDetected: false,
    canProceed: passed,
  };
}

export function validateStage5CarryIn(
  ctx: GuidedValidationContext,
): StageValidationResult {
  const stage = GUIDED_STAGES[4]!;
  const solution = ctx.solution;

  // Pre-requisito: etapa 4 válida
  const stage4Res = validateStage4InputsAB(ctx);
  if (!stage4Res.passed) {
    return {
      stageId: stage.id,
      passed: false,
      severity: 'ERROR',
      statusMessageEs: 'Primero debes mantener operativas las entradas A y B (Etapa 4).',
      technicalDetailsEs: stage4Res.statusMessageEs,
      checklistResults: [
        { label: 'Entradas A y B de Etapa 4 verificadas', passed: false },
        { label: 'Interruptor DIP-1 de C0 montado', passed: false },
        { label: 'Pin 13 (C0/Cin) cableado con pull-down', passed: false },
        { label: 'Entrada C0 sin flotación', passed: false },
      ],
      criticalErrorDetected: stage4Res.criticalErrorDetected,
      canProceed: false,
    };
  }

  const placedDipIds = new Set(ctx.circuit.dipSwitches.map((s) => s.id));
  const hasDipC0 = placedDipIds.has('dip-sw-c0');

  const c0PinState = solution.pins[13];
  const isC0Floating =
    !c0PinState ||
    c0PinState.drive === 'FLOATING' ||
    c0PinState.drive === 'UNPOWERED' ||
    solution.diagnostics.some(
      (d) => d.code === 'FLOATING_INPUT' && d.relatedPins?.includes(13),
    );

  const r330Total = ctx.circuit.resistors.filter((r) => r.ohms === 330).length;

  const checklistResults: StageChecklistResult[] = [
    {
      label: 'Interruptor DIP-1 (Acarreo C0) colocado',
      passed: hasDipC0,
      feedbackEs: hasDipC0 ? 'DIP-1 colocado.' : 'Coloca el interruptor individual para C0.',
    },
    {
      label: 'Línea de señal cableada hacia el Pin 13 (C0/Cin)',
      passed: !isC0Floating,
      feedbackEs: !isC0Floating ? 'Pin 13 conectado.' : 'Pin 13 sin conexión activa.',
    },
    {
      label: `Resistencia pull-down de 330 Ω hacia GND para C0 (${r330Total}/9)`,
      passed: r330Total >= 9 && !isC0Floating,
      feedbackEs: r330Total >= 9
        ? '9 resistencias pull-down instaladas en total.'
        : `Tienes ${r330Total} de 9 resistencias pull-down recomendadas.`,
    },
    {
      label: 'Entrada C0 en nivel lógico definido (sin flotación)',
      passed: !isC0Floating,
      feedbackEs: !isC0Floating
        ? `Nivel lógico C0 resuelto: ${c0PinState?.logicLevel ?? 0}.`
        : 'C0 está flotando.',
    },
  ];

  const passed = hasDipC0 && !isC0Floating && r330Total >= 9;

  return {
    stageId: stage.id,
    passed,
    severity: passed ? 'SUCCESS' : !hasDipC0 ? 'INFO' : 'WARNING',
    statusMessageEs: passed
      ? '¡Acarreo inicial C0 (Pin 13) conectado y gobernado correctamente!'
      : 'Conecta el interruptor DIP-1 al Pin 13 del 74LS83A con resistencia pull-down de 330 Ω a tierra.',
    technicalDetailsEs:
      'Pin 13 = C0 (Cin). Con C0=0 el total es A+B; con C0=1 el total es A+B+1.',
    checklistResults,
    criticalErrorDetected: false,
    canProceed: passed,
  };
}

export function validateStage6OutputsLeds(
  ctx: GuidedValidationContext,
): StageValidationResult {
  const stage = GUIDED_STAGES[5]!;
  const solution = ctx.solution;

  // Pre-requisito: etapa 5 válida
  const stage5Res = validateStage5CarryIn(ctx);
  if (!stage5Res.passed) {
    return {
      stageId: stage.id,
      passed: false,
      severity: 'ERROR',
      statusMessageEs: 'Primero debes mantener operativas las etapas previas (1 a 5).',
      technicalDetailsEs: stage5Res.statusMessageEs,
      checklistResults: [
        { label: 'Circuito de entrada previo operativo', passed: false },
        { label: '5 LEDs colocados (1 ámbar y 4 verdes)', passed: false },
        { label: '5 resistencias limitadoras de 1 kΩ instaladas', passed: false },
        { label: 'Polaridad y retorno a GND correctos en todos los LEDs', passed: false },
        { label: 'Las 5 salidas S0..S3 y C4 conducidas', passed: false },
      ],
      criticalErrorDetected: stage5Res.criticalErrorDetected,
      canProceed: false,
    };
  }

  const leds = ctx.circuit.leds;
  const amberCount = leds.filter((l) => l.color === 'AMBER').length;
  const greenCount = leds.filter((l) => l.color === 'GREEN').length;
  const r1kCount = ctx.circuit.resistors.filter((r) => r.ohms === 1000).length;

  const hasLedNoResistor = solution.diagnostics.some(
    (d) => d.code === 'LED_WITHOUT_RESISTOR',
  );
  const hasLedReversePolarity = solution.diagnostics.some(
    (d) => d.code === 'LED_REVERSE_POLARITY',
  );
  const hasContention = solution.diagnostics.some(
    (d) => d.code === 'OUTPUT_CONTENTION',
  );
  const undrivenOutputs = solution.diagnostics
    .filter((d) => d.code === 'UNDRIVEN_OUTPUT')
    .map((d) => d.signal);

  const allLedsProperlyWired =
    leds.length === 5 && Object.values(solution.leds).every((l) => l.isProperlyWired);

  const checklistResults: StageChecklistResult[] = [
    {
      label: `5 LEDs colocados: 1 Ámbar (C4) y 4 Verdes (S3..S0) (${amberCount} ámbar, ${greenCount} verdes)`,
      passed: amberCount >= 1 && greenCount >= 4,
      feedbackEs: amberCount >= 1 && greenCount >= 4 ? '5 LEDs colocados.' : 'Faltan LEDs por colocar del kit.',
    },
    {
      label: `5 resistencias limitadoras en serie de 1 kΩ (${r1kCount}/5)`,
      passed: r1kCount >= 5 && !hasLedNoResistor,
      feedbackEs: hasLedNoResistor
        ? '¡ERROR! Hay un LED conectado directo a salida sin resistencia de 1 kΩ.'
        : r1kCount >= 5
          ? '5 resistencias de 1 kΩ instaladas.'
          : `Faltan resistencias limitadoras (${r1kCount}/5).`,
    },
    {
      label: 'Polaridad correcta en los 5 LEDs (sin inversión de ánodo/cátodo)',
      passed: !hasLedReversePolarity,
      feedbackEs: hasLedReversePolarity
        ? 'Uno o más LEDs tienen la polaridad invertida (cátodo hacia señal).'
        : 'Polaridad de diodos correcta.',
    },
    {
      label: 'Retorno de los 5 cátodos hacia el riel GND (−)',
      passed: allLedsProperlyWired && !hasLedReversePolarity,
      feedbackEs: allLedsProperlyWired
        ? 'Cátodos conectados a tierra.'
        : 'Verifica los retornos de cátodo hacia el riel negativo.',
    },
    {
      label: 'Salidas del 74LS83A (S0, S1, S2, S3, C4) conducidas sin contención',
      passed: undrivenOutputs.length === 0 && !hasContention,
      feedbackEs: undrivenOutputs.length > 0
        ? `Salidas pendientes de cablear: ${undrivenOutputs.join(', ')}.`
        : hasContention
          ? '¡Contención detectada en salidas!'
          : 'Todas las 5 salidas conducen a sus indicadores.',
    },
  ];

  const passed =
    amberCount >= 1 &&
    greenCount >= 4 &&
    r1kCount >= 5 &&
    !hasLedNoResistor &&
    !hasLedReversePolarity &&
    !hasContention &&
    undrivenOutputs.length === 0 &&
    allLedsProperlyWired;

  return {
    stageId: stage.id,
    passed,
    severity: hasLedNoResistor || hasContention
      ? 'ERROR'
      : passed
        ? 'SUCCESS'
        : hasLedReversePolarity
          ? 'WARNING'
          : 'INFO',
    statusMessageEs: hasLedNoResistor
      ? '¡Peligro! Hay un LED conectado sin resistencia limitadora de 1 kΩ.'
      : hasLedReversePolarity
        ? 'Corrige la polaridad de los LEDs invertidos (ánodo a la señal, cátodo a GND).'
        : passed
          ? '¡Etapas indicadoras completas! Los 5 LEDs responden a las salidas del sumador.'
          : 'Cablea las salidas S0..S3 y C4 a través de resistencias de 1 kΩ hacia los LEDs.',
    technicalDetailsEs:
      'Salidas TTL: S0=Pin 9, S1=Pin 6, S2=Pin 2, S3=Pin 15, C4=Pin 14. Corriente IOH limitada por 1 kΩ.',
    checklistResults,
    criticalErrorDetected: hasLedNoResistor || hasContention,
    canProceed: passed,
  };
}

export function validateStage7CircuitReview(
  ctx: GuidedValidationContext,
): StageValidationResult {
  const stage = GUIDED_STAGES[6]!;
  const solution = ctx.solution;

  // Pre-requisito: todas las etapas 2..6 deben pasar
  const stage6Res = validateStage6OutputsLeds(ctx);
  if (!stage6Res.passed) {
    return {
      stageId: stage.id,
      passed: false,
      severity: 'ERROR',
      statusMessageEs: 'Completa primero las conexiones de las etapas anteriores.',
      technicalDetailsEs: stage6Res.statusMessageEs,
      checklistResults: [
        { label: 'Alimentación, entradas y salidas de etapas 2–6', passed: false },
        { label: 'Ausencia de errores críticos o cables desconectados', passed: false },
        { label: 'Equivalencia topológica de netlist confirmada', passed: false },
      ],
      criticalErrorDetected: stage6Res.criticalErrorDetected,
      canProceed: false,
    };
  }

  const hasErrors = solution.diagnostics.some((d) => d.severity === 'ERROR');
  const hasDisconnectedWires = solution.diagnostics.some(
    (d) => d.code === 'DISCONNECTED_WIRE',
  );

  const neutralSwitches: Record<string, boolean> = { [POWER_SUPPLY_5V.id]: true };
  const refInput = createCanonicalCircuitInput(neutralSwitches);
  const workInput = workingCircuitToSolverInput(ctx.circuit, neutralSwitches);
  const isEquivalent = areComponentNetlistsEquivalent(refInput, workInput);

  const checklistResults: StageChecklistResult[] = [
    {
      label: 'Alimentación, entradas y salidas resueltas sin fallos',
      passed: !hasErrors && solution.isChipPowered && solution.areAllInputsValid,
      feedbackEs: !hasErrors
        ? 'Todas las redes operativas sin fallos.'
        : 'Aún se detectan fallos eléctricos en el circuito.',
    },
    {
      label: 'Sin cables jumpers desconectados ni extremos al aire',
      passed: !hasDisconnectedWires,
      feedbackEs: !hasDisconnectedWires
        ? 'Todos los cables conectan terminales útiles.'
        : 'Hay cables con un extremo abierto en una pista vacía.',
    },
    {
      label: 'Equivalencia eléctrica integral demostrada frente al circuito canónico',
      passed: isEquivalent,
      feedbackEs: isEquivalent
        ? '¡Equivalencia de netlist confirmada al 100%!'
        : 'La netlist aún no coincide funcionalmente con la referencia canónica.',
    },
  ];

  const passed = !hasErrors && !hasDisconnectedWires && isEquivalent;

  return {
    stageId: stage.id,
    passed,
    severity: passed ? 'SUCCESS' : 'WARNING',
    statusMessageEs: passed
      ? '¡Circuito 74LS83A totalmente verificado y equivalente a la referencia!'
      : 'Revisa las advertencias en la lista de comprobación antes de realizar las pruebas aritméticas.',
    technicalDetailsEs:
      'La firma topológica demuestra que todas las redes funcionales del sumador 74LS83A están correctamente enlazadas.',
    checklistResults,
    criticalErrorDetected: hasErrors,
    canProceed: passed,
  };
}

export function validateStage8FunctionalTesting(
  ctx: GuidedValidationContext,
): StageValidationResult {
  const stage = GUIDED_STAGES[7]!;

  // Pre-requisito: etapa 7 válida
  const stage7Res = validateStage7CircuitReview(ctx);
  if (!stage7Res.passed) {
    return {
      stageId: stage.id,
      passed: false,
      severity: 'ERROR',
      statusMessageEs: 'El circuito debe estar completamente verificado en la etapa 7 antes de probarlo.',
      technicalDetailsEs: stage7Res.statusMessageEs,
      checklistResults: STAGE_8_MATH_TEST_CASES.map((tc) => ({
        label: tc.label,
        passed: false,
        feedbackEs: 'Requiere circuito verificado.',
      })),
      criticalErrorDetected: stage7Res.criticalErrorDetected,
      canProceed: false,
    };
  }

  const testedSet = new Set(ctx.stage8TestedCases);

  const checklistResults: StageChecklistResult[] = STAGE_8_MATH_TEST_CASES.map(
    (tc) => {
      const isTested = testedSet.has(tc.id);
      return {
        label: tc.label,
        passed: isTested,
        feedbackEs: isTested
          ? `Verificado con éxito: Total = ${tc.expectedTotal} (Cout=${tc.expectedCarryOut}, Suma=${tc.expectedSum}).`
          : `Pendiente: ${tc.hintEs}`,
      };
    },
  );

  const passed = STAGE_8_MATH_TEST_CASES.every((tc) => testedSet.has(tc.id));

  return {
    stageId: stage.id,
    passed,
    severity: passed ? 'SUCCESS' : 'INFO',
    statusMessageEs: passed
      ? '¡Las 4 pruebas de suma binaria han sido ejecutadas y validadas con éxito!'
      : `Has probado ${testedSet.size} de 4 casos aritméticos. Configura las operaciones restantes.`,
    technicalDetailsEs:
      'Las salidas S3..S0 y el acarreo C4 han respondido exactamente a la lógica del sumador de 4 bits en cada combinación.',
    checklistResults,
    criticalErrorDetected: false,
    canProceed: passed,
  };
}

export function validateStage9Evaluation(
  ctx: GuidedValidationContext,
): StageValidationResult {
  const stage = GUIDED_STAGES[8]!;
  const answers = ctx.stage9QuizAnswers;

  let allAnswered = true;
  let allCorrect = true;
  const checklistResults: StageChecklistResult[] = [];

  for (let i = 0; i < STAGE_9_EVALUATION_QUESTIONS.length; i += 1) {
    const q = STAGE_9_EVALUATION_QUESTIONS[i]!;
    const chosen = answers[q.id];

    if (chosen === undefined) {
      allAnswered = false;
      checklistResults.push({
        label: `Pregunta ${i + 1}: ${q.questionEs.slice(0, 48)}...`,
        passed: false,
        feedbackEs: 'Sin responder.',
      });
    } else if (chosen === q.correctOptionIndex) {
      checklistResults.push({
        label: `Pregunta ${i + 1}: Correcta`,
        passed: true,
        feedbackEs: q.explanationEs,
      });
    } else {
      allCorrect = false;
      checklistResults.push({
        label: `Pregunta ${i + 1}: Incorrecta`,
        passed: false,
        feedbackEs: `Respuesta incorrecta. ${q.explanationEs}`,
      });
    }
  }

  const passed = allAnswered && allCorrect;

  return {
    stageId: stage.id,
    passed,
    severity: passed ? 'SUCCESS' : allAnswered ? 'ERROR' : 'INFO',
    statusMessageEs: passed
      ? '¡Evaluación superada con 100%! Has dominado la construcción y funcionamiento del 74LS83A.'
      : allAnswered
        ? 'Revisa tus respuestas: algunos conceptos sobre el 74LS83A o la polarización no fueron correctos.'
        : 'Responde las 5 preguntas conceptuales para concluir el curso de montaje guiado.',
    technicalDetailsEs:
      'Al completar la evaluación se desbloquea la Práctica Libre con tu circuito construido.',
    checklistResults,
    criticalErrorDetected: false,
    canProceed: passed,
  };
}

// ============================================================================
// Evaluador Maestro de todas las Etapas y Detección de Invalidación
// ============================================================================

export function validateStageByIndex(
  stageIndex: number,
  ctx: GuidedValidationContext,
): StageValidationResult {
  switch (stageIndex) {
    case 0:
      return validateStage1Breadboard(ctx);
    case 1:
      return validateStage2Chip(ctx);
    case 2:
      return validateStage3Power(ctx);
    case 3:
      return validateStage4InputsAB(ctx);
    case 4:
      return validateStage5CarryIn(ctx);
    case 5:
      return validateStage6OutputsLeds(ctx);
    case 6:
      return validateStage7CircuitReview(ctx);
    case 7:
      return validateStage8FunctionalTesting(ctx);
    case 8:
      return validateStage9Evaluation(ctx);
    default:
      return validateStage1Breadboard(ctx);
  }
}

/**
 * Calcula el estado de cada una de las 9 etapas ('locked' | 'current' | 'in_progress' | 'completed' | 'invalidated'),
 * detectando si una etapa previamente aprobada quedó invalidada por cambios posteriores del usuario.
 */
export function calculateGuidedProgressSummary(
  currentStageIndex: number,
  ctx: GuidedValidationContext,
): GuidedProgressSummary {
  const stageStatuses: Record<GuidedStageId, GuidedStageStatus> = {} as any;
  let completedCount = 0;
  let invalidationWarningEs: string | null = null;

  // Evaluar en orden secuencial cada etapa
  for (let idx = 0; idx < GUIDED_STAGES.length; idx += 1) {
    const stage = GUIDED_STAGES[idx]!;
    const validation = validateStageByIndex(idx, ctx);
    const wasCompletedInHistory = Boolean(ctx.completedStagesHistory[idx]);

    if (validation.passed) {
      stageStatuses[stage.id] = 'completed';
      completedCount += 1;
    } else if (wasCompletedInHistory && !validation.passed) {
      // Se había completado pero ahora falla -> INVALIDADA
      stageStatuses[stage.id] = 'invalidated';
      if (!invalidationWarningEs) {
        invalidationWarningEs = `Atención: la etapa ${stage.stepNumber} (${stage.shortTitle}) ha quedado invalidada porque se retiraron o desconectaron elementos esenciales.`;
      }
    } else if (idx === currentStageIndex) {
      stageStatuses[stage.id] = 'current';
    } else if (idx < currentStageIndex) {
      stageStatuses[stage.id] = 'in_progress';
    } else {
      // Etapa futura: bloqueada salvo que la anterior esté completada
      const prevStage = GUIDED_STAGES[idx - 1];
      const prevPassed = prevStage ? stageStatuses[prevStage.id] === 'completed' : true;
      stageStatuses[stage.id] = prevPassed ? 'in_progress' : 'locked';
    }
  }

  const currentStageDef = GUIDED_STAGES[currentStageIndex]!;
  const isTutorialFinished = completedCount === GUIDED_STAGES.length;
  const overallProgressPercent = Math.round((completedCount / GUIDED_STAGES.length) * 100);

  return {
    stageStatuses,
    currentStageId: currentStageDef.id,
    completedCount,
    totalStages: GUIDED_STAGES.length,
    overallProgressPercent,
    isTutorialFinished,
    invalidationWarningEs,
  };
}
