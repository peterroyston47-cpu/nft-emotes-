import * as THREE from 'three';

const _tileColor = new THREE.Color();
const _eqMatrix = new THREE.Matrix4();
const _eqPos = new THREE.Vector3();
const _eqScale = new THREE.Vector3();
const _eqQuat = new THREE.Quaternion();

const DISCO_PALETTE = [
  '#EC4899', // electric pink
  '#06B6D4', // neon cyan
  '#8B5CF6', // ultraviolet
  '#FACC15', // gold strobe
  '#3B82F6', // club blue
  '#10B981', // laser emerald
].map((hex) => new THREE.Color(hex));

/**
 * Procedural 3D Nightclub & Disco Stage Backdrop:
 * Spinning mirror disco ball, illuminated neon checkerboard floor,
 * sweeping volumetric light beams, animated EQ wall, and bass speaker stacks.
 */
export class DiscoClubBackdrop {
  public readonly group = new THREE.Group();

  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly discoBallGroup = new THREE.Group();
  private readonly beams: THREE.Mesh[] = [];
  private readonly speakers: THREE.Mesh[] = [];
  private readonly floorTiles: THREE.InstancedMesh;
  private readonly tileCount: number;
  private readonly eqBars: THREE.InstancedMesh;
  private readonly eqCount = 24;
  private readonly ringMat: THREE.MeshStandardMaterial;
  private readonly neonArchMat: THREE.MeshStandardMaterial;
  private readonly lightPink: THREE.PointLight;
  private readonly lightCyan: THREE.PointLight;

