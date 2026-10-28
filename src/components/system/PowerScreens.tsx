import { useCallback, useEffect, useRef, useState } from 'react';
import { Power } from 'lucide-react';
import { useSystemStore } from '../../stores/systemStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { ConceptLogo } from '../icons/AppIcons';
import { useT } from '../../i18n';
import { playSound } from '../../services/sound';
import { useFileSystemStore } from '../../stores/fileSystemStore';

/**
 * Boot, restart, sign-out and shutdown screens.
 *
 * The sequence is short on purpose and can be skipped with a click or any key.
 * It is a visual simulation — no hardware is being started.
 */

const STAGES: { id: 'blank' | 'logo' | 'dots' | 'welcome'; duration: number }[] = [
  { id: 'blank', duration: 420 },
  { id: 'logo', duration: 1150 },
  { id: 'dots', duration: 1500 },
  { id: 'welcome', duration: 850 },
];

export function BootScreen() {
  const { t } = useT();
  const finishBoot = useSystemStore((state) => state.finishBoot);
  const setBootStage = useSystemStore((state) => state.setBootStage);
  const account = useSystemStore((state) => state.account);
  const power = useSystemStore((state) => state.power);
  const showBootAnimation = useSettingsStore((state) => state.settings.power.showBootAnimation);
  const fast = useSettingsStore((state) => state.settings.power.bootDuration === 'fast');
  const timers = useRef<number[]>([]);
  const [skipped, setSkipped] = useState(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const skip = useCallback(() => {
    if (skipped) return;
    setSkipped(true);
    clearTimers();
    finishBoot();
  }, [clearTimers, finishBoot, skipped]);

  useEffect(() => {
    clearTimers();
    if (power !== 'booting') return;

    if (!showBootAnimation) {
      const id = window.setTimeout(() => finishBoot(), fast ? 120 : 320);
      timers.current.push(id);
      return;
    }

    playSound('startup');
    let elapsed = 0;
    const factor = fast ? 0.55 : 1;
    STAGES.forEach((stage) => {
      const duration = Math.round(stage.duration * factor);
      const id = window.setTimeout(() => {
        setBootStage(stage.id, Math.round((elapsed / (STAGES.reduce((sum, item) => sum + item.duration * factor, 0))) * 100));
      }, elapsed);
      elapsed += duration;
      timers.current.push(id);
    });
    const finishId = window.setTimeout(() => finishBoot(), elapsed);
    timers.current.push(finishId);

    const onKey = () => skip();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimers();
    };
  }, [power, showBootAnimation, fast, finishBoot, setBootStage, skip, clearTimers]);

  return (
    <div
      className="fixed inset-0 z-[9000] flex cursor-pointer flex-col items-center justify-center bg-black text-white"
      onClick={skip}
      role="presentation"
    >
      {showBootAnimation ? (
        <BootSequence />
      ) : (
        <div className="flex flex-col items-center gap-5">
          <ConceptLogo size={72} />
          <BootDots />
        </div>
      )}
      <p className="pointer-events-none absolute bottom-10 text-[11px] tracking-wide text-white/45">
        {t('boot.powerOn')} · {t('boot.disclaimer')}
      </p>
      <span className="sr-only">{t('boot.starting')} — {account.displayName}</span>
    </div>
  );
}

function BootSequence() {
  const { t } = useT();
  const stage = useSystemStore((state) => state.bootStage);
  const account = useSystemStore((state) => state.account);

  return (
    <div className="flex flex-col items-center gap-6">
      {stage === 'blank' ? null : (
        <div className="flex flex-col items-center gap-7">
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className="logo-pane block h-11 w-11 rounded-[6px]"
                style={{
                  animationDelay: `${index * 90}ms`,
                  background: ['#60a5fa', '#38bdf8', '#818cf8', '#a78bfa'][index],
                }}
              />
            ))}
          </div>
          {stage === 'dots' || stage === 'logo' ? <BootDots /> : null}
          {stage === 'welcome' ? (
            <div className="animate-fade-in text-center">
              <p className="text-2xl font-light tracking-wide">{t('boot.welcome')}, {account.displayName}</p>
              <p className="mt-2 text-xs text-white/60">{t('boot.gettingReady')}…</p>
            </div>
          ) : null}
        </div>
      )}
      <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">{t('boot.starting')}</p>
    </div>
  );
}

export function BootDots() {
  return (
    <div className="relative flex h-6 w-32 items-center justify-center">
      {[0, 1, 2, 3, 4].map((index) => (
        <span key={index} className="boot-dot absolute" style={{ animationDelay: `${index * 180}ms` }} />
      ))}
    </div>
  );
}

export function TransitionScreen({ mode }: { mode: 'shutting-down' | 'restarting' | 'signing-out' }) {
  const { t } = useT();
  const setPower = useSystemStore((state) => state.setPower);
  const startBoot = useSystemStore((state) => state.startBoot);
  const hydrate = useFileSystemStore((state) => state.hydrate);

  const label = mode === 'shutting-down' ? t('boot.shuttingDown') : mode === 'restarting' ? t('boot.restarting') : t('boot.signingOut');

  useEffect(() => {
    if (mode === 'shutting-down') playSound('shutdown');
    const timer = window.setTimeout(() => {
      if (mode === 'restarting') {
        void hydrate();
        startBoot();
      } else if (mode === 'signing-out') {
        setPower('lock');
      } else {
        setPower('off');
      }
    }, mode === 'signing-out' ? 1200 : 2200);
    return () => window.clearTimeout(timer);
  }, [mode, setPower, startBoot, hydrate]);

  return (
    <div className="fixed inset-0 z-[9000] flex flex-col items-center justify-center gap-7 bg-black text-white">
      <div className="animate-pulse-soft">
        <ConceptLogo size={56} />
      </div>
      <p className="text-sm font-light tracking-wide text-white/80">{label}…</p>
      <BootDots />
    </div>
  );
}

export function PowerOffScreen() {
  const { t } = useT();
  const startBoot = useSystemStore((state) => state.startBoot);
  const hydrate = useFileSystemStore((state) => state.hydrate);

  return (
    <div className="fixed inset-0 z-[9000] flex flex-col items-center justify-center gap-8 bg-black text-white">
      <p className="text-sm font-light text-white/70">{t('boot.poweredOff')}</p>
      <button
        type="button"
        onClick={() => {
          void hydrate();
          startBoot();
        }}
        className="win-button win-button-accent gap-2 px-5 py-2.5 text-sm"
        autoFocus
      >
        <Power size={16} />
        {t('boot.powerOnButton')}
      </button>
      <p className="max-w-md text-center text-[11px] leading-relaxed text-white/35">{t('boot.disclaimer')}</p>
    </div>
  );
}
