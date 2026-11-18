import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GROUPS, HAIR_COLORS, ITEMS, SKIN_COLORS, type EditorTab, type Item } from '../data/items';
import { sfx } from '../lib/sound';
import { useGame } from '../store';
import { Showcase } from '../three/Showcase';
import { ClothIcon } from '../ui/ClothIcon';
import { CandyButton, CoinIcon, CoinPill, Confetti, Modal, ScreenHeader } from '../ui/kit';

const ALL_TABS = GROUPS.flatMap((g) => g.tabs);

export function AvatarEditor({ onGoPlay, onBack, initialTab = 'outfit' }: { onGoPlay: () => void; onBack: () => void; initialTab?: string }) {
  const avatar = useGame((s) => s.avatar);
  const coins = useGame((s) => s.coins);
  const [tabId, setTabId] = useState(initialTab);
  const tab: EditorTab = ALL_TABS.find((t) => t.id === tabId) ?? ALL_TABS[0];
  const group = GROUPS.find((g) => g.tabs.includes(tab)) ?? GROUPS[0];
  const [cheer, setCheer] = useState(0);
  const [buying, setBuying] = useState<Item | null>(null);
  const [party, setParty] = useState(0);

  const tapItem = (item: Item) => {
    const g = useGame.getState();
    if (g.owns(item.cat, item.id)) {
      if (g.avatar[item.cat] === item.id && item.cat !== 'outfit') return;
      sfx.equip();
      g.equip(item.cat, item.id);
      setCheer((c) => c + 1);
    } else {
      sfx.tap();
      setBuying(item);
    }
  };

  const confirmBuy = () => {
    if (!buying) return;
    const g = useGame.getState();
    if (g.buy(buying.cat, buying.id)) {
      sfx.buy();
      g.equip(buying.cat, buying.id);
      setCheer((c) => c + 1);
      setParty((p) => p + 1);
      setBuying(null);
    } else sfx.error();
  };

  const items = tab.cat === 'skin' ? [] : ITEMS.filter((i) => i.cat === tab.cat && (!tab.sub || i.sub === tab.sub));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScreenHeader title="👗 Mi Bloxi" onBack={onBack}>
        <CoinPill amount={coins} />
      </ScreenHeader>
    <div className="flex min-h-0 flex-1 gap-3 sm:gap-4">
      {/* Vista previa */}
      <div className="card relative w-[38%] shrink-0 overflow-hidden short:w-[34%]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#e7f6ff] to-[#fff0f8]" />
        <Showcase config={avatar} cheerKey={cheer} zoom={1.05} className="absolute inset-0" />
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <CandyButton
            tone="sun"
            className="h-12 px-5 text-lg short:h-10 short:text-base"
            onClick={() => {
              sfx.star();
              useGame.getState().surprise();
              setCheer((c) => c + 1);
            }}
            silent
          >
            🎲 ¡Sorpréndeme!
          </CandyButton>
        </div>
      </div>

      {/* Panel tipo armario */}
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="grid shrink-0 grid-cols-4 gap-1.5 p-2 pb-0">
          {GROUPS.map((g) => {
            const active = g.id === group.id;
            return (
              <button
                key={g.id}
                onClick={() => {
                  if (active) return;
                  sfx.tap();
                  setTabId(g.tabs[0].id);
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 transition-colors short:flex-row short:gap-1.5 short:py-1 ${
                  active ? 'text-white' : 'text-ink/70'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="group-pill"
                    className="absolute inset-0 rounded-2xl bg-grape shadow-[0_3px_0_#5f37c9]"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative text-2xl leading-none short:text-lg">{g.emoji}</span>
                <span className="relative text-sm font-bold sm:text-base">{g.label}</span>
              </button>
            );
          })}
        </div>

        {group.tabs.length > 1 ? (
          <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-2 py-2">
            {group.tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  sfx.tap();
                  setTabId(t.id);
                }}
                className={`flex shrink-0 items-center gap-1 rounded-full border-[3px] px-3 py-1 text-base font-bold transition-colors tablet:px-4 tablet:text-lg ${
                  tab.id === t.id ? 'border-grape bg-[#f1ebff] text-grape-dark' : 'border-transparent bg-[#f6f2fb] text-ink/60'
                }`}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="h-2 shrink-0" />
        )}

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-2">
          <AnimatePresence mode="wait">
            <motion.div key={tab.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.15 }}>
              {tab.cat === 'skin' && <Palette label="Color de piel" colorKey="skin" colors={SKIN_COLORS} onPick={() => setCheer((c) => c + 1)} />}
              {tab.cat === 'hair' && <Palette label="Color de pelo" colorKey="hairColor" colors={HAIR_COLORS} onPick={() => setCheer((c) => c + 1)} />}
              {items.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2.5 pt-2 tablet:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] tablet:gap-3">
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} onTap={() => tapItem(item)} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

    </div>
      <BuyModal item={buying} coins={coins} onClose={() => setBuying(null)} onBuy={confirmBuy} onGoPlay={onGoPlay} />
      {party > 0 && <Confetti key={party} count={50} />}
    </div>
  );
}

