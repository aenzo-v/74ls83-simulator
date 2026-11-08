import { useEffect } from 'react';
import { LabCanvas } from './components/scene/LabCanvas';
import { EditorToolbar } from './components/ui/EditorToolbar';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { InspectionPanel } from './components/ui/InspectionPanel';
import { OperationBar } from './components/ui/OperationBar';
import { PinoutModal } from './components/ui/PinoutModal';
import { TopBar } from './components/ui/TopBar';
import { ViewportHud } from './components/ui/ViewportHud';
import { useLabStore } from './store/useLabStore';

function isEditableFormElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export function App() {
  const isSidebarOpen = useLabStore((s) => s.isSidebarOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableFormElement(event.target)) {
        return;
      }

      const state = useLabStore.getState();
      if (state.isHelpModalOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          state.setHelpModalOpen(false);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        state.cancelActiveOperation();
        return;
      }

      if (state.mode !== 'guided') {
        return;
      }

      const isMod = event.ctrlKey || event.metaKey;
      if (isMod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
        return;
      }

      if (isMod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        state.redo();
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        state.deleteSelectedElement();
        return;
      }

      if (
        !isMod &&
        !event.altKey &&
        event.key.toLowerCase() === 'r' &&
        state.activeTool === 'place'
      ) {
        event.preventDefault();
        state.cyclePlacementOrientation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#10141B] text-[#E9EDF2]">
      <TopBar />
      <EditorToolbar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1">
            <ErrorBoundary fallbackTitle="Error en el entorno 3D WebGL">
              <LabCanvas />
            </ErrorBoundary>
            <ViewportHud />
          </div>
          <OperationBar />
        </main>

        {isSidebarOpen && <InspectionPanel />}
      </div>

      <PinoutModal />
    </div>
  );
}

export default App;
