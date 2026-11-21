import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  ExternalLink,
  Gauge,
  Layers,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Tag,
  Video,
  X,
} from 'lucide-react';
import { CHARACTERS, PLATFORM_SPECS } from '../data/characters';
import { EmoteDesign } from '../types/emote';
import { EmoteCanvas3D, EmoteCanvasHandle } from './EmoteCanvas3D';
import { EmotePreviewThumb } from './EmotePreviewThumb';

interface InspectTradeModalProps {
  emote: EmoteDesign | null;
  allEmotes: EmoteDesign[];
  initialAutoPlay?: boolean;
  userAddress: string;
  walletEth: number;
  onClose: () => void;
  onSelectEmote: (emoteId: string) => void;
  onBuy: (emoteId: string) => void;
  onMintEdition: (emoteId: string) => void;
  onToggleList: (emoteId: string, priceEth: number) => void;
  onBid: (emoteId: string, bidEth: number) => void;
  onRemixInStudio: (emote: EmoteDesign) => void;
}

export const InspectTradeModal: React.FC<InspectTradeModalProps> = ({
  emote,
  allEmotes,
  initialAutoPlay = false,
  userAddress,
  walletEth,
  onClose,
  onSelectEmote,
  onBuy,
  onMintEdition,
  onToggleList,
  onBid,
  onRemixInStudio,
}) => {
  const canvasRef = useRef<EmoteCanvasHandle | null>(null);
  const [listPrice, setListPrice] = useState('0.45');
  const [bidPrice, setBidPrice] = useState('0.35');
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [autoPlayReel, setAutoPlayReel] = useState(initialAutoPlay);
  const [reelScope, setReelScope] = useState<'char' | 'all'>('all');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  useEffect(() => {
    setAutoPlayReel(Boolean(emote && initialAutoPlay));
  }, [Boolean(emote), initialAutoPlay]);

  const playlist = useMemo(() => {
    if (!emote) return allEmotes;
    if (reelScope === 'char') {
      return allEmotes.filter((e) => e.characterId === emote.characterId);
    }
    return allEmotes;
  }, [allEmotes, emote?.characterId, reelScope, emote]);

  const currentIdx = Math.max(
    0,
    playlist.findIndex((e) => e.id === emote?.id)
  );

  const stepEmote = (delta: number) => {
    if (playlist.length === 0) return;
    const next =
      playlist[(currentIdx + delta + playlist.length) % playlist.length];
    if (next) onSelectEmote(next.id);
  };

  useEffect(() => {
    if (!emote || !autoPlayReel || playlist.length <= 1) return;
    const intervalMs = Math.round(1800 / playbackSpeed);
    const timer = window.setInterval(() => {
      const idx = Math.max(
        0,
        playlist.findIndex((e) => e.id === emote.id)
      );
      const next = playlist[(idx + 1) % playlist.length];
      if (next) onSelectEmote(next.id);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [emote, autoPlayReel, playlist, onSelectEmote, playbackSpeed]);

  useEffect(() => {
    if (!emote) return;
    setListPrice(emote.priceEth.toFixed(2));
    setBidPrice(Math.max(0.05, Number((emote.priceEth * 0.85).toFixed(2))).toString());
    setExportNote(null);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [emote, onClose]);

  if (!emote) return null;

  const charProfile =
    CHARACTERS.find((c) => c.id === emote.characterId) || CHARACTERS[0];
  const isOwner = emote.owner === userAddress;
  const canMint = emote.mintedCount < emote.editionSize;

  const handleDownloadPng = (size: number, label: string) => {
    const dataUrl = canvasRef.current?.capturePng(size);
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${emote.code.toLowerCase()}-${label}-${size}px.png`;
    a.click();
    setExportNote(`Exported ${label} ${size}×${size} PNG`);
  };

  const handleDownloadWebM = async () => {
    setRecording(true);
    const blob = await canvasRef.current?.recordWebM(2200);
    setRecording(false);
    if (!blob) {
      handleDownloadPng(512, 'telegram');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emote.code.toLowerCase()}-loop.webm`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNote('Exported VP9 animated WebM loop');
  };

  const handleDownloadJson = () => {
    const payload = {
      schema: 'mimicvault-3d-rig-v1',
      code: emote.code,
      name: emote.name,
      character: charProfile.name,
      platforms: emote.platforms,
      blendshapes: emote.params,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emote.code.toLowerCase()}-rig.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNote('Exported VRChat / 3D Blendshape JSON');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${emote.name} 3D Emote Inspector`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative grid w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/12 bg-[#11181F] lg:grid-cols-[1.15fr_1fr] shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#18222C] text-slate-300 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left: Live 3D WebGL Viewport + Platform Chat Scale Previews */}
        <div className="flex flex-col border-b border-white/10 lg:border-b-0 lg:border-r p-4 md:p-5 gap-4 bg-[#0D1318]">
          <div className="h-[340px] md:h-[420px] w-full">
            <EmoteCanvas3D
              ref={canvasRef}
              characterId={emote.characterId}
              params={emote.params}
              activeEmoteLabel={`${emote.code} · ${emote.name}`}
              playbackSpeed={playbackSpeed}
              showDock={true}
            />
          </div>

          {/* 1-Click Auto-Play Reel Bar inside Modal */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-[#131C24] px-3 py-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAutoPlayReel(false);
                  stepEmote(-1);
                }}
                className="p-1.5 rounded-lg border border-white/10 bg-[#1B2630] text-slate-200 hover:text-white"
                title="Previous Emote"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setAutoPlayReel((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  autoPlayReel
                    ? 'bg-[#F97316] text-[#0C1115]'
                    : 'bg-[#1B2630] text-white hover:bg-[#23313E]'
                }`}
              >
                {autoPlayReel ? (
                  <>
                    <Square className="h-3 w-3 fill-current" />
                    <span>Stop Reel</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 fill-current" />
                    <span>Auto-Play All</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAutoPlayReel(false);
                  stepEmote(1);
                }}
                className="p-1.5 rounded-lg border border-white/10 bg-[#1B2630] text-slate-200 hover:text-white"
                title="Next Emote"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
              <span className="ml-1 font-mono text-xs text-slate-300 tabular-nums">
                {currentIdx + 1} / {playlist.length}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#0C1115] p-0.5 rounded-lg border border-white/10 text-[11px]">
              <button
                type="button"
                onClick={() => setReelScope('char')}
                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                  reelScope === 'char'
                    ? 'bg-[#212D38] text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {charProfile.name.split(' ')[0]}
              </button>
              <button
                type="button"
                onClick={() => setReelScope('all')}
                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                  reelScope === 'all'
                    ? 'bg-[#212D38] text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({allEmotes.length})
              </button>
            </div>
          </div>

          {/* 3D Animation Playback Speed Slider (0.5x – 2x) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#131C24] px-3.5 py-2.5">
            <div className="flex items-center gap-2 shrink-0">
              <Gauge className="h-3.5 w-3.5 text-[#FB923C]" />
              <span className="text-xs font-medium text-slate-200">
                Playback Speed
              </span>
              <span className="font-mono text-xs font-semibold text-[#FB923C] tabular-nums w-11">
                {playbackSpeed}x
              </span>
            </div>

            <div className="flex flex-1 min-w-[140px] items-center gap-2.5">
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.25}
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                aria-label="Playback speed"
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[#1F2D3A] accent-[#F97316]"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#0C1115] p-0.5 rounded-lg border border-white/10 text-[11px]">
              {[0.5, 1, 2].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPlaybackSpeed(preset)}
                  className={`px-2 py-1 rounded-md font-mono transition-colors whitespace-nowrap ${
                    playbackSpeed === preset
                      ? 'bg-[#F97316] text-[#0C1115] font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset}x
                </button>
              ))}
            </div>
          </div>

          {/* Platform Inline Size Previews */}
          <div className="rounded-xl border border-white/8 bg-[#131C24] p-3.5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-300">
                Platform Scale Readability Check
              </span>
              {exportNote && (
                <span className="text-xs text-[#FB923C] font-medium">
                  {exportNote}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="flex items-center gap-2.5 rounded-lg bg-[#1E1F22] p-2.5 border border-white/5">
                <EmotePreviewThumb
                  characterId={emote.characterId}
                  params={emote.params}
                  className="h-8 w-8 rounded-md shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">
                    Discord
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">32px chat</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg bg-[#18181B] p-2.5 border border-white/5">
                <EmotePreviewThumb
                  characterId={emote.characterId}
                  params={emote.params}
                  className="h-7 w-7 rounded-md shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">
                    Twitch
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">28px badge</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-lg bg-[#17212B] p-2.5 border border-white/5">
                <EmotePreviewThumb
                  characterId={emote.characterId}
                  params={emote.params}
                  className="h-10 w-10 rounded-lg shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">
                    Telegram
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">512px</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDownloadPng(128, 'discord')}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1B2630] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#23313E] transition-colors whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Discord 128px PNG</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPng(112, 'twitch')}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1B2630] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#23313E] transition-colors whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Twitch 112px PNG</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadWebM}
                disabled={recording}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1B2630] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#23313E] disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Video className="h-3.5 w-3.5" />
                <span>{recording ? 'Recording...' : 'WebM Loop'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1B2630] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#23313E] transition-colors whitespace-nowrap"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>VRChat JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Collectible Metadata, Compatibility & Trading Controls */}
        <div className="flex flex-col justify-between p-5 md:p-6 gap-5">
          <div className="space-y-5">
            {/* Clean unboxed metadata header */}
            <div className="pr-10">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1.5">
                <span className="font-mono text-[#FB923C]">{emote.code}</span>
                <span aria-hidden="true">·</span>
                <span>{charProfile.name}</span>
                <span aria-hidden="true">·</span>
                <span>{emote.category}</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-200 font-medium">{emote.rarity}</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-white tracking-tight">
                {emote.name}
              </h2>
              <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
                {emote.description}
              </p>
            </div>

            {/* Ownership & Edition Stats */}
            <div className="grid grid-cols-3 gap-3 border-y border-white/10 py-3.5">
              <div>
                <p className="text-xs text-slate-400">Floor Price</p>
                <p className="font-mono text-lg font-semibold text-white tabular-nums mt-0.5">
                  {emote.priceEth.toFixed(2)} ETH
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Minted Supply</p>
                <p className="font-mono text-lg font-semibold text-white tabular-nums mt-0.5">
                  {emote.mintedCount} / {emote.editionSize}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Current Holder</p>
                <p className="font-mono text-sm font-medium text-slate-200 mt-1 truncate">
                  {isOwner ? 'You (Connected)' : emote.owner}
                </p>
              </div>
            </div>

            {/* Rig Expression Telemetry */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">
                3D Blendshape & Gesture Architecture
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-[#161F28] px-3 py-2 border border-white/6">
                  <span className="text-slate-400 block">Hand Pose</span>
                  <span className="font-mono text-slate-100 capitalize">
                    {emote.params.handPose}
                  </span>
                </div>
                <div className="rounded-lg bg-[#161F28] px-3 py-2 border border-white/6">
                  <span className="text-slate-400 block">3D VFX Prop</span>
                  <span className="font-mono text-slate-100 capitalize">
                    {emote.params.vfxProp}
                  </span>
                </div>
                <div className="rounded-lg bg-[#161F28] px-3 py-2 border border-white/6">
                  <span className="text-slate-400 block">Motion Loop</span>
                  <span className="font-mono text-slate-100 capitalize">
                    {emote.params.motionPattern}
                  </span>
                </div>
              </div>
            </div>

            {/* Platform Compatibility Matrix */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">
                Verified Platform Compatibility
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORM_SPECS.map((plat) => {
                  const supported = emote.platforms.includes(plat.id);
                  return (
                    <div
                      key={plat.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 border text-xs ${
                        supported
                          ? 'border-white/10 bg-[#161F28] text-slate-200'
                          : 'border-white/5 bg-[#10161C] text-slate-500 opacity-60'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{plat.name}</p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {plat.dimensions}
                        </p>
                      </div>
                      {supported ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500">
                          N/A
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Trading & Minting Actions */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            {isOwner ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="flex items-center gap-2 flex-1 rounded-lg border border-white/12 bg-[#0D1318] px-3 py-2">
                  <Tag className="h-4 w-4 text-slate-400 shrink-0" />
                  <input
                    type="number"
                    min="0.01"
                    step="0.05"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    className="w-full bg-transparent font-mono text-sm text-white focus:outline-none"
                    aria-label="Listing price in ETH"
                  />
                  <span className="font-mono text-xs text-slate-400">ETH</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onToggleList(emote.id, Math.max(0.01, Number(listPrice) || 0.25))
                  }
                  className="px-4 py-2.5 rounded-lg bg-[#F97316] text-[#0C1115] text-sm font-semibold hover:bg-[#FB923C] transition-colors whitespace-nowrap"
                >
                  {emote.listedForSale ? 'Update / Delist' : 'List on Market'}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap gap-2.5">
                  {emote.listedForSale && (
                    <button
                      type="button"
                      disabled={walletEth < emote.priceEth}
                      onClick={() => onBuy(emote.id)}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-[#F97316] text-[#0C1115] text-sm font-semibold hover:bg-[#FB923C] disabled:opacity-45 transition-colors whitespace-nowrap"
                    >
                      Buy Now · {emote.priceEth.toFixed(2)} ETH
                    </button>
                  )}
                  {canMint && (
                    <button
                      type="button"
                      disabled={walletEth < emote.priceEth}
                      onClick={() => onMintEdition(emote.id)}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-white/15 bg-[#1B2630] text-white text-sm font-semibold hover:bg-[#23313E] disabled:opacity-45 transition-colors whitespace-nowrap"
                    >
                      Mint Edition #{emote.mintedCount + 1}
                    </button>
                  )}
                </div>

                {/* Place Bid */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-1 rounded-lg border border-white/12 bg-[#0D1318] px-3 py-2">
                    <input
                      type="number"
                      min="0.01"
                      step="0.02"
                      value={bidPrice}
                      onChange={(e) => setBidPrice(e.target.value)}
                      className="w-full bg-transparent font-mono text-sm text-white focus:outline-none"
                      aria-label="Bid price in ETH"
                    />
                    <span className="font-mono text-xs text-slate-400">ETH</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onBid(emote.id, Math.max(0.01, Number(bidPrice) || 0.1))
                    }
                    className="px-4 py-2 rounded-lg border border-white/12 bg-[#161F28] text-slate-200 text-sm font-medium hover:bg-[#1E2A36] transition-colors whitespace-nowrap"
                  >
                    Place Bid
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onRemixInStudio(emote);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#131C24] px-4 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-[#19242E] transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Customize Expression in 3D Studio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
