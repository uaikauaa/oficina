'use client';

import React, { useEffect, useState } from 'react';
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
import { apiFetch } from '@/lib/api';

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
  color: string;
}[] = [
  {
    value: 'ENTRADA',
    label: 'Entrada de Estoque',
    desc: 'Recebimento de compra, nota fiscal ou reposição',
    icon: ArrowUpRight,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  },
  {
    value: 'SAIDA',
    label: 'Saída Avulsa',
    desc: 'Descarte, venda balcão avulsa ou consumo interno',
    icon: ArrowDownRight,
    color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  },
  {
    value: 'AJUSTE_POSITIVO',
    label: 'Ajuste (+)',
    desc: 'Correção de inventário físico para aumento de saldo',
    icon: SlidersHorizontal,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  },
  {
    value: 'AJUSTE_NEGATIVO',
    label: 'Ajuste (-)',
    desc: 'Correção de inventário físico para redução de saldo',
    icon: SlidersHorizontal,
    color: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  },
];

const INPUT_CLASS =
  'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors';

const LABEL_CLASS = 'block text-xs font-semibold text-slate-400 mb-1.5';

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
      await apiFetch('/api/estoque/movimentar', {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 id="movimentacao-estoque-title" className="text-base font-bold text-white">Movimentação Manual de Estoque</h2>
              <p className="text-xs text-slate-400">
                <span className="text-amber-400 font-semibold">{produto.codigo}</span> - {produto.nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Cards de Tipo de Movimentação */}
          <div>
            <label className={LABEL_CLASS}>Tipo de Movimentação *</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_MANUAIS.map((tipo) => {
                const Icon = tipo.icon;
                const isSelected = formData.tipoMovimentacao === tipo.value;
                return (
                  <button
                    key={tipo.value}
                    type="button"
                    onClick={() => handleTipoChange(tipo.value)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? tipo.color + ' shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold">{tipo.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                      {tipo.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantidade e Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Quantidade ({produto.unidadeMedida}) *</label>
              <input
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

            <div>
              <label className={LABEL_CLASS}>Valor Unitário Referência (R$)</label>
              <div className="relative">
                <input
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
                  className={INPUT_CLASS}
                />
                <DollarSign className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Simulação de Saldo */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Saldo Atual:</span>
              <span className="font-bold text-white text-sm">
                {saldoAtual} {produto.unidadeMedida}
              </span>
            </div>

            <span className="text-slate-600 font-bold">➔</span>

            <div>
              <span className="text-slate-400 block text-[11px]">Novo Saldo Estimado:</span>
              <span
                className={`font-bold text-sm ${
                  saldoProjetado < 0
                    ? 'text-rose-400'
                    : saldoProjetado <= produto.estoqueMinimo
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {saldoProjetado} {produto.unidadeMedida}
              </span>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className={LABEL_CLASS}>Motivo / Justificativa da Movimentação *</label>
            <textarea
              value={formData.motivo}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, motivo: e.target.value }))
              }
              rows={3}
              placeholder="Ex: Nota Fiscal 1420 da Boxer Soldas; Ajuste de conferência física trimestral; Sucateamento de peça com avaria de transporte..."
              className={INPUT_CLASS}
              required
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || saldoProjetado < 0}
              className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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
