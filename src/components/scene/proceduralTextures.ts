import * as THREE from 'three';
import {
  BREADBOARD_DIMENSIONS,
  COLUMN_COUNT,
  columnToX,
  LOWER_TERMINAL_ROWS,
  POWER_RAIL_COLUMNS,
  railToZ,
  rowToZ,
  UPPER_TERMINAL_ROWS,
} from '../../simulator/breadboard';
import type { TerminalRow } from '../../simulator/types';

function configureTexture(texture: THREE.CanvasTexture, repeat = false): THREE.CanvasTexture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  } else {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  texture.needsUpdate = true;
  return texture;
}

/**
 * Textura sutil de tapete antiestático (ESD) de banco de laboratorio electrónico.
 */
export function createWorkbenchMatTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // Base grafito neutro de estudio técnico
  ctx.fillStyle = '#181E27';
  ctx.fillRect(0, 0, size, size);

  // Micro-grano muy sutil para romper la apariencia plástica plana
  ctx.fillStyle = 'rgba(255, 255, 255, 0.012)';
  for (let i = 0; i < 2400; i += 1) {
    const x = (i * 173) % size;
    const y = (i * 293) % size;
    ctx.fillRect(x, y, 2, 2);
  }

  // Retícula técnica discreta (subdivisiones finas y ejes mayores)
  const minorStep = size / 16;
  ctx.strokeStyle = 'rgba(174, 184, 197, 0.032)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let p = 0; p <= size; p += minorStep) {
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
  }
  ctx.stroke();

  const majorStep = size / 4;
  ctx.strokeStyle = 'rgba(174, 184, 197, 0.068)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let p = 0; p <= size; p += majorStep) {
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
  }
  ctx.stroke();

  // Cruces de calibración sutiles en intersecciones mayores
  ctx.strokeStyle = 'rgba(53, 194, 209, 0.08)';
  ctx.lineWidth = 1.5;
  for (let x = majorStep; x < size; x += majorStep) {
    for (let y = majorStep; y < size; y += majorStep) {
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x, y + 6);
      ctx.stroke();
    }
  }

  const tex = configureTexture(new THREE.CanvasTexture(canvas), true);
  tex.repeat.set(4, 4);
  return tex;
}

/**
 * Serigrafía de un riel de alimentación (líneas roja + y azul − con símbolos).
 */
export function createPowerRailSilkscreenTexture(
  zMin: number,
  zMax: number,
  plusRailId: 'top-plus' | 'bottom-plus',
  minusRailId: 'top-minus' | 'bottom-minus',
): THREE.CanvasTexture {
  const texW = 2048;
  const texH = 256;
  const canvas = document.createElement('canvas');
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.clearRect(0, 0, texW, texH);

  const lengthX = BREADBOARD_DIMENSIONS.lengthX;
  const toPx = (worldX: number) => ((worldX + lengthX * 0.5) / lengthX) * texW;
  const toPy = (worldZ: number) => ((worldZ - zMin) / (zMax - zMin)) * texH;

  const firstRailX = columnToX(POWER_RAIL_COLUMNS[0] ?? 3);
  const lastRailX = columnToX(POWER_RAIL_COLUMNS[POWER_RAIL_COLUMNS.length - 1] ?? 61);

  const zPlus = railToZ(plusRailId);
  const zMinus = railToZ(minusRailId);

  // Desplazar las líneas pintadas hacia los bordes exteriores de los agujeros del riel
  const plusLineZ = plusRailId === 'top-plus' ? zPlus - 0.135 : zPlus - 0.135;
  const minusLineZ = minusRailId === 'top-minus' ? zMinus + 0.135 : zMinus + 0.135;

  const xLineStart = toPx(firstRailX - 0.16);
  const xLineEnd = toPx(lastRailX + 0.16);

  // Línea roja (+)
  ctx.strokeStyle = '#C53A3A';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(xLineStart, toPy(plusLineZ));
  ctx.lineTo(xLineEnd, toPy(plusLineZ));
  ctx.stroke();

  // Línea azul (−)
  ctx.strokeStyle = '#2A69AC';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(xLineStart, toPy(minusLineZ));
  ctx.lineTo(xLineEnd, toPy(minusLineZ));
  ctx.stroke();

  // Símbolos + y − en ambos extremos
  ctx.font = '700 34px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const leftSymbolX = toPx(columnToX(1) - 0.08);
  const rightSymbolX = toPx(columnToX(COLUMN_COUNT) + 0.08);

  ctx.fillStyle = '#C53A3A';
  ctx.fillText('+', leftSymbolX, toPy(zPlus));
  ctx.fillText('+', rightSymbolX, toPy(zPlus));

  ctx.fillStyle = '#2A69AC';
  ctx.fillText('−', leftSymbolX, toPy(zMinus));
  ctx.fillText('−', rightSymbolX, toPy(zMinus));

  return configureTexture(new THREE.CanvasTexture(canvas), false);
}

