import * as THREE from 'three';
import { CHARACTERS } from '../data/characters';
import {
  CharacterId,
  ExpressionParams,
  HandPose,
  VfxProp,
} from '../types/emote';
import {
  createContactShadowTexture,
  createFurTexture,
  createIrisTexture,
  createTurntableTexture,
} from './proceduralTextures';

// Pre-allocated scratch helpers (zero GC in animation loop)
const _baseSkinColor = new THREE.Color();
const _angerTintColor = new THREE.Color('#E11D48');
const _blushTintColor = new THREE.Color('#FB7185');
const _tmpColor = new THREE.Color();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerpAngle(a: number, b: number, t: number): number {
  const diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * t;
}

export interface RigState {
  browTilt: number;
  browHeight: number;
  eyeOpenL: number;
  eyeOpenR: number;
  pupilScale: number;
  gazeX: number;
  gazeY: number;
  mouthSmile: number;
  mouthOpen: number;
  cheekPuff: number;
  blush: number;
  headTiltX: number;
  headTiltY: number;
  headTiltZ: number;
  faceTint: number;
}

export class EmoteCharacterRig {
  public readonly root = new THREE.Group();
  public readonly characterGroup = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly torsoGroup = new THREE.Group();

  // Facial controls
  private readonly browL = new THREE.Group();
  private readonly browR = new THREE.Group();
  private readonly eyePivotL = new THREE.Group();
  private readonly eyePivotR = new THREE.Group();
  private readonly pupilL: THREE.Mesh;
  private readonly pupilR: THREE.Mesh;
  private readonly upperLidL = new THREE.Group();
  private readonly upperLidR = new THREE.Group();
  private readonly lowerLidL = new THREE.Group();
  private readonly lowerLidR = new THREE.Group();
  private readonly cheekL: THREE.Mesh;
  private readonly cheekR: THREE.Mesh;
  private readonly blushL: THREE.Mesh;
  private readonly blushR: THREE.Mesh;
  private readonly jawGroup = new THREE.Group();
  private readonly upperLipGroup = new THREE.Group();
  private readonly earL = new THREE.Group();
  private readonly earR = new THREE.Group();

  // Articulated 2-bone arms, elbows, wrists & 5-digit hands
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly elbowL = new THREE.Group();
  private readonly elbowR = new THREE.Group();
  private readonly handL = new THREE.Group();
  private readonly handR = new THREE.Group();
  private readonly fingersL: THREE.Group[] = [];
  private readonly fingersR: THREE.Group[] = [];
  private readonly handThumbL: THREE.Group;
  private readonly handThumbR: THREE.Group;

  // Articulated legs, feet & tail
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly tailGroup = new THREE.Group();
  private readonly tailTipGroup = new THREE.Group();

  // Dynamic VFX Props & Royal King Throne / Disco Fashion Ensembles
  private readonly vfxRoot = new THREE.Group();
  private readonly vfxGroups: Record<Exclude<VfxProp, 'none'>, THREE.Group>;
  private readonly throneGroup = new THREE.Group();
  private readonly kingFashionGroup = new THREE.Group();
  private readonly discoShirtGroup = new THREE.Group();
  private readonly discoSleeveL = new THREE.Group();
  private readonly discoSleeveR = new THREE.Group();
  private readonly contactShadow: THREE.Mesh;

  // Materials requiring dynamic color/opacity updates or disposal
  private readonly furMat: THREE.MeshStandardMaterial;
  private readonly skinMat: THREE.MeshStandardMaterial;
  private readonly lidMat: THREE.MeshStandardMaterial;
  private readonly blushMat: THREE.MeshStandardMaterial;
  private readonly browMat: THREE.MeshStandardMaterial;
  private readonly disposables: Array<{ dispose: () => void }> = [];

  private baseSkinHex: string;
  private baseFurHex: string;
  private state: RigState;
  private blinkTimer = 2.4;
  private blinkAmount = 0;
  private wasKingThrone = false;
  private kingSeqTime = 0;
  private kingWalkActive = false;
  private kingWalkPhase = 0;
  private kingWalkStrength = 0;

