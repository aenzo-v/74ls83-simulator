import type { CameraPreset } from '../store/useLabStore';
import type { PinNumber, SignalCode } from './types';

/**
 * FASE 6 — Sistema de Montaje Guiado Educativo del 74LS83A.
 *
 * Modelo declarativo de etapas pedagógicas, pistas progresivas en 3 niveles,
 * objetivos, actividades interactivas y criterios de validación.
 */

export type GuidedStageId =
  | 'stage-1-breadboard'
  | 'stage-2-chip'
  | 'stage-3-power'
  | 'stage-4-inputs-ab'
  | 'stage-5-carry-in'
  | 'stage-6-outputs-leds'
  | 'stage-7-circuit-review'
  | 'stage-8-functional-testing'
  | 'stage-9-evaluation';

export type GuidedStageStatus =
  | 'locked'
  | 'current'
  | 'in_progress'
  | 'completed'
  | 'invalidated';

export interface Stage1HolePairQuiz {
  readonly id: string;
  readonly holeA: string;
  readonly holeB: string;
  readonly labelA: string;
  readonly labelB: string;
  readonly expectedConnected: boolean;
  readonly explanationEs: string;
}

export interface Stage8MathTestCase {
  readonly id: string;
  readonly label: string;
  readonly operandA: number;
  readonly operandB: number;
  readonly carryIn: 0 | 1;
  readonly expectedTotal: number;
  readonly expectedCarryOut: 0 | 1;
  readonly expectedSum: number;
  readonly hintEs: string;
}

export interface Stage9EvaluationQuestion {
  readonly id: string;
  readonly questionEs: string;
  readonly optionsEs: readonly string[];
  readonly correctOptionIndex: number;
  readonly explanationEs: string;
}

export interface VisualHighlightHint {
  readonly cameraPreset?: CameraPreset;
  readonly targetHoles?: readonly string[];
  readonly targetPins?: readonly PinNumber[];
  readonly targetComponents?: readonly string[];
  readonly candidateColumns?: readonly number[];
}

export interface GuidedStageDefinition {
  readonly id: GuidedStageId;
  readonly stepNumber: number; // 1 to 9
  readonly title: string;
  readonly shortTitle: string;
  readonly subtitle: string;
  readonly objective: string;
  readonly explanationEs: string;
  readonly technicalDetailEs: string;
  readonly componentsInvolved: readonly string[];
  readonly signalsInvolved: readonly SignalCode[];
  readonly checklist: readonly string[];
  readonly hints: {
    readonly level1Orientation: string;
    readonly level2Identification: string;
    readonly level3Visual: string;
    readonly visualHighlights?: VisualHighlightHint;
  };
  readonly errorRemediations: readonly {
    readonly condition: string;
    readonly adviceEs: string;
  }[];
  readonly stage1QuizPairs?: readonly Stage1HolePairQuiz[];
  readonly stage8TestCases?: readonly Stage8MathTestCase[];
  readonly stage9QuizQuestions?: readonly Stage9EvaluationQuestion[];
}

export const STAGE_1_QUIZ_PAIRS: readonly Stage1HolePairQuiz[] = [
  {
    id: 'pair-f10-g10',
    holeA: 'f10',
    holeB: 'g10',
    labelA: 'f10',
    labelB: 'g10',
    expectedConnected: true,
    explanationEs:
      'f10 y g10 están en la misma columna (10) y semibloque inferior (filas f–j), por lo que comparten la misma tira metálica interna de 5 contactos.',
  },
  {
    id: 'pair-e10-f10',
    holeA: 'e10',
    holeB: 'f10',
    labelA: 'e10',
    labelB: 'f10',
    expectedConnected: false,
    explanationEs:
      'e10 (bloque superior) y f10 (bloque inferior) están separados por el canal central DIP de 7.62 mm; no hay continuidad eléctrica entre ellos.',
  },
  {
    id: 'pair-rail-top-plus',
    holeA: 'rail-top-plus-1',
    holeB: 'rail-top-plus-10',
    labelA: 'Riel Top + (P1)',
    labelB: 'Riel Top + (P10)',
    expectedConnected: true,
    explanationEs:
      'Pertenecen al mismo bus de alimentación positivo (+) superior, que distribuye tensión a lo largo de toda la protoboard.',
  },
  {
    id: 'pair-a5-a6',
    holeA: 'a5',
    holeB: 'a6',
    labelA: 'a5',
    labelB: 'a6',
    expectedConnected: false,
    explanationEs:
      'Aunque son alvéolos adyacentes en la fila "a", pertenecen a columnas diferentes (columna 5 y columna 6). Las pistas son verticales y están aisladas entre sí.',
  },
];

