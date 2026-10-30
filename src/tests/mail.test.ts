import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMailStore } from '../stores/mailStore';

beforeEach(() => {
  useMailStore.setState({ messages: useMailStore.getInitialState ? useMailStore.getInitialState().messages : [] });
});

describe('mail store (simulated)', () => {
  it('seeds an inbox and a sent item', () => {
    const messages = useMailStore.getState().messages;
    expect(messages.some((message) => message.folder === 'inbox')).toBe(true);
    expect(messages.some((message) => message.folder === 'sent')).toBe(true);
  });

  it('sends a message into Sent and schedules a simulated reply', () => {
    vi.useFakeTimers();
    const id = useMailStore.getState().send('ava@win12.local', 'Hello', 'Body');
    const state = useMailStore.getState();
    expect(state.messages.find((message) => message.id === id)?.folder).toBe('sent');
    vi.advanceTimersByTime(12_000);
    const after = useMailStore.getState();
    expect(after.messages.filter((message) => message.folder === 'inbox').length).toBeGreaterThan(
      state.messages.filter((message) => message.folder === 'inbox').length,
    );
    vi.useRealTimers();
  });

  it('marks read, stars, trashes and restores', () => {
    const store = useMailStore.getState();
    const target = store.messages[0];
    store.markRead(target.id, false);
    expect(useMailStore.getState().messages.find((message) => message.id === target.id)?.read).toBe(false);
    store.toggleStar(target.id);
    expect(useMailStore.getState().messages.find((message) => message.id === target.id)?.starred).toBe(!target.starred);
    store.moveToTrash(target.id);
    expect(useMailStore.getState().messages.find((message) => message.id === target.id)?.folder).toBe('trash');
    useMailStore.getState().restore(target.id);
    expect(useMailStore.getState().messages.find((message) => message.id === target.id)?.folder).toBe('inbox');
  });

  it('counts unread inbox messages', () => {
    expect(useMailStore.getState().unreadCount()).toBeGreaterThanOrEqual(1);
  });
});
