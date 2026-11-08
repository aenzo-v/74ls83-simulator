import { describe, expect, it } from 'vitest';
import {
  createCanonicalCircuitInput,
  JUMPER_WIRES,
  POWER_SUPPLY_5V,
  RESISTORS,
} from '../../data/circuitLayout';
import {
  type BitValue,
  CARRY_IN_PIN,
  CARRY_OUT_PIN,
  evaluate74LS83Logic,
  GND_PIN,
  INPUT_A_PINS,
  INPUT_B_PINS,
  numberToWord4,
  SUM_OUTPUT_PINS,
  VCC_PIN,
  word4ToNumber,
} from '../adder74ls83';
import {
  areComponentNetlistsEquivalent,
  solveCircuit,
  type WireConnection,
} from '../netlist';
import { PINOUT_74LS83A } from '../pinout74ls83';
import type { PinNumber, SignalCode } from '../types';

function buildSwitchStatesForOperands(
  a: number,
  b: number,
  c0: BitValue,
  psuOn = true,
): Record<string, boolean> {
  const aBits = numberToWord4(a);
  const bBits = numberToWord4(b);
  return {
    [POWER_SUPPLY_5V.id]: psuOn,
    'sw-a0': aBits[0] === 1,
    'sw-a1': aBits[1] === 1,
    'sw-a2': aBits[2] === 1,
    'sw-a3': aBits[3] === 1,
    'sw-b0': bBits[0] === 1,
    'sw-b1': bBits[1] === 1,
    'sw-b2': bBits[2] === 1,
    'sw-b3': bBits[3] === 1,
    'sw-c0': c0 === 1,
  };
}

