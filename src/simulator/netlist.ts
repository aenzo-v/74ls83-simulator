import {
  type Adder74LS83Output,
  type BitValue,
  CARRY_IN_PIN,
  CARRY_OUT_PIN,
  evaluate74LS83Logic,
  GND_PIN,
  INPUT_A_PINS,
  INPUT_B_PINS,
  SUM_OUTPUT_PINS,
  VCC_PIN,
  type Word4Bits,
} from './adder74ls83';
import { ALL_BREADBOARD_HOLES, getHoleById } from './breadboard';
import type {
  DipSwitchDescriptor,
  LedDescriptor,
  PowerSupplyDescriptor,
  ResistorDescriptor,
} from './components';
import type { ElectricalDiagnostic } from './diagnostics';
import { getDip16PinHoleId, PINOUT_74LS83A } from './pinout74ls83';
import type { PinNumber, SignalCode } from './types';

/**
 * Motor de conectividad eléctrica, resolución de netlist y diagnóstico para el circuito 74LS83A.
 * TypeScript puro, sin dependencias de React ni Three.js.
 */

export type NetDriveState =
  | 'STRONG_HIGH'
  | 'STRONG_LOW'
  | 'WEAK_HIGH'
  | 'WEAK_LOW'
  | 'IC_HIGH'
  | 'IC_LOW'
  | 'UNPOWERED'
  | 'FLOATING'
  | 'SHORT_CIRCUIT'
  | 'CONFLICT';

export type LogicLevelResolved = 0 | 1 | null;

export interface PlacedChip74LS83 {
  readonly id: string;
  readonly startColumn: number;
  readonly notchOrientation: 'LEFT';
}

export interface WireConnection {
  readonly id: string;
  readonly fromTerminalId: string;
  readonly toTerminalId: string;
  readonly label?: string;
  readonly signal?: SignalCode;
}

export interface CircuitSolverInput {
  readonly powerSupply: PowerSupplyDescriptor;
  readonly isPowerSupplyOn: boolean;
  readonly chip: PlacedChip74LS83 | null;
  readonly dipSwitches: readonly DipSwitchDescriptor[];
  readonly switchStates: Readonly<Record<string, boolean>>;
  readonly resistors: readonly ResistorDescriptor[];
  readonly leds: readonly LedDescriptor[];
  readonly wires: readonly WireConnection[];
}

export interface ElectricalNet {
  readonly id: string;
  readonly terminals: readonly string[];
  readonly stripIds: readonly string[];
  readonly wireIds: readonly string[];
  readonly connectedComponentLabels: readonly string[];
  readonly drive: NetDriveState;
  readonly logicLevel: LogicLevelResolved;
  readonly summaryLabel: string;
}

export interface ResolvedPinState {
  readonly pinNumber: PinNumber;
  readonly signal: SignalCode;
  readonly holeId: string | null;
  readonly netId: string | null;
  readonly drive: NetDriveState;
  readonly logicLevel: LogicLevelResolved;
}

export interface ResolvedLedState {
  readonly ledId: string;
  readonly signal: SignalCode;
  readonly anodeNetId: string | null;
  readonly cathodeNetId: string | null;
  readonly isProperlyWired: boolean;
  /**
   * Red que alimenta la etapa indicadora (salida del 74LS83A o +5 V) cuando el LED está
   * correctamente cableado; `null` en caso contrario. Permite identificar qué señal enciende
   * físicamente cada LED sin depender de su etiqueta de plantilla.
   */
  readonly driverNetId: string | null;
  readonly isLit: boolean;
  readonly statusLabel: string;
}

export interface ResolvedWireState {
  readonly wireId: string;
  readonly fromTerminalId: string;
  readonly toTerminalId: string;
  readonly isValidEndpoints: boolean;
  readonly isDangling: boolean;
  readonly netId: string | null;
  readonly drive: NetDriveState;
  readonly logicLevel: LogicLevelResolved;
}

export interface CircuitSolution {
  readonly nets: Readonly<Record<string, ElectricalNet>>;
  readonly terminalToNetId: Readonly<Record<string, string>>;
  readonly pins: Readonly<Record<PinNumber, ResolvedPinState>>;
  readonly leds: Readonly<Record<string, ResolvedLedState>>;
  readonly wires: Readonly<Record<string, ResolvedWireState>>;
  readonly isPowerSupplyOn: boolean;
  readonly hasSupplyShortCircuit: boolean;
  readonly isChipPowered: boolean;
  readonly areAllInputsValid: boolean;
  readonly adderOutput: Adder74LS83Output | null;
  readonly diagnostics: readonly ElectricalDiagnostic[];
  readonly isHealthy: boolean;
}

class DisjointSet {
  private readonly parent = new Map<string, string>();

  add(item: string): void {
    if (!this.parent.has(item)) {
      this.parent.set(item, item);
    }
  }

  has(item: string): boolean {
    return this.parent.has(item);
  }

  find(item: string): string {
    const p = this.parent.get(item);
    if (p === undefined) {
      throw new Error(`Terminal desconocido en grafo de conectividad: ${item}`);
    }
    if (p === item) {
      return item;
    }
    const root = this.find(p);
    this.parent.set(item, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      if (rootA < rootB) {
        this.parent.set(rootB, rootA);
      } else {
        this.parent.set(rootA, rootB);
      }
    }
  }

  allItems(): IterableIterator<string> {
    return this.parent.keys();
  }
}

function driveToLogicLevel(drive: NetDriveState): LogicLevelResolved {
  switch (drive) {
    case 'STRONG_HIGH':
    case 'WEAK_HIGH':
    case 'IC_HIGH':
      return 1;
    case 'STRONG_LOW':
    case 'WEAK_LOW':
    case 'IC_LOW':
      return 0;
    case 'UNPOWERED':
    case 'FLOATING':
    case 'SHORT_CIRCUIT':
    case 'CONFLICT':
      return null;
  }
}

