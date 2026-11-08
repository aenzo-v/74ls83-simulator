import { CHIP_74LS83_MOUNTED_PINS } from '../../data/circuitLayout';
import { useLabStore } from '../../store/useLabStore';

export function PinoutModal() {
  const isOpen = useLabStore((s) => s.isHelpModalOpen);
  const setHelpModalOpen = useLabStore((s) => s.setHelpModalOpen);
  const setSelection = useLabStore((s) => s.setSelection);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pinout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090C10]/75 p-4 backdrop-blur-xs"
      onClick={() => setHelpModalOpen(false)}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#2D3B4E] bg-[#1C2430] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2D3B4E] px-5 py-3.5">
          <div>
            <h2 id="pinout-modal-title" className="text-base font-semibold text-[#E9EDF2]">
              Referencia Técnica — SN74LS83A (DIP-16)
            </h2>
            <p className="text-xs text-[#AEB8C5]">
              Tabla canónica de pines, equivalencia con hojas de datos y operación de cámara 3D
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpModalOpen(false)}
            className="cursor-pointer rounded-md border border-[#2D3B4E] bg-[#243041] px-2.5 py-1 text-xs font-medium text-[#E9EDF2] hover:border-[#35C2D1]/50"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#F1B85A]/35 bg-[#243041] p-3">
              <h3 className="font-semibold text-[#F1B85A]">
                Advertencia: 74LS83A frente a 74LS283
              </h3>
              <p className="mt-1 leading-relaxed text-[#AEB8C5]">
                Aunque ambos circuitos son sumadores completos de 4 bits funcionalmente idénticos,
                sus encapsulados DIP-16 <strong className="text-[#E9EDF2]">no son intercambiables</strong>.
                El 74LS83A recibe alimentación en <strong className="text-[#E9EDF2]">Pin 5 (VCC = +5 V)</strong>{' '}
                y <strong className="text-[#E9EDF2]">Pin 12 (GND)</strong>.
              </p>
            </div>
            <div className="rounded-lg border border-[#2D3B4E] bg-[#243041] p-3">
              <h3 className="font-semibold text-[#35C2D1]">Parámetros LS-TTL de referencia</h3>
              <p className="mt-1 leading-relaxed text-[#AEB8C5]">
                Tensión nominal <code className="text-[#E9EDF2]">VCC = 5.0 V</code>. Corriente de
                salida recomendada en nivel alto <code className="text-[#E9EDF2]">IOH = −0.4 mA</code>{' '}
                y sumidero en nivel bajo <code className="text-[#E9EDF2]">IOL = 8 mA</code>. Todo LED
                indicador requiere resistencia limitadora en serie.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#2D3B4E]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#2D3B4E] bg-[#243041] text-[11px] uppercase text-[#AEB8C5]">
                  <th className="px-3 py-2">Pin</th>
                  <th className="px-3 py-2">Señal</th>
                  <th className="px-3 py-2">Hoja TI</th>
                  <th className="px-3 py-2">Nodo Protoboard</th>
                  <th className="px-3 py-2">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232E3D] bg-[#141A23]">
                {CHIP_74LS83_MOUNTED_PINS.map(({ spec, holeId }) => (
                  <tr
                    key={spec.pinNumber}
                    onClick={() => {
                      setSelection({ kind: 'pin', pinNumber: spec.pinNumber });
                      setHelpModalOpen(false);
                    }}
                    className="cursor-pointer transition-colors hover:bg-[#243041]/60"
                  >
                    <td className="px-3 py-1.5 font-mono font-semibold text-[#F1B85A]">
                      {spec.pinNumber}
                    </td>
                    <td className="px-3 py-1.5 font-mono font-bold text-[#35C2D1]">
                      {spec.signal}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[#AEB8C5]">
                      {spec.datasheetAlias}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[#6DD19C]">{holeId}</td>
                    <td className="px-3 py-1.5 text-[#E9EDF2]">{spec.shortLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
