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
      className="shrink-0 border-b border-[#2D3B4E] bg-[#171E28] px-3 py-1.5"
    >
      {/* Fila principal: Herramientas, Historial, Reinicio y Estado contextual */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Grupo de 4 herramientas interactivas */}
          <div
            role="toolbar"
            aria-label="Herramienta activa"
            className="flex items-center gap-1 rounded-md border border-[#2D3B4E] bg-[#10141B] p-0.5"
          >
            {TOOL_BUTTONS.map((tool) => {
              const isActive = activeTool === tool.id;
              const activeStyles =
                tool.id === 'remove'
                  ? 'bg-[#361B22] text-[#F06A6A] ring-1 ring-[#F06A6A]/55'
                  : 'bg-[#243041] text-[#35C2D1] ring-1 ring-[#35C2D1]/50';

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
                  className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? activeStyles
                      : 'text-[#AEB8C5] hover:bg-[#1C2430] hover:text-[#E9EDF2]'
                  }`}
                >
                  {tool.label}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-[#2D3B4E]" />

          {/* Deshacer / Rehacer */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={() => undo()}
              title="Deshacer última acción sobre el circuito (Ctrl+Z)"
              className="cursor-pointer rounded border border-[#2D3B4E] bg-[#243041] px-2 py-1 font-mono text-[11px] font-medium text-[#E9EDF2] transition-colors hover:border-[#35C2D1]/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Deshacer
            </button>
            <button
              type="button"
              disabled={redoStack.length === 0}
              onClick={() => redo()}
              title="Rehacer acción deshecha (Ctrl+Shift+Z)"
              className="cursor-pointer rounded border border-[#2D3B4E] bg-[#243041] px-2 py-1 font-mono text-[11px] font-medium text-[#E9EDF2] transition-colors hover:border-[#35C2D1]/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Rehacer
            </button>
          </div>

          <div className="h-4 w-px bg-[#2D3B4E]" />

          {/* Reiniciar montaje con confirmación discreta */}
          {!confirmResetOpen ? (
            <button
              type="button"
              disabled={!hasAnyPlacedElements}
              onClick={() => setConfirmResetOpen(true)}
              title="Vaciar la protoboard de trabajo para iniciar el montaje desde cero"
              className="cursor-pointer rounded border border-[#2D3B4E] bg-[#1C2430] px-2 py-1 text-[11px] font-medium text-[#AEB8C5] transition-colors hover:border-[#F06A6A]/55 hover:text-[#F06A6A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reiniciar montaje
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded border border-[#F06A6A]/55 bg-[#2A171D] px-2 py-0.5 text-[11px]">
              <span className="text-[#F06A6A]">¿Vaciar protoboard?</span>
              <button
                type="button"
                onClick={() => {
                  resetWorkingCircuit();
                  setConfirmResetOpen(false);
                }}
                className="cursor-pointer rounded bg-[#F06A6A]/20 px-1.5 py-0.5 font-semibold text-[#F06A6A] hover:bg-[#F06A6A]/35"
              >
                Sí, reiniciar
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="cursor-pointer rounded px-1.5 py-0.5 text-[#AEB8C5] hover:text-[#E9EDF2]"
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
              className={`rounded border px-2 py-0.5 font-mono ${
                editorFeedback.tone === 'error'
                  ? 'border-[#F06A6A]/55 bg-[#2A171D] text-[#F06A6A]'
                  : editorFeedback.tone === 'success'
                    ? 'border-[#6DD19C]/50 bg-[#152822] text-[#6DD19C]'
                    : 'border-[#35C2D1]/45 bg-[#141A23] text-[#E9EDF2]'
              }`}
            >
              {editorFeedback.textEs}
            </span>
          ) : (
            <span className="text-[#AEB8C5]">{activeToolMeta.helpEs}</span>
          )}
          <span className="hidden rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-0.5 font-mono text-[10px] text-[#AEB8C5] xl:inline-block">
            Esc cancelar · Supr borrar · Ctrl+Z deshacer
          </span>
        </div>
      </div>

      {/* Subbarra contextual para Herramienta COLOCAR: Bandeja del Kit 74LS83A */}
      {activeTool === 'place' && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#253142] pt-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-[#AEB8C5]">
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
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    selected
                      ? 'border-[#35C2D1] bg-[#35C2D1]/18 text-[#E9EDF2]'
                      : exhausted
                        ? 'border-[#273344] bg-[#141A23]/60 text-[#AEB8C5]/55 hover:border-[#3D5068]'
                        : 'border-[#2D3B4E] bg-[#141A23] text-[#E9EDF2] hover:border-[#35C2D1]/50'
                  }`}
                >
                  <span>{entry.shortLabel}</span>
                  <span
                    className={`rounded px-1 font-mono text-[10px] ${
                      exhausted
                        ? 'bg-[#243041] text-[#AEB8C5]/60'
                        : 'bg-[#243041] text-[#6DD19C]'
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
                <span className="font-mono text-[10px] text-[#AEB8C5]">Disposición (R):</span>
                {RESISTOR_DISPOSITIONS.map((disp) => (
                  <button
                    key={disp.id}
                    type="button"
                    title={disp.title}
                    onClick={() => setResistorDisposition(disp.id)}
                    className={`cursor-pointer rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                      resistorDisposition === disp.id
                        ? 'border-[#F1B85A] bg-[#F1B85A]/18 text-[#F1B85A]'
                        : 'border-[#2D3B4E] bg-[#141A23] text-[#AEB8C5] hover:text-[#E9EDF2]'
                    }`}
                  >
                    {disp.label}
                  </button>
                ))}
                {resistorAnchorHoleId && (
                  <button
                    type="button"
                    onClick={cancelActiveOperation}
                    className="cursor-pointer rounded border border-[#F1B85A]/55 bg-[#243041] px-2 py-0.5 font-mono text-[10px] text-[#F1B85A]"
                  >
                    Cancelar 1ª pata ({resistorAnchorHoleId})
                  </button>
                )}
              </>
            )}

            {(activeKitItem === 'led-amber' || activeKitItem === 'led-green') && (
              <>
                <span className="font-mono text-[10px] text-[#AEB8C5]">Polaridad (R):</span>
                <button
                  type="button"
                  onClick={() => setLedReversed(!ledReversed)}
                  title="Alternar orientación del ánodo (+) y cátodo (− / bisel plano)"
                  className="cursor-pointer rounded border border-[#F1B85A]/60 bg-[#F1B85A]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#F1B85A]"
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
                <span className="text-[11px] text-[#AEB8C5]">{activeKitEntry.hintEs}</span>
              )}
          </div>
        </div>
      )}

      {/* Subbarra contextual para Herramienta CABLEAR: Selector de colores y estado de origen */}
      {activeTool === 'wire' && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#253142] pt-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#AEB8C5]">
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
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] transition-colors ${
                    isSelectedColor
                      ? 'border-[#E9EDF2] bg-[#243041] font-semibold text-[#E9EDF2]'
                      : 'border-[#2D3B4E] bg-[#141A23] text-[#AEB8C5] hover:text-[#E9EDF2]'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-white/30"
                    style={{ backgroundColor: opt.colorHex }}
                  />
                  <span>{opt.label}</span>
                  <span className="hidden font-mono text-[10px] text-[#AEB8C5] md:inline">
                    ({opt.conventionEs})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {wireDraft ? (
              <>
                <span className="rounded border border-[#F1B85A]/60 bg-[#243041] px-2 py-0.5 font-mono text-[11px] text-[#F1B85A]">
                  Origen: {wireDraft.fromTerminalId} → elige destino
                </span>
                <button
                  type="button"
                  onClick={cancelActiveOperation}
                  className="cursor-pointer rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-0.5 font-mono text-[10px] text-[#E9EDF2] hover:border-[#F06A6A]/60 hover:text-[#F06A6A]"
                >
                  Cancelar (Esc)
                </button>
              </>
            ) : (
              <span className="text-[11px] text-[#AEB8C5]">
                Color activo:{' '}
                <strong className="text-[#E9EDF2]">{activeColorMeta?.label ?? 'Rojo'}</strong> · El
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
          className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#F06A6A]/60 bg-[#26161C] px-3 py-1.5 text-xs"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-[#F06A6A]">
              Retirar {pendingRemoval.componentLabel}
            </span>
            {pendingRemoval.associatedWireCount > 0 ? (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-[#E9EDF2]">
                <input
                  type="checkbox"
                  checked={pendingRemoval.cascadeWires}
                  onChange={(e) => setPendingRemovalCascade(e.target.checked)}
                  className="accent-[#F06A6A]"
                />
                <span>
                  Retirar también {pendingRemoval.associatedWireCount} cable(s) conectado(s) a sus
                  pistas
                </span>
              </label>
            ) : (
              <span className="text-[11px] text-[#AEB8C5]">
                Se liberarán sus contactos en la protoboard sin dejar conexiones fantasma.
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => confirmComponentRemoval()}
              className="cursor-pointer rounded border border-[#F06A6A]/70 bg-[#F06A6A]/20 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#F06A6A] hover:bg-[#F06A6A]/35"
            >
              Confirmar retirada
            </button>
            <button
              type="button"
              onClick={cancelActiveOperation}
              className="cursor-pointer rounded border border-[#2D3B4E] bg-[#141A23] px-2 py-0.5 font-mono text-[11px] text-[#AEB8C5] hover:text-[#E9EDF2]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
