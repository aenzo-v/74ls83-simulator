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
        className={`w-full cursor-pointer rounded-md border px-2.5 py-1.5 font-mono text-xs font-semibold transition-colors ${
          active
            ? 'border-[#35C2D1] bg-[#35C2D1]/20 text-[#35C2D1]'
            : 'border-[#2D3B4E] bg-[#141A23] text-[#35C2D1] hover:border-[#35C2D1]/60 hover:bg-[#192230]'
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
        className="w-full cursor-pointer rounded-md border border-[#F06A6A]/50 bg-[#2A171D] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#F06A6A] transition-colors hover:border-[#F06A6A] hover:bg-[#381D26]"
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
      className="flex h-full w-92 shrink-0 flex-col border-l border-[#2D3B4E] bg-[#1C2430] xl:w-96"
    >
      {/* Pestañas en modo guiado */}
      {mode === 'guided' && (
        <div className="flex shrink-0 gap-1 border-b border-[#2D3B4E] bg-[#141A23] p-1.5">
          <button
            type="button"
            onClick={() => setGuidedActiveTab('guide')}
            className={`flex-1 cursor-pointer rounded py-1.5 text-center font-mono text-xs font-semibold transition-colors ${
              guidedActiveTab === 'guide'
                ? 'bg-[#243041] text-[#35C2D1] shadow-xs ring-1 ring-[#35C2D1]/40'
                : 'text-[#AEB8C5] hover:text-[#E9EDF2]'
            }`}
          >
            Guía de Montaje ({guidedCurrentStageIndex + 1}/9)
          </button>
          <button
            type="button"
            onClick={() => setGuidedActiveTab('inspector')}
            className={`flex-1 cursor-pointer rounded py-1.5 text-center font-mono text-xs font-semibold transition-colors ${
              guidedActiveTab === 'inspector'
                ? 'bg-[#243041] text-[#35C2D1] shadow-xs ring-1 ring-[#35C2D1]/40'
                : 'text-[#AEB8C5] hover:text-[#E9EDF2]'
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
          <div className="flex shrink-0 items-center justify-between border-b border-[#2D3B4E] px-4 py-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#E9EDF2]">
                {mode === 'guided' ? 'Inspector Técnico' : 'Inspector y Análisis Binario'}
              </h2>
              <p className="text-[11px] text-[#AEB8C5]">
                {mode === 'guided'
                  ? 'Verificación eléctrica de componentes y nodos'
                  : 'Sincronizado en tiempo real con el motor eléctrico'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => requestCameraPreset('chip-closeup')}
              className="cursor-pointer rounded border border-[#2D3B4E] bg-[#243041] px-2 py-1 text-[11px] font-medium text-[#35C2D1] transition-colors hover:border-[#35C2D1]/50"
            >
              Acercar IC
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Tarjeta del integrado cuando está seleccionado en modo editable */}
        {mode === 'guided' && selection.kind === 'chip' && circuit.chip && (
          <section className="space-y-3 rounded-lg border border-[#F1B85A]/45 bg-[#243041] p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[11px] text-[#F1B85A]">
                  INTEGRADO MONTADO · DIP-16
                </span>
                <h3 className="text-sm font-semibold text-[#E9EDF2]">
                  {CHIP_74LS83_PLACEMENT.partNumber} ({CHIP_74LS83_PLACEMENT.shortName})
                </h3>
              </div>
              <span className="rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-0.5 font-mono text-[11px] text-[#35C2D1]">
                Col {circuit.chip.startColumn}–{circuit.chip.startColumn + 7}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-md border border-[#2D3B4E] bg-[#141A23]/80 p-2.5 text-xs">
              <div>
                <span className="block text-[10px] uppercase text-[#AEB8C5]">
                  Pin 5 · VCC (+5 V)
                </span>
                <span className="font-mono text-[#F06A6A]">
                  f{circuit.chip.startColumn + 4} ({solution.pins[5]?.netId ?? '—'})
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-[#AEB8C5]">
                  Pin 12 · GND (0 V)
                </span>
                <span className="font-mono text-[#7AA7E8]">
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
            <section className="space-y-3 rounded-lg border border-[#F1B85A]/45 bg-[#243041] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[11px] text-[#F1B85A]">
                    PIN {spec.pinNumber} · SN74LS83A
                  </span>
                  <h3 className="text-sm font-semibold text-[#E9EDF2]">
                    {spec.signal} — {spec.shortLabel}
                  </h3>
                </div>
                <span className="rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-0.5 font-mono text-[11px] text-[#35C2D1]">
                  Nodo {holeId}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border border-[#2D3B4E] bg-[#141A23]/80 p-2.5 text-xs">
                <div>
                  <span className="block text-[10px] uppercase text-[#AEB8C5]">
                    Hoja de datos TI
                  </span>
                  <span className="font-mono font-semibold text-[#E9EDF2]">
                    {spec.datasheetAlias}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#AEB8C5]">Tipo</span>
                  <span className="font-medium text-[#E9EDF2]">
                    {directionLabel(spec.direction)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#AEB8C5]">
                    Pista / Red
                  </span>
                  <span className="font-mono text-[#6DD19C]">
                    {stripLabel} · {pinState?.netId ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#AEB8C5]">
                    Estado eléctrico
                  </span>
                  <span
                    className={`font-mono ${
                      pinState?.logicLevel === 1
                        ? 'font-semibold text-[#6DD19C]'
                        : pinState?.logicLevel === 0
                          ? 'text-[#E9EDF2]'
                          : 'text-[#F1B85A]'
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
                <div className="rounded-md border border-[#2D3B4E] bg-[#141A23] px-2.5 py-2 text-[11px]">
                  <span className="block text-[10px] uppercase text-[#AEB8C5]">
                    Cables conectados a esta red
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {net.wireIds.map((wId) => (
                      <button
                        key={wId}
                        type="button"
                        onClick={() => setSelection({ kind: 'wire', wireId: wId })}
                        className="cursor-pointer rounded border border-[#2D3B4E] bg-[#243041] px-1.5 py-0.5 font-mono text-[10px] text-[#35C2D1] hover:border-[#35C2D1]/60"
                      >
                        {wId}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs leading-relaxed text-[#E9EDF2]">{spec.summary}</p>
              <p className="rounded-md border border-[#2D3B4E] bg-[#1C2430] p-2.5 text-[11px] leading-relaxed text-[#AEB8C5]">
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
              <section className="space-y-3 rounded-lg border border-[#35C2D1]/45 bg-[#243041] p-3.5">
                <div>
                  <span className="font-mono text-[11px] text-[#35C2D1]">
                    INTERRUPTOR DIP · {comp.id.toUpperCase()} (COL {comp.startColumn}–{comp.endColumn})
                  </span>
                  <h3 className="text-sm font-semibold text-[#E9EDF2]">{comp.label}</h3>
                </div>
                <p className="text-xs leading-relaxed text-[#AEB8C5]">{comp.description}</p>

                {focusedChannel && (() => {
                  const targetPin = getPinSpecBySignal(focusedChannel.signal);
                  return (
                    <div className="space-y-2 rounded-md border border-[#F1B85A]/45 bg-[#141A23] p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-[#F1B85A]">
                          Canal activo: {focusedChannel.signal}
                        </span>
                        {circuit.chip && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelection({ kind: 'pin', pinNumber: targetPin.pinNumber })
                            }
                            className="cursor-pointer font-mono text-[11px] text-[#35C2D1] hover:underline"
                          >
                            Ir a Pin {targetPin.pinNumber}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#AEB8C5]">
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
                        className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                          isFocused
                            ? 'border-[#F1B85A]/65 bg-[#141A23]'
                            : 'border-[#2D3B4E] bg-[#141A23]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[#E9EDF2]">{ch.label}</span>
                            <span className="font-mono text-[10px] text-[#AEB8C5]">
                              → Pin {pinSpec.pinNumber}
                            </span>
                          </div>
                          <span className="block font-mono text-[10px] text-[#AEB8C5]">
                            {ch.inputHoleId} ↔ {ch.outputHoleId} ·{' '}
                            <span className="text-[#6DD19C]">
                              {!solution.isPowerSupplyOn
                                ? 'Fuente en STBY'
                                : `Nivel ${outNet?.logicLevel ?? '—'}`}
                            </span>
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleTracedSignal(ch.signal)}
                            title={`Resaltar ruta eléctrica de ${ch.signal}`}
                            className={`cursor-pointer rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                              isChannelTraced
                                ? 'border-[#35C2D1] bg-[#35C2D1]/20 text-[#35C2D1]'
                                : 'border-[#2D3B4E] bg-[#1C2430] text-[#AEB8C5] hover:text-[#35C2D1]'
                            }`}
                          >
                            Ruta
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSwitchState(ch.id)}
                            className={`cursor-pointer rounded px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors ${
                              isOn
                                ? 'bg-[#6DD19C]/20 text-[#6DD19C] ring-1 ring-[#6DD19C]/45'
                                : 'bg-[#243041] text-[#AEB8C5] hover:text-[#E9EDF2]'
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

                <p className="rounded-md border border-[#2D3B4E] bg-[#141A23] p-2 text-[10px] leading-relaxed text-[#AEB8C5]">
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
              <section className="space-y-3 rounded-lg border border-[#F1B85A]/40 bg-[#243041] p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] text-[#F1B85A]">
                      RESISTENCIA AXIAL · {comp.formattedValue} ({comp.tolerance})
                    </span>
                    <h3 className="text-sm font-semibold text-[#E9EDF2]">{comp.label}</h3>
                  </div>
                  <span className="rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-0.5 font-mono text-[11px] text-[#35C2D1]">
                    {mode === 'mounted' ? comp.associatedSignal : `${comp.ohms} Ω`}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-md border border-[#2D3B4E] bg-[#141A23]/80 p-2.5 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase text-[#AEB8C5]">Terminales</span>
                    <span className="font-mono text-[#6DD19C]">
                      {comp.leadAHoleId} — {comp.leadBHoleId}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-[#AEB8C5]">Uso nominal</span>
                    <span className="font-medium text-[#E9EDF2]">
                      {comp.ohms === 330 ? 'Pull-down (330 Ω)' : 'Serie LED (1 kΩ)'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[10px] uppercase text-[#AEB8C5]">
                      Redes enlazadas
                    </span>
                    <span className="font-mono text-[11px] text-[#E9EDF2]">
                      {netA} ↔ {netB}
                    </span>
                  </div>
                </div>

                {mode === 'mounted' && renderTraceButton(comp.associatedSignal)}

                <div className="rounded-md border border-[#2D3B4E] bg-[#141A23] px-2.5 py-2 text-[11px]">
                  <span className="block text-[10px] uppercase text-[#AEB8C5]">
                    Código de 4 bandas EIA
                  </span>
                  <span className="font-mono text-[#E9EDF2]">
                    {comp.bands.map((b) => BAND_NAMES_ES[b]).join(' · ')}
                  </span>
                </div>

                {renderRemoveComponentButton(comp.id, 'Retirar resistencia de la protoboard')}

                <p className="text-[11px] leading-relaxed text-[#AEB8C5]">{comp.technicalNote}</p>
              </section>
            );
          }

          if (comp.kind === 'led') {
            const ledState = solution.leds[comp.id];
            const drivingPin = getPinSpecBySignal(comp.signal);

            return (
              <section className="space-y-3 rounded-lg border border-[#6DD19C]/45 bg-[#243041] p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-[11px] text-[#6DD19C]">
                      DIODO LED 5 MM · {comp.color === 'AMBER' ? 'ÁMBAR' : 'VERDE'}
                    </span>
                    <h3 className="text-sm font-semibold text-[#E9EDF2]">{comp.label}</h3>
                  </div>
                  {mode === 'mounted' && (
                    <span className="rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-0.5 font-mono text-[11px] text-[#35C2D1]">
                      {comp.signal}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-md border border-[#2D3B4E] bg-[#141A23]/80 p-2.5 text-xs">
                  {mode === 'mounted' && (
                    <>
                      <div>
                        <span className="block text-[10px] uppercase text-[#AEB8C5]">
                          Peso binario
                        </span>
                        <span className="font-medium text-[#E9EDF2]">
                          {getSignalWeightDescription(comp.signal)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-[#AEB8C5]">
                          Pin conductor IC
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelection({ kind: 'pin', pinNumber: drivingPin.pinNumber })
                          }
                          className="cursor-pointer font-mono font-semibold text-[#35C2D1] hover:underline"
                        >
                          Pin {drivingPin.pinNumber} ({drivingPin.datasheetAlias})
                        </button>
                      </div>
                    </>
                  )}
                  <div>
                    <span className="block text-[10px] uppercase text-[#AEB8C5]">Ánodo (+)</span>
                    <span className="font-mono text-[#6DD19C]">
                      {comp.anodeHoleId} ({ledState?.anodeNetId ?? '—'})
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-[#AEB8C5]">
                      Cátodo (− / bisel)
                    </span>
                    <span className="font-mono text-[#E9EDF2]">
                      {comp.cathodeHoleId} ({ledState?.cathodeNetId ?? '—'})
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[10px] uppercase text-[#AEB8C5]">
                      Estado resuelto por el motor
                    </span>
                    <span
                      className={`font-mono ${
                        ledState?.isLit ? 'font-semibold text-[#6DD19C]' : 'text-[#F1B85A]'
                      }`}
                    >
                      {ledState?.statusLabel ?? 'Sin evaluar'}
                    </span>
                  </div>
                </div>

                {mode === 'mounted' && renderTraceButton(comp.signal)}
                {renderRemoveComponentButton(comp.id, 'Retirar LED de la protoboard')}

                <p className="text-[11px] leading-relaxed text-[#AEB8C5]">{comp.technicalNote}</p>
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
              <section className="space-y-3 rounded-lg border border-[#35C2D1]/45 bg-[#243041] p-3.5">
                <div>
                  <span className="font-mono text-[11px] text-[#35C2D1]">
                    ALIMENTACIÓN DE LABORATORIO · +{comp.nominalVoltage}.0 V CC
                  </span>
                  <h3 className="text-sm font-semibold text-[#E9EDF2]">{comp.label}</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-md border border-[#2D3B4E] bg-[#141A23]/80 p-2.5 text-xs">
                  <div>
                    <span className="block text-[10px] uppercase text-[#AEB8C5]">Borne +5 V</span>
                    <span className="font-mono text-[#F06A6A]">{comp.plusTerminalId}</span>
                    <span className="block font-mono text-[10px] text-[#AEB8C5]">{plusNet}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-[#AEB8C5]">Borne GND</span>
                    <span className="font-mono text-[#7AA7E8]">{comp.gndTerminalId}</span>
                    <span className="block font-mono text-[10px] text-[#AEB8C5]">{gndNet}</span>
                  </div>
                </div>

                {mode === 'guided' && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={!plusFree}
                      onClick={() => startWireDraft(comp.plusTerminalId)}
                      className="cursor-pointer rounded border border-[#F06A6A]/50 bg-[#141A23] px-2 py-1.5 font-mono text-[10px] font-semibold text-[#F06A6A] hover:bg-[#243041] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {plusFree ? 'Cablear desde +5 V' : 'Borne +5 V conectado'}
                    </button>
                    <button
                      type="button"
                      disabled={!gndFree}
                      onClick={() => startWireDraft(comp.gndTerminalId)}
                      className="cursor-pointer rounded border border-[#7AA7E8]/50 bg-[#141A23] px-2 py-1.5 font-mono text-[10px] font-semibold text-[#7AA7E8] hover:bg-[#243041] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {gndFree ? 'Cablear desde GND' : 'Borne GND conectado'}
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-md border border-[#2D3B4E] bg-[#141A23] px-3 py-2 text-xs">
                  <span className="text-[#AEB8C5]">Salida regulada</span>
                  <button
                    type="button"
                    onClick={() => toggleSwitchState(comp.id)}
                    className={`cursor-pointer rounded px-2.5 py-1 font-mono text-xs font-semibold transition-colors ${
                      isOn
                        ? 'bg-[#6DD19C]/20 text-[#6DD19C] ring-1 ring-[#6DD19C]/45'
                        : 'bg-[#F1B85A]/20 text-[#F1B85A] ring-1 ring-[#F1B85A]/45'
                    }`}
                  >
                    {isOn ? 'ON (+5.00 V activo)' : 'STBY (En espera — clic para activar)'}
                  </button>
                </div>

                {!isOn && (
                  <div className="rounded-md border border-[#F1B85A]/45 bg-[#F1B85A]/10 p-2.5 text-[11px] leading-relaxed text-[#E9EDF2]">
                    <strong className="block font-semibold text-[#F1B85A]">
                      Fuente apagada (STBY)
                    </strong>
                    Sin +5.0 V en el Pin 5 (VCC), la circuitería interna TTL del SN74LS83A queda
                    desenergizada: las salidas S3..S0 y C4 no pueden suministrar corriente a los
                    LEDs aunque cambies los interruptores DIP.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  {renderTraceButton('VCC')}
                  {renderTraceButton('GND')}
                </div>

                <p className="text-[11px] leading-relaxed text-[#AEB8C5]">{comp.technicalNote}</p>
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
            <section className="space-y-3 rounded-lg border border-[#F1B85A]/45 bg-[#243041] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[11px] text-[#F1B85A]">
                    CABLE JUMPER · {wire.id}
                  </span>
                  <h3 className="text-sm font-semibold text-[#E9EDF2]">{wire.label}</h3>
                  <span className="text-[11px] text-[#AEB8C5]">
                    {getWireCategoryDescription(wire.signal, wire.colorHex)}
                  </span>
                </div>
                <span
                  className="mt-1 h-4 w-4 shrink-0 rounded-full border border-[#E9EDF2]/40"
                  style={{ backgroundColor: wire.colorHex }}
                  title={`Color de aislamiento ${wire.colorHex}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-md border border-[#2D3B4E] bg-[#141A23]/80 p-2.5 text-xs">
                <div>
                  <span className="block text-[10px] uppercase text-[#AEB8C5]">
                    Terminal origen
                  </span>
                  <span className="font-mono font-semibold text-[#6DD19C]">
                    {wire.fromTerminalId}
                  </span>
                  <span className="block text-[10px] text-[#AEB8C5]">
                    {fromHole ? `Pista ${fromHole.stripId}` : 'Borne de fuente'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#AEB8C5]">
                    Terminal destino
                  </span>
                  <span className="font-mono font-semibold text-[#6DD19C]">
                    {wire.toTerminalId}
                  </span>
                  <span className="block text-[10px] text-[#AEB8C5]">
                    {toHole ? `Pista ${toHole.stripId}` : 'Borne de fuente'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#AEB8C5]">
                    Red eléctrica
                  </span>
                  <span className="font-mono font-semibold text-[#35C2D1]">
                    {wireState?.netId ?? 'SIN-RED'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-[#AEB8C5]">
                    Señal / Nivel
                  </span>
                  <span className="font-mono text-[#E9EDF2]">
                    {wire.signal ?? '—'} ·{' '}
                    {wireState?.logicLevel === null || wireState?.logicLevel === undefined
                      ? 'STBY / —'
                      : `Lógico ${wireState.logicLevel}`}
                  </span>
                </div>
              </div>

              {wire.signal && renderTraceButton(wire.signal)}

              {/* Acciones de edición en modo Montaje Editable */}
              {mode === 'guided' && (
                <div className="space-y-2 rounded-md border border-[#2D3B4E] bg-[#141A23] p-2.5">
                  <span className="block font-mono text-[10px] uppercase text-[#AEB8C5]">
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
                              ? 'scale-110 border-[#E9EDF2] ring-2 ring-[#35C2D1]'
                              : 'border-[#2D3B4E] hover:scale-105'
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
                      className="cursor-pointer rounded border border-[#2D3B4E] bg-[#243041] px-2 py-1 font-mono text-[10px] font-medium text-[#35C2D1] hover:border-[#35C2D1]/60"
                    >
                      Mover destino
                    </button>
                    <button
                      type="button"
                      onClick={() => beginWireReconnect(wire.id, 'to')}
                      className="cursor-pointer rounded border border-[#2D3B4E] bg-[#243041] px-2 py-1 font-mono text-[10px] font-medium text-[#35C2D1] hover:border-[#35C2D1]/60"
                    >
                      Mover origen
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteWire(wire.id)}
                    className="w-full cursor-pointer rounded border border-[#F06A6A]/50 bg-[#2A171D] px-2 py-1 font-mono text-[11px] font-semibold text-[#F06A6A] hover:border-[#F06A6A] hover:bg-[#381D26]"
                  >
                    Eliminar cable (Supr)
                  </button>
                </div>
              )}

              {net && (
                <div className="space-y-1.5 rounded-md border border-[#2D3B4E] bg-[#141A23] p-2.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-[#AEB8C5]">Conducción de red</span>
                    <span className="font-mono text-[#6DD19C]">{net.summaryLabel}</span>
                  </div>
                  {net.connectedComponentLabels.length > 0 && (
                    <div>
                      <span className="block text-[10px] uppercase text-[#AEB8C5]">
                        Terminales enlazados en {net.id}
                      </span>
                      <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-[#E9EDF2]">
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
            <section className="space-y-3 rounded-lg border border-[#35C2D1]/40 bg-[#243041] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[11px] text-[#35C2D1]">
                    PROTOBOARD · MB-102 (830 PUNTOS)
                  </span>
                  <h3 className="text-sm font-semibold text-[#E9EDF2]">
                    {hole ? hole.label : 'Matriz de conexiones sin soldadura'}
                  </h3>
                </div>
              </div>

              {hole ? (
                <>
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-[#2D3B4E] bg-[#141A23]/80 p-2.5 text-xs">
                    <div>
                      <span className="block text-[10px] uppercase text-[#AEB8C5]">
                        Tipo de contacto
                      </span>
                      <span className="font-medium text-[#E9EDF2]">
                        {hole.kind === 'terminal' ? 'Pista vertical (5 nodos)' : 'Bus de alimentación'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-[#AEB8C5]">
                        Disponibilidad
                      </span>
                      <span
                        className={`font-mono ${isHoleFree ? 'text-[#6DD19C]' : 'text-[#F1B85A]'}`}
                      >
                        {isHoleFree ? `Libre (${peers.length} en pista)` : 'Ocupado'}
                      </span>
                    </div>
                    {net && (
                      <div className="col-span-2">
                        <span className="block text-[10px] uppercase text-[#AEB8C5]">
                          Red eléctrica resuelta
                        </span>
                        <span className="font-mono text-[11px] text-[#35C2D1]">
                          {net.id} · {net.summaryLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  {mode === 'guided' && isHoleFree && (
                    <button
                      type="button"
                      onClick={() => startWireDraft(hole.id)}
                      className="w-full cursor-pointer rounded-md border border-[#35C2D1]/55 bg-[#35C2D1]/15 px-2.5 py-1.5 font-mono text-xs font-semibold text-[#35C2D1] transition-colors hover:bg-[#35C2D1]/25"
                    >
                      Iniciar cable desde {hole.id}
                    </button>
                  )}

                  {insertedPin ? (
                    <div className="space-y-2 rounded-md border border-[#F1B85A]/35 bg-[#141A23] p-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[#AEB8C5]">
                          Comparte pista con{' '}
                          <strong className="text-[#E9EDF2]">
                            Pin {insertedPin.spec.pinNumber} ({insertedPin.spec.signal})
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSelection({ kind: 'pin', pinNumber: insertedPin.spec.pinNumber })
                          }
                          className="cursor-pointer font-mono text-[11px] text-[#35C2D1] hover:underline"
                        >
                          Inspeccionar
                        </button>
                      </div>
                      {renderTraceButton(insertedPin.spec.signal)}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-[#AEB8C5]">
                      {hole.kind === 'terminal'
                        ? 'Los 5 alvéolos de esta columna y semibloque comparten un único clip elástico interno, quedando aislados del lado opuesto por el canal central de 7.62 mm.'
                        : 'Este riel distribuye alimentación continua a lo largo de 50 puntos para nutrir VCC (+5 V) o referencia GND (0 V).'}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs leading-relaxed text-[#AEB8C5]">
                  Consta de 63 columnas dobles (filas <code className="text-[#E9EDF2]">a–e</code> y{' '}
                  <code className="text-[#E9EDF2]">f–j</code>) separadas por una ranura central
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
          <section className="space-y-2.5 rounded-lg border border-[#35C2D1]/35 bg-[#243041]/85 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#35C2D1]">
                Inventario Montado en Protoboard
              </h3>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  isEquivalentToReference
                    ? 'bg-[#6DD19C]/20 text-[#6DD19C]'
                    : 'bg-[#141A23] text-[#AEB8C5]'
                }`}
              >
                {isEquivalentToReference ? 'Circuito completo verificado' : 'En construcción'}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 rounded-md border border-[#2D3B4E] bg-[#141A23] p-2 text-center font-mono text-[10px]">
              <div>
                <span className="block text-[#AEB8C5]">IC</span>
                <strong className="text-xs text-[#E9EDF2]">{circuit.chip ? '1/1' : '0/1'}</strong>
              </div>
              <div>
                <span className="block text-[#AEB8C5]">DIP</span>
                <strong className="text-xs text-[#E9EDF2]">
                  {circuit.dipSwitches.length}/3
                </strong>
              </div>
              <div>
                <span className="block text-[#AEB8C5]">Res.</span>
                <strong className="text-xs text-[#E9EDF2]">
                  {circuit.resistors.length}/14
                </strong>
              </div>
              <div>
                <span className="block text-[#AEB8C5]">LED</span>
                <strong className="text-xs text-[#E9EDF2]">{circuit.leds.length}/5</strong>
              </div>
              <div>
                <span className="block text-[#AEB8C5]">Cables</span>
                <strong className="text-xs text-[#35C2D1]">{circuit.wires.length}</strong>
              </div>
            </div>

            {isEquivalentToReference && (
              <div className="rounded-md border border-[#6DD19C]/45 bg-[#152822] p-2.5 text-[11px] leading-relaxed text-[#E9EDF2]">
                <strong className="block font-semibold text-[#6DD19C]">
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
          <section className="space-y-3 rounded-lg border border-[#2D3B4E] bg-[#243041] p-3.5">
            <div>
              <span className="font-mono text-[11px] text-[#35C2D1]">
                CIRCUITO INTEGRADO PROTAGONISTA
              </span>
              <h3 className="text-sm font-semibold text-[#E9EDF2]">
                {CHIP_74LS83_PLACEMENT.partNumber} ({CHIP_74LS83_PLACEMENT.shortName})
              </h3>
            </div>

            {!hasSpecificSelection && (
              <p className="text-xs leading-relaxed text-[#E9EDF2]">
                Sumador binario completo de 4 bits con acarreo anticipado interno (
                <em>Look-Ahead Carry</em>). Suma dos palabras de 4 bits (
                <code className="font-mono text-[#35C2D1]">A3..A0</code> y{' '}
                <code className="font-mono text-[#35C2D1]">B3..B0</code>) más un acarreo inicial{' '}
                <code className="font-mono text-[#F1B85A]">C0</code>, entregando la suma{' '}
                <code className="font-mono text-[#6DD19C]">S3..S0</code> y acarreo final{' '}
                <code className="font-mono text-[#6DD19C]">C4</code>.
              </p>
            )}

            {/* Diagnóstico eléctrico en tiempo real */}
            <div className="space-y-1.5 rounded-md border border-[#2D3B4E] bg-[#141A23] p-2.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-[#AEB8C5]">
                  Diagnóstico del motor eléctrico
                </span>
                <span
                  className={`font-mono text-[10px] font-semibold ${
                    solution.isHealthy
                      ? 'text-[#6DD19C]'
                      : solution.diagnostics.some((d) => d.severity === 'ERROR')
                        ? 'text-[#F06A6A]'
                        : 'text-[#F1B85A]'
                  }`}
                >
                  {solution.isHealthy
                    ? 'RED VERIFICADA'
                    : `${solution.diagnostics.length} incidencia(s)`}
                </span>
              </div>

              {solution.diagnostics.length === 0 ? (
                <p className="text-[11px] text-[#AEB8C5]">
                  Alimentación +5.0 V en Pin 5, GND en Pin 12, 9 entradas polarizadas y 5 etapas
                  LED conducidas sin errores.
                </p>
              ) : (
                <ul className="space-y-1 text-[11px]">
                  {solution.diagnostics.map((diag, idx) => (
                    <li
                      key={`${diag.code}-${idx}`}
                      className={`rounded border px-2 py-1 ${
                        diag.severity === 'ERROR'
                          ? 'border-[#F06A6A]/40 bg-[#F06A6A]/10 text-[#E9EDF2]'
                          : 'border-[#F1B85A]/35 bg-[#F1B85A]/10 text-[#E9EDF2]'
                      }`}
                    >
                      <strong className="block font-semibold">{diag.title}</strong>
                      <span className="text-[10px] text-[#AEB8C5]">{diag.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!hasSpecificSelection && (
              <div className="rounded-md border border-[#F1B85A]/35 bg-[#141A23] p-2.5 text-[11px] leading-relaxed text-[#AEB8C5]">
                <strong className="block font-semibold text-[#F1B85A]">
                  Nota crítica de patillaje (74LS83A ≠ 74LS283)
                </strong>
                En el 74LS83A, <strong className="text-[#E9EDF2]">VCC (+5 V) está en el Pin 5</strong>{' '}
                y <strong className="text-[#E9EDF2]">GND en el Pin 12</strong>. Con muesca a la
                izquierda en columna <code className="font-mono text-[#E9EDF2]">c</code>, Pin 5 cae
                en <code className="font-mono text-[#E9EDF2]">f(c+4)</code> y Pin 12 en{' '}
                <code className="font-mono text-[#E9EDF2]">e(c+4)</code>.
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