/**
 * Serigrafía de numeración de columnas (1, 5, 10..60) y letras de fila (a..e o f..j)
 * para cada bloque principal de terminales de la protoboard.
 */
export function createTerminalBankSilkscreenTexture(
  zMin: number,
  zMax: number,
  bank: 'upper' | 'lower',
): THREE.CanvasTexture {
  const texW = 2048;
  const texH = 384;
  const canvas = document.createElement('canvas');
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.clearRect(0, 0, texW, texH);

  const lengthX = BREADBOARD_DIMENSIONS.lengthX;
  const toPx = (worldX: number) => ((worldX + lengthX * 0.5) / lengthX) * texW;
  const toPy = (worldZ: number) => ((worldZ - zMin) / (zMax - zMin)) * texH;

  const rows: readonly TerminalRow[] = bank === 'upper' ? UPPER_TERMINAL_ROWS : LOWER_TERMINAL_ROWS;

  // Letras de fila en los márgenes izquierdo y derecho
  ctx.fillStyle = '#4A5568';
  ctx.font = '700 24px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const leftMarginX = toPx(columnToX(1) - 0.24);
  const rightMarginX = toPx(columnToX(COLUMN_COUNT) + 0.24);

  for (const row of rows) {
    const py = toPy(rowToZ(row));
    ctx.fillText(row, leftMarginX, py);
    ctx.fillText(row, rightMarginX, py);
  }

  // Numeración de columnas (1 y múltiplos de 5) junto al borde exterior del banco
  const numberWorldZ = bank === 'upper' ? rowToZ('a') - 0.145 : rowToZ('j') + 0.145;
  const numberPy = toPy(numberWorldZ);

  ctx.fillStyle = '#526071';
  ctx.font = '600 19px "JetBrains Mono", monospace';

  for (let col = 1; col <= COLUMN_COUNT; col += 1) {
    if (col === 1 || col % 5 === 0) {
      ctx.fillText(String(col), toPx(columnToX(col)), numberPy);
    }
  }

  return configureTexture(new THREE.CanvasTexture(canvas), false);
}

/**
 * Serigrafía superior láser/tinta técnica del encapsulado DIP-16 del SN74LS83A.
 */
