import React from 'react';
import { ArrowUpRight, Plus, Tag } from 'lucide-react';
import { CHARACTERS } from '../data/characters';
import { EmoteDesign, TradeEvent } from '../types/emote';
import { EmotePreviewThumb } from './EmotePreviewThumb';

interface CollectionViewProps {
  emotes: EmoteDesign[];
  trades: TradeEvent[];
  userAddress: string;
  walletEth: number;
  onInspect: (emote: EmoteDesign) => void;
  onGoStudio: () => void;
  onGoMarket: () => void;
}

export const CollectionView: React.FC<CollectionViewProps> = ({
  emotes,
  trades,
  userAddress,
  walletEth,
  onInspect,
  onGoStudio,
  onGoMarket,
}) => {
  const ownedEmotes = emotes.filter((e) => e.owner === userAddress);
  const createdEmotes = ownedEmotes.filter((e) => e.isUserCreated);
  const portfolioEth = ownedEmotes.reduce((sum, e) => sum + e.priceEth, 0);
  const userTrades = trades.filter((t) => t.actor === userAddress);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            My Emote Vault & Portfolio
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connected wallet <span className="font-mono text-slate-200">{userAddress}</span> · Manage listings, export platform packs, or mint new expressions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onGoStudio}
            className="flex items-center gap-1.5 rounded-lg bg-[#F97316] px-4 py-2 text-xs font-semibold text-[#0C1115] hover:bg-[#FB923C] transition-colors whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create & Mint Emote</span>
          </button>
          <button
            type="button"
            onClick={onGoMarket}
            className="rounded-lg border border-white/12 bg-[#141D25] px-4 py-2 text-xs font-medium text-slate-200 hover:bg-[#1C2833] transition-colors whitespace-nowrap"
          >
            Browse Market
          </button>
        </div>
      </div>

      {/* Vault KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-[#121920] px-5 py-4">
          <p className="text-xs text-slate-400">Wallet Balance</p>
          <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
            {walletEth.toFixed(2)} ETH
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#121920] px-5 py-4">
          <p className="text-xs text-slate-400">Owned Collectibles</p>
          <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
            {ownedEmotes.length}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#121920] px-5 py-4">
          <p className="text-xs text-slate-400">Original Studio Mints</p>
          <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
            {createdEmotes.length}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#121920] px-5 py-4">
          <p className="text-xs text-slate-400">Estimated Vault Value</p>
          <p className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
            {portfolioEth.toFixed(2)} ETH
          </p>
        </div>
      </div>

      {/* Owned Grid */}
      {ownedEmotes.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#121920] py-16 text-center space-y-3">
          <p className="text-base font-semibold text-white">
            Your Emote Vault is empty
          </p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Create a custom 3D animated expression in the Studio or acquire editions from the Marketplace floor.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={onGoStudio}
              className="px-4 py-2 rounded-lg bg-[#F97316] text-[#0C1115] text-xs font-semibold hover:bg-[#FB923C]"
            >
              Open 3D Studio
            </button>
            <button
              type="button"
              onClick={onGoMarket}
              className="px-4 py-2 rounded-lg border border-white/15 bg-[#18222C] text-white text-xs font-medium hover:bg-[#22303C]"
            >
              Explore Marketplace
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ownedEmotes.map((emote) => {
            const char = CHARACTERS.find((c) => c.id === emote.characterId)!;
            return (
              <article
                key={emote.id}
                onClick={() => onInspect(emote)}
                className="group cursor-pointer rounded-xl border border-white/10 bg-[#121920] overflow-hidden hover:border-white/25 transition-all hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] w-full relative">
                  <EmotePreviewThumb
                    characterId={emote.characterId}
                    params={emote.params}
                    className="h-full w-full"
                  />
                  <span className="absolute top-3 left-3 font-mono text-[11px] text-white bg-black/55 px-2 py-0.5 rounded">
                    {emote.code}
                  </span>
                  <span className="absolute top-3 right-3 text-[11px] font-medium text-slate-200 bg-black/55 px-2 py-0.5 rounded">
                    {emote.listedForSale ? 'Listed' : 'Vaulted'}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>{char.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{emote.rarity}</span>
                    </div>
                    <h3 className="font-display text-base font-semibold text-white mt-0.5 truncate">
                      {emote.name}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/8">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Tag className="h-3.5 w-3.5 text-[#FB923C]" />
                      <span className="font-mono font-semibold text-white">
                        {emote.priceEth.toFixed(2)} ETH
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-medium text-slate-300 group-hover:text-[#FB923C]">
                      <span>Manage & Export</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Personal Ledger */}
      {userTrades.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#121920] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-3">
            Your Recent Transactions
          </h3>
          <div className="divide-y divide-white/8 text-sm">
            {userTrades.map((t) => (
              <div
                key={t.id}
                className="py-2.5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2 text-slate-200">
                  <span className="font-medium text-[#FB923C]">{t.type}</span>
                  <span>{t.emoteName}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="font-mono text-white">
                    {t.priceEth.toFixed(2)} ETH
                  </span>
                  <span>{t.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
