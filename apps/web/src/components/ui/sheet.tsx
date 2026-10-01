'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** right: panel samping di desktop. Di mobile keduanya tampil sebagai lembar penuh dari bawah. */
  side?: 'right' | 'bottom';
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Panel modal berbasis <dialog> native: fokus terkunci di dalam, Escape menutup,
 * dan fokus kembali ke tombol pembuka saat ditutup.
 */
export function Sheet({ open, onClose, title, side = 'right', children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const position =
    side === 'right'
      ? 'mt-auto mb-0 max-h-[90dvh] w-full max-w-none rounded-t-3xl sm:m-0 sm:ml-auto sm:h-dvh sm:max-h-dvh sm:w-[400px] sm:rounded-none'
      : 'mt-auto mb-0 max-h-[90dvh] w-full max-w-none rounded-t-3xl sm:m-auto sm:max-w-lg sm:rounded-2xl';

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // Klik di backdrop (di luar panel) menutup dialog.
        if (event.target === event.currentTarget) onClose();
      }}
      className={`${position} bg-surface p-0 text-ink shadow-overlay`}
    >
      <div className="flex max-h-[inherit] flex-col sm:h-full">
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2">
          <h2 id={titleId} className="font-display text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full text-ink-2 hover:bg-muted"
            aria-label="Tutup"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-5">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <div className="border-t border-line px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
