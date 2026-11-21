import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search, SlidersHorizontal } from 'lucide-react';
import { CHARACTERS, PLATFORM_SPECS } from '../data/characters';
import {
  CharacterId,
  EmoteCategory,
  EmoteDesign,
  PlatformId,
  RarityTier,
  TradeEvent,
} from '../types/emote';
import { EmoteCanvas3D } from './EmoteCanvas3D';
import { EmotePreviewThumb } from './EmotePreviewThumb';

interface MarketplaceViewProps {
  emotes: EmoteDesign[];
  trades: TradeEvent[];
  userAddress: string;
  onInspect: (emote: EmoteDesign) => void;
  onGoStudio: () => void;
  onGoDirectory: (charId?: CharacterId) => void;
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

const RARITIES: Array<'All' | RarityTier> = [
  'All',
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Legendary',
];

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  emotes,
  trades,
  userAddress,
  onInspect,
  onGoStudio,
  onGoDirectory,
}) => {
  const [heroMode, setHeroMode] = useState<'live3d' | 'pfp' | 'sheet'>('live3d');
  const [heroEmoteIdx, setHeroEmoteIdx] = useState(0);

  const [charFilter, setCharFilter] = useState<'all' | CharacterId>('all');
  const [catFilter, setCatFilter] = useState<'All' | EmoteCategory>('All');
  const [rarityFilter, setRarityFilter] = useState<'All' | RarityTier>('All');
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'priceAsc' | 'priceDesc' | 'likes'>('featured');
  const [page, setPage] = useState(1);

  const heroShowcaseEmotes = useMemo(() => {
    const ids = ['macaque-36', 'macaque-51', 'macaque-66', 'macaque-52', 'macaque-91', 'macaque-81'];
    return ids
      .map((id) => emotes.find((e) => e.id === id))
      .filter((e): e is EmoteDesign => Boolean(e));
  }, [emotes]);

  const activeHeroEmote = heroShowcaseEmotes[heroEmoteIdx] || emotes[0];

  const listedEmotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = emotes.filter((e) => {
      if (!e.listedForSale) return false;
      if (charFilter !== 'all' && e.characterId !== charFilter) return false;
      if (catFilter !== 'All' && e.category !== catFilter) return false;
      if (rarityFilter !== 'All' && e.rarity !== rarityFilter) return false;
      if (platformFilter !== 'all' && !e.platforms.includes(platformFilter)) return false;
      if (
        q &&
        !e.name.toLowerCase().includes(q) &&
        !e.code.toLowerCase().includes(q) &&
        !e.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    if (sortBy === 'priceAsc') {
      return [...filtered].sort((a, b) => a.priceEth - b.priceEth);
    }
    if (sortBy === 'priceDesc') {
      return [...filtered].sort((a, b) => b.priceEth - a.priceEth);
    }
    if (sortBy === 'likes') {
      return [...filtered].sort((a, b) => b.likes - a.likes);
    }
    return filtered;
  }, [emotes, charFilter, catFilter, rarityFilter, platformFilter, searchQuery, sortBy]);

  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(listedEmotes.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = listedEmotes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const macaqueChar = CHARACTERS[0];
  const totalVolumeEth = useMemo(
    () => trades.reduce((acc, t) => acc + t.priceEth, 148.4),
    [trades]
  );

  return (
    <div className="space-y-12">
      {/* 1. Asymmetric Hero Split */}
      <section className="grid gap-8 lg:grid-cols-[1.05fr_1fr] items-stretch">
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#121920] p-7 md:p-9">
          <div className="space-y-5">
            <p className="text-xs font-medium text-[#FB923C] tracking-wide">
              3D Animated Emote Collectibles · 4 Characters · 400 Designs
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-[1.1] tracking-tight text-balance">
              Create, Mint & Trade Expressive 3D Emotes
            </h1>
            <p className="text-base text-slate-300 leading-relaxed max-w-xl">
              Every character ships with 100 distinct facial rigs and gesture animations
              engineered for instant compatibility across Discord, Twitch, Telegram, TikTok,
              and VRChat.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onGoStudio}
                className="px-5 py-2.5 rounded-lg bg-[#F97316] text-[#0C1115] text-sm font-semibold hover:bg-[#FB923C] transition-colors whitespace-nowrap"
              >
                Open 3D Studio
              </button>
              <button
                type="button"
                onClick={() => onGoDirectory('macaque')}
                className="px-5 py-2.5 rounded-lg border border-white/15 bg-[#19232C] text-white text-sm font-medium hover:bg-[#22303C] transition-colors whitespace-nowrap"
              >
                Browse 100 Emotes / Character
              </button>
            </div>
          </div>

          {/* Reference Sheet Strip */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400">
                Flagship Character Reference · Ignis Macaque
              </span>
              <div className="flex items-center gap-1 bg-[#0C1115] p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setHeroMode('live3d')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    heroMode === 'live3d'
                      ? 'bg-[#212D38] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Live 3D Rig
                </button>
                <button
                  type="button"
                  onClick={() => setHeroMode('pfp')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    heroMode === 'pfp'
                      ? 'bg-[#212D38] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  3D PFP
                </button>
                <button
                  type="button"
                  onClick={() => setHeroMode('sheet')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    heroMode === 'sheet'
                      ? 'bg-[#212D38] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Emote Sheet
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {heroShowcaseEmotes.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setHeroMode('live3d');
                    setHeroEmoteIdx(idx);
                  }}
                  className={`group flex flex-col items-center rounded-lg border p-1.5 text-left transition-colors ${
                    heroMode === 'live3d' && heroEmoteIdx === idx
                      ? 'border-[#F97316] bg-[#F97316]/10'
                      : 'border-white/8 bg-[#17212A] hover:border-white/25'
                  }`}
                >
                  <EmotePreviewThumb
                    characterId={item.characterId}
                    params={item.params}
                    className="h-12 w-full rounded-md"
                  />
                  <span className="mt-1.5 w-full truncate text-center text-[11px] font-medium text-slate-200">
                    {item.name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live 3D WebGL Stage OR Reference Artwork */}
        <div className="min-h-[420px] lg:min-h-[480px] rounded-2xl border border-white/10 bg-[#121920] overflow-hidden relative">
          {heroMode === 'live3d' && activeHeroEmote ? (
            <EmoteCanvas3D
              characterId={activeHeroEmote.characterId}
              params={activeHeroEmote.params}
              showDock={true}
            />
          ) : (
            <div className="relative h-full w-full bg-[#4A6572]">
              <img
                src={
                  heroMode === 'pfp'
                    ? macaqueChar.referenceImage
                    : macaqueChar.emoteSheetImage
                }
                alt={
                  heroMode === 'pfp'
                    ? 'Ignis Macaque 3D Character Portrait'
                    : 'Ignis Macaque Multi-Emote Reference Sheet'
                }
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-mono text-[#FB923C]">
                    {heroMode === 'pfp' ? 'CHARACTER CONCEPT 01' : 'EXPRESSION SHEET 01'}
                  </p>
                  <p className="font-display text-lg font-semibold text-white">
                    {heroMode === 'pfp'
                      ? 'Ignis Macaque — Base 3D Rig Sculpture'
                      : 'Core 12 Facial & Hand Expressions Reference'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHeroMode('live3d')}
                  className="px-3.5 py-2 rounded-lg bg-[#F97316] text-[#0C1115] text-xs font-semibold hover:bg-[#FB923C] transition-colors whitespace-nowrap shrink-0"
                >
                  Animate in 3D
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. 4-Column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-[#121920] px-5 py-4">
          <p className="text-xs text-slate-400">Catalog Supply</p>
          <p className="font-display text-2xl font-bold text-white tabular-nums mt-1">
            {emotes.length} Emotes
          </p>
          <p className="text-xs text-slate-400 mt-0.5">100 unique designs per character</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#121920] px-5 py-4">
          <p className="text-xs text-slate-400">Rigged 3D Characters</p>
          <p className="font-display text-2xl font-bold text-white tabular-nums mt-1">
            4 Species
          </p>
          <p className="text-xs text-slate-400 mt-0.5">16 parametric facial weights</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#121920] px-5 py-4">
          <p className="text-xs text-slate-400">Platform Targets</p>
          <p className="font-display text-2xl font-bold text-white tabular-nums mt-1">
            6 Formats
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Discord · Twitch · Telegram · VRChat</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#121920] px-5 py-4">
          <p className="text-xs text-slate-400">Marketplace Volume</p>
          <p className="font-display text-2xl font-bold text-white tabular-nums mt-1">
            {totalVolumeEth.toFixed(2)} ETH
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{listedEmotes.length} active listings</p>
        </div>
      </section>

      {/* 3. Trading Floor & Filter Controls */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h2 className="font-display text-2xl font-bold text-white tracking-tight">
              Marketplace Listings
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Inspect any collectible in real-time 3D, test chat sizes, and buy or bid directly.
            </p>
          </div>

          {/* Character Segmented Switch */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#121920] border border-white/10">
            <button
              type="button"
              onClick={() => {
                setCharFilter('all');
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                charFilter === 'all'
                  ? 'bg-[#F97316] text-[#0C1115] font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              All Characters
            </button>
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCharFilter(c.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  charFilter === c.id
                    ? 'bg-[#F97316] text-[#0C1115] font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-3">
          <div className="relative flex items-center">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search emote name, MAC-036, mood..."
              className="w-full rounded-lg border border-white/10 bg-[#121920] pl-10 pr-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#F97316] focus:outline-none"
            />
          </div>

          <select
            value={catFilter}
            onChange={(e) => {
              setCatFilter(e.target.value as 'All' | EmoteCategory);
              setPage(1);
            }}
            aria-label="Filter by expression category"
            className="rounded-lg border border-white/10 bg-[#121920] px-3 py-2 text-sm text-slate-200 focus:border-[#F97316] focus:outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All Categories' : cat}
              </option>
            ))}
          </select>

          <select
            value={rarityFilter}
            onChange={(e) => {
              setRarityFilter(e.target.value as 'All' | RarityTier);
              setPage(1);
            }}
            aria-label="Filter by rarity"
            className="rounded-lg border border-white/10 bg-[#121920] px-3 py-2 text-sm text-slate-200 focus:border-[#F97316] focus:outline-none"
          >
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r === 'All' ? 'All Rarities' : r}
              </option>
            ))}
          </select>

          <select
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value as 'all' | PlatformId);
              setPage(1);
            }}
            aria-label="Filter by platform compatibility"
            className="rounded-lg border border-white/10 bg-[#121920] px-3 py-2 text-sm text-slate-200 focus:border-[#F97316] focus:outline-none"
          >
            <option value="all">All Platforms</option>
            {PLATFORM_SPECS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="relative flex items-center">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400 absolute left-3 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as 'featured' | 'priceAsc' | 'priceDesc' | 'likes'
                )
              }
              aria-label="Sort listings"
              className="w-full rounded-lg border border-white/10 bg-[#121920] pl-9 pr-3 py-2 text-sm text-slate-200 focus:border-[#F97316] focus:outline-none"
            >
              <option value="featured">Featured Order</option>
              <option value="priceAsc">Price: Low to High</option>
              <option value="priceDesc">Price: High to Low</option>
              <option value="likes">Most Collected</option>
            </select>
          </div>
        </div>

        {/* Product Grid */}
        {pageItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#121920] py-16 text-center">
            <p className="text-base font-medium text-white">
              No matching emote listings found
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Adjust your filters or explore the full 100-emote directory.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pageItems.map((emote) => {
              const char = CHARACTERS.find((c) => c.id === emote.characterId)!;
              const isOwned = emote.owner === userAddress;

              return (
                <article
                  key={emote.id}
                  onClick={() => onInspect(emote)}
                  className="group cursor-pointer rounded-xl border border-white/10 bg-[#121920] overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:border-white/25"
                >
                  <div className="aspect-[4/3] w-full relative overflow-hidden">
                    <EmotePreviewThumb
                      characterId={emote.characterId}
                      params={emote.params}
                      className="h-full w-full"
                    />
                    <div className="absolute top-3 left-3 text-[11px] font-mono text-white/90 bg-black/55 px-2 py-0.5 rounded">
                      {emote.code}
                    </div>
                    <div className="absolute top-3 right-3 text-[11px] font-medium text-slate-200 bg-black/55 px-2 py-0.5 rounded">
                      {emote.rarity}
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span>{char.name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{emote.category}</span>
                      </div>
                      <h3 className="font-display text-base font-semibold text-white mt-0.5 truncate">
                        {emote.name}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/8">
                      <div>
                        <span className="text-[11px] text-slate-400 block">
                          {isOwned ? 'Your Listing' : 'Floor Price'}
                        </span>
                        <span className="font-mono text-sm font-semibold text-white tabular-nums">
                          {emote.priceEth.toFixed(2)} ETH
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">
                          Compatibility
                        </span>
                        <span className="font-mono text-xs text-slate-200">
                          {emote.platforms.length} Platforms
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onInspect(emote);
                        }}
                        className="flex items-center gap-1 rounded-lg bg-[#1A242E] px-3 py-1.5 text-xs font-medium text-white group-hover:bg-[#F97316] group-hover:text-[#0C1115] transition-colors whitespace-nowrap"
                      >
                        <span>Inspect 3D</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <p className="text-xs font-mono text-slate-400">
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, listedEmotes.length)} of{' '}
              {listedEmotes.length} listings
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#121920] text-xs font-medium text-slate-200 disabled:opacity-40 hover:bg-[#1A242E]"
              >
                Previous
              </button>
              <span className="font-mono text-xs text-slate-300 px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#121920] text-xs font-medium text-slate-200 disabled:opacity-40 hover:bg-[#1A242E]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 4. Recent Live Market Activity */}
      <section className="rounded-2xl border border-white/10 bg-[#121920] p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-white">
            Recent Marketplace Activity
          </h3>
          <span className="text-xs text-slate-400">
            Live orderbook & mint ledger
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-slate-400">
                <th className="pb-2.5 font-medium">Action</th>
                <th className="pb-2.5 font-medium">Emote Collectible</th>
                <th className="pb-2.5 font-medium">Character</th>
                <th className="pb-2.5 font-medium">Price</th>
                <th className="pb-2.5 font-medium">Collector</th>
                <th className="pb-2.5 font-medium text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {trades.slice(0, 6).map((tr) => {
                const c = CHARACTERS.find((ch) => ch.id === tr.characterId);
                return (
                  <tr key={tr.id} className="text-slate-300">
                    <td className="py-2.5 font-medium text-white">{tr.type}</td>
                    <td className="py-2.5">{tr.emoteName}</td>
                    <td className="py-2.5 text-slate-400">{c?.name}</td>
                    <td className="py-2.5 font-mono text-white tabular-nums">
                      {tr.priceEth.toFixed(2)} ETH
                    </td>
                    <td className="py-2.5 font-mono text-xs text-slate-400">
                      {tr.actor === userAddress ? 'You' : tr.actor}
                    </td>
                    <td className="py-2.5 text-right text-xs text-slate-400">
                      {tr.timestamp}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
