'use client';

import React from 'react';
import DialogFocus from '@/components/ui/DialogFocus';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = true,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80"
    >
      <DialogFocus />
      <div className="ui-dialog relative w-full max-w-md max-h-[90dvh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                isDestructive
                  ? 'bg-danger/10 border border-danger/20 text-danger'
                  : 'bg-accent/10 border border-accent/20 text-accent'
              }`}
            >
              <AlertTriangle aria-hidden="true" className="w-5 h-5" />
            </div>

            <div className="flex-1">
              <h3 id="confirm-modal-title" className="text-base font-bold text-ink leading-tight">{title}</h3>
              <p className="text-xs text-muted mt-2 leading-relaxed">{message}</p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="ui-icon-btn text-muted hover:text-ink p-1 rounded-lg hover:bg-elevated transition-colors cursor-pointer"
              aria-label="Fechar modal"
            >
              <X aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="ui-btn ui-btn-secondary"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`ui-btn ${isDestructive ? 'ui-btn-danger' : 'ui-btn-primary'}`}
            >
              {isLoading ? 'Processando...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
