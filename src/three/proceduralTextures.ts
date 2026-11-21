import * as THREE from 'three';

export function createFurTexture(
  primaryHex: string,
  anisotropy: number
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, size, size);

  // Subtle directional fur/coat strand strokes for rich tactile PBR surface
  const base = new THREE.Color(primaryHex);
  const lighter = base.clone().offsetHSL(0, 0.04, 0.09).getStyle();
  const darker = base.clone().offsetHSL(0, -0.02, -0.09).getStyle();

  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 6 + rand() * 12;
    const angle = -Math.PI / 2 + (rand() - 0.5) * 0.45;
    ctx.strokeStyle = rand() > 0.5 ? lighter : darker;
    ctx.globalAlpha = 0.22 + rand() * 0.22;
    ctx.lineWidth = 1 + rand() * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = anisotropy;
  return tex;
}

export function createIrisTexture(
  irisHex: string,
  anisotropy: number
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // White sclera base
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Iris occupies the center disk facing +Z when mapped nicely onto sphere UV (center at u=0.5, v=0.5)
  const irisRadius = size * 0.24;

  // Subtle sclera ambient tint
  const scleraGrad = ctx.createRadialGradient(cx, cy, irisRadius * 0.9, cx, cy, size * 0.5);
  scleraGrad.addColorStop(0, '#FFFFFF');
  scleraGrad.addColorStop(0.7, '#F1F5F9');
  scleraGrad.addColorStop(1, '#CBD5E1');
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(0, 0, size, size);

  // Outer limbal ring
  ctx.beginPath();
  ctx.arc(cx, cy, irisRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#1E1B18';
  ctx.fill();

  // Warm/rich iris radial gradient
  const irisCol = new THREE.Color(irisHex);
  const brightIris = irisCol.clone().offsetHSL(0.02, 0.1, 0.18).getStyle();
  const deepIris = irisCol.clone().offsetHSL(-0.02, 0.05, -0.15).getStyle();

  const irisGrad = ctx.createRadialGradient(cx, cy, irisRadius * 0.2, cx, cy, irisRadius * 0.92);
  irisGrad.addColorStop(0, brightIris);
  irisGrad.addColorStop(0.65, irisHex);
  irisGrad.addColorStop(1, deepIris);
  ctx.beginPath();
  ctx.arc(cx, cy, irisRadius * 0.92, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();

  // Radial iris fibers
  ctx.strokeStyle = brightIris;
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * irisRadius * 0.35, cy + Math.sin(a) * irisRadius * 0.35);
    ctx.lineTo(cx + Math.cos(a) * irisRadius * 0.85, cy + Math.sin(a) * irisRadius * 0.85);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Crisp black pupil
  ctx.beginPath();
  ctx.arc(cx, cy, irisRadius * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = '#09090B';
  ctx.fill();

  // Primary & secondary studio catchlights
  ctx.beginPath();
  ctx.arc(cx - irisRadius * 0.28, cy - irisRadius * 0.28, irisRadius * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx + irisRadius * 0.22, cy + irisRadius * 0.22, irisRadius * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 8, cx, cx, cx);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.24)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTurntableTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#182028';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Radial brushed studio disc
  const discGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 240);
  discGrad.addColorStop(0, '#232F3B');
  discGrad.addColorStop(0.75, '#19222B');
  discGrad.addColorStop(1, '#11171D');
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 244, 0, Math.PI * 2);
  ctx.fill();

  // Concentric technical tick rings
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 1.5;
  [120, 175, 224].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Degree hash marks around perimeter
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const isMajor = i % 6 === 0;
    const r1 = isMajor ? 208 : 216;
    const r2 = 224;
    ctx.strokeStyle = isMajor ? 'rgba(249, 115, 22, 0.55)' : 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export function createCastleStoneTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Cool-warm medieval limestone mortar base
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, size, size);

  let seed = 109;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const rows = 8;
  const rowH = size / rows;
  const cols = 4;
  const colW = size / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const bx = c * colW + offset;
      const by = r * rowH;
      const shade = 102 + Math.floor((rand() - 0.5) * 22);
      const warm = Math.floor(rand() * 8);
      ctx.fillStyle = `rgb(${shade + warm}, ${shade + 4}, ${shade + 12})`;
      ctx.fillRect(bx + 3, by + 3, colW - 6, rowH - 6);

      // Top highlight bevel on each ashlar block
      ctx.fillStyle = 'rgba(226, 232, 240, 0.14)';
      ctx.fillRect(bx + 3, by + 3, colW - 6, 4);

      // Subtle weathering speckles
      for (let s = 0; s < 6; s++) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(30, 41, 59, 0.16)' : 'rgba(203, 213, 225, 0.1)';
        ctx.fillRect(
          bx + 6 + rand() * (colW - 14),
          by + 6 + rand() * (rowH - 14),
          4 + rand() * 8,
          3 + rand() * 5
        );
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = anisotropy;
  return tex;
}

export function createCourtyardTileTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 0, size, size);

  let seed = 73;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const grid = 6;
  const step = size / grid;
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const v = 54 + Math.floor((rand() - 0.5) * 16);
      ctx.fillStyle = `rgb(${v}, ${v + 8}, ${v + 18})`;
      ctx.fillRect(x * step + 3, y * step + 3, step - 6, step - 6);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * step + 4, y * step + 4, step - 8, step - 8);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.anisotropy = anisotropy;
  return tex;
}

