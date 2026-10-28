import { useEffect, useMemo, useRef, useState } from 'react';
import { Accessibility, ChevronUp, Eye, EyeOff, Power, RotateCcw, ShieldCheck, Wifi, WifiOff, LogOut } from 'lucide-react';
import { useSystemStore } from '../../stores/systemStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getWallpaper } from '../../data/wallpapers';
import { useT } from '../../i18n';
import { formatLongDate, formatTime } from '../../services/format';
import { useClock } from '../../hooks/useAppearance';
import { DEFAULT_DEMO_PASSWORD } from '../../services/auth';
import { playSound } from '../../services/sound';
import { useShellStore } from '../../stores/shellStore';
import { AVATARS } from '../../stores/systemStore';

type Phase = 'locked' | 'login' | 'entering';

export function LockScreen() {
  const { t, isRTL } = useT();
  const account = useSystemStore((state) => state.account);
  const network = useSettingsStore((state) => state.settings.network);
  const wallpaperId = useSettingsStore((state) => state.settings.personalization.lockWallpaperId);
  const signIn = useSystemStore((state) => state.signIn);
  const shutdown = useSystemStore((state) => state.shutdown);
  const restart = useSystemStore((state) => state.restart);
  const signOut = useSystemStore((state) => state.signOut);
  const setAccessibility = useSystemStore((state) => state.setAccessibility);
  const accessibility = useSystemStore((state) => state.accessibility);
  const openDialog = useShellStore((state) => state.openDialog);

  const [phase, setPhase] = useState<Phase>('locked');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [powerMenu, setPowerMenu] = useState(false);
  const [a11yMenu, setA11yMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const now = useClock(1000);
  const wallpaper = useMemo(() => getWallpaper(wallpaperId), [wallpaperId]);

  useEffect(() => {
    if (phase === 'login') {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 260);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [phase]);

  const goToLogin = () => {
    if (phase !== 'locked') return;
    playSound('click');
    setPhase('login');
    setError(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (phase === 'locked' && !event.metaKey && !event.ctrlKey && !event.altKey) goToLogin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const ok = await signIn(password);
    if (ok) {
      setPhase('entering');
      playSound('open');
      window.setTimeout(() => setPassword(''), 400);
    } else {
      setError(t('lock.wrongPassword'));
      playSound('error');
      setPassword('');
      inputRef.current?.focus();
    }
    setBusy(false);
  };

  const avatarColor = account.avatarColor || AVATARS[0].color;
  const initials = account.displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-[8000] overflow-hidden bg-black text-white">
      <img src={wallpaper.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/70" />

      {phase === 'locked' ? (
        <button
          type="button"
          onClick={goToLogin}
          className="group absolute inset-0 flex w-full cursor-pointer flex-col items-center justify-center gap-3 text-center"
        >
          <div className="animate-fade-in">
            <p className="text-[92px] font-extralight leading-none tracking-tight drop-shadow-lg">{formatTime(now)}</p>
            <p className="mt-3 text-lg font-light text-white/85">{formatLongDate(now)}</p>
          </div>
          <span className="mt-16 flex items-center gap-2 text-xs text-white/60 transition-opacity group-hover:text-white/90">
            <ChevronUp size={14} className="animate-pulse-soft" />
            {t('lock.clickToUnlock')}
          </span>
        </button>
      ) : null}

      {phase !== 'locked' ? (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-5 transition-all duration-500 ${
            phase === 'entering' ? 'scale-110 opacity-0' : 'animate-slide-up opacity-100'
          }`}
        >
          <div
            className="flex h-28 w-28 items-center justify-center rounded-full text-3xl font-semibold shadow-lg ring-4 ring-white/20"
            style={{ background: avatarColor }}
            aria-hidden
          >
            {initials || '🙂'}
          </div>
          <div className="text-center">
            <p className="text-2xl font-light">{account.displayName}</p>
            {phase === 'entering' ? (
              <p className="mt-2 text-sm text-white/75">{t('lock.signingIn')}</p>
            ) : (
              <form onSubmit={submit} className="mt-4 flex flex-col items-center gap-3">
                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type={reveal ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={t('lock.enterPassword')}
                      autoComplete="off"
                      aria-label={t('lock.password')}
                      className="w-64 rounded-md border border-white/25 bg-white/12 px-3 py-2 text-sm text-white placeholder-white/55 outline-none backdrop-blur-md transition focus:border-white/60 focus:bg-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((value) => !value)}
                      title={reveal ? t('lock.hidePassword') : t('lock.showPassword')}
                      className="absolute inset-y-0 right-2 flex items-center text-white/70 hover:text-white"
                      tabIndex={-1}
                    >
                      {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md bg-white/85 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-50"
                  >
                    {busy ? '…' : <span aria-hidden>→</span>}
                  </button>
                </div>

                {error ? (
                  <p className="flex items-center gap-2 rounded-md bg-red-500/20 px-3 py-1.5 text-xs text-red-100" role="alert">
                    <ShieldCheck size={14} /> {error}
                  </p>
                ) : null}

                <p className="max-w-sm text-center text-[11px] leading-relaxed text-white/55">
                  {account.hint
                    ? `${t('lock.hint')}: ${account.hint}`
                    : t('lock.demoNotice', { password: DEFAULT_DEMO_PASSWORD })}
                </p>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {/* Bottom bar: accessibility, network, power */}
      <div className={`absolute bottom-6 flex items-center gap-2 ${isRTL ? 'left-6' : 'right-6'}`}>
        <div className="relative">
          <button
            type="button"
            className="icon-button h-9 w-9 rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            onClick={() => {
              setA11yMenu((value) => !value);
              setPowerMenu(false);
            }}
            title={t('lock.accessibility')}
            aria-label={t('lock.accessibility')}
          >
            <Accessibility size={18} />
          </button>
          {a11yMenu ? (
            <div className={`panel absolute bottom-11 ${isRTL ? 'left-0' : 'right-0'} w-56 p-3 text-[13px] text-[var(--text)]`}>
              <p className="mb-2 text-xs font-semibold opacity-70">{t('a11y.title')}</p>
              <label className="mb-2 block">
                <span className="mb-1 block text-xs">{t('a11y.textSize')}: {accessibility.textSize}%</span>
                <input
                  type="range"
                  min={100}
                  max={160}
                  step={10}
                  value={accessibility.textSize}
                  onChange={(event) => setAccessibility({ textSize: Number(event.target.value) })}
                  className="w-full accent-[var(--accent)]"
                />
              </label>
              <button
                type="button"
                className="list-row w-full justify-between"
                onClick={() => setAccessibility({ highContrast: !accessibility.highContrast })}
              >
                <span>{t('a11y.contrast')}</span>
                <span className="text-xs opacity-60">{accessibility.highContrast ? 'On' : 'Off'}</span>
              </button>
              <label className="mb-1 block">
                <span className="mb-1 block text-xs">{t('a11y.magnifier')}: {accessibility.cursorSize}%</span>
                <input
                  type="range"
                  min={100}
                  max={220}
                  step={20}
                  value={accessibility.cursorSize}
                  onChange={(event) => setAccessibility({ cursorSize: Number(event.target.value) })}
                  className="w-full accent-[var(--accent)]"
                />
              </label>
              <button
                type="button"
                className="list-row w-full justify-between"
                onClick={() => setAccessibility({ textSize: 100, highContrast: false, zoom: 100, cursorSize: 100 })}
              >
                <span>{t('a11y.reset')}</span>
              </button>
            </div>
          ) : null}
        </div>

        <span className="flex h-9 w-9 items-center justify-center rounded-full text-white/80" title={network.wifiEnabled ? network.connectedNetwork ?? '' : t('quick.wifi')}>
          {network.wifiEnabled && network.status === 'connected' ? <Wifi size={18} /> : <WifiOff size={18} />}
        </span>

        <div className="relative">
          <button
            type="button"
            className="icon-button h-9 w-9 rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            onClick={() => {
              setPowerMenu((value) => !value);
              setA11yMenu(false);
            }}
            title={t('lock.power')}
            aria-label={t('lock.power')}
          >
            <Power size={18} />
          </button>
          {powerMenu ? (
            <div className={`panel absolute bottom-11 ${isRTL ? 'left-0' : 'right-0'} w-52 overflow-hidden p-1 text-[var(--text)]`}>
              <button type="button" className="list-row w-full gap-2" onClick={() => { restart(); }}>
                <RotateCcw size={15} /> {t('start.restart')}
              </button>
              <button type="button" className="list-row w-full gap-2" onClick={() => { shutdown(); }}>
                <Power size={15} /> {t('start.shutdown')}
              </button>
              <button
                type="button"
                className="list-row w-full gap-2"
                onClick={() => {
                  setPowerMenu(false);
                  openDialog({
                    kind: 'confirm',
                    title: t('settings.resetSystem'),
                    message: t('settings.resetConfirm'),
                    danger: true,
                    confirmLabel: t('settings.reset'),
                    onConfirm: () => signOut(),
                  });
                }}
              >
                <LogOut size={15} /> {t('start.signOut')}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <p className="absolute bottom-6 left-6 text-[11px] text-white/40">{t('boot.disclaimer')}</p>
    </div>
  );
}

export default LockScreen;
