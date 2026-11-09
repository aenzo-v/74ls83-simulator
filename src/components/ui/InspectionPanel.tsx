import { useMemo } from 'react';
import {
  CHIP_74LS83_PLACEMENT,
  createCanonicalCircuitInput,
  POWER_SUPPLY_5V,
} from '../../data/circuitLayout';
import { getHoleById, getStripHoles } from '../../simulator/breadboard';
import type { ResistorBandColor } from '../../simulator/components';
import {
  findComponentInCircuit,
  findWireInCircuit,
  getChipMountedTerminalsForColumn,
  getOccupiedTerminals,
  WIRE_COLOR_PALETTE,
  workingCircuitToSolverInput,
} from '../../simulator/editableCircuit';
import { areComponentNetlistsEquivalent, type NetDriveState } from '../../simulator/netlist';
import { getPinSpecBySignal } from '../../simulator/pinout74ls83';
import type { PinDirection, SignalCode } from '../../simulator/types';
import {
  useActiveSwitchStates,
  useCircuitEnergyFlow,
  useCircuitSolution,
  useDisplayedCircuit,
} from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';
import { BinarySumBreakdown } from './BinarySumBreakdown';
import { DipPinoutDiagram } from './DipPinoutDiagram';
import { GuidedAssemblyPanel } from './GuidedAssemblyPanel';

function directionLabel(direction: PinDirection): string {
  switch (direction) {
    case 'INPUT':
      return 'Entrada lógica TTL';
    case 'OUTPUT':
      return 'Salida lógica TTL';
    case 'SUPPLY':
      return 'Alimentación / Referencia';
  }
}

function formatPinElectricalState(drive: NetDriveState, logicLevel: 0 | 1 | null): string {
  switch (drive) {
    case 'STRONG_HIGH':
      return '+5.0 V · ALTO (1)';
    case 'STRONG_LOW':
      return '0 V (GND) · BAJO (0)';
    case 'WEAK_HIGH':
      return 'ALTO (1) resistivo';
    case 'WEAK_LOW':
      return 'BAJO (0) pull-down';
    case 'IC_HIGH':
      return 'Salida ALTO (1)';
    case 'IC_LOW':
      return 'Salida BAJO (0)';
    case 'UNPOWERED':
      return 'Sin alimentar (STBY)';
    case 'FLOATING':
      return 'Flotante (indefinido)';
    case 'SHORT_CIRCUIT':
      return 'Cortocircuito';
    case 'CONFLICT':
      return logicLevel === null ? 'Conflicto eléctrico' : `Nivel ${logicLevel}`;
  }
}

function getSignalWeightDescription(signal: SignalCode): string {
  switch (signal) {
    case 'A3':
    case 'B3':
    case 'S3':
      return 'Bit 3 (MSB · peso 2³ = 8)';
    case 'A2':
    case 'B2':
    case 'S2':
      return 'Bit 2 (peso 2² = 4)';
    case 'A1':
    case 'B1':
    case 'S1':
      return 'Bit 1 (peso 2¹ = 2)';
    case 'A0':
    case 'B0':
    case 'S0':
      return 'Bit 0 (LSB · peso 2⁰ = 1)';
    case 'C0':
      return 'Acarreo inicial Cin (peso 2⁰ = 1)';
    case 'C4':
      return 'Acarreo final Cout (peso 2⁴ = 16)';
    case 'VCC':
      return 'Alimentación nominal +5.0 V CC';
    case 'GND':
      return 'Referencia común 0 V (masa)';
  }
}

function getWireCategoryDescription(signal: SignalCode | undefined, colorHex: string): string {
  if (signal === 'VCC' || colorHex.toLowerCase() === '#d84a4a') {
    return 'Aislamiento rojo · Convención sugerida: +5.0 V (VCC)';
  }
  if (signal === 'GND' || colorHex.toLowerCase() === '#3b6ea8') {
    return 'Aislamiento azul · Convención sugerida: 0 V (GND)';
  }
  if (signal?.startsWith('A')) {
    return 'Canal de entrada del sumando A hacia el 74LS83A';
  }
  if (signal?.startsWith('B')) {
    return 'Canal de entrada del sumando B hacia el 74LS83A';
  }
  if (signal === 'C0' || signal === 'C4') {
    return 'Línea de propagación de acarreo binario';
  }
  if (signal?.startsWith('S')) {
    return 'Salida de suma TTL hacia etapa indicadora LED';
  }
  return 'Conductor jumper entre contactos de la protoboard';
}

const BAND_NAMES_ES: Record<ResistorBandColor, string> = {
  BLACK: 'Negro',
  BROWN: 'Marrón',
  RED: 'Rojo',
  ORANGE: 'Naranja',
  YELLOW: 'Amarillo',
  GREEN: 'Verde',
  BLUE: 'Azul',
  VIOLET: 'Violeta',
  GRAY: 'Gris',
  WHITE: 'Blanco',
  GOLD: 'Oro',
};

