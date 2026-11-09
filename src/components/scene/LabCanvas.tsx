import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import * as THREE from 'three';
import { useLabStore } from '../../store/useLabStore';
import { Breadboard3D } from './Breadboard3D';
import { CameraRig } from './CameraRig';
import { DipChip74LS83 } from './DipChip74LS83';
import { DipSwitchesGroup } from './DipSwitch3D';
import { EnergyFlow3D } from './EnergyFlow3D';
import { GuidedStageHighlights3D } from './GuidedStageHighlights3D';
import { InteractiveWorkbench3D } from './InteractiveWorkbench3D';
import { JumperWiresGroup } from './JumperWire3D';
import { LabEnvironment } from './LabEnvironment';
import { LedsGroup } from './Led3D';
import { PowerSupply3D } from './PowerSupply3D';
import { ResistorsGroup } from './Resistor3D';

export function LabCanvas() {
  const mode = useLabStore((s) => s.mode);
  const activeTool = useLabStore((s) => s.activeTool);
  const wireDraft = useLabStore((s) => s.wireDraft);
  const resistorAnchorHoleId = useLabStore((s) => s.resistorAnchorHoleId);
  const clearSelection = useLabStore((s) => s.clearSelection);

  return (
    <div className="relative h-full w-full select-none bg-black">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          fov: 37,
          near: 0.1,
          far: 120,
          position: [1.8, 10.6, 13.4],
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.04,
        }}
        onPointerMissed={(event) => {
          // Evitar deseleccionar si el usuario solo arrastró para orbitar la cámara
          if (event.type === 'click' && (mode === 'mounted' || activeTool === 'select')) {
            if (!wireDraft && !resistorAnchorHoleId) {
              clearSelection();
            }
          }
        }}
      >
        <Suspense fallback={null}>
          <LabEnvironment />
          <CameraRig />
          <Breadboard3D />
          <PowerSupply3D />
          <DipChip74LS83 />
          <DipSwitchesGroup />
          <ResistorsGroup />
          <LedsGroup />
          <JumperWiresGroup />
          <EnergyFlow3D />
          <InteractiveWorkbench3D />
          <GuidedStageHighlights3D />
        </Suspense>
      </Canvas>
    </div>
  );
}
