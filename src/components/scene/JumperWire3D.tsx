import { Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { resolveTerminalPosition } from '../../data/circuitLayout';
import { buildWireSplinePoints, type WireRoutingObstacles } from '../../data/wireRouting';
import type { JumperWireDescriptor } from '../../simulator/components';
import {
  useCircuitSolution,
  useDisplayedCircuit,
  useSignalTrace,
} from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';
import {
  getDimmedWireInsulationMaterial,
  getTracedWireInsulationMaterial,
  getWireInsulationMaterial,
  SHARED_GEOMETRIES,
  SHARED_MATERIALS,
} from './sharedResources';

const INVISIBLE_HIT_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
});

const ENDPOINT_RING_GEOMETRY = new THREE.RingGeometry(0.088, 0.128, 22);

interface JumperWire3DProps {
  readonly descriptor: JumperWireDescriptor;
  readonly obstacles?: WireRoutingObstacles;
}

export function JumperWire3D({ descriptor, obstacles }: JumperWire3DProps) {
  const mode = useLabStore((s) => s.mode);
  const activeTool = useLabStore((s) => s.activeTool);
  const selection = useLabStore((s) => s.selection);
  const hovered = useLabStore((s) => s.hovered);
  const setSelection = useLabStore((s) => s.setSelection);
  const setHovered = useLabStore((s) => s.setHovered);
  const deleteWire = useLabStore((s) => s.deleteWire);
  const solution = useCircuitSolution();
  const signalTrace = useSignalTrace();

  const startPos = resolveTerminalPosition(descriptor.fromTerminalId);
  const endPos = resolveTerminalPosition(descriptor.toTerminalId);

  const wireData = useMemo(() => {
    if (!startPos || !endPos) {
      return null;
    }

    const controlPoints = buildWireSplinePoints(descriptor.id, startPos, endPos, obstacles);
    const vectors = controlPoints.map((pt) => new THREE.Vector3(pt.x, pt.y, pt.z));

    const curve = new THREE.CatmullRomCurve3(vectors, false, 'centripetal', 0.35);
    const segments = controlPoints.length > 7 ? 52 : 34;

    // Conductor flexible aislado de calibre realista (~1.0 mm diámetro exterior)
    const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.05, 12, false);
    // Tubo envolvente invisible para facilitar la selección individual con puntero
    const hitTubeGeometry = new THREE.TubeGeometry(curve, 24, 0.095, 8, false);
    const midPoint = curve.getPointAt(0.5);

    return {
      tubeGeometry,
      hitTubeGeometry,
      midPoint,
    };
  }, [descriptor.id, endPos, obstacles, startPos]);

  useEffect(() => {
    return () => {
      wireData?.tubeGeometry.dispose();
      wireData?.hitTubeGeometry.dispose();
    };
  }, [wireData]);

  if (!wireData || !startPos || !endPos) {
    return null;
  }

  const interactiveInScene =
    mode === 'mounted' || activeTool === 'select' || activeTool === 'remove';
  const isRemoveMode = mode === 'guided' && activeTool === 'remove';

  const isSelected = selection.kind === 'wire' && selection.wireId === descriptor.id;
  const isHovered = hovered.kind === 'wire' && hovered.wireId === descriptor.id;
  const isInTracedPath = signalTrace ? signalTrace.wireIds.has(descriptor.id) : false;
  const isDimmedByTrace =
    signalTrace !== null && !isInTracedPath && !isSelected && !isHovered;

  const wireState = solution.wires[descriptor.id];
  const resolvedNetId = wireState?.netId ?? 'SIN-RED';

  const insulationMaterial =
    isRemoveMode && isHovered
      ? SHARED_MATERIALS.removalHoverHighlight
      : isSelected
        ? SHARED_MATERIALS.selectedHighlight
        : isHovered
          ? SHARED_MATERIALS.hoveredHighlight
          : isInTracedPath
            ? getTracedWireInsulationMaterial(descriptor.colorHex)
            : isDimmedByTrace
              ? getDimmedWireInsulationMaterial(descriptor.colorHex)
              : getWireInsulationMaterial(descriptor.colorHex);

  const bootMaterial =
    isRemoveMode && isHovered
      ? SHARED_MATERIALS.removalHoverHighlight
      : isSelected
        ? SHARED_MATERIALS.selectedHighlight
        : isHovered
          ? SHARED_MATERIALS.hoveredHighlight
          : isInTracedPath
            ? SHARED_MATERIALS.tracedLeadHighlight
            : isDimmedByTrace
              ? SHARED_MATERIALS.wireBootDimmed
              : SHARED_MATERIALS.wireBootDark;

  const showEndpointRings = isSelected || isHovered || isInTracedPath;
  const ringColor =
    isRemoveMode && isHovered ? '#F06A6A' : isSelected ? '#F1B85A' : '#35C2D1';

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
          deleteWire(descriptor.id);
          return;
        }
        setSelection({ kind: 'wire', wireId: descriptor.id });
      }}
      onPointerOver={(e) => {
        if (!interactiveInScene) {
          return;
        }
        e.stopPropagation();
        setHovered({ kind: 'wire', wireId: descriptor.id });
      }}
      onPointerOut={() => {
        if (!interactiveInScene) {
          return;
        }
        if (hovered.kind === 'wire' && hovered.wireId === descriptor.id) {
          setHovered({ kind: 'none' });
        }
      }}
    >
      {/* Cuerpo aislado curvado del cable jumper */}
      <mesh
        geometry={wireData.tubeGeometry}
        material={insulationMaterial}
        castShadow={!isDimmedByTrace}
      />

      {/* Volumen táctil/puntero invisible para selección individual precisa */}
      <mesh geometry={wireData.hitTubeGeometry} material={INVISIBLE_HIT_MATERIAL} />

      {/* Extremo origen: espiga metálica + capuchón aislante alineado con el contacto */}
      <mesh
        position={[startPos.x, startPos.y - 0.01, startPos.z]}
        geometry={SHARED_GEOMETRIES.wireStrippedPin}
        material={SHARED_MATERIALS.tinnedLead}
      />
      <mesh
        position={[startPos.x, startPos.y + 0.075, startPos.z]}
        geometry={SHARED_GEOMETRIES.wireFerruleBoot}
        material={bootMaterial}
        castShadow={!isDimmedByTrace}
      />

      {/* Extremo destino: espiga metálica + capuchón aislante alineado con el contacto */}
      <mesh
        position={[endPos.x, endPos.y - 0.01, endPos.z]}
        geometry={SHARED_GEOMETRIES.wireStrippedPin}
        material={SHARED_MATERIALS.tinnedLead}
      />
      <mesh
        position={[endPos.x, endPos.y + 0.075, endPos.z]}
        geometry={SHARED_GEOMETRIES.wireFerruleBoot}
        material={bootMaterial}
        castShadow={!isDimmedByTrace}
      />

      {/* Marcadores anulares en ambos terminales cuando está seleccionado, enfocado o trazado */}
      {showEndpointRings && (
        <>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[startPos.x, startPos.y + 0.008, startPos.z]}
            geometry={ENDPOINT_RING_GEOMETRY}
          >
            <meshBasicMaterial color={ringColor} />
          </mesh>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[endPos.x, endPos.y + 0.008, endPos.z]}
            geometry={ENDPOINT_RING_GEOMETRY}
          >
            <meshBasicMaterial color={ringColor} />
          </mesh>
        </>
      )}

      {/* Etiquetas técnicas de origen, destino y red al seleccionar un cable individual */}
      {isSelected && !isRemoveMode && (
        <>
          <Html
            position={[startPos.x, startPos.y + 0.34, startPos.z]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded border border-[#F1B85A]/70 bg-[#10141B]/95 px-1.5 py-0.5 font-mono text-[10px] text-[#E9EDF2] shadow-md">
              <span className="text-[#F1B85A]">Origen:</span> {descriptor.fromTerminalId}
            </div>
          </Html>
          <Html
            position={[endPos.x, endPos.y + 0.34, endPos.z]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded border border-[#F1B85A]/70 bg-[#10141B]/95 px-1.5 py-0.5 font-mono text-[10px] text-[#E9EDF2] shadow-md">
              <span className="text-[#F1B85A]">Destino:</span> {descriptor.toTerminalId}
            </div>
          </Html>
          <Html
            position={[wireData.midPoint.x, wireData.midPoint.y + 0.28, wireData.midPoint.z]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded-md border border-[#F1B85A]/75 bg-[#10141B]/95 px-2 py-0.5 font-mono text-[10px] text-[#E9EDF2] shadow-lg">
              <span className="font-bold text-[#F1B85A]">{descriptor.signal ?? descriptor.id}</span>
              <span className="mx-1 text-[#AEB8C5]">·</span>
              <span className="text-[#6DD19C]">{resolvedNetId}</span>
            </div>
          </Html>
        </>
      )}

      {/* Etiqueta ligera al pasar el puntero sobre un cable */}
      {isHovered && (!isSelected || isRemoveMode) && (
        <Html
          position={[wireData.midPoint.x, wireData.midPoint.y + 0.24, wireData.midPoint.z]}
          center
          style={{ pointerEvents: 'none' }}
        >
          {isRemoveMode ? (
            <div className="whitespace-nowrap rounded-md border border-[#F06A6A]/70 bg-[#1C1418]/95 px-2.5 py-1 font-mono text-[11px] text-[#F06A6A] shadow-lg">
              Clic para eliminar {descriptor.id} ({descriptor.fromTerminalId} →{' '}
              {descriptor.toTerminalId})
            </div>
          ) : (
            <div className="whitespace-nowrap rounded-md border border-[#35C2D1]/50 bg-[#10141B]/95 px-2 py-1 font-mono text-[11px] text-[#E9EDF2] shadow-lg">
              <span className="font-semibold text-[#35C2D1]">
                {descriptor.signal ?? descriptor.id}
              </span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className="text-[#E9EDF2]">{descriptor.fromTerminalId}</span>
              <span className="mx-1 text-[#AEB8C5]">→</span>
              <span className="text-[#E9EDF2]">{descriptor.toTerminalId}</span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className="text-[#6DD19C]">{resolvedNetId}</span>
            </div>
          )}
        </Html>
      )}
    </group>
  );
}

export function JumperWiresGroup() {
  const circuit = useDisplayedCircuit();

  const obstacles = useMemo<WireRoutingObstacles>(
    () => ({
      chip: circuit.chip,
      dipSwitches: circuit.dipSwitches,
      leds: circuit.leds,
    }),
    [circuit.chip, circuit.dipSwitches, circuit.leds],
  );

  return (
    <group name="jumper-wires-group">
      {circuit.wires.map((wire) => (
        <JumperWire3D key={wire.id} descriptor={wire} obstacles={obstacles} />
      ))}
    </group>
  );
}
