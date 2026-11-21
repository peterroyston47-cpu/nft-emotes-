import * as THREE from 'three';
import { StudioLightingMood } from '../types/emote';
import {
  createCastleStoneTexture,
  createCourtyardTileTexture,
} from './proceduralTextures';

/**
 * Procedural 3D Royal Castle Courtyard, Curtain Walls, Bastion Towers,
 * Glowing Lancet Windows, Banners & Torch Braziers framing the showcase stage.
 */
export class CastleBackdrop {
  public readonly group = new THREE.Group();

  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly banners: THREE.Mesh[] = [];
  private readonly flames: THREE.Mesh[] = [];
  private readonly glowMat: THREE.MeshStandardMaterial;
  private readonly windowLightL: THREE.PointLight;
  private readonly windowLightR: THREE.PointLight;

  constructor(anisotropy: number) {
    const stoneTex = createCastleStoneTexture(anisotropy);
    const tileTex = createCourtyardTileTexture(anisotropy);
    this.disposables.push(stoneTex, tileTex);

    // Calibrated architectural PBR materials with distinct roughness contrast
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      map: stoneTex,
      roughness: 0.88,
      metalness: 0.04,
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      map: stoneTex,
      roughness: 0.9,
      metalness: 0.05,
    });
    const courtyardMat = new THREE.MeshStandardMaterial({
      color: 0xb8c4d4,
      map: tileTex,
      roughness: 0.78,
      metalness: 0.08,
    });
    const slateRoofMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.56,
      metalness: 0.18,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.24,
      metalness: 0.88,
    });
    const crimsonBannerMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.76,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const gateVoidMat = new THREE.MeshStandardMaterial({
      color: 0x090d14,
      roughness: 0.95,
      metalness: 0.02,
    });
    this.glowMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.45,
      roughness: 0.18,
      metalness: 0.05,
    });
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf97316,
      emissiveIntensity: 1.9,
      roughness: 0.12,
    });

    this.disposables.push(
      stoneMat,
      darkStoneMat,
      courtyardMat,
      slateRoofMat,
      goldMat,
      crimsonBannerMat,
      gateVoidMat,
      this.glowMat,
      flameMat
    );

    // 1. Grand Courtyard Flagstone Plaza (grounded cleanly below turntable y = 0)
    const floorGeo = new THREE.CircleGeometry(19, 48);
    const floor = new THREE.Mesh(floorGeo, courtyardMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Octagonal ceremonial stone ring framing the studio turntable
    const ringGeo = new THREE.CylinderGeometry(1.78, 1.92, 0.025, 8);
    const ring = new THREE.Mesh(ringGeo, darkStoneMat);
    ring.position.y = -0.012;
    ring.receiveShadow = true;
    const goldBorderGeo = new THREE.TorusGeometry(1.74, 0.028, 8, 8);
    const goldBorder = new THREE.Mesh(goldBorderGeo, goldMat);
    goldBorder.rotation.x = Math.PI / 2;
    goldBorder.rotation.z = Math.PI / 8;
    goldBorder.position.y = 0.002;
    this.group.add(ring, goldBorder);

    // Royal crimson carpet runner leading from Keep Gatehouse to turntable
    const runnerGeo = new THREE.BoxGeometry(1.42, 0.012, 8.8);
    const runner = new THREE.Mesh(runnerGeo, crimsonBannerMat);
    runner.position.set(0, -0.008, -5.8);
    runner.receiveShadow = true;
    const runnerTrimGeo = new THREE.BoxGeometry(1.54, 0.008, 8.8);
    const runnerTrim = new THREE.Mesh(runnerTrimGeo, goldMat);
    runnerTrim.position.set(0, -0.011, -5.8);
    this.group.add(runner, runnerTrim);
    this.disposables.push(floorGeo, ringGeo, goldBorderGeo, runnerGeo, runnerTrimGeo);

    // 2. Central Royal Keep & Gatehouse (z = -10.8)
    const keepGroup = new THREE.Group();
    keepGroup.position.set(0, -0.02, -10.8);
    this.group.add(keepGroup);

    const keepBaseGeo = new THREE.BoxGeometry(4.9, 4.3, 3.2);
    const keepBase = new THREE.Mesh(keepBaseGeo, stoneMat);
    keepBase.position.y = 2.15;
    keepBase.receiveShadow = true;
    keepGroup.add(keepBase);

    const keepPlinthGeo = new THREE.BoxGeometry(5.2, 0.45, 3.5);
    const keepPlinth = new THREE.Mesh(keepPlinthGeo, darkStoneMat);
    keepPlinth.position.y = 0.225;
    keepGroup.add(keepPlinth);

    // Recessed Gothic Castle Gatehouse Arch
    const gateFrameGeo = new THREE.BoxGeometry(1.9, 2.5, 0.36);
    const gateFrame = new THREE.Mesh(gateFrameGeo, darkStoneMat);
    gateFrame.position.set(0, 1.25, 1.56);
    const gateArchTopGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.36, 18, 1, false, 0, Math.PI);
    const gateArchTop = new THREE.Mesh(gateArchTopGeo, darkStoneMat);
    gateArchTop.rotation.z = Math.PI / 2;
    gateArchTop.rotation.y = Math.PI / 2;
    gateArchTop.position.set(0, 2.5, 1.56);

    const gateDoorGeo = new THREE.BoxGeometry(1.42, 2.35, 0.25);
    const gateDoor = new THREE.Mesh(gateDoorGeo, gateVoidMat);
    gateDoor.position.set(0, 1.18, 1.62);
    const gateDoorArchGeo = new THREE.CylinderGeometry(0.71, 0.71, 0.25, 16);
    const gateDoorArch = new THREE.Mesh(gateDoorArchGeo, gateVoidMat);
    gateDoorArch.rotation.x = Math.PI / 2;
    gateDoorArch.position.set(0, 2.35, 1.62);
    keepGroup.add(gateFrame, gateArchTop, gateDoor, gateDoorArch);

    // Glowing amber rose window & twin lancet windows on keep facade
    const roseFrameGeo = new THREE.TorusGeometry(0.56, 0.08, 10, 24);
    const roseFrame = new THREE.Mesh(roseFrameGeo, darkStoneMat);
    roseFrame.position.set(0, 3.58, 1.62);
    const roseGlassGeo = new THREE.CircleGeometry(0.52, 24);
    const roseGlass = new THREE.Mesh(roseGlassGeo, this.glowMat);
    roseGlass.position.set(0, 3.58, 1.61);
    keepGroup.add(roseFrame, roseGlass);

    const lancetGeo = new THREE.CapsuleGeometry(0.2, 0.56, 6, 12);
    [-1.55, 1.55].forEach((wx) => {
      const wMesh = new THREE.Mesh(lancetGeo, this.glowMat);
      wMesh.scale.set(1, 1, 0.35);
      wMesh.position.set(wx, 2.7, 1.58);
      keepGroup.add(wMesh);
    });

    // Crenelated keep parapet & pitched slate roof + golden spire
    const merlonGeo = new THREE.BoxGeometry(0.48, 0.46, 0.34);
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const m = new THREE.Mesh(merlonGeo, darkStoneMat);
      m.position.set(i * 0.72, 4.5, 1.45);
      keepGroup.add(m);
    }

    const keepRoofGeo = new THREE.ConeGeometry(2.65, 2.35, 4);
    const keepRoof = new THREE.Mesh(keepRoofGeo, slateRoofMat);
    keepRoof.rotation.y = Math.PI / 4;
    keepRoof.position.set(0, 5.45, 0);
    const spirePoleGeo = new THREE.CylinderGeometry(0.04, 0.07, 1.15, 10);
    const spirePole = new THREE.Mesh(spirePoleGeo, goldMat);
    spirePole.position.set(0, 6.85, 0);
    const spireOrbGeo = new THREE.SphereGeometry(0.14, 12, 10);
    const spireOrb = new THREE.Mesh(spireOrbGeo, goldMat);
    spireOrb.position.set(0, 7.45, 0);
    keepGroup.add(keepRoof, spirePole, spireOrb);

    this.disposables.push(
      keepBaseGeo,
      keepPlinthGeo,
      gateFrameGeo,
      gateArchTopGeo,
      gateDoorGeo,
      gateDoorArchGeo,
      roseFrameGeo,
      roseGlassGeo,
      lancetGeo,
      merlonGeo,
      keepRoofGeo,
      spirePoleGeo,
      spireOrbGeo
    );

    // 3. Helper to build Cylindrical Round Bastion Towers with conical roofs & pennants
    const towerCylGeo = new THREE.CylinderGeometry(1.02, 1.12, 4.7, 20);
    const towerCorbelGeo = new THREE.CylinderGeometry(1.16, 1.0, 0.32, 20);
    const towerRoofGeo = new THREE.ConeGeometry(1.26, 2.15, 20);
    const finialGeo = new THREE.SphereGeometry(0.1, 10, 8);
    const flagPoleGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.9, 8);
    const pennantGeo = new THREE.PlaneGeometry(0.75, 0.32, 6, 2);
    const slitWinGeo = new THREE.BoxGeometry(0.18, 0.56, 0.16);
    this.disposables.push(
      towerCylGeo,
      towerCorbelGeo,
      towerRoofGeo,
      finialGeo,
      flagPoleGeo,
      pennantGeo,
      slitWinGeo
    );

    const buildTower = (x: number, z: number, heightScale: number, yawOffset: number) => {
      const grp = new THREE.Group();
      grp.position.set(x, -0.02, z);
      grp.scale.setScalar(heightScale);
      grp.rotation.y = yawOffset;

      const body = new THREE.Mesh(towerCylGeo, stoneMat);
      body.position.y = 2.35;
      body.receiveShadow = true;

      const corbel = new THREE.Mesh(towerCorbelGeo, darkStoneMat);
      corbel.position.y = 4.72;

      // 8 merlons around tower turret
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const m = new THREE.Mesh(merlonGeo, darkStoneMat);
        m.scale.set(0.7, 0.85, 0.7);
        m.position.set(Math.sin(a) * 1.02, 5.04, Math.cos(a) * 1.02);
        m.rotation.y = a;
        grp.add(m);
      }

      const roof = new THREE.Mesh(towerRoofGeo, slateRoofMat);
      roof.position.y = 5.95;

      const pole = new THREE.Mesh(flagPoleGeo, goldMat);
      pole.position.y = 7.3;

      const finial = new THREE.Mesh(finialGeo, goldMat);
      finial.position.y = 7.78;

      const pennant = new THREE.Mesh(pennantGeo, crimsonBannerMat);
      pennant.position.set(0.38, 7.52, 0);
      this.banners.push(pennant);

      // Warm arrow-slit windows
      [2.1, 3.55].forEach((wy) => {
        const slit = new THREE.Mesh(slitWinGeo, this.glowMat);
        slit.position.set(0, wy, 1.02);
        grp.add(slit);
      });

      grp.add(body, corbel, roof, pole, finial, pennant);
      this.group.add(grp);
    };

    // Inner Keep Flanking Bastions + Outer Crescent Towers
    buildTower(-3.25, -9.4, 1.02, 0.25);
    buildTower(3.25, -9.4, 1.02, -0.25);
    buildTower(-6.15, -6.9, 0.86, 0.55);
    buildTower(6.15, -6.9, 0.86, -0.55);

    // 4. Crescent Curtain Walls Connecting Towers
    const wallSegGeo = new THREE.BoxGeometry(3.8, 3.15, 0.72);
    const wallCapGeo = new THREE.BoxGeometry(3.9, 0.26, 0.84);
    this.disposables.push(wallSegGeo, wallCapGeo);

    const buildWallSegment = (x: number, z: number, rotY: number) => {
      const wGrp = new THREE.Group();
      wGrp.position.set(x, -0.02, z);
      wGrp.rotation.y = rotY;

      const wall = new THREE.Mesh(wallSegGeo, stoneMat);
      wall.position.y = 1.575;
      wall.receiveShadow = true;
      const cap = new THREE.Mesh(wallCapGeo, darkStoneMat);
      cap.position.y = 3.22;
      wGrp.add(wall, cap);

      for (let i = -2; i <= 2; i++) {
        const m = new THREE.Mesh(merlonGeo, darkStoneMat);
        m.position.set(i * 0.72, 3.52, 0);
        wGrp.add(m);
      }

      // Glowing arched embrasure
      const embrasure = new THREE.Mesh(slitWinGeo, this.glowMat);
      embrasure.position.set(0, 2.15, 0.34);
      wGrp.add(embrasure);

      this.group.add(wGrp);
    };

    buildWallSegment(-4.7, -8.1, 0.68);
    buildWallSegment(4.7, -8.1, -0.68);
    buildWallSegment(-7.4, -4.4, 1.15);
    buildWallSegment(7.4, -4.4, -1.15);

    // 5. Courtyard Heraldic Banners & Stone Brazier Torch Pillars
    const pillarBaseGeo = new THREE.BoxGeometry(0.68, 0.24, 0.68);
    const pillarShaftGeo = new THREE.CylinderGeometry(0.2, 0.26, 1.35, 8);
    const bowlGeo = new THREE.CylinderGeometry(0.36, 0.16, 0.24, 10);
    const flameGeo = new THREE.ConeGeometry(0.2, 0.48, 8);
    const tallPoleGeo = new THREE.CylinderGeometry(0.035, 0.045, 3.4, 10);
    const heraldBannerGeo = new THREE.PlaneGeometry(0.64, 1.65, 4, 8);
    const crossBarGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.78, 8);
    this.disposables.push(
      pillarBaseGeo,
      pillarShaftGeo,
      bowlGeo,
      flameGeo,
      tallPoleGeo,
      heraldBannerGeo,
      crossBarGeo
    );

    [-3.15, 3.15].forEach((bx) => {
      const brazier = new THREE.Group();
      brazier.position.set(bx, -0.02, -4.35);

      const base = new THREE.Mesh(pillarBaseGeo, darkStoneMat);
      base.position.y = 0.12;
      const shaft = new THREE.Mesh(pillarShaftGeo, stoneMat);
      shaft.position.y = 0.91;
      const bowl = new THREE.Mesh(bowlGeo, goldMat);
      bowl.position.y = 1.68;
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 1.98;
      this.flames.push(flame);

      brazier.add(base, shaft, bowl, flame);
      this.group.add(brazier);
    });

    [-4.35, 4.35].forEach((sx, idx) => {
      const stand = new THREE.Group();
      stand.position.set(sx, -0.02, -6.3);
      stand.rotation.y = idx === 0 ? 0.35 : -0.35;

      const pole = new THREE.Mesh(tallPoleGeo, goldMat);
      pole.position.y = 1.7;
      const cross = new THREE.Mesh(crossBarGeo, goldMat);
      cross.rotation.z = Math.PI / 2;
      cross.position.y = 3.22;
      const finial = new THREE.Mesh(finialGeo, goldMat);
      finial.position.y = 3.44;

      const cloth = new THREE.Mesh(heraldBannerGeo, crimsonBannerMat);
      cloth.position.set(0, 2.38, 0.03);
      this.banners.push(cloth);

      stand.add(pole, cross, finial, cloth);
      this.group.add(stand);
    });

    // Subtle warm courtyard point lights for torch depth
    this.windowLightL = new THREE.PointLight(0xffa94d, 4.5, 9, 1.6);
    this.windowLightL.position.set(-3.15, 2.35, -4.15);
    this.windowLightR = new THREE.PointLight(0xffa94d, 4.5, 9, 1.6);
    this.windowLightR.position.set(3.15, 2.35, -4.15);
    this.group.add(this.windowLightL, this.windowLightR);
  }

  public update(elapsed: number, playing: boolean, mood: StudioLightingMood): void {
    const baseIntensity = mood === 'gallery' ? 0.75 : mood === 'obsidian' ? 2.1 : 1.5;
    const torchStrength = mood === 'gallery' ? 2.2 : mood === 'obsidian' ? 6.5 : 4.5;

    if (playing) {
      const flickerA = 1 + Math.sin(elapsed * 9.5) * 0.14 + Math.sin(elapsed * 17.3) * 0.08;
      const flickerB = 1 + Math.cos(elapsed * 8.7) * 0.14 + Math.sin(elapsed * 15.1) * 0.08;

      this.windowLightL.intensity = torchStrength * flickerA;
      this.windowLightR.intensity = torchStrength * flickerB;
      this.glowMat.emissiveIntensity = baseIntensity + Math.sin(elapsed * 2.2) * 0.12;

      for (let i = 0; i < this.flames.length; i++) {
        const f = this.flames[i];
        const wave = i === 0 ? flickerA : flickerB;
        f.scale.set(0.92 + (wave - 1) * 0.6, wave * 1.05, 0.92 + (wave - 1) * 0.6);
      }

      for (let i = 0; i < this.banners.length; i++) {
        const b = this.banners[i];
        b.rotation.y = Math.sin(elapsed * 2.6 + i * 1.3) * 0.12;
        b.rotation.z = Math.cos(elapsed * 1.9 + i * 0.9) * 0.04;
      }
    } else {
      this.windowLightL.intensity = torchStrength;
      this.windowLightR.intensity = torchStrength;
      this.glowMat.emissiveIntensity = baseIntensity;
    }
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
