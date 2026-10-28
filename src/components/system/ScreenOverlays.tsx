import { useEffect, useState } from 'react';
import { Cast, Monitor, Moon } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useSystemStore } from '../../stores/systemStore';
import { useQuickSettingsStore } from '../../stores/quickSettingsStore';
import { useT } from '../../i18n';

/**
 * Visual system effects that sit above everything:
 * brightness dimming, night light, battery-saver dimming, cast/project badges
 * and the accessibility pointer ring. All are purely cosmetic overlays and
 * never intercept pointer input.
 */
export function ScreenOverlays() {
  const { t } = useT();
  const display = useSettingsStore((state) => state.settings.display);
  const batterySaver = useSettingsStore((state) => state.settings.power.batterySaver);
  const focusAssist = useSettingsStore((state) => state.settings.privacy.focusAssist);
  const casting = useQuickSettingsStore((state) => state.casting);
  const castTarget = useQuickSettingsStore((state) => state.castTarget);
  const projectorMode = useQuickSettingsStore((state) => state.projectorMode);

  // Brightness: 100% → no dimming, 10% → 0.62 black overlay (still readable).
  const dim = Math.max(0, Math.min(0.62, ((100 - display.brightness) / 100) * 0.7));
  const night = display.nightLight ? Math.min(0.42, display.nightLightStrength / 100) : 0;
  const saver = batterySaver ? 0.06 : 0;

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[9800]"
        style={{ background: `rgba(0,0,0,${(dim + saver).toFixed(3)})` }}
        aria-hidden
      />
      {night > 0 ? (
        <div
          className="pointer-events-none fixed inset-0 z-[9801] mix-blend-multiply"
          style={{ background: `rgba(255,171,64,${night.toFixed(3)})` }}
          aria-hidden
        />
      ) : null}

      <div className="pointer-events-none fixed right-3 top-3 z-[9700] flex flex-col items-end gap-1.5">
        {casting ? (
          <Badge icon={<Cast size={12} />} text={`${t('quick.cast')}: ${castTarget ?? ''}`} />
        ) : null}
        {projectorMode !== 'pc-only' ? (
          <Badge icon={<Monitor size={12} />} text={`${t('quick.project')}: ${projectorMode.replaceAll('-', ' ')}`} />
        ) : null}
        {focusAssist ? <Badge icon={<Moon size={12} />} text={t('settings.focus')} /> : null}
      </div>

      <PointerRing />
    </>
  );
}

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[10.5px] text-white/90 backdrop-blur">
      {icon}
      <span className="max-w-[220px] truncate">{text}</span>
    </span>
  );
}

/** Accessibility: a visible ring around the pointer, scaled by the setting. */
function PointerRing() {
  const cursorSize = useSystemStore((state) => state.accessibility.cursorSize);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (cursorSize <= 100) {
      setPos(null);
      return undefined;
    }
    const onMove = (event: PointerEvent) => setPos({ x: event.clientX, y: event.clientY });
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [cursorSize]);

  if (cursorSize <= 100 || !pos) return null;
  const size = 18 * (cursorSize / 100);
  return (
    <span
      className="pointer-events-none fixed z-[9900] rounded-full border-2 border-[var(--accent)]"
      style={{
        left: pos.x - size / 2,
        top: pos.y - size / 2,
        width: size,
        height: size,
        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
      }}
      aria-hidden
    />
  );
}

export default ScreenOverlays;
