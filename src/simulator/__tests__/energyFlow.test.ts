import { describe, expect, it } from 'vitest';
import { createCanonicalCircuitInput } from '../../data/circuitLayout';
import { solveCircuit } from '../netlist';
import { computeCircuitEnergyFlow } from '../energyFlow';

describe('Flujo de Energía Eléctrica — Simulador 74LS83A', () => {
  it('1. circuito apagado (fuente en STBY): ningún conductor conduce energía', () => {
    const input = createCanonicalCircuitInput({ 'psu-5v': false });
    const solution = solveCircuit(input);
    const flow = computeCircuitEnergyFlow(input, solution);

    expect(flow.isPowered).toBe(false);
    expect(flow.hasShortCircuit).toBe(false);
    expect(flow.conductingWiresCount).toBe(0);
    expect(flow.activeRails.topPlus).toBe(false);
    expect(flow.activeLeds.size).toBe(0);

    // Todos los cables deben tener isConducting === false
    for (const wireFlow of Object.values(flow.wireFlows)) {
      expect(wireFlow.isConducting).toBe(false);
      expect(wireFlow.direction).toBe('NONE');
    }
  });

  it('2. circuito encendido con entradas en 0: conduce alimentación y GND, pero no las entradas ni salidas', () => {
    const input = createCanonicalCircuitInput({ 'psu-5v': true });
    const solution = solveCircuit(input);
    const flow = computeCircuitEnergyFlow(input, solution);

    expect(flow.isPowered).toBe(true);
    expect(flow.isChipActive).toBe(true);
    expect(flow.activeInputsCount).toBe(0);
    expect(flow.activeOutputsCount).toBe(0);
    expect(flow.activeRails.topPlus).toBe(true);
    expect(flow.activeRails.topMinus).toBe(true);

    // VCC principal y Pin 5 VCC deben conducir en sentido FORWARD
    expect(flow.wireFlows['w-psu-vcc']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-psu-vcc']?.direction).toBe('FORWARD');
    expect(flow.wireFlows['w-ic-vcc']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-ic-vcc']?.direction).toBe('FORWARD');

    // Retorno GND hacia la fuente y Pin 12 GND deben conducir en sentido REVERSE hacia la fuente
    expect(flow.wireFlows['w-psu-gnd']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-psu-gnd']?.direction).toBe('REVERSE');
    expect(flow.wireFlows['w-ic-gnd']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-ic-gnd']?.direction).toBe('REVERSE');

    // Entradas A0..A3 y B0..B3 deben estar en reposo (sin corriente)
    expect(flow.wireFlows['w-sig-a0']?.isConducting).toBe(false);
    expect(flow.wireFlows['w-sig-b0']?.isConducting).toBe(false);
    expect(flow.wireFlows['w-sig-c0']?.isConducting).toBe(false);

    // Salidas S0..S3 y C4 deben estar inactivas
    expect(flow.wireFlows['w-out-s0']?.isConducting).toBe(false);
    expect(flow.wireFlows['w-out-s1']?.isConducting).toBe(false);
    expect(flow.wireFlows['w-out-c4']?.isConducting).toBe(false);
  });

  it('3. al activar una entrada (A0 = 1), el conductor de señal conduce hacia el pin 10 del 74LS83A', () => {
    const input = createCanonicalCircuitInput({
      'psu-5v': true,
      'sw-a0': true,
    });
    const solution = solveCircuit(input);
    const flow = computeCircuitEnergyFlow(input, solution);

    expect(flow.activeInputsCount).toBe(1);
    expect(flow.wireFlows['w-sig-a0']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-sig-a0']?.direction).toBe('FORWARD');
    expect(flow.wireFlows['w-sig-a0']?.category).toBe('INPUT_A');

    // Como A=1, B=0, C0=0 -> Suma S0=1, S1..S3=0, C4=0
    expect(flow.wireFlows['w-out-s0']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-out-s0']?.direction).toBe('FORWARD');
    expect(flow.wireFlows['w-out-s0']?.category).toBe('SUM_OUT');
    expect(flow.wireFlows['w-out-s1']?.isConducting).toBe(false);

    // El LED S0 debe estar activo y su retorno de cátodo a GND debe conducir
    expect(flow.activeLeds.has('led-s0')).toBe(true);
    expect(flow.wireFlows['w-led-gnd-s0']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-led-gnd-s0']?.direction).toBe('FORWARD');
  });

  it('4. suma con acarreo (A0=1, B0=1 -> S0=0, S1=1): valida transferencia de energía lógica', () => {
    const input = createCanonicalCircuitInput({
      'psu-5v': true,
      'sw-a0': true,
      'sw-b0': true,
    });
    const solution = solveCircuit(input);
    const flow = computeCircuitEnergyFlow(input, solution);

    expect(flow.activeInputsCount).toBe(2);
    expect(flow.wireFlows['w-sig-a0']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-sig-b0']?.isConducting).toBe(true);

    // Suma 1 + 1 = 2 (0b0010): S0=0, S1=1, S2=0, S3=0, C4=0
    expect(flow.wireFlows['w-out-s0']?.isConducting).toBe(false);
    expect(flow.wireFlows['w-out-s1']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-out-s2']?.isConducting).toBe(false);
    expect(flow.wireFlows['w-out-s3']?.isConducting).toBe(false);
    expect(flow.wireFlows['w-out-c4']?.isConducting).toBe(false);

    expect(flow.activeLeds.has('led-s1')).toBe(true);
    expect(flow.activeLeds.has('led-s0')).toBe(false);
  });

  it('5. desbordamiento de 4 bits (A=15, B=15, C0=1 -> Total 31): todas las 5 salidas conducen', () => {
    const switchStates: Record<string, boolean> = {
      'psu-5v': true,
      'sw-a3': true,
      'sw-a2': true,
      'sw-a1': true,
      'sw-a0': true,
      'sw-b3': true,
      'sw-b2': true,
      'sw-b1': true,
      'sw-b0': true,
      'sw-c0': true,
    };
    const input = createCanonicalCircuitInput(switchStates);
    const solution = solveCircuit(input);
    const flow = computeCircuitEnergyFlow(input, solution);

    expect(flow.activeInputsCount).toBe(9);
    expect(flow.activeOutputsCount).toBe(5);
    expect(flow.activeLeds.size).toBe(5);

    expect(flow.wireFlows['w-out-s0']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-out-s1']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-out-s2']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-out-s3']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-out-c4']?.isConducting).toBe(true);

    // Todos los retornos de cátodos conducen
    expect(flow.wireFlows['w-led-gnd-s0']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-led-gnd-s1']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-led-gnd-s2']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-led-gnd-s3']?.isConducting).toBe(true);
    expect(flow.wireFlows['w-led-gnd-c4']?.isConducting).toBe(true);
  });

  it('6. prueba exhaustiva de combinaciones: la conducción de salidas coincide exactamente con la suma binaria', () => {
    // Probar combinaciones representativas
    const testCases = [
      { a: 0, b: 0, cin: 0 },
      { a: 5, b: 3, cin: 0 },   // 8 -> 0b01000
      { a: 7, b: 8, cin: 1 },   // 16 -> 0b10000 (Cout=1, S=0)
      { a: 9, b: 6, cin: 0 },   // 15 -> 0b01111 (Cout=0, S=15)
      { a: 12, b: 10, cin: 1 }, // 23 -> 0b10111 (Cout=1, S=7)
    ];

    for (const { a, b, cin } of testCases) {
      const switchStates: Record<string, boolean> = {
        'psu-5v': true,
        'sw-a3': Boolean((a >> 3) & 1),
        'sw-a2': Boolean((a >> 2) & 1),
        'sw-a1': Boolean((a >> 1) & 1),
        'sw-a0': Boolean((a >> 0) & 1),
        'sw-b3': Boolean((b >> 3) & 1),
        'sw-b2': Boolean((b >> 2) & 1),
        'sw-b1': Boolean((b >> 1) & 1),
        'sw-b0': Boolean((b >> 0) & 1),
        'sw-c0': Boolean(cin),
      };

      const input = createCanonicalCircuitInput(switchStates);
      const solution = solveCircuit(input);
      const flow = computeCircuitEnergyFlow(input, solution);

      const total = a + b + cin;
      const expectedS0 = Boolean(total & 1);
      const expectedS1 = Boolean((total >> 1) & 1);
      const expectedS2 = Boolean((total >> 2) & 1);
      const expectedS3 = Boolean((total >> 3) & 1);
      const expectedC4 = Boolean((total >> 4) & 1);

      expect(flow.wireFlows['w-out-s0']?.isConducting).toBe(expectedS0);
      expect(flow.wireFlows['w-out-s1']?.isConducting).toBe(expectedS1);
      expect(flow.wireFlows['w-out-s2']?.isConducting).toBe(expectedS2);
      expect(flow.wireFlows['w-out-s3']?.isConducting).toBe(expectedS3);
      expect(flow.wireFlows['w-out-c4']?.isConducting).toBe(expectedC4);
    }
  });

  it('7. ante cortocircuito directo entre +5 V y GND, detiene el flujo por protección', () => {
    const input = createCanonicalCircuitInput({ 'psu-5v': true });
    // Añadir cable en corto entre riel superior positivo y negativo
    const shortInput = {
      ...input,
      wires: [
        ...input.wires,
        {
          id: 'w-short-test',
          fromTerminalId: 'rail-top-plus-20',
          toTerminalId: 'rail-top-minus-20',
        },
      ],
    };

    const solution = solveCircuit(shortInput);
    expect(solution.hasSupplyShortCircuit).toBe(true);

    const flow = computeCircuitEnergyFlow(shortInput, solution);
    expect(flow.isPowered).toBe(false);
    expect(flow.hasShortCircuit).toBe(true);
    expect(flow.conductingWiresCount).toBe(0);
  });
});
