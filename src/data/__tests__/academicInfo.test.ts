import { describe, expect, it } from 'vitest';
import { ACADEMIC_INFO } from '../academicInfo';

describe('Identidad Académica Oficial — 74LS83 Lab (UNASAM)', () => {
  it('contiene los datos institucionales exactos requeridos por la universidad y cátedra', () => {
    // 1. Título del proyecto
    expect(ACADEMIC_INFO.projectTitle).toBe(
      '74LS83 Lab — Simulador 3D del sumador binario de 4 bits',
    );
    expect(ACADEMIC_INFO.shortTitle).toBe('74LS83 Lab');
    expect(ACADEMIC_INFO.projectSubtitle).toBe(
      'Simulador 3D del sumador binario de 4 bits',
    );

    // 2. Universidad
    expect(ACADEMIC_INFO.university.shortName).toBe('UNASAM');
    expect(ACADEMIC_INFO.university.name).toBe(
      'Universidad Nacional Santiago Antúnez de Mayolo',
    );
    expect(ACADEMIC_INFO.university.logoUrl).toBe('/unasam-logo.png');

    // 3. Facultad y Carrera profesional
    expect(ACADEMIC_INFO.faculty).toBe('Facultad de Ciencias');
    expect(ACADEMIC_INFO.career).toBe('Ingeniería de Sistemas e Informática');
    expect(ACADEMIC_INFO.compactReference).toBe(
      'Facultad de Ciencias · Ingeniería de Sistemas e Informática',
    );

    // 4. Asignatura / Curso
    expect(ACADEMIC_INFO.course).toBe('Sistemas Digitales');

    // 5. Docente titular
    expect(ACADEMIC_INFO.instructor).toBe('MINAYA GONZALEZ JAIME YLIAM');

    // 6. Integrantes del equipo (exactamente 3 alumnos con nombres completos)
    expect(ACADEMIC_INFO.teamMembers).toHaveLength(3);
    expect(ACADEMIC_INFO.teamMembers[0]).toEqual({
      id: 1,
      name: 'Alexis Enzo Machaca Barrenechea',
    });
    expect(ACADEMIC_INFO.teamMembers[1]).toEqual({
      id: 2,
      name: 'Kevin Polo Saavedra',
    });
    expect(ACADEMIC_INFO.teamMembers[2]).toEqual({
      id: 3,
      name: 'Jeremy Ramirez Lopez',
    });
  });

  it('el recurso del logotipo oficial es una ruta estática local sin dependencias externas', () => {
    expect(ACADEMIC_INFO.university.logoUrl.startsWith('/')).toBe(true);
    expect(ACADEMIC_INFO.university.logoUrl.endsWith('.png')).toBe(true);
    expect(ACADEMIC_INFO.university.logoUrl).not.toContain('http://');
    expect(ACADEMIC_INFO.university.logoUrl).not.toContain('https://');
  });
});
