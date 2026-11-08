import { useEffect, useMemo, useState } from 'react';
import {
  GUIDED_STAGES,
  getGuidedStageByIndex,
  type GuidedStageStatus,
} from '../../simulator/guidedStages';
import {
  calculateGuidedProgressSummary,
  validateStageByIndex,
  type GuidedValidationContext,
} from '../../simulator/guidedValidation';
import {
  useActiveSwitchStates,
  useCircuitSolution,
  useDisplayedCircuit,
} from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';

export function GuidedAssemblyPanel() {
  const currentStageIndex = useLabStore((s) => s.guidedCurrentStageIndex);
  const completedStages = useLabStore((s) => s.guidedCompletedStages);
  const hintLevels = useLabStore((s) => s.guidedHintLevels);
  const stage1Answers = useLabStore((s) => s.guidedStage1QuizAnswers);
  const stage8Cases = useLabStore((s) => s.guidedStage8TestedCases);
  const stage9Answers = useLabStore((s) => s.guidedStage9QuizAnswers);
  const practiceUnlocked = useLabStore((s) => s.guidedPracticeUnlocked);

  const setGuidedStageIndex = useLabStore((s) => s.setGuidedStageIndex);
  const nextGuidedStage = useLabStore((s) => s.nextGuidedStage);
  const prevGuidedStage = useLabStore((s) => s.prevGuidedStage);
  const cycleGuidedHintLevel = useLabStore((s) => s.cycleGuidedHintLevel);
  const answerStage1Quiz = useLabStore((s) => s.answerStage1Quiz);
  const recordStage8TestedCase = useLabStore((s) => s.recordStage8TestedCase);
  const answerStage9Quiz = useLabStore((s) => s.answerStage9Quiz);
  const checkCurrentGuidedStage = useLabStore((s) => s.checkCurrentGuidedStage);
  const resetGuidedTutorial = useLabStore((s) => s.resetGuidedTutorial);
  const applyAdditionPreset = useLabStore((s) => s.applyAdditionPreset);
  const setPowerSupplyOn = useLabStore((s) => s.setPowerSupplyOn);

  const circuit = useDisplayedCircuit();
  const switchStates = useActiveSwitchStates();
  const solution = useCircuitSolution();

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const currentStage = getGuidedStageByIndex(currentStageIndex);
  const currentHintLevel = hintLevels[currentStageIndex] ?? 0;

  // Contexto para validación eléctrica continua
  const validationContext = useMemo<GuidedValidationContext>(
    () => ({
      circuit,
      switchStates,
      solution,
      stage1QuizAnswers: stage1Answers,
      stage8TestedCases: stage8Cases,
      stage9QuizAnswers: stage9Answers,
      completedStagesHistory: completedStages,
    }),
    [circuit, completedStages, solution, stage1Answers, stage8Cases, stage9Answers, switchStates],
  );

  const stageValidation = useMemo(
    () => validateStageByIndex(currentStageIndex, validationContext),
    [currentStageIndex, validationContext],
  );

  const progressSummary = useMemo(
    () => calculateGuidedProgressSummary(currentStageIndex, validationContext),
    [currentStageIndex, validationContext],
  );

  // Auto-registro en etapa 8 si el circuito resuelve correctamente uno de los casos aritméticos
  const mathAdder = solution.adderOutput;
  const stage8TestCases = currentStage.stage8TestCases;
  useEffect(() => {
    if (currentStageIndex === 7 && mathAdder !== null && stage8TestCases) {
      for (const tc of stage8TestCases) {
        if (
          mathAdder.operandA === tc.operandA &&
          mathAdder.operandB === tc.operandB &&
          mathAdder.carryIn === tc.carryIn &&
          mathAdder.totalValue === tc.expectedTotal &&
          !stage8Cases.includes(tc.id)
        ) {
          recordStage8TestedCase(tc.id);
        }
      }
    }
  }, [currentStageIndex, mathAdder, stage8Cases, stage8TestCases, recordStage8TestedCase]);

  const renderStatusBadge = (status: GuidedStageStatus, isCurrent: boolean) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 border border-zinc-600 font-mono text-[10px] font-bold text-white">
            ✓
          </span>
        );
      case 'invalidated':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 border border-zinc-500 font-mono text-[10px] font-bold text-white">
            !
          </span>
        );
      case 'current':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white font-mono text-[10px] font-bold text-black ring-2 ring-white/60 shadow-xs">
            {isCurrent ? '▶' : '•'}
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 font-mono text-[10px] text-zinc-300">
            •
          </span>
        );
      case 'locked':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-950 border border-zinc-850 font-mono text-[10px] text-zinc-600">
            🔒
          </span>
        );
    }
  };

  const isCurrentStageCompleted = stageValidation.passed;
  const canGoNext =
    currentStageIndex < GUIDED_STAGES.length - 1 &&
    (isCurrentStageCompleted || currentStageIndex < progressSummary.completedCount);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Barra de progreso global (Etapas 1..9) */}
      <div className="border-b border-zinc-800/80 bg-zinc-900/60 px-3.5 py-2.5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
            Progreso de Montaje ({progressSummary.completedCount}/9)
          </span>
          <span className="font-mono font-bold text-white">
            {progressSummary.overallProgressPercent}%
          </span>
        </div>

        {/* Pasos horizontales navegables Bento Pills */}
        <div className="flex items-center justify-between gap-1">
          {GUIDED_STAGES.map((stg, idx) => {
            const status = progressSummary.stageStatuses[stg.id] ?? 'locked';
            const isSelected = idx === currentStageIndex;
            const isClickable = status !== 'locked' || idx <= progressSummary.completedCount;

            return (
              <button
                key={stg.id}
                type="button"
                disabled={!isClickable}
                onClick={() => setGuidedStageIndex(idx)}
                title={`${stg.stepNumber}. ${stg.shortTitle} — Estado: ${status}`}
                className={`flex h-7 flex-1 cursor-pointer items-center justify-center rounded-lg text-[11px] font-mono transition-all ${
                  isSelected
                    ? 'border border-white bg-white font-bold text-black shadow-xs ring-1 ring-white/50'
                    : isClickable
                      ? 'border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-white'
                      : 'cursor-not-allowed border border-transparent bg-zinc-950/40 text-zinc-600'
                }`}
              >
                {status === 'completed' ? (
                  <span className="font-bold text-white">✓</span>
                ) : status === 'invalidated' ? (
                  <span className="font-bold text-white">!</span>
                ) : (
                  <span>{stg.stepNumber}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Alerta si alguna etapa previa quedó invalidada */}
        {progressSummary.invalidationWarningEs && (
          <div className="mt-2 rounded-lg border border-zinc-600 bg-zinc-900 p-2 text-[11px] leading-tight text-white">
            <strong>Aviso de integridad:</strong> {progressSummary.invalidationWarningEs}
          </div>
        )}
      </div>

      {/* Contenido principal de la etapa activa (Scrollable Bento Stack) */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4 text-xs">
        {/* Cabecera de la etapa */}
        <section className="space-y-1.5 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              ETAPA {currentStage.stepNumber} DE 9
            </span>
            {renderStatusBadge(
              progressSummary.stageStatuses[currentStage.id] ?? 'current',
              true,
            )}
          </div>
          <h3 className="text-sm font-bold text-white">{currentStage.title}</h3>
          <p className="text-[11px] text-zinc-400">{currentStage.subtitle}</p>
        </section>

        {/* Objetivo educativo */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 shadow-sm">
          <span className="block font-mono text-[10px] uppercase text-zinc-400 font-semibold tracking-wider">
            Objetivo de Aprendizaje
          </span>
          <p className="mt-1 leading-relaxed text-zinc-200">{currentStage.objective}</p>
        </section>

        {/* Explicación y detalle colapsable */}
        <section className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
          <div className="whitespace-pre-line leading-relaxed text-zinc-300">
            {currentStage.explanationEs}
          </div>

          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="cursor-pointer font-mono text-[10px] font-medium text-zinc-300 hover:text-white hover:underline"
          >
            {detailsOpen ? '▲ Ocultar notas técnicas' : '▼ Ver detalles de ingeniería y patillaje'}
          </button>

          {detailsOpen && (
            <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-[10px] leading-relaxed text-zinc-300">
              {currentStage.technicalDetailEs}
            </div>
          )}
        </section>

        {/* Actividad específica de la Etapa 1: Clasificación de continuidad */}
        {currentStageIndex === 0 && currentStage.stage1QuizPairs && (
          <section className="space-y-2.5 rounded-xl border border-zinc-700 bg-zinc-900/60 p-3.5 shadow-sm">
            <div>
              <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold">
                Actividad Interactiva Obligatoria
              </span>
              <h4 className="text-xs font-semibold text-white">
                Clasifica la continuidad de cada par de alvéolos
              </h4>
            </div>

            <div className="space-y-2">
              {currentStage.stage1QuizPairs.map((pair) => {
                const answer = stage1Answers[pair.id];
                return (
                  <div
                    key={pair.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2"
                  >
                    <div>
                      <span className="font-mono font-semibold text-white">
                        {pair.labelA} y {pair.labelB}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => answerStage1Quiz(pair.id, true)}
                        className={`cursor-pointer rounded-lg px-2.5 py-1 font-mono text-[10px] transition-all ${
                          answer === true
                            ? 'border border-white bg-white font-bold text-black shadow-xs'
                            : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        Conectados
                      </button>
                      <button
                        type="button"
                        onClick={() => answerStage1Quiz(pair.id, false)}
                        className={`cursor-pointer rounded-lg px-2.5 py-1 font-mono text-[10px] transition-all ${
                          answer === false
                            ? 'border border-zinc-500 bg-zinc-800 font-bold text-white shadow-xs'
                            : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                      >
                        Aislados
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Actividad específica de la Etapa 8: Matriz de sumas en vivo */}
        {currentStageIndex === 7 && currentStage.stage8TestCases && (
          <section className="space-y-2.5 rounded-xl border border-zinc-700 bg-zinc-900/60 p-3.5 shadow-sm">
            <div>
              <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold">
                Matriz de Pruebas Aritméticas Reales
              </span>
              <h4 className="text-xs font-semibold text-white">
                Ejecuta y verifica cada caso en tus interruptores y LEDs
              </h4>
            </div>

            <div className="space-y-2">
              {currentStage.stage8TestCases.map((tc) => {
                const isVerified = stage8Cases.includes(tc.id);
                return (
                  <div
                    key={tc.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white">{tc.label}</span>
                      <span
                        className={`font-mono text-[10px] font-semibold ${
                          isVerified ? 'text-white' : 'text-zinc-500'
                        }`}
                      >
                        {isVerified ? '✓ Verificado' : 'Pendiente'}
                      </span>
                    </div>

                    <p className="text-[10px] text-zinc-400">{tc.hintEs}</p>

                    <button
                      type="button"
                      onClick={() => {
                        setPowerSupplyOn(true);
                        applyAdditionPreset(tc.operandA, tc.operandB, tc.carryIn);
                      }}
                      className="cursor-pointer self-start rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-[10px] font-medium text-white hover:border-zinc-500 hover:bg-zinc-800"
                    >
                      Configurar interruptores para {tc.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Actividad específica de la Etapa 9: Cuestionario conceptual */}
        {currentStageIndex === 8 && currentStage.stage9QuizQuestions && (
          <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/60 p-3.5 shadow-sm">
            <div>
              <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold">
                Evaluación Conceptual Final
              </span>
              <h4 className="text-xs font-semibold text-white">
                Responde las 5 preguntas sobre el 74LS83A
              </h4>
            </div>

            <div className="space-y-3">
              {currentStage.stage9QuizQuestions.map((q, qIdx) => {
                const chosen = stage9Answers[q.id];
                return (
                  <div
                    key={q.id}
                    className="space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2.5"
                  >
                    <span className="font-medium text-white">
                      {qIdx + 1}. {q.questionEs}
                    </span>
                    <div className="space-y-1">
                      {q.optionsEs.map((opt, optIdx) => (
                        <label
                          key={opt}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 text-[11px] transition-colors ${
                            chosen === optIdx
                              ? 'bg-zinc-800 text-white border border-zinc-650'
                              : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={chosen === optIdx}
                            onChange={() => answerStage9Quiz(q.id, optIdx)}
                            className="mt-0.5 accent-white"
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {practiceUnlocked && (
              <div className="rounded-xl border border-white bg-zinc-900 p-3 text-[11px] leading-relaxed text-white">
                <strong className="block text-xs font-bold text-white">¡Tutorial completado con éxito!</strong>
                <p className="mt-1 text-zinc-300">
                  Has construido el sumador binario 74LS83A desde cero y superado todas las
                  verificaciones eléctricas y conceptuales. Tu circuito permanece listo para
                  experimentar libremente.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Lista de comprobación en tiempo real */}
        <section className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold">
              Comprobaciones Eléctricas en Vivo
            </span>
            <span
              className={`font-mono text-[10px] font-bold ${
                stageValidation.passed ? 'text-white' : 'text-zinc-400'
              }`}
            >
              {stageValidation.passed ? 'Etapa Cumplida' : 'Pendiente'}
            </span>
          </div>

          <ul className="space-y-1.5">
            {stageValidation.checklistResults.map((item, idx) => (
              <li
                key={`${item.label}-${idx}`}
                className="flex items-start gap-2 text-[11px] leading-snug"
              >
                <span
                  className={`mt-0.5 font-mono text-[11px] font-bold ${
                    item.passed ? 'text-white' : 'text-zinc-600'
                  }`}
                >
                  {item.passed ? '✓' : '○'}
                </span>
                <div>
                  <span className={item.passed ? 'text-white font-medium' : 'text-zinc-400'}>
                    {item.label}
                  </span>
                  {item.feedbackEs && (
                    <span className="block text-[10px] text-zinc-500">
                      {item.feedbackEs}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div
            className={`mt-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-tight ${
              stageValidation.severity === 'SUCCESS'
                ? 'border-zinc-500 bg-zinc-900 text-white font-medium'
                : stageValidation.severity === 'ERROR'
                  ? 'border-zinc-600 bg-zinc-900 text-zinc-200'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400'
            }`}
          >
            {stageValidation.statusMessageEs}
          </div>
        </section>

        {/* Sistema de pistas progresivas (Nivel 1, 2, 3) */}
        <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase text-zinc-400 font-semibold">
              Pistas Progresivas
            </span>
            <button
              type="button"
              onClick={cycleGuidedHintLevel}
              className="cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-[10px] font-semibold text-white hover:bg-zinc-800 hover:border-zinc-500"
            >
              {currentHintLevel === 0
                ? 'Solicitar pista (Nivel 1/3)'
                : currentHintLevel === 1
                  ? 'Avanzar a Nivel 2/3 (Identificación)'
                  : currentHintLevel === 2
                    ? 'Avanzar a Nivel 3/3 (Ayuda Visual 3D)'
                    : 'Reiniciar pistas'}
            </button>
          </div>

          {currentHintLevel >= 1 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-2.5 text-[11px] leading-relaxed text-zinc-200">
              <strong className="block font-semibold text-white">
                Nivel 1 — Orientación:
              </strong>
              {currentStage.hints.level1Orientation}
            </div>
          )}

          {currentHintLevel >= 2 && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-2.5 text-[11px] leading-relaxed text-white">
              <strong className="block font-semibold text-white">
                Nivel 2 — Identificación de componentes y pines:
              </strong>
              {currentStage.hints.level2Identification}
            </div>
          )}

          {currentHintLevel >= 3 && (
            <div className="rounded-lg border border-zinc-600 bg-zinc-900 p-2.5 text-[11px] leading-relaxed text-white">
              <strong className="block font-semibold text-white">
                Nivel 3 — Ayuda visual en la escena 3D:
              </strong>
              {currentStage.hints.level3Visual}
              <p className="mt-1 font-mono text-[10px] text-zinc-400">
                Los contactos relevantes han sido enfocados y marcados con anillos en la protoboard.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Barra de navegación inferior fija: Anterior, Comprobar, Siguiente */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={currentStageIndex === 0}
            onClick={prevGuidedStage}
            className="flex-1 cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            ◀ Anterior
          </button>

          <button
            type="button"
            onClick={checkCurrentGuidedStage}
            className="flex-1 cursor-pointer rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-xs font-semibold text-white transition-colors hover:bg-zinc-700 hover:border-zinc-500"
          >
            Comprobar
          </button>

          <button
            type="button"
            disabled={!canGoNext}
            onClick={nextGuidedStage}
            title={
              canGoNext
                ? 'Avanzar a la siguiente etapa'
                : 'Debes completar y comprobar los requisitos de esta etapa para avanzar'
            }
            className={`flex-1 rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition-all ${
              canGoNext
                ? 'cursor-pointer border border-white bg-white text-black shadow-xs hover:bg-zinc-200'
                : 'cursor-not-allowed border border-zinc-900 bg-zinc-950 text-zinc-600'
            }`}
          >
            Siguiente ▶
          </button>
        </div>

        {/* Reiniciar tutorial completo */}
        <div className="mt-2.5 flex items-center justify-between text-[10px]">
          {!resetConfirmOpen ? (
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              className="cursor-pointer font-mono text-zinc-400 hover:text-white"
            >
              Reiniciar tutorial de montaje
            </button>
          ) : (
            <div className="flex items-center gap-1 font-mono">
              <span className="text-white">¿Reiniciar desde Etapa 1?</span>
              <button
                type="button"
                onClick={() => {
                  resetGuidedTutorial();
                  setResetConfirmOpen(false);
                }}
                className="cursor-pointer font-bold text-white underline ml-1"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="cursor-pointer text-zinc-400 hover:text-white ml-1"
              >
                Cancelar
              </button>
            </div>
          )}

          <span className="font-mono text-zinc-500">74LS83 Lab v1</span>
        </div>
      </footer>
    </div>
  );
}
