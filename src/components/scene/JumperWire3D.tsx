import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { resolveTerminalPosition } from '../../data/circuitLayout';
import { buildWireSplinePoints, type WireRoutingObstacles } from '../../data/wireRouting';
import type { JumperWireDescriptor } from '../../simulator/components';
import type { FlowDirection } from '../../simulator/energyFlow';
import {
  useCircuitEnergyFlow,
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

const WIRE_FLOW_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WIRE_FLOW_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uSpeed;
  uniform float uFrequency;
  uniform float uBaseGlow;
  varying vec2 vUv;
  void main() {
    float coord = vUv.x * uFrequency - uTime * uSpeed;
    float pulse = fract(coord);
    float head = smoothstep(0.0, 0.28, pulse);
    float tail = smoothstep(0.92, 0.28, pulse);
    float shape = head * tail;
    float intensity = pow(shape, 2.2);

    float totalLight = uBaseGlow + intensity * 1.6;
    vec3 col = uColor * (totalLight * 1.35);
    float alpha = clamp(uBaseGlow * 0.35 + intensity * 0.88, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

interface WireEnergyFlowMeshProps {
  readonly geometry: THREE.TubeGeometry;
  readonly colorHex: string;
  readonly direction: FlowDirection;
  readonly speedMultiplier: number;
  readonly length: number;
}

function WireEnergyFlowMesh({
  geometry,
  colorHex,
  direction,
  speedMultiplier,
  length,
}: WireEnergyFlowMeshProps) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colorHex) },
      uSpeed: { value: (direction === 'FORWARD' ? 1.75 : -1.75) * speedMultiplier },
      uFrequency: { value: Math.max(2.4, Math.min(8.5, length * 1.35)) },
      uBaseGlow: { value: 0.16 },
    }),
    [colorHex, direction, length, speedMultiplier],
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh geometry={geometry} renderOrder={2}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={WIRE_FLOW_VERTEX_SHADER}
        fragmentShader={WIRE_FLOW_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface JumperWire3DProps {
  readonly descriptor: JumperWireDescriptor;
  readonly obstacles?: WireRoutingObstacles;
}

export function JumperWire3D({ descriptor, obstacles }: JumperWire3DProps) {
  const mode = useLabStore((s) => s.mode);
  const activeTool = useLabStore((s) => s.activeTool);
  const isSelected = useLabStore(
    (s) => s.selection.kind === 'wire' && s.selection.wireId === descriptor.id,
  );
  const isHovered = useLabStore(
    (s) => s.hovered.kind === 'wire' && s.hovered.wireId === descriptor.id,
  );
  const setSelection = useLabStore((s) => s.setSelection);
  const setHovered = useLabStore((s) => s.setHovered);
  const deleteWire = useLabStore((s) => s.deleteWire);
  const isEnergyFlowVisible = useLabStore((s) => s.isEnergyFlowVisible);
  const solution = useCircuitSolution();
  const signalTrace = useSignalTrace();
  const energyFlow = useCircuitEnergyFlow();
  const wireFlow = energyFlow.wireFlows[descriptor.id];

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
    // Tubo envolvente para visualización de energía eléctrica (ligeramente mayor radio)
    const flowTubeGeometry = new THREE.TubeGeometry(curve, segments, 0.058, 10, false);
    // Tubo envolvente invisible para facilitar la selección individual con puntero
    const hitTubeGeometry = new THREE.TubeGeometry(curve, 24, 0.095, 8, false);
    const midPoint = curve.getPointAt(0.5);
    const length = curve.getLength();

    return {
      tubeGeometry,
      flowTubeGeometry,
      hitTubeGeometry,
      midPoint,
      length,
    };
  }, [descriptor.id, endPos, obstacles, startPos]);

  useEffect(() => {
    return () => {
      wireData?.tubeGeometry.dispose();
      wireData?.flowTubeGeometry.dispose();
      wireData?.hitTubeGeometry.dispose();
    };
  }, [wireData]);

  if (!wireData || !startPos || !endPos) {
    return null;
  }

  const interactiveInScene =
    mode === 'mounted' || activeTool === 'select' || activeTool === 'remove';
  const isRemoveMode = mode === 'guided' && activeTool === 'remove';

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
        if (isHovered) {
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

      {/* Malla dinámica de flujo de energía eléctrica sobre el conductor */}
      {isEnergyFlowVisible && wireFlow?.isConducting && wireFlow.direction !== 'NONE' && (
        <WireEnergyFlowMesh
          geometry={wireData.flowTubeGeometry}
          colorHex={wireFlow.colorHex}
          direction={wireFlow.direction}
          speedMultiplier={wireFlow.speedMultiplier}
          length={wireData.length}
        />
      )}

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
            <div className="whitespace-nowrap rounded-md border border-[#F1B85A]/75 bg-[#10141B]/95 px-2.5 py-1 font-mono text-[10px] text-[#E9EDF2] shadow-lg">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[#F1B85A]">{descriptor.signal ?? descriptor.id}</span>
                <span className="text-[#AEB8C5]">·</span>
                <span className="text-[#6DD19C]">{resolvedNetId}</span>
              </div>
              {isEnergyFlowVisible && wireFlow?.isConducting && (
                <div className="mt-1 flex items-center gap-1 border-t border-[#F1B85A]/30 pt-1 text-[9.5px] text-[#FFD043]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3CE08D]" />
                  <span>⚡ {wireFlow.descriptionEs}</span>
                </div>
              )}
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
            <div className="whitespace-nowrap rounded-md border border-[#35C2D1]/50 bg-[#10141B]/95 px-2.5 py-1 font-mono text-[11px] text-[#E9EDF2] shadow-lg">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#35C2D1]">
                  {descriptor.signal ?? descriptor.id}
                </span>
                <span className="text-[#AEB8C5]">·</span>
                <span className="text-[#E9EDF2]">{descriptor.fromTerminalId}</span>
                <span className="text-[#AEB8C5]">→</span>
                <span className="text-[#E9EDF2]">{descriptor.toTerminalId}</span>
                <span className="text-[#AEB8C5]">·</span>
                <span className="text-[#6DD19C]">{resolvedNetId}</span>
              </div>
              {isEnergyFlowVisible && wireFlow?.isConducting && (
                <div className="mt-1 flex items-center gap-1 border-t border-[#35C2D1]/30 pt-1 text-[9.5px] text-[#FFD043]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3CE08D]" />
                  <span>⚡ {wireFlow.descriptionEs}</span>
                </div>
              )}
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
