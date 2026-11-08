import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { BREADBOARD_DIMENSIONS, columnToX, getHoleById, PITCH } from '../../simulator/breadboard';
import type { DipSwitchChannel, DipSwitchDescriptor } from '../../simulator/components';
import {
  useActiveSwitchStates,
  useDisplayedCircuit,
  useSignalTrace,
} from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';
import { createDipSwitchSilkscreenTexture } from './proceduralTextures';
import { SHARED_MATERIALS } from './sharedResources';

interface DipActuatorProps {
  readonly channel: DipSwitchChannel;
  readonly componentId: string;
  readonly centerX: number;
  readonly topY: number;
  readonly isOn: boolean;
  readonly interactiveInScene: boolean;
  readonly isRemoveMode: boolean;
}

function DipActuator({
  channel,
  componentId,
  centerX,
  topY,
  isOn,
  interactiveInScene,
  isRemoveMode,
}: DipActuatorProps) {
  const sliderRef = useRef<THREE.Mesh | null>(null);
  const targetZ = isOn ? -0.075 : 0.075;

  const setSelection = useLabStore((s) => s.setSelection);
  const setHovered = useLabStore((s) => s.setHovered);
  const toggleSwitchState = useLabStore((s) => s.toggleSwitchState);
  const requestComponentRemoval = useLabStore((s) => s.requestComponentRemoval);

  useFrame((_, delta) => {
    const mesh = sliderRef.current;
    if (!mesh) {
      return;
    }
    const alpha = 1 - Math.exp(-16 * Math.min(delta, 0.05));
    mesh.position.z += (targetZ - mesh.position.z) * alpha;
  });

  return (
    <group>
      {/* Cavidad oscura del carril deslizante */}
      <mesh position={[centerX, topY - 0.008, 0]} material={SHARED_MATERIALS.dipSwitchWell}>
        <boxGeometry args={[0.14, 0.03, 0.29]} />
      </mesh>

      {/* Indicador verde discreto visible en la base del carril cuando está en ON */}
      {isOn && (
        <mesh
          position={[centerX, topY + 0.008, 0.085]}
          material={SHARED_MATERIALS.dipSwitchActuatorOnCue}
        >
          <boxGeometry args={[0.1, 0.008, 0.08]} />
        </mesh>
      )}

      {/* Leva blanca móvil del interruptor DIP */}
      <mesh
        ref={sliderRef}
        position={[centerX, topY + 0.035, targetZ]}
        castShadow
        material={SHARED_MATERIALS.dipSwitchActuator}
      >
        <boxGeometry args={[0.118, 0.068, 0.125]} />
      </mesh>

      {/* Volumen de interacción cómodo por canal */}
      <mesh
        position={[centerX, topY + 0.04, 0]}
        onClick={(e) => {
          if (!interactiveInScene) {
            return;
          }
          e.stopPropagation();
          if (e.delta > 5) {
            return;
          }
          if (isRemoveMode) {
            requestComponentRemoval(componentId);
            return;
          }
          toggleSwitchState(channel.id);
          setSelection({
            kind: 'component',
            componentId,
            subChannelId: channel.id,
          });
        }}
        onPointerOver={(e) => {
          if (!interactiveInScene) {
            return;
          }
          e.stopPropagation();
          if (isRemoveMode) {
            setHovered({ kind: 'component', componentId });
            return;
          }
          setHovered({
            kind: 'component',
            componentId,
            subChannelId: channel.id,
          });
        }}
        onPointerOut={() => {
          if (!interactiveInScene) {
            return;
          }
          const currentHovered = useLabStore.getState().hovered;
          if (currentHovered.kind === 'component' && currentHovered.componentId === componentId) {
            setHovered({ kind: 'none' });
          }
        }}
      >
        <boxGeometry args={[0.23, 0.22, 0.56]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface DipSwitch3DProps {
  readonly descriptor: DipSwitchDescriptor;
}

export function DipSwitch3D({ descriptor }: DipSwitch3DProps) {
  const mode = useLabStore((s) => s.mode);
  const activeTool = useLabStore((s) => s.activeTool);
  const isComponentSelected = useLabStore(
    (s) => s.selection.kind === 'component' && s.selection.componentId === descriptor.id,
  );
  const isComponentHovered = useLabStore(
    (s) => s.hovered.kind === 'component' && s.hovered.componentId === descriptor.id,
  );
  const hoveredSubChannelId = useLabStore((s) =>
    s.hovered.kind === 'component' && s.hovered.componentId === descriptor.id
      ? s.hovered.subChannelId
      : null,
  );
  const selectedSubChannelId = useLabStore((s) =>
    s.selection.kind === 'component' && s.selection.componentId === descriptor.id
      ? s.selection.subChannelId
      : null,
  );
  const setSelection = useLabStore((s) => s.setSelection);
  const setHovered = useLabStore((s) => s.setHovered);
  const requestComponentRemoval = useLabStore((s) => s.requestComponentRemoval);

  const switchStates = useActiveSwitchStates();
  const signalTrace = useSignalTrace();

  const silkscreen = useMemo(
    () => createDipSwitchSilkscreenTexture(descriptor.channels.map((c) => c.signal)),
    [descriptor.channels],
  );

  useEffect(() => {
    return () => {
      silkscreen.dispose();
    };
  }, [silkscreen]);

  const startX = columnToX(descriptor.startColumn);
  const endX = columnToX(descriptor.endColumn);
  const centerX = (startX + endX) * 0.5;
  const bodyLengthX = (descriptor.endColumn - descriptor.startColumn) * PITCH + 0.28;
  const bodyWidthZ = 0.66;
  const surfaceY = BREADBOARD_DIMENSIONS.heightY;
  const baseY = surfaceY + 0.13;
  const bodyHeightY = 0.34;
  const topY = baseY + bodyHeightY;

  const interactiveInScene =
    mode === 'mounted' || activeTool === 'select' || activeTool === 'remove';
  const isRemoveMode = mode === 'guided' && activeTool === 'remove';

  const hoveredChannel =
    !isRemoveMode && hoveredSubChannelId
      ? descriptor.channels.find((c) => c.id === hoveredSubChannelId)
      : undefined;

  const housingMaterial =
    isRemoveMode && isComponentHovered
      ? SHARED_MATERIALS.removalHoverHighlight
      : isComponentSelected || isComponentHovered
        ? SHARED_MATERIALS.dipSwitchHousingSelected
        : SHARED_MATERIALS.dipSwitchHousing;

  return (
    <group name={descriptor.id}>
      {/* Carcasa aislante industrial azul sobre el canal central */}
      <mesh
        position={[centerX, baseY + bodyHeightY * 0.5, 0]}
        castShadow
        receiveShadow
        material={housingMaterial}
        onClick={(e) => {
          if (!interactiveInScene) {
            return;
          }
          e.stopPropagation();
          if (e.delta > 5) {
            return;
          }
          if (isRemoveMode) {
            requestComponentRemoval(descriptor.id);
            return;
          }
          setSelection({ kind: 'component', componentId: descriptor.id });
        }}
        onPointerOver={(e) => {
          if (!interactiveInScene) {
            return;
          }
          e.stopPropagation();
          setHovered({ kind: 'component', componentId: descriptor.id });
        }}
        onPointerOut={() => {
          if (!interactiveInScene) {
            return;
          }
          const currentHovered = useLabStore.getState().hovered;
          if (
            currentHovered.kind === 'component' &&
            currentHovered.componentId === descriptor.id &&
            !currentHovered.subChannelId
          ) {
            setHovered({ kind: 'none' });
          }
        }}
      >
        <boxGeometry args={[bodyLengthX, bodyHeightY, bodyWidthZ]} />
      </mesh>

      {/* Serigrafía superior ON + señales */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, topY + 0.0015, 0]}>
        <planeGeometry args={[bodyLengthX - 0.03, bodyWidthZ - 0.03]} />
        <meshBasicMaterial map={silkscreen} transparent depthWrite={false} />
      </mesh>

      {/* Canales deslizantes y terminales metálicas en filas 'e' y 'f' */}
      {descriptor.channels.map((channel) => {
        const topHole = getHoleById(channel.inputHoleId);
        const bottomHole = getHoleById(channel.outputHoleId);
        if (!topHole || !bottomHole) {
          return null;
        }

        const chX = topHole.position.x;
        const isChSelected =
          isComponentSelected &&
          (!selectedSubChannelId || selectedSubChannelId === channel.id);
        const isChHovered =
          isComponentHovered && hoveredSubChannelId === channel.id;
        const isChTraced = Boolean(signalTrace?.subChannelIds.has(channel.id));

        const leadMat =
          isRemoveMode && isComponentHovered
            ? SHARED_MATERIALS.removalHoverHighlight
            : isChSelected
              ? SHARED_MATERIALS.selectedHighlight
              : isChHovered
                ? SHARED_MATERIALS.hoveredHighlight
                : isChTraced
                  ? SHARED_MATERIALS.tracedLeadHighlight
                  : SHARED_MATERIALS.tinnedLead;

        const pinHeight = baseY + 0.08 - (surfaceY - 0.03);
        const pinCenterY = surfaceY - 0.03 + pinHeight * 0.5;
        const isOn = Boolean(switchStates[channel.id]);

        return (
          <group key={channel.id}>
            {/* Patas metálicas superior (e) e inferior (f) */}
            <mesh position={[chX, pinCenterY, topHole.position.z]} castShadow material={leadMat}>
              <boxGeometry args={[0.062, pinHeight, 0.03]} />
            </mesh>
            <mesh position={[chX, pinCenterY, bottomHole.position.z]} castShadow material={leadMat}>
              <boxGeometry args={[0.062, pinHeight, 0.03]} />
            </mesh>

            {/* Hombros cortos de unión con la carcasa */}
            <mesh
              position={[chX, baseY + 0.06, (topHole.position.z - bodyWidthZ * 0.5) * 0.5]}
              material={leadMat}
            >
              <boxGeometry args={[0.085, 0.03, 0.08]} />
            </mesh>
            <mesh
              position={[chX, baseY + 0.06, (bottomHole.position.z + bodyWidthZ * 0.5) * 0.5]}
              material={leadMat}
            >
              <boxGeometry args={[0.085, 0.03, 0.08]} />
            </mesh>

            <DipActuator
              channel={channel}
              componentId={descriptor.id}
              centerX={chX}
              topY={topY}
              isOn={isOn}
              interactiveInScene={interactiveInScene}
              isRemoveMode={isRemoveMode}
            />
          </group>
        );
      })}

      {/* Etiqueta en modo Quitar */}
      {isRemoveMode && isComponentHovered && (
        <Html
          position={[centerX, topY + 0.28, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded-md border border-[#F06A6A]/70 bg-[#1C1418]/95 px-2.5 py-1 font-mono text-[11px] text-[#F06A6A] shadow-lg">
            Clic para retirar {descriptor.label}
          </div>
        </Html>
      )}

      {/* Etiqueta contextual discreta al enfocar un canal */}
      {hoveredChannel && (() => {
        const hole = getHoleById(hoveredChannel.outputHoleId);
        if (!hole) {
          return null;
        }
        const isOn = Boolean(switchStates[hoveredChannel.id]);
        return (
          <Html
            position={[hole.position.x, topY + 0.28, 0]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded-md border border-[#35C2D1]/50 bg-[#10141B]/95 px-2 py-1 font-mono text-[11px] text-[#E9EDF2] shadow-lg">
              <span className="font-bold text-[#35C2D1]">{hoveredChannel.signal}</span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className={isOn ? 'font-semibold text-[#6DD19C]' : 'text-[#AEB8C5]'}>
                {isOn ? 'ON (Cerrado)' : 'OFF (Abierto)'}
              </span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className="text-[#AEB8C5]">
                {hoveredChannel.inputHoleId}↔{hoveredChannel.outputHoleId}
              </span>
            </div>
          </Html>
        );
      })()}
    </group>
  );
}

export function DipSwitchesGroup() {
  const circuit = useDisplayedCircuit();
  return (
    <group name="dip-switches-group">
      {circuit.dipSwitches.map((sw) => (
        <DipSwitch3D key={sw.id} descriptor={sw} />
      ))}
    </group>
  );
}
