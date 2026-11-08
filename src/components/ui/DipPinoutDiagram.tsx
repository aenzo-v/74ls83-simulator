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
      return 'text-white font-extrabold';
    case 'GROUND':
      return 'text-zinc-300 font-semibold';
    case 'SUM_OUT':
    case 'CARRY_OUT':
      return 'text-white font-bold';
    case 'CARRY_IN':
      return 'text-zinc-200 font-semibold';
    case 'INPUT_A':
    case 'INPUT_B':
      return 'text-zinc-300 font-medium';
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
        className={`group flex flex-col items-center rounded-lg border px-1 py-1 font-mono transition-all ${
          !chip
            ? 'cursor-default border-zinc-900 bg-zinc-950/60 opacity-60'
            : isSelected
              ? 'cursor-pointer border-white bg-white text-black font-bold ring-2 ring-white/50 shadow-xs'
              : isHovered
                ? 'cursor-pointer border-zinc-500 bg-zinc-800 text-white'
                : 'cursor-pointer border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-white'
        }`}
      >
        {position === 'top' ? (
          <>
            <span className={`text-[9px] ${isSelected ? 'text-zinc-700' : 'text-zinc-500'}`}>{holeLabel}</span>
            <span className={`text-[11px] font-bold ${isSelected ? 'text-black' : roleBadgeStyle(spec.role)}`}>
              {spec.signal}
            </span>
            <span className={`text-[9px] ${isSelected ? 'text-zinc-700' : 'text-zinc-500'}`}>P{pinNumber}</span>
          </>
        ) : (
          <>
            <span className={`text-[9px] ${isSelected ? 'text-zinc-700' : 'text-zinc-500'}`}>P{pinNumber}</span>
            <span className={`text-[11px] font-bold ${isSelected ? 'text-black' : roleBadgeStyle(spec.role)}`}>
              {spec.signal}
            </span>
            <span className={`text-[9px] ${isSelected ? 'text-zinc-700' : 'text-zinc-500'}`}>{holeLabel}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
          Mapa DIP-16 (Vista superior)
        </span>
        {chip ? (
          <button
            type="button"
            onClick={() => setSelection({ kind: 'chip' })}
            className="cursor-pointer font-mono text-[10px] text-zinc-300 hover:text-white hover:underline"
          >
            Ver encapsulado
          </button>
        ) : (
          mode === 'guided' && (
            <button
              type="button"
              onClick={() => setActiveKitItem('ic-74ls83a')}
              className="cursor-pointer rounded-lg border border-zinc-600 bg-zinc-800 px-2 py-0.5 font-mono text-[10px] font-semibold text-white hover:bg-zinc-700"
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
      <div className="relative my-2 flex h-9 items-center justify-between rounded-lg border border-zinc-700/80 bg-zinc-950 px-3">
        <div
          aria-hidden="true"
          className="absolute -left-px top-1/2 h-4 w-2 -translate-y-1/2 rounded-r-full border border-l-0 border-zinc-600 bg-zinc-900"
        />
        <div className="flex items-center gap-1.5 pl-1">
          <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" title="Indicador Pin 1" />
          <span className="font-mono text-[10px] text-zinc-400">Muesca Izq.</span>
        </div>
        <span className="font-mono text-xs font-bold tracking-wider text-white">
          SN74LS83AN
        </span>
        <span className="font-mono text-[10px] text-zinc-400">
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
