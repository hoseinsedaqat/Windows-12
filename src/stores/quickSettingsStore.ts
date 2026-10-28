import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Extra simulated device state that Quick Settings and Settings share. */

export interface DemoNetwork {
  ssid: string;
  signal: number;
  secured: boolean;
}

export const DEMO_NETWORKS: DemoNetwork[] = [
  { ssid: 'Concept-Home-5G', signal: 92, secured: true },
  { ssid: 'Concept-Home-2.4G', signal: 78, secured: true },
  { ssid: 'Neighbour-WiFi', signal: 54, secured: true },
  { ssid: 'CoffeeShop Open', signal: 41, secured: false },
  { ssid: 'Lab-Network', signal: 33, secured: true },
];

export interface BluetoothDevice {
  id: string;
  name: string;
  kind: 'audio' | 'mouse' | 'keyboard' | 'phone' | 'other';
  paired: boolean;
  connected: boolean;
}

export const DEFAULT_BT_DEVICES: BluetoothDevice[] = [
  { id: 'bt-headphones', name: 'Concept Buds Pro', kind: 'audio', paired: true, connected: false },
  { id: 'bt-mouse', name: 'Wireless Mouse M-220', kind: 'mouse', paired: true, connected: false },
  { id: 'bt-keyboard', name: 'Slim Keyboard K-100', kind: 'keyboard', paired: false, connected: false },
  { id: 'bt-phone', name: 'Pixel Demo Phone', kind: 'phone', paired: false, connected: false },
];

export interface QuickSettingsState {
  tiles: string[];
  hiddenTiles: string[];
  bluetoothDevices: BluetoothDevice[];
  casting: boolean;
  castTarget: string | null;
  projectorMode: 'pc-only' | 'duplicate' | 'extend' | 'second-screen-only';
  toggleTile: (tile: string) => void;
  reorderTiles: (tiles: string[]) => void;
  toggleBluetoothDevice: (id: string, connected: boolean) => void;
  pairBluetoothDevice: (id: string) => void;
  setCasting: (casting: boolean, target?: string | null) => void;
  setProjectorMode: (mode: QuickSettingsState['projectorMode']) => void;
}

export const QUICK_TILES = ['wifi', 'bluetooth', 'airplane', 'batterySaver', 'nightLight', 'accessibility', 'focus', 'cast', 'project'];

export const useQuickSettingsStore = create<QuickSettingsState>()(
  persist(
    (set) => ({
      tiles: ['wifi', 'bluetooth', 'airplane', 'batterySaver', 'nightLight', 'accessibility', 'focus', 'cast'],
      hiddenTiles: ['project'],
      bluetoothDevices: DEFAULT_BT_DEVICES,
      casting: false,
      castTarget: null,
      projectorMode: 'pc-only',

      toggleTile: (tile) =>
        set((state) => {
          const visible = state.tiles.includes(tile);
          return {
            tiles: visible ? state.tiles.filter((item) => item !== tile) : [...state.tiles, tile],
            hiddenTiles: visible ? [...new Set([...state.hiddenTiles, tile])] : state.hiddenTiles.filter((item) => item !== tile),
          };
        }),

      reorderTiles: (tiles) => set({ tiles, hiddenTiles: QUICK_TILES.filter((tile) => !tiles.includes(tile)) }),

      toggleBluetoothDevice: (id, connected) =>
        set((state) => ({
          bluetoothDevices: state.bluetoothDevices.map((device) =>
            device.id === id ? { ...device, connected, paired: device.paired || connected } : device,
          ),
        })),

      pairBluetoothDevice: (id) =>
        set((state) => ({
          bluetoothDevices: state.bluetoothDevices.map((device) => (device.id === id ? { ...device, paired: true } : device)),
        })),

      setCasting: (casting, target = null) => set({ casting, castTarget: target }),
      setProjectorMode: (mode) => set({ projectorMode: mode }),
    }),
    {
      name: 'win12-concept.quick',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
