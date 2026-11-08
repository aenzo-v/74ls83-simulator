import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallbackTitle?: string;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Se produjo un error inesperado en el motor de renderizado.',
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[74LS83 Lab] Error interceptado por ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex h-full w-full flex-col items-center justify-center bg-[#10141B] p-6 text-center text-[#E9EDF2]"
        >
          <div className="max-w-md rounded-xl border border-[#F06A6A]/60 bg-[#1A141A] p-6 shadow-2xl">
            <div className="mb-3 flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F06A6A]/20 text-2xl font-bold text-[#F06A6A]">
                !
              </span>
            </div>
            <h2 className="mb-2 font-mono text-base font-bold text-[#E9EDF2]">
              {this.props.fallbackTitle ?? 'Error en el entorno gráfico 3D'}
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-[#AEB8C5]">
              No se pudo inicializar o mantener el contexto gráfico WebGL. Esto puede deberse a
              aceleración por hardware desactivada, suspensión del equipo o memoria GPU agotada.
            </p>
            {this.state.errorMessage && (
              <pre className="mb-5 max-h-24 overflow-x-auto rounded border border-[#2D3B4E] bg-[#10141B] p-2 text-left font-mono text-[11px] text-[#F1B85A]">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#35C2D1]/60 bg-[#35C2D1]/15 px-4 py-2 font-mono text-xs font-semibold text-[#35C2D1] transition-colors hover:bg-[#35C2D1]/25"
            >
              Reiniciar simulador
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