  constructor() {
    const darkFloorMat = new THREE.MeshStandardMaterial({
      color: 0x070610,
      roughness: 0.35,
      metalness: 0.6,
    });
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.34,
      metalness: 0.85,
    });
    const mirrorBallMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.06,
      metalness: 0.98,
      flatShading: true,
    });
    this.ringMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xec4899,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    this.neonArchMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.7,
      roughness: 0.2,
    });
    const speakerCabMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.78,
      metalness: 0.15,
    });
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.52,
      metalness: 0.35,
    });

    this.disposables.push(
      darkFloorMat,
      trussMat,
      mirrorBallMat,
      this.ringMat,
      this.neonArchMat,
      speakerCabMat,
      coneMat
    );

    // 1. Glossy Dark Club Dance Floor & Neon Turntable Halo
    const floorGeo = new THREE.CircleGeometry(19, 48);
    const floor = new THREE.Mesh(floorGeo, darkFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.025;
    floor.receiveShadow = true;
    this.group.add(floor);

    const haloGeo = new THREE.TorusGeometry(1.72, 0.04, 10, 48);
    const halo = new THREE.Mesh(haloGeo, this.ringMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -0.005;
    const outerHaloGeo = new THREE.TorusGeometry(1.94, 0.026, 8, 48);
    const outerHalo = new THREE.Mesh(outerHaloGeo, this.neonArchMat);
    outerHalo.rotation.x = Math.PI / 2;
    outerHalo.position.y = -0.008;
    this.group.add(halo, outerHalo);
    this.disposables.push(floorGeo, haloGeo, outerHaloGeo);

    // 2. Illuminated Neon Disco Checkerboard Tiles (InstancedMesh around & behind stage)
    const gridN = 8;
    const spacing = 1.48;
    const tileGeo = new THREE.BoxGeometry(1.32, 0.018, 1.32);
    const tileMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.72,
      roughness: 0.22,
      metalness: 0.2,
    });
    const coords: Array<[number, number]> = [];
    for (let gx = -gridN / 2; gx < gridN / 2; gx++) {
      for (let gz = -gridN; gz <= 2; gz++) {
        const x = (gx + 0.5) * spacing;
        const z = (gz + 0.5) * spacing;
        // Skip underneath studio turntable
        if (Math.hypot(x, z) < 2.2) continue;
        coords.push([x, z]);
      }
    }
    this.tileCount = coords.length;
    this.floorTiles = new THREE.InstancedMesh(tileGeo, tileMat, this.tileCount);
    coords.forEach(([x, z], idx) => {
      _eqPos.set(x, -0.016, z);
      _eqScale.set(1, 1, 1);
      _eqMatrix.compose(_eqPos, _eqQuat, _eqScale);
      this.floorTiles.setMatrixAt(idx, _eqMatrix);
      this.floorTiles.setColorAt(idx, DISCO_PALETTE[idx % DISCO_PALETTE.length]);
    });
    this.floorTiles.instanceMatrix.needsUpdate = true;
    if (this.floorTiles.instanceColor) this.floorTiles.instanceColor.needsUpdate = true;
    this.floorTiles.computeBoundingSphere();
    this.group.add(this.floorTiles);
    this.disposables.push(tileGeo, tileMat);

    // 3. Overhead Club Lighting Truss Arch & Spinning Mirror Disco Ball
    const pillarGeo = new THREE.CylinderGeometry(0.14, 0.16, 5.2, 8);
    const topBarGeo = new THREE.BoxGeometry(9.6, 0.24, 0.24);
    const backStageWallGeo = new THREE.BoxGeometry(9.2, 4.4, 0.35);
    const archRingGeo = new THREE.TorusGeometry(2.15, 0.08, 12, 40, Math.PI);
    this.disposables.push(pillarGeo, topBarGeo, backStageWallGeo, archRingGeo);

    [-4.6, 4.6].forEach((px) => {
      const p = new THREE.Mesh(pillarGeo, trussMat);
      p.position.set(px, 2.58, -5.8);
      this.group.add(p);
    });
    const topBar = new THREE.Mesh(topBarGeo, trussMat);
    topBar.position.set(0, 5.15, -5.8);
    const backWall = new THREE.Mesh(backStageWallGeo, speakerCabMat);
    backWall.position.set(0, 2.18, -7.8);
    const djHalo = new THREE.Mesh(archRingGeo, this.neonArchMat);
    djHalo.position.set(0, 1.35, -7.56);
    this.group.add(topBar, backWall, djHalo);

    // Animated Neon Equalizer Bars across the DJ stage wall
    const eqBarGeo = new THREE.BoxGeometry(0.24, 1.0, 0.14);
    const eqBarMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    this.eqBars = new THREE.InstancedMesh(eqBarGeo, eqBarMat, this.eqCount);
    for (let i = 0; i < this.eqCount; i++) {
      const ex = (i - (this.eqCount - 1) / 2) * 0.34;
      _eqPos.set(ex, 0.7, -7.55);
      _eqScale.set(1, 1, 1);
      _eqMatrix.compose(_eqPos, _eqQuat, _eqScale);
      this.eqBars.setMatrixAt(i, _eqMatrix);
      this.eqBars.setColorAt(i, DISCO_PALETTE[i % DISCO_PALETTE.length]);
    }
    this.eqBars.instanceMatrix.needsUpdate = true;
    if (this.eqBars.instanceColor) this.eqBars.instanceColor.needsUpdate = true;
    this.eqBars.computeBoundingSphere();
    this.group.add(this.eqBars);
    this.disposables.push(eqBarGeo, eqBarMat);

    // Spinning Faceted Mirror Disco Ball overhead behind stage
    this.discoBallGroup.position.set(0, 3.65, -2.05);
    const rodGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8);
    const rod = new THREE.Mesh(rodGeo, trussMat);
    rod.position.y = 1.1;
    const ballGeo = new THREE.IcosahedronGeometry(0.58, 2);
    const ball = new THREE.Mesh(ballGeo, mirrorBallMat);
    const collarGeo = new THREE.TorusGeometry(0.64, 0.02, 8, 24);
    const collar = new THREE.Mesh(collarGeo, this.ringMat);
    collar.rotation.x = Math.PI / 2;
    this.discoBallGroup.add(rod, ball, collar);
    this.group.add(this.discoBallGroup);
    this.disposables.push(rodGeo, ballGeo, collarGeo);

    // 4. Sweeping Volumetric Disco Spotlight Beams
    const beamGeo = new THREE.ConeGeometry(1.45, 7.2, 18, 1, true);
    beamGeo.translate(0, -3.6, 0); // Pivot at top apex!
    const beamColors = [0xec4899, 0x06b6d4, 0xa855f7, 0xfacc15, 0x38bdf8, 0xf43f5e];
    this.disposables.push(beamGeo);

    beamColors.forEach((col, i) => {
      const beamMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.push(beamMat);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      const spreadX = (i - (beamColors.length - 1) / 2) * 1.45;
      beam.position.set(spreadX, 5.1, -5.65);
      beam.rotation.x = -0.32;
      this.beams.push(beam);
      this.group.add(beam);
    });

    // 5. Twin Club Bass Speaker Stacks flanking the DJ booth
    const cabGeo = new THREE.BoxGeometry(1.25, 2.2, 1.0);
    const wooferGeo = new THREE.CylinderGeometry(0.38, 0.34, 0.12, 18);
    const wooferRimGeo = new THREE.TorusGeometry(0.39, 0.035, 8, 24);
    this.disposables.push(cabGeo, wooferGeo, wooferRimGeo);

    [-3.3, 3.3].forEach((sx, idx) => {
      const stack = new THREE.Group();
      stack.position.set(sx, 1.08, -4.6);
      stack.rotation.y = idx === 0 ? 0.38 : -0.38;

      const cab = new THREE.Mesh(cabGeo, speakerCabMat);
      stack.add(cab);

      [-0.48, 0.48].forEach((wy) => {
        const cone = new THREE.Mesh(wooferGeo, coneMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.set(0, wy, 0.48);
        const rim = new THREE.Mesh(wooferRimGeo, idx === 0 ? this.ringMat : this.neonArchMat);
        rim.position.set(0, wy, 0.51);
        stack.add(cone, rim);
        this.speakers.push(cone);
      });

      this.group.add(stack);
    });

    // 6. Dynamic Magenta & Cyan Club Lights illuminating the dancer
    this.lightPink = new THREE.PointLight(0xec4899, 6.0, 12, 1.5);
    this.lightPink.position.set(-2.4, 2.6, 1.2);
    this.lightCyan = new THREE.PointLight(0x06b6d4, 6.0, 12, 1.5);
    this.lightCyan.position.set(2.4, 2.6, 1.2);
    this.group.add(this.lightPink, this.lightCyan);
  }

  public update(elapsed: number, playing: boolean): void {
    const t = playing ? elapsed : 0;
    const beat = Math.abs(Math.sin(t * 5.2));

    // Spin faceted disco mirror ball
    this.discoBallGroup.rotation.y = t * 1.15;

    // Pulse neon rings
    this.ringMat.emissiveIntensity = 1.3 + beat * 1.1;
    this.neonArchMat.emissiveIntensity = 1.2 + (1 - beat) * 1.0;

    // Sweep volumetric disco beams across the club
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      b.rotation.z = Math.sin(t * 1.8 + i * 1.05) * 0.42;
      b.rotation.x = -0.3 + Math.cos(t * 1.4 + i * 0.7) * 0.16;
    }

    // Pump bass woofer cones on the beat
    for (let i = 0; i < this.speakers.length; i++) {
      const pulse = 1 + Math.pow(beat, 2) * 0.14;
      this.speakers[i].scale.set(pulse, 1, pulse);
    }

    // Animate 24 vertical EQ bars on back DJ wall
    for (let i = 0; i < this.eqCount; i++) {
      const wave =
        0.45 +
        Math.abs(Math.sin(t * 6.5 + i * 0.55)) * 1.65 +
        Math.abs(Math.cos(t * 3.8 - i * 0.35)) * 0.85;
      const ex = (i - (this.eqCount - 1) / 2) * 0.34;
      _eqPos.set(ex, 0.25 + wave * 0.5, -7.55);
      _eqScale.set(1, wave, 1);
      _eqMatrix.compose(_eqPos, _eqQuat, _eqScale);
      this.eqBars.setMatrixAt(i, _eqMatrix);
    }
    this.eqBars.instanceMatrix.needsUpdate = true;

    // Cycle neon dance floor checkerboard tile colors on the beat
    const phaseStep = Math.floor(t * 2.2);
    for (let i = 0; i < this.tileCount; i++) {
      const cIdx = (i + phaseStep) % DISCO_PALETTE.length;
      _tileColor.copy(DISCO_PALETTE[cIdx]).multiplyScalar(0.55 + beat * 0.55);
      this.floorTiles.setColorAt(i, _tileColor);
    }
    if (this.floorTiles.instanceColor) {
      this.floorTiles.instanceColor.needsUpdate = true;
    }

    // Orbit colored club point lights
    this.lightPink.position.x = Math.cos(t * 1.4) * 2.6;
    this.lightPink.position.z = Math.sin(t * 1.4) * 2.2;
    this.lightPink.intensity = 4.5 + beat * 3.5;

    this.lightCyan.position.x = Math.cos(t * 1.4 + Math.PI) * 2.6;
    this.lightCyan.position.z = Math.sin(t * 1.4 + Math.PI) * 2.2;
    this.lightCyan.intensity = 4.5 + (1 - beat) * 3.5;
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
