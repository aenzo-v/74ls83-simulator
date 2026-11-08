import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  ALL_BREADBOARD_HOLES,
  BREADBOARD_DIMENSIONS,
  findNearestHoleXZ,
  getHoleById,
  getStripHoles,
} from '../../simulator/breadboard';
import {
  findWireInCircuit,
  getChipMountedTerminalsForColumn,
} from '../../simulator/editableCircuit';
import type { BreadboardHole } from '../../simulator/types';
import { useDisplayedCircuit, useSignalTrace } from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';
import {
  createPowerRailSilkscreenTexture,
  createTerminalBankSilkscreenTexture,
} from './proceduralTextures';

const TOP_RAIL_Z = { min: -2.73, max: -1.72 } as const;
const UPPER_BANK_Z = { min: -1.65, max: -0.19 } as const;
const LOWER_BANK_Z = { min: 0.19, max: 1.65 } as const;
const BOTTOM_RAIL_Z = { min: 1.72, max: 2.73 } as const;

const PRIMARY_HOLE_RING_GEOM = new THREE.RingGeometry(0.068, 0.104, 20);
const PEER_HOLE_RING_GEOM = new THREE.RingGeometry(0.058, 0.082, 16);

export function Breadboard3D() {
  const bevelMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const cavityMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const clipMeshRef = useRef<THREE.InstancedMesh | null>(null);

  const mode = useLabStore((s) => s.mode);
  const activeTool = useLabStore((s) => s.activeTool);
  const selection = useLabStore((s) => s.selection);
  const hovered = useLabStore((s) => s.hovered);
  const setSelection = useLabStore((s) => s.setSelection);
  const setHovered = useLabStore((s) => s.setHovered);

  const circuit = useDisplayedCircuit();
  const signalTrace = useSignalTrace();

  const silkscreens = useMemo(() => {
    return {
      topRail: createPowerRailSilkscreenTexture(
        TOP_RAIL_Z.min,
        TOP_RAIL_Z.max,
        'top-plus',
        'top-minus',
      ),
      upperBank: createTerminalBankSilkscreenTexture(
        UPPER_BANK_Z.min,
        UPPER_BANK_Z.max,
        'upper',
      ),
      lowerBank: createTerminalBankSilkscreenTexture(
        LOWER_BANK_Z.min,
        LOWER_BANK_Z.max,
        'lower',
      ),
      bottomRail: createPowerRailSilkscreenTexture(
        BOTTOM_RAIL_Z.min,
        BOTTOM_RAIL_Z.max,
        'bottom-plus',
        'bottom-minus',
      ),
    };
  }, []);

  useEffect(() => {
    return () => {
      silkscreens.topRail.dispose();
      silkscreens.upperBank.dispose();
      silkscreens.lowerBank.dispose();
      silkscreens.bottomRail.dispose();
    };
  }, [silkscreens]);

  // Poblar las 830 perforaciones mediante InstancedMesh (3 draw calls para toda la protoboard)
  useLayoutEffect(() => {
    const bevelMesh = bevelMeshRef.current;
    const cavityMesh = cavityMeshRef.current;
    const clipMesh = clipMeshRef.current;
    if (!bevelMesh || !cavityMesh || !clipMesh) {
      return;
    }

    const dummy = new THREE.Object3D();
    const surfaceY = BREADBOARD_DIMENSIONS.heightY;

    ALL_BREADBOARD_HOLES.forEach((hole, index) => {
      dummy.rotation.set(-Math.PI / 2, 0, 0);

      dummy.position.set(hole.position.x, surfaceY + 0.0014, hole.position.z);
      dummy.updateMatrix();
      bevelMesh.setMatrixAt(index, dummy.matrix);

      dummy.position.set(hole.position.x, surfaceY + 0.0022, hole.position.z);
      dummy.updateMatrix();
      cavityMesh.setMatrixAt(index, dummy.matrix);

      // El clip metálico interior se orienta según el sentido de la pista conductora
      dummy.rotation.set(-Math.PI / 2, 0, hole.kind === 'rail' ? Math.PI / 2 : 0);
      dummy.position.set(hole.position.x, surfaceY + 0.0028, hole.position.z);
      dummy.updateMatrix();
      clipMesh.setMatrixAt(index, dummy.matrix);
    });

    bevelMesh.instanceMatrix.needsUpdate = true;
    cavityMesh.instanceMatrix.needsUpdate = true;
    clipMesh.instanceMatrix.needsUpdate = true;
  }, []);

  // Determinar nodos activos (selección, puntero y ruta eléctrica trazada) y sus pistas
  const highlightState = useMemo(() => {
    const selectedHoleIds = new Set<string>();
    const activeHoleIds = new Set<string>();
    const peerById = new Map<string, BreadboardHole>();
    const visitedStrips = new Set<string>();

    const mountedPins = circuit.chip
      ? getChipMountedTerminalsForColumn(circuit.chip.startColumn)
      : [];

    if (selection.kind === 'breadboard' && selection.holeId) {
      selectedHoleIds.add(selection.holeId);
    } else if (selection.kind === 'pin') {
      const pinEntry = mountedPins.find((p) => p.spec.pinNumber === selection.pinNumber);
      if (pinEntry) {
        selectedHoleIds.add(pinEntry.holeId);
      }
    } else if (selection.kind === 'wire') {
      const w = findWireInCircuit(circuit, selection.wireId);
      if (w) {
        if (getHoleById(w.fromTerminalId)) selectedHoleIds.add(w.fromTerminalId);
        if (getHoleById(w.toTerminalId)) selectedHoleIds.add(w.toTerminalId);
      }
    }

    const suppressHoverRings =
      mode === 'guided' && (activeTool === 'place' || activeTool === 'wire');

    if (!suppressHoverRings && hovered.kind === 'hole') {
      activeHoleIds.add(hovered.holeId);
    } else if (!suppressHoverRings && hovered.kind === 'pin') {
      const pinEntry = mountedPins.find((p) => p.spec.pinNumber === hovered.pinNumber);
      if (pinEntry) {
        activeHoleIds.add(pinEntry.holeId);
      }
    } else if (!suppressHoverRings && hovered.kind === 'wire') {
      const w = findWireInCircuit(circuit, hovered.wireId);
      if (w) {
        if (getHoleById(w.fromTerminalId)) activeHoleIds.add(w.fromTerminalId);
        if (getHoleById(w.toTerminalId)) activeHoleIds.add(w.toTerminalId);
      }
    } else {
      for (const id of selectedHoleIds) {
        activeHoleIds.add(id);
      }
    }

    for (const hId of activeHoleIds) {
      const hole = getHoleById(hId);
      if (!hole || visitedStrips.has(hole.stripId)) {
        continue;
      }
      visitedStrips.add(hole.stripId);
      for (const peer of getStripHoles(hole.stripId)) {
        peerById.set(peer.id, peer);
      }
    }

    // Añadir continuidad de pistas locales cuando hay un resaltado de ruta eléctrica activo
    if (signalTrace) {
      for (const hId of signalTrace.highlightedHoleIds) {
        activeHoleIds.add(hId);
        const h = getHoleById(hId);
        if (h) {
          peerById.set(h.id, h);
        }
      }
      for (const stripId of signalTrace.stripIds) {
        if (visitedStrips.has(stripId)) {
          continue;
        }
        visitedStrips.add(stripId);
        for (const peer of getStripHoles(stripId)) {
          peerById.set(peer.id, peer);
        }
      }
    }

    return {
      selectedHoleIds,
      activeHoleIds,
      peers: [...peerById.values()],
    };
  }, [activeTool, circuit, hovered, mode, selection, signalTrace]);

  const canSelectHoles = mode === 'mounted' || activeTool === 'select';

  const handleSurfaceMove = (event: ThreeEvent<PointerEvent>) => {
    if (!canSelectHoles) {
      return;
    }
    event.stopPropagation();
    const nearest = findNearestHoleXZ(event.point.x, event.point.z);
    if (nearest) {
      if (hovered.kind !== 'hole' || hovered.holeId !== nearest.id) {
        setHovered({ kind: 'hole', holeId: nearest.id });
      }
    } else if (hovered.kind === 'hole') {
      setHovered({ kind: 'none' });
    }
  };

  const handleSurfaceClick = (event: ThreeEvent<MouseEvent>) => {
    if (!canSelectHoles) {
      return;
    }
    event.stopPropagation();
    if (event.delta > 5) {
      return;
    }
    const nearest = findNearestHoleXZ(event.point.x, event.point.z);
    if (nearest) {
      setSelection({ kind: 'breadboard', holeId: nearest.id });
    } else {
      setSelection({ kind: 'breadboard' });
    }
  };

  const handlePointerOut = () => {
    if (!canSelectHoles) {
      return;
    }
    if (hovered.kind === 'hole') {
      setHovered({ kind: 'none' });
    }
  };

  const { lengthX, widthZ, heightY, baseHeightY } = BREADBOARD_DIMENSIONS;
  const raisedHeight = heightY - baseHeightY;
  const raisedCenterY = baseHeightY + raisedHeight * 0.5;
  const holeCount = ALL_BREADBOARD_HOLES.length;

  return (
    <group name="breadboard-mb102">
      {/* Lámina adhesiva inferior característica de las protoboards reales */}
      <mesh position={[0, 0.035, 0]} receiveShadow>
        <boxGeometry args={[lengthX - 0.08, 0.07, widthZ - 0.08]} />
        <meshStandardMaterial color="#C8AF62" roughness={0.85} metalness={0.02} />
      </mesh>

      {/* Base estructural continua de plástico ABS blanco mate (define el fondo del canal central) */}
      <mesh
        position={[0, 0.07 + (baseHeightY - 0.07) * 0.5, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          if (!canSelectHoles) {
            return;
          }
          e.stopPropagation();
          if (e.delta > 5) {
            return;
          }
          setSelection({ kind: 'breadboard' });
        }}
      >
        <boxGeometry args={[lengthX, baseHeightY - 0.07, widthZ]} />
        <meshStandardMaterial color="#E6E3DC" roughness={0.78} metalness={0.02} />
      </mesh>

      {/* Riel de alimentación superior */}
      <mesh
        position={[0, raisedCenterY, (TOP_RAIL_Z.min + TOP_RAIL_Z.max) * 0.5]}
        castShadow
        receiveShadow
        onPointerMove={handleSurfaceMove}
        onPointerOut={handlePointerOut}
        onClick={handleSurfaceClick}
      >
        <boxGeometry args={[lengthX, raisedHeight, TOP_RAIL_Z.max - TOP_RAIL_Z.min]} />
        <meshStandardMaterial color="#F2F0EB" roughness={0.72} metalness={0.02} />
      </mesh>

      {/* Bloque superior de terminales (filas a–e) */}
      <mesh
        position={[0, raisedCenterY, (UPPER_BANK_Z.min + UPPER_BANK_Z.max) * 0.5]}
        castShadow
        receiveShadow
        onPointerMove={handleSurfaceMove}
        onPointerOut={handlePointerOut}
        onClick={handleSurfaceClick}
      >
        <boxGeometry args={[lengthX, raisedHeight, UPPER_BANK_Z.max - UPPER_BANK_Z.min]} />
        <meshStandardMaterial color="#F2F0EB" roughness={0.72} metalness={0.02} />
      </mesh>

      {/* Bloque inferior de terminales (filas f–j) */}
      <mesh
        position={[0, raisedCenterY, (LOWER_BANK_Z.min + LOWER_BANK_Z.max) * 0.5]}
        castShadow
        receiveShadow
        onPointerMove={handleSurfaceMove}
        onPointerOut={handlePointerOut}
        onClick={handleSurfaceClick}
      >
        <boxGeometry args={[lengthX, raisedHeight, LOWER_BANK_Z.max - LOWER_BANK_Z.min]} />
        <meshStandardMaterial color="#F2F0EB" roughness={0.72} metalness={0.02} />
      </mesh>

      {/* Riel de alimentación inferior */}
      <mesh
        position={[0, raisedCenterY, (BOTTOM_RAIL_Z.min + BOTTOM_RAIL_Z.max) * 0.5]}
        castShadow
        receiveShadow
        onPointerMove={handleSurfaceMove}
        onPointerOut={handlePointerOut}
        onClick={handleSurfaceClick}
      >
        <boxGeometry args={[lengthX, raisedHeight, BOTTOM_RAIL_Z.max - BOTTOM_RAIL_Z.min]} />
        <meshStandardMaterial color="#F2F0EB" roughness={0.72} metalness={0.02} />
      </mesh>

      {/* Pestañas laterales de encastre mecánico típicas del cuerpo MB-102 */}
      {[-1.55, 0, 1.55].map((zTab) => (
        <mesh
          key={`tab-left-${zTab}`}
          position={[-lengthX * 0.5 - 0.06, heightY * 0.48, zTab]}
          castShadow
        >
          <boxGeometry args={[0.12, heightY * 0.55, 0.34]} />
          <meshStandardMaterial color="#EAE7E0" roughness={0.76} metalness={0.02} />
        </mesh>
      ))}
      {[-1.55, 0, 1.55].map((zTab) => (
        <mesh
          key={`tab-right-${zTab}`}
          position={[lengthX * 0.5 + 0.06, heightY * 0.48, zTab]}
          castShadow
        >
          <boxGeometry args={[0.12, heightY * 0.55, 0.34]} />
          <meshStandardMaterial color="#EAE7E0" roughness={0.76} metalness={0.02} />
        </mesh>
      ))}

      {/* Serigrafía impresa al ras de cada bloque elevado */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, heightY + 0.0008, (TOP_RAIL_Z.min + TOP_RAIL_Z.max) * 0.5]}
      >
        <planeGeometry args={[lengthX, TOP_RAIL_Z.max - TOP_RAIL_Z.min]} />
        <meshBasicMaterial map={silkscreens.topRail} transparent depthWrite={false} />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, heightY + 0.0008, (UPPER_BANK_Z.min + UPPER_BANK_Z.max) * 0.5]}
      >
        <planeGeometry args={[lengthX, UPPER_BANK_Z.max - UPPER_BANK_Z.min]} />
        <meshBasicMaterial map={silkscreens.upperBank} transparent depthWrite={false} />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, heightY + 0.0008, (LOWER_BANK_Z.min + LOWER_BANK_Z.max) * 0.5]}
      >
        <planeGeometry args={[lengthX, LOWER_BANK_Z.max - LOWER_BANK_Z.min]} />
        <meshBasicMaterial map={silkscreens.lowerBank} transparent depthWrite={false} />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, heightY + 0.0008, (BOTTOM_RAIL_Z.min + BOTTOM_RAIL_Z.max) * 0.5]}
      >
        <planeGeometry args={[lengthX, BOTTOM_RAIL_Z.max - BOTTOM_RAIL_Z.min]} />
        <meshBasicMaterial map={silkscreens.bottomRail} transparent depthWrite={false} />
      </mesh>

      {/* Bisel perimetral de las 830 perforaciones */}
      <instancedMesh ref={bevelMeshRef} args={[undefined, undefined, holeCount]}>
        <planeGeometry args={[0.148, 0.148]} />
        <meshStandardMaterial color="#D5D1C8" roughness={0.82} metalness={0.02} />
      </instancedMesh>

      {/* Cavidad cuadrada oscura de las 830 perforaciones */}
      <instancedMesh ref={cavityMeshRef} args={[undefined, undefined, holeCount]}>
        <planeGeometry args={[0.112, 0.112]} />
        <meshStandardMaterial color="#161B23" roughness={0.92} metalness={0.05} />
      </instancedMesh>

      {/* Contacto elástico metálico interno de las 830 perforaciones */}
      <instancedMesh ref={clipMeshRef} args={[undefined, undefined, holeCount]}>
        <planeGeometry args={[0.068, 0.036]} />
        <meshStandardMaterial color="#8E9AA9" roughness={0.36} metalness={0.78} />
      </instancedMesh>

      {/* Indicadores discretos de continuidad eléctrica interna al inspeccionar nodo, pin, cable o ruta */}
      {highlightState.peers.map((peer) => {
        const isPrimary = highlightState.activeHoleIds.has(peer.id);
        const isSelectedNode = highlightState.selectedHoleIds.has(peer.id);

        const accentColor = isSelectedNode
          ? '#F1B85A'
          : isPrimary
            ? '#35C2D1'
            : '#6DD19C';

        return (
          <mesh
            key={`highlight-${peer.id}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[peer.position.x, heightY + 0.0045, peer.position.z]}
            geometry={isPrimary ? PRIMARY_HOLE_RING_GEOM : PEER_HOLE_RING_GEOM}
          >
            <meshBasicMaterial
              color={accentColor}
              transparent
              opacity={isPrimary ? 0.95 : 0.55}
            />
          </mesh>
        );
      })}
    </group>
  );
}
