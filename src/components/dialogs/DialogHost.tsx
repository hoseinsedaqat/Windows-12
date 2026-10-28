import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useShellStore } from '../../stores/shellStore';
import { useT } from '../../i18n';

/** Modal host for confirm / prompt / alert dialogs requested anywhere in the shell. */
export function DialogHost() {
  const { t } = useT();
  const dialog = useShellStore((state) => state.dialog);
  const confirm = useShellStore((state) => state.confirmDialog);
  const cancel = useShellStore((state) => state.cancelDialog);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setValue(dialog?.defaultValue ?? '');
    if (dialog) {
      const timer = window.setTimeout(() => {
        if (dialog.kind === 'prompt') inputRef.current?.focus();
        else buttonRef.current?.focus();
      }, 40);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        cancel();
      }
      if (event.key === 'Enter' && dialog.kind !== 'alert' && !dialog.multiline) {
        event.preventDefault();
        confirm(value);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dialog, value, cancel, confirm]);

  if (!dialog) return null;

  return (
    <div
      className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={dialog.title}
    >
      <div className="panel animate-scale-in w-full max-w-md p-5">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 ${dialog.danger ? 'text-red-500' : 'text-[var(--accent)]'}`}>
            {dialog.danger ? <AlertTriangle size={20} /> : <Info size={20} />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">{dialog.title}</h2>
            {dialog.message ? <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed opacity-80">{dialog.message}</p> : null}

            {dialog.kind === 'prompt' ? (
              dialog.multiline ? (
                <textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={dialog.placeholder}
                  rows={4}
                  className="win-input mt-3 resize-y font-mono text-[12px]"
                />
              ) : (
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={dialog.placeholder}
                  className="win-input mt-3"
                  dir="auto"
                />
              )
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {dialog.kind !== 'alert' ? (
            <button type="button" className="win-button" onClick={() => cancel()}>
              {dialog.cancelLabel ?? t('common.cancel')}
            </button>
          ) : null}
          <button
            ref={buttonRef}
            type="button"
            className={`win-button ${dialog.danger ? 'bg-red-600 text-white hover:bg-red-500' : 'win-button-accent'}`}
            onClick={() => confirm(dialog.kind === 'prompt' ? value : 'ok')}
          >
            {dialog.confirmLabel ?? (dialog.kind === 'alert' ? t('common.ok') : t('common.yes'))}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DialogHost;
