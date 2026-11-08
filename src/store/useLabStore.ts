import { create } from 'zustand';
import {
  DIP_SWITCHES,
  POWER_SUPPLY_5V,
  resolveTerminalPosition,
  WIRE_COLORS,
} from '../data/circuitLayout';
import {
  CARRY_IN_CHANNEL_ID,
  OPERAND_A_CHANNELS_LSB_FIRST,
  OPERAND_B_CHANNELS_LSB_FIRST,
} from '../data/presets';
import { type BitValue, numberToWord4 } from '../simulator/adder74ls83';
import { findNearestHoleXZ, PITCH } from '../simulator/breadboard';
import {
  addWireToCircuit,
  createEmptyWorkingCircuit,
  findComponentInCircuit,
  findWiresAssociatedWithComponent,
  getOccupiedTerminals,
  isValidWireEndpoint,
  type PlaceableKitItemType,
  placeChipInCircuit,
  placeDipSwitchInCircuit,
  placeLedInCircuit,
  placeResistorInCircuit,
  removeComponentFromCircuit,
  removeWireFromCircuit,
  replaceWireInCircuit,
  type ResistorDisposition,
  resolveDipFootprintAtPoint,
  resolveLedFootprintAtPoint,
  resolveResistorPresetFootprintAtPoint,
  updateWireColorInCircuit,
  type WorkingCircuitState,
  workingCircuitToSolverInput,
} from '../simulator/editableCircuit';
import {
  GUIDED_STAGES,
  getGuidedStageByIndex,
} from '../simulator/guidedStages';
import {
  type GuidedValidationContext,
  type StageValidationResult,
  validateStageByIndex,
} from '../simulator/guidedValidation';
import { solveCircuit } from '../simulator/netlist';
import type { PinNumber, Point3D, SignalCode, SimulatorMode } from '../simulator/types';
import {
  clearGuidedStateFromStorage,
  loadGuidedStateFromStorage,
  saveGuidedStateToStorage,
} from './guidedPersistence';

export type CameraPreset = 'three-quarter' | 'top' | 'chip-closeup';

export type EditorTool = 'select' | 'place' | 'wire' | 'remove';

export type LabSelection =
  | { readonly kind: 'none' }
  | { readonly kind: 'chip' }
  | { readonly kind: 'pin'; readonly pinNumber: PinNumber }
  | { readonly kind: 'breadboard'; readonly holeId?: string }
  | { readonly kind: 'component'; readonly componentId: string; readonly subChannelId?: string }
  | { readonly kind: 'wire'; readonly wireId: string };

export type HoveredTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'chip' }
  | { readonly kind: 'pin'; readonly pinNumber: PinNumber }
  | { readonly kind: 'hole'; readonly holeId: string }
  | { readonly kind: 'psu-terminal'; readonly terminalId: string }
  | { readonly kind: 'component'; readonly componentId: string; readonly subChannelId?: string }
  | { readonly kind: 'wire'; readonly wireId: string };

export interface WireDraftState {
  readonly fromTerminalId: string;
  readonly previewPoint: Point3D;
  readonly candidateTerminalId: string | null;
  readonly replaceWireId: string | null;
}

export interface PendingRemovalState {
  readonly componentId: string;
  readonly componentLabel: string;
  readonly associatedWireCount: number;
  readonly cascadeWires: boolean;
}

export interface EditorFeedbackMessage {
  readonly tone: 'info' | 'success' | 'error';
  readonly textEs: string;
}

export interface EditableHistoryEntry {
  readonly circuit: WorkingCircuitState;
  readonly switchStates: Readonly<Record<string, boolean>>;
  readonly actionLabel: string;
}

const MAX_HISTORY_ENTRIES = 60;

export function buildInitialSwitchStates(): Record<string, boolean> {
  const initial: Record<string, boolean> = {
    [POWER_SUPPLY_5V.id]: true,
  };
  for (const sw of DIP_SWITCHES) {
    for (const ch of sw.channels) {
      initial[ch.id] = ch.defaultOn;
    }
  }
  return initial;
}

function pushUndoEntry(
  stack: readonly EditableHistoryEntry[],
  entry: EditableHistoryEntry,
): readonly EditableHistoryEntry[] {
  const next = [...stack, entry];
  return next.length > MAX_HISTORY_ENTRIES ? next.slice(next.length - MAX_HISTORY_ENTRIES) : next;
}

interface LabState {
  readonly mode: SimulatorMode;
  readonly cameraPreset: CameraPreset;
  /** Contador incremental para re-ejecutar transiciones al pulsar «Restablecer» o repetir vista. */
  readonly cameraRequestVersion: number;
  readonly selection: LabSelection;
  readonly hovered: HoveredTarget;
  readonly isHelpModalOpen: boolean;
  readonly isSidebarOpen: boolean;

  /**
   * Señal cuyo recorrido eléctrico completo se resalta en la escena 3D sin alterar la conectividad.
   */
  readonly tracedSignal: SignalCode | null;

  /**
   * Estado mecánico de los interruptores del circuito de referencia (`mode === 'mounted'`).
   */
  readonly switchStates: Readonly<Record<string, boolean>>;

  /**
   * Circuito editable independiente y su estado mecánico de interruptores (`mode === 'guided'`).
   */
  readonly workingCircuit: WorkingCircuitState;
  readonly workingSwitchStates: Readonly<Record<string, boolean>>;
  readonly undoStack: readonly EditableHistoryEntry[];
  readonly redoStack: readonly EditableHistoryEntry[];

  /**
   * Estado puramente visual de herramientas interactivas 3D (nunca altera la netlist por sí mismo).
   */
  readonly activeTool: EditorTool;
  readonly activeKitItem: PlaceableKitItemType;
  readonly resistorDisposition: ResistorDisposition;
  readonly ledReversed: boolean;
  readonly activeWireColor: string;
  readonly wireDraft: WireDraftState | null;
  readonly resistorAnchorHoleId: string | null;
  readonly placementHoverPoint: Point3D | null;
  readonly pendingRemoval: PendingRemovalState | null;
  readonly editorFeedback: EditorFeedbackMessage | null;

