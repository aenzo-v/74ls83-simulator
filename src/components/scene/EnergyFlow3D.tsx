import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { POWER_SUPPLY_5V } from '../../data/circuitLayout';
import {
  BREADBOARD_DIMENSIONS,
  columnToX,
  getHoleById,
  railToZ,
} from '../../simulator/breadboard';
import { getChipMountedTerminalsForColumn } from '../../simulator/editableCircuit';
import type { PowerRailId } from '../../simulator/types';
import {
  useCircuitEnergyFlow,
  useCircuitSolution,
  useDisplayedCircuit,
} from '../../store/useCircuitSolution';
import { useLabStore } from '../../store/useLabStore';

const RAIL_FLOW_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RAIL_FLOW_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uSpeed;
  uniform float uFrequency;
  varying vec2 vUv;
  void main() {
    float coord = vUv.x * uFrequency - uTime * uSpeed;
    float pulse = fract(coord);
    float shape = smoothstep(0.0, 0.25, pulse) * smoothstep(0.85, 0.25, pulse);
    float intensity = pow(shape, 2.0);

    float baseGlow = 0.12;
    float total = baseGlow + intensity * 1.4;
    vec3 col = uColor * total;
    float alpha = clamp(baseGlow * 0.4 + intensity * 0.75, 0.0, 0.95);

    gl_FragColor = vec4(col, alpha);
  }
