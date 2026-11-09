import { useMemo } from 'react';
import { POWER_SUPPLY_5V } from '../../data/circuitLayout';
import { getHoleById } from '../../simulator/breadboard';
import {
  findComponentInCircuit,
  findWireInCircuit,
  getChipMountedTerminalsForColumn,
} from '../../simulator/editableCircuit';
import {
  useCircuitEnergyFlow,
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
  const isEnergyFlowVisible = useLabStore((s) => s.isEnergyFlowVisible);
  const toggleEnergyFlow = useLabStore((s) => s.toggleEnergyFlow);

  const circuit = useDisplayedCircuit();
  const solution = useCircuitSolution();
  const signalTrace = useSignalTrace();
  const energyFlow = useCircuitEnergyFlow();

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
      const wireFlow = energyFlow.wireFlows[wire.id];
      const flowSuffix =
        isEnergyFlowVisible && wireFlow?.isConducting ? ` · ⚡ ${wireFlow.descriptionEs}` : '';
      readoutText = `${wire.label} · ${wire.fromTerminalId} → ${wire.toTerminalId} · ${wireNet}${flowSuffix}`;
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
      const wireFlow = energyFlow.wireFlows[wire.id];
      const flowSuffix =
        isEnergyFlowVisible && wireFlow?.isConducting ? ` · ⚡ ${wireFlow.descriptionEs}` : '';
      readoutText = `Cable ${wire.id}: ${wire.fromTerminalId} → ${wire.toTerminalId} (${wireNet})${flowSuffix}`;
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
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3.5">
      {/* Fila superior: lectura técnica, ruta eléctrica resaltada y avisos de operación */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex max-w-2xl flex-col items-start gap-2">
          <div
            className={`pointer-events-auto inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-lg backdrop-blur-md transition-all ${
              badgeTone === 'hover'
                ? 'border-white/40 bg-zinc-950/90 text-white ring-1 ring-white/20'
                : badgeTone === 'selected'
                  ? 'border-zinc-500 bg-zinc-950/90 text-white'
                  : 'border-zinc-800 bg-zinc-950/80 text-zinc-400'
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                badgeTone === 'hover'
                  ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                  : badgeTone === 'selected'
                    ? 'bg-zinc-200'
                    : 'bg-zinc-600'
              }`}
            />
            <span className="font-mono text-[11px]">{readoutText}</span>
          </div>

          {/* Cinta informativa cuando se está trazando el recorrido de una señal */}
          {signalTrace && (
            <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 rounded-xl border border-zinc-700/80 bg-zinc-950/92 px-3.5 py-2 text-xs text-zinc-100 shadow-xl backdrop-blur-md">
              <span className="h-2 w-2 shrink-0 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
              <div className="min-w-0">
                <div className="font-mono text-[11px] font-semibold text-white">
                  Recorrido eléctrico activo: {signalTrace.signal} (Pin {signalTrace.pinNumber}) ·{' '}
                  {signalTrace.wireIds.size} cable(s) · {signalTrace.stripIds.size} pista(s)
                </div>
                <p className="text-[11px] text-zinc-400">{signalTrace.summaryEs}</p>
              </div>
              <button
                type="button"
                onClick={() => setTracedSignal(null)}
                className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono text-[10px] font-medium text-white transition-colors hover:bg-zinc-700 hover:border-zinc-500"
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
            className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs shadow-xl backdrop-blur-md ${
              firstError
                ? 'border-zinc-500 bg-zinc-950/95 text-white'
                : 'border-zinc-700 bg-zinc-950/95 text-zinc-200'
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                firstError ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'border border-zinc-400 bg-transparent'
              }`}
            />
            <div className="min-w-0">
              <div
                className={`font-mono text-[11px] font-semibold ${
                  firstError ? 'text-white' : 'text-zinc-200'
                }`}
              >
                {firstError ? firstError.title : 'Fuente regulada +5.0 V en espera (STBY)'}
              </div>
              <p className="text-[11px] text-zinc-400">
                {firstError
                  ? firstError.message
                  : 'El 74LS83A no tiene VCC en Pin 5; sus salidas y LEDs permanecen apagados.'}
              </p>
            </div>
            {!solution.isPowerSupplyOn && (
              <button
                type="button"
                onClick={() => setPowerSupplyOn(true)}
                className="shrink-0 cursor-pointer rounded-lg border border-white bg-white px-3 py-1 font-mono text-[10px] font-bold text-black hover:bg-zinc-200"
              >
                Activar +5 V
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fila inferior: controles rápidos de cámara y guía de navegación */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        {/* Controles de cámara */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="toolbar"
            aria-label="Vistas de cámara"
            className="pointer-events-auto flex items-center gap-1 rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-1 shadow-lg backdrop-blur-md"
          >
            {CAMERA_BUTTONS.map(({ preset, label }) => {
              const active = cameraPreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => requestCameraPreset(preset)}
                  className={`cursor-pointer rounded-lg px-3 py-1 text-[11px] font-medium transition-all ${
                    active
                      ? 'bg-white text-black font-semibold shadow-xs ring-1 ring-white/50'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <div className="mx-0.5 h-4 w-px bg-zinc-800" />
            <button
              type="button"
              onClick={resetCamera}
              className="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              title="Volver al encuadre inicial de laboratorio"
            >
              Encuadrar
            </button>
          </div>

          {/* Badge interactivo de flujo de energía */}
          <button
            type="button"
            onClick={toggleEnergyFlow}
            title={isEnergyFlowVisible ? 'Clic para ocultar flujo de energía' : 'Clic para mostrar flujo de energía'}
            className={`pointer-events-auto cursor-pointer flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-mono shadow-lg backdrop-blur-md transition-colors ${
              isEnergyFlowVisible
                ? 'border-[#35C2D1]/40 bg-zinc-950/90 text-zinc-200 hover:border-[#35C2D1]/70'
                : 'border-zinc-800/80 bg-zinc-950/80 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                !isEnergyFlowVisible
                  ? 'bg-zinc-600'
                  : energyFlow.isPowered
                    ? 'bg-[#3CE08D] shadow-[0_0_8px_rgba(60,224,141,0.8)] animate-pulse'
                    : 'bg-zinc-500'
              }`}
            />
            <span className="font-semibold">⚡ Flujo:</span>
            <span className={isEnergyFlowVisible && energyFlow.isPowered ? 'text-[#35C2D1]' : 'text-zinc-400'}>
              {!isEnergyFlowVisible
                ? 'Oculto'
                : energyFlow.isPowered
                  ? `${energyFlow.conductingWiresCount} conductores activos`
                  : 'STBY'}
            </span>
          </button>
        </div>

        <div className="hidden rounded-xl border border-zinc-800/80 bg-zinc-950/85 px-3 py-1.5 text-[11px] font-mono text-zinc-400 backdrop-blur-md shadow-md sm:block">
          Arrastrar: orbitar · Rueda: zoom · Clic derecho: desplazar
        </div>
      </div>
    </div>
  );
}
