import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BootStage, PowerState, UserAccount } from '../types';
import { checkCredential, DEFAULT_DEMO_PASSWORD, demoHint, hashPassword, normalizePassword } from '../services/auth';
import { setKV, getKV } from '../services/db';

export interface ActivityEntry {
  id: string;
  at: number;
  label: string;
  appId?: string;
  kind: 'app' | 'file' | 'system' | 'setting';
}

export interface AccessibilityState {
  textSize: number;
  highContrast: boolean;
  zoom: number;
  cursorSize: number;
}

export interface SystemState {
  power: PowerState;
  bootStage: BootStage;
  bootProgress: number;
  sessionStartedAt: number;
  signedInAt: number | null;
  account: UserAccount;
  accounts: UserAccount[];
  signedInAs: string | null;
  battery: { level: number; charging: boolean; simulated: boolean };
  accessibility: AccessibilityState;
  activity: ActivityEntry[];
  updateState: 'idle' | 'checking' | 'up-to-date' | 'error';
  lastUpdateCheck: number | null;
  storageWarning: string | null;

  setPower: (power: PowerState) => void;
  setBootStage: (stage: BootStage, progress?: number) => void;
  startBoot: () => void;
  finishBoot: () => void;
  lock: () => void;
  unlock: () => void;
  signIn: (password: string) => Promise<boolean>;
  signOut: () => void;
  shutdown: () => void;
  restart: () => void;
  updateAccount: (patch: Partial<UserAccount>) => Promise<void>;
  setPassword: (next: string) => Promise<void>;
  /**
   * Recovery hatch for the simulated gate: forgets the stored credential so the
   * next password typed becomes the demo password again. Nobody can be locked
   * out of a concept demo by a password they no longer remember.
   */
  resetDemoAccess: () => Promise<void>;
  setAccessibility: (patch: Partial<AccessibilityState>) => void;
  logActivity: (entry: Omit<ActivityEntry, 'id' | 'at'>) => void;
  clearActivity: () => void;
  checkForUpdates: () => Promise<void>;
  setStorageWarning: (message: string | null) => void;
  setBattery: (level: number, charging: boolean) => void;
}

export const AVATARS = [
  { id: 'aqua', color: '#0ea5e9' },
  { id: 'violet', color: '#8b5cf6' },
  { id: 'emerald', color: '#10b981' },
  { id: 'amber', color: '#f59e0b' },
  { id: 'rose', color: '#f43f5e' },
  { id: 'indigo', color: '#6366f1' },
];

const defaultAccount: UserAccount = {
  id: 'user-local',
  displayName: 'Concept User',
  passwordHash: '',
  avatar: 'aqua',
  avatarColor: '#0ea5e9',
  autoSignIn: false,
  hint: 'The demo password is 1234',
};

let bootTimer: number | null = null;

export const useSystemStore = create<SystemState>()(
  persist(
    (set, get) => ({
      power: 'off',
      bootStage: 'blank',
      bootProgress: 0,
      sessionStartedAt: Date.now(),
      signedInAt: null,
      account: defaultAccount,
      accounts: [defaultAccount],
      signedInAs: null,
      battery: { level: 78, charging: true, simulated: true },
      accessibility: { textSize: 100, highContrast: false, zoom: 100, cursorSize: 100 },
      activity: [],
      updateState: 'idle',
      lastUpdateCheck: null,
      storageWarning: null,

      setPower: (power) => set({ power }),
      setBootStage: (stage, progress) => set({ bootStage: stage, bootProgress: progress ?? get().bootProgress }),

      startBoot: () => {
        if (bootTimer) window.clearTimeout(bootTimer);
        set({
          power: 'booting',
          bootStage: 'blank',
          bootProgress: 0,
          sessionStartedAt: Date.now(),
        });
      },

      finishBoot: () => {
        const { account } = get();
        set({ bootStage: 'done', bootProgress: 100 });
        if (account.autoSignIn) {
          set({ power: 'desktop', signedInAt: Date.now(), signedInAs: account.id });
        } else {
          set({ power: 'lock' });
        }
      },

      lock: () => set({ power: 'locking' }),
      unlock: () => set({ power: 'desktop', signedInAt: Date.now(), signedInAs: get().account.id }),

      signIn: async (password: string) => {
        const { account } = get();
        if (!account.passwordHash) {
          // First run: whatever the user types becomes the demo password.
          // Normalised, so a Persian keyboard typing ۱۲۳۴ and a Latin keyboard
          // typing 1234 adopt the *same* credential — and the hint reflects what
          // was actually adopted instead of still advertising the default.
          const adopted = normalizePassword(password) || DEFAULT_DEMO_PASSWORD;
          const passwordHash = await hashPassword(adopted);
          await get().updateAccount({ passwordHash, hint: demoHint(adopted) });
          set({ signedInAt: Date.now(), power: 'desktop', signedInAs: account.id });
          return true;
        }
        const { ok, upgradeTo } = await checkCredential(password, account.passwordHash);
        if (ok) {
          // Self-heal credentials written by older builds (raw text, 8-hex FNV
          // digest from an insecure context, or a salt-less legacy hash).
          if (upgradeTo) await get().updateAccount({ passwordHash: upgradeTo, hint: demoHint(password) });
          set({ signedInAt: Date.now(), power: 'desktop', signedInAs: account.id });
        }
        return ok;
      },

      signOut: () => set({ power: 'signing-out', signedInAs: null, signedInAt: null }),
      shutdown: () => set({ power: 'shutting-down' }),
      restart: () => set({ power: 'restarting' }),

      updateAccount: async (patch) => {
        const account = { ...get().account, ...patch };
        set({ account, accounts: [account] });
        await setKV('account', account);
      },

      setPassword: async (next: string) => {
        const passwordHash = await hashPassword(next);
        await get().updateAccount({ passwordHash, hint: normalizePassword(next) ? demoHint(next) : undefined });
      },

      resetDemoAccess: async () => {
        await get().updateAccount({ passwordHash: '', hint: undefined });
        set({ signedInAt: null, signedInAs: null });
      },

      setAccessibility: (patch) => set((s) => ({ accessibility: { ...s.accessibility, ...patch } })),

      logActivity: (entry) => {
        const item: ActivityEntry = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now() };
        set((s) => ({ activity: [item, ...s.activity].slice(0, 120) }));
      },

      clearActivity: () => set({ activity: [] }),

      checkForUpdates: async () => {
        set({ updateState: 'checking' });
        await new Promise((resolve) => setTimeout(resolve, 2400));
        const now = Date.now();
        set({ updateState: 'up-to-date', lastUpdateCheck: now });
        await setKV('lastUpdateCheck', now);
      },

      setStorageWarning: (message) => set({ storageWarning: message }),
      setBattery: (level, charging) => set((s) => ({ battery: { ...s.battery, level, charging } })),
    }),
    {
      name: 'win12-concept.system',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        account: state.account,
        accounts: state.accounts,
        accessibility: state.accessibility,
        battery: state.battery,
        lastUpdateCheck: state.lastUpdateCheck,
      }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<SystemState> | undefined;
        return { ...current, ...(stored ?? {}) };
      },
      onRehydrateStorage: () => async () => {
        const storedCheck = await getKV<number>('lastUpdateCheck');
        if (storedCheck) useSystemStore.setState({ lastUpdateCheck: storedCheck });
      },
    },
  ),
);

/** Convenience: is the simulator usable right now? */
export function isDesktopActive(): boolean {
  return useSystemStore.getState().power === 'desktop';
}
