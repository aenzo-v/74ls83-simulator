import { useState } from 'react';
import type { SignalCode } from '../../simulator/types';
import { useCircuitSolution } from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';

export function BinarySumBreakdown() {
  const [isExpanded, setIsExpanded] = useState(true);
  const solution = useCircuitSolution();
  const tracedSignal = useLabStore((s) => s.tracedSignal);
  const toggleTracedSignal = useLabStore((s) => s.toggleTracedSignal);
  const setPowerSupplyOn = useLabStore((s) => s.setPowerSupplyOn);

  const adder = solution.adderOutput;
  const firstError = solution.diagnostics.find((d) => d.severity === 'ERROR');

  return (
    <section
      aria-label="Explicación paso a paso de la suma binaria"
      className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Análisis Aritmético · 74LS83A
          </span>
          <h3 className="text-sm font-semibold text-white">
            Suma binaria columna por columna
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 font-mono text-[10px] text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
        >
          {isExpanded ? 'Contraer' : 'Expandir'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {!adder ? (
            <div className="space-y-2.5 rounded-lg border border-zinc-700 bg-zinc-950/90 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-white">
                <span className="h-2 w-2 shrink-0 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                <span>
                  {!solution.isPowerSupplyOn
                    ? 'Circuito sin energía (+5.0 V en espera)'
                    : firstError?.title ?? 'Operación invalidada por fallo eléctrico'}
                </span>
              </div>
              <p className="leading-relaxed text-zinc-400">
                {!solution.isPowerSupplyOn
                  ? 'El SN74LS83A requiere +5.0 V en el Pin 5 (VCC) y 0 V en el Pin 12 (GND) para polarizar sus etapas TTL internas de acarreo anticipado. Aunque muevas los interruptores DIP, las salidas S3..S0 y C4 no conducen corriente mientras la fuente permanezca apagada.'
                  : firstError?.message ??
                    'Revisa la alimentación y que las 9 entradas tengan niveles lógicos válidos.'}
              </p>
              {!solution.isPowerSupplyOn && (
                <button
                  type="button"
                  onClick={() => setPowerSupplyOn(true)}
                  className="w-full cursor-pointer rounded-lg border border-white bg-white px-3 py-1.5 font-mono text-xs font-bold text-black transition-colors hover:bg-zinc-200"
                >
                  Encender fuente regulada +5.0 V
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Matriz alineada de 5 columnas: Cout (peso 16) + 4 bits (pesos 8, 4, 2, 1) */}
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-2.5 font-mono">
                {/* Encabezado de pesos posicionales */}
                <div className="grid grid-cols-[62px_repeat(5,minmax(0,1fr))_58px] items-center gap-1 border-b border-zinc-800/80 pb-1.5 text-center text-[10px] text-zinc-400">
                  <span className="text-left"> Etapa</span>
                  <span title="Desbordamiento / Peso 16">2⁴ (16)</span>
                  <span title="Columna 3 / Peso 8">2³ (8)</span>
                  <span title="Columna 2 / Peso 4">2² (4)</span>
                  <span title="Columna 1 / Peso 2">2¹ (2)</span>
                  <span title="Columna 0 / Peso 1">2⁰ (1)</span>
                  <span className="text-right">Base 10</span>
                </div>

                {/* Fila de acarreos C4 <- C3 <- C2 <- C1 <- C0 */}
                <div className="mt-1.5 grid grid-cols-[62px_repeat(5,minmax(0,1fr))_58px] items-center gap-1 text-center text-xs">
                  <span className="text-left text-[10px] font-semibold text-zinc-300">Acarreo</span>
                  {(
                    [
                      ['C4', adder.intermediateCarries[4]],
                      ['C3', adder.intermediateCarries[3]],
                      ['C2', adder.intermediateCarries[2]],
                      ['C1', adder.intermediateCarries[1]],
                      ['C0', adder.intermediateCarries[0]],
                    ] as const
                  ).map(([cLabel, cBit]) => (
                    <div
                      key={cLabel}
                      className={`rounded px-1 py-0.5 ${
                        cBit === 1
                          ? 'bg-white font-bold text-black ring-1 ring-white/50 shadow-xs'
                          : 'text-zinc-600'
                      }`}
                      title={`${cLabel} = ${cBit}`}
                    >
                      <span className="block text-[9px] leading-none opacity-80">{cLabel}</span>
                      <span className="text-xs">{cBit}</span>
                    </div>
                  ))}
                  <span className="text-right text-[11px] font-semibold text-white">
                    +{adder.carryIn}
                  </span>
                </div>

                {/* Fila Operando A */}
                <div className="mt-1.5 grid grid-cols-[62px_repeat(5,minmax(0,1fr))_58px] items-center gap-1 text-center text-sm">
                  <span className="text-left text-[11px] font-semibold text-zinc-300">
                    Entr. A
                  </span>
                  <span className="text-xs text-zinc-600">0</span>
                  {[3, 2, 1, 0].map((idx) => {
                    const bit = adder.operandABits[idx]!;
                    return (
                      <span
                        key={`row-a-${idx}`}
                        className={
                          bit === 1 ? 'font-bold text-white' : 'text-zinc-500'
                        }
                      >
                        {bit}
                      </span>
                    );
                  })}
                  <span className="text-right text-xs text-zinc-200">{adder.operandA}</span>
                </div>

                {/* Fila Operando B */}
                <div className="mt-1 grid grid-cols-[62px_repeat(5,minmax(0,1fr))_58px] items-center gap-1 border-b border-zinc-800/80 pb-1.5 text-center text-sm">
                  <span className="text-left text-[11px] font-semibold text-zinc-300">
                    + Entr. B
                  </span>
                  <span className="text-xs text-zinc-600">0</span>
                  {[3, 2, 1, 0].map((idx) => {
                    const bit = adder.operandBBits[idx]!;
                    return (
                      <span
                        key={`row-b-${idx}`}
                        className={
                          bit === 1 ? 'font-bold text-white' : 'text-zinc-500'
                        }
                      >
                        {bit}
                      </span>
                    );
                  })}
                  <span className="text-right text-xs text-zinc-200">{adder.operandB}</span>
                </div>

                {/* Fila Resultado Total C4 S3 S2 S1 S0 */}
                <div className="mt-1.5 grid grid-cols-[62px_repeat(5,minmax(0,1fr))_58px] items-center gap-1 text-center text-sm">
                  <span className="text-left text-[11px] font-bold text-white">
                    = Suma
                  </span>
                  <span
                    className={`rounded py-0.5 font-bold ${
                      adder.carryOut === 1
                        ? 'bg-zinc-800 border border-zinc-700 text-white'
                        : 'text-zinc-600'
                    }`}
                    title="Acarreo de salida C4 (Cout)"
                  >
                    {adder.carryOut}
                  </span>
                  {[3, 2, 1, 0].map((idx) => {
                    const bit = adder.sumBits[idx]!;
                    return (
                      <span
                        key={`row-s-${idx}`}
                        className={`rounded py-0.5 font-bold ${
                          bit === 1
                            ? 'text-white'
                            : 'text-zinc-500'
                        }`}
                      >
                        {bit}
                      </span>
                    );
                  })}
                  <span className="text-right text-sm font-bold text-white">
                    {adder.totalValue}
                  </span>
                </div>
              </div>

              {/* Resumen equivalente en Decimal, Binario y Hexadecimal en Bento Cards */}
              <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-1.5">
                  <span className="block text-[9px] uppercase text-zinc-400">Decimal</span>
                  <span className="font-bold text-white">{adder.totalValue}</span>
                  <span className="block text-[9px] text-zinc-400">
                    Σ={adder.sumValue} · C4={adder.carryOut}
                  </span>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-1.5">
                  <span className="block text-[9px] uppercase text-zinc-400">Binario (5b)</span>
                  <span className="font-bold text-white">{adder.formatted.totalBinary5}</span>
                  <span className="block text-[9px] text-zinc-400">
                    S={adder.formatted.sumBinary4}
                  </span>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 px-2.5 py-1.5">
                  <span className="block text-[9px] uppercase text-zinc-400">Hexadecimal</span>
                  <span className="font-bold text-white">{adder.formatted.totalHex}</span>
                  <span className="block text-[9px] text-zinc-400">
                    S={adder.formatted.sumHex}
                  </span>
                </div>
              </div>

              {/* Desglose didáctico etapa por etapa (LSB -> MSB) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  <span>Propagación de etapas (Bit 0 → Bit 3)</span>
                  <span>Clic para trazar</span>
                </div>
                {adder.stages.map((st) => {
                  const sig = st.sumSignal as SignalCode;
                  const isTraced = tracedSignal === sig;
                  return (
                    <button
                      key={st.bitIndex}
                      type="button"
                      onClick={() => toggleTracedSignal(sig)}
                      className={`w-full cursor-pointer rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                        isTraced
                          ? 'border-white bg-zinc-900 ring-1 ring-white/40'
                          : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="font-semibold text-white">
                          Col {st.bitIndex}{' '}
                          <span className="text-[10px] font-normal text-zinc-400">
                            (peso {st.weight})
                          </span>
                        </span>
                        <span className="text-zinc-300">
                          {st.aSignal}({st.aBit}) + {st.bSignal}({st.bBit}) + {st.carryInName}(
                          {st.carryIn}) ={' '}
                          <strong className="text-white">{st.columnTotal}</strong>
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between font-mono text-[11px]">
                        <span
                          className={
                            st.sumBit === 1 ? 'font-semibold text-white' : 'text-zinc-500'
                          }
                        >
                          Resultado {st.sumSignal} = {st.sumBit}
                        </span>
                        <span
                          className={
                            st.carryOut === 1
                              ? 'font-semibold text-zinc-200'
                              : 'text-zinc-500'
                          }
                        >
                          {st.carryOut === 1
                            ? `Genera ${st.carryOutName} = 1 ↑`
                            : `${st.carryOutName} = 0`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
