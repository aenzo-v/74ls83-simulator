import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { BREADBOARD_DIMENSIONS, getHoleById } from '../../simulator/breadboard';
import type { LedDescriptor, LedLensColor } from '../../simulator/components';
import {
  useCircuitSolution,
  useDisplayedCircuit,
  useSignalTrace,
} from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';
import { SHARED_GEOMETRIES, SHARED_MATERIALS } from './sharedResources';

const LED_EPOXY_MATERIALS: Record<
  LedLensColor,
  { off: THREE.MeshPhysicalMaterial; on: THREE.MeshPhysicalMaterial; dieOn: THREE.MeshBasicMaterial }
> = {
  GREEN: {
    off: new THREE.MeshPhysicalMaterial({
      color: '#1E7047',
      transparent: true,
      opacity: 0.82,
      roughness: 0.2,
      metalness: 0.02,
      transmission: 0.25,
    }),
    on: new THREE.MeshPhysicalMaterial({
      color: '#3CE08D',
      emissive: '#25C977',
      emissiveIntensity: 0.68,
      transparent: true,
      opacity: 0.9,
      roughness: 0.18,
      metalness: 0.02,
    }),
    dieOn: new THREE.MeshBasicMaterial({ color: '#D8FFEB' }),
  },
  AMBER: {
    off: new THREE.MeshPhysicalMaterial({
      color: '#A16216',
      transparent: true,
      opacity: 0.82,
      roughness: 0.2,
      metalness: 0.02,
      transmission: 0.25,
    }),
    on: new THREE.MeshPhysicalMaterial({
      color: '#FFB238',
      emissive: '#F09018',
      emissiveIntensity: 0.72,
      transparent: true,
      opacity: 0.9,
      roughness: 0.18,
      metalness: 0.02,
    }),
    dieOn: new THREE.MeshBasicMaterial({ color: '#FFF4D2' }),
  },
};

interface Led3DProps {
  readonly descriptor: LedDescriptor;
  readonly activeOverride?: boolean;
}

