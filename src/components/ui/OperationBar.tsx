import { useMemo } from 'react';
import { POWER_SUPPLY_5V } from '../../data/circuitLayout';
import { doesPresetMatchSwitches, QUICK_ADDITION_PRESETS } from '../../data/presets';
import type { PinNumber, SignalCode } from '../../simulator/types';
import {
  useActiveSwitchStates,
  useCircuitSolution,
  useDisplayedCircuit,
} from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';

interface InputChannelButtonSpec {
  readonly signal: SignalCode;
  readonly channelId: string;
  readonly componentId: string;
  readonly pin: PinNumber;
}

interface OutputLedSlotSpec {
  readonly signal: SignalCode;
  readonly ledId: string;
  readonly pin: PinNumber;
  readonly isCarry: boolean;
}

const INPUT_A_CHANNELS: readonly InputChannelButtonSpec[] = [
  { signal: 'A3', channelId: 'sw-a3', componentId: 'dip-sw-a', pin: 1 },
  { signal: 'A2', channelId: 'sw-a2', componentId: 'dip-sw-a', pin: 3 },
  { signal: 'A1', channelId: 'sw-a1', componentId: 'dip-sw-a', pin: 8 },
  { signal: 'A0', channelId: 'sw-a0', componentId: 'dip-sw-a', pin: 10 },
];

const INPUT_B_CHANNELS: readonly InputChannelButtonSpec[] = [
  { signal: 'B3', channelId: 'sw-b3', componentId: 'dip-sw-b', pin: 16 },
  { signal: 'B2', channelId: 'sw-b2', componentId: 'dip-sw-b', pin: 4 },
  { signal: 'B1', channelId: 'sw-b1', componentId: 'dip-sw-b', pin: 7 },
  { signal: 'B0', channelId: 'sw-b0', componentId: 'dip-sw-b', pin: 11 },
];

const CARRY_IN_CHANNEL: InputChannelButtonSpec = {
  signal: 'C0',
  channelId: 'sw-c0',
  componentId: 'dip-sw-c0',
  pin: 13,
};

const OUTPUT_LED_SLOTS: readonly OutputLedSlotSpec[] = [
  { signal: 'C4', ledId: 'led-c4', pin: 14, isCarry: true },
  { signal: 'S3', ledId: 'led-s3', pin: 15, isCarry: false },
  { signal: 'S2', ledId: 'led-s2', pin: 2, isCarry: false },
  { signal: 'S1', ledId: 'led-s1', pin: 6, isCarry: false },
  { signal: 'S0', ledId: 'led-s0', pin: 9, isCarry: false },
];

