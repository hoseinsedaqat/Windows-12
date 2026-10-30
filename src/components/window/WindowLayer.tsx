import { memo, useMemo } from 'react';
import { desktopOf, useWindowStore } from '../../stores/windowStore';
import { WindowFrame, SnapPreviewOverlay } from './WindowFrame';

/** Renders every open window. Memoised per window so drags stay smooth. */
export function WindowLayer() {
  const allWindows = useWindowStore((state) => state.windows);
  const activeDesktop = useWindowStore((state) => state.activeVirtualDesktop);
  const windows = useMemo(
    () => allWindows.filter((win) => desktopOf(win) === activeDesktop),
    [allWindows, activeDesktop],
  );
  // NOTE: no full-screen wrapper here, on purpose. Any inset-0 div around the
  // windows (pointer-events auto *or* none) has historically swallowed clicks
  // for the desktop or for window chrome. Windows position themselves.
  return (
    <>
      {windows.map((win) => (
        <MemoWindow key={win.id} win={win} />
      ))}
      <SnapPreviewOverlay />
    </>
  );
}

const MemoWindow = memo(function MemoWindow({ win }: { win: Parameters<typeof WindowFrame>[0]['window'] }) {
  return <WindowFrame window={win} />;
});

export default WindowLayer;
