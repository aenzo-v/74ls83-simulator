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
      className="rounded-lg border border-[#35C2D1]/35 bg-[#243041] p-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#35C2D1]">
            Análisis Aritmético · 74LS83A
          </span>
          <h3 className="text-sm font-semibold text-[#E9EDF2]">
            Suma binaria columna por columna
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="cursor-pointer rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-0.5 font-mono text-[10px] text-[#AEB8C5] transition-colors hover:border-[#35C2D1]/50 hover:text-[#E9EDF2]"
        >
          {isExpanded ? 'Contraer' : 'Expandir'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {!adder ? (
            <div className="space-y-2.5 rounded-md border border-[#F1B85A]/45 bg-[#141A23] p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-[#F1B85A]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#F1B85A]" />
                <span>
                  {!solution.isPowerSupplyOn
                    ? 'Circuito sin energía (+5.0 V en espera)'
                    : firstError?.title ?? 'Operación invalidada por fallo eléctrico'}
                </span>
              </div>
              <p className="leading-relaxed text-[#AEB8C5]">
                {!solution.isPowerSupplyOn
                  ? 'El SN74LS83A requiere +5.0 V en el Pin 5 (VCC) y 0 V en el Pin 12 (GND) para polarizar sus etapas TTL internas de acarreo anticipado. Aunque muevas los interruptores DIP, las salidas S3..S0 y C4 no conducen corriente mientras la fuente permanezca apagada.'
                  : firstError?.message ??
                    'Revisa la alimentación y que las 9 entradas tengan niveles lógicos válidos.'}
              </p>
              {!solution.isPowerSupplyOn && (
                <button
                  type="button"
                  onClick={() => setPowerSupplyOn(true)}
                  className="w-full cursor-pointer rounded-md border border-[#6DD19C]/50 bg-[#6DD19C]/15 px-3 py-1.5 font-mono text-xs font-semibold text-[#6DD19C] transition-colors hover:bg-[#6DD19C]/25"
                >
                  Encender fuente regulada +5.0 V
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Matriz alineada de 5 columnas: Cout (peso 16) + 4 bits (pesos 8, 4, 2, 1) */}
              <div className="rounded-md border border-[#2D3B4E] bg-[#141A23] p-2.5 font-mono">
                {/* Encabezado de pesos posicionales */}
                <div className="grid grid-cols-[62px_repeat(5,minmax(0,1fr))_58px] items-center gap-1 border-b border-[#232E3D] pb-1.5 text-center text-[10px] text-[#AEB8C5]">
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
                  <span className="text-left text-[10px] text-[#F1B85A]">Acarreo</span>
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
                          ? 'bg-[#F1B85A]/20 font-bold text-[#F1B85A] ring-1 ring-[#F1B85A]/45'
                          : 'text-[#AEB8C5]/65'
                      }`}
                      title={`${cLabel} = ${cBit}`}
                    >
                      <span className="block text-[9px] leading-none opacity-80">{cLabel}</span>
                      <span className="text-xs">{cBit}</span>
                    </div>
                  ))}
                  <span className="text-right text-[11px] text-[#F1B85A]">
                    +{adder.carryIn}
                  </span>
                </div>

                {/* Fila Operando A */}
                <div className="mt-1.5 grid grid-cols-[62px_repeat(5,minmax(0,1fr))_58px] items-center gap-1 text-center text-sm">
                  <span className="text-left text-[11px] font-semibold text-[#35C2D1]">
                    Entr. A
                  </span>
                  <span className="text-xs text-[#AEB8C5]/40">0</span>
                  {[3, 2, 1, 0].map((idx) => {
                    const bit = adder.operandABits[idx]!;
                    return (
                      <span
                        key={`row-a-${idx}`}
                        className={
                          bit === 1 ? 'font-bold text-[#35C2D1]' : 'text-[#E9EDF2]/80'
                        }
                      >
                        {bit}
                      </span>
                    );
                  })}
                  <span className="text-right text-xs text-[#E9EDF2]">{adder.operandA}</span>
                </div>

                {/* Fila Operando B */}
                <div className="mt-1 grid grid-cols-[62px_repeat(5,minmax(0,1fr))_58px] items-center gap-1 border-b border-[#2D3B4E] pb-1.5 text-center text-sm">
                  <span className="text-left text-[11px] font-semibold text-[#9D8CFF]">
                    + Entr. B
                  </span>
                  <span className="text-xs text-[#AEB8C5]/40">0</span>
                  {[3, 2, 1, 0].map((idx) => {
                    const bit = adder.operandBBits[idx]!;
                    return (
                      <span
                        key={`row-b-${idx}`}
                        className={
                          bit === 1 ? 'font-bold text-[#B3A6FF]' : 'text-[#E9EDF2]/80'
                        }
                      >
                        {bit}
                      </span>
                    );
                  })}
                  <span className="text-right text-xs text-[#E9EDF2]">{adder.operandB}</span>
                </div>

                {/* Fila Resultado Total C4 S3 S2 S1 S0 */}
                <div className="mt-1.5 grid grid-cols-[62px_repeat(5,minmax(0,1fr))_58px] items-center gap-1 text-center text-sm">
                  <span className="text-left text-[11px] font-semibold text-[#6DD19C]">
                    = Suma
                  </span>
                  <span
                    className={`rounded py-0.5 font-bold ${
                      adder.carryOut === 1
                        ? 'bg-[#F1B85A]/20 text-[#FFB238]'
                        : 'text-[#AEB8C5]/75'
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
                            ? 'bg-[#6DD19C]/20 text-[#6DD19C]'
                            : 'text-[#E9EDF2]/85'
                        }`}
                      >
                        {bit}
                      </span>
                    );
                  })}
                  <span className="text-right text-sm font-bold text-[#6DD19C]">
                    {adder.totalValue}
                  </span>
                </div>
              </div>

              {/* Resumen equivalente en Decimal, Binario y Hexadecimal */}
              <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-xs">
                <div className="rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-1.5">
                  <span className="block text-[9px] uppercase text-[#AEB8C5]">Decimal</span>
                  <span className="font-bold text-[#E9EDF2]">{adder.totalValue}</span>
                  <span className="block text-[9px] text-[#AEB8C5]">
                    Σ={adder.sumValue} · C4={adder.carryOut}
                  </span>
                </div>
                <div className="rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-1.5">
                  <span className="block text-[9px] uppercase text-[#AEB8C5]">Binario (5b)</span>
                  <span className="font-bold text-[#6DD19C]">{adder.formatted.totalBinary5}</span>
                  <span className="block text-[9px] text-[#AEB8C5]">
                    S={adder.formatted.sumBinary4}
                  </span>
                </div>
                <div className="rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-1.5">
                  <span className="block text-[9px] uppercase text-[#AEB8C5]">Hexadecimal</span>
                  <span className="font-bold text-[#35C2D1]">{adder.formatted.totalHex}</span>
                  <span className="block text-[9px] text-[#AEB8C5]">
                    S={adder.formatted.sumHex}
                  </span>
                </div>
              </div>

              {/* Desglose didáctico etapa por etapa (LSB -> MSB) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#AEB8C5]">
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
                      className={`w-full cursor-pointer rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                        isTraced
                          ? 'border-[#35C2D1] bg-[#35C2D1]/15'
                          : 'border-[#2D3B4E] bg-[#141A23] hover:border-[#35C2D1]/45'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="font-semibold text-[#E9EDF2]">
                          Col {st.bitIndex}{' '}
                          <span className="text-[10px] font-normal text-[#AEB8C5]">
                            (peso {st.weight})
                          </span>
                        </span>
                        <span className="text-[#AEB8C5]">
                          {st.aSignal}({st.aBit}) + {st.bSignal}({st.bBit}) + {st.carryInName}(
                          {st.carryIn}) ={' '}
                          <strong className="text-[#E9EDF2]">{st.columnTotal}</strong>
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between font-mono text-[11px]">
                        <span
                          className={
                            st.sumBit === 1 ? 'font-semibold text-[#6DD19C]' : 'text-[#AEB8C5]'
                          }
                        >
                          Resultado {st.sumSignal} = {st.sumBit}
                        </span>
                        <span
                          className={
                            st.carryOut === 1
                              ? 'font-semibold text-[#F1B85A]'
                              : 'text-[#AEB8C5]/80'
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
