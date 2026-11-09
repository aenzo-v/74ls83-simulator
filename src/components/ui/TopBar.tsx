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
  const isEnergyFlowVisible = useLabStore((s) => s.isEnergyFlowVisible);
  const toggleEnergyFlow = useLabStore((s) => s.toggleEnergyFlow);
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

  let statusBorder = 'border-zinc-700 bg-zinc-900/80';
  let statusDot = 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]';
  let statusTextClass = 'text-white';
  let statusPrimary = 'Motor activo';
  let statusSecondary = '· +5.0 V OK';
  let statusTitle = 'Netlist verificada sin errores eléctricos ni entradas flotantes.';

  if (firstError) {
    statusBorder = 'border-zinc-500 bg-zinc-900/90';
    statusDot = 'bg-white';
    statusTextClass = 'text-white';
    statusPrimary = 'Fallo eléctrico';
    statusSecondary = `· ${firstError.code}`;
    statusTitle = `${firstError.title}: ${firstError.message}`;
  } else if (!solution.isPowerSupplyOn) {
    statusBorder = 'border-zinc-800 bg-zinc-900/60';
    statusDot = 'border-2 border-zinc-400 bg-transparent';
    statusTextClass = 'text-zinc-400';
    statusPrimary = 'Sin alimentar';
    statusSecondary = '· Fuente en STBY';
    statusTitle = firstWarning?.message ?? 'Fuente regulada de +5.0 V en modo espera (STBY).';
  } else if (firstWarning) {
    statusBorder = 'border-zinc-700 bg-zinc-900/80';
    statusDot = 'bg-zinc-300';
    statusTextClass = 'text-zinc-200';
    statusPrimary = 'Aviso de red';
    statusSecondary = `· ${solution.diagnostics.length}`;
    statusTitle = `${firstWarning.title}: ${firstWarning.message}`;
  }

  return (
    <header className="flex shrink-0 items-stretch overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/90 text-zinc-100 shadow-sm backdrop-blur-md">
      {/* ============================================================ */}
      {/* ESCUDO OFICIAL UNASAM: Aprovecha casi todo el alto del header */}
      {/* ============================================================ */}
      <div className="flex shrink-0 self-stretch items-center justify-center border-r border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5 sm:px-3 sm:py-2">
        <div
          className="flex h-full max-h-[86px] min-h-[54px] sm:max-h-[92px] w-auto aspect-[483/600] items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-900/90 p-1 shadow-xs transition-transform duration-200 hover:scale-105"
          title={`${ACADEMIC_INFO.university.name} (${ACADEMIC_INFO.university.shortName})`}
        >
          <img
            src={ACADEMIC_INFO.university.logoUrl}
            alt={ACADEMIC_INFO.university.logoAlt}
            className="h-full w-full object-contain drop-shadow"
            width={483}
            height={600}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* CONTENIDO PRINCIPAL: Fila 1 (Proyecto/Cátedra) y Fila 2 (Equipo/Controles) */}
      {/* ============================================================ */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        {/* ============================================================ */}
        {/* FILA 1: Identidad Institucional, Proyecto, Curso y Docente   */}
        {/* ============================================================ */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-zinc-800/80 px-3 py-1.5 sm:px-4 sm:py-2">
          {/* Identidad del Proyecto */}
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Insignia 83A */}
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 font-mono text-[11px] font-bold text-white shadow-xs"
              title="Circuito integrado 74LS83A (DIP-16)"
            >
              83A
            </div>

            {/* Textos del proyecto y facultad */}
            <div className="min-w-0 leading-tight">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white">
                  {ACADEMIC_INFO.shortTitle}
                </h1>
                <span className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                  {ACADEMIC_INFO.chipModel}
                </span>
                <span className="rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {ACADEMIC_INFO.university.shortName}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                <span className="font-medium text-zinc-200">
                  {ACADEMIC_INFO.projectSubtitle}
                </span>
                <span className="mx-1.5 text-zinc-600">·</span>
                <span className="text-zinc-400">
                  {ACADEMIC_INFO.faculty} · {ACADEMIC_INFO.career}
                </span>
              </p>
            </div>
          </div>

          {/* Cátedra: Asignatura y Docente titular (Bento Cards) */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Curso */}
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Curso:
              </span>
              <span className="font-semibold text-white">
                {ACADEMIC_INFO.course}
              </span>
            </div>

            {/* Docente */}
            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Docente:
              </span>
              <span className="font-mono text-xs font-semibold tracking-wide text-white">
                {ACADEMIC_INFO.instructor}
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* FILA 2: Integrantes del Equipo + Controles del Simulador     */}
        {/* ============================================================ */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-zinc-950/40 px-3 py-1.5 sm:px-4 sm:py-2">
        {/* Integrantes del equipo (todos visibles directamente) */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] font-semibold text-zinc-300">
            <svg
              className="h-3.5 w-3.5 text-zinc-400"
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
                className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-xs transition-colors hover:border-zinc-600 hover:text-white"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 font-mono text-[9px] font-bold text-white">
                  {member.id}
                </span>
                <span className="font-medium text-zinc-200 whitespace-nowrap text-[11px] sm:text-xs">
                  {member.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Controles del Simulador (Modo y Utilidades) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de modo Bento pill */}
          <div className="relative">
            <nav
              aria-label="Modo del simulador"
              className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900/80 p-0.5"
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
                className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-medium transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white sm:px-3.5 ${
                  mode === 'mounted'
                    ? 'bg-white text-black font-semibold shadow-xs ring-1 ring-white/50'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Circuito montado
              </button>
              {isGuidedUnlocked && (
                <button
                  type="button"
                  onClick={() => setMode('guided')}
                  aria-current={mode === 'guided' ? 'page' : undefined}
                  className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-medium transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white sm:px-3.5 ${
                    mode === 'guided'
                      ? 'bg-white text-black font-semibold shadow-xs ring-1 ring-white/50'
                      : 'text-zinc-400 hover:text-white'
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
                className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1 text-[11px] font-medium text-white shadow-xl shadow-black/60"
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
            className={`hidden cursor-pointer items-center gap-2 rounded-xl border ${statusBorder} px-3 py-1 text-[11px] text-zinc-100 transition-colors hover:border-zinc-500 xl:flex`}
          >
            <span className={`h-2 w-2 rounded-full ${statusDot}`} />
            <span className={`font-medium ${statusTextClass}`}>{statusPrimary}</span>
            <span className="font-mono text-zinc-400">{statusSecondary}</span>
          </button>

          {/* Restablecer vista */}
          <button
            type="button"
            onClick={resetCamera}
            className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white sm:px-3"
          >
            <span className="hidden md:inline">Restablecer vista</span>
            <span className="md:hidden">Vista</span>
          </button>

          {/* Pinout / Ayuda */}
          <button
            type="button"
            onClick={() => setHelpModalOpen(true)}
            className="cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-white sm:px-3"
          >
            <span className="hidden md:inline">Pinout / Ayuda</span>
            <span className="md:hidden">Pinout</span>
          </button>

          {/* Flujo de energía visual */}
          <button
            type="button"
            onClick={toggleEnergyFlow}
            aria-pressed={isEnergyFlowVisible}
            title={
              isEnergyFlowVisible
                ? 'Ocultar visuales de flujo de energía eléctrica (corriente convencional +5 V → GND)'
                : 'Mostrar visuales dinámicos de flujo de energía eléctrica en 3D'
            }
            className={`cursor-pointer flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 ${
              isEnergyFlowVisible
                ? 'border-[#35C2D1]/60 bg-[#142A35]/90 text-[#35C2D1] font-semibold shadow-xs ring-1 ring-[#35C2D1]/40'
                : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            <span className={isEnergyFlowVisible ? 'text-[#FFD043] animate-pulse' : 'text-zinc-500'}>⚡</span>
            <span className="hidden md:inline">Flujo de energía</span>
            <span className="md:hidden">Flujo</span>
          </button>

          {/* Inspector */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={isSidebarOpen}
            className={`cursor-pointer rounded-xl border px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 ${
              isSidebarOpen
                ? 'border-white/60 bg-white text-black font-semibold shadow-xs'
                : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            Inspector
          </button>
        </div>
      </div>
    </div>
  </header>
  );
}
