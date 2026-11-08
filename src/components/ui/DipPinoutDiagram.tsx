import { useMemo } from 'react';
import { getChipMountedTerminalsForColumn } from '../../simulator/editableCircuit';
import { PINOUT_74LS83A } from '../../simulator/pinout74ls83';
import type { PinNumber, PinRole } from '../../simulator/types';
import { useDisplayedCircuit } from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';

const TOP_ROW_PINS: readonly PinNumber[] = [16, 15, 14, 13, 12, 11, 10, 9];
const BOTTOM_ROW_PINS: readonly PinNumber[] = [1, 2, 3, 4, 5, 6, 7, 8];

function roleBadgeStyle(role: PinRole): string {
  switch (role) {
    case 'POWER':
      return 'text-[#F06A6A]';
    case 'GROUND':
      return 'text-[#7AA7E8]';
    case 'SUM_OUT':
    case 'CARRY_OUT':
      return 'text-[#6DD19C]';
    case 'CARRY_IN':
      return 'text-[#F1B85A]';
    case 'INPUT_A':
    case 'INPUT_B':
      return 'text-[#E9EDF2]';
  }
}

export function DipPinoutDiagram() {
  const mode = useLabStore((s) => s.mode);
  const selection = useLabStore((s) => s.selection);
  const hovered = useLabStore((s) => s.hovered);
  const setSelection = useLabStore((s) => s.setSelection);
  const setHovered = useLabStore((s) => s.setHovered);
  const setActiveKitItem = useLabStore((s) => s.setActiveKitItem);

  const circuit = useDisplayedCircuit();
  const chip = circuit.chip;

  const mountedByPin = useMemo(() => {
    if (!chip) {
      return null;
    }
    const entries = getChipMountedTerminalsForColumn(chip.startColumn);
    return new Map(entries.map((e) => [e.spec.pinNumber, e]));
  }, [chip]);

  const renderPinButton = (pinNumber: PinNumber, position: 'top' | 'bottom') => {
    const mounted = mountedByPin?.get(pinNumber);
    const spec = mounted?.spec ?? PINOUT_74LS83A.find((p) => p.pinNumber === pinNumber)!;
    const holeLabel = mounted ? mounted.holeId : '—';

    const isSelected = selection.kind === 'pin' && selection.pinNumber === pinNumber;
    const isHovered = hovered.kind === 'pin' && hovered.pinNumber === pinNumber;

    return (
      <button
        key={pinNumber}
        type="button"
        disabled={!chip}
        onClick={() => setSelection({ kind: 'pin', pinNumber })}
        onMouseEnter={() => {
          if (chip) {
            setHovered({ kind: 'pin', pinNumber });
          }
        }}
        onMouseLeave={() => {
          if (hovered.kind === 'pin' && hovered.pinNumber === pinNumber) {
            setHovered({ kind: 'none' });
          }
        }}
        title={
          mounted
            ? `Pin ${pinNumber}: ${spec.signal} (${spec.shortLabel}) — Nodo ${mounted.holeId}`
            : `Pin ${pinNumber}: ${spec.signal} (${spec.shortLabel}) — Inserta primero el 74LS83A`
        }
        className={`group flex flex-col items-center rounded border px-1 py-1 font-mono transition-colors ${
          !chip
            ? 'cursor-default border-[#253142] bg-[#141A23]/60 opacity-75'
            : isSelected
              ? 'cursor-pointer border-[#F1B85A] bg-[#F1B85A]/15'
              : isHovered
                ? 'cursor-pointer border-[#35C2D1] bg-[#35C2D1]/15'
                : 'cursor-pointer border-[#2D3B4E] bg-[#141A23] hover:border-[#35C2D1]/50'
        }`}
      >
        {position === 'top' ? (
          <>
            <span className="text-[9px] text-[#AEB8C5]">{holeLabel}</span>
            <span className={`text-[11px] font-bold ${roleBadgeStyle(spec.role)}`}>
              {spec.signal}
            </span>
            <span className="text-[9px] text-[#AEB8C5]">P{pinNumber}</span>
          </>
        ) : (
          <>
            <span className="text-[9px] text-[#AEB8C5]">P{pinNumber}</span>
            <span className={`text-[11px] font-bold ${roleBadgeStyle(spec.role)}`}>
              {spec.signal}
            </span>
            <span className="text-[9px] text-[#AEB8C5]">{holeLabel}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="rounded-lg border border-[#2D3B4E] bg-[#243041]/65 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#AEB8C5]">
          Mapa DIP-16 (Vista superior)
        </span>
        {chip ? (
          <button
            type="button"
            onClick={() => setSelection({ kind: 'chip' })}
            className="cursor-pointer font-mono text-[10px] text-[#35C2D1] hover:underline"
          >
            Ver encapsulado
          </button>
        ) : (
          mode === 'guided' && (
            <button
              type="button"
              onClick={() => setActiveKitItem('ic-74ls83a')}
              className="cursor-pointer rounded border border-[#35C2D1]/55 bg-[#35C2D1]/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#35C2D1] hover:bg-[#35C2D1]/25"
            >
              Colocar 74LS83A
            </button>
          )
        )}
      </div>

      {/* Fila superior: Pines 16..9 en fila 'e' */}
      <div className="grid grid-cols-8 gap-1">
        {TOP_ROW_PINS.map((pin) => renderPinButton(pin, 'top'))}
      </div>

      {/* Cuerpo esquemático central con muesca izquierda y marca Pin 1 */}
      <div className="relative my-1.5 flex h-9 items-center justify-between rounded border border-[#2D3B4E] bg-[#141A23] px-3">
        <div
          aria-hidden="true"
          className="absolute -left-px top-1/2 h-4 w-2 -translate-y-1/2 rounded-r-full border border-l-0 border-[#3D5068] bg-[#1C2430]"
        />
        <div className="flex items-center gap-1.5 pl-1">
          <span className="h-2 w-2 rounded-full bg-[#F1B85A]" title="Indicador Pin 1" />
          <span className="font-mono text-[10px] text-[#AEB8C5]">Muesca Izq.</span>
        </div>
        <span className="font-mono text-xs font-bold tracking-wider text-[#E9EDF2]">
          SN74LS83AN
        </span>
        <span className="font-mono text-[10px] text-[#AEB8C5]">
          {chip ? `Col ${chip.startColumn}–${chip.startColumn + 7}` : 'Sin insertar'}
        </span>
      </div>

      {/* Fila inferior: Pines 1..8 en fila 'f' */}
      <div className="grid grid-cols-8 gap-1">
        {BOTTOM_ROW_PINS.map((pin) => renderPinButton(pin, 'bottom'))}
      </div>
    </div>
  );
}
