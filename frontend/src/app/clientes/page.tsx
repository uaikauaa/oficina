'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Plus,
  Building2,
  User,
  Eye,
  Edit2,
  Power,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  Filter,
} from 'lucide-react';
import Header from '@/components/Header';
import ClienteModal from '@/components/ClienteModal';
import ConfirmModal from '@/components/ConfirmModal';
import { Cliente, CurrentUser, PageResponse, TipoPessoa } from '@/lib/types';
import { apiFetch, formatarDocumento, formatarTelefone } from '@/lib/api';

export default function ClientesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Estados da Listagem
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Estados dos Filtros
  const [termoBusca, setTermoBusca] = useState('');
  const [tipoPessoaFiltro, setTipoPessoaFiltro] = useState<TipoPessoa | ''>('');
  const [ativoFiltro, setAtivoFiltro] = useState<string>(''); // '', 'true', 'false'

  // Mensagens de Feedback
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clienteParaEditar, setClienteParaEditar] = useState<Cliente | null>(null);

  const [clienteParaAlterarStatus, setClienteParaAlterarStatus] = useState<Cliente | null>(null);
  const [isConfirmingStatus, setIsConfirmingStatus] = useState(false);

  // Gatilho de recarga apos mutacoes
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  // Carrega Clientes com Filtros e Paginação de forma assíncrona segura
  useEffect(() => {
    let ignore = false;

    async function fetchClientes() {
      try {
        const params = new URLSearchParams();
        params.set('page', page.toString());
        params.set('size', pageSize.toString());
        params.set('sort', 'nomeRazaoSocial,asc');

        if (termoBusca.trim()) {
          params.set('termo', termoBusca.trim());
        }
        if (tipoPessoaFiltro) {
          params.set('tipoPessoa', tipoPessoaFiltro);
        }
        if (ativoFiltro !== '') {
          params.set('ativo', ativoFiltro);
        }

        const res = await apiFetch(`/api/clientes?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Falha ao buscar clientes.');
        }

        const data: PageResponse<Cliente> = await res.json();
        if (!ignore) {
          setClientes(data.content || []);
          setTotalPages(data.totalPages || 0);
          setTotalElements(data.totalElements || 0);
          setIsLoading(false);
        }
      } catch {
        if (!ignore) {
          setToastError('Não foi possível carregar a lista de clientes. Verifique a conexão com o servidor.');
          setIsLoading(false);
        }
      }
    }

    fetchClientes();

    return () => {
      ignore = true;
    };
  }, [page, pageSize, termoBusca, tipoPessoaFiltro, ativoFiltro, refreshTrigger]);

  // Disparo da Busca
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(0);
    setRefreshTrigger((prev) => prev + 1);
  };

  // Alteração de Status (Ativar / Inativar)
  const confirmarAlteracaoStatus = async () => {
    if (!clienteParaAlterarStatus) return;

    setIsConfirmingStatus(true);
    const novoStatus = !clienteParaAlterarStatus.ativo;

    try {
      const res = await apiFetch(`/api/clientes/${clienteParaAlterarStatus.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: novoStatus }),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.message || 'Falha ao alterar status do cliente.');
      }

      setToastSuccess(
        novoStatus
          ? `Cliente "${clienteParaAlterarStatus.nomeRazaoSocial}" ativado com sucesso!`
          : `Cliente "${clienteParaAlterarStatus.nomeRazaoSocial}" inativado com sucesso!`
      );
      setClienteParaAlterarStatus(null);
      setIsLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar alteração de status.';
      setToastError(msg);
    } finally {
      setIsConfirmingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner de Título e Botão de Ação */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <Users className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Gestão Comercial & Técnica</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Clientes</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Cadastro, consulta e histórico de clientes (Pessoa Física e Pessoa Jurídica) da oficina de soldas e geradores
            </p>
          </div>

          <button
            onClick={() => {
              setClienteParaEditar(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        </div>

        {/* Notificações e Feedback */}
        {toastSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toastSuccess}</span>
            </div>
            <button
              onClick={() => setToastSuccess(null)}
              className="text-emerald-400 hover:text-emerald-200 font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {toastError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{toastError}</span>
            </div>
            <button
              onClick={() => setToastError(null)}
              className="text-red-400 hover:text-red-200 font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {/* Barra de Filtros e Pesquisa */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Campo de Pesquisa Geral */}
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                placeholder="Pesquisar por Nome, Razão Social, Fantasia, CPF, CNPJ, Telefone ou ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Filtro de Tipo de Pessoa */}
            <div className="md:col-span-2">
              <select
                value={tipoPessoaFiltro}
                onChange={(e) => {
                  setTipoPessoaFiltro(e.target.value as TipoPessoa | '');
                  setPage(0);
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">Todos os Tipos</option>
                <option value="FISICA">Pessoa Física (PF)</option>
                <option value="JURIDICA">Pessoa Jurídica (PJ)</option>
              </select>
            </div>

            {/* Filtro de Status */}
            <div className="md:col-span-2">
              <select
                value={ativoFiltro}
                onChange={(e) => {
                  setAtivoFiltro(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">Todos os Status</option>
                <option value="true">Apenas Ativos</option>
                <option value="false">Apenas Inativos</option>
              </select>
            </div>

            {/* Botão de Buscar */}
            <div className="md:col-span-2 flex items-center gap-2">
              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtrar</span>
              </button>
            </div>
          </form>
        </div>

        {/* Tabela de Clientes */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Nome / Razão Social</th>
                  <th className="py-3 px-4">CPF / CNPJ</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Cidade / UF</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando clientes...</span>
                      </div>
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <p className="text-sm font-medium text-slate-300">Nenhum cliente encontrado</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Tente ajustar os filtros de busca ou cadastre um novo cliente.
                      </p>
                    </td>
                  </tr>
                ) : (
                  clientes.map((cli) => {
                    const enderecoPrincipal = cli.enderecos?.[0];
                    return (
                      <tr
                        key={cli.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Tipo */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {cli.tipoPessoa === 'JURIDICA' ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                              <Building2 className="w-3.5 h-3.5" />
                              <span>PJ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <User className="w-3.5 h-3.5" />
                              <span>PF</span>
                            </span>
                          )}
                        </td>

                        {/* Nome / Razão Social */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                            <Link href={`/clientes/${cli.id}`}>
                              {cli.nomeRazaoSocial}
                            </Link>
                          </div>
                          {cli.nomeFantasia && (
                            <div className="text-[11px] text-slate-400">{cli.nomeFantasia}</div>
                          )}
                        </td>

                        {/* Documento */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {formatarDocumento(cli.cpfCnpj)}
                        </td>

                        {/* Contato */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-slate-300">
                            <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                            <span>{formatarTelefone(cli.celular || cli.telefone)}</span>
                          </div>
                          {cli.email && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[160px]">{cli.email}</span>
                            </div>
                          )}
                        </td>

                        {/* Endereço */}
                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                          {enderecoPrincipal ? (
                            <span>
                              {enderecoPrincipal.cidade} / {enderecoPrincipal.estado}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {cli.ativo ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              Inativo
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Visualizar */}
                            <Link
                              href={`/clientes/${cli.id}`}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-400 transition-colors"
                              title="Visualizar detalhes do cliente"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>

                            {/* Editar */}
                            <button
                              onClick={() => {
                                setClienteParaEditar(cli);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-500/20 hover:text-blue-400 text-slate-400 transition-colors cursor-pointer"
                              title="Editar cliente"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Inativar / Ativar */}
                            <button
                              onClick={() => setClienteParaAlterarStatus(cli)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                cli.ativo
                                  ? 'bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400'
                                  : 'bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-400'
                              }`}
                              title={cli.ativo ? 'Inativar cliente' : 'Ativar cliente'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé da Tabela com Paginação */}
          <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Total de <span className="text-white font-semibold">{totalElements}</span> clientes encontrados
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 0 || isLoading}
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <span className="px-2">
                Página <span className="text-white font-medium">{totalPages === 0 ? 0 : page + 1}</span> de{' '}
                <span className="text-white font-medium">{totalPages === 0 ? 1 : totalPages}</span>
              </span>

              <button
                disabled={page + 1 >= totalPages || isLoading}
                onClick={() => setPage((prev) => prev + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Cadastro / Edição */}
      <ClienteModal
        isOpen={isModalOpen}
        cliente={clienteParaEditar}
        onClose={() => {
          setIsModalOpen(false);
          setClienteParaEditar(null);
        }}
        onSuccess={(salvo) => {
          setToastSuccess(
            clienteParaEditar
              ? `Cliente "${salvo.nomeRazaoSocial}" atualizado com sucesso!`
              : `Cliente "${salvo.nomeRazaoSocial}" cadastrado com sucesso!`
          );
          setIsLoading(true);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* Modal de Confirmação de Ação Destrutiva (Inativação / Ativação) */}
      <ConfirmModal
        isOpen={!!clienteParaAlterarStatus}
        title={
          clienteParaAlterarStatus?.ativo
            ? 'Inativar Cliente?'
            : 'Reativar Cliente?'
        }
        message={
          clienteParaAlterarStatus?.ativo
            ? `Tem certeza que deseja inativar o cliente "${clienteParaAlterarStatus?.nomeRazaoSocial}"? Ele não aparecerá como ativo para novas ordens de serviço até ser reativado.`
            : `Deseja reativar o cliente "${clienteParaAlterarStatus?.nomeRazaoSocial}" no sistema?`
        }
        confirmText={clienteParaAlterarStatus?.ativo ? 'Sim, Inativar' : 'Sim, Ativar'}
        isDestructive={clienteParaAlterarStatus?.ativo}
        isLoading={isConfirmingStatus}
        onConfirm={confirmarAlteracaoStatus}
        onCancel={() => setClienteParaAlterarStatus(null)}
      />
    </div>
  );
}
