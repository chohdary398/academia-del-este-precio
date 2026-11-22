'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

// Ventana modal sobre <dialog>: foco atrapado, Escape y clic afuera la cierran.
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      aria-labelledby={id}
      className="m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-lg overflow-auto rounded-card border-2 border-ink bg-surface p-0 text-ink shadow-[6px_6px_0_var(--color-ink)] backdrop:bg-ink/70"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      ref={ref}
    >
      <div className="flex items-start justify-between gap-4 border-b-2 border-ink bg-accent px-5 py-4">
        <h2 className="min-w-0 break-words font-display text-xl font-extrabold leading-tight" id={id}>
          {title}
        </h2>
        <button
          aria-label="Cerrar"
          className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-md transition-colors hover:bg-ink/10"
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden className="size-5" fill="none" stroke="currentColor" strokeLinecap="square" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
