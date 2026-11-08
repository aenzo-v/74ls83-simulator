import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { resolveTerminalPosition } from '../../data/circuitLayout';
import { buildPreviewWireSplinePoints } from '../../data/wireRouting';
import {
  BREADBOARD_DIMENSIONS,
  COLUMN_COUNT,
  columnToX,
  findNearestHoleXZ,
  getHoleById,
  getStripHoles,
  PITCH,
} from '../../simulator/breadboard';
import {
  getKitAvailability,
  getOccupiedTerminals,
  type PlacementValidationResult,
  resolveDipFootprintAtPoint,
  resolveLedFootprintAtPoint,
  resolveResistorPresetFootprintAtPoint,
  validateChipPlacement,
  validateDipSwitchPlacement,
  validateLedPlacement,
  validateResistorPlacement,
  validateWireConnection,
} from '../../simulator/editableCircuit';
import { useLabStore } from '../../store/useLabStore';
import { SHARED_GEOMETRIES, SHARED_MATERIALS } from './sharedResources';

const HOLE_TARGET_RING = new THREE.RingGeometry(0.068, 0.11, 20);
const STRIP_PEER_RING = new THREE.RingGeometry(0.052, 0.076, 16);

const GHOST_VALID_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#35C2D1',
  emissive: '#186B75',
  emissiveIntensity: 0.35,
  transparent: true,
  opacity: 0.56,
  roughness: 0.35,
  metalness: 0.08,
  depthWrite: false,
});

const GHOST_INVALID_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#F06A6A',
  emissive: '#7A2020',
  emissiveIntensity: 0.38,
  transparent: true,
  opacity: 0.56,
  roughness: 0.38,
  metalness: 0.06,
  depthWrite: false,
});

