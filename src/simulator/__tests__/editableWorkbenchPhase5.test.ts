import { beforeEach, describe, expect, it } from 'vitest';
import {
  createCanonicalCircuitInput,
  POWER_SUPPLY_5V,
  resolveTerminalPosition,
  WIRE_COLORS,
} from '../../data/circuitLayout';
import {
  CARRY_IN_CHANNEL_ID,
  OPERAND_A_CHANNELS_LSB_FIRST,
  OPERAND_B_CHANNELS_LSB_FIRST,
} from '../../data/presets';
import { buildWireSplinePoints } from '../../data/wireRouting';
import { buildInitialSwitchStates, useLabStore } from '../../store/useLabStore';
import { numberToWord4 } from '../adder74ls83';
import {
  addWireToCircuit,
  createEmptyWorkingCircuit,
  placeChipInCircuit,
  placeDipSwitchInCircuit,
  placeLedInCircuit,
  placeResistorInCircuit,
  REFERENCE_CIRCUIT_STATE,
  validateChipPlacement,
  validateLedPlacement,
  validateResistorPlacement,
  validateWireConnection,
  type WorkingCircuitState,
  workingCircuitToSolverInput,
} from '../editableCircuit';
import { areComponentNetlistsEquivalent, solveCircuit } from '../netlist';

/**
 * Construye desde cero (mediante las funciones puras del taller editable) un circuito 74LS83A
 * completo con columnas desplazadas, agujeros alternativos en las mismas pistas, resistencias
 * con patas invertidas, LEDs verdes permutados y colores de cable arbitrarios.
 */