function driveToSpanishSummary(drive: NetDriveState): string {
  switch (drive) {
    case 'STRONG_HIGH':
      return 'Alimentación +5.0 V (VCC)';
    case 'STRONG_LOW':
      return 'Referencia 0 V (GND)';
    case 'WEAK_HIGH':
      return 'Nivel ALTO (1) vía resistencia pull-up';
    case 'WEAK_LOW':
      return 'Nivel BAJO (0) vía pull-down 330 Ω';
    case 'IC_HIGH':
      return 'Salida TTL en nivel ALTO (1)';
    case 'IC_LOW':
      return 'Salida TTL en nivel BAJO (0)';
    case 'UNPOWERED':
      return 'Sin alimentación activa (Fuente en STBY)';
    case 'FLOATING':
      return 'Nodo flotante / sin conducción';
    case 'SHORT_CIRCUIT':
      return 'Cortocircuito o contención de red';
    case 'CONFLICT':
      return 'Conflicto eléctrico indeterminado';
  }
}

function incrementCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function appendLabel(map: Map<string, string[]>, key: string, label: string): void {
  const list = map.get(key);
  if (list) {
    list.push(label);
  } else {
    map.set(key, [label]);
  }
}

/**
 * Resuelve íntegramente la conectividad eléctrica de la protoboard, alimentación,
 * interruptores, resistencias, lógica del 74LS83A, salidas LED y diagnósticos.
 */
