import { Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { POWER_SUPPLY_5V } from '../../data/circuitLayout';
import { getOccupiedTerminals } from '../../simulator/editableCircuit';
import { useActiveSwitchStates, useDisplayedCircuit } from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';
import { createPowerSupplyFaceplateTexture } from './proceduralTextures';
import { SHARED_MATERIALS } from './sharedResources';

export function PowerSupply3D() {
  const mode = useLabStore((s) => s.mode);
  const activeTool = useLabStore((s) => s.activeTool);
  const wireDraft = useLabStore((s) => s.wireDraft);
  const selection = useLabStore((s) => s.selection);
  const hovered = useLabStore((s) => s.hovered);
  const setSelection = useLabStore((s) => s.setSelection);
  const setHovered = useLabStore((s) => s.setHovered);
  const toggleSwitchState = useLabStore((s) => s.toggleSwitchState);
  const handleWireTerminalClick = useLabStore((s) => s.handleWireTerminalClick);
  const updateWireDraftCursor = useLabStore((s) => s.updateWireDraftCursor);

  const switchStates = useActiveSwitchStates();
  const circuit = useDisplayedCircuit();
  const isSwitchOn = Boolean(switchStates[POWER_SUPPLY_5V.id]);

  const faceplate = useMemo(
    () => createPowerSupplyFaceplateTexture(isSwitchOn),
    [isSwitchOn],
  );

  useEffect(() => {
    return () => {
      faceplate.dispose();
    };
  }, [faceplate]);

  const occupied = useMemo(
    () => getOccupiedTerminals(circuit, { ignoreWireId: wireDraft?.replaceWireId ?? undefined }),
    [circuit, wireDraft?.replaceWireId],
  );

  const {
    chassisPosition,
    plusTerminalId,
    plusTerminalPosition,
    gndTerminalId,
    gndTerminalPosition,
  } = POWER_SUPPLY_5V;
  const widthX = 2.68;
  const depthZ = 1.38;
  const heightY = 0.92;
  const footH = 0.06;

  const isWireToolActive = mode === 'guided' && activeTool === 'wire';
  const canSelectChassis = mode === 'mounted' || activeTool === 'select';

  const isSelected =
    selection.kind === 'component' && selection.componentId === POWER_SUPPLY_5V.id;
  const isHovered =
    hovered.kind === 'component' && hovered.componentId === POWER_SUPPLY_5V.id;

  const isPlusHovered =
    hovered.kind === 'psu-terminal' && hovered.terminalId === plusTerminalId;
  const isGndHovered =
    hovered.kind === 'psu-terminal' && hovered.terminalId === gndTerminalId;

  const isPlusOccupied = occupied.has(plusTerminalId);
  const isGndOccupied = occupied.has(gndTerminalId);

  const renderBindingPost = (
    terminalId: string,
    terminalPos: { readonly x: number; readonly y: number; readonly z: number },
    postMaterial: typeof SHARED_MATERIALS.psuPostRed | typeof SHARED_MATERIALS.psuPostBlue,
    labelEs: string,
    isPostHovered: boolean,
    isPostOccupied: boolean,
  ) => {
    const isOrigin = wireDraft?.fromTerminalId === terminalId;
    const isInvalidTarget = isPostOccupied || isOrigin;
    const ringColor = isOrigin
      ? '#F1B85A'
      : isInvalidTarget
        ? '#F06A6A'
        : '#6DD19C';

    return (
      <group
        position={[terminalPos.x, footH + heightY + 0.04, terminalPos.z]}
        onClick={(e) => {
          if (!isWireToolActive) {
            return;
          }
          e.stopPropagation();
          if (e.delta > 5) {
            return;
          }
          handleWireTerminalClick(terminalId);
        }}
        onPointerOver={(e) => {
          if (!isWireToolActive) {
            return;
          }
          e.stopPropagation();
          setHovered({ kind: 'psu-terminal', terminalId });
          updateWireDraftCursor(terminalPos, terminalId);
        }}
        onPointerMove={(e) => {
          if (!isWireToolActive) {
            return;
          }
          e.stopPropagation();
          updateWireDraftCursor(terminalPos, terminalId);
        }}
        onPointerOut={() => {
          if (hovered.kind === 'psu-terminal' && hovered.terminalId === terminalId) {
            setHovered({ kind: 'none' });
          }
        }}
      >
        <mesh
          position={[0, 0.055, 0]}
          castShadow
          material={isPostHovered ? SHARED_MATERIALS.hoveredHighlight : postMaterial}
        >
          <cylinderGeometry args={[0.135, 0.15, 0.11, 18]} />
        </mesh>
        <mesh position={[0, 0.11, 0]} material={SHARED_MATERIALS.tinnedLead}>
          <cylinderGeometry args={[0.065, 0.065, 0.04, 14]} />
        </mesh>

        {/* Volumen invisible cómodo para conectar cables a los bornes en modo Cablear */}
        {isWireToolActive && (
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 0.3, 14]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}

        {/* Indicador luminoso de disponibilidad de borne durante el cableado */}
        {isWireToolActive && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
            <ringGeometry args={[0.165, 0.215, 22]} />
            <meshBasicMaterial
              color={ringColor}
              transparent
              opacity={isPostHovered || isOrigin ? 0.95 : 0.62}
            />
          </mesh>
        )}

        {isWireToolActive && isPostHovered && (
          <Html
            position={[0, 0.42, 0]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div className="whitespace-nowrap rounded-md border border-[#35C2D1]/60 bg-[#10141B]/95 px-2 py-1 font-mono text-[11px] text-[#E9EDF2] shadow-lg">
              <span className="font-semibold text-[#35C2D1]">{labelEs}</span>
              <span className="mx-1.5 text-[#AEB8C5]">·</span>
              <span className={isInvalidTarget ? 'text-[#F06A6A]' : 'text-[#6DD19C]'}>
                {isOrigin
                  ? 'Origen activo (clic para cancelar)'
                  : isPostOccupied
                    ? 'Ocupado'
                    : 'Disponible'}
              </span>
            </div>
          </Html>
        )}
      </group>
    );
  };

  return (
    <group
      name={POWER_SUPPLY_5V.id}
      onClick={(e) => {
        if (!canSelectChassis) {
          return;
        }
        e.stopPropagation();
        if (e.delta > 5) {
          return;
        }
        setSelection({ kind: 'component', componentId: POWER_SUPPLY_5V.id });
      }}
      onPointerOver={(e) => {
        if (!canSelectChassis) {
          return;
        }
        e.stopPropagation();
        setHovered({ kind: 'component', componentId: POWER_SUPPLY_5V.id });
      }}
      onPointerOut={() => {
        if (hovered.kind === 'component' && hovered.componentId === POWER_SUPPLY_5V.id) {
          setHovered({ kind: 'none' });
        }
      }}
    >
      {/* 4 patas de apoyo de caucho sobre la mesa */}
      {[
        [-1.08, -0.5],
        [1.08, -0.5],
        [-1.08, 0.5],
        [1.08, 0.5],
      ].map(([ox, oz]) => (
        <mesh
          key={`foot-${ox}-${oz}`}
          position={[chassisPosition.x + ox, footH * 0.5, chassisPosition.z + oz]}
          material={SHARED_MATERIALS.rubberFoot}
        >
          <cylinderGeometry args={[0.12, 0.12, footH, 14]} />
        </mesh>
      ))}

      {/* Chasis metálico anodizado del módulo regulado de +5.0 V */}
      <mesh
        position={[chassisPosition.x, footH + heightY * 0.5, chassisPosition.z]}
        castShadow
        receiveShadow
        material={
          isSelected || isHovered
            ? SHARED_MATERIALS.psuTrim
            : SHARED_MATERIALS.psuChassis
        }
      >
        <boxGeometry args={[widthX, heightY, depthZ]} />
      </mesh>

      {/* Bisel perimetral superior */}
      <mesh
        position={[chassisPosition.x, footH + heightY + 0.015, chassisPosition.z]}
        material={SHARED_MATERIALS.psuTrim}
      >
        <boxGeometry args={[widthX - 0.06, 0.03, depthZ - 0.06]} />
      </mesh>

      {/* Carátula técnica superior */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[chassisPosition.x, footH + heightY + 0.032, chassisPosition.z]}
      >
        <planeGeometry args={[widthX - 0.12, depthZ - 0.12]} />
        <meshBasicMaterial map={faceplate} />
      </mesh>

      {/* Interruptor basculante mecánico (ON / STANDBY) */}
      <group
        position={[chassisPosition.x + 0.72, footH + heightY + 0.06, chassisPosition.z - 0.22]}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > 5) {
            return;
          }
          toggleSwitchState(POWER_SUPPLY_5V.id);
          if (canSelectChassis) {
            setSelection({ kind: 'component', componentId: POWER_SUPPLY_5V.id });
          }
        }}
      >
        <mesh material={SHARED_MATERIALS.dipSwitchWell}>
          <boxGeometry args={[0.38, 0.06, 0.44]} />
        </mesh>
        <mesh
          position={[0, 0.045, 0]}
          rotation={[isSwitchOn ? -0.22 : 0.22, 0, 0]}
          castShadow
          material={
            isSwitchOn
              ? SHARED_MATERIALS.dipSwitchActuatorOnCue
              : SHARED_MATERIALS.psuTrim
          }
        >
          <boxGeometry args={[0.28, 0.075, 0.34]} />
        </mesh>
      </group>

      {/* Borne positivo +5 V (rojo) */}
      {renderBindingPost(
        plusTerminalId,
        plusTerminalPosition,
        SHARED_MATERIALS.psuPostRed,
        'Borne +5 V (psu-5v:plus)',
        isPlusHovered,
        isPlusOccupied,
      )}

      {/* Borne negativo GND (azul/referencia) */}
      {renderBindingPost(
        gndTerminalId,
        gndTerminalPosition,
        SHARED_MATERIALS.psuPostBlue,
        'Borne GND (psu-5v:gnd)',
        isGndHovered,
        isGndOccupied,
      )}

      {isHovered && !isWireToolActive && (
        <Html
          position={[chassisPosition.x, footH + heightY + 0.45, chassisPosition.z]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded-md border border-[#35C2D1]/50 bg-[#10141B]/95 px-2 py-1 font-mono text-[11px] text-[#E9EDF2] shadow-lg">
            <span className="font-semibold text-[#35C2D1]">Fuente +5.0 V CC</span>
            <span className="mx-1.5 text-[#AEB8C5]">·</span>
            <span className={isSwitchOn ? 'text-[#6DD19C]' : 'text-[#AEB8C5]'}>
              {isSwitchOn ? 'Interruptor ON' : 'En espera (STBY)'}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