function WirePreview3D() {
  const workingCircuit = useLabStore((s) => s.workingCircuit);
  const wireDraft = useLabStore((s) => s.wireDraft);
  const activeWireColor = useLabStore((s) => s.activeWireColor);
  const hovered = useLabStore((s) => s.hovered);

  const occupied = useMemo(
    () =>
      getOccupiedTerminals(workingCircuit, {
        ignoreWireId: wireDraft?.replaceWireId ?? undefined,
      }),
    [workingCircuit, wireDraft?.replaceWireId],
  );

  const fromPos = wireDraft ? resolveTerminalPosition(wireDraft.fromTerminalId) : undefined;
  const targetPos = wireDraft?.previewPoint;

  const previewTube = useMemo(() => {
    if (!fromPos || !targetPos) {
      return null;
    }
    const dist = Math.hypot(
      targetPos.x - fromPos.x,
      targetPos.y - fromPos.y,
      targetPos.z - fromPos.z,
    );
    if (dist < 0.05) {
      return null;
    }
    const pts = buildPreviewWireSplinePoints(fromPos, targetPos).map(
      (p) => new THREE.Vector3(p.x, p.y, p.z),
    );
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.35);
    return new THREE.TubeGeometry(curve, 24, 0.048, 10, false);
  }, [fromPos, targetPos]);

  useEffect(() => {
    return () => {
      previewTube?.dispose();
    };
  }, [previewTube]);

  const previewMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: activeWireColor,
        emissive: activeWireColor,
        emissiveIntensity: 0.22,
        transparent: true,
        opacity: 0.78,
        roughness: 0.38,
        metalness: 0.05,
        depthWrite: false,
      }),
    [activeWireColor],
  );

  useEffect(() => {
    return () => {
      previewMaterial.dispose();
    };
  }, [previewMaterial]);

  const surfaceY = BREADBOARD_DIMENSIONS.heightY;

  // Sin origen fijado todavía: resaltar el agujero bajo el puntero y sus compañeros libres de pista
  if (!wireDraft) {
    if (hovered.kind !== 'hole') {
      return null;
    }
    const hole = getHoleById(hovered.holeId);
    if (!hole) {
      return null;
    }
    const isBusy = occupied.has(hole.id);
    const peers =
      hole.kind === 'terminal'
        ? getStripHoles(hole.stripId).filter((p) => p.id !== hole.id && !occupied.has(p.id))
        : [];

    return (
      <group name="wire-origin-hover">
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[hole.position.x, surfaceY + 0.006, hole.position.z]}
          geometry={HOLE_TARGET_RING}
        >
          <meshBasicMaterial color={isBusy ? '#F06A6A' : '#6DD19C'} />
        </mesh>

        {peers.map((peer) => (
          <mesh
            key={`peer-${peer.id}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[peer.position.x, surfaceY + 0.0055, peer.position.z]}
            geometry={STRIP_PEER_RING}
          >
            <meshBasicMaterial color="#35C2D1" transparent opacity={0.55} />
          </mesh>
        ))}

        <Html
          position={[hole.position.x, surfaceY + 0.34, hole.position.z]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded-md border border-[#35C2D1]/55 bg-[#10141B]/95 px-2 py-0.5 font-mono text-[11px] text-[#E9EDF2] shadow-lg">
            <span className="font-semibold text-[#35C2D1]">{hole.id}</span>
            <span className="mx-1.5 text-[#AEB8C5]">·</span>
            <span className={isBusy ? 'text-[#F06A6A]' : 'text-[#6DD19C]'}>
              {isBusy ? 'Ocupado' : 'Clic para fijar origen'}
            </span>
          </div>
        </Html>
      </group>
    );
  }

  if (!fromPos || !targetPos) {
    return null;
  }

  const candidateId = wireDraft.candidateTerminalId;
  const candidateValidation = candidateId
    ? validateWireConnection(workingCircuit, wireDraft.fromTerminalId, candidateId, {
        replaceWireId: wireDraft.replaceWireId ?? undefined,
      })
    : null;

  const candidateHole = candidateId ? getHoleById(candidateId) : undefined;
  const candidatePeers =
    candidateHole && candidateHole.kind === 'terminal'
      ? getStripHoles(candidateHole.stripId).filter(
          (p) => p.id !== candidateHole.id && !occupied.has(p.id),
        )
      : [];

  return (
    <group name="wire-draft-preview">
      {/* Capuchón y anillo anclado en el contacto de origen */}
      <mesh
        position={[fromPos.x, fromPos.y + 0.075, fromPos.z]}
        geometry={SHARED_GEOMETRIES.wireFerruleBoot}
        material={SHARED_MATERIALS.selectedHighlight}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[fromPos.x, fromPos.y + 0.007, fromPos.z]}
        geometry={HOLE_TARGET_RING}
      >
        <meshBasicMaterial color="#F1B85A" />
      </mesh>
      <Html
        position={[fromPos.x, fromPos.y + 0.34, fromPos.z]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div className="whitespace-nowrap rounded border border-[#F1B85A]/75 bg-[#10141B]/95 px-1.5 py-0.5 font-mono text-[10px] text-[#E9EDF2] shadow">
          <span className="text-[#F1B85A]">Origen:</span> {wireDraft.fromTerminalId}
        </div>
      </Html>

      {/* Curva 3D temporal en vivo siguiendo el puntero */}
      {previewTube && <mesh geometry={previewTube} material={previewMaterial} />}

      {/* Resaltado del contacto destino candidato */}
      {candidateHole && (
        <>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[
              candidateHole.position.x,
              surfaceY + 0.007,
              candidateHole.position.z,
            ]}
            geometry={HOLE_TARGET_RING}
          >
            <meshBasicMaterial
              color={candidateValidation?.valid ? '#6DD19C' : '#F06A6A'}
            />
          </mesh>
          {candidatePeers.map((peer) => (
            <mesh
              key={`dest-peer-${peer.id}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[peer.position.x, surfaceY + 0.0055, peer.position.z]}
              geometry={STRIP_PEER_RING}
            >
              <meshBasicMaterial color="#35C2D1" transparent opacity={0.5} />
            </mesh>
          ))}
        </>
      )}

      {/* Etiqueta flotante del extremo provisional */}
      <Html
        position={[targetPos.x, targetPos.y + 0.38, targetPos.z]}
        center
        style={{ pointerEvents: 'none' }}
      >
        {candidateId === wireDraft.fromTerminalId ? (
          <div className="whitespace-nowrap rounded-md border border-[#F1B85A]/60 bg-[#10141B]/95 px-2 py-0.5 font-mono text-[11px] text-[#F1B85A] shadow-lg">
            Mismo contacto · Clic o Esc para cancelar
          </div>
        ) : candidateId && candidateValidation?.valid ? (
          <div className="whitespace-nowrap rounded-md border border-[#6DD19C]/70 bg-[#10141B]/95 px-2 py-0.5 font-mono text-[11px] text-[#E9EDF2] shadow-lg">
            <span className="font-semibold text-[#6DD19C]">Destino: {candidateId}</span>
            <span className="mx-1.5 text-[#AEB8C5]">·</span>
            <span className="text-[#AEB8C5]">Clic para conectar</span>
          </div>
        ) : candidateId && candidateValidation && !candidateValidation.valid ? (
          <div className="whitespace-nowrap rounded-md border border-[#F06A6A]/70 bg-[#1C1418]/95 px-2 py-0.5 font-mono text-[11px] text-[#F06A6A] shadow-lg">
            {candidateValidation.reasonEs}
          </div>
        ) : (
          <div className="whitespace-nowrap rounded-md border border-[#2D3B4E] bg-[#10141B]/92 px-2 py-0.5 font-mono text-[10px] text-[#AEB8C5] shadow">
            Elige un contacto libre de destino (Esc cancela)
          </div>
        )}
      </Html>
    </group>
  );
}

