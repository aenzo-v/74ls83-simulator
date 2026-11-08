import { useMemo, useState } from 'react';
import {
  EDITABLE_KIT_CATALOG,
  getKitAvailability,
  type ResistorDisposition,
  WIRE_COLOR_PALETTE,
} from '../../simulator/editableCircuit';
import { type EditorTool, useLabStore } from '../../store/useLabStore';

const TOOL_BUTTONS: readonly {
  readonly id: EditorTool;
  readonly label: string;
  readonly helpEs: string;
}[] = [
  {
    id: 'select',
    label: 'Seleccionar',
    helpEs: 'Haz clic en cualquier pin, componente, cable o agujero para inspeccionarlo.',
  },
  {
    id: 'place',
    label: 'Colocar',
    helpEs: 'Elige un elemento del kit y haz clic sobre la protoboard (alineación a 2.54 mm).',
  },
  {
    id: 'wire',
    label: 'Cablear',
    helpEs:
      'Haz clic en el contacto de origen y luego en el destino libre (incluidos bornes +5 V y GND).',
  },
  {
    id: 'remove',
    label: 'Quitar',
    helpEs:
      'Haz clic en un cable para eliminarlo o en un componente para retirarlo con confirmación.',
  },
];

const RESISTOR_DISPOSITIONS: readonly {
  readonly id: ResistorDisposition;
  readonly label: string;
  readonly title: string;
}[] = [
  {
    id: 'to-rail-gnd',
    label: 'A riel (−)',
    title: 'Conecta entre una fila exterior (a o j) y el riel negativo GND contiguo',
  },
  {
    id: 'trench-bridge',
    label: 'Canal d↔f',
    title: 'Cruza el canal central verticalmente entre fila d y fila f (ideal para serie de LED)',
  },
  {
    id: 'horizontal-4',
    label: 'Horiz. (4p)',
    title: 'Conecta horizontalmente entre dos columnas separadas 4 pasos en la misma fila',
  },
  {
    id: 'two-point',
    label: '2 puntos',
    title: 'Elige manualmente primero un agujero y luego el segundo agujero (1 a 9 pasos)',
  },
];

