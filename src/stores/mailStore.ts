import { create } from 'zustand';
import { notify } from './notificationStore';
import { playSound } from '../services/sound';

/**
 * Simulated mail client. Nothing leaves the browser — messages are canned
 * demo content and "replies" are generated locally.
 */
export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'trash';

export interface MailMessage {
  id: string;
  folder: MailFolder;
  from: { name: string; email: string };
  to: string;
  subject: string;
  body: string;
  date: number;
  read: boolean;
  starred: boolean;
}

const ME = { name: 'You', email: 'you@win12.local' };

const REPLIES: { subject: string; body: string }[] = [
  { subject: 'Re: {s}', body: 'Thanks for the note! This is a simulated reply — the Windows 12 concept mail app never talks to a real server.' },
  { subject: 'Re: {s}', body: 'Got it. I have marked it as read in my simulated inbox. See you at the next desktop!' },
  { subject: 'Re: {s}', body: 'Interesting point. Remember: every message here stays inside your browser storage only.' },
];

function seedMessages(): MailMessage[] {
  const now = Date.now();
  const inbox: [string, string, string, string, number][] = [
    ['Ava Khademi', 'ava@win12.local', 'Welcome to Windows 12 Mail', 'This mailbox is fully simulated.\n\n• Compose a message and a local bot answers shortly\n• Star, archive or delete — everything persists in your browser\n• No network requests are ever made\n\nEnjoy the concept!', 3],
    ['Build Bot', 'ci@win12.local', 'CI pipeline #128 passed', 'All 190+ tests green, type check clean, deploy preview published.\n\n— your friendly simulated build bot', 26],
    ['Nima Rezaei', 'nima@win12.local', 'Snap layouts idea', 'Did you try the new snap layouts flyout? Pick a zone, then choose which window fills the next one. Snap groups restore together from Task View.\n\nThoughts?', 50],
    ['Design Team', 'design@win12.local', 'Wallpaper refresh', 'The gallery now ships eight gradients plus dynamic time-based wallpapers. Custom images can be registered from Settings → Personalization.', 74],
  ];
  const messages: MailMessage[] = inbox.map(([name, email, subject, body, hoursAgo], index) => ({
    id: `mail-seed-${index}`,
    folder: 'inbox',
    from: { name, email },
    to: ME.email,
    subject,
    body,
    date: now - hoursAgo * 3600_000,
    read: index > 0,
    starred: index === 0,
  }));
  messages.push({
    id: 'mail-seed-sent-0',
    folder: 'sent',
    from: ME,
    to: 'ava@win12.local',
    subject: 'Re: Welcome to Windows 12 Mail',
    body: 'Thanks Ava! Testing the simulated compose flow now.',
    date: now - 2 * 3600_000,
    read: true,
    starred: false,
  });
  return messages;
}

interface MailState {
  messages: MailMessage[];
  send: (to: string, subject: string, body: string) => string;
  markRead: (id: string, read?: boolean) => void;
  toggleStar: (id: string) => void;
  moveToTrash: (id: string) => void;
  restore: (id: string) => void;
  deleteForever: (id: string) => void;
  unreadCount: () => number;
}

export const useMailStore = create<MailState>()((set, get) => ({
  messages: seedMessages(),

  send: (to, subject, body) => {
    const id = `mail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const message: MailMessage = {
      id,
      folder: 'sent',
      from: ME,
      to,
      subject: subject || '(no subject)',
      body,
      date: Date.now(),
      read: true,
      starred: false,
    };
    set((state) => ({ messages: [message, ...state.messages] }));
    // Simulated local reply — clearly labelled in-app as not real mail.
    const delay = 4000 + Math.random() * 4000;
    window.setTimeout(() => {
      const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)];
      const incoming: MailMessage = {
        id: `reply-${Date.now().toString(36)}`,
        folder: 'inbox',
        from: { name: to.split('@')[0] || 'bot', email: to },
        to: ME.email,
        subject: reply.subject.replace('{s}', subject || '(no subject)'),
        body: reply.body,
        date: Date.now(),
        read: false,
        starred: false,
      };
      set((state) => ({ messages: [incoming, ...state.messages] }));
      notify('Mail (simulated)', incoming.subject, 'info', 'mail');
      playSound('notify');
    }, delay);
    return id;
  },

  markRead: (id, read = true) =>
    set((state) => ({ messages: state.messages.map((message) => (message.id === id ? { ...message, read } : message)) })),

  toggleStar: (id) =>
    set((state) => ({ messages: state.messages.map((message) => (message.id === id ? { ...message, starred: !message.starred } : message)) })),

  moveToTrash: (id) =>
    set((state) => ({ messages: state.messages.map((message) => (message.id === id ? { ...message, folder: 'trash' } : message)) })),

  restore: (id) =>
    set((state) => ({ messages: state.messages.map((message) => (message.id === id ? { ...message, folder: 'inbox' } : message)) })),

  deleteForever: (id) => set((state) => ({ messages: state.messages.filter((message) => message.id !== id) })),

  unreadCount: () => get().messages.filter((message) => message.folder === 'inbox' && !message.read).length,
}));
