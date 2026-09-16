'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  User,
  MapPin,
  Phone,
  Edit2,
  Power,
  Wrench,
  Calendar,
  CheckCircle2,
  FileText,
  Clock,
  ShieldAlert,
  Plus,
  Zap,
  Hash,
  Gauge,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import Header from '@/components/Header';
import ClienteModal from '@/components/ClienteModal';
import ConfirmModal from '@/components/ConfirmModal';
import MaquinaModal from '@/components/MaquinaModal';
import {
  Cliente,
  CurrentUser,
  Maquina,
  OrdemServico,
  STATUS_ORDEM_SERVICO_BADGES,
  TIPO_EQUIPAMENTO_LABELS,
} from '@/lib/types';
import {
  apiFetch,
  formatarDocumento,
  formatarTelefone,
  formatarCep,
  formatarMoeda,
  formatarDataHora,
} from '@/lib/api';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClienteDetalhesPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const clienteId = resolvedParams.id;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Estado de equipamentos
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [maquinasLoading, setMaquinasLoading] = useState(false);
  const [maquinasError, setMaquinasError] = useState<string | null>(null);

  // Estado de Ordens de Serviço do Cliente
  const [ordensCliente, setOrdensCliente] = useState<OrdemServico[]>([]);
  const [ordensLoading, setOrdensLoading] = useState(false);

  // Modais
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Modal de equipamentos
  const [isMaquinaModalOpen, setIsMaquinaModalOpen] = useState(false);
  const [editingMaquina, setEditingMaquina] = useState<Maquina | null>(null);

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

  // Carrega Dados do Cliente de forma assíncrona segura
  useEffect(() => {
    let ignore = false;

    async function fetchCliente() {
      try {
        const res = await apiFetch(`/api/clientes/${clienteId}`);
        if (!res.ok) {
          if (!ignore) {
            if (res.status === 404) {
              setErrorMessage('Cliente não encontrado no sistema.');
            } else {
              setErrorMessage('Erro ao carregar dados do cliente.');
            }
            setIsLoading(false);
          }
          return;
        }
        const data: Cliente = await res.json();
        if (!ignore) {
          setCliente(data);
          setIsLoading(false);
        }
      } catch {
        if (!ignore) {
          setErrorMessage('Falha ao conectar ao servidor backend.');
          setIsLoading(false);
        }
      }
    }

    fetchCliente();

    return () => {
      ignore = true;
    };
  }, [clienteId, refreshTrigger]);

  // Carrega equipamentos do cliente
  const fetchMaquinas = useCallback(async () => {
    setMaquinasLoading(true);
    setMaquinasError(null);
    try {
      const res = await apiFetch(`/api/clientes/${clienteId}/maquinas?size=50&sort=marca,asc`);
      if (!res.ok) {
        throw new Error('Erro ao carregar equipamentos.');
      }
      const data = await res.json();
      setMaquinas(data.content ?? []);
    } catch {
      setMaquinasError('Não foi possível carregar os equipamentos.');
    } finally {
      setMaquinasLoading(false);
    }
  }, [clienteId]);

  const fetchOrdensCliente = useCallback(async () => {
    setOrdensLoading(true);
    try {
      const res = await apiFetch(`/api/clientes/${clienteId}/ordens-servico?size=50`);
      if (res.ok) {
        const data = await res.json();
        setOrdensCliente(data.content ?? []);
      }
    } catch {
      // Ignora erro
    } finally {
      setOrdensLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (clienteId) {
        fetchMaquinas();
        fetchOrdensCliente();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [clienteId, fetchMaquinas, fetchOrdensCliente]);

  const handleAlterarStatusMaquina = async (maquina: Maquina) => {
    const novoStatus = !maquina.ativo;
    try {
      const res = await apiFetch(`/api/maquinas/${maquina.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: novoStatus }),
      });
      if (!res.ok) throw new Error('Falha ao alterar status do equipamento.');
      setSuccessMessage(
        novoStatus
          ? `Equipamento "${maquina.marca} ${maquina.modelo}" reativado.`
          : `Equipamento "${maquina.marca} ${maquina.modelo}" inativado.`
      );
      fetchMaquinas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar status.';
      setErrorMessage(msg);
    }
  };

  // Alterar Status
  const handleAlterarStatus = async () => {
    if (!cliente) return;
    setIsChangingStatus(true);
    const novoStatus = !cliente.ativo;

    try {
      const res = await apiFetch(`/api/clientes/${cliente.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: novoStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Falha ao alterar status.');
      }

      setSuccessMessage(
        novoStatus
          ? 'Cliente reativado com sucesso!'
          : 'Cliente inativado com sucesso!'
      );
      setIsConfirmModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar status.';
      setErrorMessage(msg);
    } finally {
      setIsChangingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Header user={currentUser} />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Carregando dados do cliente...</span>
          </div>
        </main>
      </div>
    );
  }

  if (errorMessage || !cliente) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Header user={currentUser} />
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col items-center justify-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{errorMessage || 'Cliente não localizado'}</h2>
          <p className="text-xs text-slate-400 max-w-md mb-6">
            O registro solicitado pode ter sido removido ou o identificador informado está incorreto.
          </p>
          <Link
            href="/clientes"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Lista de Clientes</span>
          </Link>
        </main>
      </div>
    );
  }

  const enderecoPrincipal = cliente.enderecos?.[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navegação Superior */}
        <div className="flex items-center justify-between">
          <Link
            href="/clientes"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Clientes</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-blue-500/20 hover:text-blue-400 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 hover:border-blue-500/30 transition-all cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>

            <button
              onClick={() => setIsConfirmModalOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                cliente.ativo
                  ? 'bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 border-slate-700 hover:border-red-500/30'
                  : 'bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-300 border-slate-700 hover:border-emerald-500/30'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{cliente.ativo ? 'Inativar' : 'Reativar'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 font-bold ml-4">
              ×
            </button>
          </div>
        )}

        {/* Card Principal de Identificação */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/90 border border-slate-800 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                {cliente.tipoPessoa === 'JURIDICA' ? <Building2 className="w-7 h-7" /> : <User className="w-7 h-7" />}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-white">{cliente.nomeRazaoSocial}</h1>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      cliente.ativo
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {cliente.ativo ? 'Cliente Ativo' : 'Cliente Inativo'}
                  </span>
                </div>

                {cliente.nomeFantasia && (
                  <p className="text-xs text-slate-400 mt-1">Nome Fantasia: {cliente.nomeFantasia}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-mono">
                    <span className="text-slate-500">{cliente.tipoPessoa === 'JURIDICA' ? 'CNPJ:' : 'CPF:'}</span>
                    <strong className="text-slate-200">{formatarDocumento(cliente.cpfCnpj)}</strong>
                  </span>

                  {cliente.rgIe && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-slate-500">{cliente.tipoPessoa === 'JURIDICA' ? 'IE:' : 'RG:'}</span>
                      <strong className="text-slate-200">{cliente.rgIe}</strong>
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>ID #{cliente.id}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:items-end justify-center border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-6 text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Cadastrado em: {new Date(cliente.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Atualizado em: {new Date(cliente.updatedAt).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        </div>

        {/* Grade de Detalhes: Contatos e Endereço */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card de Contatos */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>Contatos & Comunicação</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400">Telefone Fixo:</span>
                <span className="text-slate-200 font-medium">{formatarTelefone(cliente.telefone)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400">Celular / WhatsApp:</span>
                <span className="text-slate-200 font-medium">{formatarTelefone(cliente.celular)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400">E-mail:</span>
                <span className="text-slate-200 font-medium">{cliente.email || '-'}</span>
              </div>
            </div>
          </div>

          {/* Card de Endereço */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>Endereço Principal</span>
            </h2>

            {enderecoPrincipal ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Logradouro / Número:</span>
                  <span className="text-slate-200 font-medium">
                    {enderecoPrincipal.logradouro}, {enderecoPrincipal.numero}
                  </span>
                </div>
                {enderecoPrincipal.complemento && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                    <span className="text-slate-400">Complemento:</span>
                    <span className="text-slate-200 font-medium">{enderecoPrincipal.complemento}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Bairro:</span>
                  <span className="text-slate-200 font-medium">{enderecoPrincipal.bairro}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Cidade / UF:</span>
                  <span className="text-slate-200 font-medium">
                    {enderecoPrincipal.cidade} / {enderecoPrincipal.estado}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">CEP:</span>
                  <span className="text-slate-200 font-medium">{formatarCep(enderecoPrincipal.cep)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4">Nenhum endereço cadastrado para este cliente.</p>
            )}
          </div>
        </div>

        {/* Observações */}
        {cliente.observacoes && (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Observações Técnicas / Comerciais</span>
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{cliente.observacoes}</p>
          </div>
        )}

        {/* Seção de Equipamentos */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Máquinas &amp; Equipamentos Vinculados</h2>
              {maquinas.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  {maquinas.length}
                </span>
              )}
            </div>
            <button
              onClick={() => { setEditingMaquina(null); setIsMaquinaModalOpen(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Equipamento</span>
            </button>
          </div>

          {/* Estado de carregamento */}
          {maquinasLoading && (
            <div className="flex items-center gap-3 py-6 justify-center text-slate-400 text-xs">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Carregando equipamentos...</span>
            </div>
          )}

          {/* Erro */}
          {!maquinasLoading && maquinasError && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{maquinasError}</span>
            </div>
          )}

          {/* Lista de equipamentos */}
          {!maquinasLoading && !maquinasError && maquinas.length === 0 && (
            <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Nenhum equipamento cadastrado</p>
                <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1 leading-relaxed">
                  Clique em &quot;Novo Equipamento&quot; para registrar uma máquina de solda ou gerador de energia deste cliente.
                </p>
              </div>
            </div>
          )}

          {!maquinasLoading && !maquinasError && maquinas.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {maquinas.map((maq) => (
                <div
                  key={maq.id}
                  className={`p-4 rounded-xl border transition-colors ${
                    maq.ativo
                      ? 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/30 border-slate-800/50 opacity-60'
                  }`}
                >
                  {/* Header do card */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">
                          {maq.marca} — {maq.modelo}
                        </p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 mt-0.5">
                          {TIPO_EQUIPAMENTO_LABELS[maq.tipoEquipamento]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          maq.ativo
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                        }`}
                      >
                        {maq.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes técnicos */}
                  <div className="space-y-1 text-[11px]">
                    {maq.numeroSerie && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Hash className="w-3 h-3 text-slate-500" />
                        <span>N/S: <span className="text-slate-200 font-mono">{maq.numeroSerie}</span></span>
                      </div>
                    )}
                    {maq.anoFabricacao && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>Fabricação: <span className="text-slate-200">{maq.anoFabricacao}</span></span>
                      </div>
                    )}
                    {(maq.potencia || maq.tensao) && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Zap className="w-3 h-3 text-slate-500" />
                        <span>
                          {[maq.potencia, maq.tensao].filter(Boolean).join(' / ')}
                        </span>
                      </div>
                    )}
                    {maq.horimetro != null && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Gauge className="w-3 h-3 text-slate-500" />
                        <span>Horímetro: <span className="text-slate-200">{maq.horimetro}h</span></span>
                      </div>
                    )}
                  </div>

                  {/* Ações do card */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/60">
                    <Link
                      href={`/ordens-servico/nova?clienteId=${cliente.id}&maquinaId=${maq.id}`}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[11px] font-bold flex items-center justify-center gap-1 border border-amber-500/30 transition-all cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Abrir OS</span>
                    </Link>
                    <Link
                      href={`/maquinas/${maq.id}`}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1 border border-slate-700 transition-all cursor-pointer"
                    >
                      <span>Histórico</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={() => { setEditingMaquina(maq); setIsMaquinaModalOpen(true); }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-blue-500/20 hover:text-blue-400 text-slate-400 text-[11px] font-semibold flex items-center justify-center gap-1 border border-slate-700 hover:border-blue-500/30 transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => handleAlterarStatusMaquina(maq)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                        maq.ativo
                          ? 'bg-slate-800/80 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border-slate-700 hover:border-red-500/30'
                          : 'bg-slate-800/80 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-400 border-slate-700 hover:border-emerald-500/30'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      <span>{maq.ativo ? 'Inativar' : 'Reativar'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO: HISTÓRICO DE ORDENS DE SERVIÇO DO CLIENTE (FASE 5)                 */}
        {/* ========================================================================= */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                  Histórico Operacional
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {ordensCliente.length} {ordensCliente.length === 1 ? 'OS registrada' : 'OS registradas'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <span>Ordens de Serviço do Cliente</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Histórico completo de atendimentos, manutenções e faturamentos vinculados a este cliente.
              </p>
            </div>

            <Link
              href={`/ordens-servico/nova?clienteId=${cliente.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/10 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Ordem de Serviço</span>
            </Link>
          </div>

          {ordensLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-xs text-slate-400">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Carregando histórico de ordens de serviço...</span>
            </div>
          ) : ordensCliente.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
              <FileText className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-medium text-white">Nenhuma Ordem de Serviço aberta para este cliente</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Quando este cliente levar um equipamento para manutenção ou conserto, a OS aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Nº da OS</th>
                    <th className="py-2.5 px-3">Equipamento</th>
                    <th className="py-2.5 px-3">Data Entrada</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Valor Total</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {ordensCliente.map((os) => {
                    const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                      bg: 'bg-slate-800',
                      text: 'text-slate-300',
                      border: 'border-slate-700',
                    };

                    return (
                      <tr key={os.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-xs">
                            {os.numeroOs}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-white">
                            {os.maquinaMarca} {os.maquinaModelo}
                          </div>
                          {os.maquinaNumeroSerie && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Série: {os.maquinaNumeroSerie}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                          {formatarDataHora(os.dataEntrada)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {os.statusDescricao}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-200">
                          {formatarMoeda(os.valorTotal)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Link
                            href={`/ordens-servico/${os.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-300 text-xs font-semibold border border-slate-700 transition-all"
                          >
                            <span>Ver OS</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Edição do Cliente */}
      <ClienteModal
        isOpen={isEditModalOpen}
        cliente={cliente}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(salvo) => {
          setSuccessMessage(`Cliente "${salvo.nomeRazaoSocial}" atualizado com sucesso!`);
          setCliente(salvo);
        }}
      />

      {/* Modal de Equipamento (Cadastro e Edição) */}
      {cliente && (
        <MaquinaModal
          isOpen={isMaquinaModalOpen}
          clienteId={cliente.id}
          clienteNome={cliente.nomeRazaoSocial}
          maquina={editingMaquina}
          onClose={() => { setIsMaquinaModalOpen(false); setEditingMaquina(null); }}
          onSuccess={(salva) => {
            const action = editingMaquina ? 'atualizado' : 'cadastrado';
            setSuccessMessage(`Equipamento "${salva.marca} ${salva.modelo}" ${action} com sucesso!`);
            fetchMaquinas();
            setRefreshTrigger((prev) => prev + 1); // atualiza totalEquipamentos do cliente
          }}
        />
      )}

      {/* Modal de Confirmação de Alteração de Status do Cliente */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        title={cliente.ativo ? 'Inativar Cliente?' : 'Reativar Cliente?'}
        message={
          cliente.ativo
            ? `Tem certeza que deseja inativar "${cliente.nomeRazaoSocial}"? O cliente deixará de estar disponível para novas Ordens de Serviço até ser reativado.`
            : `Deseja reativar o cliente "${cliente.nomeRazaoSocial}"?`
        }
        confirmText={cliente.ativo ? 'Sim, Inativar' : 'Sim, Ativar'}
        isDestructive={cliente.ativo}
        isLoading={isChangingStatus}
        onConfirm={handleAlterarStatus}
        onCancel={() => setIsConfirmModalOpen(false)}
      />
    </div>
  );
}
