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
          className="flex h-full w-full flex-col items-center justify-center bg-black p-6 text-center text-zinc-100"
        >
          <div className="max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
            <div className="mb-3 flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-2xl font-bold text-white shadow-sm">
                !
              </span>
            </div>
            <h2 className="mb-2 font-mono text-base font-bold text-white">
              {this.props.fallbackTitle ?? 'Error en el entorno gráfico 3D'}
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-zinc-400">
              No se pudo inicializar o mantener el contexto gráfico WebGL. Esto puede deberse a
              aceleración por hardware desactivada, suspensión del equipo o memoria GPU agotada.
            </p>
            {this.state.errorMessage && (
              <pre className="mb-5 max-h-24 overflow-x-auto rounded-xl border border-zinc-800 bg-black p-2.5 text-left font-mono text-[11px] text-zinc-300">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white bg-white px-4 py-2 font-mono text-xs font-bold text-black transition-colors hover:bg-zinc-200 shadow-xs"
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