  constructor(
    public readonly characterId: CharacterId,
    anisotropy: number
  ) {
    const profile =
      CHARACTERS.find((c) => c.id === characterId) || CHARACTERS[0];
    this.baseFurHex = profile.palette.primaryFur;
    this.baseSkinHex = profile.palette.secondarySkin;

    const furTex = createFurTexture(profile.palette.primaryFur, anisotropy);
    const irisTex = createIrisTexture(profile.palette.iris, anisotropy);
    const shadowTex = createContactShadowTexture();
    const turntableTex = createTurntableTexture(anisotropy);
    this.disposables.push(furTex, irisTex, shadowTex, turntableTex);

    // Calibrated PBR materials with >= 0.25 roughness contrast
    this.furMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: furTex,
      roughness: 0.86,
      metalness: 0.02,
    });
    this.skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(profile.palette.secondarySkin),
      roughness: 0.56,
      metalness: 0.02,
    });
    this.browMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(profile.palette.primaryFur).offsetHSL(0, 0.05, -0.08),
      roughness: 0.78,
      metalness: 0.02,
    });
    const innerEarMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(profile.palette.innerEar),
      roughness: 0.62,
      metalness: 0.02,
    });
    const eyeWhiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
    });
    const irisMat = new THREE.MeshPhysicalMaterial({
      map: irisTex,
      roughness: 0.18,
      clearcoat: 0.85,
    });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.lidMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(profile.palette.secondarySkin).offsetHSL(0, 0, -0.06),
      roughness: 0.6,
    });
    const lashMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b18,
      roughness: 0.52,
    });
    const mouthCavMat = new THREE.MeshStandardMaterial({
      color: 0x3b0a14,
      roughness: 0.7,
    });
    const teethMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
      clearcoat: 0.7,
    });
    const tongueMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.45,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(profile.palette.collarMetal),
      roughness: 0.24,
      metalness: 0.88,
    });
    this.blushMat = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      roughness: 0.75,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.disposables.push(
      this.furMat,
      this.skinMat,
      this.browMat,
      innerEarMat,
      eyeWhiteMat,
      irisMat,
      pupilMat,
      catchlightMat,
      this.lidMat,
      lashMat,
      mouthCavMat,
      teethMat,
      tongueMat,
      metalMat,
      this.blushMat
    );

    // 1. Studio Turntable Plinth (grounded at y = 0, wide enough to walk around King Throne)
    const plinthPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1.54, 0),
      new THREE.Vector2(1.52, 0.08),
      new THREE.Vector2(1.46, 0.12),
      new THREE.Vector2(1.42, 0.14),
      new THREE.Vector2(0, 0.14),
    ];
    const plinthGeo = new THREE.LatheGeometry(plinthPts, 48);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.75,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.receiveShadow = true;
    this.root.add(plinth);

    const topDiscGeo = new THREE.CircleGeometry(1.42, 48);
    const topDiscMat = new THREE.MeshStandardMaterial({
      map: turntableTex,
      roughness: 0.48,
      metalness: 0.25,
    });
    const topDisc = new THREE.Mesh(topDiscGeo, topDiscMat);
    topDisc.rotation.x = -Math.PI / 2;
    topDisc.position.y = 0.145;
    topDisc.receiveShadow = true;
    this.root.add(topDisc);

    // Contact shadow plane directly on the turntable surface
    const contactGeo = new THREE.PlaneGeometry(1.75, 1.75);
    const contactMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });
    this.contactShadow = new THREE.Mesh(contactGeo, contactMat);
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.155;
    this.root.add(this.contactShadow);
    this.disposables.push(plinthGeo, plinthMat, topDiscGeo, topDiscMat, contactGeo, contactMat);

    // Character group sits cleanly above the turntable
    this.characterGroup.position.set(0, 0.16, 0);
    this.root.add(this.characterGroup);

    // 2. Chubby Cute Sculpted Torso, Plush Belly & Collar
    this.torsoGroup.position.set(0, 0.87, 0);
    this.characterGroup.add(this.torsoGroup);

    const torsoGeo = new THREE.CapsuleGeometry(0.46, 0.3, 14, 24);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.furMat);
    torsoMesh.scale.set(1.16, 0.96, 1.04);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torsoGroup.add(torsoMesh);

    // Chubby rounded plush belly volume
    const bellyGeo = new THREE.SphereGeometry(0.47, 22, 18);
    const bellyMesh = new THREE.Mesh(bellyGeo, this.furMat);
    bellyMesh.scale.set(1.12, 0.86, 1.02);
    bellyMesh.position.set(0, -0.11, 0.04);
    bellyMesh.castShadow = true;
    bellyMesh.receiveShadow = true;
    this.torsoGroup.add(bellyMesh);

    // Cozy rounded tummy patch
    const chestGeo = new THREE.SphereGeometry(0.35, 20, 16);
    const chestMesh = new THREE.Mesh(chestGeo, this.skinMat);
    chestMesh.scale.set(1.06, 0.96, 0.64);
    chestMesh.position.set(0, -0.04, 0.27);
    this.torsoGroup.add(chestMesh);

    // Brushed metallic NFT collar ring
    const collarGeo = new THREE.TorusGeometry(0.34, 0.042, 14, 36);
    const collarMesh = new THREE.Mesh(collarGeo, metalMat);
    collarMesh.rotation.x = Math.PI / 2 + 0.12;
    collarMesh.position.set(0, 0.33, 0.03);
    collarMesh.castShadow = true;
    this.torsoGroup.add(collarMesh);

    // Collar emblem tag
    const tagGeo = new THREE.OctahedronGeometry(0.068, 0);
    const tagMesh = new THREE.Mesh(tagGeo, metalMat);
    tagMesh.position.set(0, 0.27, 0.39);
    this.torsoGroup.add(tagMesh);
    this.disposables.push(torsoGeo, bellyGeo, chestGeo, collarGeo, tagGeo);

    // 2b. Chubby Stubby Articulated Legs & Feet (feet soles flush at y = 0 inside characterGroup)
    this.buildLegs(innerEarMat);

    // 2c. Species-Specific Articulated Tail
    this.buildTail(characterId, innerEarMat);

    // 3. Cute Chibi Head Group (cozy neck tuck on chubby torso)
    this.headGroup.position.set(0, 0.61, 0);
    this.torsoGroup.add(this.headGroup);

    const craniumGeo = new THREE.SphereGeometry(0.57, 32, 28);
    const craniumMesh = new THREE.Mesh(craniumGeo, this.furMat);
    craniumMesh.scale.set(
      characterId === 'axolotl' ? 1.14 : 1.07,
      characterId === 'kitsune' ? 0.96 : 0.98,
      1.0
    );
    craniumMesh.castShadow = true;
    craniumMesh.receiveShadow = true;
    this.headGroup.add(craniumMesh);
    this.disposables.push(craniumGeo);

    // Species-specific crown crest / tuft
    this.buildCrownCrest(characterId, innerEarMat);

    // Sculpted Face Mask & Cute Soft Muzzle
    const maskGeo = new THREE.SphereGeometry(0.45, 24, 20);
    const maskMesh = new THREE.Mesh(maskGeo, this.skinMat);
    maskMesh.scale.set(1.04, 0.86, 0.56);
    maskMesh.position.set(0, -0.03, 0.29);
    this.headGroup.add(maskMesh);

    const muzzleGeo = new THREE.SphereGeometry(0.29, 24, 20);
    const muzzleMesh = new THREE.Mesh(muzzleGeo, this.skinMat);
    muzzleMesh.scale.set(
      characterId === 'kitsune' ? 0.88 : 1.18,
      0.78,
      characterId === 'kitsune' ? 1.1 : 0.84
    );
    muzzleMesh.position.set(0, -0.17, 0.44);
    muzzleMesh.castShadow = true;
    this.headGroup.add(muzzleMesh);

    // Cute button nose
    const noseGeo = new THREE.SphereGeometry(0.06, 16, 12);
    const noseMesh = new THREE.Mesh(noseGeo, innerEarMat);
    noseMesh.scale.set(1.22, 0.78, 0.8);
    noseMesh.position.set(0, -0.055, 0.67);
    this.headGroup.add(noseMesh);

    // Extra plush chubby cheeks (scale up with cheekPuff)
    const cheekGeo = new THREE.SphereGeometry(0.165, 16, 14);
    this.cheekL = new THREE.Mesh(cheekGeo, this.skinMat);
    this.cheekL.position.set(-0.28, -0.13, 0.4);
    this.cheekR = new THREE.Mesh(cheekGeo, this.skinMat);
    this.cheekR.position.set(0.28, -0.13, 0.4);
    this.headGroup.add(this.cheekL, this.cheekR);

    // Rosy chibi blush ovals
    const blushGeo = new THREE.SphereGeometry(0.105, 14, 12);
    this.blushL = new THREE.Mesh(blushGeo, this.blushMat);
    this.blushL.scale.set(1.28, 0.76, 0.4);
    this.blushL.position.set(-0.31, -0.08, 0.52);
    this.blushR = new THREE.Mesh(blushGeo, this.blushMat);
    this.blushR.scale.set(1.28, 0.76, 0.4);
    this.blushR.position.set(0.31, -0.08, 0.52);
    this.headGroup.add(this.blushL, this.blushR);
    this.disposables.push(maskGeo, muzzleGeo, noseGeo, cheekGeo, blushGeo);

    // 4. Larger Cute Eyes + Concentric Spherical Iris/Pupil + Watertight Eyelids & Lash Rim
    const eyeRadius = 0.134;
    const eyeGeo = new THREE.SphereGeometry(eyeRadius, 28, 22);

    const createEyeCapGeo = (
      capRadius: number,
      maxTheta: number,
      uvRadiusScale: number
    ): THREE.SphereGeometry => {
      const geo = new THREE.SphereGeometry(
        capRadius,
        28,
        12,
        0,
        Math.PI * 2,
        0,
        maxTheta
      );
      geo.rotateX(Math.PI / 2);
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      const maxXY = capRadius * Math.sin(maxTheta);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        uv.setXY(
          i,
          0.5 + (x / maxXY) * uvRadiusScale,
          0.5 + (y / maxXY) * uvRadiusScale
        );
      }
      uv.needsUpdate = true;
      return geo;
    };

    const irisGeo = createEyeCapGeo(eyeRadius * 1.008, 0.58, 0.242);
    const pupilGeo = createEyeCapGeo(eyeRadius * 1.014, 0.28, 0.12);
    const catchGeo = new THREE.SphereGeometry(eyeRadius * 0.068, 10, 8);
    const upperLidGeo = new THREE.SphereGeometry(
      eyeRadius * 1.072,
      24,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.52
    );
    const lowerLidGeo = new THREE.SphereGeometry(
      eyeRadius * 1.064,
      24,
      14,
      0,
      Math.PI * 2,
      Math.PI * 0.48,
      Math.PI * 0.52
    );
    const lashGeo = new THREE.TorusGeometry(
      eyeRadius * 1.074,
      0.0046,
      8,
      28,
      Math.PI
    );
    this.disposables.push(
      eyeGeo,
      irisGeo,
      pupilGeo,
      catchGeo,
      upperLidGeo,
      lowerLidGeo,
      lashGeo
    );

    const buildEye = (
      xOffset: number,
      pivot: THREE.Group,
      uLid: THREE.Group,
      lLid: THREE.Group
    ): THREE.Mesh => {
      const socket = new THREE.Group();
      socket.position.set(xOffset, 0.07, 0.45);
      this.headGroup.add(socket);

      const sclera = new THREE.Mesh(eyeGeo, eyeWhiteMat);
      socket.add(sclera);

      pivot.position.set(0, 0, 0);
      socket.add(pivot);

      const iris = new THREE.Mesh(irisGeo, irisMat);
      pivot.add(iris);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pivot.add(pupil);

      const catchMain = new THREE.Mesh(catchGeo, catchlightMat);
      catchMain.scale.set(1, 1, 0.32);
      catchMain.position.set(-0.024, 0.024, eyeRadius * 1.005);
      pivot.add(catchMain);

      uLid.add(new THREE.Mesh(upperLidGeo, this.lidMat));
      const lash = new THREE.Mesh(lashGeo, lashMat);
      lash.rotation.x = Math.PI / 2;
      lash.position.y = -eyeRadius * 1.072 * Math.sin(0.02 * Math.PI);
      uLid.add(lash);

      lLid.add(new THREE.Mesh(lowerLidGeo, this.lidMat));
      socket.add(uLid, lLid);

      return pupil;
    };

    this.pupilL = buildEye(-0.185, this.eyePivotL, this.upperLidL, this.lowerLidL);
    this.pupilR = buildEye(0.185, this.eyePivotR, this.upperLidR, this.lowerLidR);

    // 5. Sculpted Eyebrows
    const browGeo = new THREE.CapsuleGeometry(0.043, 0.145, 8, 14);
    const browMeshL = new THREE.Mesh(browGeo, this.browMat);
    browMeshL.rotation.z = Math.PI / 2;
    this.browL.add(browMeshL);
    this.browL.position.set(-0.185, 0.24, 0.5);

    const browMeshR = new THREE.Mesh(browGeo, this.browMat);
    browMeshR.rotation.z = Math.PI / 2;
    this.browR.add(browMeshR);
    this.browR.position.set(0.185, 0.24, 0.5);
    this.headGroup.add(this.browL, this.browR);
    this.disposables.push(browGeo);

    // 6. Articulated Mouth & Jaw
    const mouthCavityGeo = new THREE.SphereGeometry(0.14, 18, 12);
    const mouthCavity = new THREE.Mesh(mouthCavityGeo, mouthCavMat);
    mouthCavity.scale.set(1.3, 0.65, 0.45);
    mouthCavity.position.set(0, -0.23, 0.575);
    this.headGroup.add(mouthCavity);

    this.upperLipGroup.position.set(0, -0.21, 0.625);
    const upperTeethGeo = new THREE.BoxGeometry(0.22, 0.042, 0.05);
    const upperTeeth = new THREE.Mesh(upperTeethGeo, teethMat);
    upperTeeth.position.set(0, -0.01, -0.02);
    const upperLipGeo = new THREE.TorusGeometry(0.16, 0.025, 10, 20, Math.PI);
    const upperLip = new THREE.Mesh(upperLipGeo, this.skinMat);
    upperLip.rotation.z = Math.PI;
    upperLip.scale.set(1.15, 0.45, 1.0);
    this.upperLipGroup.add(upperTeeth, upperLip);
    this.headGroup.add(this.upperLipGroup);

    this.jawGroup.position.set(0, -0.23, 0.555);
    const lowerLipGeo = new THREE.TorusGeometry(0.16, 0.028, 10, 22, Math.PI);
    const lowerLip = new THREE.Mesh(lowerLipGeo, this.skinMat);
    lowerLip.rotation.z = Math.PI;
    lowerLip.position.set(0, -0.01, 0.07);
    lowerLip.scale.set(1.15, 0.48, 1.0);
    const lowerTeethGeo = new THREE.BoxGeometry(0.19, 0.036, 0.04);
    const lowerTeeth = new THREE.Mesh(lowerTeethGeo, teethMat);
    lowerTeeth.position.set(0, 0.0, 0.04);
    const tongueGeo = new THREE.SphereGeometry(0.085, 14, 10);
    const tongue = new THREE.Mesh(tongueGeo, tongueMat);
    tongue.scale.set(1.1, 0.45, 0.9);
    tongue.position.set(0, 0.005, 0.02);
    this.jawGroup.add(lowerLip, lowerTeeth, tongue);
    this.headGroup.add(this.jawGroup);
    this.disposables.push(
      mouthCavityGeo,
      upperTeethGeo,
      upperLipGeo,
      lowerLipGeo,
      lowerTeethGeo,
      tongueGeo
    );

    // 7. Species-specific Ears / Fronds
    this.buildEars(characterId, innerEarMat);

    // 8. Chubby Plush Articulated 2-Bone Arms (Shoulder -> Upper Arm -> Elbow -> Forearm -> Wrist -> 5 Digits)
    const upperArmGeo = new THREE.CapsuleGeometry(0.104, 0.17, 8, 14);
    const forearmGeo = new THREE.CapsuleGeometry(0.09, 0.16, 8, 14);
    const palmGeo = new THREE.SphereGeometry(0.098, 16, 14);
    const fingerGeo = new THREE.CapsuleGeometry(0.023, 0.064, 6, 10);
    const thumbGeo = new THREE.CapsuleGeometry(0.026, 0.054, 6, 10);
    this.disposables.push(upperArmGeo, forearmGeo, palmGeo, fingerGeo, thumbGeo);

    const buildArm = (
      side: -1 | 1,
      shoulderGrp: THREE.Group,
      elbowGrp: THREE.Group,
      handGrp: THREE.Group,
      fingerList: THREE.Group[]
    ): THREE.Group => {
      shoulderGrp.position.set(side * 0.49, 0.16, 0.03);
      this.torsoGroup.add(shoulderGrp);

      const upperMesh = new THREE.Mesh(upperArmGeo, this.furMat);
      upperMesh.position.set(0, -0.135, 0);
      upperMesh.castShadow = true;
      shoulderGrp.add(upperMesh);

      elbowGrp.position.set(0, -0.27, 0);
      shoulderGrp.add(elbowGrp);

      const foreMesh = new THREE.Mesh(forearmGeo, this.furMat);
      foreMesh.position.set(0, -0.125, 0);
      foreMesh.castShadow = true;
      elbowGrp.add(foreMesh);

      handGrp.position.set(0, -0.25, 0);
      elbowGrp.add(handGrp);

      const palm = new THREE.Mesh(palmGeo, this.skinMat);
      palm.scale.set(0.66, 1.05, 0.98);
      palm.position.set(0, -0.055, 0);
      palm.castShadow = true;
      handGrp.add(palm);

      const thumbPivot = new THREE.Group();
      thumbPivot.position.set(-side * 0.022, -0.035, 0.07);
      const thumbMesh = new THREE.Mesh(thumbGeo, this.skinMat);
      thumbMesh.position.set(0, -0.042, 0.025);
      thumbMesh.rotation.x = -0.45;
      thumbPivot.add(thumbMesh);
      handGrp.add(thumbPivot);

      // Index, Middle, Ring, Pinky arranged along Z (front-to-back) pointing -Y
      const zOffsets = [0.056, 0.018, -0.02, -0.056];
      const lengths = [0.98, 1.08, 0.98, 0.82];
      zOffsets.forEach((fz, i) => {
        const fPivot = new THREE.Group();
        fPivot.position.set(0, -0.105, fz);
        const fMesh = new THREE.Mesh(fingerGeo, this.skinMat);
        fMesh.scale.set(1, lengths[i], 1);
        fMesh.position.set(0, -0.045 * lengths[i], 0);
        fPivot.add(fMesh);
        handGrp.add(fPivot);
        fingerList.push(fPivot);
      });

      return thumbPivot;
    };

    this.handThumbL = buildArm(-1, this.armL, this.elbowL, this.handL, this.fingersL);
    this.handThumbR = buildArm(1, this.armR, this.elbowR, this.handR, this.fingersR);

    // 9. Build 3D VFX Props & Royal King Throne / Disco Fashion Ensembles
    this.headGroup.add(this.vfxRoot);
    this.vfxGroups = this.buildVfxProps();
    this.buildKingThroneAndFashion(metalMat);
    this.buildDiscoFashion(metalMat);

    // Initial state
    this.state = {
      browTilt: 0,
      browHeight: 0,
      eyeOpenL: 1,
      eyeOpenR: 1,
      pupilScale: 1,
      gazeX: 0,
      gazeY: 0,
      mouthSmile: 0.3,
      mouthOpen: 0,
      cheekPuff: 0,
      blush: 0,
      headTiltX: 0,
      headTiltY: 0,
      headTiltZ: 0,
      faceTint: 0,
    };
  }

  private buildLegs(padMat: THREE.Material): void {
    const legGeo = new THREE.CapsuleGeometry(0.145, 0.17, 10, 16);
    const footGeo = new THREE.SphereGeometry(0.138, 18, 14);
    const toeGeo = new THREE.SphereGeometry(0.046, 12, 10);
    this.disposables.push(legGeo, footGeo, toeGeo);

    const setupLeg = (side: -1 | 1, grp: THREE.Group) => {
      // Plump stubby hip pivot tucked snugly beneath chubby torso
      grp.position.set(side * 0.25, 0.5, 0.02);
      this.characterGroup.add(grp);

      const thigh = new THREE.Mesh(legGeo, this.furMat);
      thigh.position.set(0, -0.19, 0);
      thigh.castShadow = true;
      thigh.receiveShadow = true;
      grp.add(thigh);

      const foot = new THREE.Mesh(footGeo, this.skinMat);
      foot.scale.set(1.08, 0.6, 1.32);
      foot.position.set(0, -0.417, 0.07);
      foot.castShadow = true;
      foot.receiveShadow = true;
      grp.add(foot);

      // Three sculpted chubby toes at front of foot
      [-0.06, 0, 0.06].forEach((tx, idx) => {
        const toe = new THREE.Mesh(toeGeo, padMat);
        toe.scale.set(0.88, 0.78, 1.15);
        toe.position.set(tx, -0.445, 0.21 + (idx === 1 ? 0.015 : 0));
        grp.add(toe);
      });
    };

    setupLeg(-1, this.legL);
    setupLeg(1, this.legR);
  }

  private buildTail(characterId: CharacterId, accentMat: THREE.Material): void {
    this.tailGroup.position.set(0, -0.22, -0.44);
    this.torsoGroup.add(this.tailGroup);
    this.tailGroup.add(this.tailTipGroup);

    if (characterId === 'macaque') {
      // Expressive curved S-shape primate tail
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0.05, 0.05, -0.28),
        new THREE.Vector3(0.22, 0.28, -0.48),
        new THREE.Vector3(0.42, 0.62, -0.42),
        new THREE.Vector3(0.32, 0.86, -0.3),
        new THREE.Vector3(0.2, 0.82, -0.24),
      ]);
      const tailGeo = new THREE.TubeGeometry(curve, 32, 0.068, 12, false);
      const tailMesh = new THREE.Mesh(tailGeo, this.furMat);
      tailMesh.castShadow = true;
      this.tailTipGroup.add(tailMesh);

      const tipGeo = new THREE.SphereGeometry(0.072, 14, 12);
      const tipMesh = new THREE.Mesh(tipGeo, this.furMat);
      tipMesh.position.set(0.2, 0.82, -0.24);
      this.tailTipGroup.add(tipMesh);
      this.disposables.push(tailGeo, tipGeo);
    } else if (characterId === 'kitsune') {
      // Plush multi-volume curved fox tail with icy tipped plume
      const baseGeo = new THREE.CapsuleGeometry(0.16, 0.34, 12, 18);
      const midGeo = new THREE.SphereGeometry(0.22, 18, 16);
      const tipGeo = new THREE.ConeGeometry(0.17, 0.34, 16);

      const base = new THREE.Mesh(baseGeo, this.furMat);
      base.position.set(0, 0.14, -0.18);
      base.rotation.x = -0.85;
      base.castShadow = true;

      const plume = new THREE.Mesh(midGeo, this.furMat);
      plume.scale.set(0.95, 1.35, 0.95);
      plume.position.set(0, 0.36, -0.42);
      plume.rotation.x = -0.35;
      plume.castShadow = true;

      const tip = new THREE.Mesh(tipGeo, accentMat);
      tip.position.set(0, 0.66, -0.48);
      tip.rotation.x = -0.15;

      this.tailTipGroup.add(base, plume, tip);
      this.disposables.push(baseGeo, midGeo, tipGeo);
    } else if (characterId === 'tanuki') {
      // Thick banded raccoon-dog tail
      const tailGeo = new THREE.CapsuleGeometry(0.18, 0.44, 12, 18);
      const ringGeo = new THREE.TorusGeometry(0.165, 0.036, 10, 24);

      const body = new THREE.Mesh(tailGeo, this.furMat);
      body.position.set(0, 0.16, -0.28);
      body.rotation.x = -0.95;
      body.castShadow = true;
      this.tailTipGroup.add(body);

      [0.18, 0.32, 0.45].forEach((d, idx) => {
        const band = new THREE.Mesh(ringGeo, accentMat);
        band.position.set(0, d * 0.58, -0.14 - d * 0.72);
        band.rotation.x = Math.PI / 2 - 0.95;
        band.scale.setScalar(1 - idx * 0.12);
        this.tailTipGroup.add(band);
      });
      this.disposables.push(tailGeo, ringGeo);
    } else {
      // Axolotl sculpted aquatic tail with dorsal fin crest
      const coreGeo = new THREE.ConeGeometry(0.15, 0.72, 16);
      const finGeo = new THREE.SphereGeometry(0.18, 16, 12);

      const core = new THREE.Mesh(coreGeo, this.furMat);
      core.rotation.x = -Math.PI / 2 - 0.3;
      core.position.set(0, 0.08, -0.32);
      core.castShadow = true;

      const fin = new THREE.Mesh(finGeo, accentMat);
      fin.scale.set(0.18, 0.9, 1.85);
      fin.position.set(0, 0.18, -0.36);
      fin.rotation.x = 0.25;

      this.tailTipGroup.add(core, fin);
      this.disposables.push(coreGeo, finGeo);
    }
  }

  private buildCrownCrest(
    characterId: CharacterId,
    accentMat: THREE.Material
  ): void {
    if (characterId === 'macaque') {
      // Sculpted fiery hair tuft spikes
      const tuftGeo = new THREE.ConeGeometry(0.115, 0.28, 12);
      const t1 = new THREE.Mesh(tuftGeo, this.furMat);
      t1.position.set(0, 0.58, 0.06);
      t1.rotation.set(0.28, 0, -0.12);
      const t2 = new THREE.Mesh(tuftGeo, this.furMat);
      t2.scale.set(0.78, 0.8, 0.78);
      t2.position.set(-0.09, 0.55, 0.02);
      t2.rotation.set(0.15, 0, 0.35);
      const t3 = new THREE.Mesh(tuftGeo, this.furMat);
      t3.scale.set(0.7, 0.72, 0.7);
      t3.position.set(0.1, 0.54, 0.03);
      t3.rotation.set(0.2, 0, -0.4);
      this.headGroup.add(t1, t2, t3);
      this.disposables.push(tuftGeo);
    } else if (characterId === 'tanuki') {
      // Sprout leaf crest
      const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.18, 8);
      const leafGeo = new THREE.SphereGeometry(0.11, 14, 10);
      const stem = new THREE.Mesh(stemGeo, accentMat);
      stem.position.set(0, 0.58, 0.04);
      const leaf = new THREE.Mesh(leafGeo, accentMat);
      leaf.scale.set(1.4, 0.28, 0.85);
      leaf.position.set(0.08, 0.67, 0.06);
      leaf.rotation.z = -0.25;
      this.headGroup.add(stem, leaf);
      this.disposables.push(stemGeo, leafGeo);
    } else if (characterId === 'kitsune') {
      // Sleek brow diamond gem
      const gemGeo = new THREE.OctahedronGeometry(0.06, 0);
      const gem = new THREE.Mesh(gemGeo, accentMat);
      gem.scale.set(0.8, 1.3, 0.5);
      gem.position.set(0, 0.33, 0.52);
      this.headGroup.add(gem);
      this.disposables.push(gemGeo);
    } else {
      // Axolotl dorsal crest fin
      const finGeo = new THREE.ConeGeometry(0.09, 0.24, 10);
      const fin = new THREE.Mesh(finGeo, accentMat);
      fin.scale.set(0.45, 1.0, 1.4);
      fin.position.set(0, 0.58, -0.02);
      fin.rotation.x = -0.35;
      this.headGroup.add(fin);
      this.disposables.push(finGeo);
    }
  }

  private buildEars(characterId: CharacterId, innerMat: THREE.Material): void {
    this.headGroup.add(this.earL, this.earR);

    if (characterId === 'macaque') {
      const earGeo = new THREE.SphereGeometry(0.19, 18, 14);
      const earInGeo = new THREE.SphereGeometry(0.12, 16, 12);
      this.disposables.push(earGeo, earInGeo);

      const buildMacaqueEar = (side: -1 | 1, grp: THREE.Group) => {
        grp.position.set(side * 0.58, 0.04, -0.03);
        const outer = new THREE.Mesh(earGeo, this.skinMat);
        outer.scale.set(0.92, 1.08, 0.42);
        const inner = new THREE.Mesh(earInGeo, innerMat);
        inner.scale.set(0.85, 1.0, 0.3);
        inner.position.set(side * 0.02, 0, 0.05);
        grp.add(outer, inner);
      };
      buildMacaqueEar(-1, this.earL);
      buildMacaqueEar(1, this.earR);
    } else if (characterId === 'kitsune') {
      const earGeo = new THREE.ConeGeometry(0.19, 0.52, 14);
      const earInGeo = new THREE.ConeGeometry(0.11, 0.36, 12);
      this.disposables.push(earGeo, earInGeo);

      const buildFoxEar = (side: -1 | 1, grp: THREE.Group) => {
        grp.position.set(side * 0.36, 0.47, -0.02);
        grp.rotation.z = -side * 0.32;
        const outer = new THREE.Mesh(earGeo, this.furMat);
        outer.scale.set(1.0, 1.0, 0.6);
        const inner = new THREE.Mesh(earInGeo, innerMat);
        inner.scale.set(0.9, 0.95, 0.5);
        inner.position.set(0, -0.04, 0.06);
        grp.add(outer, inner);
      };
      buildFoxEar(-1, this.earL);
      buildFoxEar(1, this.earR);
    } else if (characterId === 'tanuki') {
      const earGeo = new THREE.SphereGeometry(0.17, 16, 14);
      const earInGeo = new THREE.SphereGeometry(0.095, 14, 12);
      this.disposables.push(earGeo, earInGeo);

      const buildTanukiEar = (side: -1 | 1, grp: THREE.Group) => {
        grp.position.set(side * 0.42, 0.43, 0);
        const outer = new THREE.Mesh(earGeo, this.furMat);
        outer.scale.set(1.0, 1.0, 0.55);
        const inner = new THREE.Mesh(earInGeo, innerMat);
        inner.scale.set(0.9, 0.9, 0.45);
        inner.position.set(0, -0.01, 0.06);
        grp.add(outer, inner);
      };
      buildTanukiEar(-1, this.earL);
      buildTanukiEar(1, this.earR);
    } else {
      // Axolotl 3-branch feathery gill fronds per side
      const frondGeo = new THREE.CapsuleGeometry(0.05, 0.25, 8, 12);
      this.disposables.push(frondGeo);

      const buildAxoGills = (side: -1 | 1, grp: THREE.Group) => {
        grp.position.set(side * 0.59, 0.05, 0.02);
        [-0.45, 0, 0.45].forEach((angle, idx) => {
          const branch = new THREE.Mesh(frondGeo, innerMat);
          branch.position.set(side * 0.14, idx * 0.1 - 0.1, -0.02);
          branch.rotation.z = side * (angle - 1.35);
          grp.add(branch);
        });
      };
      buildAxoGills(-1, this.earL);
      buildAxoGills(1, this.earR);
    }
  }

  private buildVfxProps(): Record<Exclude<VfxProp, 'none'>, THREE.Group> {
    const createGroup = () => {
      const g = new THREE.Group();
      g.visible = false;
      this.vfxRoot.add(g);
      return g;
    };

    // 1. Hearts (extruded 3D heart shapes over eyes + floating)
    const hearts = createGroup();
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, -0.06);
    heartShape.bezierCurveTo(0.08, -0.01, 0.1, 0.07, 0.05, 0.09);
    heartShape.bezierCurveTo(0.02, 0.1, 0, 0.07, 0, 0.05);
    heartShape.bezierCurveTo(0, 0.07, -0.02, 0.1, -0.05, 0.09);
    heartShape.bezierCurveTo(-0.1, 0.07, -0.08, -0.01, 0, -0.06);
    const heartGeo = new THREE.ExtrudeGeometry(heartShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 2,
    });
    heartGeo.center();
    const heartMat = new THREE.MeshPhysicalMaterial({
      color: 0xf43f5e,
      emissive: 0x881337,
      emissiveIntensity: 0.35,
      roughness: 0.18,
      clearcoat: 0.9,
    });
    const hL = new THREE.Mesh(heartGeo, heartMat);
    hL.scale.setScalar(1.48);
    hL.position.set(-0.185, 0.07, 0.6);
    const hR = new THREE.Mesh(heartGeo, heartMat);
    hR.scale.setScalar(1.48);
    hR.position.set(0.185, 0.07, 0.6);
    hearts.add(hL, hR);
    this.disposables.push(heartGeo, heartMat);

    // 2. Tears (glossy curved droplets)
    const tears = createGroup();
    const tearGeo = new THREE.SphereGeometry(0.055, 14, 12);
    const tearMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.25,
      roughness: 0.12,
      clearcoat: 0.95,
    });
    const tL = new THREE.Mesh(tearGeo, tearMat);
    tL.scale.set(0.85, 1.75, 0.75);
    tL.position.set(-0.255, -0.05, 0.56);
    const tR = new THREE.Mesh(tearGeo, tearMat);
    tR.scale.set(0.85, 1.75, 0.75);
    tR.position.set(0.255, -0.05, 0.56);
    tears.add(tL, tR);
    this.disposables.push(tearGeo, tearMat);

    // 3. Steam puffs
    const steam = createGroup();
    const puffGeo = new THREE.SphereGeometry(0.095, 14, 12);
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.85,
      transparent: true,
      opacity: 0.88,
    });
    [-1, 1].forEach((s) => {
      const p1 = new THREE.Mesh(puffGeo, puffMat);
      p1.position.set(s * 0.62, 0.42, 0.06);
      const p2 = new THREE.Mesh(puffGeo, puffMat);
      p2.scale.setScalar(0.7);
      p2.position.set(s * 0.72, 0.56, 0.06);
      steam.add(p1, p2);
    });
    this.disposables.push(puffGeo, puffMat);

    // 4. ZZZ Sleep glyphs
    const zzz = createGroup();
    const zBarGeo = new THREE.BoxGeometry(0.11, 0.025, 0.025);
    const zMat = new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: 0x2563eb,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    [0, 1, 2].forEach((idx) => {
      const zUnit = new THREE.Group();
      const top = new THREE.Mesh(zBarGeo, zMat);
      top.position.y = 0.04;
      const diag = new THREE.Mesh(zBarGeo, zMat);
      diag.rotation.z = 0.68;
      diag.scale.x = 1.2;
      const bot = new THREE.Mesh(zBarGeo, zMat);
      bot.position.y = -0.04;
      zUnit.add(top, diag, bot);
      zUnit.position.set(0.45 + idx * 0.14, 0.48 + idx * 0.16, 0.15);
      zUnit.scale.setScalar(0.75 + idx * 0.25);
      zzz.add(zUnit);
    });
    this.disposables.push(zBarGeo, zMat);

    // 5. Thought Speech Bubble `...`
    const thought = createGroup();
    const bubbleGeo = new THREE.SphereGeometry(0.18, 20, 16);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
    });
    const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    bubble.scale.set(1.3, 0.85, 0.45);
    bubble.position.set(0.58, 0.56, 0.15);
    thought.add(bubble);
    const dotGeo = new THREE.SphereGeometry(0.028, 10, 10);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    [-0.08, 0, 0.08].forEach((dx) => {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(0.58 + dx, 0.56, 0.23);
      thought.add(dot);
    });
    this.disposables.push(bubbleGeo, bubbleMat, dotGeo, dotMat);

    // 6. Sweat Drop
    const sweat = createGroup();
    const swDrop = new THREE.Mesh(tearGeo, tearMat);
    swDrop.scale.set(1.1, 1.5, 0.8);
    swDrop.position.set(0.42, 0.28, 0.42);
    sweat.add(swDrop);

    // 7. Sparkles
    const sparkles = createGroup();
    const spkGeo = new THREE.OctahedronGeometry(0.075, 0);
    const spkMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.7,
      roughness: 0.2,
    });
    [
      [-0.55, 0.42, 0.22],
      [0.58, 0.36, 0.22],
      [0.0, 0.72, 0.12],
    ].forEach(([x, y, z]) => {
      const s = new THREE.Mesh(spkGeo, spkMat);
      s.scale.set(0.85, 1.35, 0.4);
      s.position.set(x, y, z);
      sparkles.add(s);
    });
    this.disposables.push(spkGeo, spkMat);

    // 8. Shock Lines
    const shockLines = createGroup();
    const spikeGeo = new THREE.ConeGeometry(0.035, 0.22, 6);
    const spikeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sp = new THREE.Mesh(spikeGeo, spikeMat);
      sp.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0);
      sp.rotation.z = a - Math.PI / 2;
      shockLines.add(sp);
    }
    this.disposables.push(spikeGeo, spikeMat);

    // 9. Fire Embers
    const fire = createGroup();
    const emberGeo = new THREE.ConeGeometry(0.08, 0.24, 10);
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.9,
      roughness: 0.35,
    });
    [
      [-0.52, -0.1, -0.1],
      [0.52, -0.05, -0.1],
      [-0.32, 0.56, -0.08],
      [0.34, 0.58, -0.08],
    ].forEach(([x, y, z]) => {
      const em = new THREE.Mesh(emberGeo, emberMat);
      em.position.set(x, y, z);
      fire.add(em);
    });
    this.disposables.push(emberGeo, emberMat);

    // 10. Question Mark
    const question = createGroup();
    const qCurveGeo = new THREE.TorusGeometry(0.085, 0.028, 10, 20, Math.PI * 1.45);
    const qMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.3,
    });
    const qTop = new THREE.Mesh(qCurveGeo, qMat);
    qTop.position.set(0.55, 0.58, 0.15);
    qTop.rotation.z = -0.5;
    const qDot = new THREE.Mesh(dotGeo, qMat);
    qDot.position.set(0.55, 0.42, 0.15);
    question.add(qTop, qDot);
    this.disposables.push(qCurveGeo, qMat);

    // 11. Halo
    const halo = createGroup();
    const haloGeo = new THREE.TorusGeometry(0.32, 0.038, 14, 36);
    const haloMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xeab308,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.4,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.rotation.x = Math.PI / 2 - 0.1;
    haloMesh.position.set(0, 0.72, 0);
    halo.add(haloMesh);
    this.disposables.push(haloGeo, haloMat);

    // 12. Star Eyes
    const starEyes = createGroup();
    const sL = new THREE.Mesh(spkGeo, spkMat);
    sL.scale.set(1.65, 1.65, 0.4);
    sL.position.set(-0.185, 0.07, 0.6);
    const sR = new THREE.Mesh(spkGeo, spkMat);
    sR.scale.set(1.65, 1.65, 0.4);
    sR.position.set(0.185, 0.07, 0.6);
    starEyes.add(sL, sR);

    // 13. Sculpted Multi-Part 3D Sunglasses (acetate frames, glossy dark lenses, brushed gold bridge & hinges, temple arms, specular sheen)
    const sunglasses = createGroup();
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.36,
      metalness: 0.14,
    });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0x060913,
      roughness: 0.06,
      metalness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.6,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.22,
      metalness: 0.9,
    });
    const glintMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
    });

    // Cute rounded wayfarer lens silhouette with subtle outer flare
    const makeLensShape = (w: number, h: number, r: number) => {
      const s = new THREE.Shape();
      const hw = w / 2;
      const hh = h / 2;
      s.moveTo(-hw + r, hh);
      s.lineTo(hw - r, hh);
      s.quadraticCurveTo(hw, hh, hw, hh - r);
      s.lineTo(hw * 0.92, -hh + r);
      s.quadraticCurveTo(hw * 0.9, -hh, hw * 0.9 - r, -hh);
      s.lineTo(-hw * 0.9 + r, -hh);
      s.quadraticCurveTo(-hw * 0.9, -hh, -hw * 0.92, -hh + r);
      s.lineTo(-hw, hh - r);
      s.quadraticCurveTo(-hw, hh, -hw + r, hh);
      return s;
    };

    const outerFrameGeo = new THREE.ExtrudeGeometry(makeLensShape(0.32, 0.25, 0.068), {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 3,
    });
    outerFrameGeo.center();

    const innerLensGeo = new THREE.ExtrudeGeometry(makeLensShape(0.255, 0.19, 0.052), {
      depth: 0.03,
      bevelEnabled: false,
    });
    innerLensGeo.center();

    const bridgeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.12, 10);
    const rivetGeo = new THREE.BoxGeometry(0.03, 0.014, 0.016);
    const templeGeo = new THREE.BoxGeometry(0.024, 0.036, 0.62);
    const glintGeo = new THREE.PlaneGeometry(0.034, 0.14);

    [-1, 1].forEach((side) => {
      const eyeX = side * 0.188;
      const lensUnit = new THREE.Group();
      lensUnit.position.set(eyeX, 0.072, 0.645);
      lensUnit.rotation.y = side * 0.09;

      const rim = new THREE.Mesh(outerFrameGeo, frameMat);
      rim.castShadow = true;
      const lens = new THREE.Mesh(innerLensGeo, lensMat);
      lens.position.z = 0.005;

      const rivet = new THREE.Mesh(rivetGeo, trimMat);
      rivet.position.set(side * 0.135, 0.075, 0.022);

      const glint = new THREE.Mesh(glintGeo, glintMat);
      glint.position.set(-0.045, 0.015, 0.022);
      glint.rotation.z = -0.45;

      lensUnit.add(rim, lens, rivet, glint);
      sunglasses.add(lensUnit);

      // Curved temple arm hugging cleanly outside the chubby cranium toward ear
      const arm = new THREE.Mesh(templeGeo, frameMat);
      arm.position.set(side * 0.505, 0.09, 0.365);
      arm.rotation.y = -side * 0.5;
      arm.castShadow = true;
      sunglasses.add(arm);
    });

    // Brushed metallic nose bridge connecting left and right rims
    const bridge = new THREE.Mesh(bridgeGeo, trimMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.105, 0.655);
    sunglasses.add(bridge);

    this.disposables.push(
      frameMat,
      lensMat,
      trimMat,
      glintMat,
      outerFrameGeo,
      innerLensGeo,
      bridgeGeo,
      rivetGeo,
      templeGeo,
      glintGeo
    );

    // 14. Jeweled 3D Royal King Crown (multi-part brushed gold arches, ermine band, crimson velvet cap, gemstones)
    const kingThrone = createGroup();
    const crownGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.2,
      metalness: 0.92,
    });
    const crownVelvetMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.88,
      metalness: 0.04,
    });
    const ermineMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.92,
      metalness: 0.02,
    });
    const ermineSpotMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.78,
    });
    const rubyMat = new THREE.MeshPhysicalMaterial({
      color: 0xe11d48,
      emissive: 0x881337,
      emissiveIntensity: 0.25,
      roughness: 0.08,
      clearcoat: 1.0,
    });
    const sapphireMat = new THREE.MeshPhysicalMaterial({
      color: 0x2563eb,
      emissive: 0x1e3a8a,
      emissiveIntensity: 0.25,
      roughness: 0.08,
      clearcoat: 1.0,
    });

    const crownAssembly = new THREE.Group();
    crownAssembly.position.set(0, 0.46, 0.01);
    crownAssembly.rotation.x = -0.08;
    crownAssembly.scale.setScalar(0.84);

    // Plush ermine headband cuff
    const cuffGeo = new THREE.TorusGeometry(0.285, 0.052, 12, 32);
    const cuff = new THREE.Mesh(cuffGeo, ermineMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.castShadow = true;
    crownAssembly.add(cuff);

    // Subtle ermine tail-tip spots around the fur cuff
    const spotGeo = new THREE.SphereGeometry(0.015, 8, 8);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spot = new THREE.Mesh(spotGeo, ermineSpotMat);
      spot.scale.set(0.7, 1.3, 0.7);
      spot.position.set(Math.cos(a) * 0.332, 0, Math.sin(a) * 0.332);
      crownAssembly.add(spot);
    }

    // Flared gold crown circlet
    const bandGeo = new THREE.CylinderGeometry(0.35, 0.295, 0.14, 24, 1, true);
    const bandMatDouble = crownGoldMat.clone();
    bandMatDouble.side = THREE.DoubleSide;
    const band = new THREE.Mesh(bandGeo, bandMatDouble);
    band.position.y = 0.095;
    band.castShadow = true;
    crownAssembly.add(band);

    // Crimson velvet royal dome inside the crown
    const capGeo = new THREE.SphereGeometry(0.275, 20, 14);
    const cap = new THREE.Mesh(capGeo, crownVelvetMat);
    cap.scale.set(1.06, 0.72, 1.06);
    cap.position.y = 0.14;
    crownAssembly.add(cap);

    // 6 sculpted gold spires + pearls + alternating ruby/sapphire band gems
    const spireGeo = new THREE.ConeGeometry(0.048, 0.13, 8);
    const pearlGeo = new THREE.SphereGeometry(0.026, 10, 10);
    const gemGeo = new THREE.OctahedronGeometry(0.032, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const spire = new THREE.Mesh(spireGeo, crownGoldMat);
      spire.position.set(Math.cos(a) * 0.325, 0.21, Math.sin(a) * 0.325);
      spire.rotation.z = -Math.cos(a) * 0.18;
      spire.rotation.x = Math.sin(a) * 0.18;
      crownAssembly.add(spire);

      const pearl = new THREE.Mesh(pearlGeo, crownGoldMat);
      pearl.position.set(Math.cos(a) * 0.34, 0.28, Math.sin(a) * 0.34);
      crownAssembly.add(pearl);

      const gem = new THREE.Mesh(gemGeo, i % 2 === 0 ? rubyMat : sapphireMat);
      gem.scale.set(0.85, 1.15, 0.65);
      gem.position.set(Math.cos(a) * 0.335, 0.095, Math.sin(a) * 0.335);
      gem.lookAt(Math.cos(a) * 2, 0.095, Math.sin(a) * 2);
      crownAssembly.add(gem);
    }

    // Dual crossed imperial gold arches + monde orb finial at crown apex
    const archGeo = new THREE.TorusGeometry(0.29, 0.018, 8, 28, Math.PI);
    const arch1 = new THREE.Mesh(archGeo, crownGoldMat);
    arch1.position.y = 0.15;
    const arch2 = new THREE.Mesh(archGeo, crownGoldMat);
    arch2.position.y = 0.15;
    arch2.rotation.y = Math.PI / 2;
    const apexOrbGeo = new THREE.SphereGeometry(0.045, 14, 12);
    const apexOrb = new THREE.Mesh(apexOrbGeo, rubyMat);
    apexOrb.position.y = 0.45;
    const crossVGeo = new THREE.BoxGeometry(0.022, 0.08, 0.022);
    const crossHGeo = new THREE.BoxGeometry(0.06, 0.022, 0.022);
    const crossV = new THREE.Mesh(crossVGeo, crownGoldMat);
    crossV.position.y = 0.515;
    const crossH = new THREE.Mesh(crossHGeo, crownGoldMat);
    crossH.position.y = 0.522;
    crownAssembly.add(arch1, arch2, apexOrb, crossV, crossH);

    kingThrone.add(crownAssembly);

    // 14. 70s Disco Afro Hair + Golden Star Hair Pick (discoClub)
    const discoClub = new THREE.Group();
    const afroHairMat = new THREE.MeshStandardMaterial({
      color: 0x26152f,
      roughness: 0.9,
      metalness: 0.04,
    });
    const afroHighlightMat = new THREE.MeshStandardMaterial({
      color: 0x4a2259,
      roughness: 0.86,
      metalness: 0.06,
    });
    const discoHairGroup = new THREE.Group();
    discoHairGroup.position.set(0, 0.25, -0.05);

    const afroMainGeo = new THREE.SphereGeometry(0.58, 22, 18);
    const afroMain = new THREE.Mesh(afroMainGeo, afroHairMat);
    afroMain.scale.set(1.12, 0.92, 1.02);
    afroMain.castShadow = true;
    discoHairGroup.add(afroMain);

    const curlGeo = new THREE.SphereGeometry(0.21, 14, 12);
    const curlCoords: Array<[number, number, number, number]> = [
      [-0.48, 0.06, 0.14, 1.05],
      [0.48, 0.06, 0.14, 1.05],
      [-0.44, 0.28, 0.02, 1.0],
      [0.44, 0.28, 0.02, 1.0],
      [-0.24, 0.44, 0.12, 1.06],
      [0.24, 0.44, 0.12, 1.06],
      [0, 0.49, 0.08, 1.12],
      [-0.36, 0.34, -0.26, 0.95],
      [0.36, 0.34, -0.26, 0.95],
      [0, 0.38, -0.4, 1.02],
      [-0.48, -0.04, -0.22, 0.92],
      [0.48, -0.04, -0.22, 0.92],
      [-0.26, 0.14, -0.48, 0.96],
      [0.26, 0.14, -0.48, 0.96],
    ];
    curlCoords.forEach(([cx, cy, cz, sc], idx) => {
      const curl = new THREE.Mesh(curlGeo, idx % 3 === 0 ? afroHighlightMat : afroHairMat);
      curl.position.set(cx, cy, cz);
      curl.scale.setScalar(sc);
      curl.castShadow = true;
      discoHairGroup.add(curl);
    });

    // Sparkly Gold Disco Star Hair Comb tucked at upper right temple
    const starCombGeo = new THREE.OctahedronGeometry(0.11, 0);
    const combMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.18,
      metalness: 0.92,
    });
    const comb = new THREE.Mesh(starCombGeo, combMat);
    comb.scale.set(1.1, 1.1, 0.35);
    comb.position.set(0.42, 0.34, 0.26);
    comb.rotation.z = -0.35;
    discoHairGroup.add(comb);

    discoClub.add(discoHairGroup);

    this.disposables.push(
      crownGoldMat,
      bandMatDouble,
      crownVelvetMat,
      ermineMat,
      ermineSpotMat,
      rubyMat,
      sapphireMat,
      cuffGeo,
      spotGeo,
      bandGeo,
      capGeo,
      spireGeo,
      pearlGeo,
      gemGeo,
      archGeo,
      apexOrbGeo,
      crossVGeo,
      crossHGeo,
      afroHairMat,
      afroHighlightMat,
      combMat,
      afroMainGeo,
      curlGeo,
      starCombGeo
    );

    return {
      hearts,
      tears,
      steam,
      zzz,
      thought,
      sweat,
      sparkles,
      shockLines,
      fire,
      question,
      halo,
      starEyes,
      sunglasses,
      kingThrone,
      discoClub,
    };
  }

  private buildKingThroneAndFashion(goldBaseMat: THREE.Material): void {
    const velvetMat = new THREE.MeshStandardMaterial({
      color: 0x9f1239,
      roughness: 0.86,
      metalness: 0.05,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x3b1812,
      roughness: 0.42,
      metalness: 0.15,
    });
    const royalGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.22,
      metalness: 0.9,
    });
    const ermineMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.92,
      metalness: 0.02,
    });
    const spotMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.78,
    });
    const rubyMat = new THREE.MeshPhysicalMaterial({
      color: 0xe11d48,
      emissive: 0x881337,
      emissiveIntensity: 0.3,
      roughness: 0.08,
      clearcoat: 1.0,
    });

    // --- A. ROYAL KING CHAIR (anchored on turntable at y = 0.145) ---
    this.throneGroup.position.set(0, 0.145, 0);
    this.throneGroup.visible = false;
    this.root.add(this.throneGroup);

    // Stepped royal carpet dais
    const daisGeo = new THREE.CylinderGeometry(0.84, 0.88, 0.07, 40);
    const daisTrimGeo = new THREE.TorusGeometry(0.85, 0.022, 10, 48);
    const dais = new THREE.Mesh(daisGeo, velvetMat);
    dais.position.y = 0.035;
    dais.receiveShadow = true;
    const daisTrim = new THREE.Mesh(daisTrimGeo, royalGoldMat);
    daisTrim.rotation.x = Math.PI / 2;
    daisTrim.position.y = 0.068;
    this.throneGroup.add(dais, daisTrim);

    // 4 carved throne legs
    const legPostGeo = new THREE.CylinderGeometry(0.058, 0.045, 0.26, 12);
    [
      [-0.48, -0.38],
      [0.48, -0.38],
      [-0.48, 0.3],
      [0.48, 0.3],
    ].forEach(([lx, lz]) => {
      const legPost = new THREE.Mesh(legPostGeo, royalGoldMat);
      legPost.position.set(lx, 0.17, lz);
      legPost.castShadow = true;
      this.throneGroup.add(legPost);
    });

    // Carved mahogany seat frame + deep crimson plush cushion (top at y = 0.375 above dais base = 0.52 world)
    const seatFrameGeo = new THREE.BoxGeometry(1.14, 0.11, 0.84);
    const seatFrame = new THREE.Mesh(seatFrameGeo, darkWoodMat);
    seatFrame.position.set(0, 0.29, -0.04);
    seatFrame.castShadow = true;
    const seatCushionGeo = new THREE.BoxGeometry(1.02, 0.09, 0.74);
    const seatCushion = new THREE.Mesh(seatCushionGeo, velvetMat);
    seatCushion.position.set(0, 0.335, -0.02);
    seatCushion.receiveShadow = true;
    this.throneGroup.add(seatFrame, seatCushion);

    // Tall high-back throne pilasters, crimson velvet panel & crown crest arch
    const postGeo = new THREE.CylinderGeometry(0.055, 0.065, 1.54, 14);
    [-0.53, 0.53].forEach((px) => {
      const post = new THREE.Mesh(postGeo, royalGoldMat);
      post.position.set(px, 1.06, -0.54);
      post.castShadow = true;
      this.throneGroup.add(post);

      const postCap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), royalGoldMat);
      postCap.position.set(px, 1.85, -0.54);
      this.throneGroup.add(postCap);
      this.disposables.push(postCap.geometry);
    });

    const backPanelGeo = new THREE.BoxGeometry(1.02, 1.4, 0.1);
    const backPanel = new THREE.Mesh(backPanelGeo, darkWoodMat);
    backPanel.position.set(0, 1.04, -0.56);
    backPanel.castShadow = true;

    const backVelvetGeo = new THREE.BoxGeometry(0.92, 1.32, 0.08);
    const backVelvet = new THREE.Mesh(backVelvetGeo, velvetMat);
    backVelvet.position.set(0, 1.04, -0.51);
    backVelvet.receiveShadow = true;
    this.throneGroup.add(backPanel, backVelvet);

    // Gold quilted button studs on backrest
    const studGeo = new THREE.SphereGeometry(0.026, 10, 8);
    [-0.24, 0, 0.24].forEach((sx) => {
      [0.74, 1.04, 1.34].forEach((sy) => {
        const stud = new THREE.Mesh(studGeo, royalGoldMat);
        stud.position.set(sx, sy, -0.468);
        this.throneGroup.add(stud);
      });
    });

    // Arched royal crest header + sunburst jewel behind character crown
    const archFrameGeo = new THREE.TorusGeometry(0.52, 0.052, 12, 32, Math.PI);
    const archFrame = new THREE.Mesh(archFrameGeo, royalGoldMat);
    archFrame.position.set(0, 1.7, -0.54);
    const archVelvetGeo = new THREE.CircleGeometry(0.49, 28, 0, Math.PI);
    const archVelvet = new THREE.Mesh(archVelvetGeo, velvetMat);
    archVelvet.position.set(0, 1.7, -0.50);
    const crestJewelGeo = new THREE.OctahedronGeometry(0.095, 0);
    const crestJewel = new THREE.Mesh(crestJewelGeo, rubyMat);
    crestJewel.scale.set(1, 1.3, 0.55);
    crestJewel.position.set(0, 1.98, -0.48);
    this.throneGroup.add(archFrame, archVelvet, crestJewel);

    // Sculpted gold scroll armrests
    const armRestGeo = new THREE.BoxGeometry(0.14, 0.075, 0.68);
    const armPillarGeo = new THREE.CylinderGeometry(0.042, 0.048, 0.25, 10);
    const armScrollGeo = new THREE.SphereGeometry(0.075, 12, 10);
    [-0.54, 0.54].forEach((ax) => {
      const rest = new THREE.Mesh(armRestGeo, royalGoldMat);
      rest.position.set(ax, 0.56, -0.08);
      rest.castShadow = true;
      const pillar = new THREE.Mesh(armPillarGeo, darkWoodMat);
      pillar.position.set(ax, 0.42, 0.2);
      const scroll = new THREE.Mesh(armScrollGeo, royalGoldMat);
      scroll.position.set(ax, 0.56, 0.27);
      this.throneGroup.add(rest, pillar, scroll);
    });

    // Jeweled Royal Scepter leaning against right throne armrest
    const scepterGroup = new THREE.Group();
    scepterGroup.position.set(0.62, 0.6, 0.26);
    scepterGroup.rotation.z = -0.18;
    scepterGroup.rotation.x = 0.08;
    const rodGeo = new THREE.CylinderGeometry(0.022, 0.028, 1.05, 12);
    const rod = new THREE.Mesh(rodGeo, royalGoldMat);
    const orbGeo = new THREE.SphereGeometry(0.078, 16, 14);
    const orb = new THREE.Mesh(orbGeo, rubyMat);
    orb.position.y = 0.54;
    const ringGeo = new THREE.TorusGeometry(0.085, 0.018, 8, 24);
    const ring = new THREE.Mesh(ringGeo, royalGoldMat);
    ring.position.y = 0.54;
    const tipGeo = new THREE.OctahedronGeometry(0.055, 0);
    const tip = new THREE.Mesh(tipGeo, royalGoldMat);
    tip.position.y = 0.65;
    scepterGroup.add(rod, orb, ring, tip);
    this.throneGroup.add(scepterGroup);

    // --- B. KING FASHION OUTFIT ON TORSO (Ermine Cape Mantle + Royal Gold Chain & Medallion) ---
    this.kingFashionGroup.visible = false;
    this.torsoGroup.add(this.kingFashionGroup);

    // Regal crimson velvet cape draping cleanly along back in front of throne cushion
    const capeGeo = new THREE.CylinderGeometry(
      0.47,
      0.48,
      0.56,
      24,
      1,
      true,
      Math.PI * 0.72,
      Math.PI * 0.56
    );
    const capeDoubleMat = velvetMat.clone();
    capeDoubleMat.side = THREE.DoubleSide;
    const capeMesh = new THREE.Mesh(capeGeo, capeDoubleMat);
    capeMesh.position.set(0, -0.02, 0.02);
    capeMesh.castShadow = true;
    this.kingFashionGroup.add(capeMesh);

    // Plush white ermine fur shoulder mantle collar
    const mantleGeo = new THREE.TorusGeometry(0.41, 0.075, 12, 32);
    const mantleMesh = new THREE.Mesh(mantleGeo, ermineMat);
    mantleMesh.rotation.x = Math.PI / 2 + 0.14;
    mantleMesh.position.set(0, 0.27, 0.02);
    mantleMesh.scale.set(1.18, 1.05, 0.9);
    mantleMesh.castShadow = true;
    this.kingFashionGroup.add(mantleMesh);

    // Ermine fur spots along shoulder collar
    const mantleSpotGeo = new THREE.SphereGeometry(0.018, 8, 8);
    [-0.36, -0.22, 0.22, 0.36].forEach((mx) => {
      const sp = new THREE.Mesh(mantleSpotGeo, spotMat);
      sp.scale.set(0.8, 1.4, 0.7);
      sp.position.set(mx, 0.26, 0.33 - Math.abs(mx) * 0.25);
      this.kingFashionGroup.add(sp);
    });

    // Heavy royal gold chain of office + ruby emblem pendant across chest
    const chainGeo = new THREE.TorusGeometry(0.36, 0.028, 10, 32, Math.PI * 1.15);
    const chainMesh = new THREE.Mesh(chainGeo, goldBaseMat);
    chainMesh.rotation.x = Math.PI / 2 - 0.55;
    chainMesh.rotation.z = -Math.PI * 0.075;
    chainMesh.position.set(0, 0.17, 0.14);
    const medallionRimGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.028, 20);
    const medallionRim = new THREE.Mesh(medallionRimGeo, royalGoldMat);
    medallionRim.rotation.x = Math.PI / 2;
    medallionRim.position.set(0, 0.04, 0.48);
    const medallionGemGeo = new THREE.OctahedronGeometry(0.055, 0);
    const medallionGem = new THREE.Mesh(medallionGemGeo, rubyMat);
    medallionGem.scale.set(1, 1, 0.5);
    medallionGem.position.set(0, 0.04, 0.50);
    this.kingFashionGroup.add(chainMesh, medallionRim, medallionGem);

    this.disposables.push(
      velvetMat,
      capeDoubleMat,
      darkWoodMat,
      royalGoldMat,
      ermineMat,
      spotMat,
      rubyMat,
      daisGeo,
      daisTrimGeo,
      legPostGeo,
      seatFrameGeo,
      seatCushionGeo,
      postGeo,
      backPanelGeo,
      backVelvetGeo,
      studGeo,
      archFrameGeo,
      archVelvetGeo,
      crestJewelGeo,
      armRestGeo,
      armPillarGeo,
      armScrollGeo,
      rodGeo,
      orbGeo,
      ringGeo,
      tipGeo,
      capeGeo,
      mantleGeo,
      mantleSpotGeo,
      chainGeo,
      medallionRimGeo,
      medallionGemGeo
    );
  }

  private buildDiscoFashion(goldBaseMat: THREE.Material): void {
    this.discoShirtGroup.visible = false;
    this.torsoGroup.add(this.discoShirtGroup);

    // Shimmering 70s satin magenta-violet disco shirt material
    const satinShirtMat = new THREE.MeshPhysicalMaterial({
      color: 0xc026d3,
      roughness: 0.24,
      metalness: 0.38,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
      sheen: 1.0,
      sheenColor: new THREE.Color(0x38bdf8),
      side: THREE.DoubleSide,
    });
    const lapelMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
      metalness: 0.15,
      clearcoat: 0.7,
    });
    const discoGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xb45309,
      emissiveIntensity: 0.22,
      roughness: 0.18,
      metalness: 0.94,
    });
    const neonCyanMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.55,
    });

    // Open-V satin disco shirt wrapping torso cleanly
    const shirtBodyGeo = new THREE.CylinderGeometry(
      0.445,
      0.485,
      0.56,
      28,
      1,
      false,
      0.34,
      Math.PI * 2 - 0.68
    );
    const shirtBody = new THREE.Mesh(shirtBodyGeo, satinShirtMat);
    shirtBody.position.set(0, -0.01, 0.01);
    shirtBody.castShadow = true;
    this.discoShirtGroup.add(shirtBody);

    // Lower buttoned shirt hem wrap around waist
    const waistWrapGeo = new THREE.CylinderGeometry(0.478, 0.475, 0.22, 28);
    const waistWrap = new THREE.Mesh(waistWrapGeo, satinShirtMat);
    waistWrap.position.set(0, -0.19, 0.01);
    this.discoShirtGroup.add(waistWrap);

    // Wide pointed 70s disco shirt collar lapels flanking open V-neck
    const lapelGeo = new THREE.BoxGeometry(0.18, 0.34, 0.045);
    [-1, 1].forEach((side) => {
      const lapel = new THREE.Mesh(lapelGeo, lapelMat);
      lapel.position.set(side * 0.15, 0.17, 0.415);
      lapel.rotation.z = side * -0.44;
      lapel.rotation.y = side * 0.28;
      lapel.rotation.x = -0.18;
      lapel.castShadow = true;
      this.discoShirtGroup.add(lapel);
    });

    // High flared back collar stand
    const collarRimGeo = new THREE.TorusGeometry(0.36, 0.046, 10, 24, Math.PI * 1.15);
    const collarRim = new THREE.Mesh(collarRimGeo, lapelMat);
    collarRim.rotation.x = Math.PI / 2 - 0.15;
    collarRim.rotation.z = -Math.PI * 0.075;
    collarRim.position.set(0, 0.28, -0.02);
    this.discoShirtGroup.add(collarRim);

    // Gold Disco Chain + Sparkling Star Pendant in open V-collar
    const chainGeo = new THREE.TorusGeometry(0.28, 0.018, 8, 28, Math.PI * 1.05);
    const chainMesh = new THREE.Mesh(chainGeo, goldBaseMat);
    chainMesh.rotation.x = Math.PI / 2 - 0.58;
    chainMesh.rotation.z = -Math.PI * 0.025;
    chainMesh.position.set(0, 0.2, 0.22);
    const starPendantGeo = new THREE.OctahedronGeometry(0.068, 0);
    const starPendant = new THREE.Mesh(starPendantGeo, discoGoldMat);
    starPendant.scale.set(1.05, 1.25, 0.45);
    starPendant.position.set(0, 0.07, 0.465);
    this.discoShirtGroup.add(chainMesh, starPendant);

    // Neon Cyan & Gold Disco Waist Belt
    const beltGeo = new THREE.TorusGeometry(0.478, 0.032, 10, 32);
    const belt = new THREE.Mesh(beltGeo, neonCyanMat);
    belt.rotation.x = Math.PI / 2;
    belt.position.set(0, -0.16, 0.01);
    const buckleGeo = new THREE.BoxGeometry(0.14, 0.09, 0.05);
    const buckle = new THREE.Mesh(buckleGeo, discoGoldMat);
    buckle.position.set(0, -0.16, 0.485);
    this.discoShirtGroup.add(belt, buckle);

    // Disco shirt sleeves + flared white cuffs mounted directly on articulated armL / armR
    const sleeveGeo = new THREE.CylinderGeometry(0.118, 0.138, 0.26, 16);
    const cuffGeo = new THREE.TorusGeometry(0.135, 0.024, 8, 20);
    const buildSleeve = (grp: THREE.Group) => {
      grp.visible = false;
      const sleeve = new THREE.Mesh(sleeveGeo, satinShirtMat);
      sleeve.position.set(0, -0.12, 0);
      sleeve.castShadow = true;
      const cuff = new THREE.Mesh(cuffGeo, lapelMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.set(0, -0.24, 0);
      grp.add(sleeve, cuff);
    };
    this.armL.add(this.discoSleeveL);
    this.armR.add(this.discoSleeveR);
    buildSleeve(this.discoSleeveL);
    buildSleeve(this.discoSleeveR);

    this.disposables.push(
      satinShirtMat,
      lapelMat,
      discoGoldMat,
      neonCyanMat,
      shirtBodyGeo,
      waistWrapGeo,
      lapelGeo,
      collarRimGeo,
      chainGeo,
      starPendantGeo,
      beltGeo,
      buckleGeo,
      sleeveGeo,
      cuffGeo
    );
  }

  public update(
    target: ExpressionParams,
    dt: number,
    elapsed: number,
    playing: boolean,
    wearSunglasses = false
  ): void {
    const lambda = 10;
    const clampedDt = Math.min(dt, 0.12);

    // Smoothly damp facial expression parameters
    this.state.browTilt = THREE.MathUtils.damp(this.state.browTilt, target.browTilt, lambda, clampedDt);
    this.state.browHeight = THREE.MathUtils.damp(this.state.browHeight, target.browHeight, lambda, clampedDt);
    this.state.eyeOpenL = THREE.MathUtils.damp(this.state.eyeOpenL, target.eyeOpenL, lambda, clampedDt);
    this.state.eyeOpenR = THREE.MathUtils.damp(this.state.eyeOpenR, target.eyeOpenR, lambda, clampedDt);
    this.state.pupilScale = THREE.MathUtils.damp(this.state.pupilScale, target.pupilScale, lambda, clampedDt);
    this.state.gazeX = THREE.MathUtils.damp(this.state.gazeX, target.gazeX, lambda, clampedDt);
    this.state.gazeY = THREE.MathUtils.damp(this.state.gazeY, target.gazeY, lambda, clampedDt);
    this.state.mouthSmile = THREE.MathUtils.damp(this.state.mouthSmile, target.mouthSmile, lambda, clampedDt);
    this.state.mouthOpen = THREE.MathUtils.damp(this.state.mouthOpen, target.mouthOpen, lambda, clampedDt);
    this.state.cheekPuff = THREE.MathUtils.damp(this.state.cheekPuff, target.cheekPuff, lambda, clampedDt);
    this.state.blush = THREE.MathUtils.damp(this.state.blush, target.blush, lambda, clampedDt);
    this.state.headTiltX = THREE.MathUtils.damp(this.state.headTiltX, target.headTiltX, lambda, clampedDt);
    this.state.headTiltY = THREE.MathUtils.damp(this.state.headTiltY, target.headTiltY, lambda, clampedDt);
    this.state.headTiltZ = THREE.MathUtils.damp(this.state.headTiltZ, target.headTiltZ, lambda, clampedDt);
    this.state.faceTint = THREE.MathUtils.damp(
      this.state.faceTint,
      target.faceTintIntensity || 0,
      lambda,
      clampedDt
    );

    // Natural periodic auto-blink when at least one eye is open (100% full lid closure)
    if (playing) {
      if (target.eyeOpenL > 0.2 || target.eyeOpenR > 0.2) {
        this.blinkTimer -= clampedDt;
        if (this.blinkTimer <= 0) {
          this.blinkTimer = 2.8 + (Math.sin(elapsed * 3.1) + 1) * 1.1;
          this.blinkAmount = 1;
        }
      }
      this.blinkAmount = THREE.MathUtils.damp(this.blinkAmount, 0, 22, clampedDt);
    } else {
      this.blinkAmount = 0;
    }

    // Royal King Throne 5-stage choreography OR Clubbing Disco Dance
    const isKing = target.vfxProp === 'kingThrone';
    const isDisco = target.vfxProp === 'discoClub';
    if (isKing && !this.wasKingThrone) {
      this.kingSeqTime = 0;
    }
    this.wasKingThrone = isKing;
    if (isKing && playing) {
      this.kingSeqTime += clampedDt;
    }

    const t = elapsed * target.tempo;
    let bodyX = 0;
    let bodyY = 0.16;
    let bodyZ = 0;
    let bodyRotY = 0;
    let headDynX = 0;
    let headDynY = 0;
    let headDynZ = 0;

    // Default articulated leg/tail parameters (possibly driven by king or disco choreography below)
    let legSwingL = 0;
    let legSwingR = 0;
    let legSpread = target.browTilt < -0.45 || target.handPose === 'fists' ? 0.08 : 0.02;
    let tailWagY = 0;
    let tailCurlX = 0;

    this.kingWalkActive = false;
    this.kingWalkStrength = 0;

    if (isDisco && playing) {
      // Rhythmic Saturday-Night-Fever Disco Clubbing Groove
      const beat = t * 4.8;
      bodyX = Math.sin(beat * 0.5) * 0.22;
      bodyY = 0.16 + Math.abs(Math.sin(beat)) * 0.11;
      bodyZ = Math.cos(beat * 0.5) * 0.05;
      bodyRotY = Math.sin(beat * 0.5) * 0.42;
      headDynX = Math.sin(beat * 2) * 0.08;
      headDynZ = Math.sin(beat * 0.5) * 0.14;

      legSwingL = Math.sin(beat) * 0.36;
      legSwingR = -Math.sin(beat) * 0.36;
      legSpread = 0.1 + Math.abs(Math.cos(beat * 0.5)) * 0.12;
      tailWagY = Math.sin(beat) * 0.48;
      tailCurlX = 0.12 + Math.abs(Math.sin(beat)) * 0.14;
    } else if (isDisco) {
      legSpread = 0.12;
      tailWagY = 0.2;
    } else if (isKing && playing) {
      const cycleDuration = 10.8;
      const phaseT = this.kingSeqTime % cycleDuration;
      const cx = 0.04;
      const cz = -0.12;
      const rx = 1.18;
      const rz = 1.04;
      const theta0 = 0.26;
      const startX = cx + Math.sin(theta0) * rx;
      const startZ = cz + Math.cos(theta0) * rz;
      const walkYawEdge = Math.atan2(Math.cos(theta0) * rx, -Math.sin(theta0) * rz);

      if (phaseT < 4.2) {
        // Stage 1: Walk smoothly all the way around the outside of the King Chair
        const u = smoothstep(0.0, 4.2, phaseT);
        const theta = theta0 + u * Math.PI * 2;
        bodyX = cx + Math.sin(theta) * rx;
        bodyZ = cz + Math.cos(theta) * rz;
        const dx = Math.cos(theta) * rx;
        const dz = -Math.sin(theta) * rz;
        bodyRotY = Math.atan2(dx, dz);

        const rampIn = smoothstep(0.0, 0.3, phaseT);
        const walkPhase = phaseT * 9.2;
        const stride = Math.sin(walkPhase) * 0.56 * rampIn;
        bodyY = 0.15 + Math.abs(Math.sin(walkPhase)) * 0.042 * rampIn;
        legSwingL = stride;
        legSwingR = -stride;
        legSpread = 0.06;
        tailWagY = Math.sin(walkPhase * 0.85) * 0.34;
        tailCurlX = 0.08 + Math.abs(Math.sin(walkPhase)) * 0.1;
        headDynZ = Math.sin(walkPhase * 0.5) * 0.04;
        headDynX = 0.04 + Math.abs(Math.sin(walkPhase)) * 0.03;

        this.kingWalkActive = true;
        this.kingWalkPhase = walkPhase;
        this.kingWalkStrength = rampIn;
      } else if (phaseT < 5.1) {
        // Stage 2: Step up onto crimson carpet dais in front of throne & pivot forward
        const u = smoothstep(4.2, 5.1, phaseT);
        bodyX = THREE.MathUtils.lerp(startX, 0, u);
        bodyZ = THREE.MathUtils.lerp(startZ, 0.38, u);
        bodyRotY = lerpAngle(walkYawEdge, 0, u);

        const rampOut = 1 - smoothstep(4.2, 4.85, phaseT);
        const walkPhase = phaseT * 9.2;
        const stepArc = Math.sin(u * Math.PI) * 0.045;
        bodyY = THREE.MathUtils.lerp(0.15, 0.215, u) + stepArc + Math.abs(Math.sin(walkPhase)) * 0.03 * rampOut;
        legSwingL = Math.sin(walkPhase) * 0.52 * rampOut;
        legSwingR = -Math.sin(walkPhase) * 0.52 * rampOut;
        legSpread = 0.06 + 0.06 * u;
        tailWagY = Math.sin(walkPhase * 0.85) * 0.22 * rampOut;
        tailCurlX = 0.05 * rampOut;

        this.kingWalkActive = rampOut > 0.05;
        this.kingWalkPhase = walkPhase;
        this.kingWalkStrength = rampOut;
      } else if (phaseT < 5.8) {
        // Stage 3: Glide backward and sit smoothly onto the plush crimson cushion
        const u = smoothstep(5.1, 5.8, phaseT);
        bodyX = 0;
        bodyZ = THREE.MathUtils.lerp(0.38, 0, u);
        bodyY = THREE.MathUtils.lerp(0.215, 0.16, u) - Math.sin(u * Math.PI) * 0.014;
        bodyRotY = 0;

        legSwingL = -1.24 * u;
        legSwingR = -1.24 * u;
        legSpread = 0.12 + 0.1 * u;
        tailWagY = 0.68 * u;
        tailCurlX = -0.18 * u;
        headDynX = Math.sin(u * Math.PI) * 0.06;
      } else if (phaseT < 9.9) {
        // Stage 4: Seated Sovereign King Reign
        bodyX = 0;
        bodyZ = 0;
        bodyY = 0.16 + Math.sin(t * 2.1) * 0.006;
        bodyRotY = 0;
        headDynX = Math.sin(t * 2.4) * 0.055;
        headDynZ = Math.sin(t * 1.4) * 0.04;

        const kick = Math.sin(t * 2.6) * 0.06;
        legSwingL = -1.24 + kick;
        legSwingR = -1.24 - kick;
        legSpread = 0.22;
        tailWagY = 0.68 + Math.sin(t * 2.2) * 0.12;
        tailCurlX = -0.18;
      } else {
        // Stage 5: Stand up & step off dais to seamlessly begin the next walk loop
        const u = smoothstep(9.9, cycleDuration, phaseT);
        const uRise = smoothstep(0.0, 0.52, u);
        const uStep = smoothstep(0.42, 1.0, u);

        bodyX = THREE.MathUtils.lerp(0, startX, uStep);
        bodyZ = THREE.MathUtils.lerp(0, 0.38, uRise) + THREE.MathUtils.lerp(0, startZ - 0.38, uStep);
        bodyY =
          THREE.MathUtils.lerp(0.16, 0.215, uRise) -
          THREE.MathUtils.lerp(0, 0.065, uStep) +
          Math.sin(uStep * Math.PI) * 0.04;
        bodyRotY = lerpAngle(0, walkYawEdge, uStep);

        const walkPhase = phaseT * 9.2;
        const rampWalk = smoothstep(0.55, 1.0, u);
        legSwingL = -1.24 * (1 - uRise) + Math.sin(walkPhase) * 0.45 * rampWalk;
        legSwingR = -1.24 * (1 - uRise) - Math.sin(walkPhase) * 0.45 * rampWalk;
        legSpread = 0.22 * (1 - uStep) + 0.06 * uStep;
        tailWagY = 0.68 * (1 - uRise) + Math.sin(walkPhase * 0.85) * 0.25 * rampWalk;
        tailCurlX = -0.18 * (1 - uRise);

        this.kingWalkActive = rampWalk > 0.05;
        this.kingWalkPhase = walkPhase;
        this.kingWalkStrength = rampWalk;
      }
    } else if (isKing) {
      // Paused snapshot: cleanly seated in the King Chair
      const kick = 0;
      legSwingL = -1.24 + kick;
      legSwingR = -1.24 - kick;
      legSpread = 0.22;
      tailWagY = 0.68;
      tailCurlX = -0.18;
    } else if (playing) {
      switch (target.motionPattern) {
        case 'bounce':
          bodyY += Math.abs(Math.sin(t * 4.2)) * 0.09;
          headDynX = Math.sin(t * 4.2) * 0.05;
          break;
        case 'laughShake':
          bodyY += Math.abs(Math.sin(t * 7)) * 0.05;
          headDynX = Math.sin(t * 14) * 0.08;
          headDynZ = Math.cos(t * 9) * 0.05;
          break;
        case 'rageTremble':
          headDynY = Math.sin(t * 28) * 0.04;
          headDynZ = Math.cos(t * 32) * 0.03;
          bodyY += Math.sin(t * 24) * 0.015;
          break;
        case 'nod':
          headDynX = Math.sin(t * 4.5) * 0.15;
          break;
        case 'headshake':
          headDynY = Math.sin(t * 4.8) * 0.22;
          break;
        case 'sway':
          headDynZ = Math.sin(t * 2.2) * 0.08;
          bodyRotY = Math.sin(t * 1.4) * 0.12;
          break;
        case 'spinPop':
          bodyRotY = (t * 2.2) % (Math.PI * 2);
          bodyY += Math.abs(Math.sin(t * 3.5)) * 0.07;
          break;
        case 'float':
          bodyY += Math.sin(t * 2.0) * 0.055 + 0.03;
          break;
        case 'peek':
          bodyY += Math.sin(t * 2.4) * 0.08 - 0.04;
          break;
        case 'idle':
        default:
          bodyY += Math.sin(t * 1.8) * 0.015;
          break;
      }
    }

    this.characterGroup.position.set(bodyX, bodyY, bodyZ);
    this.characterGroup.rotation.y = bodyRotY;

    // Keep contact shadow tucked beneath character during walk or seated beneath throne
    const shadowDist = Math.hypot(bodyX, bodyZ);
    this.contactShadow.position.set(
      bodyX,
      isKing && shadowDist < 0.78 ? 0.216 : 0.155,
      bodyZ
    );
    this.contactShadow.scale.setScalar(isKing && this.kingWalkActive ? 0.72 : 1);

    // Head rotation
    this.headGroup.rotation.set(
      this.state.headTiltX + headDynX,
      this.state.headTiltY + headDynY,
      this.state.headTiltZ + headDynZ
    );

    // Eyebrows
    this.browL.position.y = 0.24 + this.state.browHeight * 0.075;
    this.browR.position.y = 0.24 + this.state.browHeight * 0.075;
    this.browL.rotation.z = this.state.browTilt * 0.45;
    this.browR.rotation.z = -this.state.browTilt * 0.45;

    // Brow & face tint (crimson rage flush!)
    _baseSkinColor.set(this.baseSkinHex);
    _tmpColor.copy(_baseSkinColor).lerp(_angerTintColor, this.state.faceTint * 0.55);
    this.skinMat.color.copy(_tmpColor);
    _tmpColor.copy(_baseSkinColor).offsetHSL(0, 0, -0.06).lerp(_angerTintColor, this.state.faceTint * 0.48);
    this.lidMat.color.copy(_tmpColor);
    _tmpColor.set(this.baseFurHex).offsetHSL(0, 0.05, -0.08).lerp(_angerTintColor, this.state.faceTint * 0.75);
    this.browMat.color.copy(_tmpColor);

    // Eyes, pupils, eyelids (0 = 100% watertight seal, 1.0 = balanced wide open, 1.4 = wide shocked)
    const blinkFactor = 1 - this.blinkAmount;
    const effOpenL = THREE.MathUtils.clamp(this.state.eyeOpenL * blinkFactor, 0, 1.4);
    const effOpenR = THREE.MathUtils.clamp(this.state.eyeOpenR * blinkFactor, 0, 1.4);

    const upperLidAngle = (open: number) =>
      open <= 1
        ? 0.28 - open * 1.0
        : -0.72 - (open - 1) * 0.8;
    const lowerLidAngle = (open: number) =>
      open <= 1
        ? 0.28 + open * 0.4
        : 0.68 + (open - 1) * 0.4;

    this.upperLidL.rotation.x = upperLidAngle(effOpenL);
    this.upperLidR.rotation.x = upperLidAngle(effOpenR);
    this.lowerLidL.rotation.x = lowerLidAngle(effOpenL);
    this.lowerLidR.rotation.x = lowerLidAngle(effOpenR);

    this.eyePivotL.rotation.set(-this.state.gazeY * 0.35, this.state.gazeX * 0.45, 0);
    this.eyePivotR.rotation.set(-this.state.gazeY * 0.35, this.state.gazeX * 0.45, 0);
    this.pupilL.scale.set(this.state.pupilScale, this.state.pupilScale, 1);
    this.pupilR.scale.set(this.state.pupilScale, this.state.pupilScale, 1);

    // Cheeks & blush
    const cheekScale = 1 + this.state.cheekPuff * 0.42;
    this.cheekL.scale.set(cheekScale, cheekScale, cheekScale * 0.9);
    this.cheekR.scale.set(cheekScale, cheekScale, cheekScale * 0.9);
    this.blushMat.opacity = this.state.blush * 0.72;
    this.blushMat.color.copy(_blushTintColor);

    // Mouth & Jaw
    this.jawGroup.rotation.x = this.state.mouthOpen * 0.62;
    this.jawGroup.position.y = -0.23 - this.state.mouthOpen * 0.045;
    this.upperLipGroup.rotation.z = 0;
    const smileCurve = this.state.mouthSmile;
    this.upperLipGroup.scale.set(1 + smileCurve * 0.14, 1, 1);
    this.jawGroup.scale.set(1 + smileCurve * 0.12, 1, 1);
    // Flip lower lip smile direction smoothly
    const lipMesh = this.jawGroup.children[0];
    if (lipMesh) {
      lipMesh.rotation.z = smileCurve >= 0 ? Math.PI : 0;
      lipMesh.position.y = smileCurve >= 0 ? -0.01 : -0.05;
    }

    // Ear expressiveness
    const earPerk = this.state.browHeight * 0.16;
    this.earL.rotation.z = (this.characterId === 'kitsune' ? 0.32 : 0) - earPerk;
    this.earR.rotation.z = (this.characterId === 'kitsune' ? -0.32 : 0) + earPerk;

    // Articulated Legs & Tail Kinematics (preserving kingThrone & discoClub choreography when active)
    if (!isKing && !isDisco) {
      if (target.handPose === 'wave' || target.handPose === 'peace') {
        legSpread = 0.05;
      }

      if (playing) {
        switch (target.motionPattern) {
          case 'bounce':
          case 'laughShake':
            legSwingL = Math.sin(t * 6.5) * 0.16;
            legSwingR = -Math.sin(t * 6.5) * 0.16;
            tailWagY = Math.sin(t * 7.5) * 0.34;
            tailCurlX = Math.abs(Math.sin(t * 7.5)) * 0.14;
            break;
          case 'rageTremble':
            legSpread = 0.14;
            legSwingL = Math.sin(t * 22) * 0.05;
            legSwingR = -Math.sin(t * 22) * 0.05;
            tailWagY = Math.sin(t * 20) * 0.22;
            tailCurlX = 0.28; // bristled upright
            break;
          case 'float':
            legSwingL = 0.14 + Math.sin(t * 2.0) * 0.08;
            legSwingR = 0.14 - Math.sin(t * 2.0) * 0.08;
            tailWagY = Math.sin(t * 2.1) * 0.18;
            tailCurlX = -0.12;
            break;
          case 'spinPop':
            legSwingL = Math.sin(t * 8) * 0.22;
            legSwingR = -Math.sin(t * 8) * 0.22;
            tailWagY = Math.sin(t * 9) * 0.4;
            break;
          default:
            tailWagY = Math.sin(t * 2.6) * 0.22;
            tailCurlX = Math.sin(t * 1.8) * 0.06;
            break;
        }
      } else {
        tailWagY = 0.12;
      }
    }

    this.legL.rotation.set(legSwingL, 0, -legSpread);
    this.legR.rotation.set(legSwingR, 0, legSpread);
    this.tailGroup.rotation.set(tailCurlX, tailWagY, 0);

    // Full-Body Torso Counterbalance following head & emote reaction
    let torsoRotX = this.state.headTiltX * 0.22;
    let torsoRotY = this.state.headTiltY * 0.2;
    let torsoRotZ = -this.state.headTiltZ * 0.16;

    if (target.handPose === 'facepalm') {
      torsoRotX += 0.1;
      torsoRotZ += 0.04;
    } else if (target.handPose === 'fists') {
      torsoRotX += 0.09;
    } else if (target.handPose === 'chinThink') {
      torsoRotX += 0.05;
      torsoRotY -= 0.08;
    } else if (target.handPose === 'wave') {
      torsoRotZ += 0.06;
      torsoRotY -= 0.06;
    } else if (target.handPose === 'thumbsUp') {
      torsoRotX -= 0.04;
      torsoRotY += 0.08;
    } else if (target.handPose === 'cheeks') {
      torsoRotX -= 0.04;
    } else if (target.handPose === 'salute') {
      torsoRotX -= 0.05;
    }

    if (playing) {
      if (target.motionPattern === 'laughShake') {
        torsoRotX -= 0.08 + Math.sin(t * 14) * 0.045;
      } else if (target.motionPattern === 'rageTremble') {
        torsoRotY += Math.sin(t * 24) * 0.04;
      } else if (target.motionPattern === 'sway') {
        torsoRotZ += Math.sin(t * 2.2) * 0.06;
      } else if (target.motionPattern === 'bounce') {
        torsoRotX += Math.sin(t * 4.2) * 0.04;
      }
    }

    this.torsoGroup.rotation.set(
      THREE.MathUtils.damp(this.torsoGroup.rotation.x, torsoRotX, 10, clampedDt),
      THREE.MathUtils.damp(this.torsoGroup.rotation.y, torsoRotY, 10, clampedDt),
      THREE.MathUtils.damp(this.torsoGroup.rotation.z, torsoRotZ, 10, clampedDt)
    );

    // Articulated 2-Bone Arm, Elbow, Wrist & Finger Poses
    this.applyHandPose(target, t, playing, clampedDt);

    // VFX Props Visibility & Motion (allow manual sunglasses overlay on top of any emote)
    this.applyVfxProps(target.vfxProp, t, playing, wearSunglasses);
  }

  private applyHandPose(
    target: ExpressionParams,
    t: number,
    playing: boolean,
    dt: number
  ): void {
    const pose: HandPose = target.handPose;
    const breath = playing ? Math.sin(t * 2.4) : 0;
    const bounceWave = playing ? Math.sin(t * 5.2) : 0;
    const fastShake = playing ? Math.sin(t * 18) : 0;

    // Clavicle/shoulder anchors widened to frame chubby plush torso cleanly
    let shLX = -0.49;
    let shLY = 0.16 + breath * 0.012;
    let shLZ = 0.03;
    let shRX = 0.49;
    let shRY = 0.16 + breath * 0.012;
    let shRZ = 0.03;

    // Default relaxed balanced stance that reacts to emotion & motionPattern
    let sLrx = -0.14 + breath * 0.03;
    let sLry = 0.08;
    let sLrz = -0.18;
    let eLrx = -0.35;
    let eLrz = 0.05;
    let hLrx = 0;
    let hLry = 0;
    let hLrz = 0;

    let sRrx = -0.14 - breath * 0.03;
    let sRry = -0.08;
    let sRrz = 0.18;
    let eRrx = -0.35;
    let eRrz = -0.05;
    let hRrx = 0;
    let hRry = 0;
    let hRrz = 0;

    // Finger curls: [index, middle, ring, pinky], 0 = open flat, 1.38 = curled fist
    let curlL: [number, number, number, number] = [0.22, 0.25, 0.28, 0.32];
    let curlR: [number, number, number, number] = [0.22, 0.25, 0.28, 0.32];
    let thumbLRotX = -0.25;
    let thumbLRotZ = 0.15;
    let thumbRRotX = -0.25;
    let thumbRRotZ = -0.15;
    let peaceSpreadR = 0;

    // Disco Fever Sky-Point & Groove OR Royal Walk/Throne when pose === 'none'
    if (pose === 'none' && target.vfxProp === 'discoClub') {
      const beat = playing ? t * 4.8 : 0.4;
      const rightLeads = Math.sin(beat * 0.25) >= 0;
      const pump = Math.sin(beat * 2) * 0.16;
      if (rightLeads) {
        // Classic Saturday-Night-Fever right arm diagonal sky point + left hand on hip
        shRY += 0.06;
        sRrx = -2.28 + pump; sRry = -0.18; sRrz = 0.56; eRrx = -0.16; eRrz = 0.1;
        hRry = 0.25; curlR = [0.0, 1.38, 1.38, 1.38];
        thumbRRotX = -0.25;
        sLrx = -0.25; sLry = 0.12; sLrz = -0.58; eLrx = -1.18; eLrz = 0.25;
        curlL = [0.65, 0.7, 0.75, 0.8];
      } else {
        // Mirror bar: left arm sky point + right arm disco hustle pump
        shLY += 0.06;
        sLrx = -2.28 + pump; sLry = 0.18; sLrz = -0.56; eLrx = -0.16; eLrz = -0.1;
        hLry = -0.25; curlL = [0.0, 1.38, 1.38, 1.38];
        thumbLRotX = -0.25;
        sRrx = -0.58 + Math.sin(beat) * 0.22; sRry = 0.25; sRrz = 0.42; eRrx = -1.08; eRrz = -0.35;
        curlR = [0.0, 1.38, 1.38, 1.38];
      }
    } else if (pose === 'none' && target.vfxProp === 'kingThrone' && this.kingWalkActive) {
      const armSwing = Math.sin(this.kingWalkPhase) * 0.46 * this.kingWalkStrength;
      // Left arm swings opposite left leg (forward when right leg leads)
      sLrx = -0.18 - armSwing; sLry = 0.08; sLrz = -0.22; eLrx = -0.44; eLrz = 0.08;
      curlL = [0.28, 0.32, 0.36, 0.4];
      // Right arm swings naturally opposite right leg
      sRrx = -0.18 + armSwing; sRry = -0.08; sRrz = 0.22; eRrx = -0.44; eRrz = -0.08;
      curlR = [0.28, 0.32, 0.36, 0.4];
    } else if (pose === 'none' && target.vfxProp === 'kingThrone') {
      shLX = -0.5; shRY += 0.02; shRX = 0.5;
      // Left paw rests comfortably on left golden armrest
      sLrx = -0.45; sLry = 0.1; sLrz = -0.34; eLrx = -0.82; eLrz = 0.15;
      hLrx = 0.25; curlL = [0.35, 0.38, 0.42, 0.45];
      // Right paw hovers proudly toward royal scepter / relaxed royal gesture
      sRrx = -0.62; sRry = -0.12; sRrz = 0.36; eRrx = -1.05 + bounceWave * 0.04; eRrz = -0.14;
      hRrx = 0.15; hRry = 0.25; curlR = [0.75, 0.82, 0.9, 0.95];
    } else if (pose === 'none') {
      const isShocked = target.mouthOpen > 0.45 && target.browHeight > 0.35;
      const isAngry = target.browTilt < -0.45;
      const isShyOrSad = target.browTilt > 0.35 || target.blush > 0.55;
      const isJoyful = target.mouthSmile > 0.55;

      if (isShocked) {
        // Startled hands flared out with splayed fingers
        shLY += 0.04;
        shRY += 0.04;
        sLrx = -0.45; sLrz = -0.58; eLrx = -0.78;
        sRrx = -0.45; sRrz = 0.58; eRrx = -0.78;
        hLry = -0.6; hRry = 0.6;
        curlL = [0.02, 0.02, 0.02, 0.02];
        curlR = [0.02, 0.02, 0.02, 0.02];
      } else if (isAngry) {
        // Tense bent elbows & semi-clenched hands
        shLY += 0.03;
        shRY += 0.03;
        sLrx = -0.32 + fastShake * 0.04; sLrz = -0.28; eLrx = -0.82;
        sRrx = -0.32 - fastShake * 0.04; sRrz = 0.28; eRrx = -0.82;
        curlL = [1.15, 1.2, 1.25, 1.3];
        curlR = [1.15, 1.2, 1.25, 1.3];
      } else if (isShyOrSad) {
        // Hands tucked gently inward near lower chest
        shLX = -0.45; shRX = 0.45;
        shLZ = 0.08; shRZ = 0.08;
        sLrx = -0.42; sLrz = 0.04; eLrx = -0.75; eLrz = 0.24;
        sRrx = -0.42; sRrz = -0.04; eRrx = -0.75; eRrz = -0.24;
        curlL = [0.45, 0.48, 0.52, 0.55];
        curlR = [0.45, 0.48, 0.52, 0.55];
      } else if (isJoyful) {
        // Buoyant happy arm swing synced with bounce/laugh
        const swing = playing ? Math.sin(t * 4.5) * 0.16 : 0.06;
        sLrx = -0.22 + swing; sLrz = -0.28; eLrx = -0.58;
        sRrx = -0.22 - swing; sRrz = 0.28; eRrx = -0.58;
        curlL = [0.15, 0.18, 0.2, 0.22];
        curlR = [0.15, 0.18, 0.2, 0.22];
      } else {
        // Calm idle counterbalance
        const sway = playing ? Math.sin(t * 2.1) * 0.08 : 0;
        sLrx = -0.12 + sway; sLrz = -0.18; eLrx = -0.34;
        sRrx = -0.12 - sway; sRrz = 0.18; eRrx = -0.34;
      }
    }

    switch (pose) {
      case 'wave':
        // Right arm raised beside head & forward of ears, palm facing viewer
        shRY += 0.04;
        shRZ += 0.06;
        sRrx = -0.42; sRry = -0.52; sRrz = 1.85;
        eRrx = -0.22; eRrz = 0.78 + bounceWave * 0.28;
        hRry = Math.PI / 2; hRrz = bounceWave * 0.2;
        curlR = [0.02, 0.02, 0.02, 0.02];
        thumbRRotX = -0.35;
        // Left arm relaxed hip balance
        sLrx = -0.14; sLrz = -0.24; eLrx = -0.42;
        break;

      case 'thumbsUp':
        // Right forearm forward, fist curled, thumb straight up (+Y)
        shRZ += 0.07;
        sRrx = -0.68; sRrz = 0.18;
        eRrx = -0.92 + bounceWave * 0.07; eRrz = -0.08;
        hRrx = 0.05; hRry = 0.25; hRrz = -0.1;
        curlR = [1.38, 1.38, 1.38, 1.38];
        thumbRRotX = -1.12; thumbRRotZ = -0.1;
        // Left counterbalance
        sLrx = 0.1; sLrz = -0.24; eLrx = -0.48;
        break;

      case 'doubleThumbs':
        shLZ += 0.07; shRZ += 0.07;
        sLrx = -0.68; sLrz = -0.18;
        eLrx = -0.92 + bounceWave * 0.07; eLrz = 0.08;
        hLrx = 0.05; hLry = -0.25; hLrz = 0.1;
        curlL = [1.38, 1.38, 1.38, 1.38];
        thumbLRotX = -1.12; thumbLRotZ = 0.1;

        sRrx = -0.68; sRrz = 0.18;
        eRrx = -0.92 - bounceWave * 0.07; eRrz = -0.08;
        hRrx = 0.05; hRry = 0.25; hRrz = -0.1;
        curlR = [1.38, 1.38, 1.38, 1.38];
        thumbRRotX = -1.12; thumbRRotZ = -0.1;
        break;

      case 'chinThink':
        // Right hand cups beneath chin while left arm crosses to support right elbow
        shRX = 0.44; shRY += 0.04; shRZ = 0.12;
        sRrx = -1.32; sRry = 0.15; sRrz = -0.12;
        eRrx = -1.12; eRrz = -0.56;
        hRrx = -0.25; hRry = 0.45; hRrz = 0.15;
        curlR = [0.25, 0.85, 1.15, 1.25];
        thumbRRotX = -0.7;

        shLX = -0.45; shLZ = 0.1;
        sLrx = -0.64; sLrz = 0.44;
        eLrx = -0.95; eLrz = 0.48;
        curlL = [0.45, 0.5, 0.55, 0.6];
        break;

      case 'fists':
        shLY += 0.04; shRY += 0.04;
        shLZ += 0.08; shRZ += 0.08;
        sLrx = -0.64 + fastShake * 0.05; sLrz = -0.2;
        eLrx = -1.28 + fastShake * 0.06; eLrz = 0.2;
        hLry = -0.45; hLrz = 0.15;
        curlL = [1.45, 1.45, 1.45, 1.45];
        thumbLRotX = 0.35; thumbLRotZ = 0.55;

        sRrx = -0.64 - fastShake * 0.05; sRrz = 0.2;
        eRrx = -1.28 - fastShake * 0.06; eRrz = -0.2;
        hRry = 0.45; hRrz = -0.15;
        curlR = [1.45, 1.45, 1.45, 1.45];
        thumbRRotX = 0.35; thumbRRotZ = -0.55;
        break;

      case 'facepalm':
        // Right palm rests cleanly in front of brow/eyes while left arm hangs in slump
        shRX = 0.45; shRY += 0.08; shRZ = 0.14;
        sRrx = -1.72; sRrz = 0.14;
        eRrx = -0.98; eRrz = -0.62;
        hRrx = -0.15; hRry = 0.65; hRrz = 0.1;
        curlR = [0.1, 0.1, 0.14, 0.18];

        sLrx = 0.06; sLrz = -0.16; eLrx = -0.22;
        break;

      case 'cheeks':
        // Both open palms frame the plush chubby cheeks symmetrically
        shLX = -0.47; shLY += 0.06; shLZ = 0.11;
        shRX = 0.47; shRY += 0.06; shRZ = 0.11;
        sLrx = -1.46; sLrz = -0.48;
        eLrx = -1.18; eLrz = 0.64;
        hLry = -0.35; hLrz = -0.1;
        curlL = [0.12, 0.12, 0.16, 0.2];

        sRrx = -1.46; sRrz = 0.48;
        eRrx = -1.18; eRrz = -0.64;
        hRry = 0.35; hRrz = 0.1;
        curlR = [0.12, 0.12, 0.16, 0.2];
        break;

      case 'salute':
        // Crisp brow salute with flat right hand reaching forward to right brow
        shRY += 0.06; shRZ += 0.1;
        sRrx = -0.35; sRry = -0.82; sRrz = 1.86;
        eRrx = -0.35; eRrz = 1.18;
        hRry = 0.95; hRrz = 0.2;
        curlR = [0.04, 0.04, 0.04, 0.04];

        sLrx = 0; sLrz = -0.14; eLrx = -0.14;
        curlL = [0.35, 0.4, 0.45, 0.5];
        break;

      case 'clap': {
        const clapGap = Math.abs(bounceWave) * 0.22;
        shLX = -0.44; shLZ = 0.12;
        shRX = 0.44; shRZ = 0.12;
        sLrx = -0.78; sLrz = 0.22 - clapGap;
        eLrx = -0.92; eLrz = 0.36 - clapGap;
        hLrx = 0.2;
        curlL = [0.06, 0.06, 0.08, 0.1];

        sRrx = -0.78; sRrz = -0.22 + clapGap;
        eRrx = -0.92; eRrz = -0.36 + clapGap;
        hRrx = 0.2;
        curlR = [0.06, 0.06, 0.08, 0.1];
        break;
      }

      case 'peace':
        // Raised V-sign facing viewer
        shRY += 0.02; shRZ += 0.05;
        sRrx = -0.72; sRrz = 0.96;
        eRrx = -0.95; eRrz = 0.65;
        hRry = 1.42; hRrz = bounceWave * 0.08;
        curlR = [0.0, 0.0, 1.38, 1.38]; // Index & middle extended!
        peaceSpreadR = 0.26;
        thumbRRotX = 0.2;
        sLrx = -0.14; sLrz = -0.24; eLrx = -0.42;
        break;

      case 'point':
        shRZ += 0.06;
        sRrx = -1.35; sRrz = -0.1;
        eRrx = -0.2;
        hRry = -0.15; hRrz = -0.1;
        curlR = [0.0, 1.38, 1.38, 1.38]; // Index finger points straight at viewer!
        thumbRRotX = -0.2;
        sLrx = 0.12; sLrz = -0.24; eLrx = -0.48;
        break;

      case 'none':
      default:
        break;
    }

    const k = 12;
    this.armL.position.set(
      THREE.MathUtils.damp(this.armL.position.x, shLX, k, dt),
      THREE.MathUtils.damp(this.armL.position.y, shLY, k, dt),
      THREE.MathUtils.damp(this.armL.position.z, shLZ, k, dt)
    );
    this.armR.position.set(
      THREE.MathUtils.damp(this.armR.position.x, shRX, k, dt),
      THREE.MathUtils.damp(this.armR.position.y, shRY, k, dt),
      THREE.MathUtils.damp(this.armR.position.z, shRZ, k, dt)
    );

    this.armL.rotation.set(
      THREE.MathUtils.damp(this.armL.rotation.x, sLrx, k, dt),
      THREE.MathUtils.damp(this.armL.rotation.y, sLry, k, dt),
      THREE.MathUtils.damp(this.armL.rotation.z, sLrz, k, dt)
    );
    this.elbowL.rotation.set(
      THREE.MathUtils.damp(this.elbowL.rotation.x, eLrx, k, dt),
      0,
      THREE.MathUtils.damp(this.elbowL.rotation.z, eLrz, k, dt)
    );
    this.handL.rotation.set(
      THREE.MathUtils.damp(this.handL.rotation.x, hLrx, k, dt),
      THREE.MathUtils.damp(this.handL.rotation.y, hLry, k, dt),
      THREE.MathUtils.damp(this.handL.rotation.z, hLrz, k, dt)
    );

    this.armR.rotation.set(
      THREE.MathUtils.damp(this.armR.rotation.x, sRrx, k, dt),
      THREE.MathUtils.damp(this.armR.rotation.y, sRry, k, dt),
      THREE.MathUtils.damp(this.armR.rotation.z, sRrz, k, dt)
    );
    this.elbowR.rotation.set(
      THREE.MathUtils.damp(this.elbowR.rotation.x, eRrx, k, dt),
      0,
      THREE.MathUtils.damp(this.elbowR.rotation.z, eRrz, k, dt)
    );
    this.handR.rotation.set(
      THREE.MathUtils.damp(this.handR.rotation.x, hRrx, k, dt),
      THREE.MathUtils.damp(this.handR.rotation.y, hRry, k, dt),
      THREE.MathUtils.damp(this.handR.rotation.z, hRrz, k, dt)
    );

    // Smooth finger & thumb articulation
    this.fingersL.forEach((f, idx) => {
      f.rotation.z = THREE.MathUtils.damp(f.rotation.z, curlL[idx], 14, dt);
    });
    this.fingersR.forEach((f, idx) => {
      f.rotation.z = THREE.MathUtils.damp(f.rotation.z, -curlR[idx], 14, dt);
      const spread = idx === 0 ? peaceSpreadR : idx === 1 ? -peaceSpreadR : 0;
      f.rotation.x = THREE.MathUtils.damp(f.rotation.x, spread, 14, dt);
    });

    this.handThumbL.rotation.x = THREE.MathUtils.damp(this.handThumbL.rotation.x, thumbLRotX, 14, dt);
    this.handThumbL.rotation.z = THREE.MathUtils.damp(this.handThumbL.rotation.z, thumbLRotZ, 14, dt);
    this.handThumbR.rotation.x = THREE.MathUtils.damp(this.handThumbR.rotation.x, thumbRRotX, 14, dt);
    this.handThumbR.rotation.z = THREE.MathUtils.damp(this.handThumbR.rotation.z, thumbRRotZ, 14, dt);
  }

  private applyVfxProps(
    prop: VfxProp,
    t: number,
    playing: boolean,
    wearSunglasses = false
  ): void {
    const isKing = prop === 'kingThrone';
    const isDisco = prop === 'discoClub';
    this.throneGroup.visible = isKing;
    this.kingFashionGroup.visible = isKing;
    this.discoShirtGroup.visible = isDisco;
    this.discoSleeveL.visible = isDisco;
    this.discoSleeveR.visible = isDisco;

    (Object.keys(this.vfxGroups) as Array<Exclude<VfxProp, 'none'>>).forEach(
      (key) => {
        this.vfxGroups[key].visible =
          key === prop || (key === 'sunglasses' && wearSunglasses);
      }
    );

    if (wearSunglasses || prop === 'sunglasses') {
      const shades = this.vfxGroups.sunglasses;
      shades.position.y = playing ? Math.sin(t * 3.5) * 0.004 : 0;
    }

    if (prop === 'none' || !playing) return;
    const active = this.vfxGroups[prop];

    if (prop === 'discoClub') {
      const hair = active.children[0];
      if (hair) {
        hair.scale.setScalar(1 + Math.abs(Math.sin(t * 4.8)) * 0.035);
      }
    } else if (prop === 'hearts') {
      const pulse = 1 + Math.sin(t * 5) * 0.12;
      active.children.forEach((c) => c.scale.setScalar(1.48 * pulse));
    } else if (prop === 'tears') {
      active.position.y = -((t * 0.16) % 0.12);
    } else if (prop === 'steam') {
      active.position.y = Math.sin(t * 6) * 0.06;
    } else if (prop === 'zzz') {
      active.position.y = Math.sin(t * 2.2) * 0.06;
    } else if (prop === 'sparkles' || prop === 'starEyes') {
      active.children.forEach((c, i) => {
        c.rotation.y = t * 2.5 + i;
      });
    } else if (prop === 'halo') {
      active.position.y = Math.sin(t * 2.4) * 0.04;
    } else if (prop === 'fire') {
      active.children.forEach((c, i) => {
        c.scale.y = 1 + Math.sin(t * 10 + i * 2) * 0.25;
      });
    } else if (prop === 'shockLines') {
      const s = 1 + Math.sin(t * 12) * 0.08;
      active.scale.setScalar(s);
    }
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
      }
    });
  }
}