export const STAGE_8_MATH_TEST_CASES: readonly Stage8MathTestCase[] = [
  {
    id: 'test-0-0-0',
    label: '0 + 0 + 0 = 0',
    operandA: 0,
    operandB: 0,
    carryIn: 0,
    expectedTotal: 0,
    expectedCarryOut: 0,
    expectedSum: 0,
    hintEs: 'Deja todos los interruptores en posición OFF (0 lógico). Todos los LEDs de salida deben estar apagados.',
  },
  {
    id: 'test-7-1-0',
    label: '7 + 1 + 0 = 8',
    operandA: 7, // A2=1, A1=1, A0=1
    operandB: 1, // B0=1
    carryIn: 0,
    expectedTotal: 8,
    expectedCarryOut: 0,
    expectedSum: 8, // S3=1
    hintEs: 'Activa A0, A1, A2 (A=7) y B0 (B=1). El acarreo interno se propaga hasta activar el bit S3 (LED S3 encendido).',
  },
  {
    id: 'test-15-1-0',
    label: '15 + 1 + 0 = 16',
    operandA: 15, // A3..A0 = 1
    operandB: 1,  // B0 = 1
    carryIn: 0,
    expectedTotal: 16,
    expectedCarryOut: 1, // C4=1
    expectedSum: 0,      // S3..S0=0
    hintEs: 'Activa todos los bits de A (15) y el bit B0 (1). Se produce desbordamiento de 4 bits: solo el LED ámbar C4 debe encender.',
  },
  {
    id: 'test-15-15-1',
    label: '15 + 15 + 1 = 31',
    operandA: 15,
    operandB: 15,
    carryIn: 1,
    expectedTotal: 31,
    expectedCarryOut: 1,
    expectedSum: 15,
    hintEs: 'Activa todos los interruptores: A3..A0, B3..B0 y C0. Todos los 5 LEDs (C4 y S3..S0) deben encender (31 = 11111₂).',
  },
];

export const STAGE_9_EVALUATION_QUESTIONS: readonly Stage9EvaluationQuestion[] = [
  {
    id: 'q1-power-pins',
    questionEs: '¿En qué pines se conecta la alimentación del circuito integrado 74LS83A?',
    optionsEs: [
      'Pin 16 a VCC (+5 V) y Pin 8 a GND (como en circuitos estándar)',
      'Pin 5 a VCC (+5 V) y Pin 12 a GND (patillaje específico del 74LS83)',
      'Pin 1 a VCC (+5 V) y Pin 16 a GND',
      'Pin 14 a VCC (+5 V) y Pin 7 a GND',
    ],
    correctOptionIndex: 1,
    explanationEs:
      'El SN74LS83A posee un pinout diagonal singular: VCC (+5 V) en Pin 5 y GND en Pin 12. No debe confundirse con circuitos comunes DIP-16 ni con el 74LS283.',
  },
  {
    id: 'q2-pull-down',
    questionEs: '¿Por qué se requieren resistencias pull-down (p. ej. 330 Ω) en las entradas gobernadas por interruptores?',
    optionsEs: [
      'Para limitar el brillo de los LEDs de salida',
      'Para evitar que las entradas queden flotantes en estado indeterminado cuando el interruptor esté en OFF',
      'Para amplificar la tensión de 5 V hacia los transistores internos',
      'Porque el circuito sumador requiere sincronización por reloj',
    ],
    correctOptionIndex: 1,
    explanationEs:
      'En la familia LS-TTL, una entrada al aire (flotante) drena corriente IIL y puede interpretarse falsamente como nivel ALTO. La resistencia pull-down asegura un nivel BAJO (< 0.8 V) estable al abrir el circuito.',
  },
  {
    id: 'q3-carries',
    questionEs: '¿Qué función cumplen los acarreos C0 y C4 en el sumador binario?',
    optionsEs: [
      'C0 es la señal de reloj y C4 es la habilitación chip select',
      'C0 es el acarreo de entrada (Cin) y C4 es el acarreo de salida final (Cout)',
      'C0 es la alimentación negativa y C4 la positiva',
      'C0 y C4 son bits de paridad para detección de errores',
    ],
    correctOptionIndex: 1,
    explanationEs:
      'C0 (Cin) permite encadenar sumadores de menor peso, y C4 (Cout) indica el desbordamiento del cuarto bit (peso 16), permitiendo formar sumas de 5 bits en total.',
  },
  {
    id: 'q4-led-resistors',
    questionEs: 'Si un LED indicador se conecta directamente entre una salida TTL y GND sin resistencia en serie:',
    optionsEs: [
      'Funciona perfectamente sin inconveniente',
      'El LED brillará con luz intermitente',
      'Se excederá la corriente máxima admisible, arriesgando daño al LED y a la etapa de salida del integrado',
      'La suma se calcula con el doble de velocidad',
    ],
    correctOptionIndex: 2,
    explanationEs:
      'Los diodos LED tienen baja impedancia en directa. Sin una resistencia limitadora (p. ej. 1 kΩ), la corriente demandada excede los límites térmicos y de saturación de la compuerta TTL.',
  },
  {
    id: 'q5-binary-sum',
    questionEs: 'Si fijamos A = 1010₂ (10 decimal), B = 0101₂ (5 decimal) y C0 = 1, ¿cuál es el resultado esperado?',
    optionsEs: [
      'Suma = 1111₂ (15), Cout = 0 (Total = 15)',
      'Suma = 0000₂ (0), Cout = 1 (Total = 16)',
      'Suma = 1010₂ (10), Cout = 1 (Total = 26)',
      'Suma = 0001₂ (1), Cout = 0 (Total = 1)',
    ],
    correctOptionIndex: 1,
    explanationEs:
      '10 + 5 + 1 = 16 = 10000₂. Los 4 bits de suma (S3..S0) valen 0000₂, y el acarreo de salida C4 vale 1.',
  },
];

