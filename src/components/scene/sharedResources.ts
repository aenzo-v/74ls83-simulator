import * as THREE from 'three';
import type { ResistorBandColor } from '../../simulator/components';

/**
 * Geometrías y materiales compartidos para optimizar memoria WebGL y compilación de shaders.
 * Estos recursos estáticos viven durante toda la sesión del laboratorio.
 */

export const SHARED_MATERIALS = {
  tinnedLead: new THREE.MeshStandardMaterial({
    color: '#C8D1DC',
    metalness: 0.84,
    roughness: 0.25,
  }),
  selectedHighlight: new THREE.MeshStandardMaterial({
    color: '#F1B85A',
    metalness: 0.3,
    roughness: 0.32,
  }),
  hoveredHighlight: new THREE.MeshStandardMaterial({
    color: '#35C2D1',
    metalness: 0.3,
    roughness: 0.32,
  }),
  removalHoverHighlight: new THREE.MeshStandardMaterial({
    color: '#F06A6A',
    emissive: '#7A2020',
    emissiveIntensity: 0.28,
    metalness: 0.28,
    roughness: 0.34,
  }),
  tracedLeadHighlight: new THREE.MeshStandardMaterial({
    color: '#35C2D1',
    emissive: '#176670',
    emissiveIntensity: 0.32,
    metalness: 0.35,
    roughness: 0.3,
  }),
  resistorCeramicBody: new THREE.MeshStandardMaterial({
    color: '#DFC79A',
    roughness: 0.62,
    metalness: 0.03,
  }),
  dipSwitchHousing: new THREE.MeshStandardMaterial({
    color: '#1D4D88',
    roughness: 0.54,
    metalness: 0.06,
  }),
  dipSwitchHousingSelected: new THREE.MeshStandardMaterial({
    color: '#255EA4',
    roughness: 0.5,
    metalness: 0.08,
  }),
  dipSwitchWell: new THREE.MeshStandardMaterial({
    color: '#10151E',
    roughness: 0.85,
    metalness: 0.04,
  }),
  dipSwitchActuator: new THREE.MeshStandardMaterial({
    color: '#F2F5F9',
    roughness: 0.38,
    metalness: 0.04,
  }),
  dipSwitchActuatorOnCue: new THREE.MeshStandardMaterial({
    color: '#6DD19C',
    roughness: 0.42,
    metalness: 0.08,
  }),
  wireBootDark: new THREE.MeshStandardMaterial({
    color: '#1E2530',
    roughness: 0.68,
    metalness: 0.06,
  }),
  wireBootDimmed: new THREE.MeshStandardMaterial({
    color: '#1E2530',
    transparent: true,
    opacity: 0.26,
    roughness: 0.78,
    metalness: 0.04,
  }),
  internalElectrode: new THREE.MeshStandardMaterial({
    color: '#7E8A98',
    metalness: 0.85,
    roughness: 0.3,
  }),
  psuChassis: new THREE.MeshStandardMaterial({
    color: '#1E2633',
    roughness: 0.48,
    metalness: 0.35,
  }),
  psuTrim: new THREE.MeshStandardMaterial({
    color: '#2B3648',
    roughness: 0.42,
    metalness: 0.45,
  }),
  psuPostRed: new THREE.MeshStandardMaterial({
    color: '#CC3B3B',
    roughness: 0.4,
    metalness: 0.1,
  }),
  psuPostBlue: new THREE.MeshStandardMaterial({
    color: '#2B67B0',
    roughness: 0.4,
    metalness: 0.1,
  }),
  rubberFoot: new THREE.MeshStandardMaterial({
    color: '#0E1218',
    roughness: 0.92,
    metalness: 0.02,
  }),
} as const;

