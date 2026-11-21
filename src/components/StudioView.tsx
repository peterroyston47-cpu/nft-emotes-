import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Dices,
  Download,
  Layers,
  RotateCcw,
  Sparkles,
  Video,
} from 'lucide-react';
import { CHARACTERS, PLATFORM_SPECS } from '../data/characters';
import {
  CharacterId,
  EmoteCategory,
  EmoteDesign,
  ExpressionParams,
  HandPose,
  MotionPattern,
  PlatformId,
  RarityTier,
  VfxProp,
} from '../types/emote';
import { EmoteCanvas3D, EmoteCanvasHandle } from './EmoteCanvas3D';
import { EmotePreviewThumb } from './EmotePreviewThumb';

interface StudioViewProps {
  emotes: EmoteDesign[];
  initialEmote?: EmoteDesign | null;
  onMintNewEmote: (newEmote: Omit<EmoteDesign, 'id' | 'code' | 'index' | 'creator' | 'owner' | 'likes'>) => void;
}

const HAND_POSES: Array<{ id: HandPose; label: string }> = [
  { id: 'none', label: 'Relaxed' },
  { id: 'wave', label: 'Wave' },
  { id: 'thumbsUp', label: 'Thumbs Up' },
  { id: 'doubleThumbs', label: 'Double Thumbs' },
  { id: 'chinThink', label: 'Chin Think' },
  { id: 'fists', label: 'Rage Fists' },
  { id: 'facepalm', label: 'Facepalm' },
  { id: 'cheeks', label: 'Hands on Cheeks' },
  { id: 'salute', label: 'Salute' },
  { id: 'clap', label: 'Clap' },
  { id: 'peace', label: 'Peace V' },
  { id: 'point', label: 'Point' },
];

const VFX_PROPS: Array<{ id: VfxProp; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'hearts', label: 'Heart Eyes' },
  { id: 'tears', label: 'Tears' },
  { id: 'steam', label: 'Steam Puffs' },
  { id: 'zzz', label: 'ZZZ Sleep' },
  { id: 'thought', label: 'Bubble ...' },
  { id: 'sweat', label: 'Sweat Drop' },
  { id: 'sparkles', label: 'Sparkles' },
  { id: 'shockLines', label: 'Shockburst' },
  { id: 'fire', label: 'Fire Embers' },
  { id: 'question', label: 'Question ?' },
  { id: 'halo', label: 'Golden Halo' },
  { id: 'starEyes', label: 'Star Eyes' },
];

const MOTION_PATTERNS: Array<{ id: MotionPattern; label: string }> = [
  { id: 'idle', label: 'Subtle Idle' },
  { id: 'bounce', label: 'Hype Bounce' },
  { id: 'laughShake', label: 'Laugh Shake' },
  { id: 'rageTremble', label: 'Rage Tremble' },
  { id: 'nod', label: 'Rhythmic Nod' },
  { id: 'headshake', label: 'Head Shake' },
  { id: 'sway', label: 'Cozy Sway' },
  { id: 'spinPop', label: '360° Spin Pop' },
  { id: 'float', label: 'Dream Float' },
  { id: 'peek', label: 'Lurk Peek' },
];

const CATEGORIES: EmoteCategory[] = [
  'Joy & Hype',
  'Sarcasm & Attitude',
  'Shock & Chaos',
  'Love & Wholesome',
  'Rage & Competitive',
  'Chill & AFK',
  'Action & Reaction',
];

