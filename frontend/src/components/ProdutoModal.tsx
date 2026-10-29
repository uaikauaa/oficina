'use client';

import React, { useEffect, useState } from 'react';
import DialogFocus from '@/components/ui/DialogFocus';
import DomainIcon from '@/components/ui/DomainIcon';
import {
  X,
  Package,
  Link2,
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
import {
  Produto,
  ProdutoFormData,
  Fornecedor,
  Categoria,
  TIPOS_PRODUTO_FORMULARIO,
  CATEGORIAS_TECNICAS_PERMITIDAS,
} from '@/lib/types';
import { apiFetchJson } from '@/lib/api';

interface ProdutoModalProps {
  isOpen: boolean;
  produto?: Produto | null;
  fornecedores: Fornecedor[];
  categorias?: Categoria[];
  onClose: () => void;
  onSuccess: (produto: Produto) => void;
}

export const TIPO_OPTIONS = TIPOS_PRODUTO_FORMULARIO;
export const CATEGORIAS_PERMITIDAS = CATEGORIAS_TECNICAS_PERMITIDAS;

/**
 * Tipos legados que não são mais oferecidos em novos cadastros, mas podem existir
 * em registros históricos. Usados apenas para representação informativa em EDIÇÃO.
 */
const TIPOS_LEGADOS_LABELS: Partial<Record<Produto['tipo'], string>> = {
  PRODUTO: 'Produto Acabado (histórico)',
  SERVICO: 'Serviço Técnico (histórico)',
};



const UNIDADES: { value: string; label: string }[] = [
  { value: 'UN', label: 'Unidade' },
  { value: 'PC', label: 'Peça' },
  { value: 'KG', label: 'Quilograma' },
  { value: 'M', label: 'Metro' },
  { value: 'PAR', label: 'Par' },
  { value: 'CJ', label: 'Conjunto' },
  { value: 'L', label: 'Litro' },
];

const INPUT_CLASS = 'ui-field';

const INPUT_WITH_ICON_CLASS = 'ui-field pr-10 placeholder:truncate';

const LABEL_CLASS = 'ui-label';

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
  const categoriasValidas = categorias.filter((c) =>
    CATEGORIAS_PERMITIDAS.some(
      (permitida) => permitida.toLowerCase() === c.nome.trim().toLowerCase()
    )
  );
  // Somente em EDIÇÃO: a categoria efetivamente vinculada ao produto, quando não
  // pertence às categorias homologadas, é exibida como única opção histórica.
  const categoriaHistorica: { id: number; nome: string } | null =
    isEditing &&
    produto?.categoriaId != null &&
    !categoriasValidas.some((c) => c.id === produto.categoriaId)
      ? {
          id: produto.categoriaId,
          nome:
            categorias.find((c) => c.id === produto.categoriaId)?.nome ||
            produto.categoriaNome ||
            `Categoria #${produto.categoriaId}`,
        }
      : null;
  const tipoLegadoOriginal =
    isEditing && produto ? TIPOS_LEGADOS_LABELS[produto.tipo] ?? null : null;
  const [formData, setFormData] = useState<Partial<ProdutoFormData>>({
    codigo: '',
    linkCompra: '',
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
          linkCompra: produto.linkCompra || '',
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
          linkCompra: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (isEditing && !formData.codigo?.trim()) {
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

    if (formData.linkCompra && formData.linkCompra.trim()) {
      try {
        const parsedUrl = new URL(formData.linkCompra.trim());
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          setError('O link de compra deve começar com http:// ou https://');
          return;
        }
      } catch {
        setError('Por favor, informe uma URL válida para o link de compra (ex: https://...).');
        return;
      }
    }

    setLoading(true);

    try {
      const payload: Partial<ProdutoFormData> = {
        ...formData,
        ...(isEditing && formData.codigo ? { codigo: formData.codigo.trim() } : {}),
        linkCompra: formData.linkCompra?.trim() || null,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 animate-in fade-in duration-200 overflow-y-auto"
    >
      <DialogFocus />
      <div className="ui-dialog border w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-line shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20 shrink-0">
              <Package aria-hidden="true" className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="produto-modal-title" className="text-sm sm:text-base font-bold text-ink truncate">
                {isEditing ? 'Editar Peça / Componente' : 'Cadastrar Nova Peça / Componente'}
              </h2>
              <p className="text-xs text-muted truncate">
                {isEditing
                  ? `Atualizando ${produto?.codigo} - ${produto?.nome}`
                  : 'Componentes para máquinas de solda, geradores e manutenção'}
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

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-4 sm:space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs">
              <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 p-3.5 bg-ink/5 border border-line rounded-xl text-ink text-xs">
              <CheckCircle2 aria-hidden="true" className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tipo de Item */}
          <div>
            <label className={LABEL_CLASS}>Tipo do Registro *</label>
            {tipoLegadoOriginal && produto && (
              <div
                data-testid="tipo-historico"
                className="mb-2 p-2.5 rounded-xl bg-canvas border border-accent/30 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                {formData.tipo === produto.tipo ? (
                  <span className="text-ink">
                    Tipo atual: <strong className="text-accent">{tipoLegadoOriginal}</strong>
                  </span>
                ) : (
                  <>
                    <span className="text-muted">
                      Tipo original: <strong className="text-ink">{tipoLegadoOriginal}</strong> — será alterado ao salvar.
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, tipo: produto.tipo }))}
                      className="text-xs font-semibold text-accent hover:text-accent hover:underline cursor-pointer"
                    >
                      Manter tipo original
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TIPO_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, tipo: opt.value }))}
                  className={`p-3 min-h-[46px] rounded-xl border text-xs font-semibold flex items-center justify-start sm:justify-center gap-2.5 transition-all cursor-pointer ${
                    formData.tipo === opt.value
                      ? 'bg-accent/20 border-accent/40 text-accent shadow-sm'
                      : 'bg-canvas border-line text-muted hover:border-control hover:text-ink'
                  }`}
                >
                  <DomainIcon type={opt.value} />
                  <span className="leading-snug break-words whitespace-normal text-left sm:text-center">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Código e Link de Compra */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="field-src-components-ProdutoModal-tsx-1" className={LABEL_CLASS}>Código da Peça</label>
                <span className="text-xs text-subtle font-medium">
                  {isEditing ? 'Identificador fixo' : 'Gerado pelo servidor'}
                </span>
              </div>
              <input id="field-src-components-ProdutoModal-tsx-1"
                type="text"
                name="codigo"
                value={isEditing ? (formData.codigo || '') : 'P-### (Gerado ao salvar)'}
                disabled
                readOnly
                className={`${INPUT_CLASS} bg-canvas/70 text-accent font-mono font-bold cursor-not-allowed border-dashed border-control`}
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="field-src-components-ProdutoModal-tsx-2" className={LABEL_CLASS}>Link de Compra</label>
              <div className="relative">
                <input id="field-src-components-ProdutoModal-tsx-2"
                  type="url"
                  name="linkCompra"
                  value={formData.linkCompra || ''}
                  onChange={handleChange}
                  placeholder="Ex: https://www.fornecedor.com.br/produto/..."
                  className={INPUT_WITH_ICON_CLASS}
                />
                <Link2 aria-hidden="true" className="w-4 h-4 text-subtle absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              </div>
            </div>
          </div>

          {/* Nome e Marca */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="min-w-0 md:col-span-2">
              <label htmlFor="field-src-components-ProdutoModal-tsx-3" className={LABEL_CLASS}>Nome / Descrição Resumida *</label>
              <input id="field-src-components-ProdutoModal-tsx-3"
                type="text"
                name="nome"
                value={formData.nome || ''}
                onChange={handleChange}
                placeholder="Ex: Módulo IGBT 60N100 60A 1000V, Regulador AVR Gerador 5kVA"
                className={`${INPUT_CLASS} placeholder:truncate`}
                required
              />
            </div>

            <div className="min-w-0">
              <label htmlFor="field-src-components-ProdutoModal-tsx-4" className={LABEL_CLASS}>Marca / Fabricante</label>
              <div className="relative">
                <input id="field-src-components-ProdutoModal-tsx-4"
                  type="text"
                  name="marca"
                  value={formData.marca || ''}
                  onChange={handleChange}
                  placeholder="Ex: Toshiba, ESAB, Stamford"
                  className={INPUT_WITH_ICON_CLASS}
                />
                <Award aria-hidden="true" className="w-4 h-4 text-subtle absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              </div>
            </div>
          </div>

          {/* Categoria e Fornecedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label htmlFor="field-src-components-ProdutoModal-tsx-5" className={LABEL_CLASS}>Categoria Técnica</label>
              <div className="relative">
                <select id="field-src-components-ProdutoModal-tsx-5"
                  name="categoriaId"
                  value={formData.categoriaId || ''}
                  onChange={handleChange}
                  className={`${INPUT_CLASS} pr-14`}
                >
                  {categoriaHistorica && (
                    <option value={categoriaHistorica.id}>
                      {categoriaHistorica.nome} (histórica)
                    </option>
                  )}
                  <option value="">Nenhuma categoria vinculada</option>
                  {categoriasValidas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
                <Tag aria-hidden="true" className="w-4 h-4 text-subtle absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              </div>
            </div>

            <div className="min-w-0">
              <label htmlFor="field-src-components-ProdutoModal-tsx-6" className={LABEL_CLASS}>Fornecedor Preferencial</label>
              <div className="relative">
                <select id="field-src-components-ProdutoModal-tsx-6"
                  name="fornecedorId"
                  value={formData.fornecedorId || ''}
                  onChange={handleChange}
                  className={`${INPUT_CLASS} pr-14`}
                >
                  <option value="">Nenhum fornecedor vinculado</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.razaoSocial} {f.nomeFantasia ? `(${f.nomeFantasia})` : ''}
                    </option>
                  ))}
                </select>
                <Building2 aria-hidden="true" className="w-4 h-4 text-subtle absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              </div>
            </div>
          </div>

          {/* Preços e Unidade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="min-w-0">
              <label htmlFor="field-src-components-ProdutoModal-tsx-7" className={LABEL_CLASS}>Preço de Custo (R$)</label>
              <div className="relative">
                <input id="field-src-components-ProdutoModal-tsx-7"
                  type="number"
                  step="0.01"
                  min="0"
                  name="precoCusto"
                  value={formData.precoCusto ?? 0}
                  onChange={handleChange}
                  className={INPUT_WITH_ICON_CLASS}
                />
                <DollarSign aria-hidden="true" className="w-4 h-4 text-subtle absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              </div>
            </div>

            <div className="min-w-0">
              <label htmlFor="field-src-components-ProdutoModal-tsx-8" className={LABEL_CLASS}>Preço de Venda (R$) *</label>
              <div className="relative">
                <input id="field-src-components-ProdutoModal-tsx-8"
                  type="number"
                  step="0.01"
                  min="0"
                  name="precoVenda"
                  value={formData.precoVenda ?? 0}
                  onChange={handleChange}
                  className={INPUT_WITH_ICON_CLASS}
                  required
                />
                <DollarSign aria-hidden="true" className="w-4 h-4 text-accent absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              </div>
            </div>

            <div className="min-w-0">
              <label htmlFor="field-src-components-ProdutoModal-tsx-9" className={LABEL_CLASS}>Unidade de Medida</label>
              <select id="field-src-components-ProdutoModal-tsx-9"
                name="unidadeMedida"
                value={formData.unidadeMedida || 'UN'}
                onChange={handleChange}
                className={INPUT_CLASS}
              >
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value} className="bg-surface text-ink">
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Estoque e Localização */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {!isEditing && (
              <div className="min-w-0">
                <label htmlFor="field-src-components-ProdutoModal-tsx-10" className={LABEL_CLASS}>Estoque Inicial</label>
                <div className="relative">
                  <input id="field-src-components-ProdutoModal-tsx-10"
                    type="number"
                    step="1"
                    min="0"
                    name="estoqueInicial"
                    value={formData.estoqueInicial ?? 0}
                    onChange={handleChange}
                    className={INPUT_WITH_ICON_CLASS}
                  />
                  <Boxes aria-hidden="true" className="w-4 h-4 text-subtle absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
                </div>
              </div>
            )}

            <div className="min-w-0">
              <label htmlFor="field-src-components-ProdutoModal-tsx-11" className={LABEL_CLASS}>Estoque Mínimo (Alerta)</label>
              <div className="relative">
                <input id="field-src-components-ProdutoModal-tsx-11"
                  type="number"
                  step="1"
                  min="0"
                  name="estoqueMinimo"
                  value={formData.estoqueMinimo ?? 1}
                  onChange={handleChange}
                  className={INPUT_WITH_ICON_CLASS}
                />
                <Boxes aria-hidden="true" className="w-4 h-4 text-subtle absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              </div>
            </div>

            <div className={`min-w-0 ${isEditing ? 'sm:col-span-2 md:col-span-2' : 'sm:col-span-2 md:col-span-1'}`}>
              <label htmlFor="field-src-components-ProdutoModal-tsx-12" className={LABEL_CLASS}>Localização Física</label>
              <div className="relative">
                <input id="field-src-components-ProdutoModal-tsx-12"
                  type="text"
                  name="localizacao"
                  value={formData.localizacao || ''}
                  onChange={handleChange}
                  placeholder="Ex: Prateleira B3, Gaveta 2"
                  className={INPUT_WITH_ICON_CLASS}
                />
                <MapPin aria-hidden="true" className="w-4 h-4 text-subtle absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              </div>
            </div>
          </div>

          {/* Detalhes Técnicos e Aplicação */}
          <div className="min-w-0">
            <label htmlFor="field-src-components-ProdutoModal-tsx-13" className={LABEL_CLASS}>Observações Técnicas / Aplicação</label>
            <textarea id="field-src-components-ProdutoModal-tsx-13"
              name="descricao"
              value={formData.descricao || ''}
              onChange={handleChange}
              rows={3}
              placeholder="Ex: Compatível com inversores de solda TIG/MIG das marcas ESAB, Boxer e Balmer. Tensão máx 1200V."
              className={INPUT_CLASS}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 sm:pt-4 border-t border-line shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink rounded-xl hover:bg-elevated transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="ui-btn ui-btn-primary transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
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
