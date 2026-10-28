import 'fake-indexeddb/auto';

/**
 * jsdom does not implement a few browser APIs the shell touches while stores
 * hydrate. They are stubbed here so unit tests can exercise real store code.
 */
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  if (!window.ResizeObserver) {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  }

  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => 'blob:stub';
    window.URL.revokeObjectURL = () => undefined;
  }
}

// WebAudio is synthesized on demand; keep it silent in tests.
if (typeof window !== 'undefined' && !(window as unknown as { AudioContext?: unknown }).AudioContext) {
  class AudioContextStub {
    state = 'suspended';
    currentTime = 0;
    destination = {};
    resume(): Promise<void> {
      return Promise.resolve();
    }
    close(): Promise<void> {
      return Promise.resolve();
    }
    createOscillator() {
      const node: Record<string, unknown> = { type: 'sine', start: () => undefined, stop: () => undefined, frequency: { setValueAtTime: () => undefined } };
      node.connect = (target: unknown) => target ?? node;
      return node as unknown as OscillatorNode;
    }
    createGain() {
      const node: Record<string, unknown> = { gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined } };
      node.connect = (target: unknown) => target ?? node;
      return node as unknown as GainNode;
    }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = AudioContextStub;
}
