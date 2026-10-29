'use client';

import React, { useEffect, useState, useCallback } from 'react';
import DomainIcon from '@/components/ui/DomainIcon';
import Link from 'next/link';
import {
  CheckCircle2,
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
import MaquinaModal from '@/components/MaquinaModal';
import {
  Maquina,
  PageResponse,
  TipoEquipamento,
  TIPO_EQUIPAMENTO_LABELS,
} from '@/lib/types';
import { apiFetch } from '@/lib/api';

export default function MaquinasPage() {
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
    <>
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
              <Wrench aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="ui-page-title">Equipamentos</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-surface border border-line text-xs font-semibold text-ink">
                  {totalElements} {totalElements === 1 ? 'máquina' : 'máquinas'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted mt-0.5">
                Consulta técnica e gestão de máquinas de solda e geradores de energia vinculados a clientes
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsNovoModalOpen(true)}
            className="ui-btn ui-btn-primary sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <Plus aria-hidden="true" className="w-4 h-4" />
            <span>Novo Equipamento</span>
          </button>
        </div>

        {/* Painel Operacional de Busca e Filtros Rápidos */}
        <div className="p-4 rounded-2xl bg-surface/60 border border-line space-y-3.5 shadow-sm">
          {/* Busca por Texto (Marca, Modelo, Nº Série, Cliente) */}
          <div className="relative w-full">
            <Search aria-hidden="true" className="w-4 h-4 text-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input aria-label="Buscar por marca, modelo, número de série ou cliente..."
              type="text"
              placeholder="Buscar por marca, modelo, número de série ou cliente..."
              value={termoBusca}
              onChange={(e) => {
                setTermoBusca(e.target.value);
                setPage(0);
              }}
              className="ui-field w-full pl-10 pr-10 border sm:text-sm placeholder-subtle focus:outline-none focus:border-accent/50"
            />
            {termoBusca && (
              <button
                type="button"
                onClick={() => {
                  setTermoBusca('');
                  setPage(0);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-ink transition-colors cursor-pointer"
                title="Limpar pesquisa"
              >
                <X aria-hidden="true" className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Pills de Filtro Rápido (1 Clique) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-line">
            {/* Tipo de Equipamento */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted mr-1 font-medium hidden sm:inline">Tipo:</span>
              <button
                type="button"
                onClick={() => {
                  setTipoFiltro('');
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  tipoFiltro === ''
                    ? 'bg-accent text-inverse shadow-sm'
                    : 'bg-canvas text-muted hover:text-ink border border-line'
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
                    ? 'bg-accent text-inverse shadow-sm'
                    : 'bg-canvas text-muted hover:text-ink border border-line'
                }`}
              >
                <DomainIcon type="MAQUINA_SOLDA" />
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
                    ? 'bg-accent text-inverse shadow-sm'
                    : 'bg-canvas text-muted hover:text-ink border border-line'
                }`}
              >
                <DomainIcon type="GERADOR_ENERGIA" />
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
                    ? 'bg-accent text-inverse shadow-sm'
                    : 'bg-canvas text-muted hover:text-ink border border-line'
                }`}
              >
                <DomainIcon type="OUTRO_EQUIPAMENTO" />
                <span>Outros</span>
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted mr-1 font-medium hidden sm:inline">Status:</span>
              <button
                type="button"
                onClick={() => {
                  setAtivoFiltro('');
                  setPage(0);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  ativoFiltro === ''
                    ? 'bg-elevated text-ink border border-control'
                    : 'bg-canvas text-muted hover:text-ink border border-line'
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
                    ? 'bg-ink/5 text-ink border border-line'
                    : 'bg-canvas text-muted hover:text-ink border border-line'
                }`}
              >
                <CheckCircle2 aria-hidden="true" className="w-4 h-4" />
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
                    ? 'bg-danger/20 text-danger border border-danger/40'
                    : 'bg-canvas text-muted hover:text-ink border border-line'
                }`}
              >
                <X aria-hidden="true" className="w-4 h-4" />
                <span>Inativos</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mensagem de Erro se houver */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => carregarMaquinas()}
              className="px-3 py-1 rounded-lg bg-danger/20 hover:bg-danger/30 text-danger font-semibold cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Tabela de Equipamentos */}
        <div className="rounded-2xl border border-line bg-surface/60 overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-12 text-center text-subtle text-xs flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span>Carregando equipamentos...</span>
            </div>
          ) : maquinas.length === 0 ? (
            <div className="p-12 text-center text-muted space-y-3">
              <Wrench className="w-8 h-8 mx-auto text-subtle" />
              <div>
                <p className="text-sm font-semibold text-ink">Nenhum equipamento localizado</p>
                <p className="text-xs text-subtle max-w-sm mx-auto mt-0.5">
                  {termoBusca || tipoFiltro || ativoFiltro
                    ? 'Nenhuma máquina corresponde aos filtros ou termos pesquisados.'
                    : 'A oficina ainda não possui máquinas de solda ou geradores cadastrados.'}
                </p>
              </div>
              <button
                onClick={() => setIsNovoModalOpen(true)}
                className="ui-btn ui-btn-primary inline-flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Cadastrar Primeiro Equipamento</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ui-table">
                <thead>
                  <tr className="border-b border-line bg-surface/80 text-muted font-semibold text-xs">
                    <th className="py-2.5 px-3.5">Equipamento</th>
                    <th className="py-2.5 px-3.5">Tipo</th>
                    <th className="py-2.5 px-3.5">Nº de Série</th>
                    <th className="py-2.5 px-3.5">Cliente Proprietário</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 text-ink">
                  {maquinas.map((m) => (
                    <tr key={m.id} className="hover:bg-elevated/40 transition-colors">
                      {/* Equipamento */}
                      <td className="py-2.5 px-3.5">
                        <Link href={`/maquinas/${m.id}`} className="block group">
                          <div className="font-bold text-ink text-xs sm:text-sm group-hover:text-accent transition-colors">
                            {m.marca} {m.modelo}
                          </div>
                          <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
                            {m.potencia && <span>{m.potencia}</span>}
                            {m.tensao && <span>• {m.tensao}</span>}
                            {m.horimetro != null && <span>• {m.horimetro}h</span>}
                          </div>
                        </Link>
                      </td>

                      {/* Tipo */}
                      <td className="py-2.5 px-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-accent/10 text-accent border border-accent/20">
                          <DomainIcon type={m.tipoEquipamento} className="inline-block w-4 h-4 mr-1.5 align-text-bottom" />
                          {TIPO_EQUIPAMENTO_LABELS[m.tipoEquipamento] || m.tipoEquipamento}
                        </span>
                      </td>

                      {/* Número de Série */}
                      <td className="py-2.5 px-3.5 font-mono font-bold text-ink">
                        {m.numeroSerie || <span className="text-subtle font-normal italic">S/N</span>}
                      </td>

                      {/* Cliente Vinculado */}
                      <td className="py-2.5 px-3.5">
                        <Link
                          href={`/clientes/${m.clienteId}`}
                          className="font-medium text-ink hover:text-accent flex items-center gap-1.5 transition-colors group"
                        >
                          <User aria-hidden="true" className="w-3.5 h-3.5 text-muted group-hover:text-accent shrink-0" />
                          <span className="truncate max-w-[200px]">{m.clienteNome}</span>
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            m.ativo
                              ? 'bg-ink/5 text-ink border border-line'
                              : 'bg-danger/10 text-danger border border-danger/30'
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
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-elevated hover:bg-hover text-ink text-xs font-semibold border border-control transition-colors cursor-pointer"
                            title="Ver detalhes e histórico do equipamento"
                          >
                            <Eye aria-hidden="true" className="w-3.5 h-3.5 text-muted" />
                            <span className="hidden sm:inline">Ver</span>
                          </Link>

                          {/* Botão + OS (desabilitado se inativo) */}
                          {m.ativo ? (
                            <Link
                              href={`/ordens-servico/nova?clienteId=${m.clienteId}&maquinaId=${m.id}`}
                              className="ui-btn ui-btn-primary inline-flex items-center gap-1 transition-all cursor-pointer"
                              title={`Abrir nova OS para ${m.marca} ${m.modelo}`}
                            >
                              <Plus aria-hidden="true" className="w-3.5 h-3.5" />
                              <span>OS</span>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="ui-icon-btn inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-elevated/50 text-subtle text-xs font-semibold border border-line cursor-not-allowed opacity-50"
                              title="Equipamento inativo. Reative o equipamento para abrir nova Ordem de Serviço."
                            >
                              <Plus aria-hidden="true" className="w-3.5 h-3.5" />
                              <span>OS</span>
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
          <div className="p-3.5 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted bg-surface/40">
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
                className="ui-icon-btn px-3 py-1.5 rounded-lg bg-elevated border border-control disabled:opacity-40 text-ink flex items-center gap-1 cursor-pointer hover:bg-hover disabled:cursor-not-allowed transition-colors"
                aria-label="Página anterior"
              >
                <ChevronLeft aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <span className="px-2 font-medium text-ink">
                Página {totalPages > 0 ? page + 1 : 1} de {Math.max(1, totalPages)}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || totalPages <= 1 || isLoading}
                className="ui-icon-btn px-3 py-1.5 rounded-lg bg-elevated border border-control disabled:opacity-40 text-ink flex items-center gap-1 cursor-pointer hover:bg-hover disabled:cursor-not-allowed transition-colors"
                aria-label="Próxima página"
              >
                <span>Próxima</span>
                <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />
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
    </>
  );
}