export const GUIDED_STAGES: readonly GuidedStageDefinition[] = [
  {
    id: 'stage-1-breadboard',
    stepNumber: 1,
    title: 'Reconocimiento de la Protoboard',
    shortTitle: '1. Protoboard',
    subtitle: 'Comprender la continuidad interna y la topología MB-102',
    objective:
      'Aprender a diferenciar entre proximidad física y continuidad eléctrica real en los alvéolos de la protoboard de 830 puntos.',
    explanationEs:
      'Una protoboard no conecta todos sus agujeros entre sí. En su interior existen tiras metálicas conductoras organizadas de forma precisa:\n\n' +
      '• Rieles laterales (+ y −): conducen horizontalmente a lo largo de 50 puntos para distribuir alimentación.\n' +
      '• Pistas de terminales: columnas verticales independientes de 5 contactos (filas a–e en la parte superior, y f–j en la inferior).\n' +
      '• Canal central DIP (0.3" / 7.62 mm): ranura de aislamiento eléctrico diseñada para colocar circuitos integrados sin cortocircuitar sus patas opuestas.',
    technicalDetailEs:
      'Dos alvéolos en la misma columna y en el mismo semibloque (p. ej. f10 y g10) tienen continuidad perfecta (0 Ω). Sin embargo, dos alvéolos contiguos en la misma fila (p. ej. a5 y a6) están completamente aislados.',
    componentsInvolved: [],
    signalsInvolved: [],
    checklist: [
      'Inspeccionar los rieles de alimentación superior e inferior (+ y −)',
      'Observar la orientación vertical de las pistas de 5 contactos (a–e y f–j)',
      'Identificar la ranura central aislante de 7.62 mm',
      'Responder correctamente el ejercicio interactivo de 4 pares de alvéolos',
    ],
    hints: {
      level1Orientation:
        'Observa que la protoboard tiene dos bloques separados por una zanja central y rieles en los bordes.',
      level2Identification:
        'Cada columna de 5 letras (a–e ó f–j) es una única pista eléctrica. Los rieles recorren todo el largo.',
      level3Visual:
        'Examina los pares de alvéolos destacados en la actividad para determinar si comparten tira metálica.',
      visualHighlights: {
        cameraPreset: 'top',
        targetHoles: ['f10', 'g10', 'e10', 'rail-top-plus-1', 'rail-top-plus-10', 'a5', 'a6'],
      },
    },
    errorRemediations: [
      {
        condition: 'Respuesta incorrecta en el cuestionario de pistas',
        adviceEs:
          'Recuerda: las pistas de terminales son verticales de 5 pines (a–e y f–j). Las filas horizontales no tienen unión interna, excepto los rieles exteriores.',
      },
    ],
    stage1QuizPairs: STAGE_1_QUIZ_PAIRS,
  },
  {
    id: 'stage-2-chip',
    stepNumber: 2,
    title: 'Colocación del Integrado 74LS83A',
    shortTitle: '2. Colocar 74LS83A',
    subtitle: 'Inserción del DIP-16 atravesando la ranura central',
    objective:
      'Montar el sumador SN74LS83A sobre el canal central con la orientación correcta de la muesca hacia la izquierda (Pin 1 en fila f).',
    explanationEs:
      'El circuito integrado SN74LS83A viene en encapsulado DIP-16 (Dual In-line Package de 16 pines).\n\n' +
      'Para que cada pin tenga acceso a una pista independiente de 5 nodos sin cortocircuitarse con la pata opuesta, el integrado debe montarse a horcajadas sobre el canal central:\n' +
      '• Pines 1 a 8 en la fila f (semibloque inferior).\n' +
      '• Pines 9 a 16 en la fila e (semibloque superior).\n' +
      '• Muesca o punto del Pin 1 apuntando hacia la izquierda.',
    technicalDetailEs:
      'Colocar el chip atravesando la ranura (filas e y f) en la columna recomendada 28 ubica el Pin 1 en f28 y el Pin 16 en e28. De esta forma, las pistas a–d y g–j quedan libres para conectar cables y componentes.',
    componentsInvolved: ['ic-74ls83a'],
    signalsInvolved: ['VCC', 'GND', 'A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'C0', 'S0', 'S1', 'S2', 'S3', 'C4'],
    checklist: [
      'Seleccionar la herramienta «Colocar» en la barra superior',
      'Elegir el «74LS83A (DIP-16)» de la bandeja del kit',
      'Hacer clic sobre la ranura central de la protoboard (filas e y f)',
      'Verificar que los 16 pines queden alineados sin colisionar con otros elementos',
    ],
    hints: {
      level1Orientation:
        'Activa la herramienta «Colocar», selecciona el chip 74LS83A y haz clic en el centro de la protoboard.',
      level2Identification:
        'El integrado ocupa 8 columnas. La columna canónica sugerida es la 28 (pines en columnas 28 a 35).',
      level3Visual:
        'Alinea el fantasma 3D cian sobre la zanja central en las columnas 28–35 y haz clic.',
      visualHighlights: {
        cameraPreset: 'chip-closeup',
        candidateColumns: [28],
        targetHoles: ['f28', 'f29', 'f30', 'f31', 'f32', 'f33', 'f34', 'f35', 'e35', 'e34', 'e33', 'e32', 'e31', 'e30', 'e29', 'e28'],
      },
    },
    errorRemediations: [
      {
        condition: 'IC_MISSING',
        adviceEs: 'Coloca el integrado 74LS83A desde la herramienta «Colocar» sobre el canal central.',
      },
      {
        condition: 'INVALID_TRENCH_ALIGNMENT',
        adviceEs: 'El chip debe montarse atravesando la ranura central (filas e y f), nunca en un solo bloque.',
      },
      {
        condition: 'HOLE_OCCUPIED',
        adviceEs: 'Retira cualquier cable o componente que ocupe las perforaciones donde insertan los 16 pines.',
      },
    ],
  },
  {
    id: 'stage-3-power',
    stepNumber: 3,
    title: 'Alimentación VCC y GND',
    shortTitle: '3. Alimentación',
    subtitle: 'Conectar +5.0 V y tierra según el pinout real del 74LS83A',
    objective:
      'Conectar la fuente de +5 V a los rieles, alimentar el Pin 5 (VCC) y Pin 12 (GND) del 74LS83A, y encender la fuente.',
    explanationEs:
      '¡Atención crítica de patillaje! A diferencia de muchos circuitos integrados DIP-16 donde la alimentación va en las esquinas (Pin 16 VCC y Pin 8 GND):\n\n' +
      '• Pin 5 = VCC (+5.0 V)\n' +
      '• Pin 12 = GND (0 V / Masa)\n\n' +
      'Si el integrado se conecta con pines invertidos o en esquinas equivocadas, en la realidad se dañaría de forma permanente. En el simulador, el motor detecta el fallo y bloquea la operación para proteger el modelo.',
    technicalDetailEs:
      'Pasos eléctricos obligatorios:\n' +
      '1. Cablear desde el borne positivo (+5 V) de la fuente al riel superior (+).\n' +
      '2. Cablear desde el borne GND de la fuente al riel superior (−).\n' +
      '3. Puentear rieles superior e inferior si se van a usar ambos.\n' +
      '4. Conectar un cable desde un riel (+) a la pista del Pin 5 (p. ej. j32).\n' +
      '5. Conectar un cable desde un riel (−) a la pista del Pin 12 (p. ej. a32).\n' +
      '6. Encender la fuente regulada de +5.0 V (botón en interfaz o panel de fuente).',
    componentsInvolved: ['psu-5v'],
    signalsInvolved: ['VCC', 'GND'],
    checklist: [
      'Conectar borne +5 V de la fuente al riel positivo (+)',
      'Conectar borne GND de la fuente al riel negativo (−)',
      'Conectar el Pin 5 del 74LS83A a un riel de +5 V (VCC)',
      'Conectar el Pin 12 del 74LS83A a un riel de GND (0 V)',
      'Verificar ausencia de cortocircuitos entre +5 V y GND',
      'Encender la fuente de alimentación (+5.0 V activa)',
    ],
    hints: {
      level1Orientation:
        'Conecta cables jumper entre la fuente y los rieles, y de los rieles a los pines de alimentación del chip.',
      level2Identification:
        'Recuerda: Pin 5 = VCC (+5 V) en fila f. Pin 12 = GND (0 V) en fila e. Usa cables rojos y azules.',
      level3Visual:
        'Conecta psu-5v:plus → riel +, psu-5v:gnd → riel −, riel + → Pin 5 (f32) y riel − → Pin 12 (e32).',
      visualHighlights: {
        cameraPreset: 'chip-closeup',
        targetPins: [5, 12],
        targetHoles: ['psu-5v:plus', 'psu-5v:gnd', 'rail-top-plus-1', 'rail-top-minus-6', 'j32', 'a32'],
      },
    },
    errorRemediations: [
      {
        condition: 'SHORT_CIRCUIT_SUPPLY',
        adviceEs: '¡Peligro! Hay un cable uniendo directamente el riel positivo y el negativo. Retira el cortocircuito.',
      },
      {
        condition: 'IC_VCC_DISCONNECTED',
        adviceEs: 'Falta conectar el Pin 5 del 74LS83A al riel positivo de +5 V.',
      },
      {
        condition: 'IC_GND_DISCONNECTED',
        adviceEs: 'Falta conectar el Pin 12 del 74LS83A al riel negativo GND (0 V).',
      },
      {
        condition: 'POWER_SUPPLY_OFF',
        adviceEs: 'La fuente está apagada. Haz clic en el interruptor de la fuente para encenderla a +5.0 V.',
      },
    ],
  },
  {
    id: 'stage-4-inputs-ab',
    stepNumber: 4,
    title: 'Conexión de Entradas A y B con Resistencias Pull-Down',
    shortTitle: '4. Entradas A y B',
    subtitle: '8 bits de operandos, interruptores DIP y polarización a tierra',
    objective:
      'Montar los selectores DIP para los sumandos A (A0–A3) y B (B0–B3), cablear sus 8 líneas hacia el 74LS83A e instalar resistencias pull-down de 330 Ω hacia GND.',
    explanationEs:
      'Para ingresar números binarios de 4 bits necesitamos dos interruptores cuádruples DIP-4 (uno para A y otro para B):\n\n' +
      '• Entradas A: A3 (Pin 1), A2 (Pin 3), A1 (Pin 8), A0 (Pin 10).\n' +
      '• Entradas B: B3 (Pin 16), B2 (Pin 4), B1 (Pin 7), B0 (Pin 11).\n\n' +
      'Cada interruptor conecta +5 V cuando se cierra (ON = 1 lógico). Para garantizar que al abrirlo (OFF) la entrada baje a 0 lógico sin quedar flotante, es IMPRESCINDIBLE conectar una resistencia pull-down de 330 Ω hacia GND en cada una de las 8 líneas.',
    technicalDetailEs:
      'La familia LS-TTL presenta corriente de entrada IIL de hasta −0.4 mA en nivel bajo. Una resistencia pull-down de 330 Ω mantiene el voltaje de entrada en VIL = 330 Ω × 0.4 mA ≈ 0.13 V, muy por debajo del umbral máximo de nivel bajo de 0.8 V. Sin pull-down, el pin flota y lee un 1 impredecible.',
    componentsInvolved: ['dip-sw-a', 'dip-sw-b', 'resistor-330'],
    signalsInvolved: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3'],
    checklist: [
      'Colocar interruptor DIP-4 (Operando A) e interruptor DIP-4 (Operando B) sobre el canal central',
      'Alimentar las entradas superiores de los interruptores con +5 V desde el riel',
      'Conectar las 4 salidas de A hacia los pines 10 (A0), 8 (A1), 3 (A2) y 1 (A3)',
      'Conectar las 4 salidas de B hacia los pines 11 (B0), 7 (B1), 4 (B2) y 16 (B3)',
      'Instalar 8 resistencias de 330 Ω entre cada salida de interruptor y el riel GND (−)',
      'Comprobar que ninguna de las 8 entradas quede flotante',
    ],
    hints: {
      level1Orientation:
        'Coloca los interruptores DIP de A y B, aliméntalos con +5 V, conéctalos a los pines correspondientes del chip y coloca resistencias de 330 Ω a tierra.',
      level2Identification:
        'Pines de A: Pin 1 (A3), Pin 3 (A2), Pin 8 (A1), Pin 10 (A0). Pines de B: Pin 16 (B3), Pin 4 (B2), Pin 7 (B1), Pin 11 (B0). Cada uno lleva resistencia de 330 Ω.',
      level3Visual:
        'Usa la paleta cian para cables de A y violeta para B. Enchufa resistencias de 330 Ω desde la fila j de cada interruptor hacia el riel GND inferior.',
      visualHighlights: {
        cameraPreset: 'three-quarter',
        targetPins: [1, 3, 8, 10, 16, 4, 7, 11],
        targetComponents: ['dip-sw-a', 'dip-sw-b'],
      },
    },
    errorRemediations: [
      {
        condition: 'FLOATING_INPUT',
        adviceEs: 'Una o más entradas de A o B están flotando. Verifica que tengan su cable conectado y su resistencia pull-down de 330 Ω a GND.',
      },
      {
        condition: 'WRONG_PIN_CONNECTION',
        adviceEs: 'Hay un pin de entrada conectado a una señal equivocada o a una salida. Revisa el diagrama de pines del 74LS83A.',
      },
    ],
  },
  {
    id: 'stage-5-carry-in',
    stepNumber: 5,
    title: 'Acarreo de Entrada C0 (Cin)',
    shortTitle: '5. Acarreo C0',
    subtitle: 'Conexión del noveno bit de entrada al Pin 13',
    objective:
      'Colocar el interruptor DIP-1 para el acarreo inicial C0, cablearlo al Pin 13 del 74LS83A e incorporar su resistencia pull-down de 330 Ω.',
    explanationEs:
      'El 74LS83A es un sumador binario COMPLETO porque además de los 8 bits de operandos A y B, posee una entrada de acarreo inicial C0 (Cin, Pin 13):\n\n' +
      '• Permite sumar dos números con un acarreo previo proveniente de una etapa anterior (por ejemplo, al concatenar dos 74LS83 para sumar 8 bits).\n' +
      '• Si C0 = 0, el total es simplemente A + B.\n' +
      '• Si C0 = 1, el total es A + B + 1.\n\n' +
      'Al igual que las entradas A y B, Pin 13 necesita su interruptor, conexión a +5 V y su resistencia pull-down de 330 Ω a GND.',
    technicalDetailEs:
      'En muchos circuitos experimentales se olvida conectar C0 a tierra o a un interruptor; al flotar, el sumador puede sumar 1 de manera errática. En esta etapa garantizamos su control determinista.',
    componentsInvolved: ['dip-sw-c0', 'resistor-330'],
    signalsInvolved: ['C0'],
    checklist: [
      'Colocar el interruptor DIP-1 (Acarreo C0) sobre el canal central',
      'Conectar +5 V a la entrada superior del interruptor',
      'Tender cable de señal desde la salida del interruptor al Pin 13 del 74LS83A',
      'Instalar la novena resistencia pull-down de 330 Ω hacia el riel GND (−)',
      'Verificar que el Pin 13 no flote en ningún estado',
    ],
    hints: {
      level1Orientation:
        'Coloca el interruptor individual DIP-1 para C0, aliméntalo con 5 V, conéctalo al Pin 13 y añade su resistencia de 330 Ω a GND.',
      level2Identification:
        'Pin 13 es C0 (fila superior del chip, columna 31 si el chip empieza en 28). Usa cable color ámbar.',
      level3Visual:
        'Conecta riel + → entrada DIP-1, salida DIP-1 → Pin 13 (c31), y salida DIP-1 → resistencia 330 Ω → riel GND.',
      visualHighlights: {
        cameraPreset: 'chip-closeup',
        targetPins: [13],
        targetComponents: ['dip-sw-c0'],
      },
    },
    errorRemediations: [
      {
        condition: 'FLOATING_INPUT',
        adviceEs: 'El Pin 13 (C0) está flotante. Asegúrate de conectar el cable al interruptor y la resistencia de 330 Ω a GND.',
      },
    ],
  },
  {
    id: 'stage-6-outputs-leds',
    stepNumber: 6,
    title: 'Etapas Indicadoras: Resistencias Serie y LEDs',
    shortTitle: '6. LEDs de Salida',
    subtitle: '5 indicadores con limitación de corriente de 1 kΩ hacia tierra',
    objective:
      'Colocar 4 LEDs verdes (S0–S3) y 1 LED ámbar (C4), asociar cada salida con una resistencia limitadora de 1 kΩ y conectar los cátodos a GND.',
    explanationEs:
      'Para observar el resultado binario en tiempo real construimos 5 etapas indicadoras LED:\n\n' +
      '• 4 LEDs Verdes para la suma S3, S2, S1, S0 (pesos 8, 4, 2 y 1).\n' +
      '• 1 LED Ámbar para el acarreo de salida C4 (Cout, peso 16).\n\n' +
      'Reglas fundamentales de conexión:\n' +
      '1. Polaridad del LED: el ánodo (+) recibe la corriente; el cátodo (−, identificado por la pata más corta y el bisel plano en la cápsula) debe ir a GND.\n' +
      '2. Resistencia limitadora: cada salida debe pasar por una resistencia de 1 kΩ en serie antes del LED para no forzar la etapa de salida totem-pole del chip.',
    technicalDetailEs:
      'Mapeo de pines de salida del 74LS83A:\n' +
      '• S0 = Pin 9 → Resistencia 1 kΩ → Ánodo LED S0 (Verde)\n' +
      '• S1 = Pin 6 → Resistencia 1 kΩ → Ánodo LED S1 (Verde)\n' +
      '• S2 = Pin 2 → Resistencia 1 kΩ → Ánodo LED S2 (Verde)\n' +
      '• S3 = Pin 15 → Resistencia 1 kΩ → Ánodo LED S3 (Verde)\n' +
      '• C4 = Pin 14 → Resistencia 1 kΩ → Ánodo LED C4 (Ámbar)\n' +
      'Todos los cátodos retornan al riel GND (−).',
    componentsInvolved: ['led-amber', 'led-green', 'resistor-1k'],
    signalsInvolved: ['S0', 'S1', 'S2', 'S3', 'C4'],
    checklist: [
      'Insertar los 5 LEDs en la protoboard (1 ámbar para C4, 4 verdes para S3..S0)',
      'Verificar polaridad: ánodo (+) a la izquierda, cátodo (− con bisel) a la derecha',
      'Colocar 5 resistencias de 1 kΩ cruzando el canal o en serie hacia cada ánodo',
      'Cablear pines 9, 6, 2, 15 y 14 del 74LS83A hacia las resistencias limitadoras',
      'Conectar los 5 cátodos hacia el riel GND (−)',
    ],
    hints: {
      level1Orientation:
        'Coloca los 5 LEDs (1 ámbar y 4 verdes), una resistencia de 1 kΩ para cada uno y cables desde los pines de salida hacia sus ánodos, con cátodos a GND.',
      level2Identification:
        'Pines de salida: C4=Pin 14, S3=Pin 15, S2=Pin 2, S1=Pin 6, S0=Pin 9. Cada pin requiere su resistencia de 1 kΩ en serie.',
      level3Visual:
        'Revisa que los cátodos (pata derecha) vayan al riel negativo inferior y los ánodos a las resistencias de 1 kΩ.',
      visualHighlights: {
        cameraPreset: 'three-quarter',
        targetPins: [14, 15, 2, 6, 9],
        targetComponents: ['led-c4', 'led-s3', 'led-s2', 'led-s1', 'led-s0'],
      },
    },
    errorRemediations: [
      {
        condition: 'LED_WITHOUT_RESISTOR',
        adviceEs: '¡Atención! Un LED está conectado directo a una salida sin resistencia limitadora de 1 kΩ en serie.',
      },
      {
        condition: 'LED_REVERSE_POLARITY',
        adviceEs: 'Un LED tiene las patas invertidas. Presiona "R" al colocarlo o retíralo y colócalo con el ánodo (+) hacia la resistencia y el cátodo (−) a GND.',
      },
      {
        condition: 'UNDRIVEN_OUTPUT',
        adviceEs: 'Falta cablear alguna de las salidas S0..S3 o C4 hacia su etapa indicadora correspondiente.',
      },
    ],
  },
  {
    id: 'stage-7-circuit-review',
    stepNumber: 7,
    title: 'Revisión y Validación Integral del Circuito',
    shortTitle: '7. Verificación',
    subtitle: 'Comprobación de equivalencia de netlist y diagnóstico de salud',
    objective:
      'Inspeccionar el circuito completo, resolver advertencias de cableado y verificar que la netlist armada sea eléctricamente equivalente a la referencia.',
    explanationEs:
      'Antes de pasar a la prueba aritmética, el motor eléctrico verifica la integridad total de la red:\n\n' +
      '• Que no existan cables desconectados con extremos al aire.\n' +
      '• Que todas las 9 entradas tengan camino válido a +5 V y resistencia a GND.\n' +
      '• Que las 5 salidas conduzcan a sus respectivos indicadores sin contención.\n' +
      '• Que la netlist cumpla con el modelo canónico del sumador 74LS83A.',
    technicalDetailEs:
      'El motor utiliza refinamiento de grafos para verificar la equivalencia topológica: no importa si usaste agujeros distintos de la misma pista o si permutaste LEDs del mismo color; si la función de red es idéntica, el circuito es aprobado.',
    componentsInvolved: ['ic-74ls83a', 'dip-sw-a', 'dip-sw-b', 'dip-sw-c0', 'psu-5v'],
    signalsInvolved: ['VCC', 'GND', 'A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'C0', 'S0', 'S1', 'S2', 'S3', 'C4'],
    checklist: [
      'Verificar que no queden diagnósticos de error en el motor eléctrico',
      'Comprobar que todas las entradas A, B y C0 respondan al conmutar interruptores',
      'Confirmar equivalencia eléctrica de netlist con el circuito de referencia',
    ],
    hints: {
      level1Orientation:
        'Consulta los mensajes del diagnóstico eléctrico en este panel para corregir cualquier conexión pendiente.',
      level2Identification:
        'Revisa que la fuente esté encendida, el chip alimentado y todos los cables jumpers firmemente insertados.',
      level3Visual:
        'Si algún pin o cable se resalta en amarillo o rojo, haz clic sobre él para ver la causa exacta en el inspector.',
      visualHighlights: {
        cameraPreset: 'top',
      },
    },
    errorRemediations: [
      {
        condition: 'DISCONNECTED_WIRE',
        adviceEs: 'Hay uno o más cables con un extremo abierto en una pista vacía. Conéctalo al contacto correcto o elimínalo.',
      },
      {
        condition: 'NETLIST_MISMATCH',
        adviceEs: 'El circuito aún no coincide eléctricamente con el sumador canónico. Revisa las etapas 3, 4, 5 y 6.',
      },
    ],
  },
  {
    id: 'stage-8-functional-testing',
    stepNumber: 8,
    title: 'Prueba de Funcionamiento Aritmético',
    shortTitle: '8. Prueba de Sumas',
    subtitle: 'Comprobar las 4 operaciones clave en tiempo real',
    objective:
      'Operar los interruptores reales para comprobar 4 casos representativos del sumador (0+0+0, 7+1+0, 15+1+0 y 15+15+1) observando la respuesta de los LEDs.',
    explanationEs:
      'El circuito que has construido es ahora un sumador binario real en funcionamiento. En esta etapa debes probar y validar 4 operaciones fundamentales:\n\n' +
      '1. 0 + 0 + 0 = 0 (Reposo, todos apagados)\n' +
      '2. 7 + 1 + 0 = 8 (Propagación interna de acarreo: 0111₂ + 0001₂ = 1000₂)\n' +
      '3. 15 + 1 + 0 = 16 (Desbordamiento de 4 bits hacia C4: 1111₂ + 0001₂ = 10000₂)\n' +
      '4. 15 + 15 + 1 = 31 (Capacidad máxima de 5 bits: 1111₂ + 1111₂ + 1 = 11111₂)',
    technicalDetailEs:
      'El motor electrónico lee directamente el estado físico de los interruptores que colocaste, resuelve la netlist, ejecuta la lógica del 74LS83A y enciende los LEDs. Debes probar cada combinación para registrar su validación.',
    componentsInvolved: ['dip-sw-a', 'dip-sw-b', 'dip-sw-c0'],
    signalsInvolved: ['A0', 'A1', 'A2', 'A3', 'B0', 'B1', 'B2', 'B3', 'C0', 'S0', 'S1', 'S2', 'S3', 'C4'],
    checklist: [
      'Probar caso 1: 0 + 0 + 0 = 0',
      'Probar caso 2: 7 + 1 + 0 = 8 (bit S3 encendido)',
      'Probar caso 3: 15 + 1 + 0 = 16 (bit C4 encendido)',
      'Probar caso 4: 15 + 15 + 1 = 31 (todos los 5 LEDs encendidos)',
    ],
    hints: {
      level1Orientation:
        'Conmuta los interruptores de A, B y C0 usando el ratón en la escena 3D o los botones de la barra inferior.',
      level2Identification:
        'Puedes usar los botones de prueba rápida para configurar los operandos de cada caso automáticamente en tus interruptores.',
      level3Visual:
        'Observa cómo se iluminan los LEDs reales en la protoboard y en el panel de resultados.',
      visualHighlights: {
        cameraPreset: 'three-quarter',
      },
    },
    errorRemediations: [
      {
        condition: 'CASE_NOT_TESTED',
        adviceEs: 'Configura las entradas indicadas en el caso para que el motor registre la verificación aritmética.',
      },
    ],
    stage8TestCases: STAGE_8_MATH_TEST_CASES,
  },
  {
    id: 'stage-9-evaluation',
    stepNumber: 9,
    title: 'Evaluación Conceptual y Práctica Libre',
    shortTitle: '9. Evaluación',
    subtitle: 'Cuestionario final de comprensión y práctica libre con tu circuito',
    objective:
      'Demostrar la comprensión de los principios electrónicos del 74LS83A mediante una breve evaluación de 5 preguntas, y acceder al modo de práctica libre.',
    explanationEs:
      '¡Felicitaciones por armar el circuito sumador de 4 bits! Para consolidar tu aprendizaje, responde estas 5 preguntas conceptuales sobre el patillaje, la polarización de entradas y la función de los acarreos.\n\n' +
      'Al completar la evaluación, el laboratorio desbloqueará la práctica libre para que experimentes sin restricciones con tu propio circuito montado.',
    technicalDetailEs:
      'Tu circuito de trabajo construido permanecerá intacto y disponible para que explores cualquier combinación de las 512 posibles (A de 0 a 15, B de 0 a 15, C0 de 0 a 1).',
    componentsInvolved: ['ic-74ls83a'],
    signalsInvolved: ['S0', 'S1', 'S2', 'S3', 'C4'],
    checklist: [
      'Responder las 5 preguntas conceptuales del cuestionario',
      'Obtener el 100% de aciertos en la evaluación',
      'Celebrar la finalización exitosa del tutorial de montaje',
      'Continuar experimentando en modo de práctica libre',
    ],
    hints: {
      level1Orientation:
        'Revisa lo aprendido durante las etapas 1 a 8 sobre el pinout, las resistencias pull-down y los LEDs.',
      level2Identification:
        'Recuerda las notas técnicas: VCC está en el Pin 5, GND en el Pin 12, y las resistencias de 330 Ω evitan entradas flotantes.',
      level3Visual:
        'Puedes abrir el modal de Pinout completo desde la barra superior en cualquier momento como referencia.',
      visualHighlights: {
        cameraPreset: 'three-quarter',
      },
    },
    errorRemediations: [
      {
        condition: 'QUIZ_INCOMPLETE',
        adviceEs: 'Selecciona una respuesta para cada una de las 5 preguntas antes de comprobar la evaluación.',
      },
    ],
    stage9QuizQuestions: STAGE_9_EVALUATION_QUESTIONS,
  },
];

export function getGuidedStageById(id: GuidedStageId): GuidedStageDefinition {
  const found = GUIDED_STAGES.find((s) => s.id === id);
  if (!found) {
    throw new Error(`Etapa de montaje guiado no encontrada: ${id}`);
  }
  return found;
}

export function getGuidedStageByIndex(index: number): GuidedStageDefinition {
  const clamped = Math.max(0, Math.min(GUIDED_STAGES.length - 1, index));
  return GUIDED_STAGES[clamped]!;
}
