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
    _accent: 'cyan' | 'violet' | 'amber',
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

    const activeTone = isPsuOn
      ? 'border-white bg-white text-black font-bold shadow-[0_0_12px_rgba(255,255,255,0.35)] ring-1 ring-white/80'
      : 'border-zinc-600 bg-zinc-800 text-zinc-200 font-bold';

    return (
      <button
        key={spec.channelId}
        type="button"
        disabled={!isMounted}
        aria-pressed={isSwitchOn}
        aria-label={`Entrada ${spec.signal}, nivel ${isSwitchOn ? '1 lógico (alto)' : '0 lógico (bajo)'}`}
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
        className={`group relative flex h-12 min-w-11 flex-col items-center justify-center rounded-lg border px-2.5 py-1 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white ${
          !isMounted
            ? 'cursor-not-allowed border-zinc-900 bg-zinc-950/40 text-zinc-600'
            : isSwitchOn
              ? `cursor-pointer ${activeTone}`
              : 'cursor-pointer border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-zinc-600'
        } ${
          isSelected
            ? 'ring-2 ring-white'
            : isTraced
              ? 'ring-1 ring-zinc-400'
              : ''
        }`}
      >
        <span
          className={`font-mono text-[11px] font-semibold leading-none ${
            isSwitchOn && isPsuOn ? 'text-black' : 'text-zinc-400 group-hover:text-white'
          }`}
        >
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

    const litClasses =
      'border-white bg-white text-black font-bold shadow-[0_0_16px_rgba(255,255,255,0.6)] ring-1 ring-white';

    const dotClasses = isLit
      ? 'bg-black shadow-[0_0_6px_rgba(0,0,0,0.5)]'
      : 'bg-zinc-700';

    return (
      <button
        key={spec.ledId}
        type="button"
        aria-label={`Salida LED ${spec.signal}, valor ${bitText}, ${isLit ? 'encendido' : 'apagado'}`}
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
        className={`relative flex h-12 min-w-11 cursor-pointer flex-col items-center justify-center rounded-lg border px-2.5 py-1 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white ${
          isLit
            ? litClasses
            : resolvedBit === 0
              ? 'border-zinc-800 bg-zinc-950 text-zinc-200 hover:border-zinc-600'
              : 'border-zinc-850 bg-zinc-950/60 text-zinc-500 hover:border-zinc-700'
        } ${
          isSelected
            ? 'ring-2 ring-white'
            : isTraced
              ? 'ring-1 ring-zinc-400'
              : ''
        }`}
      >
        <div className="flex items-center gap-1">
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClasses}`} />
          <span
            className={`font-mono text-[11px] font-semibold leading-none ${
              isLit ? 'text-black' : 'text-zinc-400'
            }`}
          >
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
      className="shrink-0 rounded-2xl border border-zinc-800/80 bg-zinc-950/95 px-4 py-3 shadow-sm backdrop-blur-md"
    >
      {/* Franja superior compacta: Fuente +5 V, Ejemplos rápidos y Trazado eléctrico */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
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
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1 font-mono text-xs font-semibold transition-all ${
              isPsuOn
                ? 'border-zinc-600 bg-zinc-800 text-white shadow-xs hover:bg-zinc-700 hover:border-zinc-500'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isPsuOn ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'border border-zinc-500 bg-transparent'
              }`}
            />
            <span>{isPsuOn ? 'Fuente +5.0 V: ON' : 'Fuente +5.0 V: APAGADA (STBY)'}</span>
          </button>

          <div className="hidden h-4 w-px bg-zinc-800 sm:block" />

          {/* Ejemplos rápidos (configuran los interruptores reales del circuito) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-zinc-400">Ejemplos:</span>
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
                  className={`rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold transition-all ${
                    !anySwitchMounted
                      ? 'cursor-not-allowed border-zinc-900 bg-zinc-950/40 text-zinc-600'
                      : isActivePreset
                        ? 'cursor-pointer border-white bg-white text-black font-bold shadow-xs'
                        : 'cursor-pointer border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-zinc-600 hover:text-white'
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
            className="text-[11px] font-medium text-zinc-400"
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
            className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
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
              className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono text-[11px] font-medium text-white hover:bg-zinc-700"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Consola principal de operación: Interruptores A, B, C0 -> LEDs C4/S3..S0 -> Lectura DEC/BIN/HEX */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Bloque de 9 interruptores de entrada organizados en Bento Cards */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Operando A Bento Box */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Entrada A
              </span>
              <span className="font-mono text-xs font-bold text-white">
                {adder ? `${adder.operandA} (${adder.formatted.aHex})` : '—'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {INPUT_A_CHANNELS.map((ch) => renderInputSwitchButton(ch, 'cyan'))}
            </div>
          </div>

          <span className="px-0.5 font-mono text-base font-bold text-zinc-500">+</span>

          {/* Operando B Bento Box */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Entrada B
              </span>
              <span className="font-mono text-xs font-bold text-white">
                {adder ? `${adder.operandB} (${adder.formatted.bHex})` : '—'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {INPUT_B_CHANNELS.map((ch) => renderInputSwitchButton(ch, 'violet'))}
            </div>
          </div>

          <span className="px-0.5 font-mono text-base font-bold text-zinc-500">+</span>

          {/* Acarreo Cin (C0) Bento Box */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Cin
              </span>
            </div>
            {renderInputSwitchButton(CARRY_IN_CHANNEL, 'amber')}
          </div>
        </div>

        {/* Bloque de salidas reales (LEDs C4, S3..S0) y resultado multibase */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Bento Box LEDs */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Salidas LED (Cout · Σ)
              </span>
              <span className="font-mono text-[11px] text-zinc-300">
                {adder ? `C4=${adder.carryOut} · Σ=${adder.sumValue}` : 'Inactivas'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {OUTPUT_LED_SLOTS.map((slot) => renderOutputLedButton(slot))}
            </div>
          </div>

          {/* Visor multibase DEC · BIN · HEX o alerta educativa en Bento Card */}
          {adder ? (
            <div className="flex items-center gap-4 rounded-xl border border-zinc-700/80 bg-gradient-to-br from-zinc-900 to-zinc-950 px-4 py-2.5 shadow-sm">
              <div className="border-r border-zinc-800 pr-3.5">
                <span className="block font-mono text-[10px] uppercase text-zinc-400">
                  Operación (DEC)
                </span>
                <span className="font-mono text-base font-bold text-zinc-200">
                  {adder.operandA} + {adder.operandB} + {adder.carryIn} ={' '}
                  <strong className="text-white font-extrabold">{adder.totalValue}</strong>
                </span>
              </div>
              <div className="border-r border-zinc-800 pr-3.5">
                <span className="block font-mono text-[10px] uppercase text-zinc-400">
                  Binario (5 bits)
                </span>
                <span className="font-mono text-base font-bold text-white">
                  <span className="rounded bg-zinc-800 px-1 py-0.5 text-white border border-zinc-700">
                    {adder.carryOut}
                  </span>{' '}
                  {adder.formatted.sumBinary4}
                </span>
              </div>
              <div>
                <span className="block font-mono text-[10px] uppercase text-zinc-400">
                  Hexadecimal
                </span>
                <span className="font-mono text-base font-bold text-white">
                  {adder.formatted.totalHex}{' '}
                  <span className="text-xs font-normal text-zinc-400">
                    (Σ={adder.formatted.sumHex})
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <div
              role="status"
              aria-live="polite"
              className="flex max-w-md items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-900/90 px-4 py-2.5 shadow-sm"
            >
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold text-white">
                  {!isPsuOn
                    ? 'Sin salida válida · Fuente +5.0 V apagada (STBY)'
                    : `Circuito incompleto o fallo · ${firstError?.title ?? 'Revisa conexiones'}`}
                </div>
                <p className="truncate text-xs text-zinc-400">
                  {!isPsuOn
                    ? 'El 74LS83A requiere +5 V en Pin 5 (VCC); LEDs y salidas permanecen apagados.'
                    : firstError?.message ?? 'Verifica alimentación y entradas del circuito.'}
                </p>
              </div>
              {!isPsuOn && (
                <button
                  type="button"
                  onClick={() => setPowerSupplyOn(true)}
                  className="shrink-0 cursor-pointer rounded-lg border border-white bg-white px-3 py-1 font-mono text-xs font-bold text-black hover:bg-zinc-200"
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
