import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  Search,
  Sliders,
  Sparkles,
  Video,
} from 'lucide-react';
import { CHARACTERS, PLATFORM_SPECS } from '../data/characters';
import { CharacterId, EmoteCategory, EmoteDesign } from '../types/emote';
import { EmoteCanvas3D, EmoteCanvasHandle } from './EmoteCanvas3D';
import { EmotePreviewThumb } from './EmotePreviewThumb';

interface Directory100ViewProps {
  emotes: EmoteDesign[];
  initialCharacterId: CharacterId;
  onInspect: (emote: EmoteDesign) => void;
  onRemixInStudio: (emote: EmoteDesign) => void;
}

const CATEGORIES: Array<'All' | EmoteCategory> = [
  'All',
  'Joy & Hype',
  'Sarcasm & Attitude',
  'Shock & Chaos',
  'Love & Wholesome',
  'Rage & Competitive',
  'Chill & AFK',
  'Action & Reaction',
];

export const Directory100View: React.FC<Directory100ViewProps> = ({
  emotes,
  initialCharacterId,
  onInspect,
  onRemixInStudio,
}) => {
  const [selectedChar, setSelectedChar] = useState<CharacterId>(initialCharacterId);
  const [selectedCategory, setSelectedCategory] = useState<'All' | EmoteCategory>('All');
  const [search, setSearch] = useState('');
  const [selectedEmoteId, setSelectedEmoteId] = useState<string>(
    `${initialCharacterId}-36`
  );
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const canvasRef = useRef<EmoteCanvasHandle | null>(null);

  const charEmotes = useMemo(
    () => emotes.filter((e) => e.characterId === selectedChar),
    [emotes, selectedChar]
  );

  const filteredEmotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return charEmotes.filter((e) => {
      if (selectedCategory !== 'All' && e.category !== selectedCategory) return false;
      if (
        q &&
        !e.name.toLowerCase().includes(q) &&
        !e.code.toLowerCase().includes(q) &&
        !e.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [charEmotes, selectedCategory, search]);

  const activeEmote =
    charEmotes.find((e) => e.id === selectedEmoteId) ||
    filteredEmotes[0] ||
    charEmotes[0];

  const charProfile =
    CHARACTERS.find((c) => c.id === selectedChar) || CHARACTERS[0];

  const handleCharSwitch = (id: CharacterId) => {
    setSelectedChar(id);
    const first = emotes.find((e) => e.characterId === id);
    if (first) setSelectedEmoteId(first.id);
    setExportStatus(null);
  };

  const handleExportPng = (size: number) => {
    if (!activeEmote) return;
    const url = canvasRef.current?.capturePng(size);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeEmote.code.toLowerCase()}-${size}px.png`;
    a.click();
    setExportStatus(`Saved ${activeEmote.code} (${size}×${size} PNG)`);
  };

  const handleExportWebM = async () => {
    if (!activeEmote) return;
    setExportStatus('Recording 3D WebM loop...');
    const blob = await canvasRef.current?.recordWebM(2200);
    if (!blob) {
      handleExportPng(512);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeEmote.code.toLowerCase()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus(`Saved ${activeEmote.code} animated WebM`);
  };

  return (
    <div className="space-y-8">
      {/* Header & Character Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            100-Emote Character Matrix
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Select any character to test all 100 unique facial expressions, hand gestures, and platform exports in live 3D.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl border border-white/10 bg-[#121920]">
          {CHARACTERS.map((char) => {
            const count = emotes.filter((e) => e.characterId === char.id).length;
            return (
              <button
                key={char.id}
                type="button"
                onClick={() => handleCharSwitch(char.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedChar === char.id
                    ? 'bg-[#F97316] text-[#0C1115] font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {char.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Live 3D Stage + Active Expression Inspector */}
      {activeEmote && (
        <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr] items-stretch">
          <div className="h-[380px] lg:h-[440px]">
            <EmoteCanvas3D
              ref={canvasRef}
              characterId={activeEmote.characterId}
              params={activeEmote.params}
              showDock={true}
            />
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#121920] p-6 gap-5">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono text-[#FB923C]">
                      #{String(activeEmote.index).padStart(3, '0')} / 100
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{charProfile.name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeEmote.category}</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white mt-1">
                    {activeEmote.name}
                  </h2>
                </div>
                <span className="font-mono text-sm font-semibold text-white bg-[#1A242E] px-3 py-1 rounded-lg border border-white/10 whitespace-nowrap">
                  {activeEmote.priceEth.toFixed(2)} ETH
                </span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {activeEmote.description}
              </p>

              {/* Character Signature Lore */}
              <div className="rounded-xl bg-[#162029] p-3.5 border border-white/6 text-xs space-y-1">
                <p className="font-medium text-white">{charProfile.signatureTrait}</p>
                <p className="text-slate-400 leading-relaxed">{charProfile.lore}</p>
              </div>

              {/* Platform Compatibility Grid */}
              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">
                  Platform Export Compatibility
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PLATFORM_SPECS.map((plat) => {
                    const ok = activeEmote.platforms.includes(plat.id);
                    return (
                      <div
                        key={plat.id}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-2 border text-xs ${
                          ok
                            ? 'border-white/10 bg-[#162029] text-slate-200'
                            : 'border-white/5 bg-[#0F151B] text-slate-500 opacity-60'
                        }`}
                      >
                        <span className="truncate font-medium">{plat.name.split(' ')[0]}</span>
                        {ok ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <span className="text-[10px] font-mono">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              {exportStatus && (
                <p className="text-xs text-[#FB923C] font-medium">{exportStatus}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onInspect(activeEmote)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#F97316] text-[#0C1115] text-xs font-semibold hover:bg-[#FB923C] transition-colors whitespace-nowrap"
                >
                  Buy / Mint Collectible
                </button>
                <button
                  type="button"
                  onClick={() => onRemixInStudio(activeEmote)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/15 bg-[#1B2630] text-white text-xs font-medium hover:bg-[#23313E] transition-colors whitespace-nowrap"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Edit in 3D Studio</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleExportPng(128)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#162029] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1E2B37] transition-colors whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Discord 128px PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPng(112)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#162029] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1E2B37] transition-colors whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Twitch 112px PNG</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportWebM}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#162029] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[#1E2B37] transition-colors whitespace-nowrap"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Record WebM</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Filter & Search for the 100 Emotes */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl border border-white/10 bg-[#121920]">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#253340] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${charProfile.name}'s 100 emotes...`}
              className="w-full rounded-lg border border-white/10 bg-[#121920] pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#F97316] focus:outline-none"
            />
          </div>
        </div>

        <p className="text-xs font-mono text-slate-400">
          Displaying {filteredEmotes.length} of {charEmotes.length} unique{' '}
          {charProfile.name} emote designs
        </p>

        {/* Full 100-Emote Matrix Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filteredEmotes.map((emote) => {
            const isSelected = activeEmote?.id === emote.id;
            return (
              <button
                key={emote.id}
                type="button"
                onClick={() => setSelectedEmoteId(emote.id)}
                className={`group flex flex-col rounded-xl border p-2 text-left transition-all ${
                  isSelected
                    ? 'border-[#F97316] bg-[#F97316]/12 shadow-lg'
                    : 'border-white/8 bg-[#121920] hover:border-white/25 hover:-translate-y-0.5'
                }`}
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                  <EmotePreviewThumb
                    characterId={emote.characterId}
                    params={emote.params}
                    className="h-full w-full"
                  />
                  <span className="absolute top-1.5 left-1.5 font-mono text-[10px] text-white/90 bg-black/55 px-1.5 py-0.5 rounded">
                    {String(emote.index).padStart(3, '0')}
                  </span>
                </div>
                <span className="mt-2 w-full truncate text-xs font-semibold text-white">
                  {emote.name}
                </span>
                <span className="w-full truncate text-[10px] text-slate-400">
                  {emote.rarity} · {emote.priceEth.toFixed(2)} ETH
                </span>
              </button>
            );
          })}
        </div>

        {/* Original Uploaded Sheet Reference Banner for Macaque */}
        {selectedChar === 'macaque' && charProfile.emoteSheetImage && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#121920] p-5 grid gap-6 md:grid-cols-[1fr_1.3fr] items-center">
            <img
              src={charProfile.emoteSheetImage}
              alt="Ignis Macaque 12-Emote Reference Sheet"
              referrerPolicy="no-referrer"
              className="w-full max-h-80 object-cover rounded-xl border border-white/10"
            />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#FB923C] font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Reference Sculpture Alignment</span>
              </div>
              <h3 className="font-display text-xl font-bold text-white">
                Calibrated Against the Core 12 Macaque Expressions
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Designs #001 (Solar Wave Hello), #002 (Mega Chomp Grin), #003 (Crying Laugh XD),
                #021 (Deadpan Stare), #051 (Heart Eyes Simp), #036 (Home Alone Shock),
                #052 (Painfully Proud), #091 (Deep Thinker ...), #068 (Crimson Brow Scowl),
                #066 (Boiler Meltdown), #067 (Lock-In Fury), and #081 (ZZZ Macaque) map directly
                to the reference sheet poses and extend across 88 additional unique expressions.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
