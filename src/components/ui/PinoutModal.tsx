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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={() => setHelpModalOpen(false)}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 id="pinout-modal-title" className="text-base font-bold text-white">
              Referencia Técnica — SN74LS83A (DIP-16)
            </h2>
            <p className="text-xs text-zinc-400">
              Tabla canónica de pines, equivalencia con hojas de datos y operación de cámara 3D
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpModalOpen(false)}
            className="cursor-pointer rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 hover:border-zinc-500"
          >
            Cerrar
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-xs">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-3.5 shadow-sm">
              <h3 className="font-bold text-white">
                Advertencia: 74LS83A frente a 74LS283
              </h3>
              <p className="mt-1 leading-relaxed text-zinc-300">
                Aunque ambos circuitos son sumadores completos de 4 bits funcionalmente idénticos,
                sus encapsulados DIP-16 <strong className="text-white">no son intercambiables</strong>.
                El 74LS83A recibe alimentación en <strong className="text-white">Pin 5 (VCC = +5 V)</strong>{' '}
                y <strong className="text-white">Pin 12 (GND)</strong>.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 shadow-sm">
              <h3 className="font-bold text-white">Parámetros LS-TTL de referencia</h3>
              <p className="mt-1 leading-relaxed text-zinc-300">
                Tensión nominal <code className="text-white bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">VCC = 5.0 V</code>. Corriente de
                salida recomendada en nivel alto <code className="text-white bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">IOH = −0.4 mA</code>{' '}
                y sumidero en nivel bajo <code className="text-white bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">IOL = 8 mA</code>. Todo LED
                indicador requiere resistencia limitadora en serie.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-800 shadow-sm">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900 text-[11px] uppercase text-zinc-400 font-mono">
                  <th className="px-3.5 py-2.5">Pin</th>
                  <th className="px-3.5 py-2.5">Señal</th>
                  <th className="px-3.5 py-2.5">Hoja TI</th>
                  <th className="px-3.5 py-2.5">Nodo Protoboard</th>
                  <th className="px-3.5 py-2.5">Descripción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70 bg-zinc-950">
                {CHIP_74LS83_MOUNTED_PINS.map(({ spec, holeId }) => (
                  <tr
                    key={spec.pinNumber}
                    onClick={() => {
                      setSelection({ kind: 'pin', pinNumber: spec.pinNumber });
                      setHelpModalOpen(false);
                    }}
                    className="cursor-pointer transition-colors hover:bg-zinc-900/80"
                  >
                    <td className="px-3.5 py-2 font-mono font-bold text-white">
                      {spec.pinNumber}
                    </td>
                    <td className="px-3.5 py-2 font-mono font-bold text-white">
                      {spec.signal}
                    </td>
                    <td className="px-3.5 py-2 font-mono text-zinc-400">
                      {spec.datasheetAlias}
                    </td>
                    <td className="px-3.5 py-2 font-mono text-zinc-300">{holeId}</td>
                    <td className="px-3.5 py-2 text-zinc-200">{spec.shortLabel}</td>
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