function buildShiftedCompleteWorkingCircuit(): WorkingCircuitState {
  let circuit = createEmptyWorkingCircuit();

  // 1. Integrado SN74LS83A desplazado +2 columnas respecto al canónico (col. 30..37 en vez de 28..35)
  const icRes = placeChipInCircuit(circuit, 30, 'trench');
  if (!icRes.ok) throw new Error(icRes.reasonEs);
  circuit = icRes.circuit;

  // 2. Interruptores DIP desplazados sobre el canal central
  const swARes = placeDipSwitchInCircuit(circuit, 'dip-sw-a', 5, 'trench'); // 5..8
  if (!swARes.ok) throw new Error(swARes.reasonEs);
  circuit = swARes.circuit;

  const swBRes = placeDipSwitchInCircuit(circuit, 'dip-sw-b', 12, 'trench'); // 12..15
  if (!swBRes.ok) throw new Error(swBRes.reasonEs);
  circuit = swBRes.circuit;

  const swC0Res = placeDipSwitchInCircuit(circuit, 'dip-sw-c0', 20, 'trench'); // 20
  if (!swC0Res.ok) throw new Error(swC0Res.reasonEs);
  circuit = swC0Res.circuit;

  // 3. LEDs montados en fila 'h' (en vez de 'i') y insertando los 4 LEDs verdes en orden inverso (S0..S3)
  //    para demostrar que las 4 unidades verdes del kit son eléctricamente intercambiables.
  const ledSpecs: ReadonlyArray<{
    readonly color: 'AMBER' | 'GREEN';
    readonly anode: string;
    readonly cathode: string;
  }> = [
    { color: 'AMBER', anode: 'h43', cathode: 'h44' }, // C4
    { color: 'GREEN', anode: 'h59', cathode: 'h60' }, // S0 (recibe plantilla led-s3)
    { color: 'GREEN', anode: 'h55', cathode: 'h56' }, // S1 (recibe plantilla led-s2)
    { color: 'GREEN', anode: 'h51', cathode: 'h52' }, // S2 (recibe plantilla led-s1)
    { color: 'GREEN', anode: 'h47', cathode: 'h48' }, // S3 (recibe plantilla led-s0)
  ];

  for (const spec of ledSpecs) {
    const ledRes = placeLedInCircuit(circuit, spec.color, spec.anode, spec.cathode);
    if (!ledRes.ok) throw new Error(ledRes.reasonEs);
    circuit = ledRes.circuit;
  }

  // 4. 9 resistencias pull-down de 330 Ω (alternando orden de patas leadA/leadB)
  const pullDownPairs: ReadonlyArray<readonly [string, string]> = [
    ['j5', 'rail-bottom-minus-3'],
    ['rail-bottom-minus-4', 'j6'],
    ['j7', 'rail-bottom-minus-5'],
    ['rail-bottom-minus-6', 'j8'],
    ['j12', 'rail-bottom-minus-9'],
    ['rail-bottom-minus-10', 'j13'],
    ['j14', 'rail-bottom-minus-11'],
    ['rail-bottom-minus-12', 'j15'],
    ['j20', 'rail-bottom-minus-16'],
  ];

  for (const [leadA, leadB] of pullDownPairs) {
    const rRes = placeResistorInCircuit(circuit, 330, leadA, leadB);
    if (!rRes.ok) throw new Error(rRes.reasonEs);
    circuit = rRes.circuit;
  }

  // 5. 5 resistencias limitadoras de 1 kΩ cruzando el canal central (invirtiendo f -> d en varias)
  const limiterPairs: ReadonlyArray<readonly [string, string]> = [
    ['f43', 'd43'], // C4
    ['d47', 'f47'], // S3
    ['f51', 'd51'], // S2
    ['d55', 'f55'], // S1
    ['f59', 'd59'], // S0
  ];

  for (const [leadA, leadB] of limiterPairs) {
    const rRes = placeResistorInCircuit(circuit, 1000, leadA, leadB);
    if (!rRes.ok) throw new Error(rRes.reasonEs);
    circuit = rRes.circuit;
  }

  // 6. 34 cables jumper conectando agujeros alternativos de las pistas equivalentes
  const wirePairs: ReadonlyArray<readonly [string, string, string]> = [
    // Alimentación general y puentes entre rieles
    ['psu-5v:plus', 'rail-top-plus-2', WIRE_COLORS.inputB], // Color no estándar a propósito
    ['psu-5v:gnd', 'rail-top-minus-2', WIRE_COLORS.carryIn],
    ['rail-top-plus-48', 'rail-bottom-plus-48', WIRE_COLORS.vcc],
    ['rail-top-minus-48', 'rail-bottom-minus-48', WIRE_COLORS.gnd],

    // Alimentación del 74LS83A en col. 30..37 (Pin 5 VCC = f34, Pin 12 GND = e34)
    ['rail-bottom-plus-26', 'i34', WIRE_COLORS.vcc],
    ['rail-top-minus-26', 'b34', WIRE_COLORS.gnd],

    // Alimentación +5 V a las entradas superiores de los 9 canales DIP
    ['rail-top-plus-3', 'b5', WIRE_COLORS.vcc],
    ['rail-top-plus-4', 'b6', WIRE_COLORS.vcc],
    ['rail-top-plus-5', 'b7', WIRE_COLORS.vcc],
    ['rail-top-plus-6', 'b8', WIRE_COLORS.vcc],
    ['rail-top-plus-9', 'b12', WIRE_COLORS.vcc],
    ['rail-top-plus-10', 'b13', WIRE_COLORS.vcc],
    ['rail-top-plus-11', 'b14', WIRE_COLORS.vcc],
    ['rail-top-plus-12', 'b15', WIRE_COLORS.vcc],
    ['rail-top-plus-16', 'b20', WIRE_COLORS.vcc],

    // Entradas A3..A0 -> Pines 1 (f30), 3 (f32), 8 (f37), 10 (e36)
    ['g5', 'h30', WIRE_COLORS.inputA],
    ['h6', 'g32', WIRE_COLORS.inputA],
    ['i7', 'j37', WIRE_COLORS.inputA],
    ['g8', 'c36', WIRE_COLORS.inputA],

    // Entradas B3..B0 -> Pines 16 (e30), 4 (f33), 7 (f36), 11 (e35)
    ['h12', 'c30', WIRE_COLORS.inputB],
    ['g13', 'i33', WIRE_COLORS.inputB],
    ['h14', 'g36', WIRE_COLORS.inputB],
    ['i15', 'b35', WIRE_COLORS.inputB],

    // Acarreo C0 -> Pin 13 (e33)
    ['h20', 'a33', WIRE_COLORS.carryIn],

    // Salidas C4 (e32), S3 (e31), S2 (f31), S1 (f35), S0 (e37) -> etapas de resistencias 1 kΩ
    ['b32', 'a43', WIRE_COLORS.carryOut],
    ['c31', 'b47', WIRE_COLORS.sumOut],
    ['h31', 'b51', WIRE_COLORS.sumOut],
    ['g35', 'a55', WIRE_COLORS.sumOut],
    ['b37', 'c59', WIRE_COLORS.sumOut],

    // Retornos GND de cátodos LED (cols 44, 48, 52, 56, 60)
    ['j44', 'rail-bottom-minus-35', WIRE_COLORS.gnd],
    ['j48', 'rail-bottom-minus-38', WIRE_COLORS.gnd],
    ['j52', 'rail-bottom-minus-41', WIRE_COLORS.gnd],
    ['j56', 'rail-bottom-minus-45', WIRE_COLORS.gnd],
    ['j60', 'rail-bottom-minus-49', WIRE_COLORS.gnd],
  ];

  for (const [fromTerm, toTerm, colorHex] of wirePairs) {
    const wRes = addWireToCircuit(circuit, fromTerm, toTerm, colorHex);
    if (!wRes.ok) throw new Error(`${fromTerm} -> ${toTerm}: ${wRes.reasonEs}`);
    circuit = wRes.circuit;
  }

  return circuit;
}

