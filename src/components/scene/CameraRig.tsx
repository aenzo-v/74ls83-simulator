import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { type ComponentRef, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getChipCenterX } from '../../data/circuitLayout';
import { type CameraPreset, useLabStore } from '../../store/useLabStore';

type OrbitControlsHandle = ComponentRef<typeof OrbitControls>;

interface CameraPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

const CHIP_X = getChipCenterX();

const CAMERA_PRESETS: Record<CameraPreset, CameraPose> = {
  'three-quarter': {
    position: [1.8, 10.6, 13.4],
    target: [0, 0.45, 0.15],
  },
  top: {
    position: [0, 17.8, 0.02],
    target: [0, 0.45, 0],
  },
  'chip-closeup': {
    position: [CHIP_X + 0.75, 4.35, 4.85],
    target: [CHIP_X, 0.98, 0.05],
  },
};

export function CameraRig() {
  const controlsRef = useRef<OrbitControlsHandle | null>(null);
  const { camera } = useThree();

  const cameraPreset = useLabStore((s) => s.cameraPreset);
  const cameraRequestVersion = useLabStore((s) => s.cameraRequestVersion);

  const isTransitioningRef = useRef(false);
  const desiredPosRef = useRef(new THREE.Vector3(...CAMERA_PRESETS['three-quarter'].position));
  const desiredTargetRef = useRef(new THREE.Vector3(...CAMERA_PRESETS['three-quarter'].target));
  const lastAppliedVersionRef = useRef(-1);

  useEffect(() => {
    const pose = CAMERA_PRESETS[cameraPreset];
    desiredPosRef.current.set(pose.position[0], pose.position[1], pose.position[2]);
    desiredTargetRef.current.set(pose.target[0], pose.target[1], pose.target[2]);

    if (lastAppliedVersionRef.current === -1) {
      // Primer render: colocar directamente en la vista calibrada 3/4 sin barrido inicial
      camera.position.copy(desiredPosRef.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(desiredTargetRef.current);
        controlsRef.current.update();
      }
      lastAppliedVersionRef.current = cameraRequestVersion;
      return;
    }

    lastAppliedVersionRef.current = cameraRequestVersion;
    isTransitioningRef.current = true;
  }, [camera, cameraPreset, cameraRequestVersion]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    if (isTransitioningRef.current) {
      const alpha = 1 - Math.exp(-7.5 * Math.min(delta, 0.05));
      camera.position.lerp(desiredPosRef.current, alpha);
      controls.target.lerp(desiredTargetRef.current, alpha);
      controls.update();

      const posDist = camera.position.distanceTo(desiredPosRef.current);
      const targetDist = controls.target.distanceTo(desiredTargetRef.current);
      if (posDist < 0.015 && targetDist < 0.015) {
        camera.position.copy(desiredPosRef.current);
        controls.target.copy(desiredTargetRef.current);
        controls.update();
        isTransitioningRef.current = false;
      }
    }
  });

  const handleControlChange = () => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }
    // Mantener el punto de interés acotado al área útil del banco de trabajo
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -9.5, 9.5);
    controls.target.y = THREE.MathUtils.clamp(controls.target.y, -0.2, 2.8);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -5.0, 5.0);
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.75}
      zoomSpeed={0.85}
      panSpeed={0.75}
      minDistance={3.8}
      maxDistance={28}
      minPolarAngle={0.01}
      maxPolarAngle={Math.PI / 2 - 0.06}
      onStart={() => {
        isTransitioningRef.current = false;
      }}
      onChange={handleControlChange}
    />
  );
}
