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

  // Dynamic VFX Props
  private readonly vfxRoot = new THREE.Group();
  private readonly vfxGroups: Record<Exclude<VfxProp, 'none'>, THREE.Group>;

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

    // 1. Studio Turntable Plinth (grounded at y = 0)
    const plinthPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(1.08, 0),
      new THREE.Vector2(1.06, 0.08),
      new THREE.Vector2(0.96, 0.12),
      new THREE.Vector2(0.92, 0.14),
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

    const topDiscGeo = new THREE.CircleGeometry(0.92, 48);
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
    const contactShadow = new THREE.Mesh(contactGeo, contactMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.155;
    this.root.add(contactShadow);
    this.disposables.push(plinthGeo, plinthMat, topDiscGeo, topDiscMat, contactGeo, contactMat);

    // Character group sits cleanly above the turntable
    this.characterGroup.position.set(0, 0.16, 0);
    this.root.add(this.characterGroup);

    // 2. Sculpted Torso & Collar (elevated to leave room for articulated legs)
    this.torsoGroup.position.set(0, 0.9, 0);
    this.characterGroup.add(this.torsoGroup);

    const torsoGeo = new THREE.CapsuleGeometry(0.42, 0.42, 12, 24);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.furMat);
    torsoMesh.scale.set(1.06, 1.0, 0.88);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torsoGroup.add(torsoMesh);

    // Chest patch
    const chestGeo = new THREE.SphereGeometry(0.32, 20, 16);
    const chestMesh = new THREE.Mesh(chestGeo, this.skinMat);
    chestMesh.scale.set(0.92, 1.05, 0.52);
    chestMesh.position.set(0, 0.02, 0.24);
    this.torsoGroup.add(chestMesh);

    // Brushed metallic NFT collar ring
    const collarGeo = new THREE.TorusGeometry(0.33, 0.042, 14, 36);
    const collarMesh = new THREE.Mesh(collarGeo, metalMat);
    collarMesh.rotation.x = Math.PI / 2 + 0.12;
    collarMesh.position.set(0, 0.36, 0.02);
    collarMesh.castShadow = true;
    this.torsoGroup.add(collarMesh);

    // Collar emblem tag
    const tagGeo = new THREE.OctahedronGeometry(0.065, 0);
    const tagMesh = new THREE.Mesh(tagGeo, metalMat);
    tagMesh.position.set(0, 0.3, 0.36);
    this.torsoGroup.add(tagMesh);
    this.disposables.push(torsoGeo, chestGeo, collarGeo, tagGeo);

    // 2b. Articulated Legs & Feet (feet soles flush at y = 0 inside characterGroup)
    this.buildLegs(innerEarMat);

    // 2c. Species-Specific Articulated Tail
    this.buildTail(characterId, innerEarMat);

    // 3. Head Group (parented to torsoGroup so torso counterbalance carries neck & head seamlessly)
    this.headGroup.position.set(0, 0.68, 0);
    this.torsoGroup.add(this.headGroup);

    const craniumGeo = new THREE.SphereGeometry(0.54, 32, 28);
    const craniumMesh = new THREE.Mesh(craniumGeo, this.furMat);
    craniumMesh.scale.set(
      characterId === 'axolotl' ? 1.12 : 1.02,
      characterId === 'kitsune' ? 0.98 : 1.0,
      0.98
    );
    craniumMesh.castShadow = true;
    craniumMesh.receiveShadow = true;
    this.headGroup.add(craniumMesh);
    this.disposables.push(craniumGeo);

    // Species-specific crown crest / tuft
    this.buildCrownCrest(characterId, innerEarMat);

    // Sculpted Face Mask & Muzzle
    const maskGeo = new THREE.SphereGeometry(0.42, 24, 20);
    const maskMesh = new THREE.Mesh(maskGeo, this.skinMat);
    maskMesh.scale.set(1.0, 0.86, 0.56);
    maskMesh.position.set(0, -0.02, 0.29);
    this.headGroup.add(maskMesh);

    const muzzleGeo = new THREE.SphereGeometry(0.28, 24, 20);
    const muzzleMesh = new THREE.Mesh(muzzleGeo, this.skinMat);
    muzzleMesh.scale.set(
      characterId === 'kitsune' ? 0.85 : 1.16,
      0.78,
      characterId === 'kitsune' ? 1.12 : 0.84
    );
    muzzleMesh.position.set(0, -0.17, 0.43);
    muzzleMesh.castShadow = true;
    this.headGroup.add(muzzleMesh);

    // Nose
    const noseGeo = new THREE.SphereGeometry(0.062, 16, 12);
    const noseMesh = new THREE.Mesh(noseGeo, innerEarMat);
    noseMesh.scale.set(1.25, 0.78, 0.8);
    noseMesh.position.set(0, -0.05, 0.65);
    this.headGroup.add(noseMesh);

    // Plush cheeks (scale up with cheekPuff)
    const cheekGeo = new THREE.SphereGeometry(0.14, 16, 14);
    this.cheekL = new THREE.Mesh(cheekGeo, this.skinMat);
    this.cheekL.position.set(-0.26, -0.14, 0.38);
    this.cheekR = new THREE.Mesh(cheekGeo, this.skinMat);
    this.cheekR.position.set(0.26, -0.14, 0.38);
    this.headGroup.add(this.cheekL, this.cheekR);

    // Blush overlays
    const blushGeo = new THREE.SphereGeometry(0.095, 14, 12);
    this.blushL = new THREE.Mesh(blushGeo, this.blushMat);
    this.blushL.scale.set(1.2, 0.7, 0.4);
    this.blushL.position.set(-0.28, -0.08, 0.49);
    this.blushR = new THREE.Mesh(blushGeo, this.blushMat);
    this.blushR.scale.set(1.2, 0.7, 0.4);
    this.blushR.position.set(0.28, -0.08, 0.49);
    this.headGroup.add(this.blushL, this.blushR);
    this.disposables.push(maskGeo, muzzleGeo, noseGeo, cheekGeo, blushGeo);

    // 4. Eyes + Concentric Spherical Iris/Pupil + Watertight Eyelids & Lash Rim
    const eyeRadius = 0.125;
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
      socket.position.set(xOffset, 0.08, 0.44);
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
      catchMain.position.set(-0.022, 0.022, eyeRadius * 1.005);
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

    this.pupilL = buildEye(-0.175, this.eyePivotL, this.upperLidL, this.lowerLidL);
    this.pupilR = buildEye(0.175, this.eyePivotR, this.upperLidR, this.lowerLidR);

    // 5. Sculpted Eyebrows
    const browGeo = new THREE.CapsuleGeometry(0.042, 0.14, 8, 14);
    const browMeshL = new THREE.Mesh(browGeo, this.browMat);
    browMeshL.rotation.z = Math.PI / 2;
    this.browL.add(browMeshL);
    this.browL.position.set(-0.18, 0.23, 0.49);

    const browMeshR = new THREE.Mesh(browGeo, this.browMat);
    browMeshR.rotation.z = Math.PI / 2;
    this.browR.add(browMeshR);
    this.browR.position.set(0.18, 0.23, 0.49);
    this.headGroup.add(this.browL, this.browR);
    this.disposables.push(browGeo);

    // 6. Articulated Mouth & Jaw
    const mouthCavityGeo = new THREE.SphereGeometry(0.14, 18, 12);
    const mouthCavity = new THREE.Mesh(mouthCavityGeo, mouthCavMat);
    mouthCavity.scale.set(1.3, 0.65, 0.45);
    mouthCavity.position.set(0, -0.23, 0.56);
    this.headGroup.add(mouthCavity);

    this.upperLipGroup.position.set(0, -0.21, 0.61);
    const upperTeethGeo = new THREE.BoxGeometry(0.22, 0.042, 0.05);
    const upperTeeth = new THREE.Mesh(upperTeethGeo, teethMat);
    upperTeeth.position.set(0, -0.01, -0.02);
    const upperLipGeo = new THREE.TorusGeometry(0.16, 0.025, 10, 20, Math.PI);
    const upperLip = new THREE.Mesh(upperLipGeo, this.skinMat);
    upperLip.rotation.z = Math.PI;
    upperLip.scale.set(1.15, 0.45, 1.0);
    this.upperLipGroup.add(upperTeeth, upperLip);
    this.headGroup.add(this.upperLipGroup);

    this.jawGroup.position.set(0, -0.23, 0.54);
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

    // 8. Articulated 2-Bone Arms (parented to torsoGroup: Shoulder -> Upper Arm -> Elbow -> Forearm -> Wrist -> 5 Digits)
    const upperArmGeo = new THREE.CapsuleGeometry(0.088, 0.2, 8, 14);
    const forearmGeo = new THREE.CapsuleGeometry(0.076, 0.18, 8, 14);
    const palmGeo = new THREE.SphereGeometry(0.088, 16, 14);
    const fingerGeo = new THREE.CapsuleGeometry(0.021, 0.068, 6, 10);
    const thumbGeo = new THREE.CapsuleGeometry(0.024, 0.056, 6, 10);
    this.disposables.push(upperArmGeo, forearmGeo, palmGeo, fingerGeo, thumbGeo);

    const buildArm = (
      side: -1 | 1,
      shoulderGrp: THREE.Group,
      elbowGrp: THREE.Group,
      handGrp: THREE.Group,
      fingerList: THREE.Group[]
    ): THREE.Group => {
      shoulderGrp.position.set(side * 0.41, 0.18, 0.02);
      this.torsoGroup.add(shoulderGrp);

      const upperMesh = new THREE.Mesh(upperArmGeo, this.furMat);
      upperMesh.position.set(0, -0.145, 0);
      upperMesh.castShadow = true;
      shoulderGrp.add(upperMesh);

      elbowGrp.position.set(0, -0.29, 0);
      shoulderGrp.add(elbowGrp);

      const foreMesh = new THREE.Mesh(forearmGeo, this.furMat);
      foreMesh.position.set(0, -0.135, 0);
      foreMesh.castShadow = true;
      elbowGrp.add(foreMesh);

      handGrp.position.set(0, -0.27, 0);
      elbowGrp.add(handGrp);

      const palm = new THREE.Mesh(palmGeo, this.skinMat);
      palm.scale.set(0.62, 1.05, 0.96);
      palm.position.set(0, -0.055, 0);
      palm.castShadow = true;
      handGrp.add(palm);

      const thumbPivot = new THREE.Group();
      thumbPivot.position.set(-side * 0.02, -0.035, 0.065);
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

    // 9. Build 3D VFX Props
    this.headGroup.add(this.vfxRoot);
    this.vfxGroups = this.buildVfxProps();

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
    const legGeo = new THREE.CapsuleGeometry(0.115, 0.24, 10, 16);
    const footGeo = new THREE.SphereGeometry(0.125, 18, 14);
    const toeGeo = new THREE.SphereGeometry(0.042, 12, 10);
    this.disposables.push(legGeo, footGeo, toeGeo);

    const setupLeg = (side: -1 | 1, grp: THREE.Group) => {
      // Hip pivot sits at bottom of torso
      grp.position.set(side * 0.22, 0.54, 0.02);
      this.characterGroup.add(grp);

      const thigh = new THREE.Mesh(legGeo, this.furMat);
      thigh.position.set(0, -0.22, 0);
      thigh.castShadow = true;
      thigh.receiveShadow = true;
      grp.add(thigh);

      const foot = new THREE.Mesh(footGeo, this.skinMat);
      foot.scale.set(1.02, 0.62, 1.36);
      foot.position.set(0, -0.46, 0.07);
      foot.castShadow = true;
      foot.receiveShadow = true;
      grp.add(foot);

      // Three sculpted toes at front of foot
      [-0.055, 0, 0.055].forEach((tx, idx) => {
        const toe = new THREE.Mesh(toeGeo, padMat);
        toe.scale.set(0.85, 0.75, 1.15);
        toe.position.set(tx, -0.49, 0.2 + (idx === 1 ? 0.015 : 0));
        grp.add(toe);
      });
    };

    setupLeg(-1, this.legL);
    setupLeg(1, this.legR);
  }

  private buildTail(characterId: CharacterId, accentMat: THREE.Material): void {
    this.tailGroup.position.set(0, -0.24, -0.34);
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
      const tuftGeo = new THREE.ConeGeometry(0.11, 0.28, 12);
      const t1 = new THREE.Mesh(tuftGeo, this.furMat);
      t1.position.set(0, 0.56, 0.06);
      t1.rotation.set(0.28, 0, -0.12);
      const t2 = new THREE.Mesh(tuftGeo, this.furMat);
      t2.scale.set(0.78, 0.8, 0.78);
      t2.position.set(-0.09, 0.53, 0.02);
      t2.rotation.set(0.15, 0, 0.35);
      const t3 = new THREE.Mesh(tuftGeo, this.furMat);
      t3.scale.set(0.7, 0.72, 0.7);
      t3.position.set(0.1, 0.52, 0.03);
      t3.rotation.set(0.2, 0, -0.4);
      this.headGroup.add(t1, t2, t3);
      this.disposables.push(tuftGeo);
    } else if (characterId === 'tanuki') {
      // Sprout leaf crest
      const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.18, 8);
      const leafGeo = new THREE.SphereGeometry(0.11, 14, 10);
      const stem = new THREE.Mesh(stemGeo, accentMat);
      stem.position.set(0, 0.56, 0.04);
      const leaf = new THREE.Mesh(leafGeo, accentMat);
      leaf.scale.set(1.4, 0.28, 0.85);
      leaf.position.set(0.08, 0.65, 0.06);
      leaf.rotation.z = -0.25;
      this.headGroup.add(stem, leaf);
      this.disposables.push(stemGeo, leafGeo);
    } else if (characterId === 'kitsune') {
      // Sleek brow diamond gem
      const gemGeo = new THREE.OctahedronGeometry(0.06, 0);
      const gem = new THREE.Mesh(gemGeo, accentMat);
      gem.scale.set(0.8, 1.3, 0.5);
      gem.position.set(0, 0.32, 0.5);
      this.headGroup.add(gem);
      this.disposables.push(gemGeo);
    } else {
      // Axolotl dorsal crest fin
      const finGeo = new THREE.ConeGeometry(0.09, 0.24, 10);
      const fin = new THREE.Mesh(finGeo, accentMat);
      fin.scale.set(0.45, 1.0, 1.4);
      fin.position.set(0, 0.56, -0.02);
      fin.rotation.x = -0.35;
      this.headGroup.add(fin);
      this.disposables.push(finGeo);
    }
  }

  private buildEars(characterId: CharacterId, innerMat: THREE.Material): void {
    this.headGroup.add(this.earL, this.earR);

    if (characterId === 'macaque') {
      const earGeo = new THREE.SphereGeometry(0.18, 18, 14);
      const earInGeo = new THREE.SphereGeometry(0.115, 16, 12);
      this.disposables.push(earGeo, earInGeo);

      const buildMacaqueEar = (side: -1 | 1, grp: THREE.Group) => {
        grp.position.set(side * 0.54, 0.04, -0.04);
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
        grp.position.set(side * 0.34, 0.46, -0.02);
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
      const earGeo = new THREE.SphereGeometry(0.16, 16, 14);
      const earInGeo = new THREE.SphereGeometry(0.09, 14, 12);
      this.disposables.push(earGeo, earInGeo);

      const buildTanukiEar = (side: -1 | 1, grp: THREE.Group) => {
        grp.position.set(side * 0.4, 0.42, 0);
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
      const frondGeo = new THREE.CapsuleGeometry(0.048, 0.24, 8, 12);
      this.disposables.push(frondGeo);

      const buildAxoGills = (side: -1 | 1, grp: THREE.Group) => {
        grp.position.set(side * 0.56, 0.05, 0.02);
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
    hL.scale.setScalar(1.45);
    hL.position.set(-0.175, 0.08, 0.57);
    const hR = new THREE.Mesh(heartGeo, heartMat);
    hR.scale.setScalar(1.45);
    hR.position.set(0.175, 0.08, 0.57);
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
    tL.position.set(-0.24, -0.05, 0.54);
    const tR = new THREE.Mesh(tearGeo, tearMat);
    tR.scale.set(0.85, 1.75, 0.75);
    tR.position.set(0.24, -0.05, 0.54);
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
    sL.scale.set(1.6, 1.6, 0.4);
    sL.position.set(-0.175, 0.08, 0.57);
    const sR = new THREE.Mesh(spkGeo, spkMat);
    sR.scale.set(1.6, 1.6, 0.4);
    sR.position.set(0.175, 0.08, 0.57);
    starEyes.add(sL, sR);

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
    };
  }

  public update(
    target: ExpressionParams,
    dt: number,
    elapsed: number,
    playing: boolean
  ): void {
    const lambda = 10;
    const clampedDt = Math.min(dt, 0.05);

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

    // Apply motion pattern offsets
    const t = elapsed * target.tempo;
    let bodyY = 0.16;
    let bodyRotY = 0;
    let headDynX = 0;
    let headDynY = 0;
    let headDynZ = 0;

    if (playing) {
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

    this.characterGroup.position.y = bodyY;
    this.characterGroup.rotation.y = bodyRotY;

    // Head rotation
    this.headGroup.rotation.set(
      this.state.headTiltX + headDynX,
      this.state.headTiltY + headDynY,
      this.state.headTiltZ + headDynZ
    );

    // Eyebrows
    this.browL.position.y = 0.23 + this.state.browHeight * 0.075;
    this.browR.position.y = 0.23 + this.state.browHeight * 0.075;
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

    // Articulated Legs & Tail Kinematics (with weight-shift balance for hand poses)
    let legSwingL = 0;
    let legSwingR = 0;
    let legSpread = target.browTilt < -0.45 || target.handPose === 'fists' ? 0.08 : 0.02;
    let tailWagY = 0;
    let tailCurlX = 0;

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

    // VFX Props Visibility & Motion
    this.applyVfxProps(target.vfxProp, t, playing);
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

    // Clavicle/shoulder anchors local to torsoGroup (with subtle scapula reach & breathing shrug)
    let shLX = -0.41;
    let shLY = 0.18 + breath * 0.012;
    let shLZ = 0.02;
    let shRX = 0.41;
    let shRY = 0.18 + breath * 0.012;
    let shRZ = 0.02;

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

    // Emotional automatic hand reaction when pose === 'none'
    if (pose === 'none') {
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
        shLX = -0.38; shRX = 0.38;
        shLZ = 0.05; shRZ = 0.05;
        sLrx = -0.42; sLrz = 0.06; eLrx = -0.75; eLrz = 0.26;
        sRrx = -0.42; sRrz = -0.06; eRrx = -0.75; eRrz = -0.26;
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
        shRZ += 0.05;
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
        shRZ += 0.05;
        sRrx = -0.68; sRrz = 0.18;
        eRrx = -0.92 + bounceWave * 0.07; eRrz = -0.08;
        hRrx = 0.05; hRry = 0.25; hRrz = -0.1;
        curlR = [1.38, 1.38, 1.38, 1.38];
        thumbRRotX = -1.12; thumbRRotZ = -0.1;
        // Left counterbalance
        sLrx = 0.1; sLrz = -0.24; eLrx = -0.48;
        break;

      case 'doubleThumbs':
        shLZ += 0.05; shRZ += 0.05;
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
        shRX = 0.36; shRY += 0.04; shRZ = 0.09;
        sRrx = -1.32; sRry = 0.15; sRrz = -0.1;
        eRrx = -1.12; eRrz = -0.58;
        hRrx = -0.25; hRry = 0.45; hRrz = 0.15;
        curlR = [0.25, 0.85, 1.15, 1.25];
        thumbRRotX = -0.7;

        shLX = -0.37; shLZ = 0.07;
        sLrx = -0.64; sLrz = 0.44;
        eLrx = -0.95; eLrz = 0.48;
        curlL = [0.45, 0.5, 0.55, 0.6];
        break;

      case 'fists':
        shLY += 0.04; shRY += 0.04;
        shLZ += 0.06; shRZ += 0.06;
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
        shRX = 0.37; shRY += 0.08; shRZ = 0.12;
        sRrx = -1.72; sRrz = 0.14;
        eRrx = -0.98; eRrz = -0.62;
        hRrx = -0.15; hRry = 0.65; hRrz = 0.1;
        curlR = [0.1, 0.1, 0.14, 0.18];

        sLrx = 0.06; sLrz = -0.16; eLrx = -0.22;
        break;

      case 'cheeks':
        // Both open palms frame the plush cheeks symmetrically
        shLX = -0.39; shLY += 0.06; shLZ = 0.09;
        shRX = 0.39; shRY += 0.06; shRZ = 0.09;
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
        shRY += 0.06; shRZ += 0.08;
        sRrx = -0.35; sRry = -0.82; sRrz = 1.86;
        eRrx = -0.35; eRrz = 1.18;
        hRry = 0.95; hRrz = 0.2;
        curlR = [0.04, 0.04, 0.04, 0.04];

        sLrx = 0; sLrz = -0.14; eLrx = -0.14;
        curlL = [0.35, 0.4, 0.45, 0.5];
        break;

      case 'clap': {
        const clapGap = Math.abs(bounceWave) * 0.22;
        shLX = -0.36; shLZ = 0.08;
        shRX = 0.36; shRZ = 0.08;
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

  private applyVfxProps(prop: VfxProp, t: number, playing: boolean): void {
    (Object.keys(this.vfxGroups) as Array<Exclude<VfxProp, 'none'>>).forEach(
      (key) => {
        this.vfxGroups[key].visible = key === prop;
      }
    );

    if (prop === 'none' || !playing) return;
    const active = this.vfxGroups[prop];

    if (prop === 'hearts') {
      const pulse = 1 + Math.sin(t * 5) * 0.12;
      active.children.forEach((c) => c.scale.setScalar(1.45 * pulse));
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