`;

interface RailFlowStripProps {
  readonly railId: PowerRailId;
  readonly zOffset: number;
  readonly colorHex: string;
  readonly direction: 1 | -1;
}

function RailFlowStrip({ railId, zOffset, colorHex, direction }: RailFlowStripProps) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const xStart = columnToX(2);
  const xEnd = columnToX(62);
  const lengthX = Math.abs(xEnd - xStart);
  const centerX = (xStart + xEnd) * 0.5;
  const zPos = railToZ(railId) + zOffset;
  const yPos = BREADBOARD_DIMENSIONS.heightY + 0.0025;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colorHex) },
      uSpeed: { value: direction * 1.4 },
      uFrequency: { value: 16.0 },
    }),
    [colorHex, direction],
  );

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh
      position={[centerX, yPos, zPos]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={3}
    >
      <planeGeometry args={[lengthX, 0.048, 48, 1]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={RAIL_FLOW_VERTEX_SHADER}
        fragmentShader={RAIL_FLOW_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

const PIN_BEACON_GEOMETRY = new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12);
const PIN_BEACON_RING_GEOMETRY = new THREE.RingGeometry(0.05, 0.09, 16);

function ChipEnergyFlowBeacons() {
  const energyFlow = useCircuitEnergyFlow();
  const solution = useCircuitSolution();
  const circuit = useDisplayedCircuit();
  const chip = circuit.chip;

  const mountedPins = useMemo(
    () => (chip ? getChipMountedTerminalsForColumn(chip.startColumn) : []),
    [chip],
  );

  const beacons = useMemo(() => {
    if (!chip || !energyFlow.isChipActive) {
      return [];
    }

    const items: { pinNumber: number; x: number; y: number; z: number; colorHex: string; label: string }[] = [];
    const surfaceY = BREADBOARD_DIMENSIONS.heightY + 0.14 + 0.33 + 0.005;

    for (const { spec, holeId } of mountedPins) {
      const hole = getHoleById(holeId);
      if (!hole) {
        continue;
      }

      const isLower = spec.pinNumber <= 8;
      const x = hole.position.x;
      const z = isLower ? 0.32 - 0.08 : -0.32 + 0.08;

      let colorHex: string | null = null;
      let label = '';

      if (spec.pinNumber === 5) {
        // VCC (+5V)
        colorHex = '#FF4D4D';
        label = 'Pin 5 VCC (+5.0 V)';
      } else if (spec.pinNumber === 12) {
        // GND (0V)
        colorHex = '#388BFF';
        label = 'Pin 12 GND (0 V)';
      } else if (spec.direction === 'INPUT') {
        const isHigh = solution.pins[spec.pinNumber]?.logicLevel === 1;
        if (isHigh) {
          colorHex =
            spec.role === 'INPUT_A'
              ? '#2EB8C6'
              : spec.role === 'INPUT_B'
                ? '#8E75FF'
                : '#FFC233';
          label = `Entrada ${spec.signal} en nivel ALTO (1)`;
        }
      } else if (spec.direction === 'OUTPUT') {
        const isHigh = solution.pins[spec.pinNumber]?.logicLevel === 1;
        if (isHigh) {
          colorHex = spec.signal === 'C4' ? '#FF9533' : '#3CE08D';
          label = `Salida ${spec.signal} activa (1)`;
        }
      }

      if (colorHex) {
        items.push({
          pinNumber: spec.pinNumber,
          x,
          y: surfaceY,
          z,
          colorHex,
          label,
        });
      }
    }

    return items;
  }, [chip, energyFlow, mountedPins, solution]);

  return (
    <group name="chip-energy-beacons">
      {beacons.map((b) => (
        <group key={`chip-beacon-${b.pinNumber}`} position={[b.x, b.y, b.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={PIN_BEACON_RING_GEOMETRY}>
            <meshBasicMaterial color={b.colorHex} transparent opacity={0.88} />
          </mesh>
          <mesh position={[0, 0.02, 0]} geometry={PIN_BEACON_GEOMETRY}>
            <meshBasicMaterial color={b.colorHex} transparent opacity={0.92} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const PSU_RING_GEOMETRY = new THREE.RingGeometry(0.12, 0.22, 24);

function PsuEnergyAura() {
  const energyFlow = useCircuitEnergyFlow();

  if (!energyFlow.isPowered) {
    return null;
  }

  const { plusTerminalPosition, gndTerminalPosition } = POWER_SUPPLY_5V;
  const y = 1.13 + 0.02;

  return (
    <group name="psu-energy-aura">
      {/* Halo borne rojo +5V */}
      <mesh
        position={[plusTerminalPosition.x, y, plusTerminalPosition.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={PSU_RING_GEOMETRY}
      >
        <meshBasicMaterial color="#FF4D4D" transparent opacity={0.65} />
      </mesh>

      {/* Halo borne azul GND */}
      <mesh
        position={[gndTerminalPosition.x, y, gndTerminalPosition.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={PSU_RING_GEOMETRY}
      >
        <meshBasicMaterial color="#388BFF" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

export function EnergyFlow3D() {
  const isEnergyFlowVisible = useLabStore((s) => s.isEnergyFlowVisible);
  const energyFlow = useCircuitEnergyFlow();

  if (!isEnergyFlowVisible || !energyFlow.isPowered) {
    return null;
  }

  return (
    <group name="energy-flow-3d-visuals">
      {/* Tiras animadas de corriente convencional a lo largo de los rieles activos */}
      {energyFlow.activeRails.topPlus && (
        <RailFlowStrip railId="top-plus" zOffset={-0.07} colorHex="#FF4D4D" direction={1} />
      )}
      {energyFlow.activeRails.topMinus && (
        <RailFlowStrip railId="top-minus" zOffset={0.07} colorHex="#388BFF" direction={-1} />
      )}
      {energyFlow.activeRails.bottomPlus && (
        <RailFlowStrip railId="bottom-plus" zOffset={0.07} colorHex="#FF4D4D" direction={1} />
      )}
      {energyFlow.activeRails.bottomMinus && (
        <RailFlowStrip railId="bottom-minus" zOffset={-0.07} colorHex="#388BFF" direction={-1} />
      )}

      {/* Balizas activas en los pines del chip 74LS83A */}
      <ChipEnergyFlowBeacons />

      {/* Halos de los bornes de la fuente regulada */}
      <PsuEnergyAura />
    </group>
  );
}
