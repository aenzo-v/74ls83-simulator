import { ContactShadows } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { createWorkbenchMatTexture } from './proceduralTextures';

export function LabEnvironment() {
  const matTexture = useMemo(() => createWorkbenchMatTexture(), []);

  useEffect(() => {
    return () => {
      matTexture.dispose();
    };
  }, [matTexture]);

  return (
    <>
      <color attach="background" args={['#10141B']} />
      <fog attach="fog" args={['#10141B', 30, 62]} />

      {/* Iluminación técnica de estudio: limpia, equilibrada y sin deslumbramiento */}
      <hemisphereLight args={['#E6EEF8', '#1A222D', 0.72]} />

      {/* Luz principal suave desde el frente-izquierda superior */}
      <directionalLight
        position={[9.5, 17.5, 11.5]}
        intensity={1.95}
        color="#FFFDF9"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={2}
        shadow-camera-far={40}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.00035}
        shadow-normalBias={0.018}
      />

      {/* Luz de relleno fría-neutra desde el lado opuesto para leer pines traseros y canal central */}
      <directionalLight position={[-11, 12.5, -9.5]} intensity={0.85} color="#D8E6F6" />

      {/* Luz cenital suave de refuerzo para legibilidad uniforme de perforaciones */}
      <directionalLight position={[0, 19, 1.5]} intensity={0.42} color="#F2F6FC" />

      {/* Superficie de trabajo de laboratorio (tapete técnico antiestático oscuro) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow>
        <planeGeometry args={[84, 84]} />
        <meshStandardMaterial
          map={matTexture}
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>

      {/* Sombra de contacto discreta horneada una sola vez para asentar la protoboard */}
      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.38}
        scale={24}
        blur={1.8}
        far={2.5}
        resolution={512}
        frames={1}
        color="#070A0F"
      />
    </>
  );
}