export function Led3D({ descriptor, activeOverride }: Led3DProps) {
  const mode = useLabStore((s) => s.mode);
  const activeTool = useLabStore((s) => s.activeTool);
  const isSelected = useLabStore(
    (s) => s.selection.kind === 'component' && s.selection.componentId === descriptor.id,
  );
  const isHovered = useLabStore(
    (s) => s.hovered.kind === 'component' && s.hovered.componentId === descriptor.id,
  );
  const setSelection = useLabStore((s) => s.setSelection);
  const setHovered = useLabStore((s) => s.setHovered);
  const requestComponentRemoval = useLabStore((s) => s.requestComponentRemoval);
  const solution = useCircuitSolution();
  const signalTrace = useSignalTrace();

  const anodeHole = getHoleById(descriptor.anodeHoleId);
  const cathodeHole = getHoleById(descriptor.cathodeHoleId);

  if (!anodeHole || !cathodeHole) {
    return null;
  }

  const interactiveInScene =
    mode === 'mounted' || activeTool === 'select' || activeTool === 'remove';
  const isRemoveMode = mode === 'guided' && activeTool === 'remove';

  const ledState = solution.leds[descriptor.id];
  const isLit = activeOverride ?? Boolean(ledState?.isLit);
  const isTraced = Boolean(signalTrace?.componentIds.has(descriptor.id));

  const surfaceY = BREADBOARD_DIMENSIONS.heightY;
  const flangeBaseY = surfaceY + 0.3; // 1.22 cm: deja patas metálicas claramente visibles
  const barrelBottomY = flangeBaseY + 0.075;
  const barrelHeight = 0.34;
  const domeBaseY = barrelBottomY + barrelHeight;

  const cx = (anodeHole.position.x + cathodeHole.position.x) * 0.5;
  const cz = (anodeHole.position.z + cathodeHole.position.z) * 0.5;
  const polaritySign = cathodeHole.position.x >= anodeHole.position.x ? 1 : -1;

  const leadMat =
    isRemoveMode && isHovered
      ? SHARED_MATERIALS.removalHoverHighlight
      : isSelected
        ? SHARED_MATERIALS.selectedHighlight
        : isHovered
          ? SHARED_MATERIALS.hoveredHighlight
          : isTraced
            ? SHARED_MATERIALS.tracedLeadHighlight
            : SHARED_MATERIALS.tinnedLead;

  const palette = LED_EPOXY_MATERIALS[descriptor.color];
  const lensMaterial =
    isRemoveMode && isHovered
      ? SHARED_MATERIALS.removalHoverHighlight
      : isLit
        ? palette.on
        : palette.off;

  const legHeight = flangeBaseY - (surfaceY - 0.03);
  const legCenterY = surfaceY - 0.03 + legHeight * 0.5;

  return (
    <group
      name={descriptor.id}
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
        if (isHovered) {
          setHovered({ kind: 'none' });
        }
      }}
    >
      {/* Terminal Ánodo (+): incluye pequeño resalte escalonado identificador de ánodo */}
      <mesh position={[anodeHole.position.x, legCenterY, cz]} castShadow material={leadMat}>
        <boxGeometry args={[0.048, legHeight, 0.042]} />
      </mesh>
      <mesh
        position={[anodeHole.position.x, surfaceY + 0.17, cz]}
        castShadow
        material={leadMat}
      >
        <boxGeometry args={[0.088, 0.045, 0.048]} />
      </mesh>

      {/* Terminal Cátodo (−): alineado con el corte plano del reborde */}
      <mesh position={[cathodeHole.position.x, legCenterY, cz]} castShadow material={leadMat}>
        <boxGeometry args={[0.048, legHeight, 0.042]} />
      </mesh>

      {/* Electrodos internos visibles a través de la cápsula translúcida */}
      <mesh
        position={[anodeHole.position.x + polaritySign * 0.045, barrelBottomY + 0.11, cz]}
        geometry={SHARED_GEOMETRIES.ledAnodePost}
        material={SHARED_MATERIALS.internalElectrode}
      />
      <mesh
        position={[cathodeHole.position.x - polaritySign * 0.045, barrelBottomY + 0.14, cz]}
        geometry={SHARED_GEOMETRIES.ledCathodeCup}
        material={SHARED_MATERIALS.internalElectrode}
      />

      {/* Punto semiconductor interno cuando el estado resuelto por el motor está activo */}
      {isLit && (
        <mesh
          position={[cathodeHole.position.x - polaritySign * 0.045, barrelBottomY + 0.175, cz]}
          material={palette.dieOn}
        >
          <sphereGeometry args={[0.042, 12, 12]} />
        </mesh>
      )}

      {/* Cápsula translúcida de 5 mm: reborde con chaflán plano orientado hacia el cátodo */}
      <mesh
        position={[cx, flangeBaseY, cz]}
        rotation={[0, polaritySign === 1 ? 0 : Math.PI, 0]}
        geometry={SHARED_GEOMETRIES.ledFlange}
        material={lensMaterial}
        castShadow
      />
      <mesh
        position={[cx, barrelBottomY + barrelHeight * 0.5, cz]}
        geometry={SHARED_GEOMETRIES.ledBarrel}
        material={lensMaterial}
        castShadow
      />
      <mesh
        position={[cx, domeBaseY, cz]}
        geometry={SHARED_GEOMETRIES.ledDome}
        material={lensMaterial}
        castShadow
      />

      {/* Aro discreto en la base cuando está seleccionado, enfocado o en ruta trazada */}
      {(isSelected || isHovered || isTraced) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, surfaceY + 0.006, cz]}>
          <ringGeometry args={[0.24, 0.285, 24]} />
          <meshBasicMaterial
            color={
              isRemoveMode && isHovered
                ? '#F06A6A'
                : isSelected
                  ? '#F1B85A'
                  : '#35C2D1'
            }
          />
        </mesh>
      )}

      {isHovered && (
        <Html
          position={[cx, domeBaseY + 0.36, cz]}
          center
          style={{ pointerEvents: 'none' }}
        >
          {isRemoveMode ? (
            <div className="whitespace-nowrap rounded-md border border-[#F06A6A]/70 bg-[#1C1418]/95 px-2.5 py-1 font-mono text-[11px] text-[#F06A6A] shadow-lg">
              Clic para retirar {descriptor.label}
            </div>
          ) : (
            <div className="whitespace-nowrap rounded-md border border-[#35C2D1]/50 bg-[#10141B]/95 px-2 py-1 font-mono text-[11px] text-[#E9EDF2] shadow-lg">
              <span className="font-bold text-[#6DD19C]">{descriptor.signal}</span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className="text-[#E9EDF2]">+{descriptor.anodeHoleId}</span>
              <span className="mx-1 text-[#AEB8C5]">/</span>
              <span className="text-[#AEB8C5]">−{descriptor.cathodeHoleId}</span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className={isLit ? 'font-semibold text-[#6DD19C]' : 'text-[#AEB8C5]'}>
                {ledState?.statusLabel ?? (isLit ? 'Encendido (1)' : 'Apagado (0)')}
              </span>
            </div>
          )}
        </Html>
      )}
    </group>
  );
}

export function LedsGroup() {
  const circuit = useDisplayedCircuit();
  return (
    <group name="output-leds-group">
      {circuit.leds.map((led) => (
        <Led3D key={led.id} descriptor={led} />
      ))}
    </group>
  );
}