export function EditorToolbar() {
  const mode = useLabStore((s) => s.mode);
  const workingCircuit = useLabStore((s) => s.workingCircuit);
  const activeTool = useLabStore((s) => s.activeTool);
  const activeKitItem = useLabStore((s) => s.activeKitItem);
  const resistorDisposition = useLabStore((s) => s.resistorDisposition);
  const ledReversed = useLabStore((s) => s.ledReversed);
  const activeWireColor = useLabStore((s) => s.activeWireColor);
  const wireDraft = useLabStore((s) => s.wireDraft);
  const resistorAnchorHoleId = useLabStore((s) => s.resistorAnchorHoleId);
  const pendingRemoval = useLabStore((s) => s.pendingRemoval);
  const editorFeedback = useLabStore((s) => s.editorFeedback);
  const undoStack = useLabStore((s) => s.undoStack);
  const redoStack = useLabStore((s) => s.redoStack);

  const setActiveTool = useLabStore((s) => s.setActiveTool);
  const setActiveKitItem = useLabStore((s) => s.setActiveKitItem);
  const setResistorDisposition = useLabStore((s) => s.setResistorDisposition);
  const setLedReversed = useLabStore((s) => s.setLedReversed);
  const setActiveWireColor = useLabStore((s) => s.setActiveWireColor);
  const cancelActiveOperation = useLabStore((s) => s.cancelActiveOperation);
  const setPendingRemovalCascade = useLabStore((s) => s.setPendingRemovalCascade);
  const confirmComponentRemoval = useLabStore((s) => s.confirmComponentRemoval);
  const undo = useLabStore((s) => s.undo);
  const redo = useLabStore((s) => s.redo);
  const resetWorkingCircuit = useLabStore((s) => s.resetWorkingCircuit);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const availability = useMemo(() => getKitAvailability(workingCircuit), [workingCircuit]);

  if (mode !== 'guided') {
    return null;
  }

  const activeToolMeta = TOOL_BUTTONS.find((t) => t.id === activeTool)!;
  const activeKitEntry = EDITABLE_KIT_CATALOG.find((k) => k.type === activeKitItem)!;
  const activeColorMeta = WIRE_COLOR_PALETTE.find(
    (c) => c.colorHex.toLowerCase() === activeWireColor.toLowerCase(),
  );

  const hasAnyPlacedElements =
    workingCircuit.chip !== null ||
    workingCircuit.dipSwitches.length > 0 ||
    workingCircuit.resistors.length > 0 ||
    workingCircuit.leds.length > 0 ||
    workingCircuit.wires.length > 0;

  return (
    <section
      aria-label="Herramientas de montaje y cableado 3D"
      className="shrink-0 rounded-2xl border border-zinc-800/80 bg-zinc-950/90 px-3.5 py-2 shadow-sm backdrop-blur-md"
    >
      {/* Fila principal: Herramientas, Historial, Reinicio y Estado contextual */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Grupo de 4 herramientas interactivas */}
          <div
            role="toolbar"
            aria-label="Herramienta activa"
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 p-0.5"
          >
            {TOOL_BUTTONS.map((tool) => {
              const isActive = activeTool === tool.id;
              const activeStyles =
                tool.id === 'remove'
                  ? 'bg-zinc-200 text-black font-semibold shadow-xs ring-1 ring-white/80'
                  : 'bg-white text-black font-semibold shadow-xs ring-1 ring-white/50';

              return (
                <button
                  key={tool.id}
                  type="button"
                  aria-pressed={isActive}
                  title={tool.helpEs}
                  onClick={() => {
                    setConfirmResetOpen(false);
                    setActiveTool(tool.id);
                  }}
                  className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                    isActive
                      ? activeStyles
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  {tool.label}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Deshacer / Rehacer */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={() => undo()}
              title="Deshacer última acción sobre el circuito (Ctrl+Z)"
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Deshacer
            </button>
            <button
              type="button"
              disabled={redoStack.length === 0}
              onClick={() => redo()}
              title="Rehacer acción deshecha (Ctrl+Shift+Z)"
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Rehacer
            </button>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Reiniciar montaje con confirmación discreta */}
          {!confirmResetOpen ? (
            <button
              type="button"
              disabled={!hasAnyPlacedElements}
              onClick={() => setConfirmResetOpen(true)}
              title="Vaciar la protoboard de trabajo para iniciar el montaje desde cero"
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reiniciar montaje
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-0.5 text-[11px]">
              <span className="font-medium text-white">¿Vaciar protoboard?</span>
              <button
                type="button"
                onClick={() => {
                  resetWorkingCircuit();
                  setConfirmResetOpen(false);
                }}
                className="cursor-pointer rounded bg-white px-2 py-0.5 font-bold text-black hover:bg-zinc-200"
              >
                Sí, reiniciar
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="cursor-pointer rounded px-1.5 py-0.5 text-zinc-400 hover:text-white"
              >
                No
              </button>
            </div>
          )}
        </div>

        {/* Mensaje contextual breve + atajos */}
        <div className="flex items-center gap-2 text-[11px]">
          {editorFeedback ? (
            <span
              role="status"
              className={`rounded-lg border px-2.5 py-0.5 font-mono ${
                editorFeedback.tone === 'error'
                  ? 'border-zinc-500 bg-zinc-900 text-white font-bold'
                  : editorFeedback.tone === 'success'
                    ? 'border-zinc-600 bg-zinc-800 text-white'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-200'
              }`}
            >
              {editorFeedback.textEs}
            </span>
          ) : (
            <span className="text-zinc-400">{activeToolMeta.helpEs}</span>
          )}
          <span className="hidden rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 font-mono text-[10px] text-zinc-400 xl:inline-block">
            Esc cancelar · Supr borrar · Ctrl+Z deshacer
          </span>
        </div>
      </div>

      {/* Subbarra contextual para Herramienta COLOCAR: Bandeja del Kit 74LS83A */}
      {activeTool === 'place' && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Kit 74LS83A:
            </span>
            {EDITABLE_KIT_CATALOG.map((entry) => {
              const avail = availability[entry.type];
              const selected = activeKitItem === entry.type;
              const exhausted = avail.remainingCount === 0;
              return (
                <button
                  key={entry.type}
                  type="button"
                  onClick={() => setActiveKitItem(entry.type)}
                  title={`${entry.fullLabel} — ${entry.hintEs}`}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all ${
                    selected
                      ? 'border-white bg-white text-black font-semibold shadow-xs'
                      : exhausted
                        ? 'border-zinc-850 bg-zinc-950 text-zinc-600 hover:border-zinc-750'
                        : 'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-zinc-600 hover:text-white'
                  }`}
                >
                  <span>{entry.shortLabel}</span>
                  <span
                    className={`rounded px-1.5 py-0.2 font-mono text-[10px] ${
                      selected
                        ? 'bg-zinc-900 text-white'
                        : exhausted
                          ? 'bg-zinc-900 text-zinc-600'
                          : 'bg-zinc-800 text-zinc-200'
                    }`}
                  >
                    {avail.remainingCount}/{avail.totalCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Controles de orientación / disposición para resistencias y LEDs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(activeKitItem === 'resistor-330' || activeKitItem === 'resistor-1k') && (
              <>
                <span className="font-mono text-[10px] text-zinc-400">Disposición (R):</span>
                {RESISTOR_DISPOSITIONS.map((disp) => (
                  <button
                    key={disp.id}
                    type="button"
                    title={disp.title}
                    onClick={() => setResistorDisposition(disp.id)}
                    className={`cursor-pointer rounded-lg border px-2.5 py-0.5 font-mono text-[10px] transition-all ${
                      resistorDisposition === disp.id
                        ? 'border-white bg-white text-black font-bold shadow-xs'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-white'
                    }`}
                  >
                    {disp.label}
                  </button>
                ))}
                {resistorAnchorHoleId && (
                  <button
                    type="button"
                    onClick={cancelActiveOperation}
                    className="cursor-pointer rounded-lg border border-zinc-600 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-white"
                  >
                    Cancelar 1ª pata ({resistorAnchorHoleId})
                  </button>
                )}
              </>
            )}

            {(activeKitItem === 'led-amber' || activeKitItem === 'led-green') && (
              <>
                <span className="font-mono text-[10px] text-zinc-400">Polaridad (R):</span>
                <button
                  type="button"
                  onClick={() => setLedReversed(!ledReversed)}
                  title="Alternar orientación del ánodo (+) y cátodo (− / bisel plano)"
                  className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-white hover:border-zinc-500"
                >
                  {ledReversed
                    ? 'Invertida: Cátodo (−) izq. · Ánodo (+) der.'
                    : 'Estándar: Ánodo (+) izq. · Cátodo (−) der.'}
                </button>
              </>
            )}

            {activeKitItem !== 'resistor-330' &&
              activeKitItem !== 'resistor-1k' &&
              activeKitItem !== 'led-amber' &&
              activeKitItem !== 'led-green' && (
                <span className="text-[11px] text-zinc-400">{activeKitEntry.hintEs}</span>
              )}
          </div>
        </div>
      )}

      {/* Subbarra contextual para Herramienta CABLEAR: Selector de colores y estado de origen */}
      {activeTool === 'wire' && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Color de aislamiento:
            </span>
            {WIRE_COLOR_PALETTE.map((opt) => {
              const isSelectedColor =
                opt.colorHex.toLowerCase() === activeWireColor.toLowerCase();
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setActiveWireColor(opt.colorHex)}
                  title={`${opt.label} — Convención sugerida: ${opt.conventionEs} (propiedad puramente visual)`}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[11px] transition-all ${
                    isSelectedColor
                      ? 'border-white bg-zinc-800 font-semibold text-white ring-1 ring-white/50 shadow-xs'
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-600 hover:text-white'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-white/40"
                    style={{ backgroundColor: opt.colorHex }}
                  />
                  <span>{opt.label}</span>
                  <span className="hidden font-mono text-[10px] text-zinc-400 md:inline">
                    ({opt.conventionEs})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {wireDraft ? (
              <>
                <span className="rounded-lg border border-zinc-600 bg-zinc-900 px-2.5 py-0.5 font-mono text-[11px] text-white">
                  Origen: {wireDraft.fromTerminalId} → elige destino
                </span>
                <button
                  type="button"
                  onClick={cancelActiveOperation}
                  className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:border-zinc-600 hover:text-white"
                >
                  Cancelar (Esc)
                </button>
              </>
            ) : (
              <span className="text-[11px] text-zinc-400">
                Color activo:{' '}
                <strong className="text-white">{activeColorMeta?.label ?? 'Rojo'}</strong> · El
                color es visual; la función eléctrica depende solo de los nodos conectados.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Barra de confirmación explícita al retirar un componente con posibles cables asociados */}
      {pendingRemoval && (
        <div
          role="alertdialog"
          aria-label="Confirmar retirada de componente"
          className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-600 bg-zinc-900 p-2.5 text-xs"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-white">
              Retirar {pendingRemoval.componentLabel}
            </span>
            {pendingRemoval.associatedWireCount > 0 ? (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-200">
                <input
                  type="checkbox"
                  checked={pendingRemoval.cascadeWires}
                  onChange={(e) => setPendingRemovalCascade(e.target.checked)}
                  className="accent-white"
                />
                <span>
                  Retirar también {pendingRemoval.associatedWireCount} cable(s) conectado(s) a sus
                  pistas
                </span>
              </label>
            ) : (
              <span className="text-[11px] text-zinc-400">
                Se liberarán sus contactos en la protoboard sin dejar conexiones fantasma.
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => confirmComponentRemoval()}
              className="cursor-pointer rounded-lg border border-white bg-white px-3 py-1 font-mono text-[11px] font-bold text-black hover:bg-zinc-200"
            >
              Confirmar retirada
            </button>
            <button
              type="button"
              onClick={cancelActiveOperation}
              className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
