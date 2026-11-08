import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { CHIP_74LS83_PLACEMENT } from '../../data/circuitLayout';
import { BREADBOARD_DIMENSIONS, columnToX, getHoleById } from '../../simulator/breadboard';
import { getChipMountedTerminalsForColumn } from '../../simulator/editableCircuit';
import type { PinNumber } from '../../simulator/types';
import { useDisplayedCircuit, useSignalTrace } from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';
import { createChip74LS83SilkscreenTexture } from './proceduralTextures';

const CHIP_LENGTH_X = 1.98;
const CHIP_WIDTH_Z = 0.64;
const CHIP_BASE_Y = BREADBOARD_DIMENSIONS.heightY + 0.14; // 1.06 cm
const CHIP_HEIGHT_Y = 0.33; // Cima en 1.39 cm
const CHIP_PARTING_Y = CHIP_BASE_Y + CHIP_HEIGHT_Y * 0.5;

export function DipChip74LS83() {
  const mode = useLabStore((s) => s.mode);
  const activeTool = useLabStore((s) => s.activeTool);
  const isChipSelected = useLabStore((s) => s.selection.kind === 'chip');
  const isChipHovered = useLabStore((s) => s.hovered.kind === 'chip');
  const selectedPinNumber = useLabStore((s) =>
    s.selection.kind === 'pin' ? s.selection.pinNumber : null,
  );
  const hoveredPinNumber = useLabStore((s) =>
    s.hovered.kind === 'pin' ? s.hovered.pinNumber : null,
  );
  const activePinNumber: PinNumber | undefined =
    hoveredPinNumber ?? selectedPinNumber ?? undefined;
  const setSelection = useLabStore((s) => s.setSelection);
  const setHovered = useLabStore((s) => s.setHovered);
  const requestComponentRemoval = useLabStore((s) => s.requestComponentRemoval);

  const circuit = useDisplayedCircuit();
  const signalTrace = useSignalTrace();
  const chip = circuit.chip;

  const silkscreenTexture = useMemo(() => createChip74LS83SilkscreenTexture(), []);

  useEffect(() => {
    return () => {
      silkscreenTexture.dispose();
    };
  }, [silkscreenTexture]);

  const mountedPins = useMemo(
    () => (chip ? getChipMountedTerminalsForColumn(chip.startColumn) : []),
    [chip],
  );

  const activeMountedPin = useMemo(
    () =>
      activePinNumber
        ? mountedPins.find((p) => p.spec.pinNumber === activePinNumber)
        : undefined,
    [activePinNumber, mountedPins],
  );

  if (!chip) {
    return null;
  }

  const startColumn = chip.startColumn ?? CHIP_74LS83_PLACEMENT.startColumn;
  const endColumn = startColumn + 7;
  const centerX = (columnToX(startColumn) + columnToX(endColumn)) * 0.5;
  const topSurfaceY = CHIP_BASE_Y + CHIP_HEIGHT_Y;
  const leftEdgeX = centerX - CHIP_LENGTH_X * 0.5;

  const interactiveInScene =
    mode === 'mounted' || activeTool === 'select' || activeTool === 'remove';
  const isRemoveMode = mode === 'guided' && activeTool === 'remove';

  const handleChipClick = (event: ThreeEvent<MouseEvent>) => {
    if (!interactiveInScene) {
      return;
    }
    event.stopPropagation();
    if (event.delta > 5) {
      return;
    }
    if (isRemoveMode) {
      requestComponentRemoval(chip.id);
      return;
    }
    setSelection({ kind: 'chip' });
  };

  const handleChipPointerOver = (event: ThreeEvent<PointerEvent>) => {
    if (!interactiveInScene) {
      return;
    }
    event.stopPropagation();
    setHovered({ kind: 'chip' });
  };

  const handleChipPointerOut = () => {
    if (!interactiveInScene) {
      return;
    }
    if (isChipHovered) {
      setHovered({ kind: 'none' });
    }
  };

  const topBodyColor =
    isRemoveMode && isChipHovered
      ? '#4A2026'
      : isChipSelected
        ? '#232A35'
        : isChipHovered
          ? '#212731'
          : '#1E232C';

  return (
    <group name="ic-74ls83a-dip16">
      {/* Mitad inferior del encapsulado epóxico moldeado */}
      <mesh
        position={[centerX, CHIP_BASE_Y + CHIP_HEIGHT_Y * 0.24, 0]}
        castShadow
        receiveShadow
        onClick={handleChipClick}
        onPointerOver={handleChipPointerOver}
        onPointerOut={handleChipPointerOut}
      >
        <boxGeometry args={[CHIP_LENGTH_X, CHIP_HEIGHT_Y * 0.48, CHIP_WIDTH_Z]} />
        <meshStandardMaterial color="#1B1F27" roughness={0.62} metalness={0.07} />
      </mesh>

      {/* Reborde fino de unión central del molde DIP (parting line) */}
      <mesh position={[centerX, CHIP_PARTING_Y, 0]} castShadow>
        <boxGeometry args={[CHIP_LENGTH_X + 0.02, 0.028, CHIP_WIDTH_Z + 0.02]} />
        <meshStandardMaterial color="#252B35" roughness={0.5} metalness={0.12} />
      </mesh>

      {/* Mitad superior ligeramente biselada del encapsulado epóxico */}
      <mesh
        position={[centerX, CHIP_BASE_Y + CHIP_HEIGHT_Y * 0.76, 0]}
        castShadow
        receiveShadow
        onClick={handleChipClick}
        onPointerOver={handleChipPointerOver}
        onPointerOut={handleChipPointerOut}
      >
        <boxGeometry args={[CHIP_LENGTH_X - 0.03, CHIP_HEIGHT_Y * 0.48, CHIP_WIDTH_Z - 0.03]} />
        <meshStandardMaterial color={topBodyColor} roughness={0.56} metalness={0.08} />
      </mesh>

      {/* Muesca semicircular física de orientación en el extremo izquierdo (lado Pin 1 / Pin 16) */}
      <mesh
        position={[leftEdgeX + 0.035, topSurfaceY - 0.035, 0]}
        rotation={[0, 0, 0]}
      >
        <cylinderGeometry args={[0.105, 0.105, 0.1, 24, 1, false, -Math.PI * 0.5, Math.PI]} />
        <meshStandardMaterial color="#101319" roughness={0.85} metalness={0.04} />
      </mesh>

      {/* Hendidura física circular indicadora del Pin 1 (esquina inferior izquierda) */}
      <mesh position={[leftEdgeX + 0.17, topSurfaceY - 0.004, CHIP_WIDTH_Z * 0.29]}>
        <cylinderGeometry args={[0.034, 0.03, 0.018, 18]} />
        <meshStandardMaterial color="#12161D" roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Serigrafía superior legible (SN74LS83AN / 74LS83A) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centerX, topSurfaceY + 0.0015, 0]}
      >
        <planeGeometry args={[CHIP_LENGTH_X - 0.05, CHIP_WIDTH_Z - 0.05]} />
        <meshBasicMaterial map={silkscreenTexture} transparent depthWrite={false} />
      </mesh>

      {/* Indicador sutil en el canal central bajo el chip cuando está seleccionado o enfocado */}
      {(isChipSelected || isChipHovered) && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[centerX, BREADBOARD_DIMENSIONS.heightY - 0.295, 0]}
        >
          <planeGeometry args={[CHIP_LENGTH_X + 0.14, 0.32]} />
          <meshBasicMaterial
            color={
              isRemoveMode && isChipHovered
                ? '#F06A6A'
                : isChipSelected
                  ? '#F1B85A'
                  : '#35C2D1'
            }
            transparent
            opacity={0.24}
          />
        </mesh>
      )}

      {/* 16 terminales metálicas Dual-In-Line insertadas en filas e y f */}
      {mountedPins.map(({ spec, holeId }) => {
        const hole = getHoleById(holeId);
        if (!hole) {
          return null;
        }

        const pinX = hole.position.x;
        const pinZ = hole.position.z; // ±0.381 cm
        const sideSign = spec.pinNumber <= 8 ? 1 : -1;
        const bodyEdgeZ = sideSign * (CHIP_WIDTH_Z * 0.5);

        const isSelected = selectedPinNumber === spec.pinNumber;
        const isHovered = hoveredPinNumber === spec.pinNumber;
        const isTraced = signalTrace?.pinNumber === spec.pinNumber;

        const leadColor =
          isRemoveMode && isChipHovered
            ? '#F06A6A'
            : isSelected
              ? '#F1B85A'
              : isHovered || isTraced
                ? '#35C2D1'
                : '#C7D0DB';

        const shoulderSpanZ = Math.abs(pinZ - bodyEdgeZ) + 0.03;
        const shoulderCenterZ = (bodyEdgeZ + pinZ) * 0.5;

        const upperLegTopY = CHIP_PARTING_Y;
        const upperLegBottomY = BREADBOARD_DIMENSIONS.heightY + 0.06;
        const upperLegHeight = upperLegTopY - upperLegBottomY;

        const lowerPinTopY = upperLegBottomY;
        const lowerPinBottomY = BREADBOARD_DIMENSIONS.heightY - 0.04;
        const lowerPinHeight = lowerPinTopY - lowerPinBottomY;

        return (
          <group
            key={`pin-${spec.pinNumber}`}
            onClick={(e) => {
              if (!interactiveInScene) {
                return;
              }
              e.stopPropagation();
              if (e.delta > 5) {
                return;
              }
              if (isRemoveMode) {
                requestComponentRemoval(chip.id);
                return;
              }
              setSelection({ kind: 'pin', pinNumber: spec.pinNumber });
            }}
            onPointerOver={(e) => {
              if (!interactiveInScene) {
                return;
              }
              e.stopPropagation();
              if (isRemoveMode) {
                setHovered({ kind: 'chip' });
                return;
              }
              setHovered({ kind: 'pin', pinNumber: spec.pinNumber });
            }}
            onPointerOut={() => {
              if (!interactiveInScene) {
                return;
              }
              const currentHovered = useLabStore.getState().hovered;
              if (isRemoveMode && currentHovered.kind === 'chip') {
                setHovered({ kind: 'none' });
                return;
              }
              if (currentHovered.kind === 'pin' && currentHovered.pinNumber === spec.pinNumber) {
                setHovered({ kind: 'none' });
              }
            }}
          >
            {/* Hombro horizontal que emerge de la línea media del cuerpo */}
            <mesh position={[pinX, CHIP_PARTING_Y, shoulderCenterZ]} castShadow>
              <boxGeometry args={[0.125, 0.032, shoulderSpanZ]} />
              <meshStandardMaterial
                color={leadColor}
                metalness={isSelected || isHovered ? 0.35 : 0.82}
                roughness={isSelected || isHovered ? 0.32 : 0.26}
              />
            </mesh>

            {/* Tramo vertical ancho superior de la pata DIP */}
            <mesh
              position={[pinX, upperLegBottomY + upperLegHeight * 0.5, pinZ]}
              castShadow
            >
              <boxGeometry args={[0.125, upperLegHeight, 0.03]} />
              <meshStandardMaterial
                color={leadColor}
                metalness={isSelected || isHovered ? 0.35 : 0.82}
                roughness={isSelected || isHovered ? 0.32 : 0.26}
              />
            </mesh>

            {/* Espiga estrecha inferior insertada en el alvéolo cuadrado de la protoboard */}
            <mesh position={[pinX, lowerPinBottomY + lowerPinHeight * 0.5, pinZ]}>
              <boxGeometry args={[0.058, lowerPinHeight, 0.03]} />
              <meshStandardMaterial
                color={leadColor}
                metalness={isSelected || isHovered ? 0.35 : 0.85}
                roughness={0.24}
              />
            </mesh>

            {/* Volumen invisible ligeramente mayor para selección cómoda con ratón/táctil */}
            <mesh position={[pinX, CHIP_PARTING_Y - 0.08, pinZ]}>
              <boxGeometry args={[0.21, 0.36, 0.2]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );
      })}

      {/* Etiqueta flotante contextual al enfocar un pin o al apuntar con Quitar */}
      {isRemoveMode && isChipHovered && (
        <Html
          position={[centerX, topSurfaceY + 0.28, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded-md border border-[#F06A6A]/70 bg-[#1C1418]/95 px-2.5 py-1 font-mono text-[11px] text-[#F06A6A] shadow-lg">
            Clic para retirar SN74LS83AN
          </div>
        </Html>
      )}

      {!isRemoveMode && activeMountedPin && (() => {
        const hole = getHoleById(activeMountedPin.holeId);
        if (!hole) {
          return null;
        }
        const zOffset = activeMountedPin.spec.pinNumber <= 8 ? 0.22 : -0.22;
        return (
          <Html
            position={[
              hole.position.x,
              topSurfaceY + 0.26,
              hole.position.z + zOffset,
            ]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded-md border border-[#35C2D1]/50 bg-[#10141B]/95 px-2 py-1 font-mono text-[11px] text-[#E9EDF2] shadow-lg backdrop-blur-sm">
              <span className="font-semibold text-[#F1B85A]">
                Pin {activeMountedPin.spec.pinNumber}
              </span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className="font-semibold text-[#35C2D1]">
                {activeMountedPin.spec.signal}
              </span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className="text-[#AEB8C5]">{activeMountedPin.holeId}</span>
            </div>
          </Html>
        );
      })()}

      {/* Sutil indicador de muesca Pin 1 cuando se selecciona el chip completo */}
      {isChipSelected && !isRemoveMode && (
        <Html
          position={[leftEdgeX - 0.18, topSurfaceY + 0.18, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded border border-[#F1B85A]/45 bg-[#10141B]/90 px-2 py-0.5 font-mono text-[10px] text-[#F1B85A] shadow">
            Muesca Izq. · Col {startColumn}–{endColumn}
          </div>
        </Html>
      )}
    </group>
  );
}
