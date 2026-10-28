import { memo } from 'react';
import { useWindowStore } from '../../stores/windowStore';
import { WindowFrame, SnapPreviewOverlay } from './WindowFrame';

/** Renders every open window. Memoised per window so drags stay smooth. */
export function WindowLayer() {
  const windows = useWindowStore((state) => state.windows);
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
