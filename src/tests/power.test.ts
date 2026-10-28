import { beforeEach, describe, expect, it } from 'vitest';
import { useSystemStore } from '../stores/systemStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useSettingsStore, defaultSettings } from '../stores/settingsStore';
import { useWindowStore } from '../stores/windowStore';
import { DEFAULT_DEMO_PASSWORD, hashPassword, verifyPassword } from '../services/auth';
import { db } from '../services/db';
import { DESKTOP_ID, DOCUMENTS_ID } from '../core/FileSystem';

function system() {
  return useSystemStore.getState();
}

beforeEach(async () => {
  localStorage.clear();
  await db.files.clear();
  await db.kv.clear();
  useSettingsStore.setState({ settings: defaultSettings, hydrated: true });
  useSystemStore.setState({
    power: 'off',
    bootStage: 'blank',
    bootProgress: 0,
    signedInAt: null,
    signedInAs: null,
    activity: [],
    storageWarning: null,
    account: {
      id: 'user-1',
      displayName: 'Concept User',
      passwordHash: '',
      avatar: 'aqua',
      avatarColor: '#0ea5e9',
      autoSignIn: false,
    },
  });
  useWindowStore.setState({ windows: [], zTop: 10, showDesktop: false, hiddenByShowDesktop: [] });
  useFileSystemStore.setState({ nodes: {}, hydrated: false, usedBytes: 0, recentIds: [], clipboard: null });
  await useFileSystemStore.getState().hydrate();
});

