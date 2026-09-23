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
  Tag,
  Award,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Produto, ProdutoFormData, TipoProduto, Fornecedor, Categoria } from '@/lib/types';
import { apiFetchJson } from '@/lib/api';

interface ProdutoModalProps {
  isOpen: boolean;
  produto?: Produto | null;
  fornecedores: Fornecedor[];
  categorias?: Categoria[];
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
  categorias: categoriasProp,
  onClose,
  onSuccess,
}: ProdutoModalProps) {
  const isEditing = !!produto;

  const [categoriasLocais, setCategoriasLocais] = useState<Categoria[]>([]);
  const categorias = categoriasProp && categoriasProp.length > 0 ? categoriasProp : categoriasLocais;
  const [formData, setFormData] = useState<Partial<ProdutoFormData>>({
    codigo: '',
    codigoBarras: '',
    nome: '',
    descricao: '',
    marca: '',
    tipo: 'PECA',
    unidadeMedida: 'UN',
    precoCusto: 0,
    precoVenda: 0,
    estoqueInicial: 0,
    estoqueMinimo: 1,
    localizacao: '',
    categoriaId: undefined,
    fornecedorId: undefined,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!categoriasProp || categoriasProp.length === 0) {
      apiFetchJson<Categoria[]>('/api/categorias/ativas')
        .then((cats) => setCategoriasLocais(cats || []))
        .catch(() => {});
    }
  }, [categoriasProp, isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (produto) {
        setFormData({
          codigo: produto.codigo,
          codigoBarras: produto.codigoBarras || '',
          nome: produto.nome,
          descricao: produto.descricao || '',
          marca: produto.marca || '',
          tipo: produto.tipo,
          unidadeMedida: produto.unidadeMedida || 'UN',
          precoCusto: produto.precoCusto,
          precoVenda: produto.precoVenda,
          estoqueMinimo: produto.estoqueMinimo,
          localizacao: produto.localizacao || '',
          categoriaId: produto.categoriaId || undefined,
          fornecedorId: produto.fornecedorId || undefined,
        });
      } else {
        setFormData({
          codigo: '',
          codigoBarras: '',
          nome: '',
          descricao: '',
          marca: '',
          tipo: 'PECA',
          unidadeMedida: 'UN',
          precoCusto: 0,
          precoVenda: 0,
          estoqueInicial: 0,
          estoqueMinimo: 1,
          localizacao: '',
          categoriaId: undefined,
          fornecedorId: undefined,
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

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'number'
          ? value === ''
            ? 0
            : Number(value)
          : name === 'fornecedorId' || name === 'categoriaId'
            ? value === ''
              ? undefined
              : Number(value)
            : value,
    }));
  };

  const handleGerarCodigo = () => {
    let prefixo = 'PEC';
    if (formData.nome && formData.nome.trim()) {
      const match = formData.nome.trim().match(/^([A-Za-z0-9]+)/);
      if (match && match[1].length >= 2 && match[1].length <= 5) {
        prefixo = match[1].toUpperCase();
      }
    } else {
      prefixo = formData.tipo === 'PECA' ? 'PEC' : formData.tipo === 'CONSUMIVEL' ? 'CON' : 'PRD';
    }
    const aleatorio = Math.floor(1 + Math.random() * 999).toString().padStart(3, '0');
    setFormData((prev) => ({
      ...prev,
      codigo: `${prefixo}-${aleatorio}`,
    }));
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
      setError('O nome da peça/produto é obrigatório.');
      return;
    }

    if (formData.precoVenda == null || formData.precoVenda < 0) {
      setError('O preço de venda não pode ser negativo.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...formData,
        codigo: formData.codigo.trim(),
        codigoBarras: formData.codigoBarras?.trim() || null,
        nome: formData.nome.trim(),
        descricao: formData.descricao?.trim() || null,
        marca: formData.marca?.trim() || null,
        localizacao: formData.localizacao?.trim() || null,
        categoriaId: formData.categoriaId || null,
        fornecedorId: formData.fornecedorId || null,
      };

      let salvo: Produto;

      if (isEditing && produto) {
        salvo = await apiFetchJson<Produto>(`/api/produtos/${produto.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Peça/produto atualizado com sucesso!');
      } else {
        salvo = await apiFetchJson<Produto>('/api/produtos', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuccessMsg('Peça/produto cadastrado com sucesso!');
      }

      setTimeout(() => {
        onSuccess(salvo);
        onClose();
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar peça/produto';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };



  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="produto-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 id="produto-modal-title" className="text-base font-bold text-white">
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
            aria-label="Fechar modal"
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
                  className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
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

          {/* Nome e Marca */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
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

            <div>
              <label className={LABEL_CLASS}>Marca / Fabricante</label>
              <div className="relative">
                <input
                  type="text"
                  name="marca"
                  value={formData.marca || ''}
                  onChange={handleChange}
                  placeholder="Ex: Toshiba, ESAB, Stamford"
                  className={INPUT_CLASS}
                />
                <Award className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Categoria e Fornecedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Categoria Técnica</label>
              <div className="relative">
                <select
                  name="categoriaId"
                  value={formData.categoriaId || ''}
                  onChange={handleChange}
                  className={INPUT_CLASS}
                >
                  <option value="">Nenhuma categoria vinculada</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <Tag className="w-4 h-4 text-slate-500 absolute right-8 top-3 pointer-events-none" />
              </div>
            </div>

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
