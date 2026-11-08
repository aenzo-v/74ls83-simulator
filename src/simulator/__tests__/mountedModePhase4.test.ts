import { beforeEach, describe, expect, it } from 'vitest';
import { createCanonicalCircuitInput, POWER_SUPPLY_5V } from '../../data/circuitLayout';
import { doesPresetMatchSwitches, QUICK_ADDITION_PRESETS } from '../../data/presets';
import { buildInitialSwitchStates, useLabStore } from '../../store/useLabStore';
import { evaluate74LS83Logic, numberToWord4 } from '../adder74ls83';
import { areComponentNetlistsEquivalent, solveCircuit } from '../netlist';
import { PINOUT_74LS83A } from '../pinout74ls83';
import { traceSignalPath } from '../signalTrace';

describe('Fase 4 — Modo Circuito Montado interactivo, desglose binario y trazado de señales', () => {
  beforeEach(() => {
    useLabStore.setState({
      mode: 'mounted',
      selection: { kind: 'chip' },
      hovered: { kind: 'none' },
      tracedSignal: null,
      switchStates: buildInitialSwitchStates(),
    });
  });

  it('1. verifica el desglose columna por columna, acarreos intermedios (C0..C4) y formatos DEC/BIN/HEX en las 512 combinaciones', () => {
    for (let a = 0; a <= 15; a += 1) {
      for (let b = 0; b <= 15; b += 1) {
        for (const c0 of [0, 1] as const) {
          const out = evaluate74LS83Logic({
            a: numberToWord4(a),
            b: numberToWord4(b),
            c0,
          });

          expect(out.stages).toHaveLength(4);
          expect(out.intermediateCarries[0]).toBe(c0);
          expect(out.intermediateCarries[4]).toBe(out.carryOut);

          for (let col = 0; col < 4; col += 1) {
            const stage = out.stages[col]!;
            expect(stage.bitIndex).toBe(col);
            expect(stage.weight).toBe(1 << col);
            expect(stage.carryIn).toBe(out.intermediateCarries[col]);
            expect(stage.carryOut).toBe(out.intermediateCarries[col + 1]);
            expect(stage.aBit + stage.bBit + stage.carryIn).toBe(stage.columnTotal);
            expect(stage.sumBit + stage.carryOut * 2).toBe(stage.columnTotal);
            expect(stage.sumBit).toBe(out.sumBits[col]);
          }

          // Consistencia estricta de formatos binario y hexadecimal
          expect(out.formatted.totalBinary5).toHaveLength(5);
          expect(Number.parseInt(out.formatted.totalBinary5, 2)).toBe(out.totalValue);
          expect(Number.parseInt(out.formatted.sumBinary4, 2)).toBe(out.sumValue);
          expect(Number.parseInt(out.formatted.totalHex, 16)).toBe(out.totalValue);
          expect(Number.parseInt(out.formatted.sumHex, 16)).toBe(out.sumValue);
        }
      }
    }
  });

  it('2. sincroniza bidireccionalmente los 9 interruptores DIP, el estado Zustand y los resultados del motor eléctrico', () => {
    const store = useLabStore.getState();

    // Conmutar manualmente A = 0b1010 (10), B = 0b0101 (5), C0 = 1 -> Total = 16 (C4=1, S=0000)
    store.toggleSwitchState('sw-a3');
    store.toggleSwitchState('sw-a1');
    store.toggleSwitchState('sw-b2');
    store.toggleSwitchState('sw-b0');
    store.toggleSwitchState('sw-c0');

    const solvedManual = solveCircuit(
      createCanonicalCircuitInput(useLabStore.getState().switchStates),
    );
    expect(solvedManual.isHealthy).toBe(true);
    expect(solvedManual.adderOutput?.operandA).toBe(10);
    expect(solvedManual.adderOutput?.operandB).toBe(5);
    expect(solvedManual.adderOutput?.carryIn).toBe(1);
    expect(solvedManual.adderOutput?.totalValue).toBe(16);
    expect(solvedManual.adderOutput?.sumValue).toBe(0);
    expect(solvedManual.adderOutput?.carryOut).toBe(1);
    expect(solvedManual.leds['led-c4'].isLit).toBe(true);
    expect(solvedManual.leds['led-s3'].isLit).toBe(false);
    expect(solvedManual.leds['led-s2'].isLit).toBe(false);
    expect(solvedManual.leds['led-s1'].isLit).toBe(false);
    expect(solvedManual.leds['led-s0'].isLit).toBe(false);

    // Modificar mediante helpers de palabra desde la interfaz: A = 6, B = 5, C0 = 0 -> Total = 11 (0b01011)
    store.setOperandA(6);
    store.setOperandB(5);
    store.setCarryIn(false);

    const nextStates = useLabStore.getState().switchStates;
    expect(nextStates['sw-a3']).toBe(false);
    expect(nextStates['sw-a2']).toBe(true);
    expect(nextStates['sw-a1']).toBe(true);
    expect(nextStates['sw-a0']).toBe(false);

    const solvedUi = solveCircuit(createCanonicalCircuitInput(nextStates));
    expect(solvedUi.adderOutput?.totalValue).toBe(11);
    expect(solvedUi.leds['led-c4'].isLit).toBe(false);
    expect(solvedUi.leds['led-s3'].isLit).toBe(true);
    expect(solvedUi.leds['led-s2'].isLit).toBe(false);
    expect(solvedUi.leds['led-s1'].isLit).toBe(true);
    expect(solvedUi.leds['led-s0'].isLit).toBe(true);
  });

  it('3. aplica los ejemplos rápidos (0+0, 7+1, 15+1 y 15+15+1) actuando sobre los interruptores reales del circuito', () => {
    const labels = QUICK_ADDITION_PRESETS.map((p) => p.label);
    expect(labels).toEqual(['0 + 0', '7 + 1', '15 + 1', '15 + 15 + 1']);

    const expectedCases = [
      {
        presetIndex: 0,
        total: 0,
        sum: 0,
        c4: 0,
        carries: [0, 0, 0, 0, 0],
        bin5: '00000',
        hex: '0x00',
        litLeds: [] as string[],
      },
      {
        presetIndex: 1,
        total: 8,
        sum: 8,
        c4: 0,
        carries: [0, 1, 1, 1, 0],
        bin5: '01000',
        hex: '0x08',
        litLeds: ['led-s3'],
      },
      {
        presetIndex: 2,
        total: 16,
        sum: 0,
        c4: 1,
        carries: [0, 1, 1, 1, 1],
        bin5: '10000',
        hex: '0x10',
        litLeds: ['led-c4'],
      },
      {
        presetIndex: 3,
        total: 31,
        sum: 15,
        c4: 1,
        carries: [1, 1, 1, 1, 1],
        bin5: '11111',
        hex: '0x1F',
        litLeds: ['led-c4', 'led-s3', 'led-s2', 'led-s1', 'led-s0'],
      },
    ] as const;

    for (const c of expectedCases) {
      const preset = QUICK_ADDITION_PRESETS[c.presetIndex]!;
      useLabStore.getState().applyAdditionPreset(preset.operandA, preset.operandB, preset.carryIn);

      const states = useLabStore.getState().switchStates;
      expect(doesPresetMatchSwitches(preset, states)).toBe(true);

      for (const other of QUICK_ADDITION_PRESETS) {
        if (other.id !== preset.id) {
          expect(doesPresetMatchSwitches(other, states)).toBe(false);
        }
      }

      const solved = solveCircuit(createCanonicalCircuitInput(states));
      expect(solved.adderOutput).not.toBeNull();
      expect(solved.adderOutput!.totalValue).toBe(c.total);
      expect(solved.adderOutput!.sumValue).toBe(c.sum);
      expect(solved.adderOutput!.carryOut).toBe(c.c4);
      expect(solved.adderOutput!.intermediateCarries).toEqual(c.carries);
      expect(solved.adderOutput!.formatted.totalBinary5).toBe(c.bin5);
      expect(solved.adderOutput!.formatted.totalHex).toBe(c.hex);

      const actuallyLit = Object.values(solved.leds)
        .filter((l) => l.isLit)
        .map((l) => l.ledId);
      expect(new Set(actuallyLit)).toEqual(new Set(c.litLeds));
    }
  });

  it('4. invalida la operación y apaga los LEDs cuando la fuente de +5 V está en STBY, conservando las posiciones mecánicas', () => {
    const store = useLabStore.getState();
    store.applyAdditionPreset(15, 15, 1);

    // Con fuente encendida: 31 y los 5 LEDs encendidos
    const powered = solveCircuit(createCanonicalCircuitInput(useLabStore.getState().switchStates));
    expect(powered.isPowerSupplyOn).toBe(true);
    expect(powered.adderOutput?.totalValue).toBe(31);
    expect(Object.values(powered.leds).every((l) => l.isLit)).toBe(true);

    // Apagar la fuente regulada (+5 V -> STBY)
    store.togglePowerSupply();
    expect(useLabStore.getState().switchStates[POWER_SUPPLY_5V.id]).toBe(false);

    const unpowered = solveCircuit(
      createCanonicalCircuitInput(useLabStore.getState().switchStates),
    );
    expect(unpowered.isPowerSupplyOn).toBe(false);
    expect(unpowered.adderOutput).toBeNull();
    expect(Object.values(unpowered.leds).every((l) => !l.isLit)).toBe(true);
    expect(unpowered.diagnostics.some((d) => d.code === 'POWER_SUPPLY_OFF')).toBe(true);

    // Cambiar ejemplo rápido a 7 + 1 mientras la fuente sigue apagada:
    // los interruptores cambian mecánicamente, pero el resultado sigue invalidado
    store.applyAdditionPreset(7, 1, 0);
    const unpoweredAfterPreset = solveCircuit(
      createCanonicalCircuitInput(useLabStore.getState().switchStates),
    );
    expect(unpoweredAfterPreset.adderOutput).toBeNull();
    expect(Object.values(unpoweredAfterPreset.leds).every((l) => !l.isLit)).toBe(true);

    // Al volver a encender la fuente, el motor resuelve inmediatamente 7 + 1 = 8
    store.setPowerSupplyOn(true);
    const repowered = solveCircuit(
      createCanonicalCircuitInput(useLabStore.getState().switchStates),
    );
    expect(repowered.isPowerSupplyOn).toBe(true);
    expect(repowered.adderOutput?.totalValue).toBe(8);
    expect(repowered.leds['led-s3'].isLit).toBe(true);
  });

  it('5. traza correctamente el recorrido eléctrico de las 16 señales sin alterar la conectividad ni la netlist', () => {
    useLabStore.getState().applyAdditionPreset(7, 1, 0);
    const input = createCanonicalCircuitInput(useLabStore.getState().switchStates);
    const baselineSolution = solveCircuit(input);

    for (const spec of PINOUT_74LS83A) {
      useLabStore.getState().setTracedSignal(spec.signal);
      expect(useLabStore.getState().tracedSignal).toBe(spec.signal);

      const trace = traceSignalPath(input, baselineSolution, spec.signal);
      expect(trace.signal).toBe(spec.signal);
      expect(trace.pinNumber).toBe(spec.pinNumber);
      expect(trace.wireIds.size).toBeGreaterThan(0);
      expect(trace.highlightedHoleIds.size).toBeGreaterThan(0);
      expect(trace.summaryEs.length).toBeGreaterThan(15);

      if (spec.direction === 'INPUT') {
        // Debe incluir el interruptor DIP, la resistencia pull-down y el cable de señal
        expect(trace.subChannelIds.size).toBe(1);
        expect(trace.componentIds.size).toBe(2);
      } else if (spec.direction === 'OUTPUT') {
        // Debe incluir la resistencia limitadora de 1 kΩ, el LED y sus cables (salida + retorno GND)
        const expectedLedId = `led-${spec.signal.toLowerCase()}`;
        const expectedResId = `r-led-${spec.signal.toLowerCase()}`;
        expect(trace.componentIds.has(expectedLedId)).toBe(true);
        expect(trace.componentIds.has(expectedResId)).toBe(true);
        expect(trace.wireIds.size).toBeGreaterThanOrEqual(2);
      } else {
        // VCC o GND incluye la fuente regulada de +5 V
        expect(trace.componentIds.has(POWER_SUPPLY_5V.id)).toBe(true);
      }
    }

    // Verificar invariancia absoluta de la netlist y resultados tras trazar señales
    const afterInput = createCanonicalCircuitInput(useLabStore.getState().switchStates);
    const afterSolution = solveCircuit(afterInput);
    expect(areComponentNetlistsEquivalent(input, afterInput)).toBe(true);
    expect(afterSolution.adderOutput?.totalValue).toBe(baselineSolution.adderOutput?.totalValue);

    // Alternar la misma señal activa ('B3', último pin recorrido) desactiva el trazado
    expect(useLabStore.getState().tracedSignal).toBe('B3');
    useLabStore.getState().toggleTracedSignal('B3');
    expect(useLabStore.getState().tracedSignal).toBeNull();
  });
});
