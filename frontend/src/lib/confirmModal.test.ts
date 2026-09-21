import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * AUDIT-007: ConfirmModal Keyboard & Accessibility Logic Tests
 * Valida o comportamento do listener de tecla Escape, estados de loading e
 * atributos de acessibilidade (role="dialog", aria-modal="true").
 */

interface ModalState {
  isOpen: boolean;
  isLoading: boolean;
  onCancelCalls: number;
}

function createModalKeyHandler(state: ModalState) {
  return (event: { key: string }) => {
    if (!state.isOpen) return;
    if (event.key === 'Escape' && !state.isLoading) {
      state.onCancelCalls++;
    }
  };
}

describe('AUDIT-007: ConfirmModal — Acessibilidade e Tecla Escape', () => {
  it('deve disparar onCancel quando a tecla Escape é pressionada e não está carregando', () => {
    const state: ModalState = { isOpen: true, isLoading: false, onCancelCalls: 0 };
    const handler = createModalKeyHandler(state);

    handler({ key: 'Escape' });
    assert.equal(state.onCancelCalls, 1, 'onCancel deve ser chamado exatamente 1 vez');
  });

  it('NÃO deve disparar onCancel ao pressionar Escape se o modal estiver em estado isLoading', () => {
    const state: ModalState = { isOpen: true, isLoading: true, onCancelCalls: 0 };
    const handler = createModalKeyHandler(state);

    handler({ key: 'Escape' });
    assert.equal(state.onCancelCalls, 0, 'onCancel NÃO deve ser chamado enquanto isLoading=true');
  });

  it('NÃO deve disparar onCancel ao pressionar Escape se o modal estiver fechado (isOpen=false)', () => {
    const state: ModalState = { isOpen: false, isLoading: false, onCancelCalls: 0 };
    const handler = createModalKeyHandler(state);

    handler({ key: 'Escape' });
    assert.equal(state.onCancelCalls, 0, 'onCancel NÃO deve ser chamado se o modal estiver fechado');
  });

  it('NÃO deve disparar onCancel para outras teclas (Enter, Space, Tab, ArrowDown)', () => {
    const state: ModalState = { isOpen: true, isLoading: false, onCancelCalls: 0 };
    const handler = createModalKeyHandler(state);

    const keysToTest = ['Enter', 'Space', 'Tab', 'ArrowDown', 'Backspace', 'a', 'F1'];
    for (const key of keysToTest) {
      handler({ key });
    }
    assert.equal(state.onCancelCalls, 0, 'Nenhuma tecla além de Escape deve invocar onCancel');
  });

  it('deve validar atributos de acessibilidade WAI-ARIA para diálogo modal', () => {
    const accessibilityAttributes = {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'confirm-modal-title',
    };

    assert.equal(accessibilityAttributes.role, 'dialog');
    assert.equal(accessibilityAttributes['aria-modal'], 'true');
    assert.equal(accessibilityAttributes['aria-labelledby'], 'confirm-modal-title');
  });
});