export const RESISTOR_BAND_MATERIALS: Record<ResistorBandColor, THREE.MeshStandardMaterial> = {
  BLACK: new THREE.MeshStandardMaterial({ color: '#16191F', roughness: 0.5 }),
  BROWN: new THREE.MeshStandardMaterial({ color: '#6E3B1E', roughness: 0.48 }),
  RED: new THREE.MeshStandardMaterial({ color: '#C63131', roughness: 0.45 }),
  ORANGE: new THREE.MeshStandardMaterial({ color: '#E36F1E', roughness: 0.45 }),
  YELLOW: new THREE.MeshStandardMaterial({ color: '#E5BE2E', roughness: 0.44 }),
  GREEN: new THREE.MeshStandardMaterial({ color: '#2E8B57', roughness: 0.45 }),
  BLUE: new THREE.MeshStandardMaterial({ color: '#2B6CB0', roughness: 0.45 }),
  VIOLET: new THREE.MeshStandardMaterial({ color: '#7B46B8', roughness: 0.46 }),
  GRAY: new THREE.MeshStandardMaterial({ color: '#7A8490', roughness: 0.48 }),
  WHITE: new THREE.MeshStandardMaterial({ color: '#EEF2F6', roughness: 0.42 }),
  GOLD: new THREE.MeshStandardMaterial({
    color: '#CFA134',
    metalness: 0.72,
    roughness: 0.28,
  }),
};

const WIRE_MATERIAL_CACHE = new Map<string, THREE.MeshStandardMaterial>();
const WIRE_TRACED_MATERIAL_CACHE = new Map<string, THREE.MeshStandardMaterial>();
const WIRE_DIMMED_MATERIAL_CACHE = new Map<string, THREE.MeshStandardMaterial>();

export function getWireInsulationMaterial(colorHex: string): THREE.MeshStandardMaterial {
  let mat = WIRE_MATERIAL_CACHE.get(colorHex);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.44,
      metalness: 0.04,
    });
    WIRE_MATERIAL_CACHE.set(colorHex, mat);
  }
  return mat;
}

export function getTracedWireInsulationMaterial(colorHex: string): THREE.MeshStandardMaterial {
  let mat = WIRE_TRACED_MATERIAL_CACHE.get(colorHex);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.32,
      roughness: 0.32,
      metalness: 0.06,
    });
    WIRE_TRACED_MATERIAL_CACHE.set(colorHex, mat);
  }
  return mat;
}

export function getDimmedWireInsulationMaterial(colorHex: string): THREE.MeshStandardMaterial {
  let mat = WIRE_DIMMED_MATERIAL_CACHE.get(colorHex);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.22,
      roughness: 0.74,
      metalness: 0.02,
    });
    WIRE_DIMMED_MATERIAL_CACHE.set(colorHex, mat);
  }
  return mat;
}

/**
 * Crea el reborde basal de un LED de 5 mm con el corte plano físico de polaridad en el lado +X (cátodo).
 */
function buildLedFlangeGeometry(): THREE.BufferGeometry {
  const radius = 0.245;
  const flatX = 0.195;
  const theta = Math.acos(flatX / radius);

  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, theta, Math.PI * 2 - theta, false);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.075,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geom.rotateX(-Math.PI / 2);
  return geom;
}

export const SHARED_GEOMETRIES = {
  // Cuerpo axial de resistencia (orientado por defecto a lo largo de Y en Three.js CylinderGeometry)
  resistorShaft: new THREE.CylinderGeometry(0.095, 0.095, 0.36, 18),
  resistorCap: new THREE.SphereGeometry(0.108, 16, 12),
  resistorBand: new THREE.CylinderGeometry(0.0985, 0.0985, 0.038, 18),
  resistorCapBand: new THREE.CylinderGeometry(0.1095, 0.1095, 0.036, 18),

  // Encapsulado LED 5 mm
  ledFlange: buildLedFlangeGeometry(),
  ledBarrel: new THREE.CylinderGeometry(0.215, 0.215, 0.34, 24, 1, true),
  ledDome: new THREE.SphereGeometry(0.215, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5),
  ledAnodePost: new THREE.BoxGeometry(0.032, 0.24, 0.032),
  ledCathodeCup: new THREE.CylinderGeometry(0.075, 0.032, 0.09, 12),

  // Terminales y capuchones de cables jumper
  wireStrippedPin: new THREE.CylinderGeometry(0.028, 0.028, 0.12, 10),
  wireFerruleBoot: new THREE.CylinderGeometry(0.076, 0.082, 0.15, 14),
} as const;
