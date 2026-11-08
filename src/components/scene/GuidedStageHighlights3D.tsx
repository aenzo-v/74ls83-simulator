import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { resolveTerminalPosition } from '../../data/circuitLayout';
import { BREADBOARD_DIMENSIONS, getHoleById } from '../../simulator/breadboard';
import { getGuidedStageByIndex } from '../../simulator/guidedStages';
import { getDip16PinHoleId } from '../../simulator/pinout74ls83';
import { useCircuitSolution, useDisplayedCircuit } from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';

const TARGET_RING_GEOMETRY = new THREE.RingGeometry(0.075, 0.125, 24);
const PIN_RING_GEOMETRY = new THREE.RingGeometry(0.065, 0.098, 20);

export function GuidedStageHighlights3D() {
  const mode = useLabStore((s) => s.mode);
  const currentStageIndex = useLabStore((s) => s.guidedCurrentStageIndex);
  const hintLevels = useLabStore((s) => s.guidedHintLevels);
  const circuit = useDisplayedCircuit();
  const solution = useCircuitSolution();

  const currentHintLevel = hintLevels[currentStageIndex] ?? 0;
  const stageDef = getGuidedStageByIndex(currentStageIndex);
  const highlights = stageDef.hints.visualHighlights;

  // Calculamos los puntos 3D a resaltar según la etapa y el nivel de ayuda
  const highlightMarkers = useMemo(() => {
    if (mode !== 'guided') {
      return [];
    }

    const markers: Array<{
      id: string;
      position: { x: number; y: number; z: number };
      colorHex: string;
      label: string;
      badgeText?: string;
    }> = [];

    const surfaceY = BREADBOARD_DIMENSIONS.heightY;

    // Solo mostrar marcadores 3D si el nivel de pista es >= 2 (identificación) o 3 (ayuda visual total)
    // o para objetivos fundamentales de inserción de chip en etapa 2.
    const showMarkers = currentHintLevel >= 2 || currentStageIndex === 1;
    if (!showMarkers || !highlights) {
      return markers;
    }

    // 1. Agujeros objetivo específicos
    if (highlights.targetHoles) {
      for (const holeId of highlights.targetHoles) {
        const pos = resolveTerminalPosition(holeId);
        if (pos) {
          const isPower = holeId.includes('plus') || holeId.includes('minus') || holeId.includes('psu');
          markers.push({
            id: `hole-${holeId}`,
            position: { x: pos.x, y: surfaceY + 0.007, z: pos.z },
            colorHex: isPower ? '#35C2D1' : '#F1B85A',
            label: holeId,
          });
        }
      }
    }

    // 2. Pines específicos involucrados
    if (highlights.targetPins && circuit.chip) {
      for (const pinNum of highlights.targetPins) {
        const holeId = getDip16PinHoleId(pinNum, circuit.chip.startColumn);
        const hole = getHoleById(holeId);
        if (hole) {
          const pinState = solution.pins[pinNum];
          const isError =
            pinState?.drive === 'FLOATING' ||
            pinState?.drive === 'SHORT_CIRCUIT' ||
            pinState?.drive === 'CONFLICT';
          const isOk =
            pinState?.drive === 'STRONG_HIGH' ||
            pinState?.drive === 'STRONG_LOW' ||
            pinState?.drive === 'WEAK_HIGH' ||
            pinState?.drive === 'WEAK_LOW' ||
            pinState?.drive === 'IC_HIGH' ||
            pinState?.drive === 'IC_LOW';

          const colorHex = isError ? '#F06A6A' : isOk ? '#6DD19C' : '#35C2D1';

          markers.push({
            id: `pin-${pinNum}`,
            position: { x: hole.position.x, y: surfaceY + 0.008, z: hole.position.z },
            colorHex,
            label: `Pin ${pinNum} (${pinState?.signal ?? ''})`,
            badgeText: `Pin ${pinNum}`,
          });
        }
      }
    }

    // 3. Si el chip no está colocado y la etapa es la 2 (o pista activa), marcar columnas recomendadas
    if (!circuit.chip && currentStageIndex === 1 && highlights.candidateColumns) {
      for (const startCol of highlights.candidateColumns) {
        for (let i = 0; i < 8; i += 1) {
          const col = startCol + i;
          const hLower = getHoleById(`f${col}`);
          const hUpper = getHoleById(`e${col}`);
          if (hLower) {
            markers.push({
              id: `cand-lower-${col}`,
              position: { x: hLower.position.x, y: surfaceY + 0.006, z: hLower.position.z },
              colorHex: '#35C2D1',
              label: `f${col}`,
            });
          }
          if (hUpper) {
            markers.push({
              id: `cand-upper-${col}`,
              position: { x: hUpper.position.x, y: surfaceY + 0.006, z: hUpper.position.z },
              colorHex: '#35C2D1',
              label: `e${col}`,
            });
          }
        }
      }
    }

    return markers;
  }, [circuit.chip, currentHintLevel, currentStageIndex, highlights, mode, solution.pins]);

  if (mode !== 'guided' || highlightMarkers.length === 0) {
    return null;
  }

  return (
    <group name="guided-stage-highlights-3d">
      {highlightMarkers.map((marker) => (
        <group key={marker.id} position={[marker.position.x, marker.position.y, marker.position.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={TARGET_RING_GEOMETRY}>
            <meshBasicMaterial color={marker.colorHex} transparent opacity={0.88} />
          </mesh>

          {/* Anillo de pulso exterior */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={PIN_RING_GEOMETRY}>
            <meshBasicMaterial color={marker.colorHex} transparent opacity={0.45} />
          </mesh>

          {marker.badgeText && currentHintLevel === 3 && (
            <Html position={[0, 0.28, 0]} center style={{ pointerEvents: 'none' }}>
              <div
                className="whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold shadow-md"
                style={{
                  borderColor: marker.colorHex,
                  backgroundColor: '#10141Be6',
                  color: marker.colorHex,
                }}
              >
                {marker.badgeText}
              </div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}
