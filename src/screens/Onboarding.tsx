import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BOY_AVATAR, DEFAULT_AVATAR } from '../data/items';
import { sfx } from '../lib/sound';
import { useGame, WELCOME_GIFT } from '../store';
import { Showcase } from '../three/Showcase';
import { CandyButton, CoinIcon, Confetti } from '../ui/kit';
import { Logo } from '../ui/Logo';

export function Onboarding() {
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState('');
  const avatar = useGame((s) => s.avatar);
  const [kind, setKind] = useState<'girl' | 'boy'>('girl');
  const [cheer, setCheer] = useState(0);
  const choose = (k: 'girl' | 'boy') => {
    if (k === kind) return;
    sfx.equip();
    setKind(k);
    setCheer((c) => c + 1);
    useGame.setState({ avatar: k === 'girl' ? { ...DEFAULT_AVATAR } : { ...BOY_AVATAR } });
  };
  const clean = name.trim();

  const finish = () => {
    sfx.win();
    useGame.getState().addCoins(WELCOME_GIFT);
    useGame.getState().setName(clean);
  };

  return (
    <div className="safe-top safe-bottom safe-x relative flex h-full flex-col items-center justify-center gap-4 overflow-y-auto landscape:flex-row landscape:gap-10">
      <div className="flex flex-col items-center">
        <div className="short:hidden">
          <Logo height={96} />
        </div>
        <div className="hidden short:block">
          <Logo height={58} />
        </div>
        <Showcase config={avatar} cheerKey={cheer} className="h-[30vh] w-[320px] max-w-full landscape:h-[52vh] landscape:w-[min(380px,40vw)]" />
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div
            key="name"
            className="card w-full max-w-md p-7 text-center"
            initial={{ y: 60, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            <h1 className="text-3xl font-bold">¡Hola! 👋</h1>
            <p className="mt-1 text-xl text-ink/70 short:text-lg">Elige tu Bloxi y escribe tu nombre</p>
            <div className="mt-3 grid grid-cols-2 gap-3 short:mt-2">
              {(
                [
                  ['girl', '👧', 'Niña'],
                  ['boy', '👦', 'Niño'],
                ] as const
              ).map(([k, emoji, label]) => (
                <motion.button
                  key={k}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => choose(k)}
                  className={`flex items-center justify-center gap-2 rounded-2xl border-4 py-2 text-2xl font-bold transition-colors short:py-1 short:text-xl ${
                    kind === k ? 'border-grape bg-[#f1ebff] text-grape-dark' : 'border-transparent bg-[#f6f2fb] text-ink/60'
                  }`}
                >
                  <span className="text-4xl short:text-3xl">{emoji}</span>
                  {label}
                  {kind === k && <span className="text-lg">✓</span>}
                </motion.button>
              ))}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 14))}
              onKeyDown={(e) => e.key === 'Enter' && clean && setStep(1)}
              placeholder="Escribe tu nombre"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              enterKeyHint="done"
              className="mt-4 h-16 w-full rounded-2xl border-4 short:mt-2 short:h-12 short:text-2xl border-[#e6dcff] bg-[#faf7ff] px-5 text-center text-3xl font-bold text-ink outline-none placeholder:text-ink/25 focus:border-grape"
            />
            <CandyButton tone="candy" disabled={!clean} className="mt-5 h-16 w-full text-2xl short:mt-3 short:h-12" onClick={() => setStep(1)}>
              ¡Listo! ✨
            </CandyButton>
          </motion.div>
        ) : (
          <motion.div
            key="gift"
            className="card w-full max-w-md p-7 text-center"
            initial={{ y: 60, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            <Confetti count={50} />
            <h1 className="text-4xl font-bold">¡Hola, {clean}! 🎉</h1>
            <p className="mt-2 text-xl text-ink/70">Este es tu Bloxi. ¡Puedes vestirlo como quieras!</p>
            <motion.div
              className="mx-auto mt-5 flex w-fit items-center gap-3 rounded-3xl bg-[#fff6d6] px-6 py-4"
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 16 }}
            >
              <CoinIcon size={50} />
              <div className="text-left">
                <div className="text-4xl font-bold leading-none">+{WELCOME_GIFT}</div>
                <div className="text-base text-ink/60">¡Regalo de bienvenida!</div>
              </div>
            </motion.div>
            <CandyButton tone="mint" className="mt-6 h-16 w-full text-2xl" onClick={finish} silent>
              ¡A jugar! 🚀
            </CandyButton>
            <button className="mt-3 text-lg text-ink/50" onClick={() => setStep(0)}>
              Cambiar nombre
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
