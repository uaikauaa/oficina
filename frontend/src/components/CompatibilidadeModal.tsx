'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DialogFocus from '@/components/ui/DialogFocus';
import {
  X,
  Wrench,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
} from 'lucide-react';
import { Produto, Compatibilidade, Maquina } from '@/lib/types';
import { apiFetchJson } from '@/lib/api';

interface CompatibilidadeModalProps {
  isOpen: boolean;
  produto: Produto | null;
  onClose: () => void;
}

export default function CompatibilidadeModal({
  isOpen,
  produto,
  onClose,
}: CompatibilidadeModalProps) {
  const [compatibilidades, setCompatibilidades] = useState<Compatibilidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Seleção de máquina para adicionar
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [buscaMaquina, setBuscaMaquina] = useState('');
  const [maquinaSelecionadaId, setMaquinaSelecionadaId] = useState<number | ''>('');
  const [observacao, setObservacao] = useState('');
  const [adding, setAdding] = useState(false);

  const carregarCompatibilidades = useCallback(async () => {
    if (!produto) return;
    setLoading(true);
    try {
      const data = await apiFetchJson<Compatibilidade[]>(`/api/produtos/${produto.id}/compatibilidades`);
      setCompatibilidades(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar compatibilidades';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [produto]);

  const carregarMaquinas = useCallback(async () => {
    try {
      const data = await apiFetchJson<{ content: Maquina[] }>('/api/maquinas?size=100');
      setMaquinas(data.content || []);
    } catch {
      // Ignora erro
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen && produto) {
        carregarCompatibilidades();
        carregarMaquinas();
      } else {
        setCompatibilidades([]);
        setMaquinas([]);
        setBuscaMaquina('');
        setMaquinaSelecionadaId('');
        setObservacao('');
        setError(null);
        setSuccessMsg(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, produto, carregarCompatibilidades, carregarMaquinas]);

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produto || !maquinaSelecionadaId) return;

    setAdding(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await apiFetchJson(`/api/produtos/${produto.id}/compatibilidades`, {
        method: 'POST',
        body: JSON.stringify({
          maquinaId: Number(maquinaSelecionadaId),
          observacaoCompatibilidade: observacao.trim() || null,
        }),
      });

      setSuccessMsg('Equipamento vinculado com sucesso!');
      setMaquinaSelecionadaId('');
      setObservacao('');
      setBuscaMaquina('');
      carregarCompatibilidades();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao vincular compatibilidade';
      setError(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRemover = async (maquinaId: number) => {
    if (!produto) return;
    setError(null);
    setSuccessMsg(null);
    try {
      await apiFetchJson(`/api/produtos/${produto.id}/compatibilidades/${maquinaId}`, {
        method: 'DELETE',
      });
      setSuccessMsg('Vínculo removido!');
      carregarCompatibilidades();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover vínculo';
      setError(msg);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !adding) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, adding, onClose]);

  if (!isOpen || !produto) return null;

  // Filtrar máquinas para o select
  const maquinasJaVinculadas = new Set(compatibilidades.map((c) => c.maquinaId));
  const maquinasDisponiveis = maquinas
    .filter((m) => !maquinasJaVinculadas.has(m.id))
    .filter(
      (m) =>
        m.marca.toLowerCase().includes(buscaMaquina.toLowerCase()) ||
        m.modelo.toLowerCase().includes(buscaMaquina.toLowerCase()) ||
        (m.numeroSerie && m.numeroSerie.toLowerCase().includes(buscaMaquina.toLowerCase()))
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compatibilidade-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/70 animate-fade-in"
    >
      <DialogFocus />
      <div className="ui-dialog relative w-full max-w-2xl max-h-[90vh] border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20">
              <Wrench aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <h2 id="compatibilidade-modal-title" className="text-base font-bold text-ink">Compatibilidade Técnica de Equipamentos</h2>
              <p className="text-xs text-muted">
                Peça: <span className="text-accent font-semibold">{produto.codigo}</span> - {produto.nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ui-icon-btn p-1.5 text-muted hover:text-ink rounded-lg hover:bg-elevated transition-colors"
            aria-label="Fechar modal"
          >
            <X aria-hidden="true" className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

          {/* Formulário para adicionar nova compatibilidade */}
          <form
            onSubmit={handleAdicionar}
            className="p-4 rounded-xl bg-canvas/60 border border-line space-y-3"
          >
            <h3 className="text-xs font-bold text-ink flex items-center gap-2">
              <Plus aria-hidden="true" className="w-4 h-4 text-accent" />
              <span>Vincular Novo Equipamento Compatível</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="field-src-components-CompatibilidadeModal-tsx-1" className="block text-xs font-semibold text-muted mb-1">
                  Filtrar Equipamento
                </label>
                <div className="relative">
                  <input id="field-src-components-CompatibilidadeModal-tsx-1"
                    type="text"
                    value={buscaMaquina}
                    onChange={(e) => setBuscaMaquina(e.target.value)}
                    placeholder="Buscar marca ou modelo..."
                    className="ui-field w-full border placeholder-subtle focus:outline-none focus:border-accent/50"
                  />
                  <Search aria-hidden="true" className="w-4 h-4 text-subtle absolute right-2.5 top-2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label htmlFor="field-src-components-CompatibilidadeModal-tsx-2" className="block text-xs font-semibold text-muted mb-1">
                  Selecionar Equipamento *
                </label>
                <select id="field-src-components-CompatibilidadeModal-tsx-2"
                  value={maquinaSelecionadaId}
                  onChange={(e) => setMaquinaSelecionadaId(e.target.value ? Number(e.target.value) : '')}
                  className="ui-field w-full border focus:outline-none focus:border-accent/50"
                  required
                >
                  <option value="">Selecione o equipamento...</option>
                  {maquinasDisponiveis.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.tipoEquipamentoDescricao}] {m.marca} {m.modelo}{' '}
                      {m.numeroSerie ? `(S/N: ${m.numeroSerie})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="field-src-components-CompatibilidadeModal-tsx-3" className="block text-xs font-semibold text-muted mb-1">
                Observações Técnicas / Aplicação
              </label>
              <input id="field-src-components-CompatibilidadeModal-tsx-3"
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Utilizar com pasta térmica de alta condutividade; placa de potência rev 2.1"
                className="ui-field w-full border placeholder-subtle focus:outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={adding || !maquinaSelecionadaId}
                className="ui-btn ui-btn-primary transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {adding ? (
                  <>
                    <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />
                    <span>Vinculando...</span>
                  </>
                ) : (
                  <>
                    <Plus aria-hidden="true" className="w-4 h-4" />
                    <span>Adicionar Vínculo</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Lista de equipamentos compatíveis */}
          <div>
            <h3 className="text-xs font-bold text-ink mb-3">
              Equipamentos Compatíveis Cadastrados ({compatibilidades.length})
            </h3>

            {loading ? (
              <div className="py-8 flex justify-center text-muted">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
              </div>
            ) : compatibilidades.length === 0 ? (
              <div className="p-6 rounded-xl bg-canvas/40 border border-dashed border-line text-center">
                <Wrench className="w-8 h-8 text-subtle mx-auto mb-2" />
                <p className="text-xs text-muted">
                  Nenhum equipamento vinculado a esta peça ainda.
                </p>
                <p className="text-xs text-subtle mt-1">
                  Vincule máquinas de solda ou geradores para facilitar a seleção de peças nas Ordens de Serviço.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {compatibilidades.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-canvas/80 border border-line flex items-center justify-between gap-3 hover:border-control transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-ink">
                          {c.maquinaMarca} {c.maquinaModelo}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-elevated text-ink">
                          {c.maquinaTipoEquipamento}
                        </span>
                        {c.maquinaNumeroSerie && (
                          <span className="text-xs text-subtle">
                            S/N: {c.maquinaNumeroSerie}
                          </span>
                        )}
                      </div>
                      {c.observacaoCompatibilidade && (
                        <p className="text-xs text-muted mt-1">
                          Nota: {c.observacaoCompatibilidade}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemover(c.maquinaId)}
                      className="ui-icon-btn p-1.5 text-subtle hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
                      title="Remover vínculo"
                      aria-label="Remover vínculo"
                    >
                      <Trash2 aria-hidden="true" className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-line bg-surface/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-ink hover:text-ink rounded-xl bg-elevated hover:bg-hover transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
