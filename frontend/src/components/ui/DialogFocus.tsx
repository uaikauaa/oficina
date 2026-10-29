'use client';

import { useEffect, useRef } from 'react';

/** Mantém foco no dialog montado e o devolve ao acionador ao fechar. */
export default function DialogFocus() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const dialog = marker.current?.closest('[role="dialog"]');
    if (!(dialog instanceof HTMLElement)) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const candidates = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
      .filter(element => element.getClientRects().length > 0 && !element.closest('[hidden]'));
    const focusFirst = () => (candidates()[0] ?? dialog).focus();
    dialog.tabIndex = -1;
    if (!dialog.contains(document.activeElement)) focusFirst();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      // Dialogs aninhados administram o próprio foco.
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'));
      if (dialogs.at(-1) !== dialog) return;
      const items = candidates();
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', onKey);
    return () => { dialog.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <span ref={marker} hidden />;
}
