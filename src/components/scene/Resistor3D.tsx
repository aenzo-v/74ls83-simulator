import { Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BREADBOARD_DIMENSIONS, getHoleById } from '../../simulator/breadboard';
import type { ResistorDescriptor } from '../../simulator/components';
import { useDisplayedCircuit, useSignalTrace } from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';
import {
  RESISTOR_BAND_MATERIALS,
  SHARED_GEOMETRIES,
  SHARED_MATERIALS,
} from './sharedResources';

interface Resistor3DProps {
  readonly descriptor: ResistorDescriptor;
}

export function Resistor3D({ descriptor }: Resistor3DProps) {
  const mode = useLabStore((s) => s.mode);
  const activeTool = useLabStore((s) => s.activeTool);
  const selection = useLabStore((s) => s.selection);
  const hovered = useLabStore((s) => s.hovered);
  const setSelection = useLabStore((s) => s.setSelection);
  const setHovered = useLabStore((s) => s.setHovered);
  const requestComponentRemoval = useLabStore((s) => s.requestComponentRemoval);
  const signalTrace = useSignalTrace();

  const holeA = getHoleById(descriptor.leadAHoleId);
  const holeB = getHoleById(descriptor.leadBHoleId);

  const surfaceY = BREADBOARD_DIMENSIONS.heightY;
  const bodyCenterY = surfaceY + 0.25; // 1.17 cm: holgura limpia sobre la superficie de 0.92 cm

  const geometryData = useMemo(() => {
    if (!holeA || !holeB) {
      return null;
    }

    const ax = holeA.position.x;
    const az = holeA.position.z;
    const bx = holeB.position.x;
    const bz = holeB.position.z;

    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;

    const midX = (ax + bx) * 0.5;
    const midZ = (az + bz) * 0.5;
    const angleY = Math.atan2(dx, dz);

    // Alambre axial continuo doblado a 90° que entra verticalmente en ambos alvéolos
    const bendOffset = Math.min(0.08, len * 0.14);
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(ax, surfaceY - 0.03, az),
        new THREE.Vector3(ax, bodyCenterY - 0.04, az),
        new THREE.Vector3(ax + ux * bendOffset, bodyCenterY, az + uz * bendOffset),
        new THREE.Vector3(midX, bodyCenterY, midZ),
        new THREE.Vector3(bx - ux * bendOffset, bodyCenterY, bz - uz * bendOffset),
        new THREE.Vector3(bx, bodyCenterY - 0.04, bz),
        new THREE.Vector3(bx, surfaceY - 0.03, bz),
      ],
      false,
      'centripetal',
      0.25,
    );

    const leadTube = new THREE.TubeGeometry(curve, 24, 0.026, 8, false);

    return {
      midX,
      midZ,
      angleY,
      spanLen: len,
      leadTube,
    };
  }, [bodyCenterY, holeA, holeB, surfaceY]);

  useEffect(() => {
    return () => {
      geometryData?.leadTube.dispose();
    };
  }, [geometryData]);

  if (!geometryData || !holeA || !holeB) {
    return null;
  }

  const interactiveInScene =
    mode === 'mounted' || activeTool === 'select' || activeTool === 'remove';
  const isRemoveMode = mode === 'guided' && activeTool === 'remove';

  const isSelected = selection.kind === 'component' && selection.componentId === descriptor.id;
  const isHovered = hovered.kind === 'component' && hovered.componentId === descriptor.id;
  const isTraced = Boolean(signalTrace?.componentIds.has(descriptor.id));

  const leadMaterial =
    isRemoveMode && isHovered
      ? SHARED_MATERIALS.removalHoverHighlight
      : isSelected
        ? SHARED_MATERIALS.selectedHighlight
        : isHovered
          ? SHARED_MATERIALS.hoveredHighlight
          : isTraced
            ? SHARED_MATERIALS.tracedLeadHighlight
            : SHARED_MATERIALS.tinnedLead;

  const bodyMaterial =
    isRemoveMode && isHovered
      ? SHARED_MATERIALS.removalHoverHighlight
      : SHARED_MATERIALS.resistorCeramicBody;

  const [band1, band2, band3, bandTol] = descriptor.bands;

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
        if (hovered.kind === 'component' && hovered.componentId === descriptor.id) {
          setHovered({ kind: 'none' });
        }
      }}
    >
      {/* Terminales metálicas axiales dobladas hacia los agujeros exactos */}
      <mesh geometry={geometryData.leadTube} material={leadMaterial} castShadow />

      {/* Cuerpo cerámico axial beige con casquetes redondeados y 4 bandas de color EIA */}
      <group
        position={[geometryData.midX, bodyCenterY, geometryData.midZ]}
        rotation={[0, geometryData.angleY, 0]}
      >
        <group rotation={[Math.PI / 2, 0, 0]}>
          {/* Cilindro central */}
          <mesh
            geometry={SHARED_GEOMETRIES.resistorShaft}
            material={bodyMaterial}
            castShadow
          />

          {/* Casquetes extremos característicos del encapsulado axial */}
          <mesh
            position={[0, -0.175, 0]}
            scale={[1, 0.82, 1]}
            geometry={SHARED_GEOMETRIES.resistorCap}
            material={bodyMaterial}
            castShadow
          />
          <mesh
            position={[0, 0.175, 0]}
            scale={[1, 0.82, 1]}
            geometry={SHARED_GEOMETRIES.resistorCap}
            material={bodyMaterial}
            castShadow
          />

          {/* 4 bandas de colores reales (1ª cifra, 2ª cifra, multiplicador y tolerancia) */}
          <mesh
            position={[0, -0.155, 0]}
            geometry={SHARED_GEOMETRIES.resistorCapBand}
            material={RESISTOR_BAND_MATERIALS[band1]}
          />
          <mesh
            position={[0, -0.065, 0]}
            geometry={SHARED_GEOMETRIES.resistorBand}
            material={RESISTOR_BAND_MATERIALS[band2]}
          />
          <mesh
            position={[0, 0.02, 0]}
            geometry={SHARED_GEOMETRIES.resistorBand}
            material={RESISTOR_BAND_MATERIALS[band3]}
          />
          <mesh
            position={[0, 0.145, 0]}
            geometry={SHARED_GEOMETRIES.resistorCapBand}
            material={RESISTOR_BAND_MATERIALS[bandTol]}
          />
        </group>

        {/* Volumen invisible de selección cómoda */}
        <mesh>
          <boxGeometry args={[0.28, 0.3, Math.max(0.68, geometryData.spanLen)]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {isHovered && (
        <Html
          position={[geometryData.midX, bodyCenterY + 0.28, geometryData.midZ]}
          center
          style={{ pointerEvents: 'none' }}
        >
          {isRemoveMode ? (
            <div className="whitespace-nowrap rounded-md border border-[#F06A6A]/70 bg-[#1C1418]/95 px-2.5 py-1 font-mono text-[11px] text-[#F06A6A] shadow-lg">
              Clic para retirar {descriptor.formattedValue} ({descriptor.leadAHoleId}–
              {descriptor.leadBHoleId})
            </div>
          ) : (
            <div className="whitespace-nowrap rounded-md border border-[#35C2D1]/50 bg-[#10141B]/95 px-2 py-1 font-mono text-[11px] text-[#E9EDF2] shadow-lg">
              <span className="font-semibold text-[#F1B85A]">{descriptor.formattedValue}</span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className="text-[#35C2D1]">{descriptor.associatedSignal}</span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className="text-[#AEB8C5]">
                {descriptor.leadAHoleId}–{descriptor.leadBHoleId}
              </span>
            </div>
          )}
        </Html>
      )}
    </group>
  );
}

export function ResistorsGroup() {
  const circuit = useDisplayedCircuit();
  return (
    <group name="resistors-group">
      {circuit.resistors.map((res) => (
        <Resistor3D key={res.id} descriptor={res} />
      ))}
    </group>
  );
}
