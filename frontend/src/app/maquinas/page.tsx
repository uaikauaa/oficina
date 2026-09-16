'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  Search,
  Filter,
  History,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import Header from '@/components/Header';
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

  // Estados dos filtros
  const [termoBusca, setTermoBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<TipoEquipamento | ''>('');
  const [ativoFiltro, setAtivoFiltro] = useState<string>(''); // '', 'true', 'false'

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
      }
    } catch {
      // Ignora erro
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, termoBusca, tipoFiltro, ativoFiltro]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarMaquinas();
    }, 200);
    return () => clearTimeout(timer);
  }, [carregarMaquinas]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Equipamentos</h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Consulta global de máquinas de solda, geradores e histórico técnico
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
              {totalElements} {totalElements === 1 ? 'equipamento' : 'equipamentos'}
            </span>
          </div>
        </div>

        {/* Filtros de Busca */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-center gap-3">
          {/* Busca por Texto (Marca, Modelo, Nº Série, Cliente) */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por marca, modelo, número de série ou cliente..."
              value={termoBusca}
              onChange={(e) => {
                setTermoBusca(e.target.value);
                setPage(0);
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Filtro por Tipo */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-500 hidden sm:block" />
            <select
              value={tipoFiltro}
              onChange={(e) => {
                setTipoFiltro(e.target.value as TipoEquipamento | '');
                setPage(0);
              }}
              className="w-full md:w-48 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">Todos os Tipos</option>
              <option value="MAQUINA_SOLDA">Máquina de Solda</option>
              <option value="GERADOR_ENERGIA">Gerador de Energia</option>
              <option value="OUTRO">Outro Equipamento</option>
            </select>

            {/* Filtro por Status Ativo */}
            <select
              value={ativoFiltro}
              onChange={(e) => {
                setAtivoFiltro(e.target.value);
                setPage(0);
              }}
              className="w-full md:w-36 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="">Status: Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
        </div>

        {/* Tabela de Equipamentos */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Carregando equipamentos...</span>
            </div>
          ) : maquinas.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Wrench className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">Nenhum equipamento localizado</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Nenhuma máquina corresponde aos filtros ou termos pesquisados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Equipamento</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Nº de Série</th>
                    <th className="py-3 px-4">Cliente Vinculado</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {maquinas.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">
                          {m.marca} {m.modelo}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          {m.potencia && <span>Potência: {m.potencia}</span>}
                          {m.tensao && <span>• Tensão: {m.tensao}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {TIPO_EQUIPAMENTO_LABELS[m.tipoEquipamento] || m.tipoEquipamento}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-300">
                        {m.numeroSerie || <span className="text-slate-500 font-normal italic">S/N</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/clientes/${m.clienteId}`}
                          className="font-medium text-amber-400 hover:underline flex items-center gap-1.5"
                        >
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{m.clienteNome}</span>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
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
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/maquinas/${m.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Histórico</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Página {page + 1} de {totalPages} ({totalElements} registros)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-50 text-slate-200 flex items-center gap-1 cursor-pointer hover:bg-slate-700"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-50 text-slate-200 flex items-center gap-1 cursor-pointer hover:bg-slate-700"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
