import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LockScreen } from '../components/system/LockScreen';
import { useSystemStore } from '../stores/systemStore';
import { useSettingsStore, defaultSettings } from '../stores/settingsStore';
import { useWindowStore } from '../stores/windowStore';
import { hashPassword } from '../services/auth';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The lock screen used to be a dead end: a credential the user could not
 * reproduce (Persian vs Latin digits, or a digest written in another crypto
 * context) meant "wrong password" forever. Three misses now offer a reset.
 */

let container: HTMLDivElement;
let root: Root;

const text = () => container.textContent ?? '';
const query = (selector: string) => container.querySelector(selector);

async function render(credential: string) {
  useSettingsStore.setState({ settings: defaultSettings, hydrated: true });
  useWindowStore.setState({ windows: [], zTop: 10, showDesktop: false, hiddenByShowDesktop: [] });
  useSystemStore.setState((state) => ({
    power: 'lock',
    bootStage: 'done',
    bootProgress: 100,
    signedInAt: null,
    signedInAs: null,
    account: { ...state.account, passwordHash: credential, hint: undefined },
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<LockScreen />);
  });
  // Phase 1 is the clock; any click reveals the password field.
  await act(async () => {
    query('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

async function typePassword(value: string) {
  const input = query('input[type="password"]') as HTMLInputElement;
  expect(input, 'password field visible').toBeTruthy();
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/**
 * `signIn`/`resetDemoAccess` persist through IndexedDB, i.e. macrotasks that a
 * single `act` flush does not drain. Run the pending work inside `act` so the
 * assertions see the settled UI (and React sees no out-of-act updates).
 */
async function flush() {
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function submit() {
  await act(async () => {
    (query('button[type="submit"]') as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await flush();
}

async function attemptWrongPassword(times: number) {
  for (let i = 0; i < times; i += 1) {
    await typePassword('definitely-not-it');
    await submit();
  }
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('lock screen recovery', () => {
  it('rejects an unknown password and says so', async () => {
    await render(await hashPassword('a-passphrase-nobody-remembers'));
    await typePassword('1234');
    await submit();
    expect(useSystemStore.getState().power).toBe('lock');
    expect(text()).toContain('The password is incorrect');
    expect(query('[data-testid="lock-recovery"]')).toBeNull();
  });

  it('keeps the reset hatch hidden for the first two misses', async () => {
    await render(await hashPassword('a-passphrase-nobody-remembers'));
    await attemptWrongPassword(2);
    expect(query('[data-testid="lock-recovery"]')).toBeNull();
  });

  it('offers the reset after three misses, and it lets the user back in', async () => {
    await render(await hashPassword('a-passphrase-nobody-remembers'));
    await attemptWrongPassword(3);

    const recovery = query('[data-testid="lock-recovery"]');
    expect(recovery, 'hatch visible after 3 misses').toBeTruthy();
    expect(recovery!.textContent).toContain('simulated');

    await act(async () => {
      (recovery!.querySelector('button') as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    // Credential forgotten, still locked, and the demo notice is back.
    expect(useSystemStore.getState().account.passwordHash).toBe('');
    expect(useSystemStore.getState().power).toBe('lock');
    expect(text()).toContain('Demo password forgotten');
    expect(text()).toContain('1234');

    await typePassword('1234');
    await submit();
    expect(useSystemStore.getState().power).toBe('desktop');
    expect(useSystemStore.getState().signedInAs).toBeTruthy();
  });

  it('signs straight in with the documented demo password for a Persian-digit credential', async () => {
    // The exact reported case: ۱۲۳۴ was adopted on first run, 1234 is typed later.
    await render(await hashPassword('۱۲۳۴'));
    await typePassword('1234');
    await submit();
    expect(useSystemStore.getState().power).toBe('desktop');
    expect(query('[data-testid="lock-recovery"]')).toBeNull();
  });

  it('explains that a first-typed password was adopted when no hint is stored', async () => {
    await render(await hashPassword('a-passphrase-nobody-remembers'));
    expect(text()).toContain('first password ever typed');
  });
});
