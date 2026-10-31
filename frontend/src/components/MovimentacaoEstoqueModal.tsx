'use client';

import React, { useEffect, useState } from 'react';
import DialogFocus from '@/components/ui/DialogFocus';
import {
  X,
  Boxes,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  Produto,
  TipoMovimentacaoEstoque,
  MovimentacaoManualFormData,
} from '@/lib/types';
import { apiFetchJson } from '@/lib/api';

interface MovimentacaoEstoqueModalProps {
  isOpen: boolean;
  produto: Produto | null;
  onClose: () => void;
  onSuccess: () => void;
}

const TIPOS_MANUAIS: {
  value: TipoMovimentacaoEstoque;
  label: string;
  desc: string;
  icon: typeof ArrowUpRight;
}[] = [
  {
    value: 'ENTRADA',
    label: 'Entrada de Estoque',
    desc: 'Recebimento de compra, nota fiscal ou reposição',
    icon: ArrowUpRight,
  },
  {
    value: 'SAIDA',
    label: 'Saída Avulsa',
    desc: 'Descarte, venda balcão avulsa ou consumo interno',
    icon: ArrowDownRight,
  },
  {
    value: 'AJUSTE_POSITIVO',
    label: 'Ajuste (+)',
    desc: 'Correção de inventário físico para aumento de saldo',
    icon: SlidersHorizontal,
  },
  {
    value: 'AJUSTE_NEGATIVO',
    label: 'Ajuste (-)',
    desc: 'Correção de inventário físico para redução de saldo',
    icon: SlidersHorizontal,
  },
];

const INPUT_CLASS = 'ui-field';

const LABEL_CLASS = 'ui-label';