describe('Fase 5 — Sistema de montaje interactivo y cableado eléctrico 3D', () => {
  beforeEach(() => {
    useLabStore.setState({
      mode: 'guided',
      selection: { kind: 'none' },
      hovered: { kind: 'none' },
      tracedSignal: null,
      switchStates: buildInitialSwitchStates(),
      workingCircuit: createEmptyWorkingCircuit(),
      workingSwitchStates: buildInitialSwitchStates(),
      undoStack: [],
      redoStack: [],
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
    });
  });

  it('1. crea un cable entre contactos válidos, actualiza la netlist real y trata el color como atributo puramente visual', () => {
    const store = useLabStore.getState();

    // Usar un color azul (convención GND) para transportar +5 V: debe conducir +5 V sin alterar la física
    store.setActiveWireColor(WIRE_COLORS.gnd);
    expect(store.startWireDraft('psu-5v:plus')).toBe(true);
    expect(useLabStore.getState().wireDraft?.fromTerminalId).toBe('psu-5v:plus');

    expect(useLabStore.getState().commitWireDraft('rail-top-plus-1')).toBe(true);

    const afterWire = useLabStore.getState();
    expect(afterWire.wireDraft).toBeNull();
    expect(afterWire.workingCircuit.wires).toHaveLength(1);
    expect(afterWire.workingCircuit.wires[0]?.id).toBe('uw-1');
    expect(afterWire.workingCircuit.wires[0]?.colorHex).toBe(WIRE_COLORS.gnd);

    const solved = solveCircuit(
      workingCircuitToSolverInput(afterWire.workingCircuit, afterWire.workingSwitchStates),
    );
    const railNetId = solved.terminalToNetId['rail-top-plus-25']!;
    expect(solved.nets[railNetId]?.drive).toBe('STRONG_HIGH');
    expect(solved.nets[railNetId]?.logicLevel).toBe(1);

    // También genera una trayectoria spline 3D válida libre de NaN
    const createdWire = afterWire.workingCircuit.wires[0]!;
    const startPos = resolveTerminalPosition(createdWire.fromTerminalId)!;
    const endPos = resolveTerminalPosition(createdWire.toTerminalId)!;
    const spline = buildWireSplinePoints(createdWire.id, startPos, endPos, {
      chip: afterWire.workingCircuit.chip,
      dipSwitches: afterWire.workingCircuit.dipSwitches,
      leds: afterWire.workingCircuit.leds,
    });
    expect(spline.length).toBeGreaterThanOrEqual(4);
  });

  it('2. elimina un cable existente, reconecta extremos y actualiza de inmediato la netlist', () => {
    const store = useLabStore.getState();
    store.startWireDraft('psu-5v:plus');
    store.commitWireDraft('rail-top-plus-1');

    // Reconectar el extremo destino de rail-top-plus-1 hacia rail-bottom-plus-1
    expect(useLabStore.getState().beginWireReconnect('uw-1', 'from')).toBe(true);
    expect(useLabStore.getState().commitWireDraft('rail-bottom-plus-1')).toBe(true);

    const reconnectedState = useLabStore.getState();
    const solvedReconnected = solveCircuit(
      workingCircuitToSolverInput(
        reconnectedState.workingCircuit,
        reconnectedState.workingSwitchStates,
      ),
    );
    expect(
      solvedReconnected.nets[solvedReconnected.terminalToNetId['rail-top-plus-1']!]?.drive,
    ).toBe('FLOATING');
    expect(
      solvedReconnected.nets[solvedReconnected.terminalToNetId['rail-bottom-plus-10']!]?.drive,
    ).toBe('STRONG_HIGH');

    // Eliminar definitivamente el cable
    expect(useLabStore.getState().deleteWire('uw-1')).toBe(true);
    const afterDelete = useLabStore.getState();
    expect(afterDelete.workingCircuit.wires).toHaveLength(0);

    const solvedAfterDelete = solveCircuit(
      workingCircuitToSolverInput(afterDelete.workingCircuit, afterDelete.workingSwitchStates),
    );
    expect(
      solvedAfterDelete.nets[solvedAfterDelete.terminalToNetId['rail-bottom-plus-10']!]?.drive,
    ).toBe('FLOATING');
  });

  it('3. cancela el tendido de un cable antes de confirmar sin modificar la netlist ni dejar residuos', () => {
    const store = useLabStore.getState();
    expect(store.startWireDraft('psu-5v:plus')).toBe(true);
    store.updateWireDraftCursor({ x: 0.5, y: 0.92, z: -1.2 }, 'a30');
    expect(useLabStore.getState().wireDraft?.candidateTerminalId).toBe('a30');

    // Cancelar con Escape / cancelActiveOperation
    useLabStore.getState().cancelActiveOperation();

    const cancelled = useLabStore.getState();
    expect(cancelled.wireDraft).toBeNull();
    expect(cancelled.workingCircuit.wires).toHaveLength(0);
    expect(cancelled.undoStack).toHaveLength(0);

    const solved = solveCircuit(
      workingCircuitToSolverInput(cancelled.workingCircuit, cancelled.workingSwitchStates),
    );
    expect(solved.nets[solved.terminalToNetId['a30']!]?.drive).toBe('FLOATING');
  });

  it('4. rechaza terminales inexistentes o degenerados al cablear o insertar componentes', () => {
    const empty = createEmptyWorkingCircuit();

    expect(validateWireConnection(empty, 'z99', 'a1').code).toBe('INVALID_TERMINAL');
    expect(validateWireConnection(empty, 'a1', 'rail-top-plus-999').code).toBe('INVALID_TERMINAL');
    expect(validateWireConnection(empty, 'a10', 'a10').code).toBe('SAME_TERMINAL');

    expect(validateLedPlacement(empty, 'led-s0', 'z1', 'z2').code).toBe('INVALID_TERMINAL');
    expect(validateResistorPlacement(empty, 'r-pd-a0', 'psu-5v:plus', 'a1').code).toBe(
      'INVALID_TERMINAL',
    );
    expect(validateResistorPlacement(empty, 'r-pd-a0', 'a5', 'e5').code).toBe('SAME_STRIP');

    const store = useLabStore.getState();
    expect(store.startWireDraft('nodo-inexistente')).toBe(false);
    expect(useLabStore.getState().wireDraft).toBeNull();
    expect(useLabStore.getState().placeLedAt('GREEN', 'z1', 'z2')).toBe(false);
    expect(useLabStore.getState().placeResistorBetween(330, 'psu-5v:plus', 'a1')).toBe(false);
  });

  it('5. detecta agujeros ocupados e impide insertar dos terminales en la misma perforación permitiendo pistas vecinas', () => {
    const store = useLabStore.getState();
    expect(store.placeChipAtColumn(28, 'trench')).toBe(true); // Ocupa e28..e35 y f28..f35

    // Intentar iniciar o terminar un cable en f28 (Pin 1 ocupado) debe fallar con HOLE_OCCUPIED
    const checkBusyPin = validateWireConnection(
      useLabStore.getState().workingCircuit,
      'a1',
      'f28',
    );
    expect(checkBusyPin.valid).toBe(false);
    expect(checkBusyPin.code).toBe('HOLE_OCCUPIED');
    expect(useLabStore.getState().startWireDraft('f28')).toBe(false);

    // Intentar insertar resistencia o LED sobre un pin ocupado también falla
    expect(useLabStore.getState().placeResistorBetween(330, 'f28', 'f24')).toBe(false);
    expect(useLabStore.getState().placeLedAt('GREEN', 'e28', 'e29')).toBe(false);

    // En cambio, g28 pertenece a la misma pista eléctrica que f28 pero su perforación está libre
    expect(useLabStore.getState().startWireDraft('a4')).toBe(true);
    expect(useLabStore.getState().commitWireDraft('g28')).toBe(true);

    // Ahora g28 también está ocupado por uw-1; un segundo cable hacia g28 se rechaza
    expect(
      validateWireConnection(useLabStore.getState().workingCircuit, 'a5', 'g28').code,
    ).toBe('HOLE_OCCUPIED');
  });

  it('6. valida colocaciones válidas e inválidas del integrado 74LS83A DIP-16', () => {
    const empty = createEmptyWorkingCircuit();

    // Fuera de columnas (requiere 8 columnas dentro de 1..63 -> inicio máximo en 56)
    expect(validateChipPlacement(empty, 0, 'trench').code).toBe('OUT_OF_BOUNDS');
    expect(validateChipPlacement(empty, 57, 'trench').code).toBe('OUT_OF_BOUNDS');

    // Fuera de la ranura central
    expect(validateChipPlacement(empty, 28, 'off-trench').code).toBe('INVALID_TRENCH_ALIGNMENT');

    // Colisión con agujero ocupado por cable
    const withWire = addWireToCircuit(empty, 'a1', 'e30', WIRE_COLORS.inputA);
    expect(withWire.ok).toBe(true);
    if (withWire.ok) {
      expect(validateChipPlacement(withWire.circuit, 28, 'trench').code).toBe('HOLE_OCCUPIED');
    }

    // Colisión física con interruptor DIP en el canal central
    const withDip = placeDipSwitchInCircuit(empty, 'dip-sw-a', 26, 'trench'); // 26..29
    expect(withDip.ok).toBe(true);
    if (withDip.ok) {
      expect(validateChipPlacement(withDip.circuit, 28, 'trench').code).toBe('HOLE_OCCUPIED');
    }

    // Inserción válida en columna 28 y rechazo de un segundo 74LS83A (KIT_EXHAUSTED)
    const store = useLabStore.getState();
    expect(store.placeChipAtColumn(28, 'trench')).toBe(true);
    expect(useLabStore.getState().workingCircuit.chip?.startColumn).toBe(28);
    expect(
      validateChipPlacement(useLabStore.getState().workingCircuit, 40, 'trench').code,
    ).toBe('KIT_EXHAUSTED');
    expect(useLabStore.getState().placeChipAtColumn(40, 'trench')).toBe(false);
  });

  it('7. gestiona la eliminación de componentes con cables asociados (con y sin cascada) preservando puentes globales', () => {
    const store = useLabStore.getState();
    store.placeChipAtColumn(28, 'trench');

    // Puente global entre rieles (no pertenece a ninguna pista local del chip)
    store.startWireDraft('rail-top-plus-50');
    store.commitWireDraft('rail-bottom-plus-50'); // uw-1

    // Dos cables conectados a pistas locales del 74LS83A (col 28 y col 32)
    store.startWireDraft('a4');
    store.commitWireDraft('h28'); // uw-2
    store.startWireDraft('rail-bottom-plus-25');
    store.commitWireDraft('j32'); // uw-3

    // Solicitar retirada con confirmación y cascada activa
    useLabStore.getState().requestComponentRemoval('ic-74ls83a');
    expect(useLabStore.getState().pendingRemoval?.associatedWireCount).toBe(2);
    expect(useLabStore.getState().pendingRemoval?.cascadeWires).toBe(true);
    expect(useLabStore.getState().confirmComponentRemoval()).toBe(true);

    // Deben haberse retirado el chip y sus 2 cables locales, conservando el puente global uw-1
    expect(useLabStore.getState().workingCircuit.chip).toBeNull();
    expect(useLabStore.getState().workingCircuit.wires.map((w) => w.id)).toEqual(['uw-1']);

    // Deshacer y probar retirada SIN cascada (conservando cables sobre la protoboard)
    expect(useLabStore.getState().undo()).toBe(true);
    expect(useLabStore.getState().workingCircuit.wires).toHaveLength(3);

    useLabStore.getState().requestComponentRemoval('ic-74ls83a');
    useLabStore.getState().setPendingRemovalCascade(false);
    expect(useLabStore.getState().confirmComponentRemoval()).toBe(true);

    expect(useLabStore.getState().workingCircuit.chip).toBeNull();
    expect(useLabStore.getState().workingCircuit.wires).toHaveLength(3);
  });

  it('8. conserva intactos el resto de componentes, cables y estados de interruptores entre operaciones', () => {
    const store = useLabStore.getState();
    store.placeDipSwitchAtColumn('dip-sw-a', 4, 'trench');
    store.placeDipSwitchAtColumn('dip-sw-b', 10, 'trench');
    store.setSwitchState('sw-a3', true);
    store.setSwitchState('sw-b1', true);

    store.placeLedAt('AMBER', 'i41', 'i42');
    store.startWireDraft('psu-5v:plus');
    store.commitWireDraft('rail-top-plus-1');

    // Retirar únicamente dip-sw-b no debe alterar dip-sw-a, sw-a3, el LED ni el cable
    useLabStore.getState().removeComponentImmediate('dip-sw-b', { cascadeWires: true });

    const current = useLabStore.getState();
    expect(current.workingCircuit.dipSwitches.map((s) => s.id)).toEqual(['dip-sw-a']);
    expect(current.workingSwitchStates['sw-a3']).toBe(true);
    expect(current.workingCircuit.leds).toHaveLength(1);
    expect(current.workingCircuit.wires).toHaveLength(1);
  });

  it('9. deshace y rehace secuencias completas de edición restaurando el circuito y la netlist exactos', () => {
    const store = useLabStore.getState();

    store.placeChipAtColumn(28, 'trench'); // Acción 1
    store.placeDipSwitchAtColumn('dip-sw-c0', 17, 'trench'); // Acción 2
    store.startWireDraft('psu-5v:plus');
    store.commitWireDraft('rail-top-plus-1'); // Acción 3 (uw-1)
    store.deleteWire('uw-1'); // Acción 4

    expect(useLabStore.getState().undoStack).toHaveLength(4);
    expect(useLabStore.getState().workingCircuit.wires).toHaveLength(0);

    // Undo Acción 4 -> restaura el cable uw-1 y energiza el riel superior
    expect(useLabStore.getState().undo()).toBe(true);
    expect(useLabStore.getState().workingCircuit.wires).toHaveLength(1);
    const solvedAfterUndo1 = solveCircuit(
      workingCircuitToSolverInput(
        useLabStore.getState().workingCircuit,
        useLabStore.getState().workingSwitchStates,
      ),
    );
    expect(
      solvedAfterUndo1.nets[solvedAfterUndo1.terminalToNetId['rail-top-plus-10']!]?.drive,
    ).toBe('STRONG_HIGH');

    // Undo Acción 3, 2, 1 -> vuelve a protoboard completamente vacía
    expect(useLabStore.getState().undo()).toBe(true);
    expect(useLabStore.getState().undo()).toBe(true);
    expect(useLabStore.getState().undo()).toBe(true);
    expect(useLabStore.getState().undo()).toBe(false); // Pila agotada
    expect(useLabStore.getState().workingCircuit.chip).toBeNull();
    expect(useLabStore.getState().workingCircuit.dipSwitches).toHaveLength(0);

    // Redo de las 3 primeras acciones -> recupera chip, DIP-1 y cable uw-1 energizado
    expect(useLabStore.getState().redo()).toBe(true);
    expect(useLabStore.getState().redo()).toBe(true);
    expect(useLabStore.getState().redo()).toBe(true);
    expect(useLabStore.getState().workingCircuit.chip?.startColumn).toBe(28);
    expect(useLabStore.getState().workingCircuit.dipSwitches).toHaveLength(1);
    expect(useLabStore.getState().workingCircuit.wires).toHaveLength(1);
  });

  it('10. mantiene aislamiento total entre el circuito montado de referencia y el circuito editable de trabajo', () => {
    const store = useLabStore.getState();

    // En modo guiado modificamos intensivamente workingCircuit y workingSwitchStates
    store.placeChipAtColumn(40, 'trench');
    store.setOperandA(13);
    store.setPowerSupplyOn(false);
    store.startWireDraft('psu-5v:plus');
    store.commitWireDraft('psu-5v:gnd'); // Incluso provocamos un corto en el circuito editable

    const guidedState = useLabStore.getState();
    const guidedSolution = solveCircuit(
      workingCircuitToSolverInput(guidedState.workingCircuit, guidedState.workingSwitchStates),
    );
    expect(guidedSolution.hasSupplyShortCircuit).toBe(true);

    // El circuito canónico de referencia y sus estados de modo montado permanecen 100% intactos
    expect(REFERENCE_CIRCUIT_STATE.chip?.startColumn).toBe(28);
    expect(REFERENCE_CIRCUIT_STATE.wires).toHaveLength(34);
    expect(guidedState.switchStates[POWER_SUPPLY_5V.id]).toBe(true);

    const mountedSolution = solveCircuit(createCanonicalCircuitInput(guidedState.switchStates));
    expect(mountedSolution.isHealthy).toBe(true);
    expect(mountedSolution.hasSupplyShortCircuit).toBe(false);
    expect(mountedSolution.adderOutput?.totalValue).toBe(0);

    // Reiniciar el montaje editable tampoco afecta al circuito montado
    useLabStore.getState().resetWorkingCircuit();
    expect(useLabStore.getState().workingCircuit.wires).toHaveLength(0);
    expect(REFERENCE_CIRCUIT_STATE.wires).toHaveLength(34);
  });

  it('11. actualiza salidas y diagnósticos al conectar/desconectar VCC, GND, resistencias serie o provocar cortos', () => {
    const baseCircuit = buildShiftedCompleteWorkingCircuit();
    const switches7Plus1: Record<string, boolean> = {
      ...buildInitialSwitchStates(),
      'sw-a2': true,
      'sw-a1': true,
      'sw-a0': true, // A = 7
      'sw-b0': true, // B = 1
    };

    // Circuito completo saludable: 7 + 1 = 8 (S3 = 1)
    const healthy = solveCircuit(workingCircuitToSolverInput(baseCircuit, switches7Plus1));
    expect(healthy.isHealthy).toBe(true);
    expect(healthy.adderOutput?.totalValue).toBe(8);

    // 11a. Desconectar el cable de VCC al Pin 5 (i34) -> IC_VCC_DISCONNECTED y adderOutput = null
    const withoutIcVcc: WorkingCircuitState = {
      ...baseCircuit,
      wires: baseCircuit.wires.filter((w) => w.toTerminalId !== 'i34'),
    };
    const solvedNoVcc = solveCircuit(workingCircuitToSolverInput(withoutIcVcc, switches7Plus1));
    expect(solvedNoVcc.isChipPowered).toBe(false);
    expect(solvedNoVcc.adderOutput).toBeNull();
    expect(solvedNoVcc.diagnostics.some((d) => d.code === 'IC_VCC_DISCONNECTED')).toBe(true);
    expect(Object.values(solvedNoVcc.leds).every((l) => !l.isLit)).toBe(true);

    // 11b. Desconectar el cable de GND al Pin 12 (b34) -> IC_GND_DISCONNECTED
    const withoutIcGnd: WorkingCircuitState = {
      ...baseCircuit,
      wires: baseCircuit.wires.filter((w) => w.toTerminalId !== 'b34'),
    };
    const solvedNoGnd = solveCircuit(workingCircuitToSolverInput(withoutIcGnd, switches7Plus1));
    expect(solvedNoGnd.isChipPowered).toBe(false);
    expect(solvedNoGnd.adderOutput).toBeNull();
    expect(solvedNoGnd.diagnostics.some((d) => d.code === 'IC_GND_DISCONNECTED')).toBe(true);

    // 11c. Cortocircuito directo entre riel +5 V y riel GND -> SHORT_CIRCUIT_SUPPLY
    const shortedRes = addWireToCircuit(
      baseCircuit,
      'rail-top-plus-20',
      'rail-top-minus-20',
      WIRE_COLORS.vcc,
    );
    expect(shortedRes.ok).toBe(true);
    if (shortedRes.ok) {
      const solvedShort = solveCircuit(
        workingCircuitToSolverInput(shortedRes.circuit, switches7Plus1),
      );
      expect(solvedShort.hasSupplyShortCircuit).toBe(true);
      expect(solvedShort.adderOutput).toBeNull();
      expect(solvedShort.diagnostics.some((d) => d.code === 'SHORT_CIRCUIT_SUPPLY')).toBe(true);
    }

    // 11d. Conectar salida S3 directamente al ánodo del LED sin resistencia limitadora -> LED_WITHOUT_RESISTOR
    const noLimiterResistors = baseCircuit.resistors.filter(
      (r) => !(r.leadAHoleId === 'd47' && r.leadBHoleId === 'f47'),
    );
    const wiresDirectToLed = baseCircuit.wires.map((w) =>
      w.toTerminalId === 'b47' ? { ...w, toTerminalId: 'g47' } : w,
    );
    const solvedNoRes = solveCircuit(
      workingCircuitToSolverInput(
        { ...baseCircuit, resistors: noLimiterResistors, wires: wiresDirectToLed },
        switches7Plus1,
      ),
    );
    expect(solvedNoRes.diagnostics.some((d) => d.code === 'LED_WITHOUT_RESISTOR')).toBe(true);
    const s3LedAtCol47 = baseCircuit.leds.find((l) => l.anodeHoleId === 'h47')!;
    expect(solvedNoRes.leds[s3LedAtCol47.id]?.isLit).toBe(false);
  });

  it('12. garantiza ausencia total de conexiones fantasma al retirar interruptores activos o componentes', () => {
    const store = useLabStore.getState();
    store.placeDipSwitchAtColumn('dip-sw-a', 4, 'trench');
    store.setSwitchState('sw-a3', true); // Cierra continuidad entre e4 y f4

    const solvedWithSwitch = solveCircuit(
      workingCircuitToSolverInput(
        useLabStore.getState().workingCircuit,
        useLabStore.getState().workingSwitchStates,
      ),
    );
    expect(solvedWithSwitch.terminalToNetId['e4']).toBe(solvedWithSwitch.terminalToNetId['f4']);

    // Retirar dip-sw-a debe abrir inmediatamente e4 y f4 y reiniciar sw-a3 a false
    expect(useLabStore.getState().removeComponentImmediate('dip-sw-a')).toBe(true);
    expect(useLabStore.getState().workingSwitchStates['sw-a3']).toBe(false);

    const solvedAfterRemoval = solveCircuit(
      workingCircuitToSolverInput(
        useLabStore.getState().workingCircuit,
        useLabStore.getState().workingSwitchStates,
      ),
    );
    expect(solvedAfterRemoval.terminalToNetId['e4']).not.toBe(
      solvedAfterRemoval.terminalToNetId['f4'],
    );
  });

  it('13. demuestra equivalencia eléctrica de netlist y coincidencia exacta en las 512 combinaciones entre el circuito de referencia y un montaje desplazado construido desde cero', () => {
    const builtCircuit = buildShiftedCompleteWorkingCircuit();
    const initialSwitches = buildInitialSwitchStates();

    const refNeutralInput = workingCircuitToSolverInput(REFERENCE_CIRCUIT_STATE, initialSwitches);
    const workNeutralInput = workingCircuitToSolverInput(builtCircuit, initialSwitches);

    // Equivalencia estructural de netlist invariante a columnas, orden de patas de resistencias y permutación de LEDs verdes
    expect(areComponentNetlistsEquivalent(refNeutralInput, workNeutralInput)).toBe(true);

    // Comprobar las 512 combinaciones posibles (A = 0..15, B = 0..15, C0 = 0..1)
    for (let a = 0; a <= 15; a += 1) {
      const aBits = numberToWord4(a);
      for (let b = 0; b <= 15; b += 1) {
        const bBits = numberToWord4(b);
        for (const c0 of [0, 1] as const) {
          const switches: Record<string, boolean> = {
            [POWER_SUPPLY_5V.id]: true,
            [OPERAND_A_CHANNELS_LSB_FIRST[0]]: aBits[0] === 1,
            [OPERAND_A_CHANNELS_LSB_FIRST[1]]: aBits[1] === 1,
            [OPERAND_A_CHANNELS_LSB_FIRST[2]]: aBits[2] === 1,
            [OPERAND_A_CHANNELS_LSB_FIRST[3]]: aBits[3] === 1,
            [OPERAND_B_CHANNELS_LSB_FIRST[0]]: bBits[0] === 1,
            [OPERAND_B_CHANNELS_LSB_FIRST[1]]: bBits[1] === 1,
            [OPERAND_B_CHANNELS_LSB_FIRST[2]]: bBits[2] === 1,
            [OPERAND_B_CHANNELS_LSB_FIRST[3]]: bBits[3] === 1,
            [CARRY_IN_CHANNEL_ID]: c0 === 1,
          };

          const refSolved = solveCircuit(
            workingCircuitToSolverInput(REFERENCE_CIRCUIT_STATE, switches),
          );
          const workSolved = solveCircuit(workingCircuitToSolverInput(builtCircuit, switches));

          expect(workSolved.isHealthy).toBe(true);
          expect(workSolved.adderOutput?.totalValue).toBe(a + b + c0);
          expect(workSolved.adderOutput?.sumBits).toEqual(refSolved.adderOutput?.sumBits);
          expect(workSolved.adderOutput?.carryOut).toBe(refSolved.adderOutput?.carryOut);

          // Verificar estado encendido/apagado de cada uno de los 5 indicadores LED físicos por su posición
          const ledC4Id = builtCircuit.leds.find((l) => l.anodeHoleId === 'h43')!.id;
          const ledS3Id = builtCircuit.leds.find((l) => l.anodeHoleId === 'h47')!.id;
          const ledS2Id = builtCircuit.leds.find((l) => l.anodeHoleId === 'h51')!.id;
          const ledS1Id = builtCircuit.leds.find((l) => l.anodeHoleId === 'h55')!.id;
          const ledS0Id = builtCircuit.leds.find((l) => l.anodeHoleId === 'h59')!.id;

          expect(workSolved.leds[ledC4Id]?.isLit).toBe(refSolved.leds['led-c4']?.isLit);
          expect(workSolved.leds[ledS3Id]?.isLit).toBe(refSolved.leds['led-s3']?.isLit);
          expect(workSolved.leds[ledS2Id]?.isLit).toBe(refSolved.leds['led-s2']?.isLit);
          expect(workSolved.leds[ledS1Id]?.isLit).toBe(refSolved.leds['led-s1']?.isLit);
          expect(workSolved.leds[ledS0Id]?.isLit).toBe(refSolved.leds['led-s0']?.isLit);
        }
      }
    }
  });
});
