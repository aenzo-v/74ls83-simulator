import { useMemo } from 'react';
import { POWER_SUPPLY_5V } from '../../data/circuitLayout';
import { getHoleById } from '../../simulator/breadboard';
import {
  findComponentInCircuit,
  findWireInCircuit,
  getChipMountedTerminalsForColumn,
} from '../../simulator/editableCircuit';
import {
  useCircuitSolution,
  useDisplayedCircuit,
  useSignalTrace,
} from '../../store/useCircuitSolution';
import { type CameraPreset, useLabStore } from '../../store/useLabStore';

const CAMERA_BUTTONS: readonly { preset: CameraPreset; label: string }[] = [
  { preset: 'three-quarter', label: 'Vista 3/4' },
  { preset: 'top', label: 'Superior' },
  { preset: 'chip-closeup', label: 'Detalle 74LS83A' },
];

export function ViewportHud() {
  const mode = useLabStore((s) => s.mode);
  const cameraPreset = useLabStore((s) => s.cameraPreset);
  const requestCameraPreset = useLabStore((s) => s.requestCameraPreset);
  const resetCamera = useLabStore((s) => s.resetCamera);
  const hovered = useLabStore((s) => s.hovered);
  const selection = useLabStore((s) => s.selection);
  const setTracedSignal = useLabStore((s) => s.setTracedSignal);
  const setPowerSupplyOn = useLabStore((s) => s.setPowerSupplyOn);

  const circuit = useDisplayedCircuit();
  const solution = useCircuitSolution();
  const signalTrace = useSignalTrace();

  const mountedByPin = useMemo(() => {
    if (!circuit.chip) {
      return null;
    }
    return new Map(
      getChipMountedTerminalsForColumn(circuit.chip.startColumn).map((p) => [
        p.spec.pinNumber,
        p,
      ]),
    );
  }, [circuit.chip]);

  const firstError = solution.diagnostics.find((d) => d.severity === 'ERROR');

  // Construir lectura contextual superior izquierda
  let readoutText =
    mode === 'mounted'
      ? 'Banco listo · Conmuta A, B, C0 o la fuente +5 V y haz clic en cualquier elemento para inspeccionarlo'
      : 'Laboratorio editable · Usa Colocar y Cablear para armar el circuito 74LS83A sobre la protoboard';
  let badgeTone: 'neutral' | 'hover' | 'selected' = 'neutral';

  if (hovered.kind === 'pin') {
    const mounted = mountedByPin?.get(hovered.pinNumber);
    if (mounted) {
      const pinNet = solution.pins[hovered.pinNumber]?.netId ?? '—';
      readoutText = `Pin ${mounted.spec.pinNumber} · ${mounted.spec.signal} (${mounted.spec.shortLabel}) · Nodo ${mounted.holeId} · ${pinNet}`;
      badgeTone = 'hover';
    }
  } else if (hovered.kind === 'psu-terminal') {
    const isPlus = hovered.terminalId === POWER_SUPPLY_5V.plusTerminalId;
    const postNet = solution.terminalToNetId[hovered.terminalId] ?? '—';
    readoutText = `${isPlus ? 'Borne Fuente +5 V' : 'Borne Fuente GND'} (${hovered.terminalId}) · ${postNet}`;
    badgeTone = 'hover';
  } else if (hovered.kind === 'component') {
    const comp = findComponentInCircuit(circuit, hovered.componentId);
    if (comp) {
      readoutText = `${comp.label} (${comp.id})`;
      badgeTone = 'hover';
    }
  } else if (hovered.kind === 'wire') {
    const wire = findWireInCircuit(circuit, hovered.wireId);
    if (wire) {
      const wireNet = solution.wires[wire.id]?.netId ?? 'SIN-RED';
      readoutText = `${wire.label} · ${wire.fromTerminalId} → ${wire.toTerminalId} · ${wireNet}`;
      badgeTone = 'hover';
    }
  } else if (hovered.kind === 'hole') {
    const hole = getHoleById(hovered.holeId);
    if (hole) {
      const holeNet = solution.terminalToNetId[hole.id] ?? '—';
      readoutText = `${hole.label} · ${holeNet}`;
      badgeTone = 'hover';
    }
  } else if (hovered.kind === 'chip' && circuit.chip) {
    readoutText = `SN74LS83AN (DIP-16) · Columnas ${circuit.chip.startColumn}–${circuit.chip.startColumn + 7} · Filas e y f`;
    badgeTone = 'hover';
  } else if (selection.kind === 'pin') {
    const mounted = mountedByPin?.get(selection.pinNumber);
    if (mounted) {
      const pinNet = solution.pins[selection.pinNumber]?.netId ?? '—';
      readoutText = `Seleccionado: Pin ${mounted.spec.pinNumber} (${mounted.spec.signal}) · Pista ${mounted.stripLabel} · ${pinNet}`;
      badgeTone = 'selected';
    }
  } else if (selection.kind === 'component') {
    const comp = findComponentInCircuit(circuit, selection.componentId);
    if (comp) {
      readoutText = `Seleccionado: ${comp.label}`;
      badgeTone = 'selected';
    }
  } else if (selection.kind === 'wire') {
    const wire = findWireInCircuit(circuit, selection.wireId);
    if (wire) {
      const wireNet = solution.wires[wire.id]?.netId ?? 'SIN-RED';
      readoutText = `Cable ${wire.id}: ${wire.fromTerminalId} → ${wire.toTerminalId} (${wireNet})`;
      badgeTone = 'selected';
    }
  } else if (selection.kind === 'breadboard' && selection.holeId) {
    const hole = getHoleById(selection.holeId);
    if (hole) {
      const holeNet = solution.terminalToNetId[hole.id] ?? '—';
      readoutText = `Seleccionado: ${hole.label} · ${holeNet}`;
      badgeTone = 'selected';
    }
  } else if (selection.kind === 'chip' && circuit.chip) {
    readoutText = `Seleccionado: Integrado 74LS83A · Muesca izquierda (Pin 1 en f${circuit.chip.startColumn})`;
    badgeTone = 'selected';
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      {/* Fila superior: lectura técnica, ruta eléctrica resaltada y avisos de operación */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex max-w-2xl flex-col items-start gap-1.5">
          <div
            className={`pointer-events-auto inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs backdrop-blur-md ${
              badgeTone === 'hover'
                ? 'border-[#35C2D1]/50 bg-[#1C2430]/90 text-[#E9EDF2]'
                : badgeTone === 'selected'
                  ? 'border-[#F1B85A]/45 bg-[#1C2430]/90 text-[#E9EDF2]'
                  : 'border-[#2D3B4E] bg-[#1C2430]/80 text-[#AEB8C5]'
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                badgeTone === 'hover'
                  ? 'bg-[#35C2D1]'
                  : badgeTone === 'selected'
                    ? 'bg-[#F1B85A]'
                    : 'bg-[#AEB8C5]/60'
              }`}
            />
            <span className="font-mono text-[11px]">{readoutText}</span>
          </div>

          {/* Cinta informativa cuando se está trazando el recorrido de una señal */}
          {signalTrace && (
            <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 rounded-md border border-[#35C2D1]/55 bg-[#141A23]/92 px-3 py-1.5 text-xs text-[#E9EDF2] shadow-md backdrop-blur-md">
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#35C2D1] shadow-[0_0_6px_#35C2D1]" />
              <div className="min-w-0">
                <div className="font-mono text-[11px] font-semibold text-[#35C2D1]">
                  Recorrido eléctrico activo: {signalTrace.signal} (Pin {signalTrace.pinNumber}) ·{' '}
                  {signalTrace.wireIds.size} cable(s) · {signalTrace.stripIds.size} pista(s)
                </div>
                <p className="text-[11px] text-[#AEB8C5]">{signalTrace.summaryEs}</p>
              </div>
              <button
                type="button"
                onClick={() => setTracedSignal(null)}
                className="cursor-pointer rounded border border-[#2D3B4E] bg-[#243041] px-2 py-0.5 font-mono text-[10px] font-medium text-[#E9EDF2] transition-colors hover:border-[#35C2D1] hover:text-[#35C2D1]"
              >
                Quitar resaltado
              </button>
            </div>
          )}
        </div>

        {/* Aviso educativo flotante si la fuente está apagada o hay fallo eléctrico */}
        {(!solution.isPowerSupplyOn || firstError) && (
          <div
            role="status"
            className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-md border px-3 py-1.5 text-xs shadow-md backdrop-blur-md ${
              firstError
                ? 'border-[#F06A6A]/55 bg-[#1C1418]/92 text-[#E9EDF2]'
                : 'border-[#F1B85A]/55 bg-[#1C2026]/92 text-[#E9EDF2]'
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                firstError ? 'bg-[#F06A6A]' : 'bg-[#F1B85A]'
              }`}
            />
            <div className="min-w-0">
              <div
                className={`font-mono text-[11px] font-semibold ${
                  firstError ? 'text-[#F06A6A]' : 'text-[#F1B85A]'
                }`}
              >
                {firstError ? firstError.title : 'Fuente regulada +5.0 V en espera (STBY)'}
              </div>
              <p className="text-[11px] text-[#AEB8C5]">
                {firstError
                  ? firstError.message
                  : 'El 74LS83A no tiene VCC en Pin 5; sus salidas y LEDs permanecen apagados.'}
              </p>
            </div>
            {!solution.isPowerSupplyOn && (
              <button
                type="button"
                onClick={() => setPowerSupplyOn(true)}
                className="shrink-0 cursor-pointer rounded border border-[#6DD19C]/55 bg-[#6DD19C]/15 px-2 py-1 font-mono text-[10px] font-semibold text-[#6DD19C] hover:bg-[#6DD19C]/25"
              >
                Activar +5 V
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fila inferior: controles rápidos de cámara y guía de navegación */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div
          role="toolbar"
          aria-label="Vistas de cámara"
          className="pointer-events-auto flex items-center gap-1 rounded-lg border border-[#2D3B4E] bg-[#1C2430]/90 p-1 shadow-md backdrop-blur-md"
        >
          {CAMERA_BUTTONS.map(({ preset, label }) => {
            const active = cameraPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => requestCameraPreset(preset)}
                className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-[#243041] text-[#35C2D1] ring-1 ring-[#35C2D1]/40'
                    : 'text-[#AEB8C5] hover:bg-[#243041]/60 hover:text-[#E9EDF2]'
                }`}
              >
                {label}
              </button>
            );
          })}
          <div className="mx-0.5 h-4 w-px bg-[#2D3B4E]" />
          <button
            type="button"
            onClick={resetCamera}
            className="cursor-pointer rounded px-2 py-1 text-[11px] font-medium text-[#AEB8C5] transition-colors hover:bg-[#243041]/60 hover:text-[#E9EDF2]"
            title="Volver al encuadre inicial de laboratorio"
          >
            Encuadrar
          </button>
        </div>

        <div className="hidden rounded-md border border-[#2D3B4E]/80 bg-[#1C2430]/80 px-2.5 py-1 text-[11px] text-[#AEB8C5] backdrop-blur-md sm:block">
          Arrastrar: orbitar · Rueda: zoom · Clic derecho: desplazar
        </div>
      </div>
    </div>
  );
}
