import React, { useEffect, useState } from 'react';
import { CollectionView } from './components/CollectionView';
import { Directory100View } from './components/Directory100View';
import { InspectTradeModal } from './components/InspectTradeModal';
import { MarketplaceView } from './components/MarketplaceView';
import { StudioView } from './components/StudioView';
import { buildInitialCatalog, INITIAL_TRADES } from './data/emoteCatalog';
import { CharacterId, EmoteDesign, TradeEvent } from './types/emote';

type ActiveTab = 'marketplace' | 'directory' | 'studio' | 'collection';

const STORAGE_KEY = 'mimicvault_state_v1';
const USER_ADDRESS = '0xA3F...88C1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('marketplace');
  const [directoryChar, setDirectoryChar] = useState<CharacterId>('macaque');
  const [studioSeedEmote, setStudioSeedEmote] = useState<EmoteDesign | null>(null);
  const [inspectedEmoteId, setInspectedEmoteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [emotes, setEmotes] = useState<EmoteDesign[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.emotes) && parsed.emotes.length >= 400) {
          return parsed.emotes;
        }
      }
    } catch {
      // Fallback to fresh catalog
    }
    return buildInitialCatalog();
  });

  const [trades, setTrades] = useState<TradeEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.trades)) return parsed.trades;
      }
    } catch {
      // Ignore
    }
    return INITIAL_TRADES;
  });

  const [walletEth, setWalletEth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.walletEth === 'number') return parsed.walletEth;
      }
    } catch {
      // Ignore
    }
    return 12.5;
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ emotes, trades, walletEth })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [emotes, trades, walletEth]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const inspectedEmote =
    emotes.find((e) => e.id === inspectedEmoteId) || null;

  const pushTrade = (
    emote: EmoteDesign,
    type: TradeEvent['type'],
    priceEth: number
  ) => {
    const ev: TradeEvent = {
      id: `tr-${Date.now()}`,
      emoteId: emote.id,
      emoteName: emote.name,
      characterId: emote.characterId,
      type,
      priceEth,
      actor: USER_ADDRESS,
      timestamp: 'Just now',
    };
    setTrades((prev) => [ev, ...prev.slice(0, 19)]);
  };

  const handleBuy = (emoteId: string) => {
    const target = emotes.find((e) => e.id === emoteId);
    if (!target || walletEth < target.priceEth) return;

    setWalletEth((w) => Number((w - target.priceEth).toFixed(2)));
    setEmotes((prev) =>
      prev.map((e) =>
        e.id === emoteId
          ? {
              ...e,
              owner: USER_ADDRESS,
              listedForSale: false,
              likes: e.likes + 1,
            }
          : e
      )
    );
    pushTrade(target, 'Purchased', target.priceEth);
    setToast(`Acquired ${target.name} for ${target.priceEth.toFixed(2)} ETH`);
  };

  const handleMintEdition = (emoteId: string) => {
    const target = emotes.find((e) => e.id === emoteId);
    if (
      !target ||
      target.mintedCount >= target.editionSize ||
      walletEth < target.priceEth
    ) {
      return;
    }
    setWalletEth((w) => Number((w - target.priceEth).toFixed(2)));
    setEmotes((prev) =>
      prev.map((e) =>
        e.id === emoteId
          ? {
              ...e,
              mintedCount: e.mintedCount + 1,
              owner: USER_ADDRESS,
              likes: e.likes + 1,
            }
          : e
      )
    );
    pushTrade(target, 'Minted', target.priceEth);
    setToast(`Minted Edition #${target.mintedCount + 1} of ${target.name}`);
  };

  const handleToggleList = (emoteId: string, priceEth: number) => {
    const target = emotes.find((e) => e.id === emoteId);
    if (!target) return;
    const nextListed = target.listedForSale
      ? priceEth !== target.priceEth
        ? true
        : false
      : true;
    setEmotes((prev) =>
      prev.map((e) =>
        e.id === emoteId
          ? { ...e, priceEth, listedForSale: nextListed }
          : e
      )
    );
    if (nextListed) {
      pushTrade(target, 'Listed', priceEth);
      setToast(`Listed ${target.name} at ${priceEth.toFixed(2)} ETH`);
    } else {
      setToast(`Delisted ${target.name} from Marketplace`);
    }
  };

  const handleBid = (emoteId: string, bidEth: number) => {
    const target = emotes.find((e) => e.id === emoteId);
    if (!target) return;
    pushTrade(target, 'Bid', bidEth);
    setToast(`Placed ${bidEth.toFixed(2)} ETH offer on ${target.name}`);
  };

  const handleMintNewEmote = (
    draft: Omit<EmoteDesign, 'id' | 'code' | 'index' | 'creator' | 'owner' | 'likes'>
  ) => {
    const charCount = emotes.filter(
      (e) => e.characterId === draft.characterId
    ).length;
    const nextIndex = charCount + 1;
    const prefix =
      draft.characterId === 'macaque'
        ? 'MAC'
        : draft.characterId === 'kitsune'
          ? 'KIT'
          : draft.characterId === 'tanuki'
            ? 'TAN'
            : 'AXO';

    const created: EmoteDesign = {
      ...draft,
      id: `${draft.characterId}-custom-${Date.now()}`,
      code: `${prefix}-${String(nextIndex).padStart(3, '0')}`,
      index: nextIndex,
      creator: USER_ADDRESS,
      owner: USER_ADDRESS,
      likes: 1,
    };

    setEmotes((prev) => [created, ...prev]);
    pushTrade(created, 'Minted', created.priceEth);
    setToast(`Minted "${created.name}" (${created.code})`);
  };

  const handleRemixInStudio = (emote: EmoteDesign) => {
    setStudioSeedEmote(emote);
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoDirectory = (charId?: CharacterId) => {
    if (charId) setDirectoryChar(charId);
    setActiveTab('directory');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ownedCount = emotes.filter((e) => e.owner === USER_ADDRESS).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0C1115] text-[#F1F5F9]">
      {/* Strict 3-Zone Top Navigation Contract */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0C1115]/95">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-8 px-5 md:px-8 py-3.5">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('marketplace')}
            className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            MimicVault
          </button>

          {/* Zone 2: 4 Single-line Text Navigation Links */}
          <nav
            aria-label="Primary"
            className="flex items-center gap-5 md:gap-7 overflow-x-auto text-sm font-medium"
          >
            {(
              [
                { id: 'marketplace', label: 'Marketplace' },
                { id: 'directory', label: '100 Emotes' },
                { id: 'studio', label: '3D Studio' },
                { id: 'collection', label: `Vault (${ownedCount})` },
              ] as Array<{ id: ActiveTab; label: string }>
            ).map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveTab(nav.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  activeTab === nav.id
                    ? 'border-[#F97316] text-white'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0 hidden sm:flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab('collection')}
              className="rounded-lg bg-[#F97316] px-4 py-2 font-mono text-xs font-semibold text-[#0C1115] hover:bg-[#FB923C] transition-colors whitespace-nowrap shrink-0"
            >
              {walletEth.toFixed(2)} ETH · Vault
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-[1380px] flex-1 px-5 md:px-8 py-8">
        {activeTab === 'marketplace' && (
          <MarketplaceView
            emotes={emotes}
            trades={trades}
            userAddress={USER_ADDRESS}
            onInspect={(e) => setInspectedEmoteId(e.id)}
            onGoStudio={() => {
              setStudioSeedEmote(null);
              setActiveTab('studio');
            }}
            onGoDirectory={handleGoDirectory}
          />
        )}

        {activeTab === 'directory' && (
          <Directory100View
            emotes={emotes}
            initialCharacterId={directoryChar}
            onInspect={(e) => setInspectedEmoteId(e.id)}
            onRemixInStudio={handleRemixInStudio}
          />
        )}

        {activeTab === 'studio' && (
          <StudioView
            key={studioSeedEmote?.id || 'fresh-studio'}
            emotes={emotes}
            initialEmote={studioSeedEmote}
            onMintNewEmote={handleMintNewEmote}
          />
        )}

        {activeTab === 'collection' && (
          <CollectionView
            emotes={emotes}
            trades={trades}
            userAddress={USER_ADDRESS}
            walletEth={walletEth}
            onInspect={(e) => setInspectedEmoteId(e.id)}
            onGoStudio={() => setActiveTab('studio')}
            onGoMarket={() => setActiveTab('marketplace')}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-white/10 bg-[#0A0E12] mt-12">
        <div className="mx-auto flex max-w-[1380px] flex-col sm:flex-row items-center justify-between gap-4 px-5 md:px-8 py-6 text-xs text-slate-400">
          <span>MimicVault · 3D Animated Emote Collectibles</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => handleGoDirectory('macaque')}
              className="hover:text-white transition-colors"
            >
              100-Emote Matrix
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('studio')}
              className="hover:text-white transition-colors"
            >
              3D Expression Studio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('marketplace')}
              className="hover:text-white transition-colors"
            >
              Trading Floor
            </button>
          </div>
        </div>
      </footer>

      {/* Live 3D Inspect & Trade Modal */}
      <InspectTradeModal
        emote={inspectedEmote}
        userAddress={USER_ADDRESS}
        walletEth={walletEth}
        onClose={() => setInspectedEmoteId(null)}
        onBuy={handleBuy}
        onMintEdition={handleMintEdition}
        onToggleList={handleToggleList}
        onBid={handleBid}
        onRemixInStudio={handleRemixInStudio}
      />

      {/* Non-intrusive Action Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 rounded-xl border border-[#F97316]/50 bg-[#131C24] px-4 py-3 text-xs font-medium text-white shadow-2xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
