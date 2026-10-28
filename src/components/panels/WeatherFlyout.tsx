import { useMemo, useState } from 'react';
import { Cloud, CloudLightning, CloudRain, CloudSnow, CloudSun, RefreshCw, Sun } from 'lucide-react';
import { useShellStore } from '../../stores/shellStore';
import { useT } from '../../i18n';
import { useClickOutside } from '../../hooks/useUi';
import { TASKBAR_HEIGHT } from '../../stores/windowStore';
import { getWeather, toFahrenheit, type WeatherCondition } from '../../services/weather';

/** Taskbar weather flyout. The forecast is simulated locally (deterministic
 *  per day) and labelled as such — no network, no real meteorological data. */

export function conditionIcon(condition: WeatherCondition, size = 16): React.ReactNode {
  switch (condition) {
    case 'sunny':
      return <Sun size={size} className="text-amber-400" />;
    case 'partly':
      return <CloudSun size={size} className="text-amber-300" />;
    case 'cloudy':
      return <Cloud size={size} className="text-slate-300" />;
    case 'rain':
      return <CloudRain size={size} className="text-sky-400" />;
    case 'storm':
      return <CloudLightning size={size} className="text-yellow-400" />;
    case 'snow':
      return <CloudSnow size={size} className="text-cyan-200" />;
    default:
      return <Sun size={size} />;
  }
}

export function WeatherFlyout() {
  const { t, isRTL } = useT();
  const panel = useShellStore((state) => state.panel);
  const setPanel = useShellStore((state) => state.setPanel);
  const open = panel === 'weather';
  const ref = useClickOutside<HTMLDivElement>(() => open && setPanel(null), open);
  const [unit, setUnit] = useState<'c' | 'f'>('c');
  const [stamp, setStamp] = useState(() => Date.now());

  const report = useMemo(() => getWeather(t('weather.location'), stamp), [stamp, t]);

  const show = (c: number) => (unit === 'c' ? Math.round(c) : toFahrenheit(c));
  const weekday = useMemo(
    () => new Intl.DateTimeFormat(isRTL ? 'fa-IR' : 'en-US', { weekday: 'short' }),
    [isRTL],
  );

  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`panel fixed z-[6200] w-[320px] overflow-hidden p-4 ${isRTL ? 'right-3' : 'left-3'}`}
      style={{ bottom: TASKBAR_HEIGHT + 8 }}
      role="dialog"
      aria-label={t('weather.title')}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[12px] opacity-70">{t('weather.location')}</div>
          <div className="flex items-center gap-3">
            <span className="text-[38px] font-light leading-none tabular-nums">{show(report.now.tempC)}°</span>
            <span className="flex flex-col gap-1">
              {conditionIcon(report.now.condition, 26)}
              <span className="text-[12px]">{t(`weather.${report.now.condition}`)}</span>
            </span>
          </div>
          <div className="mt-1 text-[11.5px] opacity-70 tabular-nums">
            {t('weather.feels', { temp: show(report.now.tempC - 1) })} · {t('weather.humidityValue', { value: report.now.humidity })} · {t('weather.windValue', { value: report.now.windKmh })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button type="button" className="icon-button h-7 w-7" title={unit === 'c' ? '°F' : '°C'} onClick={() => setUnit((value) => (value === 'c' ? 'f' : 'c'))}>
            <span className="text-[11px] font-semibold">°{unit === 'c' ? 'C' : 'F'}</span>
          </button>
          <button type="button" className="icon-button h-7 w-7" title={t('common.refresh')} onClick={() => setStamp(Date.now())}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-[var(--border)] pt-2">
        <div className="mb-1 text-[11px] uppercase tracking-wide opacity-60">{t('weather.forecast')}</div>
        {report.forecast.map((day, index) => (
          <div key={index} className="flex items-center justify-between py-1 text-[12px] tabular-nums">
            <span className="w-12 opacity-80">{index === 0 ? t('weather.today') : weekday.format(day.date)}</span>
            <span className="flex items-center gap-2">{conditionIcon(day.condition)}</span>
            <span className="opacity-60">{show(day.lowC)}°</span>
            <span className="font-semibold">{show(day.tempC)}°</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10.5px] opacity-55">{t('weather.simulated')}</div>
    </div>
  );
}

export default WeatherFlyout;
