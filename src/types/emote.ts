export type CharacterId = 'macaque' | 'kitsune' | 'tanuki' | 'axolotl';

export type EmoteCategory =
  | 'Joy & Hype'
  | 'Sarcasm & Attitude'
  | 'Shock & Chaos'
  | 'Love & Wholesome'
  | 'Rage & Competitive'
  | 'Chill & AFK'
  | 'Action & Reaction';

export type RarityTier = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type PlatformId =
  | 'discord'
  | 'twitch'
  | 'telegram'
  | 'tiktok'
  | 'vrchat'
  | 'webm';

export type HandPose =
  | 'none'
  | 'wave'
  | 'thumbsUp'
  | 'doubleThumbs'
  | 'chinThink'
  | 'fists'
  | 'facepalm'
  | 'cheeks'
  | 'salute'
  | 'clap'
  | 'peace'
  | 'point';

export type VfxProp =
  | 'none'
  | 'hearts'
  | 'tears'
  | 'steam'
  | 'zzz'
  | 'thought'
  | 'sweat'
  | 'sparkles'
  | 'shockLines'
  | 'fire'
  | 'question'
  | 'halo'
  | 'starEyes';

export type MotionPattern =
  | 'idle'
  | 'bounce'
  | 'laughShake'
  | 'rageTremble'
  | 'nod'
  | 'headshake'
  | 'sway'
  | 'spinPop'
  | 'float'
  | 'peek';

export type StudioLightingMood = 'slate' | 'sunset' | 'obsidian' | 'gallery';

export interface ExpressionParams {
  browTilt: number; // -1 (angry V) to 1 (sad/worried)
  browHeight: number; // -1 (furrowed) to 1 (raised)
  eyeOpenL: number; // 0 (closed) to 1.4 (wide)
  eyeOpenR: number; // 0 (closed) to 1.4 (wide)
  pupilScale: number; // 0.5 to 1.4
  gazeX: number; // -1 (left) to 1 (right)
  gazeY: number; // -1 (down) to 1 (up)
  mouthSmile: number; // -1 (frown) to 1 (wide grin)
  mouthOpen: number; // 0 (closed) to 1 (wide open)
  cheekPuff: number; // 0 to 1
  blush: number; // 0 to 1
  headTiltX: number; // -0.5 to 0.5 rad
  headTiltY: number; // -0.6 to 0.6 rad
  headTiltZ: number; // -0.45 to 0.45 rad
  handPose: HandPose;
  vfxProp: VfxProp;
  motionPattern: MotionPattern;
  tempo: number; // 0.5 to 2.5
  faceTintIntensity?: number; // 0 to 1 (e.g. red anger flush)
}

export interface EmoteDesign {
  id: string;
  code: string;
  index: number; // 1..100 per character
  characterId: CharacterId;
  name: string;
  category: EmoteCategory;
  description: string;
  rarity: RarityTier;
  priceEth: number;
  editionSize: number;
  mintedCount: number;
  platforms: PlatformId[];
  params: ExpressionParams;
  creator: string;
  owner: string;
  listedForSale: boolean;
  likes: number;
  isUserCreated?: boolean;
}

export interface CharacterPalette {
  primaryFur: string;
  secondarySkin: string;
  innerEar: string;
  iris: string;
  accent: string;
  collarMetal: string;
  studioBg: string;
}

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  species: string;
  tagline: string;
  lore: string;
  palette: CharacterPalette;
  referenceImage?: string;
  emoteSheetImage?: string;
  signatureTrait: string;
}

export interface PlatformSpec {
  id: PlatformId;
  name: string;
  dimensions: string;
  formats: string;
  maxSize: string;
  notes: string;
}

export interface TradeEvent {
  id: string;
  emoteId: string;
  emoteName: string;
  characterId: CharacterId;
  type: 'Minted' | 'Purchased' | 'Listed' | 'Bid';
  priceEth: number;
  actor: string;
  timestamp: string;
}
