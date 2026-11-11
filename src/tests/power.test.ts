import { beforeEach, describe, expect, it } from 'vitest';
import { useSystemStore } from '../stores/systemStore';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { useSettingsStore, defaultSettings } from '../stores/settingsStore';
import { useWindowStore } from '../stores/windowStore';
import { CREDENTIAL_PATTERN, DEFAULT_DEMO_PASSWORD, hashPassword, verifyPassword } from '../services/auth';
import { db } from '../services/db';
import { DESKTOP_ID, DOCUMENTS_ID } from '../core/FileSystem';

function system() {
  return useSystemStore.getState();
}

/**
 * A stored credential is `salt$digest` (both hex).
 *
 * Do NOT assert "the credential must not *contain* the password": with ~80
 * random hex characters, any given 4-character sequence shows up in roughly
 * 1 run in 850, so three such assertions made this suite fail on about 1 CI
 * run in 284 (that is what turned the "Deploy to GitHub Pages" job red after
 * the PR #10 merge). The invariants below express the same intent — the plain
 * password is never stored — but hold for every salt, every time.
 */
function expectNoPlaintext(stored: string, password: string) {
  expect(stored).toBeTruthy();
  expect(stored).not.toBe(password);
  // The password is not stored as the credential itself, nor as one of its parts.
  expect(stored.split('$')).not.toContain(password);
  const [salt, digestPart] = stored.split('$');
  expect(salt).toMatch(/^[0-9a-f]+$/);
  expect(digestPart).toMatch(/^[0-9a-f]+$/);
  // A digest, never the password echoed back (longest fallback digest is 8 hex).
  expect(digestPart.length).toBeGreaterThanOrEqual(8);
  expect(digestPart.length).toBeGreaterThan(password.length);
}

/** Every string anywhere inside a persisted JSON payload (objects + arrays). */
function stringValues(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) for (const item of node) stringValues(item, out);
  else if (node && typeof node === 'object') for (const value of Object.values(node)) stringValues(value, out);
  return out;
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
    expectNoPlaintext(hash, DEFAULT_DEMO_PASSWORD);
    expect(hash.length).toBeGreaterThan(16);
    expect(await verifyPassword(DEFAULT_DEMO_PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
    // Salting means the same password hashes differently every time.
    expect(await hashPassword(DEFAULT_DEMO_PASSWORD)).not.toBe(hash);
    expect(DEFAULT_DEMO_PASSWORD).toBe('1234');
  });

  it('keeps every credential invariant true across many random salts', async () => {
    // Guards against a probabilistic assertion creeping back in: if any
    // invariant depended on the *contents* of a random salt, 256 draws would
    // expose it instead of 1 CI run in 284.
    const salts = new Set<string>();
    for (let i = 0; i < 256; i += 1) {
      const hash = await hashPassword(DEFAULT_DEMO_PASSWORD);
      expectNoPlaintext(hash, DEFAULT_DEMO_PASSWORD);
      salts.add(hash.split('$')[0]);
      if (i % 32 === 0) expect(await verifyPassword(DEFAULT_DEMO_PASSWORD, hash)).toBe(true);
    }
    expect(salts.size).toBe(256);
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
    expectNoPlaintext(system().account.passwordHash, DEFAULT_DEMO_PASSWORD);
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

  it('adopts a Persian-keyboard password that the Latin demo password still unlocks', async () => {
    // The reported bug: the first password typed becomes the credential, so a
    // Persian layout typing ۱۲۳۴ used to lock out the documented 1234.
    expect(await system().signIn('۱۲۳۴')).toBe(true);
    expect(system().power).toBe('desktop');
    expect(system().account.passwordHash).toMatch(CREDENTIAL_PATTERN);
    // The hint now reflects what was adopted instead of advertising the default.
    expect(system().account.hint).toBe('1\u2022\u2022\u2022');

    const stored = system().account.passwordHash;
    system().lock();
    system().setPower('lock');
    expect(await system().signIn('1234')).toBe(true);
    expect(system().power).toBe('desktop');
    // Already canonical: signing in must not churn the stored credential.
    expect(system().account.passwordHash).toBe(stored);
  });

  it('self-heals a credential written by an older build', async () => {
    // 8-hex FNV digest from a plain-HTTP session: previously a permanent lockout.
    await system().updateAccount({ passwordHash: 'a90a110add07f4d3$3c7849d3' });
    system().lock();
    system().setPower('lock');
    expect(await system().signIn(DEFAULT_DEMO_PASSWORD)).toBe(true);
    expect(system().power).toBe('desktop');
    expect(system().account.passwordHash).toMatch(CREDENTIAL_PATTERN);
    expect(system().account.passwordHash).not.toBe('a90a110add07f4d3$3c7849d3');

    system().lock();
    system().setPower('lock');
    expect(await system().signIn(DEFAULT_DEMO_PASSWORD)).toBe(true);
    expect(await system().signIn('1235')).toBe(false);
  });

  it('resetDemoAccess unlocks a profile whose password is forgotten', async () => {
    await system().setPassword('a-passphrase-nobody-remembers');
    system().lock();
    system().setPower('lock');
    expect(await system().signIn(DEFAULT_DEMO_PASSWORD)).toBe(false);
    expect(system().power).toBe('lock');

    await system().resetDemoAccess();
    expect(system().account.passwordHash).toBe('');
    expect(system().account.hint).toBeUndefined();
    // Still on the lock screen: the hatch forgets the credential, it does not sign in.
    expect(system().power).toBe('lock');
    expect(system().signedInAt).toBeNull();

    expect(await system().signIn(DEFAULT_DEMO_PASSWORD)).toBe(true);
    expect(system().power).toBe('desktop');
    expect(system().account.passwordHash).toMatch(CREDENTIAL_PATTERN);
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
    const storedPasswordHash = system().account.passwordHash;
    // No plaintext password anywhere in the payload: check every stored string
    // by equality, not by substring (a random digest may contain "2468").
    expect(stringValues(JSON.parse(raw!))).not.toContain('2468');
    expectNoPlaintext(storedPasswordHash, '2468');
    // The hint keeps only the first character, never the whole secret.
    expect(system().account.hint).toBe('2\u2022\u2022\u2022');

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