export default function MovimentacaoEstoqueModal({
  isOpen,
  produto,
  onClose,
  onSuccess,
}: MovimentacaoEstoqueModalProps) {
  const [formData, setFormData] = useState<MovimentacaoManualFormData>({
    produtoId: produto?.id || 0,
    tipoMovimentacao: 'ENTRADA',
    quantidade: 1,
    valorUnitario: produto?.precoCusto || 0,
    motivo: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (produto) {
        setFormData({
          produtoId: produto.id,
          tipoMovimentacao: 'ENTRADA',
          quantidade: 1,
          valorUnitario: produto.precoCusto || 0,
          motivo: '',
        });
      }
      setError(null);
      setSuccessMsg(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [produto, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen || !produto) return null;

  const handleTipoChange = (tipo: TipoMovimentacaoEstoque) => {
    setFormData((prev) => ({
      ...prev,
      tipoMovimentacao: tipo,
      valorUnitario:
        tipo === 'ENTRADA' ? produto.precoCusto : prev.valorUnitario,
    }));
  };

  // Cálculo de projeção de saldo
  const saldoAtual = produto.estoqueAtual ?? 0;
  const qtd = Number(formData.quantidade) || 0;
  let saldoProjetado = saldoAtual;
  if (formData.tipoMovimentacao === 'ENTRADA' || formData.tipoMovimentacao === 'AJUSTE_POSITIVO') {
    saldoProjetado = saldoAtual + qtd;
  } else {
    saldoProjetado = saldoAtual - qtd;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (qtd <= 0) {
      setError('A quantidade deve ser superior a zero.');
      return;
    }

    if (
      (formData.tipoMovimentacao === 'SAIDA' || formData.tipoMovimentacao === 'AJUSTE_NEGATIVO') &&
      saldoProjetado < 0
    ) {
      setError(
        `Saldo insuficiente! Saldo atual é ${saldoAtual}, não é possível dar saída em ${qtd}.`
      );
      return;
    }

    if (!formData.motivo.trim()) {
      setError('O motivo da movimentação é obrigatório para auditoria.');
      return;
    }

    setLoading(true);

    try {
      await apiFetchJson('/api/estoque/movimentar', {
        method: 'POST',
        body: JSON.stringify({
          produtoId: produto.id,
          tipoMovimentacao: formData.tipoMovimentacao,
          quantidade: qtd,
          valorUnitario: formData.valorUnitario || null,
          motivo: formData.motivo.trim(),
        }),
      });

      setSuccessMsg('Movimentação registrada com sucesso!');
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar movimentação';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="movimentacao-estoque-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/70 animate-fade-in overflow-y-auto"
    >
      <DialogFocus />
      <div className="ui-dialog relative w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] border flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-line bg-surface/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20 shrink-0">
              <Boxes aria-hidden="true" className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="movimentacao-estoque-title" className="text-sm sm:text-base font-bold text-ink truncate">
                Movimentação Manual de Estoque
              </h2>
              <p className="text-xs text-muted truncate">
                <span className="text-accent font-semibold">{produto.codigo}</span> - {produto.nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ui-icon-btn p-1.5 text-muted hover:text-ink rounded-lg hover:bg-elevated transition-colors shrink-0 cursor-pointer"
            aria-label="Fechar modal"
          >
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-4 sm:space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 sm:p-3.5 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs min-w-0">
              <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words min-w-0">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 p-3 sm:p-3.5 bg-ink/5 border border-line rounded-xl text-ink text-xs min-w-0">
              <CheckCircle2 aria-hidden="true" className="w-4 h-4 shrink-0" />
              <span className="break-words min-w-0">{successMsg}</span>
            </div>
          )}

          {/* Cards de Tipo de Movimentação */}
          <div className="min-w-0">
            <label className={LABEL_CLASS}>Tipo de Movimentação *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
              {TIPOS_MANUAIS.map((tipo) => {
                const Icon = tipo.icon;
                const isSelected = formData.tipoMovimentacao === tipo.value;
                return (
                  <button
                    key={tipo.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleTipoChange(tipo.value)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer min-w-0 ${
                      isSelected
                        ? 'bg-accent/10 border-accent text-ink'
                        : 'bg-canvas border-line text-muted hover:border-control hover:text-ink'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold truncate">{tipo.label}</span>
                    </div>
                    <p className="text-xs text-muted line-clamp-2 leading-tight">
                      {tipo.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantidade e Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <div className="min-w-0">
              <label htmlFor="field-src-components-MovimentacaoEstoqueModal-tsx-1" className={LABEL_CLASS}>Quantidade ({produto.unidadeMedida}) *</label>
              <input id="field-src-components-MovimentacaoEstoqueModal-tsx-1"
                type="number"
                step="1"
                min="1"
                value={formData.quantidade}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    quantidade: Number(e.target.value) || 0,
                  }))
                }
                className={INPUT_CLASS}
                required
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="field-src-components-MovimentacaoEstoqueModal-tsx-2" className={LABEL_CLASS}>Valor Unitário Referência (R$)</label>
              <div className="relative">
                <input id="field-src-components-MovimentacaoEstoqueModal-tsx-2"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valorUnitario ?? 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      valorUnitario: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={`${INPUT_CLASS} pr-10`}
                />
                <DollarSign aria-hidden="true" className="w-4 h-4 text-subtle absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              </div>
            </div>
          </div>

          {/* Simulação de Saldo */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-canvas border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 text-xs">
            <div className="flex items-center justify-between sm:block min-w-0">
              <span className="text-muted text-xs sm:block">Saldo Atual:</span>
              <span className="font-bold text-ink text-sm sm:mt-0.5 truncate">
                {saldoAtual} {produto.unidadeMedida}
              </span>
            </div>

            <div className="hidden sm:flex items-center justify-center text-subtle font-bold shrink-0">
              ➔
            </div>

            <div className="flex items-center justify-between sm:block sm:text-right border-t sm:border-t-0 border-line pt-2 sm:pt-0 min-w-0">
              <span className="text-muted text-xs sm:block">Novo Saldo Estimado:</span>
              <span
                className={`font-bold text-sm sm:mt-0.5 truncate ${
                  saldoProjetado < 0
                    ? 'text-danger'
                    : saldoProjetado <= produto.estoqueMinimo
                    ? 'text-accent'
                    : 'text-ink'
                }`}
              >
                {saldoProjetado} {produto.unidadeMedida}
              </span>
            </div>
          </div>

          {/* Motivo */}
          <div className="min-w-0">
            <label htmlFor="field-src-components-MovimentacaoEstoqueModal-tsx-3" className={LABEL_CLASS}>Motivo / Justificativa da Movimentação *</label>
            <textarea id="field-src-components-MovimentacaoEstoqueModal-tsx-3"
              value={formData.motivo}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, motivo: e.target.value }))
              }
              rows={3}
              placeholder="Ex: Nota Fiscal 1420 da Boxer Soldas; Ajuste de conferência física trimestral; Sucateamento de peça com avaria de transporte..."
              className={`${INPUT_CLASS} resize-none`}
              required
            />
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-line shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-muted hover:text-ink rounded-xl hover:bg-elevated transition-colors text-center cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || saldoProjetado < 0}
              className="ui-btn ui-btn-primary w-full sm:w-auto transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <span>Confirmar Movimentação</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
