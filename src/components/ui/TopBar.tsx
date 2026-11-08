import { useCircuitSolution } from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';

export function TopBar() {
  const mode = useLabStore((s) => s.mode);
  const setMode = useLabStore((s) => s.setMode);
  const resetCamera = useLabStore((s) => s.resetCamera);
  const setHelpModalOpen = useLabStore((s) => s.setHelpModalOpen);
  const isSidebarOpen = useLabStore((s) => s.isSidebarOpen);
  const toggleSidebar = useLabStore((s) => s.toggleSidebar);
  const togglePowerSupply = useLabStore((s) => s.togglePowerSupply);
  const solution = useCircuitSolution();

  const firstError = solution.diagnostics.find((d) => d.severity === 'ERROR');
  const firstWarning = solution.diagnostics.find((d) => d.severity === 'WARNING');

  let statusBorder = 'border-[#6DD19C]/35';
  let statusDot = 'bg-[#6DD19C]';
  let statusTextClass = 'text-[#6DD19C]';
  let statusPrimary = 'Motor activo';
  let statusSecondary = '· +5.0 V OK';
  let statusTitle = 'Netlist verificada sin errores eléctricos ni entradas flotantes.';

  if (firstError) {
    statusBorder = 'border-[#F06A6A]/45';
    statusDot = 'bg-[#F06A6A]';
    statusTextClass = 'text-[#F06A6A]';
    statusPrimary = 'Fallo eléctrico';
    statusSecondary = `· ${firstError.code}`;
    statusTitle = `${firstError.title}: ${firstError.message}`;
  } else if (!solution.isPowerSupplyOn) {
    statusBorder = 'border-[#F1B85A]/35';
    statusDot = 'bg-[#F1B85A]';
    statusTextClass = 'text-[#F1B85A]';
    statusPrimary = 'Sin alimentar';
    statusSecondary = '· Fuente en STBY';
    statusTitle = firstWarning?.message ?? 'Fuente regulada de +5.0 V en modo espera (STBY).';
  } else if (firstWarning) {
    statusBorder = 'border-[#F1B85A]/35';
    statusDot = 'bg-[#F1B85A]';
    statusTextClass = 'text-[#F1B85A]';
    statusPrimary = 'Aviso de red';
    statusSecondary = `· ${solution.diagnostics.length}`;
    statusTitle = `${firstWarning.title}: ${firstWarning.message}`;
  }

  return (
    <header className="flex h-13 shrink-0 items-center justify-between border-b border-[#2D3B4E] bg-[#1C2430] px-4">
      {/* Identidad del laboratorio */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#35C2D1]/40 bg-[#243041] font-mono text-xs font-bold text-[#35C2D1]">
          83A
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-[#E9EDF2]">
              74LS83 Lab
            </h1>
            <span className="hidden rounded border border-[#2D3B4E] bg-[#243041] px-1.5 py-0.5 font-mono text-[10px] text-[#AEB8C5] sm:inline-block">
              SN74LS83A · DIP-16
            </span>
          </div>
          <p className="hidden text-[11px] text-[#AEB8C5] md:block">
            Simulador 3D de sumador binario completo de 4 bits
          </p>
        </div>
      </div>

      {/* Selector de modo */}
      <nav
        aria-label="Modo del simulador"
        className="flex items-center rounded-lg border border-[#2D3B4E] bg-[#10141B] p-0.5"
      >
        <button
          type="button"
          onClick={() => setMode('mounted')}
          className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            mode === 'mounted'
              ? 'bg-[#243041] text-[#35C2D1] shadow-xs ring-1 ring-[#35C2D1]/40'
              : 'text-[#AEB8C5] hover:text-[#E9EDF2]'
          }`}
        >
          Circuito montado
        </button>
        <button
          type="button"
          onClick={() => setMode('guided')}
          className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            mode === 'guided'
              ? 'bg-[#243041] text-[#35C2D1] shadow-xs ring-1 ring-[#35C2D1]/40'
              : 'text-[#AEB8C5] hover:text-[#E9EDF2]'
          }`}
        >
          Montaje guiado
        </button>
      </nav>

      {/* Indicador en vivo de estado del motor eléctrico y utilidades */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={solution.isPowerSupplyOn}
          onClick={togglePowerSupply}
          title={`${statusTitle} (Haz clic para encender o apagar la fuente +5.0 V)`}
          className={`hidden cursor-pointer items-center gap-2 rounded-md border ${statusBorder} bg-[#243041]/85 px-2.5 py-1 text-[11px] text-[#E9EDF2] transition-colors hover:bg-[#2A384C] lg:flex`}
        >
          <span className={`h-2 w-2 rounded-full ${statusDot}`} />
          <span className={`font-medium ${statusTextClass}`}>{statusPrimary}</span>
          <span className="font-mono text-[#AEB8C5]">{statusSecondary}</span>
        </button>

        <button
          type="button"
          onClick={resetCamera}
          className="cursor-pointer rounded-md border border-[#2D3B4E] bg-[#243041] px-2.5 py-1 text-xs font-medium text-[#E9EDF2] transition-colors hover:border-[#35C2D1]/50 hover:text-[#35C2D1]"
        >
          Restablecer vista
        </button>

        <button
          type="button"
          onClick={() => setHelpModalOpen(true)}
          className="cursor-pointer rounded-md border border-[#2D3B4E] bg-[#243041] px-2.5 py-1 text-xs font-medium text-[#E9EDF2] transition-colors hover:border-[#35C2D1]/50 hover:text-[#35C2D1]"
        >
          Pinout / Ayuda
        </button>

        <button
          type="button"
          onClick={toggleSidebar}
          aria-expanded={isSidebarOpen}
          className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
            isSidebarOpen
              ? 'border-[#35C2D1]/45 bg-[#243041] text-[#35C2D1]'
              : 'border-[#2D3B4E] bg-[#141A23] text-[#AEB8C5] hover:text-[#E9EDF2]'
          }`}
        >
          Inspector
        </button>
      </div>
    </header>
  );
}
