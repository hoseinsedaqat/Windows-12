import { memo } from 'react';
import { useWindowStore } from '../../stores/windowStore';
import { WindowFrame, SnapPreviewOverlay } from './WindowFrame';

/** Renders every open window. Memoised per window so drags stay smooth. */
export function WindowLayer() {
  const windows = useWindowStore((state) => state.windows);
  return (
    <div className="pointer-events-none absolute inset-0 z-[4000]">
      {/* NOTE: this wrapper must stay pointer-events-none — an auto wrapper
          covers the whole desktop and swallows every icon click/hover. */}
      <div className="pointer-events-none absolute inset-0">
        {windows.map((win) => (
          <MemoWindow key={win.id} win={win} />
        ))}
      </div>
      <SnapPreviewOverlay />
    </div>
  );
}

const MemoWindow = memo(function MemoWindow({ win }: { win: Parameters<typeof WindowFrame>[0]['window'] }) {
  return <WindowFrame window={win} />;
});

export default WindowLayer;