export function solveCircuit(input: CircuitSolverInput): CircuitSolution {
  const diagnostics: ElectricalDiagnostic[] = [];
  const dsu = new DisjointSet();

  // 1. Registrar todos los contactos reales de la protoboard y unir cada pista interna
  const firstHoleByStrip = new Map<string, string>();
  for (const hole of ALL_BREADBOARD_HOLES) {
    dsu.add(hole.id);
    const firstInStrip = firstHoleByStrip.get(hole.stripId);
    if (firstInStrip !== undefined) {
      dsu.union(firstInStrip, hole.id);
    } else {
      firstHoleByStrip.set(hole.stripId, hole.id);
    }
  }

  // Registrar bornes de la fuente de alimentación
  const plusTermId = input.powerSupply.plusTerminalId;
  const gndTermId = input.powerSupply.gndTerminalId;
  dsu.add(plusTermId);
  dsu.add(gndTermId);

  // Contabilizar inserciones por pista y etiquetas de componentes por terminal para diagnóstico
  const stripAttachmentCount = new Map<string, number>();
  const terminalComponentLabels = new Map<string, string[]>();

  const registerComponentTerminal = (termId: string, label: string) => {
    if (!dsu.has(termId)) {
      return;
    }
    appendLabel(terminalComponentLabels, termId, label);
    const hole = getHoleById(termId);
    if (hole) {
      incrementCount(stripAttachmentCount, hole.stripId);
    }
  };

  registerComponentTerminal(plusTermId, 'Fuente +5 V');
  registerComponentTerminal(gndTermId, 'Fuente GND');

  // Validar emplazamiento del 74LS83A
  const pinHoleByNumber = new Map<PinNumber, string>();
  const isChipPlacementValid =
    input.chip !== null &&
    input.chip.startColumn >= 1 &&
    input.chip.startColumn + 7 <= 63;

  if (!isChipPlacementValid) {
    diagnostics.push({
      code: 'IC_MISSING',
      severity: 'ERROR',
      title: 'Integrado 74LS83A ausente o fuera de rango',
      message:
        'El circuito integrado SN74LS83A no está correctamente insertado sobre el canal central de la protoboard.',
    });
  } else if (input.chip) {
    for (const spec of PINOUT_74LS83A) {
      const holeId = getDip16PinHoleId(spec.pinNumber, input.chip.startColumn);
      if (dsu.has(holeId)) {
        pinHoleByNumber.set(spec.pinNumber, holeId);
        registerComponentTerminal(holeId, `74LS83A Pin ${spec.pinNumber} (${spec.signal})`);
      }
    }
  }

  // Registrar interruptores DIP y cerrar continuidad cuando su canal está en ON
  for (const sw of input.dipSwitches) {
    for (const ch of sw.channels) {
      registerComponentTerminal(ch.inputHoleId, `Interruptor ${ch.signal} (entrada)`);
      registerComponentTerminal(ch.outputHoleId, `Interruptor ${ch.signal} (salida)`);
      if (Boolean(input.switchStates[ch.id]) && dsu.has(ch.inputHoleId) && dsu.has(ch.outputHoleId)) {
        dsu.union(ch.inputHoleId, ch.outputHoleId);
      }
    }
  }

  // Registrar resistencias (sus terminales no se unen en corto cero; propagan nivel resistivo después)
  for (const res of input.resistors) {
    registerComponentTerminal(res.leadAHoleId, `${res.label} (${res.formattedValue})`);
    registerComponentTerminal(res.leadBHoleId, `${res.label} (${res.formattedValue})`);
  }

  // Registrar LEDs
  for (const led of input.leds) {
    registerComponentTerminal(led.anodeHoleId, `${led.label} (Ánodo +)`);
    registerComponentTerminal(led.cathodeHoleId, `${led.label} (Cátodo −)`);
  }

  // Validar y unir cables jumper
  const validWires: WireConnection[] = [];
  const invalidWireIds = new Set<string>();

  for (const wire of input.wires) {
    const fromValid = dsu.has(wire.fromTerminalId);
    const toValid = dsu.has(wire.toTerminalId);
    const nonDegenerate = wire.fromTerminalId !== wire.toTerminalId;

    if (!fromValid || !toValid || !nonDegenerate) {
      invalidWireIds.add(wire.id);
      diagnostics.push({
        code: 'INVALID_TERMINAL',
        severity: 'ERROR',
        title: 'Terminal de cable inválido',
        message: !nonDegenerate
          ? `El cable ${wire.id} intenta conectar el mismo contacto (${wire.fromTerminalId}) consigo mismo.`
          : `El cable ${wire.id} referencia un terminal inexistente (${wire.fromTerminalId} → ${wire.toTerminalId}).`,
        relatedWireIds: [wire.id],
        relatedTerminals: [wire.fromTerminalId, wire.toTerminalId],
      });
      continue;
    }

    validWires.push(wire);
    dsu.union(wire.fromTerminalId, wire.toTerminalId);

    const fromHole = getHoleById(wire.fromTerminalId);
    if (fromHole) {
      incrementCount(stripAttachmentCount, fromHole.stripId);
    }
    const toHole = getHoleById(wire.toTerminalId);
    if (toHole) {
      incrementCount(stripAttachmentCount, toHole.stripId);
    }
  }

  // 2. Agrupar raíces del DSU en redes eléctricas con identificadores estables y legibles
  const membersByRoot = new Map<string, string[]>();
  for (const term of dsu.allItems()) {
    const root = dsu.find(term);
    const arr = membersByRoot.get(root);
    if (arr) {
      arr.push(term);
    } else {
      membersByRoot.set(root, [term]);
    }
  }

  const plusRoot = dsu.find(plusTermId);
  const gndRoot = dsu.find(gndTermId);
  const hasSupplyShortCircuit = plusRoot === gndRoot;

  // Asignar nombres de red deterministas
  const rootToNetId = new Map<string, string>();
  const usedNetIds = new Set<string>();

  const claimNetId = (root: string, preferredId: string) => {
    if (rootToNetId.has(root)) {
      return;
    }
    let candidate = preferredId;
    let suffix = 2;
    while (usedNetIds.has(candidate)) {
      candidate = `${preferredId}-${suffix}`;
      suffix += 1;
    }
    usedNetIds.add(candidate);
    rootToNetId.set(root, candidate);
  };

  if (hasSupplyShortCircuit) {
    claimNetId(plusRoot, 'NET-CORTO-VCC-GND');
  } else {
    claimNetId(plusRoot, 'NET-VCC');
    claimNetId(gndRoot, 'NET-GND');
  }

  for (const spec of PINOUT_74LS83A) {
    const holeId = pinHoleByNumber.get(spec.pinNumber);
    if (holeId) {
      claimNetId(dsu.find(holeId), `NET-${spec.signal}`);
    }
  }

  for (const led of input.leds) {
    if (dsu.has(led.anodeHoleId)) {
      claimNetId(dsu.find(led.anodeHoleId), `NET-ANODO-${led.signal}`);
    }
    if (dsu.has(led.cathodeHoleId)) {
      claimNetId(dsu.find(led.cathodeHoleId), `NET-CATODO-${led.signal}`);
    }
  }

  const sortedRoots = [...membersByRoot.keys()].sort();
  for (const root of sortedRoots) {
    if (!rootToNetId.has(root)) {
      const hole = getHoleById(root);
      const base = hole ? `NET-${hole.stripId}` : `NET-${root}`;
      claimNetId(root, base);
    }
  }

  const terminalToNetId: Record<string, string> = {};
  const terminalsByNetId = new Map<string, string[]>();
  const stripsByNetId = new Map<string, Set<string>>();
  const labelsByNetId = new Map<string, Set<string>>();
  const wiresByNetId = new Map<string, string[]>();

  for (const [root, terms] of membersByRoot.entries()) {
    const netId = rootToNetId.get(root)!;
    const sortedTerms = [...terms].sort();
    terminalsByNetId.set(netId, sortedTerms);

    const stripSet = new Set<string>();
    const labelSet = new Set<string>();

    for (const t of sortedTerms) {
      terminalToNetId[t] = netId;
      const hole = getHoleById(t);
      if (hole) {
        stripSet.add(hole.stripId);
      }
      const compLabels = terminalComponentLabels.get(t);
      if (compLabels) {
        for (const lbl of compLabels) {
          labelSet.add(lbl);
        }
      }
    }

    stripsByNetId.set(netId, stripSet);
    labelsByNetId.set(netId, labelSet);
    wiresByNetId.set(netId, []);
  }

  // Detectar cables desconectados (extremo abierto en pista sin otros contactos o red aislada)
  const danglingWireIds = new Set<string>();
  for (const wire of validWires) {
    const netId = terminalToNetId[wire.fromTerminalId]!;
    wiresByNetId.get(netId)?.push(wire.id);

    const fromHole = getHoleById(wire.fromTerminalId);
    const toHole = getHoleById(wire.toTerminalId);
    const fromOpen =
      fromHole !== undefined && (stripAttachmentCount.get(fromHole.stripId) ?? 0) <= 1;
    const toOpen =
      toHole !== undefined && (stripAttachmentCount.get(toHole.stripId) ?? 0) <= 1;
    const netHasComponents = (labelsByNetId.get(netId)?.size ?? 0) > 0;

    if (fromOpen || toOpen || !netHasComponents) {
      danglingWireIds.add(wire.id);
      const openTerms: string[] = [];
      if (fromOpen) openTerms.push(wire.fromTerminalId);
      if (toOpen) openTerms.push(wire.toTerminalId);
      diagnostics.push({
        code: 'DISCONNECTED_WIRE',
        severity: 'WARNING',
        title: 'Cable jumper desconectado o con extremo abierto',
        message: `El cable ${wire.label ?? wire.id} (${wire.fromTerminalId} → ${wire.toTerminalId}) tiene un extremo sin continuidad hacia ningún componente.`,
        signal: wire.signal,
        relatedWireIds: [wire.id],
        relatedTerminals: openTerms.length > 0 ? openTerms : [wire.fromTerminalId, wire.toTerminalId],
      });
    }
  }

  // 3. Inicializar conducción de redes: alimentación y cortocircuitos globales
  const driveByNetId = new Map<string, NetDriveState>();
  const plusNetId = terminalToNetId[plusTermId]!;
  const gndNetId = terminalToNetId[gndTermId]!;

  for (const netId of terminalsByNetId.keys()) {
    driveByNetId.set(netId, input.isPowerSupplyOn ? 'FLOATING' : 'UNPOWERED');
  }

  if (hasSupplyShortCircuit) {
    driveByNetId.set(plusNetId, 'SHORT_CIRCUIT');
    diagnostics.push({
      code: 'SHORT_CIRCUIT_SUPPLY',
      severity: 'ERROR',
      title: 'Cortocircuito directo entre +5 V (VCC) y GND',
      message:
        'Existe un camino metálico de impedancia nula entre el borne positivo (+5 V) y la referencia GND. La alimentación se bloquea por protección.',
      relatedWireIds: wiresByNetId.get(plusNetId) ?? [],
      relatedTerminals: [plusTermId, gndTermId],
    });
  } else if (!input.isPowerSupplyOn) {
    diagnostics.push({
      code: 'POWER_SUPPLY_OFF',
      severity: 'WARNING',
      title: 'Falta de alimentación (+5 V en espera)',
      message:
        'La fuente regulada de +5.0 V CC está en modo espera (STBY). Enciéndela para energizar el circuito.',
      relatedComponentIds: [input.powerSupply.id],
    });
  } else {
    driveByNetId.set(plusNetId, 'STRONG_HIGH');
    driveByNetId.set(gndNetId, 'STRONG_LOW');
  }

  // 4. Propagar polarización débil a través de resistencias (pull-down / pull-up)
  if (input.isPowerSupplyOn && !hasSupplyShortCircuit) {
    const weakHighCandidates = new Set<string>();
    const weakLowCandidates = new Set<string>();

    for (const res of input.resistors) {
      if (!dsu.has(res.leadAHoleId) || !dsu.has(res.leadBHoleId)) {
        continue;
      }
      const netA = terminalToNetId[res.leadAHoleId]!;
      const netB = terminalToNetId[res.leadBHoleId]!;
      if (netA === netB) {
        continue;
      }

      const driveA = driveByNetId.get(netA);
      const driveB = driveByNetId.get(netB);

      if (driveA === 'STRONG_HIGH' && driveB === 'FLOATING') {
        weakHighCandidates.add(netB);
      } else if (driveB === 'STRONG_HIGH' && driveA === 'FLOATING') {
        weakHighCandidates.add(netA);
      }

      if (driveA === 'STRONG_LOW' && driveB === 'FLOATING') {
        weakLowCandidates.add(netB);
      } else if (driveB === 'STRONG_LOW' && driveA === 'FLOATING') {
        weakLowCandidates.add(netA);
      }
    }

    for (const netId of weakHighCandidates) {
      if (weakLowCandidates.has(netId)) {
        driveByNetId.set(netId, 'CONFLICT');
      } else {
        driveByNetId.set(netId, 'WEAK_HIGH');
      }
    }
    for (const netId of weakLowCandidates) {
      if (!weakHighCandidates.has(netId)) {
        driveByNetId.set(netId, 'WEAK_LOW');
      }
    }
  }

  // 5. Evaluar alimentación, entradas, contenciones y suma digital del 74LS83A
  let isChipPowered = false;
  let areAllInputsValid = false;
  let adderOutput: Adder74LS83Output | null = null;

  if (isChipPlacementValid) {
    const vccHole = pinHoleByNumber.get(VCC_PIN)!;
    const gndHole = pinHoleByNumber.get(GND_PIN)!;
    const vccNetId = terminalToNetId[vccHole]!;
    const gndPinNetId = terminalToNetId[gndHole]!;

    // Comprobar inversión de polaridad en pines 5 y 12
    const reversedPower =
      !hasSupplyShortCircuit && (vccNetId === gndNetId || gndPinNetId === plusNetId);

    if (reversedPower) {
      diagnostics.push({
        code: 'IC_REVERSE_POLARITY',
        severity: 'ERROR',
        title: 'Polaridad invertida en alimentación del 74LS83A',
        message:
          'El Pin 5 (VCC) o el Pin 12 (GND) están conectados al riel opuesto. En un circuito real esto dañaría el integrado.',
        relatedPins: [VCC_PIN, GND_PIN],
        relatedTerminals: [vccHole, gndHole],
      });
    } else if (!hasSupplyShortCircuit) {
      if (vccNetId !== plusNetId) {
        diagnostics.push({
          code: 'IC_VCC_DISCONNECTED',
          severity: 'ERROR',
          title: 'Pin 5 (VCC) desconectado de +5 V',
          message:
            'El Pin 5 del SN74LS83A no tiene continuidad directa hacia el borne positivo (+5 V) de la fuente.',
          signal: 'VCC',
          relatedPins: [VCC_PIN],
          relatedTerminals: [vccHole],
        });
      }
      if (gndPinNetId !== gndNetId) {
        diagnostics.push({
          code: 'IC_GND_DISCONNECTED',
          severity: 'ERROR',
          title: 'Pin 12 (GND) desconectado de tierra',
          message:
            'El Pin 12 del SN74LS83A no tiene continuidad directa hacia la referencia GND (0 V).',
          signal: 'GND',
          relatedPins: [GND_PIN],
          relatedTerminals: [gndHole],
        });
      }
    }

    isChipPowered =
      input.isPowerSupplyOn &&
      !hasSupplyShortCircuit &&
      !reversedPower &&
      vccNetId === plusNetId &&
      gndPinNetId === gndNetId;

    // Verificar conexiones cruzadas o erróneas en pines de entrada respecto a canales DIP
    const switchSignalsByOutputNet = new Map<string, SignalCode[]>();
    for (const sw of input.dipSwitches) {
      for (const ch of sw.channels) {
        if (dsu.has(ch.outputHoleId)) {
          const outNet = terminalToNetId[ch.outputHoleId]!;
          appendLabel(switchSignalsByOutputNet, outNet, ch.signal);
        }
      }
    }

    const outputPinsList: readonly PinNumber[] = [...SUM_OUTPUT_PINS, CARRY_OUT_PIN];
    const outputNetToPins = new Map<string, PinNumber[]>();
    for (const outPin of outputPinsList) {
      const h = pinHoleByNumber.get(outPin)!;
      const nId = terminalToNetId[h]!;
      const existing = outputNetToPins.get(nId);
      if (existing) {
        existing.push(outPin);
      } else {
        outputNetToPins.set(nId, [outPin]);
      }
    }

    const inputPinsSpecs = PINOUT_74LS83A.filter((p) => p.direction === 'INPUT');
    for (const pinSpec of inputPinsSpecs) {
      const h = pinHoleByNumber.get(pinSpec.pinNumber)!;
      const nId = terminalToNetId[h]!;

      // ¿Entrada conectada erróneamente a un canal de interruptor de otra señal?
      const swSignals = switchSignalsByOutputNet.get(nId);
      if (swSignals && !swSignals.includes(pinSpec.signal)) {
        diagnostics.push({
          code: 'WRONG_PIN_CONNECTION',
          severity: 'WARNING',
          title: `Conexión cruzada en Pin ${pinSpec.pinNumber} (${pinSpec.signal})`,
          message: `El Pin ${pinSpec.pinNumber} corresponde a ${pinSpec.signal}, pero está conectado al interruptor de ${swSignals.join(', ')}.`,
          signal: pinSpec.signal,
          relatedPins: [pinSpec.pinNumber],
          relatedTerminals: [h],
        });
      }

      // ¿Entrada conectada directamente a una salida del mismo integrado?
      if (outputNetToPins.has(nId)) {
        diagnostics.push({
          code: 'WRONG_PIN_CONNECTION',
          severity: 'ERROR',
          title: `Realimentación inválida en Pin ${pinSpec.pinNumber} (${pinSpec.signal})`,
          message: `La entrada ${pinSpec.signal} está unida directamente a una salida del propio 74LS83A.`,
          signal: pinSpec.signal,
          relatedPins: [pinSpec.pinNumber, ...(outputNetToPins.get(nId) ?? [])],
          relatedTerminals: [h],
        });
      }
    }

    // Evaluar niveles lógicos de las 9 entradas cuando el integrado recibe alimentación válida
    if (isChipPowered) {
      const resolvedInputBitByPin = new Map<PinNumber, BitValue>();
      let allDefined = true;

      for (const pinSpec of inputPinsSpecs) {
        const h = pinHoleByNumber.get(pinSpec.pinNumber)!;
        const nId = terminalToNetId[h]!;
        const netDrive = driveByNetId.get(nId) ?? 'FLOATING';
        const bit = driveToLogicLevel(netDrive);

        if (bit === null) {
          allDefined = false;
          diagnostics.push({
            code: netDrive === 'CONFLICT' ? 'WRONG_PIN_CONNECTION' : 'FLOATING_INPUT',
            severity: 'ERROR',
            title:
              netDrive === 'CONFLICT'
                ? `Conflicto eléctrico en entrada ${pinSpec.signal} (Pin ${pinSpec.pinNumber})`
                : `Entrada flotante en ${pinSpec.signal} (Pin ${pinSpec.pinNumber})`,
            message:
              netDrive === 'CONFLICT'
                ? `El nodo del Pin ${pinSpec.pinNumber} presenta polarizaciones opuestas simultáneas.`
                : `El Pin ${pinSpec.pinNumber} (${pinSpec.signal}) carece de camino válido a +5 V o GND (cable ausente o sin resistencia pull-down).`,
            signal: pinSpec.signal,
            relatedPins: [pinSpec.pinNumber],
            relatedTerminals: [h],
          });
        } else {
          resolvedInputBitByPin.set(pinSpec.pinNumber, bit);
        }
      }

      areAllInputsValid = allDefined;

      // Comprobar contenciones en las 5 salidas (corto contra VCC, GND u otra salida)
      const contendedOutputNets = new Set<string>();
      for (const [outNetId, pinsOnNet] of outputNetToPins.entries()) {
        const existingDrive = driveByNetId.get(outNetId);
        const shortedToRail =
          existingDrive === 'STRONG_HIGH' || existingDrive === 'STRONG_LOW';
        const shortedToOtherOutput = pinsOnNet.length > 1;

        if (shortedToRail || shortedToOtherOutput) {
          contendedOutputNets.add(outNetId);
          driveByNetId.set(outNetId, 'SHORT_CIRCUIT');
          diagnostics.push({
            code: 'OUTPUT_CONTENTION',
            severity: 'ERROR',
            title: 'Cortocircuito o contención en salida del 74LS83A',
            message: shortedToRail
              ? `La salida en Pin ${pinsOnNet.join(', ')} está cortocircuitada directamente a un riel de alimentación.`
              : `Las salidas en Pines ${pinsOnNet.join(' y ')} están unidas entre sí provocando contención lógica.`,
            relatedPins: pinsOnNet,
            relatedWireIds: wiresByNetId.get(outNetId) ?? [],
          });
        }
      }

      if (areAllInputsValid) {
        const aWord: Word4Bits = [
          resolvedInputBitByPin.get(INPUT_A_PINS[0])!,
          resolvedInputBitByPin.get(INPUT_A_PINS[1])!,
          resolvedInputBitByPin.get(INPUT_A_PINS[2])!,
          resolvedInputBitByPin.get(INPUT_A_PINS[3])!,
        ];
        const bWord: Word4Bits = [
          resolvedInputBitByPin.get(INPUT_B_PINS[0])!,
          resolvedInputBitByPin.get(INPUT_B_PINS[1])!,
          resolvedInputBitByPin.get(INPUT_B_PINS[2])!,
          resolvedInputBitByPin.get(INPUT_B_PINS[3])!,
        ];
        const c0Bit = resolvedInputBitByPin.get(CARRY_IN_PIN)!;

        adderOutput = evaluate74LS83Logic({ a: aWord, b: bWord, c0: c0Bit });

        // Conducir redes de salida S0..S3 y C4 (salvo que presenten contención)
        SUM_OUTPUT_PINS.forEach((pinNum, bitIdx) => {
          const outHole = pinHoleByNumber.get(pinNum)!;
          const outNetId = terminalToNetId[outHole]!;
          if (!contendedOutputNets.has(outNetId)) {
            const bitVal = adderOutput!.sumBits[bitIdx];
            driveByNetId.set(outNetId, bitVal === 1 ? 'IC_HIGH' : 'IC_LOW');
          }
        });

        const c4Hole = pinHoleByNumber.get(CARRY_OUT_PIN)!;
        const c4NetId = terminalToNetId[c4Hole]!;
        if (!contendedOutputNets.has(c4NetId)) {
          driveByNetId.set(c4NetId, adderOutput.carryOut === 1 ? 'IC_HIGH' : 'IC_LOW');
        }
      }
    } else if (!hasSupplyShortCircuit) {
      // Incluso sin alimentación activa, detectar contención estructural en salidas (p.ej. salida unida a GND/VCC)
      for (const spec of PINOUT_74LS83A) {
        if (spec.direction !== 'OUTPUT') continue;
        const h = pinHoleByNumber.get(spec.pinNumber)!;
        const nId = terminalToNetId[h]!;
        if (nId === plusNetId || nId === gndNetId) {
          diagnostics.push({
            code: 'OUTPUT_CONTENTION',
            severity: 'ERROR',
            title: `Salida ${spec.signal} (Pin ${spec.pinNumber}) unida directamente a riel`,
            message: `El Pin ${spec.pinNumber} (${spec.signal}) está conectado directamente a VCC o GND sin etapa intermedia.`,
            signal: spec.signal,
            relatedPins: [spec.pinNumber],
            relatedTerminals: [h],
          });
        }
      }
    }
  }

  // Propagar niveles de salida IC a través de resistencias limitadoras para inspección de ánodos LED
  if (input.isPowerSupplyOn && !hasSupplyShortCircuit) {
    for (const res of input.resistors) {
      if (!dsu.has(res.leadAHoleId) || !dsu.has(res.leadBHoleId)) continue;
      const netA = terminalToNetId[res.leadAHoleId]!;
      const netB = terminalToNetId[res.leadBHoleId]!;
      if (netA === netB) continue;

      const dA = driveByNetId.get(netA);
      const dB = driveByNetId.get(netB);

      if ((dA === 'IC_HIGH' || dA === 'IC_LOW') && dB === 'FLOATING') {
        driveByNetId.set(netB, dA === 'IC_HIGH' ? 'WEAK_HIGH' : 'WEAK_LOW');
      } else if ((dB === 'IC_HIGH' || dB === 'IC_LOW') && dA === 'FLOATING') {
        driveByNetId.set(netA, dB === 'IC_HIGH' ? 'WEAK_HIGH' : 'WEAK_LOW');
      }
    }
  }

  // 6. Evaluar etapas indicadoras LED y diagnosticar salidas no conducidas
  const resistorNeighbors = new Map<string, Set<string>>();
  for (const res of input.resistors) {
    if (!dsu.has(res.leadAHoleId) || !dsu.has(res.leadBHoleId)) continue;
    const netA = terminalToNetId[res.leadAHoleId]!;
    const netB = terminalToNetId[res.leadBHoleId]!;
    if (netA === netB) continue;
    if (!resistorNeighbors.has(netA)) resistorNeighbors.set(netA, new Set());
    if (!resistorNeighbors.has(netB)) resistorNeighbors.set(netB, new Set());
    resistorNeighbors.get(netA)!.add(netB);
    resistorNeighbors.get(netB)!.add(netA);
  }

  const outputNetIds = new Map<string, PinNumber>();
  if (isChipPlacementValid) {
    for (const outPin of [...SUM_OUTPUT_PINS, CARRY_OUT_PIN]) {
      const h = pinHoleByNumber.get(outPin)!;
      outputNetIds.set(terminalToNetId[h]!, outPin);
    }
  }

  const drivenOutputNets = new Set<string>();
  const resolvedLeds: Record<string, ResolvedLedState> = {};

  const isSourceNet = (netId: string) =>
    !hasSupplyShortCircuit && (netId === plusNetId || outputNetIds.has(netId));

  for (const led of input.leds) {
    if (!dsu.has(led.anodeHoleId) || !dsu.has(led.cathodeHoleId)) {
      resolvedLeds[led.id] = {
        ledId: led.id,
        signal: led.signal,
        anodeNetId: null,
        cathodeNetId: null,
        isProperlyWired: false,
        driverNetId: null,
        isLit: false,
        statusLabel: 'Terminales inválidos',
      };
      continue;
    }

    const anodeNet = terminalToNetId[led.anodeHoleId]!;
    const cathodeNet = terminalToNetId[led.cathodeHoleId]!;

    if (anodeNet === cathodeNet) {
      resolvedLeds[led.id] = {
        ledId: led.id,
        signal: led.signal,
        anodeNetId: anodeNet,
        cathodeNetId: cathodeNet,
        isProperlyWired: false,
        driverNetId: null,
        isLit: false,
        statusLabel: 'Ánodo y cátodo en cortocircuito en la misma pista',
      };
      continue;
    }

    // Caso erróneo 1: LED directo entre fuente/salida y GND sin resistencia en serie
    if (isSourceNet(anodeNet) && cathodeNet === gndNetId) {
      diagnostics.push({
        code: 'LED_WITHOUT_RESISTOR',
        severity: 'ERROR',
        title: `LED ${led.signal} conectado sin resistencia limitadora`,
        message: `El ${led.label} está conectado directamente entre la señal y GND sin resistencia en serie, excediendo la corriente admisible.`,
        signal: led.signal,
        relatedComponentIds: [led.id],
        relatedTerminals: [led.anodeHoleId, led.cathodeHoleId],
      });
      resolvedLeds[led.id] = {
        ledId: led.id,
        signal: led.signal,
        anodeNetId: anodeNet,
        cathodeNetId: cathodeNet,
        isProperlyWired: false,
        driverNetId: null,
        isLit: false,
        statusLabel: 'Error: sin resistencia limitadora',
      };
      continue;
    }

    // Caso válido A (canónico): Fuente/Salida -> Resistencia -> Ánodo LED, y Cátodo LED -> GND
    let upstreamDriverNet: string | undefined;
    if (cathodeNet === gndNetId) {
      const neighbors = resistorNeighbors.get(anodeNet);
      if (neighbors) {
        for (const nb of neighbors) {
          if (isSourceNet(nb)) {
            upstreamDriverNet = nb;
            break;
          }
        }
      }
    }

    // Caso válido B (equivalente serie): Fuente/Salida -> Ánodo LED, y Cátodo LED -> Resistencia -> GND
    if (!upstreamDriverNet && isSourceNet(anodeNet)) {
      const cathodeNeighbors = resistorNeighbors.get(cathodeNet);
      if (cathodeNeighbors?.has(gndNetId)) {
        upstreamDriverNet = anodeNet;
      }
    }

    if (upstreamDriverNet) {
      if (outputNetIds.has(upstreamDriverNet)) {
        drivenOutputNets.add(upstreamDriverNet);
      }
      const driverDrive = driveByNetId.get(upstreamDriverNet) ?? 'UNPOWERED';
      const isLit =
        input.isPowerSupplyOn &&
        !hasSupplyShortCircuit &&
        (driverDrive === 'IC_HIGH' || driverDrive === 'STRONG_HIGH');

      resolvedLeds[led.id] = {
        ledId: led.id,
        signal: led.signal,
        anodeNetId: anodeNet,
        cathodeNetId: cathodeNet,
        isProperlyWired: true,
        driverNetId: upstreamDriverNet,
        isLit,
        statusLabel: !input.isPowerSupplyOn
          ? 'Apagado (sin alimentación)'
          : isLit
            ? 'Encendido (Nivel ALTO)'
            : 'Apagado (Nivel BAJO)',
      };
      continue;
    }

    // Comprobar polaridad invertida (Cátodo hacia señal/resistencia de señal y Ánodo hacia GND)
    let reversedUpstream = false;
    if (anodeNet === gndNetId) {
      if (isSourceNet(cathodeNet)) {
        reversedUpstream = true;
      } else {
        const cathNeighbors = resistorNeighbors.get(cathodeNet);
        if (cathNeighbors) {
          for (const nb of cathNeighbors) {
            if (isSourceNet(nb)) {
              reversedUpstream = true;
              break;
            }
          }
        }
      }
    }

    if (reversedUpstream) {
      diagnostics.push({
        code: 'LED_REVERSE_POLARITY',
        severity: 'ERROR',
        title: `Polaridad invertida en ${led.label}`,
        message: `El cátodo (−) de ${led.label} recibe la señal mientras el ánodo (+) va a GND; el diodo queda en polarización inversa y no ilumina.`,
        signal: led.signal,
        relatedComponentIds: [led.id],
        relatedTerminals: [led.anodeHoleId, led.cathodeHoleId],
      });
      resolvedLeds[led.id] = {
        ledId: led.id,
        signal: led.signal,
        anodeNetId: anodeNet,
        cathodeNetId: cathodeNet,
        isProperlyWired: false,
        driverNetId: null,
        isLit: false,
        statusLabel: 'Polaridad invertida',
      };
      continue;
    }

    resolvedLeds[led.id] = {
      ledId: led.id,
      signal: led.signal,
      anodeNetId: anodeNet,
      cathodeNetId: cathodeNet,
      isProperlyWired: false,
      driverNetId: null,
      isLit: false,
      statusLabel: 'Circuito indicador incompleto',
    };
  }

  // Diagnosticar salidas del 74LS83A que no conducen ninguna etapa indicadora válida
  if (isChipPlacementValid && !hasSupplyShortCircuit) {
    for (const [outNetId, pinNum] of outputNetIds.entries()) {
      if (!drivenOutputNets.has(outNetId)) {
        const spec = PINOUT_74LS83A.find((p) => p.pinNumber === pinNum)!;
        const h = pinHoleByNumber.get(pinNum)!;
        diagnostics.push({
          code: 'UNDRIVEN_OUTPUT',
          severity: 'WARNING',
          title: `Salida ${spec.signal} (Pin ${pinNum}) no conducida`,
          message: `La salida ${spec.signal} del 74LS83A no dispone de una trayectoria cerrada válida (cable → resistencia serie → LED → GND).`,
          signal: spec.signal,
          relatedPins: [pinNum],
          relatedTerminals: [h],
        });
      }
    }
  }

  // 7. Construir registros finales inmutables de redes, pines y cables
  const netsRecord: Record<string, ElectricalNet> = {};
  for (const [netId, terms] of terminalsByNetId.entries()) {
    const drive = driveByNetId.get(netId) ?? 'FLOATING';
    netsRecord[netId] = {
      id: netId,
      terminals: terms,
      stripIds: [...(stripsByNetId.get(netId) ?? [])].sort(),
      wireIds: wiresByNetId.get(netId) ?? [],
      connectedComponentLabels: [...(labelsByNetId.get(netId) ?? [])].sort(),
      drive,
      logicLevel: driveToLogicLevel(drive),
      summaryLabel: driveToSpanishSummary(drive),
    };
  }

  const pinsRecord = {} as Record<PinNumber, ResolvedPinState>;
  for (const spec of PINOUT_74LS83A) {
    const holeId = pinHoleByNumber.get(spec.pinNumber) ?? null;
    const netId = holeId ? (terminalToNetId[holeId] ?? null) : null;
    const drive = netId ? (driveByNetId.get(netId) ?? 'FLOATING') : 'FLOATING';
    pinsRecord[spec.pinNumber] = {
      pinNumber: spec.pinNumber,
      signal: spec.signal,
      holeId,
      netId,
      drive,
      logicLevel: driveToLogicLevel(drive),
    };
  }

  const wiresRecord: Record<string, ResolvedWireState> = {};
  for (const wire of input.wires) {
    if (invalidWireIds.has(wire.id)) {
      wiresRecord[wire.id] = {
        wireId: wire.id,
        fromTerminalId: wire.fromTerminalId,
        toTerminalId: wire.toTerminalId,
        isValidEndpoints: false,
        isDangling: true,
        netId: null,
        drive: 'FLOATING',
        logicLevel: null,
      };
      continue;
    }
    const netId = terminalToNetId[wire.fromTerminalId] ?? null;
    const drive = netId ? (driveByNetId.get(netId) ?? 'FLOATING') : 'FLOATING';
    wiresRecord[wire.id] = {
      wireId: wire.id,
      fromTerminalId: wire.fromTerminalId,
      toTerminalId: wire.toTerminalId,
      isValidEndpoints: true,
      isDangling: danglingWireIds.has(wire.id),
      netId,
      drive,
      logicLevel: driveToLogicLevel(drive),
    };
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'ERROR');
  const isHealthy =
    !hasErrors &&
    diagnostics.length === 0 &&
    isChipPowered &&
    areAllInputsValid &&
    adderOutput !== null;

  return {
    nets: netsRecord,
    terminalToNetId,
    pins: pinsRecord,
    leds: resolvedLeds,
    wires: wiresRecord,
    isPowerSupplyOn: input.isPowerSupplyOn,
    hasSupplyShortCircuit,
    isChipPowered,
    areAllInputsValid,
    adderOutput,
    diagnostics,
    isHealthy,
  };
}

