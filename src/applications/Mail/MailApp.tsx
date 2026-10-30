import { useMemo, useState } from 'react';
import { Inbox, Send, Trash2, Star, Pencil, X, ArchiveRestore, Eye, EyeOff, Info } from 'lucide-react';
import { useMailStore, type MailFolder, type MailMessage } from '../../stores/mailStore';
import { useT } from '../../i18n';
import { formatTime } from '../../services/format';

export default function MailApp() {
  const { t } = useT();
  const messages = useMailStore((state) => state.messages);
  const send = useMailStore((state) => state.send);
  const markRead = useMailStore((state) => state.markRead);
  const toggleStar = useMailStore((state) => state.toggleStar);
  const moveToTrash = useMailStore((state) => state.moveToTrash);
  const restore = useMailStore((state) => state.restore);
  const deleteForever = useMailStore((state) => state.deleteForever);

  const [folder, setFolder] = useState<MailFolder>('inbox');
  const [selected, setSelected] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({ to: '', subject: '', body: '' });

  const list = useMemo(
    () => messages.filter((message) => message.folder === folder).sort((a, b) => b.date - a.date),
    [messages, folder],
  );
  const unread = messages.filter((message) => message.folder === 'inbox' && !message.read).length;
  const current: MailMessage | undefined = list.find((message) => message.id === selected) ?? list[0];

  const folders: { id: MailFolder; label: string; icon: typeof Inbox; badge?: number }[] = [
    { id: 'inbox', label: t('mail.inbox'), icon: Inbox, badge: unread },
    { id: 'sent', label: t('mail.sent'), icon: Send },
    { id: 'trash', label: t('mail.trash'), icon: Trash2 },
  ];

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-44 shrink-0 flex-col gap-1 border-e border-[var(--border)] bg-[var(--surface-2)] p-2">
        <button type="button" className="win-button win-button-accent mb-2 text-[12px]" onClick={() => setComposing(true)}>
          <Pencil size={13} /> {t('mail.compose')}
        </button>
        {folders.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`list-row w-full ${folder === item.id ? 'bg-[var(--accent-soft)]' : ''}`}
            onClick={() => {
              setFolder(item.id);
              setSelected(null);
            }}
          >
            <item.icon size={15} className="opacity-70" />
            <span className="flex-1 text-start text-[12px]">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-bold text-white">{item.badge}</span> : null}
          </button>
        ))}
        <p className="mt-auto flex items-start gap-1.5 rounded border border-amber-500/25 bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-600">
          <Info size={12} className="mt-px shrink-0" />
          {t('mail.simulatedNote')}
        </p>
      </aside>

      <div className="scroll-thin w-64 shrink-0 overflow-y-auto border-e border-[var(--border)]">
        {list.length === 0 ? (
          <p className="p-4 text-center text-[11.5px] opacity-50">{t('mail.empty')}</p>
        ) : (
          list.map((message) => (
            <button
              key={message.id}
              type="button"
              className={`flex w-full flex-col gap-0.5 border-b border-[var(--border)] px-3 py-2 text-start hover:bg-[var(--hover)] ${
                current?.id === message.id ? 'bg-[var(--accent-soft)]' : ''
              }`}
              onClick={() => {
                setSelected(message.id);
                if (!message.read) markRead(message.id, true);
              }}
            >
              <span className="flex items-center gap-1.5">
                {!message.read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" /> : <span className="w-1.5" />}
                <span className={`min-w-0 flex-1 truncate text-[12px] ${message.read ? 'opacity-75' : 'font-semibold'}`}>
                  {message.folder === 'sent' ? message.to : message.from.name}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums opacity-45">{formatTime(message.date)}</span>
              </span>
              <span className="truncate ps-3 text-[11.5px] opacity-80">{message.subject}</span>
            </button>
          ))
        )}
      </div>

      <section className="flex min-w-0 flex-1 flex-col">
        {current ? (
          <>
            <header className="flex items-start gap-2 border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[14px] font-semibold">{current.subject}</h2>
                <p className="truncate text-[11.5px] opacity-60">
                  {current.from.name} &lt;{current.from.email}&gt; → {current.to} · {formatTime(current.date)}
                </p>
              </div>
              <button type="button" className="icon-button h-8 w-8" onClick={() => toggleStar(current.id)} aria-label={t('mail.star')}>
                <Star size={15} className={current.starred ? 'fill-amber-400 text-amber-400' : 'opacity-60'} />
              </button>
              <button
                type="button"
                className="icon-button h-8 w-8"
                onClick={() => markRead(current.id, !current.read)}
                aria-label={current.read ? t('mail.markUnread') : t('mail.markRead')}
              >
                {current.read ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              {current.folder === 'trash' ? (
                <>
                  <button type="button" className="icon-button h-8 w-8" onClick={() => restore(current.id)} aria-label={t('mail.restore')}>
                    <ArchiveRestore size={15} />
                  </button>
                  <button type="button" className="icon-button h-8 w-8 text-rose-500" onClick={() => deleteForever(current.id)} aria-label={t('mail.deleteForever')}>
                    <X size={15} />
                  </button>
                </>
              ) : (
                <button type="button" className="icon-button h-8 w-8 text-rose-500" onClick={() => moveToTrash(current.id)} aria-label={t('mail.delete')}>
                  <Trash2 size={15} />
                </button>
              )}
            </header>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed">{current.body}</pre>
            </div>
            <footer className="border-t border-[var(--border)] p-2">
              <button
                type="button"
                className="win-button text-[11.5px]"
                onClick={() => {
                  setDraft({ to: current.from.email, subject: `Re: ${current.subject}`, body: '' });
                  setComposing(true);
                }}
              >
                <Send size={13} /> {t('mail.reply')}
              </button>
            </footer>
          </>
        ) : (
          <p className="m-auto text-[12px] opacity-50">{t('mail.empty')}</p>
        )}
      </section>

      {composing ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => setComposing(false)}>
          <div className="panel w-[min(520px,100%)] p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">{t('mail.compose')}</h3>
              <button type="button" className="icon-button h-7 w-7" onClick={() => setComposing(false)} aria-label={t('common.close')}>
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              <input
                className="win-input h-8 w-full text-[12px]"
                placeholder={t('mail.toPlaceholder')}
                value={draft.to}
                onChange={(event) => setDraft((value) => ({ ...value, to: event.target.value }))}
                dir="ltr"
              />
              <input
                className="win-input h-8 w-full text-[12px]"
                placeholder={t('mail.subjectPlaceholder')}
                value={draft.subject}
                onChange={(event) => setDraft((value) => ({ ...value, subject: event.target.value }))}
              />
              <textarea
                className="win-input h-40 w-full resize-none p-2 text-[12px]"
                placeholder={t('mail.bodyPlaceholder')}
                value={draft.body}
                onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))}
              />
              <p className="text-[10px] opacity-50">{t('mail.simulatedNote')}</p>
              <button
                type="button"
                className="win-button win-button-accent w-full text-[12px]"
                disabled={!draft.to.includes('@')}
                onClick={() => {
                  send(draft.to.trim(), draft.subject.trim(), draft.body);
                  setComposing(false);
                  setDraft({ to: '', subject: '', body: '' });
                  setFolder('sent');
                }}
              >
                <Send size={13} /> {t('mail.send')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