const RARITIES: RarityTier[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

const DEFAULT_PARAMS: ExpressionParams = {
  browTilt: 0.1,
  browHeight: 0.2,
  eyeOpenL: 1.0,
  eyeOpenR: 1.0,
  pupilScale: 1.05,
  gazeX: 0,
  gazeY: 0,
  mouthSmile: 0.65,
  mouthOpen: 0.12,
  cheekPuff: 0.1,
  blush: 0.15,
  headTiltX: -0.05,
  headTiltY: 0.08,
  headTiltZ: 0.06,
  handPose: 'wave',
  vfxProp: 'sparkles',
  motionPattern: 'bounce',
  tempo: 1.2,
  faceTintIntensity: 0,
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step = 0.05,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-300">{label}</span>
      <span className="font-mono text-slate-400 tabular-nums">
        {value.toFixed(2)}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-[#F97316] cursor-pointer"
    />
  </div>
);

export const StudioView: React.FC<StudioViewProps> = ({
  emotes,
  initialEmote,
  onMintNewEmote,
}) => {
  const canvasRef = useRef<EmoteCanvasHandle | null>(null);
  const [characterId, setCharacterId] = useState<CharacterId>(
    initialEmote?.characterId || 'macaque'
  );
  const [params, setParams] = useState<ExpressionParams>(
    initialEmote ? { ...initialEmote.params } : { ...DEFAULT_PARAMS }
  );
  const [tab, setTab] = useState<'face' | 'pose' | 'mint'>('face');

  // Minting metadata
  const [title, setTitle] = useState(
    initialEmote ? `${initialEmote.name} Remix` : 'Custom Solar Grin'
  );
  const [category, setCategory] = useState<EmoteCategory>(
    initialEmote?.category || 'Joy & Hype'
  );
  const [rarity, setRarity] = useState<RarityTier>(initialEmote?.rarity || 'Rare');
  const [editionSize, setEditionSize] = useState(25);
  const [priceEth, setPriceEth] = useState('0.45');
  const [listedForSale, setListedForSale] = useState(true);
  const [platforms, setPlatforms] = useState<PlatformId[]>(
    initialEmote?.platforms || ['discord', 'twitch', 'telegram', 'tiktok', 'vrchat', 'webm']
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  const charPresets = useMemo(
    () => emotes.filter((e) => e.characterId === characterId),
    [emotes, characterId]
  );

  const updateParam = <K extends keyof ExpressionParams>(
    key: K,
    val: ExpressionParams[K]
  ) => {
    setParams((prev) => ({ ...prev, [key]: val }));
  };

  const handleRandomize = () => {
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    setParams({
      browTilt: Number((Math.random() * 1.8 - 0.9).toFixed(2)),
      browHeight: Number((Math.random() * 1.6 - 0.6).toFixed(2)),
      eyeOpenL: Number((Math.random() * 1.2 + 0.1).toFixed(2)),
      eyeOpenR: Number((Math.random() * 1.2 + 0.1).toFixed(2)),
      pupilScale: Number((Math.random() * 0.8 + 0.55).toFixed(2)),
      gazeX: Number((Math.random() * 1.2 - 0.6).toFixed(2)),
      gazeY: Number((Math.random() * 0.8 - 0.4).toFixed(2)),
      mouthSmile: Number((Math.random() * 1.8 - 0.9).toFixed(2)),
      mouthOpen: Number((Math.random() * 0.9).toFixed(2)),
      cheekPuff: Number((Math.random() * 0.6).toFixed(2)),
      blush: Number((Math.random() * 0.7).toFixed(2)),
      headTiltX: Number((Math.random() * 0.5 - 0.25).toFixed(2)),
      headTiltY: Number((Math.random() * 0.6 - 0.3).toFixed(2)),
      headTiltZ: Number((Math.random() * 0.5 - 0.25).toFixed(2)),
      handPose: pick(HAND_POSES).id,
      vfxProp: pick(VFX_PROPS).id,
      motionPattern: pick(MOTION_PATTERNS).id,
      tempo: Number((0.8 + Math.random() * 1.2).toFixed(2)),
      faceTintIntensity: Math.random() > 0.75 ? 0.6 : 0,
    });
    setFeedback('Randomized 16-parameter expression rig');
  };

  const togglePlatform = (id: PlatformId) => {
    setPlatforms((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((p) => p !== id)
          : prev
        : [...prev, id]
    );
  };

  const handleExportPng = (size: number) => {
    const url = canvasRef.current?.capturePng(size);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-${size}px.png`;
    a.click();
    setFeedback(`Exported ${size}×${size} PNG frame`);
  };

  const handleExportWebM = async () => {
    setFeedback('Recording 2.2s animated WebM loop...');
    const blob = await canvasRef.current?.recordWebM(2200);
    if (!blob) {
      handleExportPng(512);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback('Exported VP9 animated WebM loop');
  };

  const handleExportRigJson = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schema: 'mimicvault-3d-rig-v1',
            characterId,
            title,
            platforms,
            blendshapes: params,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-rig.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback('Exported VRChat / 3D Rig JSON');
  };

  const handleMintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim() || 'Untitled 3D Emote';
    onMintNewEmote({
      characterId,
      name: cleanTitle,
      category,
      description: `Custom 3D sculpted expression with ${params.handPose} gesture and ${params.vfxProp} VFX loop.`,
      rarity,
      priceEth: Math.max(0.01, Number(priceEth) || 0.25),
      editionSize: Math.max(1, editionSize),
      mintedCount: 1,
      platforms,
      params: { ...params },
      listedForSale,
      isUserCreated: true,
    });
    setFeedback(`Minted "${cleanTitle}" to your Collection & Marketplace`);
  };

  return (
    <div className="space-y-6">
      {/* Studio Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            3D Emote Sculptor & Mint Studio
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Sculpt facial blendshapes, assign hand gestures & VFX props, verify platform scale, and mint directly as a 3D NFT.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRandomize}
            className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#141D25] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-[#1C2833] transition-colors whitespace-nowrap"
          >
            <Dices className="h-3.5 w-3.5 text-[#FB923C]" />
            <span>Randomize</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setParams({ ...DEFAULT_PARAMS });
              setFeedback('Reset expression to neutral');
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#141D25] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-[#1C2833] transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Rig</span>
          </button>
        </div>
      </div>

      {/* Two-Column Architectural Studio Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_420px] items-start">
        {/* Left: Unobstructed 3D Canvas Stage */}
        <div className="h-[460px] lg:h-[680px]">
          <EmoteCanvas3D
            ref={canvasRef}
            characterId={characterId}
            params={params}
            showDock={true}
          />
        </div>

        {/* Right: Dedicated Non-Overlapping Workbench */}
        <aside className="rounded-2xl border border-white/10 bg-[#121920] p-5 space-y-5 lg:max-h-[680px] lg:overflow-y-auto">
          {/* Character + Preset Loader */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1.5">
                Active 3D Character Rig
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {CHARACTERS.map((char) => (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => setCharacterId(char.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors border ${
                      characterId === char.id
                        ? 'border-[#F97316] bg-[#F97316]/15 text-white'
                        : 'border-white/8 bg-[#162029] text-slate-300 hover:border-white/20'
                    }`}
                  >
                    {char.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="studio-preset-select"
                className="text-xs font-medium text-slate-400 block mb-1.5"
              >
                Load From 100 Character Presets
              </label>
              <select
                id="studio-preset-select"
                defaultValue=""
                onChange={(e) => {
                  const found = charPresets.find((p) => p.id === e.target.value);
                  if (found) {
                    setParams({ ...found.params });
                    setTitle(`${found.name} Remix`);
                    setCategory(found.category);
                    setFeedback(`Loaded preset ${found.code} · ${found.name}`);
                  }
                }}
                className="w-full rounded-lg border border-white/10 bg-[#0D1318] px-3 py-2 text-xs text-slate-200 focus:border-[#F97316] focus:outline-none"
              >
                <option value="" disabled>
                  Select any of 100 expressions to customize...
                </option>
                {charPresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Workbench Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0D1318] border border-white/10">
            <button
              type="button"
              onClick={() => setTab('face')}
              className={`py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'face'
                  ? 'bg-[#F97316] text-[#0C1115] font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Face Rig
            </button>
            <button
              type="button"
              onClick={() => setTab('pose')}
              className={`py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'pose'
                  ? 'bg-[#F97316] text-[#0C1115] font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Pose & VFX
            </button>
            <button
              type="button"
              onClick={() => setTab('mint')}
              className={`py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                tab === 'mint'
                  ? 'bg-[#F97316] text-[#0C1115] font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Mint & Export
            </button>
          </div>

          {feedback && (
            <p className="text-xs font-medium text-[#FB923C] bg-[#F97316]/10 border border-[#F97316]/30 rounded-lg px-3 py-2">
              {feedback}
            </p>
          )}

          {/* TAB 1: FACE RIG SLIDERS */}
          {tab === 'face' && (
            <div className="space-y-3.5">
              <SliderRow
                label="Brow Tilt (Angry V ↔ Worried)"
                value={params.browTilt}
                min={-1}
                max={1}
                onChange={(v) => updateParam('browTilt', v)}
              />
              <SliderRow
                label="Brow Height"
                value={params.browHeight}
                min={-0.8}
                max={1}
                onChange={(v) => updateParam('browHeight', v)}
              />
              <div className="grid grid-cols-2 gap-3">
                <SliderRow
                  label="Left Eye Open"
                  value={params.eyeOpenL}
                  min={0}
                  max={1.4}
                  onChange={(v) => updateParam('eyeOpenL', v)}
                />
                <SliderRow
                  label="Right Eye Open"
                  value={params.eyeOpenR}
                  min={0}
                  max={1.4}
                  onChange={(v) => updateParam('eyeOpenR', v)}
                />
              </div>
              <SliderRow
                label="Pupil Dilation"
                value={params.pupilScale}
                min={0.5}
                max={1.4}
                onChange={(v) => updateParam('pupilScale', v)}
              />
              <div className="grid grid-cols-2 gap-3">
                <SliderRow
                  label="Eye Gaze X"
                  value={params.gazeX}
                  min={-1}
                  max={1}
                  onChange={(v) => updateParam('gazeX', v)}
                />
                <SliderRow
                  label="Eye Gaze Y"
                  value={params.gazeY}
                  min={-1}
                  max={1}
                  onChange={(v) => updateParam('gazeY', v)}
                />
              </div>
              <SliderRow
                label="Mouth Smile / Frown"
                value={params.mouthSmile}
                min={-1}
                max={1}
                onChange={(v) => updateParam('mouthSmile', v)}
              />
              <SliderRow
                label="Jaw Open"
                value={params.mouthOpen}
                min={0}
                max={1}
                onChange={(v) => updateParam('mouthOpen', v)}
              />
              <div className="grid grid-cols-2 gap-3">
                <SliderRow
                  label="Cheek Puff"
                  value={params.cheekPuff}
                  min={0}
                  max={1}
                  onChange={(v) => updateParam('cheekPuff', v)}
                />
                <SliderRow
                  label="Rosy Blush"
                  value={params.blush}
                  min={0}
                  max={1}
                  onChange={(v) => updateParam('blush', v)}
                />
              </div>
              <SliderRow
                label="Crimson Rage Flush"
                value={params.faceTintIntensity || 0}
                min={0}
                max={1}
                onChange={(v) => updateParam('faceTintIntensity', v)}
              />
            </div>
          )}

          {/* TAB 2: POSE, HEAD TILT & VFX */}
          {tab === 'pose' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">
                  Hand Gesture
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {HAND_POSES.map((hp) => (
                    <button
                      key={hp.id}
                      type="button"
                      onClick={() => updateParam('handPose', hp.id)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors truncate ${
                        params.handPose === hp.id
                          ? 'border-[#F97316] bg-[#F97316]/15 text-white'
                          : 'border-white/8 bg-[#162029] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {hp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">
                  3D VFX Prop Attachment
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {VFX_PROPS.map((vp) => (
                    <button
                      key={vp.id}
                      type="button"
                      onClick={() => updateParam('vfxProp', vp.id)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-colors truncate ${
                        params.vfxProp === vp.id
                          ? 'border-[#F97316] bg-[#F97316]/15 text-white'
                          : 'border-white/8 bg-[#162029] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {vp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">
                  Loop Animation Pattern
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {MOTION_PATTERNS.map((mp) => (
                    <button
                      key={mp.id}
                      type="button"
                      onClick={() => updateParam('motionPattern', mp.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border text-left transition-colors truncate ${
                        params.motionPattern === mp.id
                          ? 'border-[#F97316] bg-[#F97316]/15 text-white'
                          : 'border-white/8 bg-[#162029] text-slate-300 hover:border-white/20'
                      }`}
                    >
                      {mp.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-white/10">
                <SliderRow
                  label="Loop Tempo"
                  value={params.tempo}
                  min={0.5}
                  max={2.5}
                  onChange={(v) => updateParam('tempo', v)}
                />
                <SliderRow
                  label="Head Nod (Pitch)"
                  value={params.headTiltX}
                  min={-0.45}
                  max={0.45}
                  onChange={(v) => updateParam('headTiltX', v)}
                />
                <SliderRow
                  label="Head Turn (Yaw)"
                  value={params.headTiltY}
                  min={-0.55}
                  max={0.55}
                  onChange={(v) => updateParam('headTiltY', v)}
                />
                <SliderRow
                  label="Head Cock (Roll)"
                  value={params.headTiltZ}
                  min={-0.45}
                  max={0.45}
                  onChange={(v) => updateParam('headTiltZ', v)}
                />
              </div>
            </div>
          )}

          {/* TAB 3: PLATFORM EXPORT & MINT NFT */}
          {tab === 'mint' && (
            <form onSubmit={handleMintSubmit} className="space-y-4">
              {/* Live Chat Scale Preview */}
              <div className="rounded-xl bg-[#0D1318] border border-white/10 p-3">
                <p className="text-[11px] font-medium text-slate-400 mb-2">
                  Inline Chat Size Preview
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <EmotePreviewThumb
                      characterId={characterId}
                      params={params}
                      className="h-8 w-8 rounded"
                    />
                    <span className="text-[11px] font-mono text-slate-400">
                      32px
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <EmotePreviewThumb
                      characterId={characterId}
                      params={params}
                      className="h-12 w-12 rounded-lg"
                    />
                    <span className="text-[11px] font-mono text-slate-400">
                      56px
                    </span>
                  </div>
                  <div className="flex-1 flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleExportPng(128)}
                      className="p-2 rounded-lg bg-[#18222C] text-slate-200 hover:text-white border border-white/10"
                      title="Export 128px PNG"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleExportWebM}
                      className="p-2 rounded-lg bg-[#18222C] text-slate-200 hover:text-white border border-white/10"
                      title="Record WebM Loop"
                    >
                      <Video className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleExportRigJson}
                      className="p-2 rounded-lg bg-[#18222C] text-slate-200 hover:text-white border border-white/10"
                      title="Export VRChat JSON"
                    >
                      <Layers className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Target Platforms */}
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">
                  Target Platform Compatibility
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PLATFORM_SPECS.map((plat) => {
                    const active = platforms.includes(plat.id);
                    return (
                      <button
                        key={plat.id}
                        type="button"
                        onClick={() => togglePlatform(plat.id)}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-2 border text-xs transition-colors ${
                          active
                            ? 'border-[#F97316]/60 bg-[#F97316]/12 text-white'
                            : 'border-white/8 bg-[#162029] text-slate-400'
                        }`}
                      >
                        <span className="truncate">{plat.name.split(' ')[0]}</span>
                        {active && <Check className="h-3.5 w-3.5 text-[#FB923C]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Collectible Metadata */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Emote Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#0D1318] px-3 py-2 text-sm text-white focus:border-[#F97316] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as EmoteCategory)}
                      className="w-full rounded-lg border border-white/10 bg-[#0D1318] px-2.5 py-2 text-xs text-slate-200 focus:border-[#F97316] focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Rarity Tier
                    </label>
                    <select
                      value={rarity}
                      onChange={(e) => setRarity(e.target.value as RarityTier)}
                      className="w-full rounded-lg border border-white/10 bg-[#0D1318] px-2.5 py-2 text-xs text-slate-200 focus:border-[#F97316] focus:outline-none"
                    >
                      {RARITIES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Edition Supply
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={editionSize}
                      onChange={(e) =>
                        setEditionSize(Math.max(1, parseInt(e.target.value || '1', 10)))
                      }
                      className="w-full rounded-lg border border-white/10 bg-[#0D1318] px-3 py-2 font-mono text-xs text-white focus:border-[#F97316] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      List Price (ETH)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.05"
                      value={priceEth}
                      onChange={(e) => setPriceEth(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#0D1318] px-3 py-2 font-mono text-xs text-white focus:border-[#F97316] focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={listedForSale}
                    onChange={(e) => setListedForSale(e.target.checked)}
                    className="rounded accent-[#F97316]"
                  />
                  <span>List immediately on Marketplace trading floor</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-[#0C1115] hover:bg-[#FB923C] transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>Mint 3D Emote Collectible</span>
              </button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
};