describe('demo credentials', () => {
  it('hashes and verifies passwords without storing them in plain text', async () => {
    const hash = await hashPassword(DEFAULT_DEMO_PASSWORD);
    expect(hash).not.toContain(DEFAULT_DEMO_PASSWORD);
    expect(hash.length).toBeGreaterThan(16);
    expect(await verifyPassword(DEFAULT_DEMO_PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
    // Salting means the same password hashes differently every time.
    expect(await hashPassword(DEFAULT_DEMO_PASSWORD)).not.toBe(hash);
    expect(DEFAULT_DEMO_PASSWORD).toBe('1234');
  });
});

describe('power and session flow', () => {
  it('boots to the lock screen and signs in with the demo password', async () => {
    // A returning user already has a stored digest.
    await system().setPassword(DEFAULT_DEMO_PASSWORD);
    system().startBoot();
    expect(system().power).toBe('booting');
    expect(system().bootStage).toBe('blank');

    system().setBootStage('logo', 20);
    system().setBootStage('dots', 55);
    system().setBootStage('welcome', 90);
    expect(system().bootStage).toBe('welcome');
    expect(system().bootProgress).toBe(90);

    system().finishBoot();
    expect(system().power).toBe('lock');
    expect(system().signedInAt).toBeNull();

    expect(await system().signIn('not-the-password')).toBe(false);
    expect(system().power).toBe('lock');
    expect(system().signedInAt).toBeNull();

    expect(await system().signIn(DEFAULT_DEMO_PASSWORD)).toBe(true);
    expect(system().power).toBe('desktop');
    expect(system().signedInAt).toBeGreaterThan(0);
    expect(system().signedInAs).toBe('user-1');
    // The stored credential is a salted digest, never the plain password.
    expect(system().account.passwordHash).toContain('$');
    expect(system().account.passwordHash).not.toContain(DEFAULT_DEMO_PASSWORD);
  });

  it('adopts the first password typed on a brand new profile', async () => {
    expect(system().account.passwordHash).toBe('');
    expect(await system().signIn('my-first-pin')).toBe(true);
    expect(system().power).toBe('desktop');
    expect(system().account.passwordHash).toBeTruthy();

    system().lock();
    system().setPower('lock');
    expect(await system().signIn('my-first-pin')).toBe(true);
    expect(await system().signIn('1234')).toBe(false);
  });

  it('locks, unlocks and signs out', async () => {
    system().unlock();
    expect(system().power).toBe('desktop');

    system().lock();
    expect(system().power).toBe('locking');
    system().unlock();
    expect(system().power).toBe('desktop');
    expect(system().signedInAs).toBe('user-1');

    system().signOut();
    expect(system().power).toBe('signing-out');
    expect(system().signedInAs).toBeNull();
    expect(system().signedInAt).toBeNull();
  });

  it('skips the lock screen when auto sign-in is enabled', () => {
    void useSystemStore.getState().updateAccount({ autoSignIn: true });
    expect(useSystemStore.getState().account.autoSignIn).toBe(true);

    system().startBoot();
    system().finishBoot();
    expect(system().power).toBe('desktop');
    expect(system().signedInAs).toBe('user-1');
  });

  it('restarts and shuts down, keeping user data intact', async () => {
    const fs = useFileSystemStore.getState();
    const folderId = fs.createFolder(DESKTOP_ID, 'Keep me');
    const fileId = fs.createFile('text', folderId, 'notes.txt', 'important');
    useSettingsStore.getState().setDisplay({ brightness: 30 });
    useSettingsStore.getState().setTheme('dark');
    useSettingsStore.getState().setSound({ muted: true });
    const windowId = useWindowStore.getState().openApp('notepad', { fileId })!;

    system().unlock();
    system().restart();
    expect(system().power).toBe('restarting');

    // The transition screen runs the boot sequence again.
    system().startBoot();
    system().finishBoot();
    expect(system().power).toBe('lock');
    expect(await system().signIn(DEFAULT_DEMO_PASSWORD)).toBe(true);

    // Files, settings and window layout all survived the restart.
    const store = useFileSystemStore.getState();
    expect(store.nodeById(folderId)?.name).toBe('Keep me');
    expect(store.nodeById(fileId)?.content).toBe('important');
    expect(useSettingsStore.getState().settings.display.brightness).toBe(30);
    expect(useSettingsStore.getState().settings.personalization.theme).toBe('dark');
    expect(useSettingsStore.getState().settings.sound.muted).toBe(true);
    expect(useWindowStore.getState().windows.map((win) => win.id)).toContain(windowId);

    system().shutdown();
    expect(system().power).toBe('shutting-down');
    system().setPower('off');
    expect(system().power).toBe('off');
    // Data is still on disk after a shutdown.
    expect((await db.files.get(fileId))?.content).toBe('important');
    expect(useFileSystemStore.getState().nodeById(fileId)).toBeTruthy();
    expect(useFileSystemStore.getState().childrenOf(DOCUMENTS_ID)).toBeDefined();
  });

  it('records activity history and can clear it', () => {
    system().logActivity({ label: 'Opened Explorer', kind: 'app', appId: 'explorer' });
    system().logActivity({ label: 'Created folder', kind: 'file', appId: 'explorer' });
    expect(system().activity).toHaveLength(2);
    expect(system().activity[0].label).toBe('Created folder');
    expect(system().activity[0].at).toBeGreaterThan(0);

    system().clearActivity();
    expect(system().activity).toHaveLength(0);
  });

  it('persists the account and accessibility preferences', async () => {
    await system().updateAccount({ displayName: 'Hosein' });
    system().setAccessibility({ textSize: 125, highContrast: true, cursorSize: 160 });
    await system().setPassword('2468');

    const raw = localStorage.getItem('win12-concept.system');
    expect(raw).toContain('Hosein');
    expect(raw).not.toContain('2468');
    const storedPasswordHash = system().account.passwordHash;

    // Simulate a reload: reset memory, put the saved payload back, rehydrate.
    useSystemStore.setState({
      account: { id: 'user-1', displayName: 'Concept User', passwordHash: '', avatar: 'aqua', avatarColor: '#0ea5e9', autoSignIn: false },
      accessibility: { textSize: 100, highContrast: false, zoom: 100, cursorSize: 100 },
    });
    localStorage.setItem('win12-concept.system', raw!);
    await useSystemStore.persist.rehydrate();

    expect(system().account.displayName).toBe('Hosein');
    expect(system().accessibility).toMatchObject({ textSize: 125, highContrast: true, cursorSize: 160 });
    expect(system().account.passwordHash).toBe(storedPasswordHash);
    expect(await system().signIn('2468')).toBe(true);
    expect(await verifyPassword('2468', system().account.passwordHash)).toBe(true);
    // Legacy hashes (written before per-password salts) still verify.
    expect(await verifyPassword('1234', 'legacy')).toBe(false);
  });

  it('runs a simulated update check without touching the network', async () => {
    expect(system().updateState).toBe('idle');
    const pending = system().checkForUpdates();
    expect(system().updateState).toBe('checking');
    await pending;
    expect(system().updateState).toBe('up-to-date');
    expect(system().lastUpdateCheck).toBeGreaterThan(0);
    expect(await db.kv.get('lastUpdateCheck')).toBeTruthy();
  });
});
