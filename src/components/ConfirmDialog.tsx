import { type ReactNode, useEffect, useId, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-page modal confirmation (never window.confirm, which blocks the page). */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Cancel', danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="space-y-4 p-5 sm:p-6">
        <h2 id={titleId} className="font-display text-2xl">
          {title}
        </h2>
        {children && <div className="space-y-2 text-ink-2">{children}</div>}
        <div className="flex flex-wrap justify-end gap-3 pt-1">
          <button type="button" className="btn btn-secondary" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? 'border-bad bg-bad text-white hover:opacity-90' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