const NEUTRAL_SWITCH_STATES: Readonly<Record<string, boolean>> = Object.freeze({
  [POWER_SUPPLY_5V.id]: true,
});

export function InspectionPanel() {
  const mode = useLabStore((s) => s.mode);
  const selection = useLabStore((s) => s.selection);
  const tracedSignal = useLabStore((s) => s.tracedSignal);
  const setSelection = useLabStore((s) => s.setSelection);
  const requestCameraPreset = useLabStore((s) => s.requestCameraPreset);
  const toggleSwitchState = useLabStore((s) => s.toggleSwitchState);
  const toggleTracedSignal = useLabStore((s) => s.toggleTracedSignal);

  const guidedActiveTab = useLabStore((s) => s.guidedActiveTab);
  const setGuidedActiveTab = useLabStore((s) => s.setGuidedActiveTab);
  const guidedCurrentStageIndex = useLabStore((s) => s.guidedCurrentStageIndex);

  const startWireDraft = useLabStore((s) => s.startWireDraft);
  const beginWireReconnect = useLabStore((s) => s.beginWireReconnect);
  const changeWireColor = useLabStore((s) => s.changeWireColor);
  const deleteWire = useLabStore((s) => s.deleteWire);
  const requestComponentRemoval = useLabStore((s) => s.requestComponentRemoval);

  const circuit = useDisplayedCircuit();
  const switchStates = useActiveSwitchStates();
  const solution = useCircuitSolution();
  const energyFlow = useCircuitEnergyFlow();

  const mountedPins = useMemo(
    () => (circuit.chip ? getChipMountedTerminalsForColumn(circuit.chip.startColumn) : []),
    [circuit.chip],
  );

  const occupied = useMemo(() => getOccupiedTerminals(circuit), [circuit]);

  const isEquivalentToReference = useMemo(() => {
    if (mode !== 'guided' || !circuit.chip) {
      return false;
    }
    const refInput = createCanonicalCircuitInput(NEUTRAL_SWITCH_STATES);
    const workInput = workingCircuitToSolverInput(circuit, NEUTRAL_SWITCH_STATES);
    return areComponentNetlistsEquivalent(refInput, workInput);
  }, [circuit, mode]);

  const renderTraceButton = (signal: SignalCode) => {
    const active = tracedSignal === signal;
    return (
      <button
        type="button"
        onClick={() => toggleTracedSignal(signal)}
        className={`w-full cursor-pointer rounded-xl border px-3 py-2 font-mono text-xs font-semibold transition-all ${
          active
            ? 'border-white bg-white text-black font-bold shadow-xs'
            : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 hover:text-white'
        }`}
      >
        {active
          ? `Quitar resaltado eléctrico (${signal})`
          : `Resaltar recorrido eléctrico de ${signal}`}
      </button>
    );
  };

  const renderRemoveComponentButton = (componentId: string, labelEs: string) => {
    if (mode !== 'guided') {
      return null;
    }
    return (
      <button
        type="button"
        onClick={() => requestComponentRemoval(componentId)}
        className="w-full cursor-pointer rounded-xl border border-zinc-600 bg-zinc-900 px-3 py-2 font-mono text-xs font-semibold text-white transition-all hover:border-zinc-400 hover:bg-zinc-800"
      >
        {labelEs}
      </button>
    );
  };

  const hasSpecificSelection =
    selection.kind !== 'chip' && selection.kind !== 'none';

  return (
    <aside
      aria-label="Panel técnico de inspección y guía"
      className="flex h-full w-92 shrink-0 flex-col rounded-2xl border border-zinc-800/80 bg-zinc-950/95 text-zinc-100 shadow-sm overflow-hidden xl:w-96"
    >
      {/* Pestañas en modo guiado */}
      {mode === 'guided' && (
        <div className="flex shrink-0 gap-1.5 border-b border-zinc-800/80 bg-zinc-900/60 p-2">
          <button
            type="button"
            onClick={() => setGuidedActiveTab('guide')}
            className={`flex-1 cursor-pointer rounded-xl py-1.5 text-center font-mono text-xs font-semibold transition-all ${
              guidedActiveTab === 'guide'
                ? 'bg-white text-black font-semibold shadow-xs ring-1 ring-white/50'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Guía de Montaje ({guidedCurrentStageIndex + 1}/9)
          </button>
          <button
            type="button"
            onClick={() => setGuidedActiveTab('inspector')}
            className={`flex-1 cursor-pointer rounded-xl py-1.5 text-center font-mono text-xs font-semibold transition-all ${
              guidedActiveTab === 'inspector'
                ? 'bg-white text-black font-semibold shadow-xs ring-1 ring-white/50'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Inspector Técnico
          </button>
        </div>
      )}

      {mode === 'guided' && guidedActiveTab === 'guide' ? (
        <div className="flex-1 overflow-hidden">
          <GuidedAssemblyPanel />
        </div>
      ) : (
        <>
          {/* Cabecera del panel técnico */}
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/80 px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
                {mode === 'guided' ? 'Inspector Técnico' : 'Inspector y Análisis Binario'}
              </h2>
              <p className="text-[11px] text-zinc-400">
                {mode === 'guided'
                  ? 'Verificación eléctrica de componentes y nodos'
                  : 'Sincronizado en tiempo real con el motor eléctrico'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => requestCameraPreset('chip-closeup')}
              className="cursor-pointer rounded-xl border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-white transition-all hover:border-zinc-500 hover:bg-zinc-700"
            >
              Acercar IC
            </button>
          </div>

          <div className="flex-1 space-y-3.5 overflow-y-auto p-3.5">
        {/* Tarjeta del integrado cuando está seleccionado en modo editable */}
        {mode === 'guided' && selection.kind === 'chip' && circuit.chip && (
          <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  INTEGRADO MONTADO · DIP-16
                </span>
                <h3 className="text-sm font-semibold text-white">
                  {CHIP_74LS83_PLACEMENT.partNumber} ({CHIP_74LS83_PLACEMENT.shortName})
                </h3>
              </div>
              <span className="rounded-lg border border-zinc-750 bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-200">
                Col {circuit.chip.startColumn}–{circuit.chip.startColumn + 7}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2.5 text-xs">
              <div>
                <span className="block text-[10px] uppercase text-zinc-400">
                  Pin 5 · VCC (+5 V)
                </span>
                <span className="font-mono text-white">
                  f{circuit.chip.startColumn + 4} ({solution.pins[5]?.netId ?? '—'})
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-zinc-400">
                  Pin 12 · GND (0 V)
                </span>
                <span className="font-mono text-zinc-300">
                  e{circuit.chip.startColumn + 4} ({solution.pins[12]?.netId ?? '—'})
                </span>
              </div>
            </div>

            {renderRemoveComponentButton(circuit.chip.id, 'Retirar 74LS83A de la protoboard')}
          </section>
        )}

        {/* Tarjeta contextual inmediata cuando el usuario selecciona un pin */}
        {selection.kind === 'pin' && (() => {
          const mounted = mountedPins.find((p) => p.spec.pinNumber === selection.pinNumber);
          if (!mounted) {
            return null;
          }
          const { spec, holeId, stripLabel } = mounted;
          const pinState = solution.pins[selection.pinNumber];
          const net = pinState?.netId ? solution.nets[pinState.netId] : undefined;

          return (
            <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    PIN {spec.pinNumber} · SN74LS83A
                  </span>
                  <h3 className="text-sm font-semibold text-white">
                    {spec.signal} — {spec.shortLabel}
                  </h3>
                </div>
                <span className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-white">
                  Nodo {holeId}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2.5 text-xs">
                <div>
                  <span className="block text-[10px] uppercase text-zinc-400">
                    Hoja de datos TI
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {spec.datasheetAlias}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-zinc-400">Tipo</span>
                  <span className="font-medium text-zinc-200">
                    {directionLabel(spec.direction)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-zinc-400">
                    Pista / Red
                  </span>
                  <span className="font-mono text-zinc-300">
                    {stripLabel} · {pinState?.netId ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-zinc-400">
                    Estado eléctrico
                  </span>
                  <span
                    className={`font-mono ${
                      pinState?.logicLevel === 1
                        ? 'font-bold text-white'
                        : pinState?.logicLevel === 0
                          ? 'text-zinc-300'
                          : 'text-zinc-400'
                    }`}
                  >
                    {pinState
                      ? formatPinElectricalState(pinState.drive, pinState.logicLevel)
                      : '—'}
                  </span>
                </div>
              </div>

              {renderTraceButton(spec.signal)}

              {net && net.wireIds.length > 0 && (
                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-2.5 py-2 text-[11px]">
                  <span className="block text-[10px] uppercase text-zinc-400">
                    Cables conectados a esta red
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {net.wireIds.map((wId) => (
                      <button
                        key={wId}
                        type="button"
                        onClick={() => setSelection({ kind: 'wire', wireId: wId })}
                        className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-850 px-1.5 py-0.5 font-mono text-[10px] text-white hover:border-zinc-500"
                      >
                        {wId}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs leading-relaxed text-zinc-300">{spec.summary}</p>
              <p className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2.5 text-[11px] leading-relaxed text-zinc-400">
                {spec.educationalNote}
              </p>
            </section>
          );
        })()}

        {selection.kind === 'component' && (() => {
          const comp = findComponentInCircuit(circuit, selection.componentId);
          if (!comp) {
            return null;
          }

          if (comp.kind === 'dip-switch') {
            const focusedChannel = selection.subChannelId
              ? comp.channels.find((c) => c.id === selection.subChannelId)
              : undefined;

            return (
              <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    INTERRUPTOR DIP · {comp.id.toUpperCase()} (COL {comp.startColumn}–{comp.endColumn})
                  </span>
                  <h3 className="text-sm font-semibold text-white">{comp.label}</h3>
                </div>
                <p className="text-xs leading-relaxed text-zinc-400">{comp.description}</p>

                {focusedChannel && (() => {
                  const targetPin = getPinSpecBySignal(focusedChannel.signal);
                  return (
                    <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-950/80 p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-white">
                          Canal activo: {focusedChannel.signal}
                        </span>
                        {circuit.chip && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelection({ kind: 'pin', pinNumber: targetPin.pinNumber })
                            }
                            className="cursor-pointer font-mono text-[11px] text-zinc-300 hover:text-white hover:underline"
                          >
                            Ir a Pin {targetPin.pinNumber}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {getSignalWeightDescription(focusedChannel.signal)} · Terminales{' '}
                        {focusedChannel.inputHoleId} ↔ {focusedChannel.outputHoleId}.
                      </p>
                      {renderTraceButton(focusedChannel.signal)}
                    </div>
                  );
                })()}

                <div className="space-y-1.5">
                  {comp.channels.map((ch) => {
                    const isOn = Boolean(switchStates[ch.id]);
                    const outNetId = solution.terminalToNetId[ch.outputHoleId];
                    const outNet = outNetId ? solution.nets[outNetId] : undefined;
                    const isFocused = selection.subChannelId === ch.id;
                    const isChannelTraced = tracedSignal === ch.signal;
                    const pinSpec = getPinSpecBySignal(ch.signal);

                    return (
                      <div
                        key={ch.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                          isFocused
                            ? 'border-white bg-zinc-900 ring-1 ring-white/50'
                            : 'border-zinc-800 bg-zinc-950/80'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-white">{ch.label}</span>
                            <span className="font-mono text-[10px] text-zinc-400">
                              → Pin {pinSpec.pinNumber}
                            </span>
                          </div>
                          <span className="block font-mono text-[10px] text-zinc-400">
                            {ch.inputHoleId} ↔ {ch.outputHoleId} ·{' '}
                            <span className="text-zinc-200">
                              {!solution.isPowerSupplyOn
                                ? 'Fuente en STBY'
                                : `Nivel ${outNet?.logicLevel ?? '—'}`}
                            </span>
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleTracedSignal(ch.signal)}
                            title={`Resaltar ruta eléctrica de ${ch.signal}`}
                            className={`cursor-pointer rounded-lg border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                              isChannelTraced
                                ? 'border-white bg-white text-black font-semibold'
                                : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-500'
                            }`}
                          >
                            Ruta
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSwitchState(ch.id)}
                            className={`cursor-pointer rounded-lg px-2.5 py-0.5 font-mono text-[11px] font-semibold transition-all ${
                              isOn
                                ? 'border border-white bg-white text-black font-bold shadow-xs'
                                : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {isOn ? 'ON (1)' : 'OFF (0)'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {renderRemoveComponentButton(comp.id, 'Retirar interruptor de la protoboard')}

                <p className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2.5 text-[10px] leading-relaxed text-zinc-400">
                  Al cerrar un canal (ON) enlaza el contacto superior ({comp.channels[0]?.inputHoleId})
                  con el inferior ({comp.channels[0]?.outputHoleId}). Requiere +5 V y resistencia
                  pull-down en su pista de salida para definir niveles lógicos limpios.
                </p>
              </section>
            );
          }

          if (comp.kind === 'resistor') {
            const netA = solution.terminalToNetId[comp.leadAHoleId] ?? '—';
            const netB = solution.terminalToNetId[comp.leadBHoleId] ?? '—';
            return (
              <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                      RESISTENCIA AXIAL · {comp.formattedValue} ({comp.tolerance})
                    </span>
                    <h3 className="text-sm font-semibold text-white">{comp.label}</h3>
                  </div>
                  <span className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-white">
                    {mode === 'mounted' ? comp.associatedSignal : `${comp.ohms} Ω`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2.5 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase text-zinc-400">Terminales</span>
                    <span className="font-mono text-white">
                      {comp.leadAHoleId} — {comp.leadBHoleId}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-zinc-400">Uso nominal</span>
                    <span className="font-medium text-zinc-200">
                      {comp.ohms === 330 ? 'Pull-down (330 Ω)' : 'Serie LED (1 kΩ)'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[10px] uppercase text-zinc-400">
                      Redes enlazadas
                    </span>
                    <span className="font-mono text-[11px] text-zinc-200">
                      {netA} ↔ {netB}
                    </span>
                  </div>
                </div>

                {mode === 'mounted' && renderTraceButton(comp.associatedSignal)}

                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-2.5 py-2 text-[11px]">
                  <span className="block text-[10px] uppercase text-zinc-400">
                    Código de 4 bandas EIA
                  </span>
                  <span className="font-mono text-zinc-200">
                    {comp.bands.map((b) => BAND_NAMES_ES[b]).join(' · ')}
                  </span>
                </div>

                {renderRemoveComponentButton(comp.id, 'Retirar resistencia de la protoboard')}

                <p className="text-[11px] leading-relaxed text-zinc-400">{comp.technicalNote}</p>
              </section>
            );
          }

          if (comp.kind === 'led') {
            const ledState = solution.leds[comp.id];
            const drivingPin = getPinSpecBySignal(comp.signal);

            return (
              <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                      DIODO LED 5 MM · {comp.color === 'AMBER' ? 'ÁMBAR' : 'VERDE'}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{comp.label}</h3>
                  </div>
                  {mode === 'mounted' && (
                    <span className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-white">
                      {comp.signal}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2.5 text-xs">
                  {mode === 'mounted' && (
                    <>
                      <div>
                        <span className="block text-[10px] uppercase text-zinc-400">
                          Peso binario
                        </span>
                        <span className="font-medium text-zinc-200">
                          {getSignalWeightDescription(comp.signal)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-zinc-400">
                          Pin conductor IC
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelection({ kind: 'pin', pinNumber: drivingPin.pinNumber })
                          }
                          className="cursor-pointer font-mono font-semibold text-white hover:underline"
                        >
                          Pin {drivingPin.pinNumber} ({drivingPin.datasheetAlias})
                        </button>
                      </div>
                    </>
                  )}
                  <div>
                    <span className="block text-[10px] uppercase text-zinc-400">Ánodo (+)</span>
                    <span className="font-mono text-white">
                      {comp.anodeHoleId} ({ledState?.anodeNetId ?? '—'})
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-zinc-400">
                      Cátodo (− / bisel)
                    </span>
                    <span className="font-mono text-zinc-300">
                      {comp.cathodeHoleId} ({ledState?.cathodeNetId ?? '—'})
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[10px] uppercase text-zinc-400">
                      Estado resuelto por el motor
                    </span>
                    <span
                      className={`font-mono ${
                        ledState?.isLit ? 'font-bold text-white' : 'text-zinc-400'
                      }`}
                    >
                      {ledState?.statusLabel ?? 'Sin evaluar'}
                    </span>
                  </div>
                </div>

                {mode === 'mounted' && renderTraceButton(comp.signal)}
                {renderRemoveComponentButton(comp.id, 'Retirar LED de la protoboard')}

                <p className="text-[11px] leading-relaxed text-zinc-400">{comp.technicalNote}</p>
              </section>
            );
          }

          if (comp.kind === 'power-supply') {
            const isOn = Boolean(switchStates[comp.id]);
            const plusNet = solution.terminalToNetId[comp.plusTerminalId] ?? '—';
            const gndNet = solution.terminalToNetId[comp.gndTerminalId] ?? '—';
            const plusFree = !occupied.has(comp.plusTerminalId);
            const gndFree = !occupied.has(comp.gndTerminalId);

            return (
              <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    ALIMENTACIÓN DE LABORATORIO · +{comp.nominalVoltage}.0 V CC
                  </span>
                  <h3 className="text-sm font-semibold text-white">{comp.label}</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2.5 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase text-zinc-400">Borne +5 V</span>
                    <span className="font-mono text-white">{comp.plusTerminalId}</span>
                    <span className="block font-mono text-[10px] text-zinc-400">{plusNet}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-zinc-400">Borne GND</span>
                    <span className="font-mono text-zinc-300">{comp.gndTerminalId}</span>
                    <span className="block font-mono text-[10px] text-zinc-400">{gndNet}</span>
                  </div>
                </div>

                {mode === 'guided' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!plusFree}
                      onClick={() => startWireDraft(comp.plusTerminalId)}
                      className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-[10px] font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {plusFree ? 'Cablear desde +5 V' : 'Borne +5 V conectado'}
                    </button>
                    <button
                      type="button"
                      disabled={!gndFree}
                      onClick={() => startWireDraft(comp.gndTerminalId)}
                      className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-[10px] font-semibold text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {gndFree ? 'Cablear desde GND' : 'Borne GND conectado'}
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-xs">
                  <span className="text-zinc-400">Salida regulada</span>
                  <button
                    type="button"
                    onClick={() => toggleSwitchState(comp.id)}
                    className={`cursor-pointer rounded-lg px-3 py-1 font-mono text-xs font-semibold transition-all ${
                      isOn
                        ? 'border border-white bg-white text-black shadow-xs font-bold'
                        : 'border border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {isOn ? 'ON (+5.00 V activo)' : 'STBY (En espera — clic para activar)'}
                  </button>
                </div>

                {!isOn && (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-950/90 p-2.5 text-[11px] leading-relaxed text-zinc-300">
                    <strong className="block font-semibold text-white">
                      Fuente apagada (STBY)
                    </strong>
                    Sin +5.0 V en el Pin 5 (VCC), la circuitería interna TTL del SN74LS83A queda
                    desenergizada: las salidas S3..S0 y C4 no pueden suministrar corriente a los
                    LEDs aunque cambies los interruptores DIP.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {renderTraceButton('VCC')}
                  {renderTraceButton('GND')}
                </div>

                <p className="text-[11px] leading-relaxed text-zinc-400">{comp.technicalNote}</p>
              </section>
            );
          }

          return null;
        })()}

        {selection.kind === 'wire' && (() => {
          const wire = findWireInCircuit(circuit, selection.wireId);
          if (!wire) {
            return null;
          }
          const wireState = solution.wires[wire.id];
          const net = wireState?.netId ? solution.nets[wireState.netId] : undefined;
          const fromHole = getHoleById(wire.fromTerminalId);
          const toHole = getHoleById(wire.toTerminalId);

          return (
            <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    CABLE JUMPER · {wire.id}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{wire.label}</h3>
                  <span className="text-[11px] text-zinc-400">
                    {getWireCategoryDescription(wire.signal, wire.colorHex)}
                  </span>
                </div>
                <span
                  className="mt-1 h-4 w-4 shrink-0 rounded-full border border-white/40"
                  style={{ backgroundColor: wire.colorHex }}
                  title={`Color de aislamiento ${wire.colorHex}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2.5 text-xs">
                <div>
                  <span className="block text-[10px] uppercase text-zinc-400">
                    Terminal origen
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {wire.fromTerminalId}
                  </span>
                  <span className="block text-[10px] text-zinc-400">
                    {fromHole ? `Pista ${fromHole.stripId}` : 'Borne de fuente'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-zinc-400">
                    Terminal destino
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {wire.toTerminalId}
                  </span>
                  <span className="block text-[10px] text-zinc-400">
                    {toHole ? `Pista ${toHole.stripId}` : 'Borne de fuente'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-zinc-400">
                    Red eléctrica
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {wireState?.netId ?? 'SIN-RED'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-zinc-400">
                    Señal / Nivel
                  </span>
                  <span className="font-mono text-zinc-200">
                    {wire.signal ?? '—'} ·{' '}
                    {wireState?.logicLevel === null || wireState?.logicLevel === undefined
                      ? 'STBY / —'
                      : `Lógico ${wireState.logicLevel}`}
                  </span>
                </div>
              </div>

              {wire.signal && renderTraceButton(wire.signal)}

              {/* Información didáctica de flujo de corriente y energía */}
              {(() => {
                const wireFlow = energyFlow.wireFlows[wire.id];
                if (!wireFlow) return null;
                return (
                  <div
                    className={`rounded-lg border p-2.5 text-xs ${
                      wireFlow.isConducting
                        ? 'border-[#35C2D1]/40 bg-[#142A35]/50 text-white'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                        <span className={wireFlow.isConducting ? 'animate-pulse text-[#FFD043]' : 'text-zinc-600'}>
                          ⚡
                        </span>
                        Flujo de energía
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                          wireFlow.isConducting
                            ? 'bg-[#35C2D1]/20 font-semibold text-[#35C2D1]'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {wireFlow.isConducting ? 'Conduciendo' : 'En reposo'}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-300">
                      {wireFlow.descriptionEs}
                    </p>
                    {wireFlow.isConducting && (
                      <div className="mt-1.5 flex items-center justify-between border-t border-zinc-800/80 pt-1.5 font-mono text-[10px] text-zinc-400">
                        <span>Sentido convencional:</span>
                        <span className="text-zinc-200">
                          {wireFlow.direction === 'FORWARD'
                            ? `${wire.fromTerminalId} → ${wire.toTerminalId}`
                            : `${wire.toTerminalId} → ${wire.fromTerminalId}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Acciones de edición en modo Montaje Editable */}
              {mode === 'guided' && (
                <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2.5">
                  <span className="block font-mono text-[10px] uppercase text-zinc-400">
                    Color visual (no altera conectividad)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {WIRE_COLOR_PALETTE.map((opt) => {
                      const active = opt.colorHex.toLowerCase() === wire.colorHex.toLowerCase();
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => changeWireColor(wire.id, opt.colorHex)}
                          title={`${opt.label} (${opt.conventionEs})`}
                          className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border transition-transform ${
                            active
                              ? 'scale-110 border-white ring-2 ring-white/50'
                              : 'border-zinc-700 hover:scale-105'
                          }`}
                          style={{ backgroundColor: opt.colorHex }}
                        />
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => beginWireReconnect(wire.id, 'from')}
                      className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[10px] font-medium text-white hover:border-zinc-500"
                    >
                      Mover destino
                    </button>
                    <button
                      type="button"
                      onClick={() => beginWireReconnect(wire.id, 'to')}
                      className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[10px] font-medium text-white hover:border-zinc-500"
                    >
                      Mover origen
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteWire(wire.id)}
                    className="w-full cursor-pointer rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-1 font-mono text-[11px] font-semibold text-white hover:bg-zinc-800"
                  >
                    Eliminar cable (Supr)
                  </button>
                </div>
              )}

              {net && (
                <div className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-zinc-400">Conducción de red</span>
                    <span className="font-mono text-white">{net.summaryLabel}</span>
                  </div>
                  {net.connectedComponentLabels.length > 0 && (
                    <div>
                      <span className="block text-[10px] uppercase text-zinc-400">
                        Terminales enlazados en {net.id}
                      </span>
                      <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-zinc-300">
                        {net.connectedComponentLabels.map((lbl) => (
                          <li key={lbl}>· {lbl}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })()}

        {selection.kind === 'breadboard' && (() => {
          const hole = selection.holeId ? getHoleById(selection.holeId) : undefined;
          const peers = hole ? getStripHoles(hole.stripId) : [];
          const netId = hole ? solution.terminalToNetId[hole.id] : undefined;
          const net = netId ? solution.nets[netId] : undefined;
          const insertedPin = hole
            ? mountedPins.find(
                (entry) => getHoleById(entry.holeId)?.stripId === hole.stripId,
              )
            : undefined;
          const isHoleFree = hole ? !occupied.has(hole.id) : false;

          return (
            <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    PROTOBOARD · MB-102 (830 PUNTOS)
                  </span>
                  <h3 className="text-sm font-semibold text-white">
                    {hole ? hole.label : 'Matriz de conexiones sin soldadura'}
                  </h3>
                </div>
              </div>

              {hole ? (
                <>
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2.5 text-xs">
                    <div>
                      <span className="block text-[10px] uppercase text-zinc-400">
                        Tipo de contacto
                      </span>
                      <span className="font-medium text-zinc-200">
                        {hole.kind === 'terminal' ? 'Pista vertical (5 nodos)' : 'Bus de alimentación'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-zinc-400">
                        Disponibilidad
                      </span>
                      <span
                        className={`font-mono ${isHoleFree ? 'text-white font-bold' : 'text-zinc-400'}`}
                      >
                        {isHoleFree ? `Libre (${peers.length} en pista)` : 'Ocupado'}
                      </span>
                    </div>
                    {net && (
                      <div className="col-span-2">
                        <span className="block text-[10px] uppercase text-zinc-400">
                          Red eléctrica resuelta
                        </span>
                        <span className="font-mono text-[11px] text-white">
                          {net.id} · {net.summaryLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  {mode === 'guided' && isHoleFree && (
                    <button
                      type="button"
                      onClick={() => startWireDraft(hole.id)}
                      className="w-full cursor-pointer rounded-xl border border-white bg-white px-3 py-2 font-mono text-xs font-bold text-black shadow-xs hover:bg-zinc-200"
                    >
                      Iniciar cable desde {hole.id}
                    </button>
                  )}

                  {insertedPin ? (
                    <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-950/80 p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">
                          Comparte pista con{' '}
                          <strong className="text-white">
                            Pin {insertedPin.spec.pinNumber} ({insertedPin.spec.signal})
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelection({ kind: 'pin', pinNumber: insertedPin.spec.pinNumber })
                          }
                          className="cursor-pointer font-mono text-[11px] text-zinc-300 hover:text-white hover:underline"
                        >
                          Inspeccionar
                        </button>
                      </div>
                      {renderTraceButton(insertedPin.spec.signal)}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-zinc-400">
                      {hole.kind === 'terminal'
                        ? 'Los 5 alvéolos de esta columna y semibloque comparten un único clip elástico interno, quedando aislados del lado opuesto por el canal central de 7.62 mm.'
                        : 'Este riel distribuye alimentación continua a lo largo de 50 puntos para nutrir VCC (+5 V) o referencia GND (0 V).'}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs leading-relaxed text-zinc-400">
                  Consta de 63 columnas dobles (filas <code className="text-white">a–e</code> y{' '}
                  <code className="text-white">f–j</code>) separadas por una ranura central
                  estándar de 0.3&quot; para circuitos DIP, más 4 buses laterales de alimentación.
                </p>
              )}
            </section>
          );
        })()}

        {/* Panel educativo columna por columna cuando el circuito montado o armado es funcional */}
        {(mode === 'mounted' || solution.adderOutput !== null) && <BinarySumBreakdown />}

        {/* Selector 2D interactivo siempre accesible como alternativa al ratón 3D */}
        <DipPinoutDiagram />

        {/* Resumen en vivo del Circuito de Trabajo en modo Montaje Editable */}
        {mode === 'guided' && (
          <section className="space-y-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                Inventario Montado en Protoboard
              </h3>
              <span
                className={`rounded-lg px-2 py-0.5 font-mono text-[10px] font-semibold ${
                  isEquivalentToReference
                    ? 'border border-white bg-white text-black font-bold'
                    : 'border border-zinc-800 bg-zinc-950 text-zinc-400'
                }`}
              >
                {isEquivalentToReference ? 'Circuito completo verificado' : 'En construcción'}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2 text-center font-mono text-[10px]">
              <div>
                <span className="block text-zinc-400">IC</span>
                <strong className="text-xs text-white">{circuit.chip ? '1/1' : '0/1'}</strong>
              </div>
              <div>
                <span className="block text-zinc-400">DIP</span>
                <strong className="text-xs text-white">
                  {circuit.dipSwitches.length}/3
                </strong>
              </div>
              <div>
                <span className="block text-zinc-400">Res.</span>
                <strong className="text-xs text-white">
                  {circuit.resistors.length}/14
                </strong>
              </div>
              <div>
                <span className="block text-zinc-400">LED</span>
                <strong className="text-xs text-white">{circuit.leds.length}/5</strong>
              </div>
              <div>
                <span className="block text-zinc-400">Cables</span>
                <strong className="text-xs text-white">{circuit.wires.length}</strong>
              </div>
            </div>

            {isEquivalentToReference && (
              <div className="rounded-lg border border-zinc-600 bg-zinc-900 p-2.5 text-[11px] leading-relaxed text-zinc-200">
                <strong className="block font-semibold text-white">
                  Equivalencia eléctrica confirmada
                </strong>
                La netlist que has armado reproduce con exactitud todas las redes de alimentación,
                entradas con pull-down y salidas con resistencia limitadora del circuito canónico
                74LS83A.
              </div>
            )}
          </section>
        )}

        {/* Resumen del 74LS83A y diagnósticos estructurados del motor */}
        {(!hasSpecificSelection || !solution.isHealthy) && (
          <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                CIRCUITO INTEGRADO PROTAGONISTA
              </span>
              <h3 className="text-sm font-semibold text-white">
                {CHIP_74LS83_PLACEMENT.partNumber} ({CHIP_74LS83_PLACEMENT.shortName})
              </h3>
            </div>

            {!hasSpecificSelection && (
              <p className="text-xs leading-relaxed text-zinc-300">
                Sumador binario completo de 4 bits con acarreo anticipado interno (
                <em>Look-Ahead Carry</em>). Suma dos palabras de 4 bits (
                <code className="font-mono text-white bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">A3..A0</code> y{' '}
                <code className="font-mono text-white bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">B3..B0</code>) más un acarreo inicial{' '}
                <code className="font-mono text-white bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">C0</code>, entregando la suma{' '}
                <code className="font-mono text-white bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">S3..S0</code> y acarreo final{' '}
                <code className="font-mono text-white bg-zinc-800 px-1 py-0.5 rounded border border-zinc-700">C4</code>.
              </p>
            )}

            {/* Diagnóstico eléctrico en tiempo real */}
            <div className="space-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-2.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-zinc-400">
                  Diagnóstico del motor eléctrico
                </span>
                <span
                  className={`font-mono text-[10px] font-semibold ${
                    solution.isHealthy
                      ? 'text-white'
                      : 'text-zinc-200'
                  }`}
                >
                  {solution.isHealthy
                    ? 'RED VERIFICADA'
                    : `${solution.diagnostics.length} incidencia(s)`}
                </span>
              </div>

              {solution.diagnostics.length === 0 ? (
                <p className="text-[11px] text-zinc-400">
                  Alimentación +5.0 V en Pin 5, GND en Pin 12, 9 entradas polarizadas y 5 etapas
                  LED conducidas sin errores.
                </p>
              ) : (
                <ul className="space-y-1 text-[11px]">
                  {solution.diagnostics.map((diag, idx) => (
                    <li
                      key={`${diag.code}-${idx}`}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-200"
                    >
                      <strong className="block font-semibold text-white">{diag.title}</strong>
                      <span className="text-[10px] text-zinc-400">{diag.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!hasSpecificSelection && (
              <div className="rounded-lg border border-zinc-700 bg-zinc-950/80 p-2.5 text-[11px] leading-relaxed text-zinc-400">
                <strong className="block font-semibold text-white">
                  Nota crítica de patillaje (74LS83A ≠ 74LS283)
                </strong>
                En el 74LS83A, <strong className="text-white">VCC (+5 V) está en el Pin 5</strong>{' '}
                y <strong className="text-white">GND en el Pin 12</strong>. Con muesca a la
                izquierda en columna <code className="font-mono text-white">c</code>, Pin 5 cae
                en <code className="font-mono text-white">f(c+4)</code> y Pin 12 en{' '}
                <code className="font-mono text-white">e(c+4)</code>.
              </div>
            )}
          </section>
        )}
      </div>
        </>
      )}
    </aside>
  );
}