/** Dibujo de la prenda (ropa) o emoji (lo demás). Sin size, llena su contenedor. */
export function ItemVisual({ item, size }: { item: Item; size?: number }) {
  if (item.look) return <ClothIcon item={item} size={size ?? '100%'} />;
  if (size) return <span style={{ fontSize: size * 0.72, lineHeight: 1 }}>{item.emoji}</span>;
  return <span className="text-[42px] leading-none tablet:text-[58px]">{item.emoji}</span>;
}

function ItemCard({ item, onTap }: { item: Item; onTap: () => void }) {
  const equipped = useGame((s) => s.avatar[item.cat] === item.id);
  const owned = useGame((s) => item.price === 0 || s.owned.includes(`${item.cat}:${item.id}`));
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onTap}
      className={`relative flex aspect-[5/6] flex-col items-center justify-center gap-1 rounded-3xl border-4 p-1.5 transition-colors ${
        equipped ? 'border-grape bg-[#f1ebff]' : 'border-transparent bg-[#f6f2fb]'
      }`}
    >
      <span className={`flex h-[58px] w-[58px] items-center justify-center tablet:h-[80px] tablet:w-[80px] ${owned ? '' : 'opacity-70'}`}>
        <ItemVisual item={item} />
      </span>
      <span className="line-clamp-2 text-center text-[13px] font-semibold leading-tight tablet:text-[15px]">{item.name}</span>
      {equipped && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-mint text-base text-white shadow"
        >
          ✓
        </motion.span>
      )}
      {!owned ? (
        <span className="absolute -top-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-sun px-2 py-0.5 text-sm font-bold text-[#5a3b00] shadow-[0_2px_0_#d99b00]">
          <CoinIcon size={16} />
          {item.price}
        </span>
      ) : (
        item.price === 0 &&
        item.id !== 'none' && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-mint px-2 py-0.5 text-xs font-bold text-white">GRATIS</span>
        )
      )}
    </motion.button>
  );
}

function Palette({ label, colorKey, colors, onPick }: { label: string; colorKey: 'skin' | 'hairColor'; colors: string[]; onPick: () => void }) {
  const value = useGame((s) => s.avatar[colorKey]);
  const setColor = useGame((s) => s.setColor);
  return (
    <div className="mb-2">
      <div className="mb-2 text-lg font-bold">{label}</div>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((c) => (
          <motion.button
            key={c}
            whileTap={{ scale: 0.85 }}
            onClick={() => {
              sfx.equip();
              setColor(colorKey, c);
              onPick();
            }}
            className="h-11 w-11 rounded-full"
            style={{
              background: c,
              boxShadow: value === c ? '0 0 0 4px white, 0 0 0 7px #8b5cf6' : 'inset 0 -4px 0 rgba(0,0,0,0.12), 0 0 0 2px rgba(51,38,77,0.08)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function BuyModal({
  item, coins, onClose, onBuy, onGoPlay,
}: {
  item: Item | null;
  coins: number;
  onClose: () => void;
  onBuy: () => void;
  onGoPlay: () => void;
}) {
  const enough = item ? coins >= item.price : false;
  return (
    <Modal open={!!item} onClose={onClose} wide>
      {item && (
        <div className="flex items-center gap-6 short:gap-4">
          <div className="flex w-[34%] shrink-0 flex-col items-center">
          <motion.div className="flex justify-center" animate={{ y: [0, -8, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
            <ItemVisual item={item} size={120} />
          </motion.div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-center">
          <h2 className="text-3xl font-bold short:text-2xl">{item.name}</h2>
          <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full bg-[#fff6d6] px-5 py-1.5 text-3xl font-bold short:text-2xl">
            <CoinIcon size={34} /> {item.price}
          </div>
          {enough ? (
            <div className="mt-5 flex w-full gap-3 short:mt-3">
              <CandyButton tone="white" className="h-14 flex-1 text-xl" onClick={onClose}>
                Ahorita no
              </CandyButton>
              <CandyButton tone="mint" className="h-14 flex-1 text-xl" onClick={onBuy} silent>
                ¡Lo quiero! 🛍️
              </CandyButton>
            </div>
          ) : (
            <>
              <p className="mt-3 text-xl text-ink/70" style={{ animation: 'shake 0.4s' }}>
                Te faltan <b className="text-candy">{item.price - coins}</b> monedas 🥺 ¡Juega para ganar más!
              </p>
              <div className="mt-5 flex w-full gap-3 short:mt-3">
                <CandyButton tone="white" className="h-14 flex-1 text-xl" onClick={onClose}>
                  Cerrar
                </CandyButton>
                <CandyButton
                  tone="candy"
                  className="h-14 flex-1 text-xl"
                  onClick={() => {
                    onClose();
                    onGoPlay();
                  }}
                >
                  🎮 A jugar
                </CandyButton>
              </div>
            </>
          )}
          </div>
        </div>
      )}
    </Modal>
  );
}
