'use client';

import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

interface FeedbackNoticeProps {
  message: string;
  variant: 'success' | 'error' | 'info' | 'warning';
  onDismiss: () => void;
  placement?: 'inline' | 'top' | 'bottom';
}

/** A apresentação é compartilhada; cada tela continua controlando a duração e o fechamento. */
export default function FeedbackNotice({ message, variant, onDismiss, placement = 'inline' }: FeedbackNoticeProps) {
  const Icon = variant === 'success' ? CheckCircle2 : variant === 'error' ? AlertTriangle : Info;

  return (
    <div className={placement === 'inline' ? 'min-w-0 print:hidden' : `ui-toast ui-toast-${placement} print:hidden`}>
      <div className="ui-notice" data-variant={variant}>
        <Icon aria-hidden="true" className="ui-notice-icon h-5 w-5 shrink-0" />
        <p role={variant === 'error' ? 'alert' : 'status'} aria-atomic="true" className="min-w-0 flex-1 break-words text-sm leading-relaxed text-ink">
          {message}
        </p>
        <button type="button" onClick={onDismiss} aria-label="Fechar notificação" className="ui-notice-close ui-icon-btn shrink-0 text-muted hover:bg-hover hover:text-ink cursor-pointer">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