describe('Fase 3 — Motor electrónico de netlist, lógica 74LS83A y diagnóstico eléctrico', () => {
  it('1. calcula con exactitud las 512 combinaciones posibles de A, B y C0 a través de la netlist completa', () => {
    let testedCount = 0;

    for (let a = 0; a <= 15; a += 1) {
      for (let b = 0; b <= 15; b += 1) {
        for (const c0 of [0, 1] as const) {
          testedCount += 1;
          const expectedTotal = a + b + c0;
          const expectedSum = expectedTotal & 0b1111;
          const expectedCout = ((expectedTotal >> 4) & 1) as BitValue;

          // Verificación de la función pura del sumador
          const direct = evaluate74LS83Logic({
            a: numberToWord4(a),
            b: numberToWord4(b),
            c0,
          });
          expect(direct.totalValue).toBe(expectedTotal);
          expect(direct.sumValue).toBe(expectedSum);
          expect(direct.carryOut).toBe(expectedCout);
          expect(word4ToNumber(direct.sumBits)).toBe(expectedSum);

          // Verificación integral resolviendo protoboard + cables + interruptores + resistencias + 74LS83A + LEDs
          const switchStates = buildSwitchStatesForOperands(a, b, c0, true);
          const solved = solveCircuit(createCanonicalCircuitInput(switchStates));

          expect(solved.isHealthy).toBe(true);
          expect(solved.diagnostics).toHaveLength(0);
          expect(solved.adderOutput).not.toBeNull();
          expect(solved.adderOutput!.totalValue).toBe(expectedTotal);
          expect(solved.adderOutput!.sumValue).toBe(expectedSum);
          expect(solved.adderOutput!.carryOut).toBe(expectedCout);

          // Pines físicos de salida del 74LS83A (9=S0, 6=S1, 2=S2, 15=S3, 14=C4)
          expect(solved.pins[9].logicLevel).toBe((expectedSum >> 0) & 1);
          expect(solved.pins[6].logicLevel).toBe((expectedSum >> 1) & 1);
          expect(solved.pins[2].logicLevel).toBe((expectedSum >> 2) & 1);
          expect(solved.pins[15].logicLevel).toBe((expectedSum >> 3) & 1);
          expect(solved.pins[14].logicLevel).toBe(expectedCout);

          // Indicadores LED alimentados por cada etapa en serie
          expect(solved.leds['led-s0']?.isLit).toBe(((expectedSum >> 0) & 1) === 1);
          expect(solved.leds['led-s1']?.isLit).toBe(((expectedSum >> 1) & 1) === 1);
          expect(solved.leds['led-s2']?.isLit).toBe(((expectedSum >> 2) & 1) === 1);
          expect(solved.leds['led-s3']?.isLit).toBe(((expectedSum >> 3) & 1) === 1);
          expect(solved.leds['led-c4']?.isLit).toBe(expectedCout === 1);
        }
      }
    }

    expect(testedCount).toBe(512);
  });

  it('2. respeta la correspondencia exacta de señales y pines físicos del SN74LS83A DIP-16 (distinto del 74LS283)', () => {
    const canonicalMap: Readonly<Record<PinNumber, SignalCode>> = {
      1: 'A3',
      2: 'S2',
      3: 'A2',
      4: 'B2',
      5: 'VCC',
      6: 'S1',
      7: 'B1',
      8: 'A1',
      9: 'S0',
      10: 'A0',
      11: 'B0',
      12: 'GND',
      13: 'C0',
      14: 'C4',
      15: 'S3',
      16: 'B3',
    };

    expect(VCC_PIN).toBe(5);
    expect(GND_PIN).toBe(12);
    expect(INPUT_A_PINS).toEqual([10, 8, 3, 1]);
    expect(INPUT_B_PINS).toEqual([11, 7, 4, 16]);
    expect(CARRY_IN_PIN).toBe(13);
    expect(SUM_OUTPUT_PINS).toEqual([9, 6, 2, 15]);
    expect(CARRY_OUT_PIN).toBe(14);

    for (const spec of PINOUT_74LS83A) {
      expect(spec.signal).toBe(canonicalMap[spec.pinNumber]);
    }

    // Activar un único canal de entrada cada vez y comprobar que solo cambia el pin físico esperado
    const channelToPin: ReadonlyArray<readonly [string, PinNumber]> = [
      ['sw-a0', 10],
      ['sw-a1', 8],
      ['sw-a2', 3],
      ['sw-a3', 1],
      ['sw-b0', 11],
      ['sw-b1', 7],
      ['sw-b2', 4],
      ['sw-b3', 16],
      ['sw-c0', 13],
    ];

    for (const [channelId, targetPin] of channelToPin) {
      const solved = solveCircuit(
        createCanonicalCircuitInput({
          [POWER_SUPPLY_5V.id]: true,
          [channelId]: true,
        }),
      );
      for (const [, pinNum] of channelToPin) {
        expect(solved.pins[pinNum].logicLevel).toBe(pinNum === targetPin ? 1 : 0);
      }
    }
  });

  it('3. modela la continuidad interna de pistas de 5 contactos, rieles de 50 puntos y aislamiento del canal central', () => {
    const solved = solveCircuit(createCanonicalCircuitInput({ [POWER_SUPPLY_5V.id]: true }));

    // Los 5 contactos de una misma pista vertical (a20..e20) pertenecen exactamente a la misma red
    const upperCol20Net = solved.terminalToNetId['a20'];
    expect(upperCol20Net).toBeDefined();
    for (const row of ['b', 'c', 'd', 'e']) {
      expect(solved.terminalToNetId[`${row}20`]).toBe(upperCol20Net);
    }

    // El canal central de 7.62 mm aísla el banco superior (a20..e20) del inferior (f20..j20)
    const lowerCol20Net = solved.terminalToNetId['f20'];
    expect(lowerCol20Net).not.toBe(upperCol20Net);
    for (const row of ['g', 'h', 'i', 'j']) {
      expect(solved.terminalToNetId[`${row}20`]).toBe(lowerCol20Net);
    }

    // Columnas adyacentes están aisladas entre sí
    expect(solved.terminalToNetId['a20']).not.toBe(solved.terminalToNetId['a21']);

    // Continuidad de los 50 agujeros de cada riel de alimentación y unión mediante puentes laterales
    const vccNet = solved.terminalToNetId[POWER_SUPPLY_5V.plusTerminalId];
    const gndNet = solved.terminalToNetId[POWER_SUPPLY_5V.gndTerminalId];
    expect(vccNet).not.toBe(gndNet);

    for (let idx = 1; idx <= 50; idx += 1) {
      expect(solved.terminalToNetId[`rail-top-plus-${idx}`]).toBe(vccNet);
      expect(solved.terminalToNetId[`rail-bottom-plus-${idx}`]).toBe(vccNet);
      expect(solved.terminalToNetId[`rail-top-minus-${idx}`]).toBe(gndNet);
      expect(solved.terminalToNetId[`rail-bottom-minus-${idx}`]).toBe(gndNet);
    }
  });

  it('4. propaga continuidad eléctrica a través de cables jumper simples y encadenados', () => {
    // Sustituimos el cable directo de A3 (h4 -> h28) por una cadena de 2 puentes usando la pista libre col 22 inferior
    const chainedWires: WireConnection[] = [
      ...JUMPER_WIRES.filter((w) => w.id !== 'w-sig-a3'),
      {
        id: 'w-chain-a3-1',
        fromTerminalId: 'h4',
        toTerminalId: 'f22',
        signal: 'A3',
      },
      {
        id: 'w-chain-a3-2',
        fromTerminalId: 'j22',
        toTerminalId: 'i28',
        signal: 'A3',
      },
    ];

    const solved = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(0b1000, 0b0100, 0, true), {
        wires: chainedWires,
      }),
    );

    expect(solved.isHealthy).toBe(true);
    expect(solved.terminalToNetId['f4']).toBe(solved.terminalToNetId['f28']); // SW A3 -> Pin 1
    expect(solved.adderOutput?.totalValue).toBe(12);
    expect(solved.leds['led-s3']?.isLit).toBe(true);
    expect(solved.leds['led-s2']?.isLit).toBe(true);
  });

  it('5. reconoce conexiones eléctricamente equivalentes en distintos agujeros de la misma pista', () => {
    const baseInput = createCanonicalCircuitInput(buildSwitchStatesForOperands(11, 6, 1, true));

    // Reubicamos varios extremos a otros agujeros libres dentro de sus mismas pistas internas o rieles
    const relocatedWires: WireConnection[] = JUMPER_WIRES.map((w) => {
      switch (w.id) {
        case 'w-swa-vcc-3':
          return { ...w, fromTerminalId: 'rail-top-plus-20', toTerminalId: 'c4' };
        case 'w-sig-a3':
          return { ...w, fromTerminalId: 'g4', toTerminalId: 'j28' };
        case 'w-ic-vcc':
          return { ...w, fromTerminalId: 'rail-bottom-plus-32', toTerminalId: 'g32' };
        case 'w-out-s0':
          return { ...w, fromTerminalId: 'a35', toTerminalId: 'b57' };
        default:
          return w;
      }
    });

    const equivalentInput = createCanonicalCircuitInput(
      buildSwitchStatesForOperands(11, 6, 1, true),
      { wires: relocatedWires },
    );

    expect(areComponentNetlistsEquivalent(baseInput, equivalentInput)).toBe(true);

    const solvedBase = solveCircuit(baseInput);
    const solvedEquiv = solveCircuit(equivalentInput);
    expect(solvedEquiv.isHealthy).toBe(true);
    expect(solvedEquiv.adderOutput).toEqual(solvedBase.adderOutput);
    expect(solvedEquiv.leds['led-c4']?.isLit).toBe(true);
    expect(solvedEquiv.leds['led-s1']?.isLit).toBe(true);
  });

  it('6. detecta ausencia de alimentación (fuente apagada, VCC/GND desconectados o polaridad invertida) y suprime salidas', () => {
    // 6a. Fuente en espera (STBY) con entradas activas
    const psuOff = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(15, 15, 1, false), {
        isPowerSupplyOn: false,
      }),
    );
    expect(psuOff.isChipPowered).toBe(false);
    expect(psuOff.adderOutput).toBeNull();
    expect(psuOff.diagnostics.some((d) => d.code === 'POWER_SUPPLY_OFF')).toBe(true);
    expect(Object.values(psuOff.leds).every((l) => !l.isLit)).toBe(true);

    // 6b. Pin 5 (VCC) desconectado
    const noVcc = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(7, 5, 0, true), {
        wires: JUMPER_WIRES.filter((w) => w.id !== 'w-ic-vcc'),
      }),
    );
    expect(noVcc.isChipPowered).toBe(false);
    expect(noVcc.adderOutput).toBeNull();
    expect(noVcc.diagnostics.some((d) => d.code === 'IC_VCC_DISCONNECTED')).toBe(true);
    expect(Object.values(noVcc.leds).every((l) => !l.isLit)).toBe(true);

    // 6c. Pin 12 (GND) desconectado
    const noGnd = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(7, 5, 0, true), {
        wires: JUMPER_WIRES.filter((w) => w.id !== 'w-ic-gnd'),
      }),
    );
    expect(noGnd.isChipPowered).toBe(false);
    expect(noGnd.adderOutput).toBeNull();
    expect(noGnd.diagnostics.some((d) => d.code === 'IC_GND_DISCONNECTED')).toBe(true);
    expect(Object.values(noGnd.leds).every((l) => !l.isLit)).toBe(true);

    // 6d. Polaridad invertida en Pines 5 y 12
    const reversedPowerWires: WireConnection[] = JUMPER_WIRES.map((w) => {
      if (w.id === 'w-ic-vcc') {
        return { ...w, fromTerminalId: 'rail-bottom-minus-25' };
      }
      if (w.id === 'w-ic-gnd') {
        return { ...w, fromTerminalId: 'rail-top-plus-25' };
      }
      return w;
    });
    const reversed = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(3, 2, 0, true), {
        wires: reversedPowerWires,
      }),
    );
    expect(reversed.isChipPowered).toBe(false);
    expect(reversed.adderOutput).toBeNull();
    expect(reversed.diagnostics.some((d) => d.code === 'IC_REVERSE_POLARITY')).toBe(true);
  });

  it('7. detecta entradas flotantes por cable faltante o falta de polarización e impide mostrar sumas falsas', () => {
    // 7a. Cable de entrada A2 retirado -> Pin 3 queda flotante
    const missingA2Wire = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(4, 3, 0, true), {
        wires: JUMPER_WIRES.filter((w) => w.id !== 'w-sig-a2'),
      }),
    );
    expect(missingA2Wire.areAllInputsValid).toBe(false);
    expect(missingA2Wire.adderOutput).toBeNull();
    expect(
      missingA2Wire.diagnostics.some(
        (d) => d.code === 'FLOATING_INPUT' && d.signal === 'A2' && d.relatedPins?.includes(3),
      ),
    ).toBe(true);
    expect(Object.values(missingA2Wire.leds).every((l) => !l.isLit)).toBe(true);

    // 7b. Sin resistencia pull-down en B1 cuando el interruptor B1 está abierto (OFF)
    const missingPullDownB1 = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(1, 0, 0, true), {
        resistors: RESISTORS.filter((r) => r.id !== 'r-pd-b1'),
      }),
    );
    expect(missingPullDownB1.areAllInputsValid).toBe(false);
    expect(missingPullDownB1.adderOutput).toBeNull();
    expect(
      missingPullDownB1.diagnostics.some(
        (d) => d.code === 'FLOATING_INPUT' && d.signal === 'B1' && d.relatedPins?.includes(7),
      ),
    ).toBe(true);
  });

  it('8. detecta cortocircuitos directos entre +5 V y GND así como contenciones de salida', () => {
    // 8a. Cortocircuito directo entre riel positivo y negativo
    const supplyShort = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(9, 9, 1, true), {
        wires: [
          ...JUMPER_WIRES,
          {
            id: 'w-fault-short',
            fromTerminalId: 'rail-top-plus-30',
            toTerminalId: 'rail-top-minus-30',
          },
        ],
      }),
    );
    expect(supplyShort.hasSupplyShortCircuit).toBe(true);
    expect(supplyShort.isChipPowered).toBe(false);
    expect(supplyShort.adderOutput).toBeNull();
    expect(supplyShort.diagnostics.some((d) => d.code === 'SHORT_CIRCUIT_SUPPLY')).toBe(true);
    expect(Object.values(supplyShort.leds).every((l) => !l.isLit)).toBe(true);

    // 8b. Contención en salida: unir la salida S0 (Pin 9 en e35) directamente a GND
    const outputShortToGnd = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(1, 0, 0, true), {
        wires: [
          ...JUMPER_WIRES,
          {
            id: 'w-fault-s0-gnd',
            fromTerminalId: 'd35',
            toTerminalId: 'rail-top-minus-35',
          },
        ],
      }),
    );
    expect(outputShortToGnd.diagnostics.some((d) => d.code === 'OUTPUT_CONTENTION')).toBe(true);
    expect(outputShortToGnd.leds['led-s0']?.isLit).toBe(false);
  });

  it('9. diagnostica terminales inválidos, cables desconectados, conexiones erróneas y salidas no conducidas', () => {
    // 9a. Terminal inexistente y cable degenerado sobre el mismo contacto
    const invalidTerm = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(0, 0, 0, true), {
        wires: [
          ...JUMPER_WIRES,
          { id: 'w-bad-hole', fromTerminalId: 'a20', toTerminalId: 'z999' },
          { id: 'w-self-loop', fromTerminalId: 'b20', toTerminalId: 'b20' },
        ],
      }),
    );
    expect(
      invalidTerm.diagnostics.filter((d) => d.code === 'INVALID_TERMINAL'),
    ).toHaveLength(2);

    // 9b. Cable con extremo abierto en pista vacía
    const dangling = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(0, 0, 0, true), {
        wires: [
          ...JUMPER_WIRES,
          { id: 'w-open', fromTerminalId: 'h4', toTerminalId: 'a22' },
        ],
      }),
    );
    expect(
      dangling.diagnostics.some(
        (d) => d.code === 'DISCONNECTED_WIRE' && d.relatedWireIds?.includes('w-open'),
      ),
    ).toBe(true);

    // 9c. Conexión cruzada (interruptor A3 conectado al Pin 16 que corresponde a B3)
    const crossedWires: WireConnection[] = JUMPER_WIRES.map((w) => {
      if (w.id === 'w-sig-a3') return { ...w, toTerminalId: 'd28' };
      if (w.id === 'w-sig-b3') return { ...w, toTerminalId: 'h28' };
      return w;
    });
    const crossed = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(0, 0, 0, true), {
        wires: crossedWires,
      }),
    );
    expect(crossed.diagnostics.some((d) => d.code === 'WRONG_PIN_CONNECTION')).toBe(true);

    // 9d. Salida no conducida al retirar el jumper de salida C4 y LED directo sin resistencia
    const undrivenC4 = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(15, 1, 0, true), {
        wires: JUMPER_WIRES.filter((w) => w.id !== 'w-out-c4'),
      }),
    );
    expect(
      undrivenC4.diagnostics.some((d) => d.code === 'UNDRIVEN_OUTPUT' && d.signal === 'C4'),
    ).toBe(true);
    expect(undrivenC4.leds['led-c4']?.isLit).toBe(false);

    // 9e. Puente directo que anula la resistencia en serie de LED S0 -> LED_WITHOUT_RESISTOR
    const bypassedResistor = solveCircuit(
      createCanonicalCircuitInput(buildSwitchStatesForOperands(1, 0, 0, true), {
        wires: [
          ...JUMPER_WIRES,
          { id: 'w-bypass-r-s0', fromTerminalId: 'a57', toTerminalId: 'g57' },
        ],
      }),
    );
    expect(
      bypassedResistor.diagnostics.some(
        (d) => d.code === 'LED_WITHOUT_RESISTOR' && d.signal === 'S0',
      ),
    ).toBe(true);
    expect(bypassedResistor.leds['led-s0']?.isLit).toBe(false);
  });

  it('10. demuestra matemáticamente que la reorganización de cables 3D de Fase 3 conserva idéntica netlist que Fase 2', () => {
    // En Fase 2 los tres contactos previos eran: w-sig-a0 -> c34, w-sig-b2 -> h11 y w-sig-b0 -> b33
    const phase2Wires: WireConnection[] = JUMPER_WIRES.map((w) => {
      if (w.id === 'w-sig-a0') return { ...w, toTerminalId: 'c34' };
      if (w.id === 'w-sig-b2') return { ...w, fromTerminalId: 'h11' };
      if (w.id === 'w-sig-b0') return { ...w, toTerminalId: 'b33' };
      return w;
    });

    const phase2Input = createCanonicalCircuitInput(
      buildSwitchStatesForOperands(13, 10, 1, true),
      { wires: phase2Wires },
    );
    const phase3Input = createCanonicalCircuitInput(
      buildSwitchStatesForOperands(13, 10, 1, true),
    );

    expect(areComponentNetlistsEquivalent(phase2Input, phase3Input)).toBe(true);

    const solvedPhase2 = solveCircuit(phase2Input);
    const solvedPhase3 = solveCircuit(phase3Input);
    expect(solvedPhase3.isHealthy).toBe(true);
    expect(solvedPhase3.adderOutput).toEqual(solvedPhase2.adderOutput);

    for (const spec of PINOUT_74LS83A) {
      expect(solvedPhase3.pins[spec.pinNumber].netId).toBe(
        solvedPhase2.pins[spec.pinNumber].netId,
      );
      expect(solvedPhase3.pins[spec.pinNumber].logicLevel).toBe(
        solvedPhase2.pins[spec.pinNumber].logicLevel,
      );
    }
  });
});
