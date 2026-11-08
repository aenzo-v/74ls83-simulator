import type { WorkingCircuitState } from '../simulator/editableCircuit';

/**
 * FASE 6 — Persistencia Local del Progreso del Montaje Guiado y Circuito de Trabajo.
 *
 * Almacena en `localStorage` únicamente el estado esencial no calculable:
 * - Circuito de trabajo del estudiante (`workingCircuit`).
 * - Estados mecánicos de los interruptores (`workingSwitchStates`).
 * - Índice de etapa actual y progreso del tutorial (`guidedCurrentStageIndex`, `completedStages`).
 * - Respuestas de las actividades (cuestionario Etapa 1, casos probados Etapa 8, evaluación Etapa 9).
 * - Nivel de pista activo por etapa.
 *
 * Incorpora versionado de esquema (`74ls83-lab-guided-v1`) y recuperación tolerante a fallos.
 */

export const STORAGE_KEY = '74ls83_lab_guided_state_v1';
export const GUIDED_STORAGE_KEY = STORAGE_KEY;
const SCHEMA_VERSION = 1;

export interface PersistedGuidedState {
  readonly version: number;
  readonly savedAt: string;
  readonly workingCircuit: WorkingCircuitState;
  readonly workingSwitchStates: Record<string, boolean>;
  readonly currentStageIndex: number;
  readonly highestUnlockedIndex: number;
  readonly completedStages: boolean[];
  readonly hintLevels: number[];
  readonly stage1QuizAnswers: Record<string, boolean>;
  readonly stage8TestedCases: string[];
  readonly stage9QuizAnswers: Record<string, number>;
}

export function isPersistedGuidedState(data: unknown): data is PersistedGuidedState {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const obj = data as Partial<PersistedGuidedState>;
  return (
    obj.version === SCHEMA_VERSION &&
    typeof obj.savedAt === 'string' &&
    typeof obj.currentStageIndex === 'number' &&
    typeof obj.highestUnlockedIndex === 'number' &&
    Array.isArray(obj.completedStages) &&
    Array.isArray(obj.hintLevels) &&
    typeof obj.workingCircuit === 'object' &&
    typeof obj.workingSwitchStates === 'object' &&
    typeof obj.stage1QuizAnswers === 'object' &&
    Array.isArray(obj.stage8TestedCases) &&
    typeof obj.stage9QuizAnswers === 'object'
  );
}

export function saveGuidedStateToStorage(state: {
  readonly workingCircuit: WorkingCircuitState;
  readonly workingSwitchStates: Readonly<Record<string, boolean>>;
  readonly currentStageIndex: number;
  readonly highestUnlockedIndex: number;
  readonly completedStages: readonly boolean[];
  readonly hintLevels: readonly number[];
  readonly stage1QuizAnswers: Readonly<Record<string, boolean>>;
  readonly stage8TestedCases: readonly string[];
  readonly stage9QuizAnswers: Readonly<Record<string, number>>;
}): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const payload: PersistedGuidedState = {
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      workingCircuit: state.workingCircuit,
      workingSwitchStates: { ...state.workingSwitchStates },
      currentStageIndex: state.currentStageIndex,
      highestUnlockedIndex: state.highestUnlockedIndex,
      completedStages: [...state.completedStages],
      hintLevels: [...state.hintLevels],
      stage1QuizAnswers: { ...state.stage1QuizAnswers },
      stage8TestedCases: [...state.stage8TestedCases],
      stage9QuizAnswers: { ...state.stage9QuizAnswers },
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('[74LS83 Lab] No se pudo guardar el progreso en localStorage:', err);
    return false;
  }
}

export function loadGuidedStateFromStorage(): PersistedGuidedState | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (isPersistedGuidedState(parsed)) {
      return parsed;
    }
    console.warn('[74LS83 Lab] Esquema de persistencia inválido o versión incompatible. Reiniciando.');
    clearGuidedStateFromStorage();
    return null;
  } catch (err) {
    console.warn('[74LS83 Lab] Error al leer progreso de localStorage:', err);
    return null;
  }
}

export function clearGuidedStateFromStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[74LS83 Lab] Error al limpiar localStorage:', err);
  }
}
