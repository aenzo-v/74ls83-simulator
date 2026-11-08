/**
 * Información académica e institucional oficial de 74LS83 Lab.
 * Fuente de verdad tipada para identidad universitaria, cátedra y equipo de desarrollo.
 */

export interface AcademicTeamMember {
  readonly id: number;
  readonly name: string;
}

export interface UniversityInfo {
  readonly name: string;
  readonly shortName: string;
  readonly motto: string;
  readonly logoUrl: string;
  readonly logoAlt: string;
}

export interface AcademicProjectInfo {
  readonly projectTitle: string;
  readonly shortTitle: string;
  readonly projectSubtitle: string;
  readonly chipModel: string;
  readonly compactReference: string;
  readonly university: UniversityInfo;
  readonly faculty: string;
  readonly career: string;
  readonly course: string;
  readonly instructor: string;
  readonly teamMembers: readonly AcademicTeamMember[];
  readonly location: string;
}

export const ACADEMIC_INFO: AcademicProjectInfo = {
  projectTitle: '74LS83 Lab — Simulador 3D del sumador binario de 4 bits',
  shortTitle: '74LS83 Lab',
  projectSubtitle: 'Simulador 3D del sumador binario de 4 bits',
  chipModel: 'SN74LS83A · DIP-16',
  compactReference: 'Facultad de Ciencias · Ingeniería de Sistemas e Informática',
  university: {
    name: 'Universidad Nacional Santiago Antúnez de Mayolo',
    shortName: 'UNASAM',
    motto: 'Del esfuerzo de sus hijos depende el progreso de los pueblos',
    logoUrl: '/unasam-logo.png',
    logoAlt: 'Escudo oficial de la Universidad Nacional Santiago Antúnez de Mayolo (UNASAM)',
  },
  faculty: 'Facultad de Ciencias',
  career: 'Ingeniería de Sistemas e Informática',
  course: 'Sistemas Digitales',
  instructor: 'MINAYA GONZALEZ JAIME YLIAM',
  teamMembers: [
    { id: 1, name: 'Alexis Enzo Machaca Barrenechea' },
    { id: 2, name: 'Kevin Polo Saavedra' },
    { id: 3, name: 'Jeremy Ramirez Lopez' },
  ],
  location: 'Huaraz, Áncash — Perú',
} as const;
