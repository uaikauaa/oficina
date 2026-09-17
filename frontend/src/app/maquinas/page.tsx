'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Plus,
  X,
  Eye,
  AlertCircle,
} from 'lucide-react';
import Header from '@/components/Header';
import MaquinaModal from '@/components/MaquinaModal';
import {
  CurrentUser,
  Maquina,
  PageResponse,
  TipoEquipamento,
  TIPO_EQUIPAMENTO_LABELS,
} from '@/lib/types';
import { apiFetch } from '@/lib/api';

export default function MaquinasPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Estados da listagem
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados dos filtros
  const [termoBusca, setTermoBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<TipoEquipamento | ''>('');
  const [ativoFiltro, setAtivoFiltro] = useState<string>(''); // '', 'true', 'false'

  // Modal de Cadastro
  const [isNovoModalOpen, setIsNovoModalOpen] = useState(false);

  // Carrega Usuário da Sessão
  useEffect(() => {
    let ignore = false;
    async function loadUser() {
      try {
        const res = await apiFetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (!ignore) {
          setCurrentUser(data);
        }
      } catch {
        router.push('/login');
      }
    }
    loadUser();
    return () => {
      ignore = true;
    };
  }, [router]);

  // Carrega Equipamentos
  const carregarMaquinas = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('size', pageSize.toString());
      params.set('sort', 'marca,asc');

      if (termoBusca.trim()) {
        params.set('termo', termoBusca.trim());
      }
      if (tipoFiltro) {
        params.set('tipoEquipamento', tipoFiltro);
      }
      if (ativoFiltro !== '') {
        params.set('ativo', ativoFiltro);
      }

      const res = await apiFetch(`/api/maquinas?${params.toString()}`);
      if (res.ok) {
        const data: PageResponse<Maquina> = await res.json();
        setMaquinas(data.content || []);
        setTotalPages(data.totalPages || 0);
        setTotalElements(data.totalElements || 0);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.message || 'Erro ao carregar lista de equipamentos.');
      }
    } catch {
      setErrorMessage('Falha na comunicação com o servidor. Verifique sua conexão.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, termoBusca, tipoFiltro, ativoFiltro]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarMaquinas();
    }, 300);
    return () => clearTimeout(timer);
  }, [carregarMaquinas]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-white">Equipamentos</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
                  {totalElements} {totalElements === 1 ? 'máquina' : 'máquinas'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Consulta técnica e gestão de máquinas de solda e geradores de energia vinculados a clientes
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsNovoModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Equipamento</span>
          </button>
        </div>

        {/* Painel Operacional de Busca e Filtros Rápidos */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3.5 shadow-sm">
          {/* Busca por Texto (Marca, Modelo, Nº Série, Cliente) */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por marca, modelo, número de série ou cliente..."
              value={termoBusca}
              onChange={(e) => {
                setTermoBusca(e.target.value);
                setPage(0);
              }}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
            {termoBusca && (
              <button
                type="button"
                onClick={() => {
                  setTermoBusca('');
                  setPage(0);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
                title="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Pills de Filtro Rápido (1 Clique) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
            {/* Tipo de Equipamento */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 mr-1 font-medium hidden sm:inline">Tipo:</span>
              <button
                type="button"
                onClick={() => {
                  setTipoFiltro('');
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  tipoFiltro === ''
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos os Tipos
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoFiltro('MAQUINA_SOLDA');
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  tipoFiltro === 'MAQUINA_SOLDA'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>⚡</span>
                <span>Soldas</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoFiltro('GERADOR_ENERGIA');
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  tipoFiltro === 'GERADOR_ENERGIA'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>🔋</span>
                <span>Geradores</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoFiltro('OUTRO_EQUIPAMENTO');
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  tipoFiltro === 'OUTRO_EQUIPAMENTO'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>🔧</span>
                <span>Outros</span>
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 mr-1 font-medium hidden sm:inline">Status:</span>
              <button
                type="button"
                onClick={() => {
                  setAtivoFiltro('');
                  setPage(0);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  ativoFiltro === ''
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => {
                  setAtivoFiltro(ativoFiltro === 'true' ? '' : 'true');
                  setPage(0);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  ativoFiltro === 'true'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>✓</span>
                <span>Ativos</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAtivoFiltro(ativoFiltro === 'false' ? '' : 'false');
                  setPage(0);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  ativoFiltro === 'false'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>✕</span>
                <span>Inativos</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mensagem de Erro se houver */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => carregarMaquinas()}
              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Tabela de Equipamentos */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Carregando equipamentos...</span>
            </div>
          ) : maquinas.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <Wrench className="w-8 h-8 mx-auto text-slate-600" />
              <div>
                <p className="text-sm font-semibold text-white">Nenhum equipamento localizado</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                  {termoBusca || tipoFiltro || ativoFiltro
                    ? 'Nenhuma máquina corresponde aos filtros ou termos pesquisados.'
                    : 'A oficina ainda não possui máquinas de solda ou geradores cadastrados.'}
                </p>
              </div>
              <button
                onClick={() => setIsNovoModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar Primeiro Equipamento</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3.5">Equipamento</th>
                    <th className="py-2.5 px-3.5">Tipo</th>
                    <th className="py-2.5 px-3.5">Nº de Série</th>
                    <th className="py-2.5 px-3.5">Cliente Proprietário</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {maquinas.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Equipamento */}
                      <td className="py-2.5 px-3.5">
                        <Link href={`/maquinas/${m.id}`} className="block group">
                          <div className="font-bold text-white text-xs sm:text-sm group-hover:text-amber-400 transition-colors">
                            {m.marca} {m.modelo}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {m.potencia && <span>{m.potencia}</span>}
                            {m.tensao && <span>• {m.tensao}</span>}
                            {m.horimetro != null && <span>• {m.horimetro}h</span>}
                          </div>
                        </Link>
                      </td>

                      {/* Tipo */}
                      <td className="py-2.5 px-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {m.tipoEquipamento === 'MAQUINA_SOLDA' && '⚡ '}
                          {m.tipoEquipamento === 'GERADOR_ENERGIA' && '🔋 '}
                          {m.tipoEquipamento === 'OUTRO_EQUIPAMENTO' && '🔧 '}
                          {TIPO_EQUIPAMENTO_LABELS[m.tipoEquipamento] || m.tipoEquipamento}
                        </span>
                      </td>

                      {/* Número de Série */}
                      <td className="py-2.5 px-3.5 font-mono font-bold text-slate-300">
                        {m.numeroSerie || <span className="text-slate-500 font-normal italic">S/N</span>}
                      </td>

                      {/* Cliente Vinculado */}
                      <td className="py-2.5 px-3.5">
                        <Link
                          href={`/clientes/${m.clienteId}`}
                          className="font-medium text-slate-200 hover:text-amber-400 flex items-center gap-1.5 transition-colors group"
                        >
                          <User className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400 shrink-0" />
                          <span className="truncate max-w-[200px]">{m.clienteNome}</span>
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.ativo
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {m.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Ver Detalhes / Histórico */}
                          <Link
                            href={`/maquinas/${m.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                            title="Ver detalhes e histórico do equipamento"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span className="hidden sm:inline">Ver</span>
                          </Link>

                          {/* Botão + OS (desabilitado se inativo) */}
                          {m.ativo ? (
                            <Link
                              href={`/ordens-servico/nova?clienteId=${m.clienteId}&maquinaId=${m.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer"
                              title={`Abrir nova OS para ${m.marca} ${m.modelo}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ OS</span>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/50 text-slate-500 text-xs font-semibold border border-slate-800/60 cursor-not-allowed opacity-50"
                              title="Equipamento inativo. Reative o equipamento para abrir nova Ordem de Serviço."
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ OS</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          <div className="p-3.5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 bg-slate-900/40">
            <span>
              {totalElements > 0 ? (
                <>
                  Exibindo {page * pageSize + 1} a {Math.min((page + 1) * pageSize, totalElements)} de {totalElements} equipamentos
                </>
              ) : (
                '0 equipamentos'
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-40 text-slate-200 flex items-center gap-1 cursor-pointer hover:bg-slate-700 disabled:cursor-not-allowed transition-colors"
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <span className="px-2 font-medium text-slate-300">
                Página {totalPages > 0 ? page + 1 : 1} de {Math.max(1, totalPages)}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || totalPages <= 1 || isLoading}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-40 text-slate-200 flex items-center gap-1 cursor-pointer hover:bg-slate-700 disabled:cursor-not-allowed transition-colors"
                aria-label="Próxima página"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Novo Equipamento */}
      <MaquinaModal
        isOpen={isNovoModalOpen}
        onClose={() => setIsNovoModalOpen(false)}
        onSuccess={() => {
          setIsNovoModalOpen(false);
          carregarMaquinas();
        }}
      />
    </div>
  );
}