/**
 * Extrae una huella topológica canónica (invariante ante permutación de resistencias de igual
 * valor, inversión de patas de resistencias no polarizadas, intercambio de LEDs del mismo color
 * y elección de distintos agujeros dentro de una misma pista o riel).
 */
export function extractComponentNetSignature(input: CircuitSolverInput): readonly string[] {
  const neutralInput: CircuitSolverInput = {
    ...input,
    isPowerSupplyOn: true,
    switchStates: {},
  };
  const solved = solveCircuit(neutralInput);

  const resolveNet = (termId: string, fallbackTag: string): string =>
    solved.terminalToNetId[termId] ?? `UNBOUND:${fallbackTag}`;

  const anchorPortsByNet = new Map<string, string[]>();
  const addAnchor = (netId: string, label: string) => {
    const list = anchorPortsByNet.get(netId);
    if (list) {
      list.push(label);
    } else {
      anchorPortsByNet.set(netId, [label]);
    }
  };

  const activeNets = new Set<string>();

  const psuPlusNet = resolveNet(input.powerSupply.plusTerminalId, 'PSU:+5V');
  const psuGndNet = resolveNet(input.powerSupply.gndTerminalId, 'PSU:GND');
  addAnchor(psuPlusNet, 'PSU:+5V');
  addAnchor(psuGndNet, 'PSU:GND');
  activeNets.add(psuPlusNet);
  activeNets.add(psuGndNet);

  if (input.chip) {
    for (const spec of PINOUT_74LS83A) {
      const holeId = getDip16PinHoleId(spec.pinNumber, input.chip.startColumn);
      const pinNet = resolveNet(holeId, `IC:PIN${spec.pinNumber}`);
      addAnchor(pinNet, `IC:PIN${spec.pinNumber}(${spec.signal})`);
      activeNets.add(pinNet);
    }
  }

  const switchRecords: Array<{ id: string; netA: string; netB: string }> = [];
  for (const sw of input.dipSwitches) {
    for (const ch of sw.channels) {
      const nIn = resolveNet(ch.inputHoleId, `SW:${ch.id}:IN`);
      const nOut = resolveNet(ch.outputHoleId, `SW:${ch.id}:OUT`);
      addAnchor(nIn, `SW:${ch.id}`);
      addAnchor(nOut, `SW:${ch.id}`);
      activeNets.add(nIn);
      activeNets.add(nOut);
      switchRecords.push({ id: ch.id, netA: nIn, netB: nOut });
    }
  }

  const resistorRecords: Array<{ ohms: number; netA: string; netB: string }> = [];
  for (const res of input.resistors) {
    const nA = resolveNet(res.leadAHoleId, `R:${res.id}:A`);
    const nB = resolveNet(res.leadBHoleId, `R:${res.id}:B`);
    activeNets.add(nA);
    activeNets.add(nB);
    resistorRecords.push({ ohms: res.ohms, netA: nA, netB: nB });
  }

  const ledRecords: Array<{ color: string; anodeNet: string; cathodeNet: string }> = [];
  for (const led of input.leds) {
    const nAnode = resolveNet(led.anodeHoleId, `LED:${led.id}:A`);
    const nCathode = resolveNet(led.cathodeHoleId, `LED:${led.id}:C`);
    activeNets.add(nAnode);
    activeNets.add(nCathode);
    ledRecords.push({ color: led.color, anodeNet: nAnode, cathodeNet: nCathode });
  }

  // Etiquetado inicial de redes activas + 2 rondas de refinamiento estructural determinista (WL)
  let labelByNet = new Map<string, string>();
  for (const netId of activeNets) {
    const anchors = anchorPortsByNet.get(netId);
    labelByNet.set(
      netId,
      anchors && anchors.length > 0 ? `ANCHOR(${[...anchors].sort().join(',')})` : 'INTERNAL',
    );
  }

  for (let round = 0; round < 2; round += 1) {
    const nextLabels = new Map<string, string>();
    for (const netId of activeNets) {
      const incidentTokens: string[] = [];
      for (const r of resistorRecords) {
        if (r.netA === netId) {
          incidentTokens.push(`R(${r.ohms}):${labelByNet.get(r.netB)!}`);
        } else if (r.netB === netId) {
          incidentTokens.push(`R(${r.ohms}):${labelByNet.get(r.netA)!}`);
        }
      }
      for (const l of ledRecords) {
        if (l.anodeNet === netId) {
          incidentTokens.push(`LED_A(${l.color})->${labelByNet.get(l.cathodeNet)!}`);
        }
        if (l.cathodeNet === netId) {
          incidentTokens.push(`LED_C(${l.color})<-${labelByNet.get(l.anodeNet)!}`);
        }
      }
      incidentTokens.sort();
      nextLabels.set(netId, `${labelByNet.get(netId)!}[${incidentTokens.join(';')}]`);
    }
    labelByNet = nextLabels;
  }

  const tokens: string[] = [];

  for (const netId of activeNets) {
    tokens.push(`NET:${labelByNet.get(netId)!}`);
  }
  for (const sw of switchRecords) {
    const endpoints = [labelByNet.get(sw.netA)!, labelByNet.get(sw.netB)!].sort();
    tokens.push(`SW:${sw.id}:${endpoints[0]}<->${endpoints[1]}`);
  }
  for (const r of resistorRecords) {
    const endpoints = [labelByNet.get(r.netA)!, labelByNet.get(r.netB)!].sort();
    tokens.push(`RES:${r.ohms}:${endpoints[0]}<->${endpoints[1]}`);
  }
  for (const l of ledRecords) {
    tokens.push(
      `LED:${l.color}:${labelByNet.get(l.anodeNet)!}->${labelByNet.get(l.cathodeNet)!}`,
    );
  }

  return tokens.sort();
}

export function areComponentNetlistsEquivalent(
  inputA: CircuitSolverInput,
  inputB: CircuitSolverInput,
): boolean {
  const sigA = extractComponentNetSignature(inputA);
  const sigB = extractComponentNetSignature(inputB);
  if (sigA.length !== sigB.length) {
    return false;
  }
  return sigA.every((entry, idx) => entry === sigB[idx]);
}
