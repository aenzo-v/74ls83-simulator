import { useMemo, useState } from 'react';
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
  if (currentStageIndex === 7 && mathAdder !== null && currentStage.stage8TestCases) {
    for (const tc of currentStage.stage8TestCases) {
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

  const renderStatusBadge = (status: GuidedStageStatus, isCurrent: boolean) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6DD19C]/20 font-mono text-[10px] font-bold text-[#6DD19C]">
            ✓
          </span>
        );
      case 'invalidated':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F06A6A]/20 font-mono text-[10px] font-bold text-[#F06A6A]">
            !
          </span>
        );
      case 'current':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F1B85A]/25 font-mono text-[10px] font-bold text-[#F1B85A] ring-1 ring-[#F1B85A]">
            {isCurrent ? '▶' : '•'}
          </span>
        );
      case 'in_progress':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#35C2D1]/20 font-mono text-[10px] text-[#35C2D1]">
            •
          </span>
        );
      case 'locked':
        return (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#243041] font-mono text-[10px] text-[#AEB8C5]/50">
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
    <div className="flex h-full flex-col overflow-hidden bg-[#1C2430] text-[#E9EDF2]">
      {/* Barra de progreso global (Etapas 1..9) */}
      <div className="border-b border-[#2D3B4E] bg-[#141A23] px-3.5 py-2.5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#35C2D1]">
            Progreso de Montaje ({progressSummary.completedCount}/9)
          </span>
          <span className="font-mono font-semibold text-[#6DD19C]">
            {progressSummary.overallProgressPercent}%
          </span>
        </div>

        {/* Pasos horizontales navegables */}
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
                className={`flex h-7 flex-1 cursor-pointer items-center justify-center rounded text-[11px] font-mono transition-all ${
                  isSelected
                    ? 'border border-[#35C2D1] bg-[#243041] font-bold text-[#35C2D1] shadow-xs'
                    : isClickable
                      ? 'border border-[#2D3B4E] bg-[#1C2430] text-[#AEB8C5] hover:border-[#35C2D1]/50 hover:text-[#E9EDF2]'
                      : 'cursor-not-allowed border border-transparent bg-[#141A23]/40 text-[#AEB8C5]/30'
                }`}
              >
                {status === 'completed' ? (
                  <span className="text-[#6DD19C]">✓</span>
                ) : status === 'invalidated' ? (
                  <span className="font-bold text-[#F06A6A]">!</span>
                ) : (
                  <span>{stg.stepNumber}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Alerta si alguna etapa previa quedó invalidada */}
        {progressSummary.invalidationWarningEs && (
          <div className="mt-2 rounded border border-[#F06A6A]/50 bg-[#2A171D] p-2 text-[11px] leading-tight text-[#F06A6A]">
            <strong>Aviso de integridad:</strong> {progressSummary.invalidationWarningEs}
          </div>
        )}
      </div>

      {/* Contenido principal de la etapa activa (Scrollable) */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4 text-xs">
        {/* Cabecera de la etapa */}
        <section className="space-y-1.5 rounded-lg border border-[#2D3B4E] bg-[#243041]/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#35C2D1]">
              ETAPA {currentStage.stepNumber} DE 9
            </span>
            {renderStatusBadge(
              progressSummary.stageStatuses[currentStage.id] ?? 'current',
              true,
            )}
          </div>
          <h3 className="text-sm font-bold text-[#E9EDF2]">{currentStage.title}</h3>
          <p className="text-[11px] text-[#AEB8C5]">{currentStage.subtitle}</p>
        </section>

        {/* Objetivo educativo */}
        <section className="rounded-lg border border-[#35C2D1]/30 bg-[#141A23]/80 p-3">
          <span className="block font-mono text-[10px] uppercase text-[#35C2D1]">
            Objetivo de Aprendizaje
          </span>
          <p className="mt-1 leading-relaxed text-[#E9EDF2]">{currentStage.objective}</p>
        </section>

        {/* Explicación y detalle colapsable */}
        <section className="space-y-2 rounded-lg border border-[#2D3B4E] bg-[#243041]/50 p-3">
          <div className="whitespace-pre-line leading-relaxed text-[#AEB8C5]">
            {currentStage.explanationEs}
          </div>

          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="cursor-pointer font-mono text-[10px] font-medium text-[#35C2D1] hover:underline"
          >
            {detailsOpen ? '▲ Ocultar notas técnicas' : '▼ Ver detalles de ingeniería y patillaje'}
          </button>

          {detailsOpen && (
            <div className="mt-2 rounded border border-[#2D3B4E] bg-[#141A23] p-2.5 font-mono text-[10px] leading-relaxed text-[#AEB8C5]">
              {currentStage.technicalDetailEs}
            </div>
          )}
        </section>

        {/* Actividad específica de la Etapa 1: Clasificación de continuidad */}
        {currentStageIndex === 0 && currentStage.stage1QuizPairs && (
          <section className="space-y-2.5 rounded-lg border border-[#F1B85A]/45 bg-[#243041]/90 p-3">
            <div>
              <span className="font-mono text-[10px] uppercase text-[#F1B85A]">
                Actividad Interactiva Obligatoria
              </span>
              <h4 className="text-xs font-semibold text-[#E9EDF2]">
                Clasifica la continuidad de cada par de alvéolos
              </h4>
            </div>

            <div className="space-y-2">
              {currentStage.stage1QuizPairs.map((pair) => {
                const answer = stage1Answers[pair.id];
                return (
                  <div
                    key={pair.id}
                    className="flex items-center justify-between gap-2 rounded border border-[#2D3B4E] bg-[#141A23] p-2"
                  >
                    <div>
                      <span className="font-mono font-semibold text-[#E9EDF2]">
                        {pair.labelA} y {pair.labelB}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => answerStage1Quiz(pair.id, true)}
                        className={`cursor-pointer rounded px-2 py-1 font-mono text-[10px] transition-colors ${
                          answer === true
                            ? 'bg-[#6DD19C] font-bold text-[#10141B]'
                            : 'border border-[#2D3B4E] bg-[#243041] text-[#AEB8C5] hover:text-[#E9EDF2]'
                        }`}
                      >
                        Conectados
                      </button>
                      <button
                        type="button"
                        onClick={() => answerStage1Quiz(pair.id, false)}
                        className={`cursor-pointer rounded px-2 py-1 font-mono text-[10px] transition-colors ${
                          answer === false
                            ? 'bg-[#F06A6A] font-bold text-[#10141B]'
                            : 'border border-[#2D3B4E] bg-[#243041] text-[#AEB8C5] hover:text-[#E9EDF2]'
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
          <section className="space-y-2.5 rounded-lg border border-[#35C2D1]/45 bg-[#243041]/90 p-3">
            <div>
              <span className="font-mono text-[10px] uppercase text-[#35C2D1]">
                Matriz de Pruebas Aritméticas Reales
              </span>
              <h4 className="text-xs font-semibold text-[#E9EDF2]">
                Ejecuta y verifica cada caso en tus interruptores y LEDs
              </h4>
            </div>

            <div className="space-y-2">
              {currentStage.stage8TestCases.map((tc) => {
                const isVerified = stage8Cases.includes(tc.id);
                return (
                  <div
                    key={tc.id}
                    className="flex flex-col gap-1.5 rounded border border-[#2D3B4E] bg-[#141A23] p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#E9EDF2]">{tc.label}</span>
                      <span
                        className={`font-mono text-[10px] ${
                          isVerified ? 'text-[#6DD19C]' : 'text-[#AEB8C5]'
                        }`}
                      >
                        {isVerified ? '✓ Verificado' : 'Pendiente'}
                      </span>
                    </div>

                    <p className="text-[10px] text-[#AEB8C5]">{tc.hintEs}</p>

                    <button
                      type="button"
                      onClick={() => {
                        setPowerSupplyOn(true);
                        applyAdditionPreset(tc.operandA, tc.operandB, tc.carryIn);
                      }}
                      className="cursor-pointer self-start rounded border border-[#35C2D1]/40 bg-[#35C2D1]/10 px-2 py-0.5 font-mono text-[10px] text-[#35C2D1] hover:bg-[#35C2D1]/20"
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
          <section className="space-y-3 rounded-lg border border-[#6DD19C]/45 bg-[#243041]/90 p-3">
            <div>
              <span className="font-mono text-[10px] uppercase text-[#6DD19C]">
                Evaluación Conceptual Final
              </span>
              <h4 className="text-xs font-semibold text-[#E9EDF2]">
                Responde las 5 preguntas sobre el 74LS83A
              </h4>
            </div>

            <div className="space-y-3">
              {currentStage.stage9QuizQuestions.map((q, qIdx) => {
                const chosen = stage9Answers[q.id];
                return (
                  <div
                    key={q.id}
                    className="space-y-1.5 rounded border border-[#2D3B4E] bg-[#141A23] p-2.5"
                  >
                    <span className="font-medium text-[#E9EDF2]">
                      {qIdx + 1}. {q.questionEs}
                    </span>
                    <div className="space-y-1">
                      {q.optionsEs.map((opt, optIdx) => (
                        <label
                          key={opt}
                          className={`flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-[11px] transition-colors ${
                            chosen === optIdx
                              ? 'bg-[#35C2D1]/20 text-[#35C2D1]'
                              : 'text-[#AEB8C5] hover:bg-[#243041] hover:text-[#E9EDF2]'
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={chosen === optIdx}
                            onChange={() => answerStage9Quiz(q.id, optIdx)}
                            className="mt-0.5 accent-[#35C2D1]"
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
              <div className="rounded border border-[#6DD19C]/60 bg-[#152822] p-2.5 text-[11px] leading-relaxed text-[#6DD19C]">
                <strong>¡Tutorial completado con éxito!</strong>
                <p className="mt-1 text-[#E9EDF2]">
                  Has construido el sumador binario 74LS83A desde cero y superado todas las
                  verificaciones eléctricas y conceptuales. Tu circuito permanece listo para
                  experimentar libremente.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Lista de comprobación en tiempo real */}
        <section className="space-y-2 rounded-lg border border-[#2D3B4E] bg-[#243041] p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-[#35C2D1]">
              Comprobaciones Eléctricas en Vivo
            </span>
            <span
              className={`font-mono text-[10px] font-semibold ${
                stageValidation.passed ? 'text-[#6DD19C]' : 'text-[#F1B85A]'
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
                    item.passed ? 'text-[#6DD19C]' : 'text-[#AEB8C5]/50'
                  }`}
                >
                  {item.passed ? '✓' : '○'}
                </span>
                <div>
                  <span className={item.passed ? 'text-[#E9EDF2]' : 'text-[#AEB8C5]'}>
                    {item.label}
                  </span>
                  {item.feedbackEs && (
                    <span className="block text-[10px] text-[#AEB8C5]/75">
                      {item.feedbackEs}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div
            className={`mt-2 rounded border px-2.5 py-1.5 text-[11px] leading-tight ${
              stageValidation.severity === 'SUCCESS'
                ? 'border-[#6DD19C]/45 bg-[#152822] text-[#6DD19C]'
                : stageValidation.severity === 'ERROR'
                  ? 'border-[#F06A6A]/50 bg-[#2A171D] text-[#F06A6A]'
                  : 'border-[#35C2D1]/40 bg-[#141A23] text-[#AEB8C5]'
            }`}
          >
            {stageValidation.statusMessageEs}
          </div>
        </section>

        {/* Sistema de pistas progresivas (Nivel 1, 2, 3) */}
        <section className="space-y-2 rounded-lg border border-[#2D3B4E] bg-[#141A23] p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-[#F1B85A]">
              Pistas Progresivas
            </span>
            <button
              type="button"
              onClick={cycleGuidedHintLevel}
              className="cursor-pointer rounded border border-[#F1B85A]/50 bg-[#F1B85A]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#F1B85A] hover:bg-[#F1B85A]/25"
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
            <div className="rounded border border-[#F1B85A]/35 bg-[#243041] p-2 text-[11px] leading-relaxed text-[#E9EDF2]">
              <strong className="block font-semibold text-[#F1B85A]">
                Nivel 1 — Orientación:
              </strong>
              {currentStage.hints.level1Orientation}
            </div>
          )}

          {currentHintLevel >= 2 && (
            <div className="rounded border border-[#35C2D1]/40 bg-[#243041] p-2 text-[11px] leading-relaxed text-[#E9EDF2]">
              <strong className="block font-semibold text-[#35C2D1]">
                Nivel 2 — Identificación de componentes y pines:
              </strong>
              {currentStage.hints.level2Identification}
            </div>
          )}

          {currentHintLevel >= 3 && (
            <div className="rounded border border-[#6DD19C]/45 bg-[#152822] p-2 text-[11px] leading-relaxed text-[#E9EDF2]">
              <strong className="block font-semibold text-[#6DD19C]">
                Nivel 3 — Ayuda visual en la escena 3D:
              </strong>
              {currentStage.hints.level3Visual}
              <p className="mt-1 font-mono text-[10px] text-[#AEB8C5]">
                Los contactos relevantes han sido enfocados y marcados con anillos en la protoboard.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Barra de navegación inferior fija: Anterior, Comprobar, Siguiente */}
      <footer className="border-t border-[#2D3B4E] bg-[#141A23] p-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={currentStageIndex === 0}
            onClick={prevGuidedStage}
            className="flex-1 cursor-pointer rounded border border-[#2D3B4E] bg-[#243041] px-3 py-1.5 font-mono text-xs font-medium text-[#AEB8C5] transition-colors hover:border-[#35C2D1]/50 hover:text-[#E9EDF2] disabled:cursor-not-allowed disabled:opacity-40"
          >
            ◀ Anterior
          </button>

          <button
            type="button"
            onClick={checkCurrentGuidedStage}
            className="flex-1 cursor-pointer rounded border border-[#35C2D1]/60 bg-[#35C2D1]/20 px-3 py-1.5 font-mono text-xs font-bold text-[#35C2D1] transition-colors hover:bg-[#35C2D1]/30"
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
            className={`flex-1 rounded px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
              canGoNext
                ? 'cursor-pointer border border-[#6DD19C]/60 bg-[#6DD19C]/20 text-[#6DD19C] hover:bg-[#6DD19C]/30'
                : 'cursor-not-allowed border border-[#2D3B4E] bg-[#1C2430] text-[#AEB8C5]/40'
            }`}
          >
            Siguiente ▶
          </button>
        </div>

        {/* Reiniciar tutorial completo */}
        <div className="mt-2 flex items-center justify-between text-[10px]">
          {!resetConfirmOpen ? (
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              className="cursor-pointer font-mono text-[#AEB8C5] hover:text-[#F06A6A]"
            >
              Reiniciar tutorial de montaje
            </button>
          ) : (
            <div className="flex items-center gap-1 font-mono">
              <span className="text-[#F06A6A]">¿Reiniciar desde Etapa 1?</span>
              <button
                type="button"
                onClick={() => {
                  resetGuidedTutorial();
                  setResetConfirmOpen(false);
                }}
                className="cursor-pointer font-bold text-[#F06A6A] underline"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="cursor-pointer text-[#AEB8C5]"
              >
                Cancelar
              </button>
            </div>
          )}

          <span className="font-mono text-[#AEB8C5]">74LS83 Lab v1</span>
        </div>
      </footer>
    </div>
  );
}