  /**
   * Estado y navegación del sistema de Montaje Guiado Educativo (Fase 6).
   */
  readonly guidedCurrentStageIndex: number;
  readonly guidedHighestUnlockedIndex: number;
  readonly guidedCompletedStages: readonly boolean[];
  readonly guidedHintLevels: readonly number[];
  readonly guidedStage1QuizAnswers: Readonly<Record<string, boolean>>;
  readonly guidedStage8TestedCases: readonly string[];
  readonly guidedStage9QuizAnswers: Readonly<Record<string, number>>;
  readonly guidedActiveTab: 'guide' | 'inspector';
  readonly guidedPracticeUnlocked: boolean;

  setMode: (mode: SimulatorMode) => void;
  requestCameraPreset: (preset: CameraPreset) => void;
  resetCamera: () => void;
  setSelection: (selection: LabSelection) => void;
  clearSelection: () => void;
  setHovered: (hovered: HoveredTarget) => void;
  setHelpModalOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  setTracedSignal: (signal: SignalCode | null) => void;
  toggleTracedSignal: (signal: SignalCode) => void;

  toggleSwitchState: (channelOrSupplyId: string) => void;
  setSwitchState: (channelOrSupplyId: string, active: boolean) => void;
  setPowerSupplyOn: (active: boolean) => void;
  togglePowerSupply: () => void;
  setOperandA: (value: number) => void;
  setOperandB: (value: number) => void;
  setCarryIn: (active: boolean) => void;
  applyAdditionPreset: (operandA: number, operandB: number, carryIn: BitValue) => void;

  // Acciones de herramientas y edición 3D (Fase 5)
  setActiveTool: (tool: EditorTool) => void;
  setActiveKitItem: (item: PlaceableKitItemType) => void;
  setResistorDisposition: (disposition: ResistorDisposition) => void;
  setLedReversed: (reversed: boolean) => void;
  cyclePlacementOrientation: () => void;
  setActiveWireColor: (colorHex: string) => void;
  setPlacementHoverPoint: (point: Point3D | null) => void;
  setEditorFeedback: (feedback: EditorFeedbackMessage | null) => void;
  cancelActiveOperation: () => void;

  startWireDraft: (fromTerminalId: string, options?: { replaceWireId?: string }) => boolean;
  updateWireDraftCursor: (point: Point3D, candidateTerminalId: string | null) => void;
  commitWireDraft: (toTerminalId: string) => boolean;
  handleWireTerminalClick: (terminalId: string) => boolean;
  beginWireReconnect: (wireId: string, keepEnd: 'from' | 'to') => boolean;
  changeWireColor: (wireId: string, colorHex: string) => void;
  deleteWire: (wireId: string) => boolean;

  placeChipAtColumn: (startColumn: number, rowZone?: 'trench' | 'off-trench') => boolean;
  placeDipSwitchAtColumn: (
    templateId: 'dip-sw-a' | 'dip-sw-b' | 'dip-sw-c0',
    startColumn: number,
    rowZone?: 'trench' | 'off-trench',
  ) => boolean;
  placeResistorBetween: (ohms: 330 | 1000, leadAHoleId: string, leadBHoleId: string) => boolean;
  placeLedAt: (color: 'AMBER' | 'GREEN', anodeHoleId: string, cathodeHoleId: string) => boolean;
  handlePlaceSurfaceClick: (point: Point3D) => boolean;

  requestComponentRemoval: (componentId: string) => void;
  setPendingRemovalCascade: (cascadeWires: boolean) => void;
  confirmComponentRemoval: () => boolean;
  removeComponentImmediate: (
    componentId: string,
    options?: { cascadeWires?: boolean },
  ) => boolean;
  deleteSelectedElement: () => void;

  undo: () => boolean;
  redo: () => boolean;
  resetWorkingCircuit: () => void;

  // Acciones del montaje guiado educativo (Fase 6)
  setGuidedStageIndex: (index: number) => void;
  nextGuidedStage: () => void;
  prevGuidedStage: () => void;
  cycleGuidedHintLevel: () => void;
  setGuidedHintLevel: (stageIndex: number, level: number) => void;
  answerStage1Quiz: (pairId: string, connected: boolean) => void;
  recordStage8TestedCase: (caseId: string) => void;
  answerStage9Quiz: (questionId: string, optionIndex: number) => void;
  setGuidedActiveTab: (tab: 'guide' | 'inspector') => void;
  checkCurrentGuidedStage: () => StageValidationResult;
  resetGuidedTutorial: () => void;
  setGuidedPracticeUnlocked: (unlocked: boolean) => void;
}

const initialPersisted = loadGuidedStateFromStorage();
const initialGuidedCompleted =
  initialPersisted?.completedStages ?? [false, false, false, false, false, false, false, false, false];
const initialPracticeUnlocked =
  initialPersisted ? initialGuidedCompleted.length === 9 && initialGuidedCompleted.every(Boolean) : false;

function persistGuidedState(state: LabState) {
  if (state.mode === 'guided') {
    saveGuidedStateToStorage({
      workingCircuit: state.workingCircuit,
      workingSwitchStates: state.workingSwitchStates,
      currentStageIndex: state.guidedCurrentStageIndex,
      highestUnlockedIndex: state.guidedHighestUnlockedIndex,
      completedStages: state.guidedCompletedStages,
      hintLevels: state.guidedHintLevels,
      stage1QuizAnswers: state.guidedStage1QuizAnswers,
      stage8TestedCases: state.guidedStage8TestedCases,
      stage9QuizAnswers: state.guidedStage9QuizAnswers,
    });
  }
}

