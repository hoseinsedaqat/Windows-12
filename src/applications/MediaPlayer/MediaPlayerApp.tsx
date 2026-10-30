import { useEffect, useMemo, useRef, useState } from 'react';
import { Music, Film, ListMusic, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { buildPlaylist, formatTimestamp, stepIndex } from '../../core/media';
import { useT } from '../../i18n';

/** Media Player: plays audio/video files stored in the virtual file system. */
export default function MediaPlayerApp() {
  const { t } = useT();
  const nodes = useFileSystemStore((state) => state.nodes);
  const playlist = useMemo(() => buildPlaylist(nodes), [nodes]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const mediaRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const entry = playlist[index];

  useEffect(() => {
    setPlaying(false);
    setTime(0);
  }, [entry?.id]);

  // Simple spectrum visualiser for audio entries (best effort, gesture-gated).
  useEffect(() => {
    if (!entry || entry.kind !== 'audio' || !playing) return undefined;
    const media = mediaRef.current;
    const canvas = canvasRef.current;
    if (!media || !canvas) return undefined;
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const source = ctx.createMediaElementSource(media);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let frame = 0;
      const draw = () => {
        frame = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(data);
        const context = canvas.getContext('2d');
        if (!context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const bars = data.length / 2;
        const width = canvas.width / bars;
        for (let i = 0; i < bars; i += 1) {
          const height = (data[i] / 255) * canvas.height;
          context.fillStyle = `hsl(${200 + i * 6} 80% 60%)`;
          context.fillRect(i * width + 1, canvas.height - height, width - 2, height);
        }
      };
      draw();
      return () => {
        cancelAnimationFrame(frame);
        source.disconnect();
        analyser.disconnect();
      };
    } catch {
      return undefined;
    }
  }, [entry, playing]);

  const toggle = () => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) {
      void media.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      media.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="scroll-thin flex w-56 shrink-0 flex-col border-e border-[var(--border)] bg-[var(--surface-2)]">
        <p className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide opacity-55">
          <ListMusic size={13} /> {t('media.playlist')}
        </p>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
          {playlist.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11px] opacity-50">{t('media.empty')}</p>
          ) : (
            playlist.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className={`list-row w-full ${i === index ? 'bg-[var(--accent-soft)]' : ''}`}
                onClick={() => setIndex(i)}
              >
                {item.kind === 'audio' ? <Music size={15} className="opacity-70" /> : <Film size={15} className="opacity-70" />}
                <span className="min-w-0 flex-1 truncate text-start text-[12px]">{item.name}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 p-6">
        {entry ? (
          entry.dataUrl ? (
            <>
              {entry.kind === 'video' ? (
                <video
                  ref={mediaRef as unknown as React.RefObject<HTMLVideoElement>}
                  src={entry.dataUrl}
                  className="max-h-[46vh] w-full max-w-xl rounded-lg border border-[var(--border)] bg-black"
                  onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
                  onEnded={() => setIndex((value) => stepIndex(value, 1, playlist.length))}
                />
              ) : (
                <>
                  <canvas ref={canvasRef} width={420} height={90} className="w-full max-w-md" aria-hidden />
                  <audio
                    ref={mediaRef}
                    src={entry.dataUrl}
                    onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
                    onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
                    onEnded={() => setIndex((value) => stepIndex(value, 1, playlist.length))}
                  />
                </>
              )}
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                {entry.kind === 'audio' ? <Music size={15} className="opacity-70" /> : <Film size={15} className="opacity-70" />}
                {entry.name}
              </p>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={time}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setTime(next);
                  if (mediaRef.current) mediaRef.current.currentTime = next;
                }}
                className="w-full max-w-md accent-[var(--accent)]"
                aria-label={t('media.seek')}
              />
              <div className="flex items-center gap-3">
                <button type="button" className="icon-button h-9 w-9" onClick={() => setIndex((value) => stepIndex(value, -1, playlist.length))} aria-label={t('media.previous')}>
                  <SkipBack size={16} />
                </button>
                <button type="button" className="win-button win-button-accent h-10 w-10 rounded-full" onClick={toggle} aria-label={playing ? t('media.pause') : t('media.play')}>
                  {playing ? <Pause size={17} /> : <Play size={17} />}
                </button>
                <button type="button" className="icon-button h-9 w-9" onClick={() => setIndex((value) => stepIndex(value, 1, playlist.length))} aria-label={t('media.next')}>
                  <SkipForward size={16} />
                </button>
              </div>
              <p className="text-[11px] tabular-nums opacity-55">
                {formatTimestamp(time)} / {formatTimestamp(duration)}
              </p>
            </>
          ) : (
            <p className="max-w-sm text-center text-[12px] opacity-60">{t('media.tooLarge')}</p>
          )
        ) : (
          <p className="max-w-sm text-center text-[12px] opacity-60">{t('media.empty')}</p>
        )}
      </div>
    </div>
  );
}
