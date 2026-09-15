'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Package,
  Barcode,
  DollarSign,
  Boxes,
  MapPin,
  Building2,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Produto, ProdutoFormData, TipoProduto, Fornecedor } from '@/lib/types';
import { apiFetchJson } from '@/lib/api';

interface ProdutoModalProps {
  isOpen: boolean;
  produto?: Produto | null;
  fornecedores: Fornecedor[];
  onClose: () => void;
  onSuccess: (produto: Produto) => void;
}

const TIPO_OPTIONS: { value: TipoProduto; label: string; icon: string }[] = [
  { value: 'PECA', label: 'Peça / Componente', icon: '🔌' },
  { value: 'PRODUTO', label: 'Produto Acabado', icon: '📦' },
  { value: 'CONSUMIVEL', label: 'Consumível de Solda', icon: '⚡' },
  { value: 'SERVICO', label: 'Serviço Técnico', icon: '🛠️' },
];

const UNIDADES = ['UN', 'PC', 'KG', 'M', 'PAR', 'CJ', 'L'];

const INPUT_CLASS =
  'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors';

const LABEL_CLASS = 'block text-xs font-semibold text-slate-400 mb-1.5';

export default function ProdutoModal({
  isOpen,
  produto,
  fornecedores,
  onClose,
  onSuccess,
}: ProdutoModalProps) {
  const isEditing = !!produto;

  const [formData, setFormData] = useState<Partial<ProdutoFormData>>({
    codigo: '',
    codigoBarras: '',
    nome: '',
    descricao: '',
    tipo: 'PECA',
    unidadeMedida: 'UN',
    precoCusto: 0,
    precoVenda: 0,
    estoqueInicial: 0,
    estoqueMinimo: 1,
    localizacao: '',
    fornecedorId: undefined,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (produto) {
      setFormData({
        codigo: produto.codigo,
        codigoBarras: produto.codigoBarras || '',
        nome: produto.nome,
        descricao: produto.descricao || '',
        tipo: produto.tipo,
        unidadeMedida: produto.unidadeMedida || 'UN',
        precoCusto: produto.precoCusto,
        precoVenda: produto.precoVenda,
        estoqueMinimo: produto.estoqueMinimo,
        localizacao: produto.localizacao || '',
        fornecedorId: produto.fornecedorId || undefined,
      });
    } else {
      setFormData({
        codigo: '',
        codigoBarras: '',
        nome: '',
        descricao: '',
        tipo: 'PECA',
        unidadeMedida: 'UN',
        precoCusto: 0,
        precoVenda: 0,
        estoqueInicial: 0,
        estoqueMinimo: 1,
        localizacao: '',
        fornecedorId: undefined,
      });
    }
    setError(null);
    setSuccessMsg(null);
  }, [produto, isOpen]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      const parsed = parseFloat(value);
      setFormData((prev) => ({ ...prev, [name]: isNaN(parsed) ? 0 : parsed }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleGerarCodigo = () => {
    const prefix = formData.tipo === 'PECA' ? 'PEC' : formData.tipo === 'CONSUMIVEL' ? 'CON' : 'PRD';
    const rand = Math.floor(1000 + Math.random() * 9000);
    setFormData((prev) => ({ ...prev, codigo: `${prefix}-${rand}` }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!formData.codigo?.trim()) {
      setError('O código da peça/produto é obrigatório.');
      return;
    }

    if (!formData.nome?.trim()) {
      setError('O nome/descrição da peça é obrigatório.');
      return;
    }

    if (formData.precoVenda === undefined || formData.precoVenda < 0) {
      setError('O preço de venda deve ser igual ou superior a zero.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        codigo: formData.codigo.trim().toUpperCase(),
        codigoBarras: formData.codigoBarras?.trim() || null,
        nome: formData.nome.trim(),
        descricao: formData.descricao?.trim() || null,
        tipo: formData.tipo,
        unidadeMedida: formData.unidadeMedida || 'UN',
        precoCusto: formData.precoCusto ?? 0,
        precoVenda: formData.precoVenda ?? 0,
        estoqueMinimo: formData.estoqueMinimo ?? 0,
        localizacao: formData.localizacao?.trim() || null,
        fornecedorId: formData.fornecedorId ? Number(formData.fornecedorId) : null,
        ...(!isEditing && { estoqueInicial: formData.estoqueInicial ?? 0 }),
      };

      const url = isEditing ? `/api/produtos/${produto?.id}` : '/api/produtos';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await apiFetchJson<Produto>(url, {
        method,
        body: JSON.stringify(payload),
      });

      setSuccessMsg(
        isEditing
          ? 'Produto/peça atualizado com sucesso!'
          : 'Peça cadastrada com sucesso!'
      );
      setTimeout(() => {
        onSuccess(res);
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar peça/produto';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEditing ? 'Editar Peça / Componente' : 'Cadastrar Nova Peça / Componente'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing
                  ? `Atualizando ${produto?.codigo} - ${produto?.nome}`
                  : 'Componentes para máquinas de solda, geradores e manutenção'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
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

          {/* Tipo de Item */}
          <div>
            <label className={LABEL_CLASS}>Tipo do Registro *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIPO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, tipo: opt.value }))}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    formData.tipo === opt.value
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Código e Código de Barras */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-400">Código da Peça *</label>
                <button
                  type="button"
                  onClick={handleGerarCodigo}
                  className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Gerar automático
                </button>
              </div>
              <input
                type="text"
                name="codigo"
                value={formData.codigo || ''}
                onChange={handleChange}
                placeholder="Ex: IGBT-60N100, AVR-5KW"
                className={INPUT_CLASS}
                required
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Código de Barras / SKU</label>
              <div className="relative">
                <input
                  type="text"
                  name="codigoBarras"
                  value={formData.codigoBarras || ''}
                  onChange={handleChange}
                  placeholder="Ex: 7891234567890"
                  className={INPUT_CLASS}
                />
                <Barcode className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Nome da Peça */}
          <div>
            <label className={LABEL_CLASS}>Nome / Descrição Resumida *</label>
            <input
              type="text"
              name="nome"
              value={formData.nome || ''}
              onChange={handleChange}
              placeholder="Ex: Módulo IGBT 60N100 60A 1000V, Regulador AVR Gerador 5kVA"
              className={INPUT_CLASS}
              required
            />
          </div>

          {/* Preços e Unidade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={LABEL_CLASS}>Preço de Custo (R$)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="precoCusto"
                  value={formData.precoCusto ?? 0}
                  onChange={handleChange}
                  className={INPUT_CLASS}
                />
                <DollarSign className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>Preço de Venda (R$) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="precoVenda"
                  value={formData.precoVenda ?? 0}
                  onChange={handleChange}
                  className={INPUT_CLASS}
                  required
                />
                <DollarSign className="w-4 h-4 text-amber-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>Unidade de Medida</label>
              <select
                name="unidadeMedida"
                value={formData.unidadeMedida || 'UN'}
                onChange={handleChange}
                className={INPUT_CLASS}
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estoque e Localização */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {!isEditing && (
              <div>
                <label className={LABEL_CLASS}>Estoque Inicial</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    name="estoqueInicial"
                    value={formData.estoqueInicial ?? 0}
                    onChange={handleChange}
                    className={INPUT_CLASS}
                  />
                  <Boxes className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            )}

            <div>
              <label className={LABEL_CLASS}>Estoque Mínimo (Alerta)</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  name="estoqueMinimo"
                  value={formData.estoqueMinimo ?? 1}
                  onChange={handleChange}
                  className={INPUT_CLASS}
                />
                <Boxes className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div className={isEditing ? 'sm:col-span-2' : ''}>
              <label className={LABEL_CLASS}>Localização Física</label>
              <div className="relative">
                <input
                  type="text"
                  name="localizacao"
                  value={formData.localizacao || ''}
                  onChange={handleChange}
                  placeholder="Ex: Prateleira B3, Gaveta 2"
                  className={INPUT_CLASS}
                />
                <MapPin className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Fornecedor */}
          <div>
            <label className={LABEL_CLASS}>Fornecedor Preferencial</label>
            <div className="relative">
              <select
                name="fornecedorId"
                value={formData.fornecedorId || ''}
                onChange={handleChange}
                className={INPUT_CLASS}
              >
                <option value="">Nenhum fornecedor vinculado</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.razaoSocial} {f.nomeFantasia ? `(${f.nomeFantasia})` : ''}
                  </option>
                ))}
              </select>
              <Building2 className="w-4 h-4 text-slate-500 absolute right-8 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Detalhes Técnicos e Aplicação */}
          <div>
            <label className={LABEL_CLASS}>Observações Técnicas / Aplicação</label>
            <textarea
              name="descricao"
              value={formData.descricao || ''}
              onChange={handleChange}
              rows={3}
              placeholder="Ex: Compatível com inversores de solda TIG/MIG das marcas ESAB, Boxer e Balmer. Tensão máx 1200V."
              className={INPUT_CLASS}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Peça'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