export const useLabStore = create<LabState>((set, get) => ({
  mode: 'mounted',
  cameraPreset: 'three-quarter',
  cameraRequestVersion: 0,
  selection: { kind: 'chip' },
  hovered: { kind: 'none' },
  isHelpModalOpen: false,
  isSidebarOpen: true,
  tracedSignal: null,
  switchStates: buildInitialSwitchStates(),

  workingCircuit: initialPersisted?.workingCircuit ?? createEmptyWorkingCircuit(),
  workingSwitchStates: initialPersisted?.workingSwitchStates ?? buildInitialSwitchStates(),
  undoStack: [],
  redoStack: [],

  guidedCurrentStageIndex: initialPersisted?.currentStageIndex ?? 0,
  guidedHighestUnlockedIndex: initialPersisted?.highestUnlockedIndex ?? 0,
  guidedCompletedStages: initialGuidedCompleted,
  guidedHintLevels: initialPersisted?.hintLevels ?? [0, 0, 0, 0, 0, 0, 0, 0, 0],
  guidedStage1QuizAnswers: initialPersisted?.stage1QuizAnswers ?? {},
  guidedStage8TestedCases: initialPersisted?.stage8TestedCases ?? [],
  guidedStage9QuizAnswers: initialPersisted?.stage9QuizAnswers ?? {},
  guidedActiveTab: 'guide',
  guidedPracticeUnlocked: initialPracticeUnlocked,

  activeTool: 'select',
  activeKitItem: 'ic-74ls83a',
  resistorDisposition: 'to-rail-gnd',
  ledReversed: false,
  activeWireColor: WIRE_COLORS.vcc,
  wireDraft: null,
  resistorAnchorHoleId: null,
  placementHoverPoint: null,
  pendingRemoval: null,
  editorFeedback: null,

  setMode: (mode) =>
    set((state) => ({
      mode,
      tracedSignal: null,
      wireDraft: null,
      resistorAnchorHoleId: null,
      placementHoverPoint: null,
      pendingRemoval: null,
      editorFeedback: null,
      selection:
        mode === 'mounted'
          ? { kind: 'chip' }
          : state.workingCircuit.chip
            ? { kind: 'chip' }
            : { kind: 'none' },
    })),

  requestCameraPreset: (preset) =>
    set((state) => ({
      cameraPreset: preset,
      cameraRequestVersion: state.cameraRequestVersion + 1,
    })),

  resetCamera: () =>
    set((state) => ({
      cameraPreset: 'three-quarter',
      cameraRequestVersion: state.cameraRequestVersion + 1,
    })),

  setSelection: (selection) => set({ selection }),

  clearSelection: () => set({ selection: { kind: 'none' } }),

  setHovered: (hovered) => set({ hovered }),

  setHelpModalOpen: (isHelpModalOpen) => set({ isHelpModalOpen }),

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  setTracedSignal: (tracedSignal) => set({ tracedSignal }),

  toggleTracedSignal: (signal) =>
    set((state) => ({
      tracedSignal: state.tracedSignal === signal ? null : signal,
    })),

  toggleSwitchState: (channelOrSupplyId) =>
    set((state) => {
      if (state.mode === 'guided') {
        return {
          workingSwitchStates: {
            ...state.workingSwitchStates,
            [channelOrSupplyId]: !state.workingSwitchStates[channelOrSupplyId],
          },
        };
      }
      return {
        switchStates: {
          ...state.switchStates,
          [channelOrSupplyId]: !state.switchStates[channelOrSupplyId],
        },
      };
    }),

  setSwitchState: (channelOrSupplyId, active) =>
    set((state) => {
      if (state.mode === 'guided') {
        return {
          workingSwitchStates: {
            ...state.workingSwitchStates,
            [channelOrSupplyId]: active,
          },
        };
      }
      return {
        switchStates: {
          ...state.switchStates,
          [channelOrSupplyId]: active,
        },
      };
    }),

  setPowerSupplyOn: (active) =>
    set((state) => {
      if (state.mode === 'guided') {
        return {
          workingSwitchStates: {
            ...state.workingSwitchStates,
            [POWER_SUPPLY_5V.id]: active,
          },
        };
      }
      return {
        switchStates: {
          ...state.switchStates,
          [POWER_SUPPLY_5V.id]: active,
        },
      };
    }),

  togglePowerSupply: () =>
    set((state) => {
      if (state.mode === 'guided') {
        return {
          workingSwitchStates: {
            ...state.workingSwitchStates,
            [POWER_SUPPLY_5V.id]: !state.workingSwitchStates[POWER_SUPPLY_5V.id],
          },
        };
      }
      return {
        switchStates: {
          ...state.switchStates,
          [POWER_SUPPLY_5V.id]: !state.switchStates[POWER_SUPPLY_5V.id],
        },
      };
    }),

  setOperandA: (value) =>
    set((state) => {
      const bits = numberToWord4(value);
      const target = state.mode === 'guided' ? state.workingSwitchStates : state.switchStates;
      const updated = {
        ...target,
        [OPERAND_A_CHANNELS_LSB_FIRST[0]]: bits[0] === 1,
        [OPERAND_A_CHANNELS_LSB_FIRST[1]]: bits[1] === 1,
        [OPERAND_A_CHANNELS_LSB_FIRST[2]]: bits[2] === 1,
        [OPERAND_A_CHANNELS_LSB_FIRST[3]]: bits[3] === 1,
      };
      return state.mode === 'guided'
        ? { workingSwitchStates: updated }
        : { switchStates: updated };
    }),

  setOperandB: (value) =>
    set((state) => {
      const bits = numberToWord4(value);
      const target = state.mode === 'guided' ? state.workingSwitchStates : state.switchStates;
      const updated = {
        ...target,
        [OPERAND_B_CHANNELS_LSB_FIRST[0]]: bits[0] === 1,
        [OPERAND_B_CHANNELS_LSB_FIRST[1]]: bits[1] === 1,
        [OPERAND_B_CHANNELS_LSB_FIRST[2]]: bits[2] === 1,
        [OPERAND_B_CHANNELS_LSB_FIRST[3]]: bits[3] === 1,
      };
      return state.mode === 'guided'
        ? { workingSwitchStates: updated }
        : { switchStates: updated };
    }),

  setCarryIn: (active) =>
    set((state) => {
      if (state.mode === 'guided') {
        return {
          workingSwitchStates: {
            ...state.workingSwitchStates,
            [CARRY_IN_CHANNEL_ID]: active,
          },
        };
      }
      return {
        switchStates: {
          ...state.switchStates,
          [CARRY_IN_CHANNEL_ID]: active,
        },
      };
    }),

  applyAdditionPreset: (operandA, operandB, carryIn) =>
    set((state) => {
      const aBits = numberToWord4(operandA);
      const bBits = numberToWord4(operandB);
      const target = state.mode === 'guided' ? state.workingSwitchStates : state.switchStates;
      const updated = {
        ...target,
        [OPERAND_A_CHANNELS_LSB_FIRST[0]]: aBits[0] === 1,
        [OPERAND_A_CHANNELS_LSB_FIRST[1]]: aBits[1] === 1,
        [OPERAND_A_CHANNELS_LSB_FIRST[2]]: aBits[2] === 1,
        [OPERAND_A_CHANNELS_LSB_FIRST[3]]: aBits[3] === 1,
        [OPERAND_B_CHANNELS_LSB_FIRST[0]]: bBits[0] === 1,
        [OPERAND_B_CHANNELS_LSB_FIRST[1]]: bBits[1] === 1,
        [OPERAND_B_CHANNELS_LSB_FIRST[2]]: bBits[2] === 1,
        [OPERAND_B_CHANNELS_LSB_FIRST[3]]: bBits[3] === 1,
        [CARRY_IN_CHANNEL_ID]: carryIn === 1,
      };
      return state.mode === 'guided'
        ? { workingSwitchStates: updated }
        : { switchStates: updated };
    }),

  // =========================================================================
  // Acciones del Sistema de Montaje Interactivo y Cableado 3D (Fase 5)
  // =========================================================================

  setActiveTool: (tool) =>
    set({
      activeTool: tool,
      wireDraft: null,
      resistorAnchorHoleId: null,
      placementHoverPoint: null,
      pendingRemoval: null,
      editorFeedback: null,
    }),

  setActiveKitItem: (item) =>
    set((state) => ({
      activeTool: 'place',
      activeKitItem: item,
      resistorDisposition:
        item === 'resistor-330'
          ? 'to-rail-gnd'
          : item === 'resistor-1k'
            ? 'trench-bridge'
            : state.resistorDisposition,
      wireDraft: null,
      resistorAnchorHoleId: null,
      pendingRemoval: null,
      editorFeedback: null,
    })),

  setResistorDisposition: (resistorDisposition) =>
    set({
      resistorDisposition,
      resistorAnchorHoleId: null,
      editorFeedback: null,
    }),

  setLedReversed: (ledReversed) => set({ ledReversed }),

  cyclePlacementOrientation: () =>
    set((state) => {
      if (state.activeKitItem === 'led-amber' || state.activeKitItem === 'led-green') {
        return { ledReversed: !state.ledReversed };
      }
      if (state.activeKitItem === 'resistor-330' || state.activeKitItem === 'resistor-1k') {
        const order: readonly ResistorDisposition[] = [
          'to-rail-gnd',
          'trench-bridge',
          'horizontal-4',
          'two-point',
        ];
        const idx = order.indexOf(state.resistorDisposition);
        const next = order[(idx + 1) % order.length]!;
        return { resistorDisposition: next, resistorAnchorHoleId: null };
      }
      return {};
    }),

  setActiveWireColor: (activeWireColor) => set({ activeWireColor }),

  setPlacementHoverPoint: (placementHoverPoint) => set({ placementHoverPoint }),

  setEditorFeedback: (editorFeedback) => set({ editorFeedback }),

  cancelActiveOperation: () =>
    set((state) => {
      if (state.pendingRemoval) {
        return {
          pendingRemoval: null,
          editorFeedback: { tone: 'info', textEs: 'Retirada cancelada.' },
        };
      }
      if (state.wireDraft) {
        return {
          wireDraft: null,
          editorFeedback: { tone: 'info', textEs: 'Tendido de cable cancelado.' },
        };
      }
      if (state.resistorAnchorHoleId) {
        return {
          resistorAnchorHoleId: null,
          editorFeedback: { tone: 'info', textEs: 'Anclaje de resistencia cancelado.' },
        };
      }
      if (state.activeTool !== 'select' && state.mode === 'guided') {
        return {
          activeTool: 'select',
          placementHoverPoint: null,
          editorFeedback: null,
        };
      }
      return {
        selection: { kind: 'none' },
        tracedSignal: null,
        editorFeedback: null,
      };
    }),

  startWireDraft: (fromTerminalId, options) => {
    const state = get();
    if (!isValidWireEndpoint(fromTerminalId)) {
      set({
        editorFeedback: {
          tone: 'error',
          textEs: `Contacto inexistente: ${fromTerminalId}.`,
        },
      });
      return false;
    }

    const occupied = getOccupiedTerminals(state.workingCircuit, {
      ignoreWireId: options?.replaceWireId,
    });
    if (occupied.has(fromTerminalId)) {
      set({
        editorFeedback: {
          tone: 'error',
          textEs: `El contacto ${fromTerminalId} ya está ocupado.`,
        },
      });
      return false;
    }

    const startPos = resolveTerminalPosition(fromTerminalId);
    if (!startPos) {
      return false;
    }

    set({
      activeTool: 'wire',
      wireDraft: {
        fromTerminalId,
        previewPoint: startPos,
        candidateTerminalId: null,
        replaceWireId: options?.replaceWireId ?? null,
      },
      editorFeedback: {
        tone: 'info',
        textEs: `Origen fijado en ${fromTerminalId}. Selecciona el contacto de destino (Esc para cancelar).`,
      },
    });
    return true;
  },

  updateWireDraftCursor: (point, candidateTerminalId) =>
    set((state) => {
      if (!state.wireDraft) {
        return {};
      }
      return {
        wireDraft: {
          ...state.wireDraft,
          previewPoint: point,
          candidateTerminalId,
        },
      };
    }),

  commitWireDraft: (toTerminalId) => {
    const state = get();
    const draft = state.wireDraft;
    if (!draft) {
      return false;
    }

    if (draft.replaceWireId) {
      const replaced = replaceWireInCircuit(
        state.workingCircuit,
        draft.replaceWireId,
        draft.fromTerminalId,
        toTerminalId,
        state.activeWireColor,
      );
      if (!replaced.ok) {
        set({
          editorFeedback: { tone: 'error', textEs: replaced.reasonEs },
        });
        return false;
      }

      set({
        undoStack: pushUndoEntry(state.undoStack, {
          circuit: state.workingCircuit,
          switchStates: state.workingSwitchStates,
          actionLabel: replaced.summaryEs,
        }),
        redoStack: [],
        workingCircuit: replaced.circuit,
        wireDraft: null,
        selection: { kind: 'wire', wireId: replaced.updatedWire.id },
        editorFeedback: { tone: 'success', textEs: replaced.summaryEs },
      });
      persistGuidedState(get());
      return true;
    }

    const added = addWireToCircuit(
      state.workingCircuit,
      draft.fromTerminalId,
      toTerminalId,
      state.activeWireColor,
    );
    if (!added.ok) {
      set({
        editorFeedback: { tone: 'error', textEs: added.reasonEs },
      });
      return false;
    }

    set({
      undoStack: pushUndoEntry(state.undoStack, {
        circuit: state.workingCircuit,
        switchStates: state.workingSwitchStates,
        actionLabel: added.summaryEs,
      }),
      redoStack: [],
      workingCircuit: added.circuit,
      wireDraft: null,
      selection: { kind: 'wire', wireId: added.createdWire.id },
      editorFeedback: { tone: 'success', textEs: added.summaryEs },
    });
    persistGuidedState(get());
    return true;
  },

  handleWireTerminalClick: (terminalId) => {
    const state = get();
    if (!state.wireDraft) {
      return get().startWireDraft(terminalId);
    }
    if (state.wireDraft.fromTerminalId === terminalId) {
      set({
        wireDraft: null,
        editorFeedback: { tone: 'info', textEs: 'Tendido de cable cancelado.' },
      });
      return false;
    }
    return get().commitWireDraft(terminalId);
  },

  beginWireReconnect: (wireId, keepEnd) => {
    const state = get();
    const wire = state.workingCircuit.wires.find((w) => w.id === wireId);
    if (!wire) {
      return false;
    }
    const anchor = keepEnd === 'from' ? wire.fromTerminalId : wire.toTerminalId;
    set({ activeWireColor: wire.colorHex });
    return get().startWireDraft(anchor, { replaceWireId: wireId });
  },

  changeWireColor: (wireId, colorHex) =>
    set((state) => {
      const existing = state.workingCircuit.wires.find((w) => w.id === wireId);
      if (!existing || existing.colorHex.toLowerCase() === colorHex.toLowerCase()) {
        return {};
      }
      const nextCircuit = updateWireColorInCircuit(state.workingCircuit, wireId, colorHex);
      return {
        undoStack: pushUndoEntry(state.undoStack, {
          circuit: state.workingCircuit,
          switchStates: state.workingSwitchStates,
          actionLabel: `Color de cable ${wireId} actualizado`,
        }),
        redoStack: [],
        workingCircuit: nextCircuit,
        activeWireColor: colorHex,
      };
    }),

  deleteWire: (wireId) => {
    const state = get();
    const outcome = removeWireFromCircuit(state.workingCircuit, wireId);
    if (!outcome.removed) {
      return false;
    }
    set({
      undoStack: pushUndoEntry(state.undoStack, {
        circuit: state.workingCircuit,
        switchStates: state.workingSwitchStates,
        actionLabel: outcome.summaryEs,
      }),
      redoStack: [],
      workingCircuit: outcome.circuit,
      selection:
        state.selection.kind === 'wire' && state.selection.wireId === wireId
          ? { kind: 'none' }
          : state.selection,
      editorFeedback: { tone: 'info', textEs: outcome.summaryEs },
    });
    persistGuidedState(get());
    return true;
  },

  placeChipAtColumn: (startColumn, rowZone = 'trench') => {
    const state = get();
    const outcome = placeChipInCircuit(state.workingCircuit, startColumn, rowZone);
    if (!outcome.ok) {
      set({ editorFeedback: { tone: 'error', textEs: outcome.reasonEs } });
      return false;
    }
    set({
      undoStack: pushUndoEntry(state.undoStack, {
        circuit: state.workingCircuit,
        switchStates: state.workingSwitchStates,
        actionLabel: outcome.summaryEs,
      }),
      redoStack: [],
      workingCircuit: outcome.circuit,
      selection: { kind: 'chip' },
      editorFeedback: { tone: 'success', textEs: outcome.summaryEs },
    });
    persistGuidedState(get());
    return true;
  },

  placeDipSwitchAtColumn: (templateId, startColumn, rowZone = 'trench') => {
    const state = get();
    const outcome = placeDipSwitchInCircuit(
      state.workingCircuit,
      templateId,
      startColumn,
      rowZone,
    );
    if (!outcome.ok) {
      set({ editorFeedback: { tone: 'error', textEs: outcome.reasonEs } });
      return false;
    }
    set({
      undoStack: pushUndoEntry(state.undoStack, {
        circuit: state.workingCircuit,
        switchStates: state.workingSwitchStates,
        actionLabel: outcome.summaryEs,
      }),
      redoStack: [],
      workingCircuit: outcome.circuit,
      selection: { kind: 'component', componentId: outcome.placedComponentId },
      editorFeedback: { tone: 'success', textEs: outcome.summaryEs },
    });
    persistGuidedState(get());
    return true;
  },

  placeResistorBetween: (ohms, leadAHoleId, leadBHoleId) => {
    const state = get();
    const outcome = placeResistorInCircuit(
      state.workingCircuit,
      ohms,
      leadAHoleId,
      leadBHoleId,
    );
    if (!outcome.ok) {
      set({ editorFeedback: { tone: 'error', textEs: outcome.reasonEs } });
      return false;
    }
    set({
      undoStack: pushUndoEntry(state.undoStack, {
        circuit: state.workingCircuit,
        switchStates: state.workingSwitchStates,
        actionLabel: outcome.summaryEs,
      }),
      redoStack: [],
      workingCircuit: outcome.circuit,
      resistorAnchorHoleId: null,
      selection: { kind: 'component', componentId: outcome.placedComponentId },
      editorFeedback: { tone: 'success', textEs: outcome.summaryEs },
    });
    persistGuidedState(get());
    return true;
  },

  placeLedAt: (color, anodeHoleId, cathodeHoleId) => {
    const state = get();
    const outcome = placeLedInCircuit(
      state.workingCircuit,
      color,
      anodeHoleId,
      cathodeHoleId,
    );
    if (!outcome.ok) {
      set({ editorFeedback: { tone: 'error', textEs: outcome.reasonEs } });
      return false;
    }
    set({
      undoStack: pushUndoEntry(state.undoStack, {
        circuit: state.workingCircuit,
        switchStates: state.workingSwitchStates,
        actionLabel: outcome.summaryEs,
      }),
      redoStack: [],
      workingCircuit: outcome.circuit,
      selection: { kind: 'component', componentId: outcome.placedComponentId },
      editorFeedback: { tone: 'success', textEs: outcome.summaryEs },
    });
    persistGuidedState(get());
    return true;
  },

  handlePlaceSurfaceClick: (point) => {
    const state = get();
    const item = state.activeKitItem;

    if (item === 'ic-74ls83a') {
      const fp = resolveDipFootprintAtPoint(point.x, point.z, 8);
      return get().placeChipAtColumn(fp.startColumn, fp.rowZone);
    }

    if (item === 'dip-sw-a' || item === 'dip-sw-b' || item === 'dip-sw-c0') {
      const span = item === 'dip-sw-c0' ? 1 : 4;
      const fp = resolveDipFootprintAtPoint(point.x, point.z, span);
      return get().placeDipSwitchAtColumn(item, fp.startColumn, fp.rowZone);
    }

    if (item === 'led-amber' || item === 'led-green') {
      const fp = resolveLedFootprintAtPoint(point.x, point.z, state.ledReversed);
      if (!fp) {
        set({
          editorFeedback: {
            tone: 'error',
            textEs: 'Acerca el puntero a una fila de terminales de la protoboard.',
          },
        });
        return false;
      }
      return get().placeLedAt(
        item === 'led-amber' ? 'AMBER' : 'GREEN',
        fp.anodeHoleId,
        fp.cathodeHoleId,
      );
    }

    // Resistencias 330 Ω o 1 kΩ
    const ohms = item === 'resistor-330' ? 330 : 1000;
    if (state.resistorDisposition === 'two-point') {
      const nearest = findNearestHoleXZ(point.x, point.z, PITCH * 0.75);
      if (!nearest) {
        return false;
      }
      if (!state.resistorAnchorHoleId) {
        const occupied = getOccupiedTerminals(state.workingCircuit);
        if (occupied.has(nearest.id)) {
          set({
            editorFeedback: {
              tone: 'error',
              textEs: `El agujero ${nearest.id} ya está ocupado.`,
            },
          });
          return false;
        }
        set({
          resistorAnchorHoleId: nearest.id,
          editorFeedback: {
            tone: 'info',
            textEs: `Primera terminal en ${nearest.id}. Haz clic en el segundo agujero (1–9 pasos).`,
          },
        });
        return true;
      }
      if (state.resistorAnchorHoleId === nearest.id) {
        set({
          resistorAnchorHoleId: null,
          editorFeedback: { tone: 'info', textEs: 'Anclaje cancelado.' },
        });
        return false;
      }
      return get().placeResistorBetween(ohms, state.resistorAnchorHoleId, nearest.id);
    }

    const fp = resolveResistorPresetFootprintAtPoint(
      point.x,
      point.z,
      state.resistorDisposition,
    );
    if (!fp) {
      set({
        editorFeedback: {
          tone: 'error',
          textEs: 'Posición fuera de los contactos válidos de la protoboard.',
        },
      });
      return false;
    }
    return get().placeResistorBetween(ohms, fp.leadAHoleId, fp.leadBHoleId);
  },

  requestComponentRemoval: (componentId) => {
    const state = get();
    if (componentId === POWER_SUPPLY_5V.id) {
      set({
        editorFeedback: {
          tone: 'info',
          textEs: 'La fuente regulada +5 V permanece fija en el banco; puedes desconectar sus cables.',
        },
      });
      return;
    }

    let label = componentId;
    if (state.workingCircuit.chip?.id === componentId) {
      label = 'Integrado SN74LS83AN (DIP-16)';
    } else {
      const comp = findComponentInCircuit(state.workingCircuit, componentId);
      if (!comp) {
        return;
      }
      label = comp.label;
    }

    const associated = findWiresAssociatedWithComponent(state.workingCircuit, componentId);
    set({
      pendingRemoval: {
        componentId,
        componentLabel: label,
        associatedWireCount: associated.length,
        cascadeWires: associated.length > 0,
      },
    });
  },

  setPendingRemovalCascade: (cascadeWires) =>
    set((state) =>
      state.pendingRemoval
        ? { pendingRemoval: { ...state.pendingRemoval, cascadeWires } }
        : {},
    ),

  confirmComponentRemoval: () => {
    const state = get();
    if (!state.pendingRemoval) {
      return false;
    }
    return get().removeComponentImmediate(state.pendingRemoval.componentId, {
      cascadeWires: state.pendingRemoval.cascadeWires,
    });
  },

  removeComponentImmediate: (componentId, options) => {
    const state = get();
    const outcome = removeComponentFromCircuit(state.workingCircuit, componentId, options);
    if (!outcome.removed) {
      set({
        pendingRemoval: null,
        editorFeedback: { tone: 'error', textEs: outcome.summaryEs },
      });
      return false;
    }

    const nextSwitchStates = { ...state.workingSwitchStates };
    for (const chId of outcome.removedSwitchChannelIds) {
      nextSwitchStates[chId] = false;
    }

    const removedWireSet = new Set(outcome.removedWireIds);
    const shouldClearSelection =
      (state.selection.kind === 'chip' && componentId === 'ic-74ls83a') ||
      (state.selection.kind === 'pin' && componentId === 'ic-74ls83a') ||
      (state.selection.kind === 'component' && state.selection.componentId === componentId) ||
      (state.selection.kind === 'wire' && removedWireSet.has(state.selection.wireId));

    set({
      undoStack: pushUndoEntry(state.undoStack, {
        circuit: state.workingCircuit,
        switchStates: state.workingSwitchStates,
        actionLabel: outcome.summaryEs,
      }),
      redoStack: [],
      workingCircuit: outcome.circuit,
      workingSwitchStates: nextSwitchStates,
      pendingRemoval: null,
      selection: shouldClearSelection ? { kind: 'none' } : state.selection,
      editorFeedback: { tone: 'info', textEs: outcome.summaryEs },
    });
    persistGuidedState(get());
    return true;
  },

  deleteSelectedElement: () => {
    const state = get();
    if (state.mode !== 'guided') {
      return;
    }
    if (state.selection.kind === 'wire') {
      get().deleteWire(state.selection.wireId);
      return;
    }
    if (state.selection.kind === 'chip' && state.workingCircuit.chip) {
      get().requestComponentRemoval(state.workingCircuit.chip.id);
      return;
    }
    if (state.selection.kind === 'component') {
      get().requestComponentRemoval(state.selection.componentId);
    }
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) {
      return false;
    }
    const previous = state.undoStack[state.undoStack.length - 1]!;
    const remainingUndo = state.undoStack.slice(0, -1);

    set({
      undoStack: remainingUndo,
      redoStack: [
        ...state.redoStack,
        {
          circuit: state.workingCircuit,
          switchStates: state.workingSwitchStates,
          actionLabel: previous.actionLabel,
        },
      ],
      workingCircuit: previous.circuit,
      workingSwitchStates: previous.switchStates,
      wireDraft: null,
      resistorAnchorHoleId: null,
      pendingRemoval: null,
      selection: { kind: 'none' },
      editorFeedback: {
        tone: 'info',
        textEs: `Deshecho: ${previous.actionLabel}`,
      },
    });
    persistGuidedState(get());
    return true;
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) {
      return false;
    }
    const nextEntry = state.redoStack[state.redoStack.length - 1]!;
    const remainingRedo = state.redoStack.slice(0, -1);

    set({
      undoStack: pushUndoEntry(state.undoStack, {
        circuit: state.workingCircuit,
        switchStates: state.workingSwitchStates,
        actionLabel: nextEntry.actionLabel,
      }),
      redoStack: remainingRedo,
      workingCircuit: nextEntry.circuit,
      workingSwitchStates: nextEntry.switchStates,
      wireDraft: null,
      resistorAnchorHoleId: null,
      pendingRemoval: null,
      selection: { kind: 'none' },
      editorFeedback: {
        tone: 'info',
        textEs: `Rehecho: ${nextEntry.actionLabel}`,
      },
    });
    persistGuidedState(get());
    return true;
  },

  resetWorkingCircuit: () =>
    set((state) => {
      const hasAnyElements =
        state.workingCircuit.chip !== null ||
        state.workingCircuit.dipSwitches.length > 0 ||
        state.workingCircuit.resistors.length > 0 ||
        state.workingCircuit.leds.length > 0 ||
        state.workingCircuit.wires.length > 0;

      if (!hasAnyElements) {
        return {
          workingSwitchStates: buildInitialSwitchStates(),
          wireDraft: null,
          resistorAnchorHoleId: null,
          pendingRemoval: null,
          selection: { kind: 'none' },
          editorFeedback: { tone: 'info', textEs: 'La protoboard ya está vacía.' },
        };
      }

      const nextState = {
        undoStack: pushUndoEntry(state.undoStack, {
          circuit: state.workingCircuit,
          switchStates: state.workingSwitchStates,
          actionLabel: 'Reiniciar montaje',
        }),
        redoStack: [],
        workingCircuit: createEmptyWorkingCircuit(),
        workingSwitchStates: buildInitialSwitchStates(),
        wireDraft: null,
        resistorAnchorHoleId: null,
        pendingRemoval: null,
        selection: { kind: 'none' },
        editorFeedback: {
          tone: 'info',
          textEs: 'Montaje reiniciado. Protoboard limpia (puedes usar Deshacer si lo deseas).',
        },
      } as const;

      return nextState;
    }),

  // =========================================================================
  // Acciones del Montaje Guiado Educativo (Fase 6)
  // =========================================================================

  setGuidedStageIndex: (index) => {
    const clamped = Math.max(0, Math.min(GUIDED_STAGES.length - 1, index));
    const state = get();
    if (clamped > state.guidedHighestUnlockedIndex) {
      return;
    }
    const targetStage = getGuidedStageByIndex(clamped);
    if (state.guidedHintLevels[clamped] === 3 && targetStage.hints.visualHighlights?.cameraPreset) {
      get().requestCameraPreset(targetStage.hints.visualHighlights.cameraPreset);
    }
    set({
      guidedCurrentStageIndex: clamped,
      wireDraft: null,
      resistorAnchorHoleId: null,
      pendingRemoval: null,
      editorFeedback: null,
    });
    persistGuidedState(get());
  },

  nextGuidedStage: () => {
    const state = get();
    if (state.guidedCurrentStageIndex < GUIDED_STAGES.length - 1) {
      const canAdvance =
        state.guidedCompletedStages[state.guidedCurrentStageIndex] ||
        state.guidedCurrentStageIndex < state.guidedHighestUnlockedIndex;
      if (canAdvance) {
        get().setGuidedStageIndex(state.guidedCurrentStageIndex + 1);
      }
    }
  },

  prevGuidedStage: () => {
    const state = get();
    if (state.guidedCurrentStageIndex > 0) {
      get().setGuidedStageIndex(state.guidedCurrentStageIndex - 1);
    }
  },

  cycleGuidedHintLevel: () => {
    const state = get();
    const currIdx = state.guidedCurrentStageIndex;
    const currLevel = state.guidedHintLevels[currIdx] ?? 0;
    const nextLevel = (currLevel + 1) % 4; // 0 -> 1 -> 2 -> 3 -> 0

    const nextHintLevels = [...state.guidedHintLevels];
    nextHintLevels[currIdx] = nextLevel;

    if (nextLevel === 3) {
      const stageDef = getGuidedStageByIndex(currIdx);
      if (stageDef.hints.visualHighlights?.cameraPreset) {
        get().requestCameraPreset(stageDef.hints.visualHighlights.cameraPreset);
      }
    }

    set({ guidedHintLevels: nextHintLevels });
    persistGuidedState(get());
  },

  setGuidedHintLevel: (stageIndex, level) => {
    const clampedIdx = Math.max(0, Math.min(GUIDED_STAGES.length - 1, stageIndex));
    const clampedLevel = Math.max(0, Math.min(3, level));
    const state = get();
    const nextLevels = [...state.guidedHintLevels];
    nextLevels[clampedIdx] = clampedLevel;

    if (clampedLevel === 3) {
      const stageDef = getGuidedStageByIndex(clampedIdx);
      if (stageDef.hints.visualHighlights?.cameraPreset) {
        get().requestCameraPreset(stageDef.hints.visualHighlights.cameraPreset);
      }
    }

    set({ guidedHintLevels: nextLevels });
    persistGuidedState(get());
  },

  answerStage1Quiz: (pairId, connected) => {
    set((state) => ({
      guidedStage1QuizAnswers: {
        ...state.guidedStage1QuizAnswers,
        [pairId]: connected,
      },
    }));
    persistGuidedState(get());
  },

  recordStage8TestedCase: (caseId) => {
    set((state) => {
      if (state.guidedStage8TestedCases.includes(caseId)) {
        return {};
      }
      return {
        guidedStage8TestedCases: [...state.guidedStage8TestedCases, caseId],
      };
    });
    persistGuidedState(get());
  },

  answerStage9Quiz: (questionId, optionIndex) => {
    set((state) => ({
      guidedStage9QuizAnswers: {
        ...state.guidedStage9QuizAnswers,
        [questionId]: optionIndex,
      },
    }));
    persistGuidedState(get());
  },

  setGuidedActiveTab: (guidedActiveTab) => set({ guidedActiveTab }),

  checkCurrentGuidedStage: () => {
    const state = get();
    const solution = solveCircuit(
      workingCircuitToSolverInput(state.workingCircuit, state.workingSwitchStates),
    );
    const ctx: GuidedValidationContext = {
      circuit: state.workingCircuit,
      switchStates: state.workingSwitchStates,
      solution,
      stage1QuizAnswers: state.guidedStage1QuizAnswers,
      stage8TestedCases: state.guidedStage8TestedCases,
      stage9QuizAnswers: state.guidedStage9QuizAnswers,
      completedStagesHistory: state.guidedCompletedStages,
    };

    const result = validateStageByIndex(state.guidedCurrentStageIndex, ctx);

    if (result.passed) {
      const nextCompleted = [...state.guidedCompletedStages];
      nextCompleted[state.guidedCurrentStageIndex] = true;
      const nextHighest = Math.max(
        state.guidedHighestUnlockedIndex,
        state.guidedCurrentStageIndex + 1,
      );
      const isFinished = nextCompleted.length === 9 && nextCompleted.every(Boolean);

      set({
        guidedCompletedStages: nextCompleted,
        guidedHighestUnlockedIndex: nextHighest,
        guidedPracticeUnlocked: isFinished || state.guidedPracticeUnlocked,
        editorFeedback: {
          tone: 'success',
          textEs: result.statusMessageEs,
        },
      });
      persistGuidedState(get());
    } else {
      set({
        editorFeedback: {
          tone: result.criticalErrorDetected ? 'error' : 'info',
          textEs: result.statusMessageEs,
        },
      });
    }

    return result;
  },

  resetGuidedTutorial: () => {
    clearGuidedStateFromStorage();
    set({
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
      wireDraft: null,
      resistorAnchorHoleId: null,
      pendingRemoval: null,
      selection: { kind: 'none' },
      editorFeedback: {
        tone: 'info',
        textEs: 'Tutorial de montaje reiniciado desde la Etapa 1.',
      },
    });
  },

  setGuidedPracticeUnlocked: (guidedPracticeUnlocked) => set({ guidedPracticeUnlocked }),
}));
