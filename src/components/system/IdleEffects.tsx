import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSystemStore } from '../../stores/systemStore';

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;

/**
 * Idle watcher: drives the animated screensaver and the optional idle lock.
 * Both are real browser features of this simulated OS — inactivity is measured
 * from genuine pointer/keyboard events on this page.
 */
export function IdleEffects() {
  const idle = useSettingsStore((state) => state.settings.idle);
  const power = useSystemStore((state) => state.power);
  const lock = useSystemStore((state) => state.lock);
  const lastActivity = useRef(Date.now());
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [dismissGrace, setDismissGrace] = useState(false);

  useEffect(() => {
    const mark = () => {
      lastActivity.current = Date.now();
      if (dismissGrace) setDismissGrace(false);
    };
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, mark, { passive: true });
    const timer = window.setInterval(() => {
      setIdleSeconds(Math.floor((Date.now() - lastActivity.current) / 1000));
    }, 1000);
    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, mark);
      window.clearInterval(timer);
    };
  }, [dismissGrace]);

  const onDesktop = power === 'desktop';
  const screensaverActive =
    onDesktop && idle.screensaver && !dismissGrace && idleSeconds >= Math.max(1, idle.screensaverMinutes) * 60;

  // Idle lock
  const lockedRef = useRef(false);
  useEffect(() => {
    if (!onDesktop || idle.lockMinutes <= 0) {
      lockedRef.current = false;
      return;
    }
    if (!lockedRef.current && idleSeconds >= idle.lockMinutes * 60) {
      lockedRef.current = true;
      lock();
    }
  }, [idleSeconds, idle.lockMinutes, onDesktop, lock]);

  // Dismiss the screensaver on the next real input after it is showing.
  useEffect(() => {
    if (!screensaverActive) return undefined;
    const dismiss = () => {
      lastActivity.current = Date.now();
      setIdleSeconds(0);
      setDismissGrace(true);
      window.setTimeout(() => setDismissGrace(false), 400);
    };
    window.addEventListener('pointerdown', dismiss, { once: true });
    window.addEventListener('keydown', dismiss, { once: true });
    return () => {
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [screensaverActive]);

  if (!screensaverActive) return null;
  return <Screensaver />;
}

function Screensaver() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const bubbles = Array.from({ length: 9 }, (_, index) => index);
  return (
    <div className="fixed inset-0 z-[9750] overflow-hidden bg-[#05070f]" aria-hidden>
      <div className="absolute inset-0 opacity-80" style={{ background: 'radial-gradient(1200px 700px at 30% 20%, #12224a 0%, transparent 60%), radial-gradient(1000px 600px at 75% 75%, #241a4d 0%, transparent 55%)' }} />
      {bubbles.map((index) => (
        <span
          key={index}
          className="absolute rounded-full"
          style={{
            width: 120 + index * 46,
            height: 120 + index * 46,
            left: `${(index * 37) % 90}%`,
            top: `${(index * 53) % 85}%`,
            background: `hsl(${210 + index * 14} 85% 60% / 0.10)`,
            filter: 'blur(28px)',
            animation: `win12-float ${14 + index * 3}s ease-in-out ${index * 0.7}s infinite alternate`,
          }}
        />
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <p className="text-[86px] font-light tabular-nums leading-none drop-shadow">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="mt-2 text-[15px] opacity-70">
          {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>
      <style>{`@keyframes win12-float { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(60px,-50px,0) scale(1.15); } }`}</style>
    </div>
  );
}

export default IdleEffects;
