'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
import { apiFetch, apiFetchJson } from '@/lib/api';

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
  }, [isOpen, produto, carregarCompatibilidades, carregarMaquinas]);

  const handleAdicionar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produto || !maquinaSelecionadaId) return;

    setAdding(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await apiFetch(`/api/produtos/${produto.id}/compatibilidades`, {
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
    try {
      await apiFetch(`/api/produtos/${produto.id}/compatibilidades/${maquinaId}`, {
        method: 'DELETE',
      });
      setSuccessMsg('Vínculo removido!');
      carregarCompatibilidades();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover vínculo';
      setError(msg);
    }
  };

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Compatibilidade Técnica de Equipamentos</h2>
              <p className="text-xs text-slate-400">
                Peça: <span className="text-amber-400 font-semibold">{produto.codigo}</span> - {produto.nome}
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

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

          {/* Formulário para adicionar nova compatibilidade */}
          <form
            onSubmit={handleAdicionar}
            className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
          >
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Vincular Novo Equipamento Compatível</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Filtrar Equipamento
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={buscaMaquina}
                    onChange={(e) => setBuscaMaquina(e.target.value)}
                    placeholder="Buscar marca ou modelo..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Selecionar Equipamento *
                </label>
                <select
                  value={maquinaSelecionadaId}
                  onChange={(e) => setMaquinaSelecionadaId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
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
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Observações Técnicas / Aplicação
              </label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Utilizar com pasta térmica de alta condutividade; placa de potência rev 2.1"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={adding || !maquinaSelecionadaId}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {adding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Vinculando...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Vínculo</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Lista de equipamentos compatíveis */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 mb-3">
              Equipamentos Compatíveis Cadastrados ({compatibilidades.length})
            </h3>

            {loading ? (
              <div className="py-8 flex justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : compatibilidades.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-center">
                <Wrench className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  Nenhum equipamento vinculado a esta peça ainda.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Vincule máquinas de solda ou geradores para facilitar a seleção de peças nas Ordens de Serviço.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {compatibilidades.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {c.maquinaMarca} {c.maquinaModelo}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                          {c.maquinaTipoEquipamento}
                        </span>
                        {c.maquinaNumeroSerie && (
                          <span className="text-[11px] text-slate-500">
                            S/N: {c.maquinaNumeroSerie}
                          </span>
                        )}
                      </div>
                      {c.observacaoCompatibilidade && (
                        <p className="text-xs text-slate-400 mt-1">
                          Nota: {c.observacaoCompatibilidade}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleRemover(c.maquinaId)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Remover vínculo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