export function createChip74LS83SilkscreenTexture(): THREE.CanvasTexture {
  const texW = 1024;
  const texH = 384;
  const canvas = document.createElement('canvas');
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.clearRect(0, 0, texW, texH);

  // Marco sutil de moldeado superior del encapsulado epóxico
  ctx.strokeStyle = 'rgba(216, 224, 234, 0.12)';
  ctx.lineWidth = 4;
  ctx.strokeRect(22, 22, texW - 44, texH - 44);

  // Marca circular grabada junto al Pin 1 (abajo a la izquierda cuando muesca está a la izquierda)
  ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
  ctx.beginPath();
  ctx.arc(92, texH - 68, 16, 0, Math.PI * 2);
  ctx.fill();

  // Indicador textual discreto "1" junto al punto del Pin 1
  ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
  ctx.font = '700 28px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', 120, texH - 68);

  // Serie / familia superior
  ctx.fillStyle = 'rgba(196, 206, 218, 0.68)';
  ctx.font = '600 32px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SN74LS83AN', 156, 98);

  // Código lote estilo industrial
  ctx.textAlign = 'right';
  ctx.font = '500 26px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(174, 184, 197, 0.52)';
  ctx.fillText('DIP-16', texW - 58, 98);

  // Identificador protagonista claramente legible a distancia media
  ctx.textAlign = 'center';
  ctx.fillStyle = '#DCE3EC';
  ctx.font = '700 84px "JetBrains Mono", monospace';
  ctx.fillText('74LS83A', texW * 0.53, texH * 0.54);

  // Subtítulo técnico discreto
  ctx.fillStyle = 'rgba(186, 198, 212, 0.62)';
  ctx.font = '600 26px Inter, system-ui, sans-serif';
  ctx.fillText('4-BIT BINARY FULL ADDER', texW * 0.53, texH - 66);

  return configureTexture(new THREE.CanvasTexture(canvas), false);
}

/**
 * Serigrafía superior de un módulo interruptor DIP (indicador ON y etiquetas de canales).
 */
export function createDipSwitchSilkscreenTexture(
  signals: readonly string[],
): THREE.CanvasTexture {
  const count = Math.max(1, signals.length);
  const texW = count * 192;
  const texH = 384;
  const canvas = document.createElement('canvas');
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  ctx.clearRect(0, 0, texW, texH);

  // Marca superior ON ↑
  ctx.fillStyle = 'rgba(241, 245, 249, 0.92)';
  ctx.font = '700 30px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('ON', 16, 42);

  // Etiquetas de señal en el margen inferior de cada canal
  const slotW = texW / count;
  ctx.textAlign = 'center';
  ctx.font = '700 34px "JetBrains Mono", monospace';
  signals.forEach((sig, i) => {
    const cx = slotW * (i + 0.5);
    ctx.fillStyle = 'rgba(241, 245, 249, 0.95)';
    ctx.fillText(sig, cx, texH - 44);
  });

  return configureTexture(new THREE.CanvasTexture(canvas), false);
}

/**
 * Carátula técnica superior para el módulo de fuente regulada de +5.0 V CC.
 */
export function createPowerSupplyFaceplateTexture(isActive: boolean): THREE.CanvasTexture {
  const texW = 768;
  const texH = 384;
  const canvas = document.createElement('canvas');
  canvas.width = texW;
  canvas.height = texH;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // Fondo panel técnico anodizado
  ctx.fillStyle = '#161D27';
  ctx.fillRect(0, 0, texW, texH);

  ctx.strokeStyle = '#334258';
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, texW - 28, texH - 28);

  // Cabecera
  ctx.fillStyle = '#AEB8C5';
  ctx.font = '700 26px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('DC REGULATED SUPPLY', 38, 58);

  // Ventana de lectura digital discreta
  ctx.fillStyle = '#0D1219';
  ctx.fillRect(38, 96, 290, 110);
  ctx.strokeStyle = '#283548';
  ctx.lineWidth = 3;
  ctx.strokeRect(38, 96, 290, 110);

  ctx.fillStyle = isActive ? '#6DD19C' : '#5E6B7C';
  ctx.font = '700 56px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(isActive ? '5.00 V' : 'STBY', 183, 152);

  // Leyendas de bornes (+5V y GND) en la franja frontal inferior
  ctx.font = '700 34px "JetBrains Mono", monospace';
  ctx.fillStyle = '#EF6B6B';
  ctx.fillText('+5V', 208, texH - 54);

  ctx.fillStyle = '#6FA8EE';
  ctx.fillText('GND', texW - 208, texH - 54);

  return configureTexture(new THREE.CanvasTexture(canvas), false);
}
