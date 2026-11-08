import { useRef, useState } from 'react';
import { ACADEMIC_INFO } from '../../data/academicInfo';
import { useCircuitSolution } from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';

export function TopBar() {
  const mode = useLabStore((s) => s.mode);
  const setMode = useLabStore((s) => s.setMode);
  const isGuidedUnlocked = useLabStore((s) => s.isGuidedUnlocked);
  const toggleGuidedUnlocked = useLabStore((s) => s.toggleGuidedUnlocked);
  const resetCamera = useLabStore((s) => s.resetCamera);
  const setHelpModalOpen = useLabStore((s) => s.setHelpModalOpen);
  const isSidebarOpen = useLabStore((s) => s.isSidebarOpen);
  const toggleSidebar = useLabStore((s) => s.toggleSidebar);
  const togglePowerSupply = useLabStore((s) => s.togglePowerSupply);
  const solution = useCircuitSolution();

  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const [unlockFeedback, setUnlockFeedback] = useState<string | null>(null);

  const handleCircuitoMontadoClick = () => {
    setMode('mounted');

    const now = Date.now();
    if (now - lastClickTimeRef.current > 2500) {
      clickCountRef.current = 1;
    } else {
      clickCountRef.current += 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 5) {
      clickCountRef.current = 0;
      const willBeUnlocked = !isGuidedUnlocked;
      toggleGuidedUnlocked();
      setUnlockFeedback(
        willBeUnlocked
          ? '✨ Modo Montaje Guiado desbloqueado'
          : 'Modo Montaje Guiado ocultado',
      );
      window.setTimeout(() => {
        setUnlockFeedback(null);
      }, 3000);
    }
  };

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
    <header className="flex shrink-0 flex-col border-b border-[#2D3B4E] bg-[#1C2430] text-[#E9EDF2]">
      {/* ============================================================ */}
      {/* FILA 1: Identidad Institucional, Proyecto, Curso y Docente   */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-[#232E3D] px-3 py-1.5 sm:px-4">
        {/* Identidad Institucional y Proyecto */}
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Escudo oficial UNASAM */}
          <div className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md border border-[#2D3B4E] bg-[#141A23] p-0.5 shadow-xs">
            <img
              src={ACADEMIC_INFO.university.logoUrl}
              alt={ACADEMIC_INFO.university.logoAlt}
              className="h-full w-full object-contain"
              width={483}
              height={600}
            />
          </div>

          {/* Insignia 83A */}
          <div
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded border border-[#35C2D1]/40 bg-[#243041] font-mono text-[11px] font-bold text-[#35C2D1] sm:flex"
            title="Circuito integrado 74LS83A (DIP-16)"
          >
            83A
          </div>

          {/* Textos del proyecto y facultad */}
          <div className="min-w-0 leading-tight">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm font-bold tracking-tight text-[#E9EDF2]">
                {ACADEMIC_INFO.shortTitle}
              </h1>
              <span className="rounded border border-[#2D3B4E] bg-[#243041] px-1.5 py-0.2 font-mono text-[10px] text-[#AEB8C5]">
                {ACADEMIC_INFO.chipModel}
              </span>
              <span className="rounded border border-[#35C2D1]/40 bg-[#141A23] px-1.5 py-0.2 font-mono text-[10px] font-bold text-[#35C2D1]">
                {ACADEMIC_INFO.university.shortName}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#AEB8C5]">
              <span className="font-medium text-[#E9EDF2]/90">
                {ACADEMIC_INFO.projectSubtitle}
              </span>
              <span className="mx-1.5 text-[#2D3B4E]">·</span>
              <span className="text-[#AEB8C5]">
                {ACADEMIC_INFO.faculty} · {ACADEMIC_INFO.career}
              </span>
            </p>
          </div>
        </div>

        {/* Cátedra: Asignatura y Docente titular */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Curso */}
          <div className="flex items-center gap-1.5 rounded-md border border-[#2D3B4E] bg-[#141A23] px-2.5 py-1">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#35C2D1]">
              Curso:
            </span>
            <span className="font-semibold text-[#E9EDF2]">
              {ACADEMIC_INFO.course}
            </span>
          </div>

          {/* Docente */}
          <div className="flex items-center gap-1.5 rounded-md border border-[#2D3B4E] bg-[#141A23] px-2.5 py-1">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#F1B85A]">
              Docente:
            </span>
            <span className="font-mono text-xs font-semibold tracking-wide text-[#E9EDF2]">
              {ACADEMIC_INFO.instructor}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* FILA 2: Integrantes del Equipo + Controles del Simulador     */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-[#141A23]/70 px-3 py-1.5 sm:px-4">
        {/* Integrantes del equipo (todos visibles directamente) */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] font-semibold text-[#6DD19C]">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="uppercase tracking-wider">Integrantes:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {ACADEMIC_INFO.teamMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-1.5 rounded-md border border-[#2D3B4E] bg-[#1C2430] px-2 py-0.5 text-xs transition-colors hover:border-[#35C2D1]/40"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#243041] font-mono text-[9px] font-bold text-[#35C2D1]">
                  {member.id}
                </span>
                <span className="font-medium text-[#E9EDF2] whitespace-nowrap text-[11px] sm:text-xs">
                  {member.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Controles del Simulador (Modo y Utilidades) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de modo */}
          <div className="relative">
            <nav
              aria-label="Modo del simulador"
              className="flex items-center rounded-lg border border-[#2D3B4E] bg-[#10141B] p-0.5"
            >
              <button
                type="button"
                onClick={handleCircuitoMontadoClick}
                aria-current={mode === 'mounted' ? 'page' : undefined}
                title={
                  isGuidedUnlocked
                    ? 'Modo Circuito montado'
                    : 'Circuito montado'
                }
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#35C2D1] sm:px-3 ${
                  mode === 'mounted'
                    ? 'bg-[#243041] text-[#35C2D1] shadow-xs ring-1 ring-[#35C2D1]/40'
                    : 'text-[#AEB8C5] hover:text-[#E9EDF2]'
                }`}
              >
                Circuito montado
              </button>
              {isGuidedUnlocked && (
                <button
                  type="button"
                  onClick={() => setMode('guided')}
                  aria-current={mode === 'guided' ? 'page' : undefined}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#35C2D1] sm:px-3 ${
                    mode === 'guided'
                      ? 'bg-[#243041] text-[#35C2D1] shadow-xs ring-1 ring-[#35C2D1]/40'
                      : 'text-[#AEB8C5] hover:text-[#E9EDF2]'
                  }`}
                >
                  Montaje guiado
                </button>
              )}
            </nav>

            {unlockFeedback && (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#35C2D1]/50 bg-[#141A23] px-2.5 py-1 text-[11px] font-medium text-[#35C2D1] shadow-lg shadow-black/40"
              >
                {unlockFeedback}
              </div>
            )}
          </div>

          {/* Estado de fuente regulada +5.0 V */}
          <button
            type="button"
            aria-pressed={solution.isPowerSupplyOn}
            onClick={togglePowerSupply}
            title={`${statusTitle} (Haz clic para encender o apagar la fuente +5.0 V)`}
            className={`hidden cursor-pointer items-center gap-2 rounded-md border ${statusBorder} bg-[#243041]/85 px-2.5 py-1 text-[11px] text-[#E9EDF2] transition-colors hover:bg-[#2A384C] xl:flex`}
          >
            <span className={`h-2 w-2 rounded-full ${statusDot}`} />
            <span className={`font-medium ${statusTextClass}`}>{statusPrimary}</span>
            <span className="font-mono text-[#AEB8C5]">{statusSecondary}</span>
          </button>

          {/* Restablecer vista */}
          <button
            type="button"
            onClick={resetCamera}
            className="cursor-pointer rounded-md border border-[#2D3B4E] bg-[#243041] px-2 py-1 text-xs font-medium text-[#E9EDF2] transition-colors hover:border-[#35C2D1]/50 hover:text-[#35C2D1] sm:px-2.5"
          >
            <span className="hidden md:inline">Restablecer vista</span>
            <span className="md:hidden">Vista</span>
          </button>

          {/* Pinout / Ayuda */}
          <button
            type="button"
            onClick={() => setHelpModalOpen(true)}
            className="cursor-pointer rounded-md border border-[#2D3B4E] bg-[#243041] px-2 py-1 text-xs font-medium text-[#E9EDF2] transition-colors hover:border-[#35C2D1]/50 hover:text-[#35C2D1] sm:px-2.5"
          >
            <span className="hidden md:inline">Pinout / Ayuda</span>
            <span className="md:hidden">Pinout</span>
          </button>

          {/* Inspector */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={isSidebarOpen}
            className={`cursor-pointer rounded-md border px-2 py-1 text-xs font-medium transition-colors sm:px-2.5 ${
              isSidebarOpen
                ? 'border-[#35C2D1]/45 bg-[#243041] text-[#35C2D1]'
                : 'border-[#2D3B4E] bg-[#141A23] text-[#AEB8C5] hover:text-[#E9EDF2]'
            }`}
          >
            Inspector
          </button>
        </div>
      </div>
    </header>
  );
}