export function OperationBar() {
  const mode = useLabStore((s) => s.mode);
  const selection = useLabStore((s) => s.selection);
  const tracedSignal = useLabStore((s) => s.tracedSignal);
  const setSelection = useLabStore((s) => s.setSelection);
  const toggleSwitchState = useLabStore((s) => s.toggleSwitchState);
  const togglePowerSupply = useLabStore((s) => s.togglePowerSupply);
  const setPowerSupplyOn = useLabStore((s) => s.setPowerSupplyOn);
  const applyAdditionPreset = useLabStore((s) => s.applyAdditionPreset);
  const setTracedSignal = useLabStore((s) => s.setTracedSignal);

  const circuit = useDisplayedCircuit();
  const switchStates = useActiveSwitchStates();
  const solution = useCircuitSolution();

  const placedDipIds = useMemo(
    () => new Set(circuit.dipSwitches.map((s) => s.id)),
    [circuit.dipSwitches],
  );
  const placedLedIds = useMemo(
    () => new Set(circuit.leds.map((l) => l.id)),
    [circuit.leds],
  );

  const adder = solution.adderOutput;
  const isPsuOn = Boolean(switchStates[POWER_SUPPLY_5V.id]);
  const firstError = solution.diagnostics.find((d) => d.severity === 'ERROR');
  const anySwitchMounted = placedDipIds.size > 0;

  const renderInputSwitchButton = (
    spec: InputChannelButtonSpec,
    accent: 'cyan' | 'violet' | 'amber',
  ) => {
    const isMounted = mode === 'mounted' || placedDipIds.has(spec.componentId);
    const isSwitchOn = isMounted && Boolean(switchStates[spec.channelId]);
    const pinState = solution.pins[spec.pin];
    const isSelected =
      (selection.kind === 'component' &&
        selection.componentId === spec.componentId &&
        selection.subChannelId === spec.channelId) ||
      (selection.kind === 'pin' && selection.pinNumber === spec.pin);
    const isTraced = tracedSignal === spec.signal;

    const activeTone =
      accent === 'cyan'
        ? isPsuOn
          ? 'border-[#35C2D1]/70 bg-[#35C2D1]/18 text-[#35C2D1]'
          : 'border-[#35C2D1]/40 bg-[#243041] text-[#AEB8C5]'
        : accent === 'violet'
          ? isPsuOn
            ? 'border-[#9D8CFF]/70 bg-[#9D8CFF]/18 text-[#C4B9FF]'
            : 'border-[#9D8CFF]/40 bg-[#243041] text-[#AEB8C5]'
          : isPsuOn
            ? 'border-[#F1B85A]/75 bg-[#F1B85A]/18 text-[#F1B85A]'
            : 'border-[#F1B85A]/40 bg-[#243041] text-[#AEB8C5]';

    return (
      <button
        key={spec.channelId}
        type="button"
        disabled={!isMounted}
        aria-pressed={isSwitchOn}
        onClick={() => {
          toggleSwitchState(spec.channelId);
          setSelection({
            kind: 'component',
            componentId: spec.componentId,
            subChannelId: spec.channelId,
          });
        }}
        title={
          isMounted
            ? `Conmutar interruptor ${spec.signal} (${isSwitchOn ? 'ON = 1' : 'OFF = 0'}) · Pin ${spec.pin} (${pinState?.netId ?? 'sin red'})`
            : `Coloca primero el interruptor ${spec.componentId} sobre la protoboard`
        }
        className={`group relative flex h-12 min-w-11 flex-col items-center justify-center rounded-md border px-2.5 py-1 transition-all ${
          !isMounted
            ? 'cursor-not-allowed border-[#253142] bg-[#141A23]/50 text-[#AEB8C5]/45'
            : isSwitchOn
              ? `cursor-pointer ${activeTone}`
              : 'cursor-pointer border-[#2D3B4E] bg-[#141A23] text-[#E9EDF2] hover:border-[#3D5068]'
        } ${
          isSelected
            ? 'ring-2 ring-[#F1B85A]/75'
            : isTraced
              ? 'ring-1 ring-[#35C2D1]'
              : ''
        }`}
      >
        <span className="font-mono text-[11px] font-semibold leading-none text-[#AEB8C5] group-hover:text-[#E9EDF2]">
          {spec.signal}
        </span>
        <span className="mt-0.5 font-mono text-base font-bold leading-none">
          {!isMounted ? '—' : isSwitchOn ? '1' : '0'}
        </span>
      </button>
    );
  };

  const renderOutputLedButton = (spec: OutputLedSlotSpec) => {
    const isLedMounted = mode === 'mounted' || placedLedIds.has(spec.ledId);
    const ledState = isLedMounted ? solution.leds[spec.ledId] : undefined;
    const pinState = solution.pins[spec.pin];
    const resolvedBit = adder ? pinState?.logicLevel : null;
    const isLit = Boolean(ledState?.isLit);

    const isSelected =
      (selection.kind === 'component' && selection.componentId === spec.ledId) ||
      (selection.kind === 'pin' && selection.pinNumber === spec.pin);
    const isTraced = tracedSignal === spec.signal;

    const bitText = resolvedBit === 1 ? '1' : resolvedBit === 0 ? '0' : '—';

    const litClasses = spec.isCarry
      ? 'border-[#F1B85A]/75 bg-[#F1B85A]/18 text-[#FFB238]'
      : 'border-[#6DD19C]/75 bg-[#6DD19C]/18 text-[#6DD19C]';

    const dotClasses = isLit
      ? spec.isCarry
        ? 'bg-[#FFB238] shadow-[0_0_6px_#FFB238]'
        : 'bg-[#6DD19C] shadow-[0_0_6px_#6DD19C]'
      : 'bg-[#2D3B4E]';

    return (
      <button
        key={spec.ledId}
        type="button"
        onClick={() => {
          if (isLedMounted) {
            setSelection({ kind: 'component', componentId: spec.ledId });
          } else if (circuit.chip) {
            setSelection({ kind: 'pin', pinNumber: spec.pin });
          }
        }}
        title={
          isLedMounted
            ? `Inspeccionar salida ${spec.signal} (Pin ${spec.pin} · ${ledState?.statusLabel ?? 'Sin evaluar'})`
            : `Salida ${spec.signal} (Pin ${spec.pin}) · LED aún no colocado`
        }
        className={`relative flex h-12 min-w-11 cursor-pointer flex-col items-center justify-center rounded-md border px-2.5 py-1 transition-all ${
          isLit
            ? litClasses
            : resolvedBit === 0
              ? 'border-[#2D3B4E] bg-[#141A23] text-[#E9EDF2] hover:border-[#3D5068]'
              : 'border-[#2D3B4E]/80 bg-[#141A23]/70 text-[#AEB8C5]/55 hover:border-[#3D5068]'
        } ${
          isSelected
            ? 'ring-2 ring-[#F1B85A]/75'
            : isTraced
              ? 'ring-1 ring-[#35C2D1]'
              : ''
        }`}
      >
        <div className="flex items-center gap-1">
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClasses}`} />
          <span className="font-mono text-[11px] font-semibold leading-none text-[#AEB8C5]">
            {spec.signal}
          </span>
        </div>
        <span className="mt-0.5 font-mono text-base font-bold leading-none">{bitText}</span>
      </button>
    );
  };

  return (
    <footer
      aria-label="Consola interactiva del circuito 74LS83A"
      className="shrink-0 border-t border-[#2D3B4E] bg-[#1C2430] px-4 py-2"
    >
      {/* Franja superior compacta: Fuente +5 V, Ejemplos rápidos y Trazado eléctrico */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#273344] pb-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Interruptor maestro de fuente +5 V */}
          <button
            type="button"
            aria-pressed={isPsuOn}
            onClick={() => {
              togglePowerSupply();
              setSelection({ kind: 'component', componentId: POWER_SUPPLY_5V.id });
            }}
            title="Encender o poner en espera la fuente regulada de +5.0 V CC"
            className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-xs font-semibold transition-colors ${
              isPsuOn
                ? 'border-[#6DD19C]/55 bg-[#6DD19C]/15 text-[#6DD19C] hover:bg-[#6DD19C]/25'
                : 'border-[#F1B85A]/60 bg-[#F1B85A]/15 text-[#F1B85A] hover:bg-[#F1B85A]/25'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isPsuOn ? 'bg-[#6DD19C] shadow-[0_0_6px_#6DD19C]' : 'bg-[#F1B85A]'
              }`}
            />
            <span>{isPsuOn ? 'Fuente +5.0 V: ON' : 'Fuente +5.0 V: APAGADA (STBY)'}</span>
          </button>

          <div className="hidden h-4 w-px bg-[#2D3B4E] sm:block" />

          {/* Ejemplos rápidos (configuran los interruptores reales del circuito) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-[#AEB8C5]">Ejemplos:</span>
            {QUICK_ADDITION_PRESETS.map((preset) => {
              const isActivePreset =
                anySwitchMounted && doesPresetMatchSwitches(preset, switchStates);
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={!anySwitchMounted}
                  onClick={() =>
                    applyAdditionPreset(preset.operandA, preset.operandB, preset.carryIn)
                  }
                  title={
                    anySwitchMounted
                      ? preset.description
                      : 'Coloca al menos un interruptor DIP en la protoboard para aplicar ejemplos'
                  }
                  className={`rounded border px-2 py-0.5 font-mono text-xs font-semibold transition-colors ${
                    !anySwitchMounted
                      ? 'cursor-not-allowed border-[#253142] bg-[#141A23]/50 text-[#AEB8C5]/45'
                      : isActivePreset
                        ? 'cursor-pointer border-[#35C2D1]/70 bg-[#35C2D1]/20 text-[#35C2D1]'
                        : 'cursor-pointer border-[#2D3B4E] bg-[#141A23] text-[#E9EDF2] hover:border-[#35C2D1]/45 hover:text-[#35C2D1]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector de resaltado de recorrido eléctrico */}
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="signal-trace-select"
            className="text-[11px] font-medium text-[#AEB8C5]"
          >
            Recorrido eléctrico:
          </label>
          <select
            id="signal-trace-select"
            value={tracedSignal ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setTracedSignal(val ? (val as SignalCode) : null);
            }}
            className="cursor-pointer rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-0.5 font-mono text-xs text-[#E9EDF2] focus:border-[#35C2D1] focus:outline-none"
          >
            <option value="">Sin resaltar (vista normal)</option>
            <optgroup label="Entradas Operando A">
              <option value="A3">Señal A3 (Pin 1)</option>
              <option value="A2">Señal A2 (Pin 3)</option>
              <option value="A1">Señal A1 (Pin 8)</option>
              <option value="A0">Señal A0 (Pin 10)</option>
            </optgroup>
            <optgroup label="Entradas Operando B">
              <option value="B3">Señal B3 (Pin 16)</option>
              <option value="B2">Señal B2 (Pin 4)</option>
              <option value="B1">Señal B1 (Pin 7)</option>
              <option value="B0">Señal B0 (Pin 11)</option>
            </optgroup>
            <optgroup label="Acarreo de entrada">
              <option value="C0">Señal C0 / Cin (Pin 13)</option>
            </optgroup>
            <optgroup label="Salidas Suma y Acarreo">
              <option value="C4">Salida C4 / Cout (Pin 14)</option>
              <option value="S3">Salida S3 (Pin 15)</option>
              <option value="S2">Salida S2 (Pin 2)</option>
              <option value="S1">Salida S1 (Pin 6)</option>
              <option value="S0">Salida S0 (Pin 9)</option>
            </optgroup>
            <optgroup label="Alimentación y Referencia">
              <option value="VCC">Bus +5.0 V / VCC (Pin 5)</option>
              <option value="GND">Retorno GND / 0 V (Pin 12)</option>
            </optgroup>
          </select>
          {tracedSignal && (
            <button
              type="button"
              onClick={() => setTracedSignal(null)}
              className="cursor-pointer rounded border border-[#35C2D1]/50 bg-[#35C2D1]/15 px-2 py-0.5 font-mono text-[11px] font-medium text-[#35C2D1] hover:bg-[#35C2D1]/25"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Consola principal de operación: Interruptores A, B, C0 -> LEDs C4/S3..S0 -> Lectura DEC/BIN/HEX */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Bloque de 9 interruptores de entrada */}
        <div className="flex flex-wrap items-end gap-2.5">
          {/* Operando A */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#35C2D1]">
                Entrada A
              </span>
              <span className="font-mono text-xs font-bold text-[#E9EDF2]">
                {adder ? `${adder.operandA} (${adder.formatted.aHex})` : '—'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {INPUT_A_CHANNELS.map((ch) => renderInputSwitchButton(ch, 'cyan'))}
            </div>
          </div>

          <span className="pb-3 font-mono text-base font-bold text-[#AEB8C5]">+</span>

          {/* Operando B */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B3A6FF]">
                Entrada B
              </span>
              <span className="font-mono text-xs font-bold text-[#E9EDF2]">
                {adder ? `${adder.operandB} (${adder.formatted.bHex})` : '—'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {INPUT_B_CHANNELS.map((ch) => renderInputSwitchButton(ch, 'violet'))}
            </div>
          </div>

          <span className="pb-3 font-mono text-base font-bold text-[#AEB8C5]">+</span>

          {/* Acarreo Cin (C0) */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F1B85A]">
                Cin
              </span>
            </div>
            {renderInputSwitchButton(CARRY_IN_CHANNEL, 'amber')}
          </div>
        </div>

        {/* Bloque de salidas reales (LEDs C4, S3..S0) y resultado multibase */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6DD19C]">
                Salidas LED (Cout · Σ)
              </span>
              <span className="font-mono text-[11px] text-[#AEB8C5]">
                {adder ? `C4=${adder.carryOut} · Σ=${adder.sumValue}` : 'Inactivas'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {OUTPUT_LED_SLOTS.map((slot) => renderOutputLedButton(slot))}
            </div>
          </div>

          {/* Visor multibase DEC · BIN · HEX o alerta educativa si no hay salida válida */}
          {adder ? (
            <div className="flex items-center gap-3 rounded-lg border border-[#2D3B4E] bg-[#141A23] px-3.5 py-1.5">
              <div className="border-r border-[#273344] pr-3">
                <span className="block font-mono text-[10px] uppercase text-[#AEB8C5]">
                  Operación (DEC)
                </span>
                <span className="font-mono text-base font-bold text-[#E9EDF2]">
                  {adder.operandA} + {adder.operandB} + {adder.carryIn} ={' '}
                  <strong className="text-[#6DD19C]">{adder.totalValue}</strong>
                </span>
              </div>
              <div className="border-r border-[#273344] pr-3">
                <span className="block font-mono text-[10px] uppercase text-[#AEB8C5]">
                  Binario (5 bits)
                </span>
                <span className="font-mono text-base font-bold text-[#6DD19C]">
                  <span className="text-[#FFB238]">{adder.carryOut}</span>{' '}
                  {adder.formatted.sumBinary4}
                </span>
              </div>
              <div>
                <span className="block font-mono text-[10px] uppercase text-[#AEB8C5]">
                  Hexadecimal
                </span>
                <span className="font-mono text-base font-bold text-[#35C2D1]">
                  {adder.formatted.totalHex}{' '}
                  <span className="text-xs font-normal text-[#AEB8C5]">
                    (Σ={adder.formatted.sumHex})
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div className="flex max-w-md items-center justify-between gap-3 rounded-lg border border-[#F1B85A]/55 bg-[#141A23] px-3.5 py-2">
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold text-[#F1B85A]">
                  {!isPsuOn
                    ? 'Sin salida válida · Fuente +5.0 V apagada (STBY)'
                    : `Circuito incompleto o fallo · ${firstError?.title ?? 'Revisa conexiones'}`}
                </div>
                <p className="truncate text-xs text-[#AEB8C5]">
                  {!isPsuOn
                    ? 'El 74LS83A requiere +5 V en Pin 5 (VCC); LEDs y salidas permanecen apagados.'
                    : firstError?.message ?? 'Verifica alimentación y entradas del circuito.'}
                </p>
              </div>
              {!isPsuOn && (
                <button
                  type="button"
                  onClick={() => setPowerSupplyOn(true)}
                  className="shrink-0 cursor-pointer rounded border border-[#6DD19C]/55 bg-[#6DD19C]/15 px-2.5 py-1 font-mono text-xs font-semibold text-[#6DD19C] hover:bg-[#6DD19C]/25"
                >
                  Encender +5 V
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