function PlacementPreview3D() {
  const workingCircuit = useLabStore((s) => s.workingCircuit);
  const activeKitItem = useLabStore((s) => s.activeKitItem);
  const resistorDisposition = useLabStore((s) => s.resistorDisposition);
  const ledReversed = useLabStore((s) => s.ledReversed);
  const resistorAnchorHoleId = useLabStore((s) => s.resistorAnchorHoleId);
  const hoverPoint = useLabStore((s) => s.placementHoverPoint);

  const availability = useMemo(() => getKitAvailability(workingCircuit), [workingCircuit]);
  const occupied = useMemo(() => getOccupiedTerminals(workingCircuit), [workingCircuit]);

  const surfaceY = BREADBOARD_DIMENSIONS.heightY;
  const anchorHole = resistorAnchorHoleId ? getHoleById(resistorAnchorHoleId) : undefined;

  const previewSpec = useMemo(() => {
    if (!hoverPoint) {
      return null;
    }

    if (activeKitItem === 'ic-74ls83a') {
      const fp = resolveDipFootprintAtPoint(hoverPoint.x, hoverPoint.z, 8);
      const validation = validateChipPlacement(workingCircuit, fp.startColumn, fp.rowZone);
      const clampedStart = Math.max(1, Math.min(COLUMN_COUNT - 7, fp.startColumn));
      const cx = (columnToX(clampedStart) + columnToX(clampedStart + 7)) * 0.5;
      const cz = fp.rowZone === 'trench' ? 0 : hoverPoint.z;
      return {
        kind: 'dip' as const,
        cx,
        cz,
        lengthX: 1.98,
        widthZ: 0.64,
        heightY: 0.33,
        showNotch: true,
        validation,
      };
    }

    if (
      activeKitItem === 'dip-sw-a' ||
      activeKitItem === 'dip-sw-b' ||
      activeKitItem === 'dip-sw-c0'
    ) {
      const span = activeKitItem === 'dip-sw-c0' ? 1 : 4;
      const fp = resolveDipFootprintAtPoint(hoverPoint.x, hoverPoint.z, span);
      const validation = validateDipSwitchPlacement(
        workingCircuit,
        activeKitItem,
        fp.startColumn,
        fp.rowZone,
      );
      const clampedStart = Math.max(1, Math.min(COLUMN_COUNT - span + 1, fp.startColumn));
      const cx = (columnToX(clampedStart) + columnToX(clampedStart + span - 1)) * 0.5;
      const cz = fp.rowZone === 'trench' ? 0 : hoverPoint.z;
      return {
        kind: 'dip' as const,
        cx,
        cz,
        lengthX: (span - 1) * PITCH + 0.28,
        widthZ: 0.66,
        heightY: 0.34,
        showNotch: false,
        validation,
      };
    }

    if (activeKitItem === 'led-amber' || activeKitItem === 'led-green') {
      const fp = resolveLedFootprintAtPoint(hoverPoint.x, hoverPoint.z, ledReversed);
      const templateId = availability[activeKitItem].nextTemplateId;
      if (!fp) {
        const invalid: PlacementValidationResult = {
          valid: false,
          code: 'OUT_OF_BOUNDS',
          reasonEs: 'Acerca el puntero a dos columnas de terminales (filas a–e o f–j).',
          targetHoles: [],
        };
        return {
          kind: 'led' as const,
          cx: hoverPoint.x,
          cz: hoverPoint.z,
          anodePos: null,
          cathodePos: null,
          validation: invalid,
        };
      }
      const validation = validateLedPlacement(
        workingCircuit,
        templateId,
        fp.anodeHoleId,
        fp.cathodeHoleId,
      );
      const aHole = getHoleById(fp.anodeHoleId);
      const cHole = getHoleById(fp.cathodeHoleId);
      const cx = aHole && cHole ? (aHole.position.x + cHole.position.x) * 0.5 : hoverPoint.x;
      const cz = aHole && cHole ? (aHole.position.z + cHole.position.z) * 0.5 : hoverPoint.z;
      return {
        kind: 'led' as const,
        cx,
        cz,
        anodePos: aHole?.position ?? null,
        cathodePos: cHole?.position ?? null,
        validation,
      };
    }

    // Resistencias 330 Ω / 1 kΩ
    const templateId = availability[activeKitItem].nextTemplateId;
    if (resistorDisposition === 'two-point') {
      const nearest = findNearestHoleXZ(hoverPoint.x, hoverPoint.z, PITCH * 0.75);
      if (!resistorAnchorHoleId) {
        if (!nearest) {
          return {
            kind: 'resistor-anchor' as const,
            cx: hoverPoint.x,
            cz: hoverPoint.z,
            validation: {
              valid: false,
              code: 'INVALID_TERMINAL' as const,
              reasonEs: 'Acerca el puntero a un agujero libre para fijar la 1ª pata.',
              targetHoles: [],
            },
          };
        }
        const isBusy = occupied.has(nearest.id);
        return {
          kind: 'resistor-anchor' as const,
          cx: nearest.position.x,
          cz: nearest.position.z,
          validation: {
            valid: !isBusy && Boolean(templateId),
            code: !templateId ? ('KIT_EXHAUSTED' as const) : isBusy ? ('HOLE_OCCUPIED' as const) : ('VALID' as const),
            reasonEs: !templateId
              ? 'Ya se han colocado todas las resistencias de este valor.'
              : isBusy
                ? `Agujero ${nearest.id} ocupado.`
                : `Clic para fijar 1ª terminal en ${nearest.id}.`,
            targetHoles: [nearest.id],
          },
        };
      }

      const leadBId = nearest?.id ?? resistorAnchorHoleId;
      const validation = validateResistorPlacement(
        workingCircuit,
        templateId,
        resistorAnchorHoleId,
        leadBId,
      );
      const hA = getHoleById(resistorAnchorHoleId);
      const hB = getHoleById(leadBId);
      return {
        kind: 'resistor' as const,
        posA: hA?.position ?? hoverPoint,
        posB: hB?.position ?? hoverPoint,
        validation,
      };
    }

    const fp = resolveResistorPresetFootprintAtPoint(
      hoverPoint.x,
      hoverPoint.z,
      resistorDisposition,
    );
    if (!fp) {
      return {
        kind: 'resistor-anchor' as const,
        cx: hoverPoint.x,
        cz: hoverPoint.z,
        validation: {
          valid: false,
          code: 'OUT_OF_BOUNDS' as const,
          reasonEs: 'Acerca el puntero al área de terminales de la protoboard.',
          targetHoles: [],
        },
      };
    }

    const validation = validateResistorPlacement(
      workingCircuit,
      templateId,
      fp.leadAHoleId,
      fp.leadBHoleId,
    );
    const hA = getHoleById(fp.leadAHoleId);
    const hB = getHoleById(fp.leadBHoleId);
    return {
      kind: 'resistor' as const,
      posA: hA?.position ?? hoverPoint,
      posB: hB?.position ?? hoverPoint,
      validation,
    };
  }, [
    activeKitItem,
    availability,
    hoverPoint,
    ledReversed,
    occupied,
    resistorAnchorHoleId,
    resistorDisposition,
    workingCircuit,
  ]);

  if (!previewSpec && !anchorHole) {
    return null;
  }

  const ghostMat = previewSpec?.validation.valid ? GHOST_VALID_MATERIAL : GHOST_INVALID_MATERIAL;

  return (
    <group name="component-placement-preview">
      {/* Anillo de 1ª terminal de resistencia en modo 2 puntos */}
      {anchorHole && (
        <>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[anchorHole.position.x, surfaceY + 0.007, anchorHole.position.z]}
            geometry={HOLE_TARGET_RING}
          >
            <meshBasicMaterial color="#F1B85A" />
          </mesh>
          <Html
            position={[anchorHole.position.x, surfaceY + 0.34, anchorHole.position.z]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded border border-[#F1B85A]/75 bg-[#10141B]/95 px-1.5 py-0.5 font-mono text-[10px] text-[#F1B85A] shadow">
              1ª pata: {anchorHole.id}
            </div>
          </Html>
        </>
      )}

      {/* Anillos sobre todos los agujeros objetivo (verde/cian si válido, rojo si inválido/ocupado) */}
      {previewSpec?.validation.targetHoles.map((hId) => {
        const h = getHoleById(hId);
        if (!h) {
          return null;
        }
        const holeBusy = occupied.has(hId);
        const ringColor =
          previewSpec.validation.valid && !holeBusy ? '#6DD19C' : '#F06A6A';
        return (
          <mesh
            key={`ghost-hole-${hId}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[h.position.x, surfaceY + 0.007, h.position.z]}
            geometry={HOLE_TARGET_RING}
          >
            <meshBasicMaterial color={ringColor} />
          </mesh>
        );
      })}

      {/* Silueta 3D semitransparente de DIP-16 o DIP Switch */}
      {previewSpec?.kind === 'dip' && (
        <group position={[previewSpec.cx, surfaceY + 0.3, previewSpec.cz]}>
          <mesh material={ghostMat}>
            <boxGeometry
              args={[previewSpec.lengthX, previewSpec.heightY, previewSpec.widthZ]}
            />
          </mesh>
          {previewSpec.showNotch && (
            <mesh position={[-previewSpec.lengthX * 0.5 + 0.06, previewSpec.heightY * 0.5, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.06, 16]} />
              <meshBasicMaterial color="#F1B85A" />
            </mesh>
          )}
        </group>
      )}

      {/* Silueta 3D semitransparente de LED 5 mm con indicación de polaridad (+ / −) */}
      {previewSpec?.kind === 'led' && (
        <group>
          <mesh
            position={[
              previewSpec.cx,
              surfaceY + 0.3,
              previewSpec.cz,
            ]}
            rotation={[
              0,
              previewSpec.anodePos &&
              previewSpec.cathodePos &&
              previewSpec.cathodePos.x < previewSpec.anodePos.x
                ? Math.PI
                : 0,
              0,
            ]}
            geometry={SHARED_GEOMETRIES.ledFlange}
            material={ghostMat}
          />
          <mesh
            position={[previewSpec.cx, surfaceY + 0.545, previewSpec.cz]}
            geometry={SHARED_GEOMETRIES.ledBarrel}
            material={ghostMat}
          />
          <mesh
            position={[previewSpec.cx, surfaceY + 0.715, previewSpec.cz]}
            geometry={SHARED_GEOMETRIES.ledDome}
            material={ghostMat}
          />
          {previewSpec.anodePos && (
            <mesh
              position={[
                previewSpec.anodePos.x,
                surfaceY + 0.15,
                previewSpec.anodePos.z,
              ]}
              material={ghostMat}
            >
              <boxGeometry args={[0.055, 0.3, 0.045]} />
            </mesh>
          )}
          {previewSpec.cathodePos && (
            <mesh
              position={[
                previewSpec.cathodePos.x,
                surfaceY + 0.15,
                previewSpec.cathodePos.z,
              ]}
              material={ghostMat}
            >
              <boxGeometry args={[0.055, 0.3, 0.045]} />
            </mesh>
          )}
        </group>
      )}

      {/* Silueta 3D semitransparente de Resistencia Axial */}
      {previewSpec?.kind === 'resistor' && (() => {
        const { posA, posB } = previewSpec;
        const midX = (posA.x + posB.x) * 0.5;
        const midZ = (posA.z + posB.z) * 0.5;
        const angleY = Math.atan2(posB.x - posA.x, posB.z - posA.z);
        const span = Math.max(0.08, Math.hypot(posB.x - posA.x, posB.z - posA.z));
        const bodyY = surfaceY + 0.25;

        return (
          <group>
            <group position={[midX, bodyY, midZ]} rotation={[0, angleY, 0]}>
              <mesh
                rotation={[Math.PI / 2, 0, 0]}
                geometry={SHARED_GEOMETRIES.resistorShaft}
                material={ghostMat}
              />
              <mesh
                rotation={[Math.PI / 2, 0, 0]}
                material={ghostMat}
              >
                <cylinderGeometry args={[0.026, 0.026, span, 8]} />
              </mesh>
            </group>
            <mesh position={[posA.x, surfaceY + 0.12, posA.z]} material={ghostMat}>
              <cylinderGeometry args={[0.026, 0.026, 0.24, 8]} />
            </mesh>
            <mesh position={[posB.x, surfaceY + 0.12, posB.z]} material={ghostMat}>
              <cylinderGeometry args={[0.026, 0.026, 0.24, 8]} />
            </mesh>
          </group>
        );
      })()}

      {/* Etiqueta flotante con validación física o motivo de rechazo en español */}
      {previewSpec && (() => {
        const badgeX =
          previewSpec.kind === 'resistor'
            ? (previewSpec.posA.x + previewSpec.posB.x) * 0.5
            : previewSpec.cx;
        const badgeZ =
          previewSpec.kind === 'resistor'
            ? (previewSpec.posA.z + previewSpec.posB.z) * 0.5
            : previewSpec.cz;
        const isValid = previewSpec.validation.valid;

        return (
          <Html
            position={[badgeX, surfaceY + 0.88, badgeZ]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div
              className={`whitespace-nowrap rounded-md border px-2.5 py-1 font-mono text-[11px] shadow-lg backdrop-blur-sm ${
                isValid
                  ? 'border-[#6DD19C]/70 bg-[#10141B]/95 text-[#6DD19C]'
                  : 'border-[#F06A6A]/75 bg-[#1C1418]/95 text-[#F06A6A]'
              }`}
            >
              {previewSpec.validation.reasonEs}
            </div>
          </Html>
        );
      })()}
    </group>
  );
}

/**
 * Superficie magnética 3D y previsualizaciones en vivo de colocación de componentes
 * y tendido de cables jumper en modo «Montaje guiado».
 *
 * No altera jamás el circuito eléctrico hasta que el usuario confirma con clic.
 */
export function InteractiveWorkbench3D() {
  const mode = useLabStore((s) => s.mode);
  const activeTool = useLabStore((s) => s.activeTool);
  const hovered = useLabStore((s) => s.hovered);
  const setHovered = useLabStore((s) => s.setHovered);
  const setPlacementHoverPoint = useLabStore((s) => s.setPlacementHoverPoint);
  const updateWireDraftCursor = useLabStore((s) => s.updateWireDraftCursor);
  const handleWireTerminalClick = useLabStore((s) => s.handleWireTerminalClick);
  const handlePlaceSurfaceClick = useLabStore((s) => s.handlePlaceSurfaceClick);
  const setEditorFeedback = useLabStore((s) => s.setEditorFeedback);

  if (mode !== 'guided') {
    return null;
  }

  const isSensorActive = activeTool === 'wire' || activeTool === 'place';
  const surfaceY = BREADBOARD_DIMENSIONS.heightY;

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const pt = { x: event.point.x, y: surfaceY, z: event.point.z };

    if (activeTool === 'wire') {
      const candidate = findNearestHoleXZ(pt.x, pt.z, PITCH * 0.65);
      if (candidate) {
        if (hovered.kind !== 'hole' || hovered.holeId !== candidate.id) {
          setHovered({ kind: 'hole', holeId: candidate.id });
        }
        updateWireDraftCursor(candidate.position, candidate.id);
      } else {
        if (hovered.kind === 'hole') {
          setHovered({ kind: 'none' });
        }
        updateWireDraftCursor(pt, null);
      }
      return;
    }

    if (activeTool === 'place') {
      setPlacementHoverPoint(pt);
    }
  };

  const handlePointerOut = () => {
    if (activeTool === 'place') {
      setPlacementHoverPoint(null);
    }
    if (hovered.kind === 'hole') {
      setHovered({ kind: 'none' });
    }
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.delta > 5) {
      return;
    }

    const pt = { x: event.point.x, y: surfaceY, z: event.point.z };

    if (activeTool === 'wire') {
      const candidate = findNearestHoleXZ(pt.x, pt.z, PITCH * 0.65);
      if (candidate) {
        handleWireTerminalClick(candidate.id);
      } else {
        setEditorFeedback({
          tone: 'info',
          textEs:
            'Acerca el puntero a un agujero de la protoboard o a un borne de la fuente +5 V.',
        });
      }
      return;
    }

    if (activeTool === 'place') {
      handlePlaceSurfaceClick(pt);
    }
  };

  return (
    <group name="interactive-workbench-3d">
      {/* Plano sensor magnético sobre la superficie de la protoboard */}
      {isSensorActive && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, surfaceY + 0.004, 0]}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <planeGeometry
            args={[
              BREADBOARD_DIMENSIONS.lengthX + 0.9,
              BREADBOARD_DIMENSIONS.widthZ + 0.9,
            ]}
          />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {activeTool === 'wire' && <WirePreview3D />}
      {activeTool === 'place' && <PlacementPreview3D />}
    </group>
  );
}
