'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
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
  History,
  DollarSign,
} from 'lucide-react';
import ClienteModal from '@/components/ClienteModal';
import ConfirmModal from '@/components/ConfirmModal';
import MaquinaModal from '@/components/MaquinaModal';
import {
  Cliente,
  ClienteResumo,
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

  // Resumo de KPIs do Cliente (Fase 7)
  const [resumo, setResumo] = useState<ClienteResumo | null>(null);

  // Modais
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Modal de equipamentos
  const [isMaquinaModalOpen, setIsMaquinaModalOpen] = useState(false);
  const [editingMaquina, setEditingMaquina] = useState<Maquina | null>(null);


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

  const fetchResumo = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/clientes/${clienteId}/resumo`);
      if (res.ok) {
        const data: ClienteResumo = await res.json();
        setResumo(data);
      }
    } catch {
      // Ignora erro
    }
  }, [clienteId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (clienteId) {
        fetchMaquinas();
        fetchOrdensCliente();
        fetchResumo();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [clienteId, fetchMaquinas, fetchOrdensCliente, fetchResumo]);

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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span>Carregando dados do cliente...</span>
        </div>
      </main>
    );
  }

  if (errorMessage || !cliente) {
    return (
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col items-center justify-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-ink mb-2">{errorMessage || 'Cliente não localizado'}</h2>
        <p className="text-xs text-muted max-w-md mb-6">
          O registro solicitado pode ter sido removido ou o identificador informado está incorreto.
        </p>
        <Link
          href="/clientes"
          className="px-4 py-2 rounded-xl bg-elevated hover:bg-hover text-ink text-xs font-semibold flex items-center gap-2 transition-colors"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          <span>Voltar para Lista de Clientes</span>
        </Link>
      </main>
    );
  }

  const enderecoPrincipal = cliente.enderecos?.[0];

  return (
    <>
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navegação Superior */}
        <div className="flex items-center justify-between">
          <Link
            href="/clientes"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft aria-hidden="true" className="w-4 h-4" />
            <span>Voltar para Clientes</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-elevated hover:bg-ink/5 hover:text-ink text-ink text-xs font-semibold flex items-center gap-1.5 border border-control hover:border-line transition-all cursor-pointer"
            >
              <Edit2 aria-hidden="true" className="w-4 h-4" />
              <span>Editar</span>
            </button>

            <button
              onClick={() => setIsConfirmModalOpen(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                cliente.ativo
                  ? 'bg-elevated hover:bg-danger/20 hover:text-danger text-ink border-control hover:border-danger/30'
                  : 'bg-elevated hover:bg-ink/5 hover:text-ink text-ink border-control hover:border-line'
              }`}
            >
              <Power aria-hidden="true" className="w-4 h-4" />
              <span>{cliente.ativo ? 'Inativar' : 'Reativar'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-ink/5 border border-line text-ink text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 aria-hidden="true" className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-ink font-bold ml-4">
              ×
            </button>
          </div>
        )}

        {/* Card Principal de Identificação */}
        <div className="p-6 rounded-2xl bg-surface/90 border border-line shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                {cliente.tipoPessoa === 'JURIDICA' ? <Building2 className="w-7 h-7" /> : <User className="w-7 h-7" />}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="ui-page-title">{cliente.nomeRazaoSocial}</h1>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      cliente.ativo
                        ? 'bg-ink/5 text-ink border border-line'
                        : 'bg-elevated text-muted border border-control'
                    }`}
                  >
                    {cliente.ativo ? 'Cliente Ativo' : 'Cliente Inativo'}
                  </span>
                </div>

                {cliente.nomeFantasia && (
                  <p className="text-xs text-muted mt-1">Nome Fantasia: {cliente.nomeFantasia}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 font-mono">
                    <span className="text-subtle">{cliente.tipoPessoa === 'JURIDICA' ? 'CNPJ:' : 'CPF:'}</span>
                    <strong className="text-ink">{formatarDocumento(cliente.cpfCnpj)}</strong>
                  </span>

                  {cliente.rgIe && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-subtle">{cliente.tipoPessoa === 'JURIDICA' ? 'IE:' : 'RG:'}</span>
                      <strong className="text-ink">{cliente.rgIe}</strong>
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 text-subtle">
                    <Clock aria-hidden="true" className="w-4 h-4" />
                    <span>ID #{cliente.id}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:items-end justify-center border-t sm:border-t-0 sm:border-l border-line pt-3 sm:pt-0 sm:pl-6 text-xs text-muted space-y-1">
              <div className="flex items-center gap-1.5">
                <Calendar aria-hidden="true" className="w-4 h-4 text-subtle" />
                <span>Cadastrado em: {new Date(cliente.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="text-xs text-subtle">
                Atualizado em: {new Date(cliente.updatedAt).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        </div>

        {/* INDICADORES DO CLIENTE (5 CARDS DE RESUMO - FASE 7) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
              <Wrench aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-xs text-muted font-medium block">Equipamentos</span>
              <span className="text-lg sm:text-xl font-semibold text-ink">
                {resumo?.quantidadeEquipamentos ?? maquinas.length}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ink/5 border border-line flex items-center justify-center text-ink shrink-0">
              <FileText aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-xs text-muted font-medium block">Total de OS</span>
              <span className="text-lg sm:text-xl font-semibold text-ink">
                {resumo?.quantidadeTotalOs ?? ordensCliente.length}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
              <Clock aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-xs text-muted font-medium block">OS em Aberto</span>
              <span className="text-lg sm:text-xl font-semibold text-accent">
                {resumo?.quantidadeOsAbertas ?? 0}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-ink/5 border border-line flex items-center justify-center text-ink shrink-0">
              <Calendar aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-xs text-muted font-medium block">Última Visita</span>
              <span className="text-xs font-bold text-ink">
                {resumo?.ultimaVisitaData
                  ? formatarDataHora(resumo.ultimaVisitaData)
                  : 'Nenhuma'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="h-10 w-10 rounded-xl bg-ink/5 border border-line flex items-center justify-center text-ink shrink-0">
              <DollarSign aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-xs text-muted font-medium block">Total Acumulado</span>
              <span className="text-sm sm:text-base font-semibold text-ink">
                {formatarMoeda(resumo?.valorAcumulado ?? 0)}
              </span>
              <span className="text-xs text-subtle block leading-tight">Somente OS Concluídas</span>
            </div>
          </div>
        </div>

        {/* Grade de Detalhes: Contatos e Endereço */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card de Contatos */}
          <div className="p-6 rounded-2xl bg-surface border border-line space-y-4">
            <h2 className="text-xs font-bold text-accent flex items-center gap-2">
              <Phone aria-hidden="true" className="w-4 h-4" />
              <span>Contatos & Comunicação</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-line">
                <span className="text-muted">Telefone Fixo:</span>
                <span className="text-ink font-medium">{formatarTelefone(cliente.telefone)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-line">
                <span className="text-muted">Celular / WhatsApp:</span>
                <span className="text-ink font-medium">{formatarTelefone(cliente.celular)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-line">
                <span className="text-muted">E-mail:</span>
                <span className="text-ink font-medium">{cliente.email || '-'}</span>
              </div>
            </div>
          </div>

          {/* Card de Endereço */}
          <div className="p-6 rounded-2xl bg-surface border border-line space-y-4">
            <h2 className="text-xs font-bold text-accent flex items-center gap-2">
              <MapPin aria-hidden="true" className="w-4 h-4" />
              <span>Endereço Principal</span>
            </h2>

            {enderecoPrincipal ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <span className="text-muted">Logradouro / Número:</span>
                  <span className="text-ink font-medium">
                    {enderecoPrincipal.logradouro}, {enderecoPrincipal.numero}
                  </span>
                </div>
                {enderecoPrincipal.complemento && (
                  <div className="flex items-center justify-between py-2 border-b border-line">
                    <span className="text-muted">Complemento:</span>
                    <span className="text-ink font-medium">{enderecoPrincipal.complemento}</span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <span className="text-muted">Bairro:</span>
                  <span className="text-ink font-medium">{enderecoPrincipal.bairro}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-line">
                  <span className="text-muted">Cidade / UF:</span>
                  <span className="text-ink font-medium">
                    {enderecoPrincipal.cidade} / {enderecoPrincipal.estado}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-muted">CEP:</span>
                  <span className="text-ink font-medium">{formatarCep(enderecoPrincipal.cep)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-subtle py-4">Nenhum endereço cadastrado para este cliente.</p>
            )}
          </div>
        </div>

        {/* Observações */}
        {cliente.observacoes && (
          <div className="p-6 rounded-2xl bg-surface border border-line space-y-2">
            <h2 className="text-xs font-bold text-accent flex items-center gap-2">
              <FileText aria-hidden="true" className="w-4 h-4" />
              <span>Observações Técnicas / Comerciais</span>
            </h2>
            <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">{cliente.observacoes}</p>
          </div>
        )}

        {/* Seção de Equipamentos */}
        <div className="p-6 rounded-2xl bg-surface border border-line space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Wrench aria-hidden="true" className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-ink">Máquinas &amp; Equipamentos Vinculados</h2>
              {maquinas.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-accent/15 text-accent border border-accent/30">
                  {maquinas.length}
                </span>
              )}
            </div>
            <button
              onClick={() => { setEditingMaquina(null); setIsMaquinaModalOpen(true); }}
              className="ui-btn ui-btn-primary inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus aria-hidden="true" className="w-4 h-4" />
              <span>Novo Equipamento</span>
            </button>
          </div>

          {/* Estado de carregamento */}
          {maquinasLoading && (
            <div className="flex items-center gap-3 py-6 justify-center text-muted text-xs">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span>Carregando equipamentos...</span>
            </div>
          )}

          {/* Erro */}
          {!maquinasLoading && maquinasError && (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs">
              <AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0" />
              <span>{maquinasError}</span>
            </div>
          )}

          {/* Lista de equipamentos */}
          {!maquinasLoading && !maquinasError && maquinas.length === 0 && (
            <div className="p-8 rounded-xl bg-canvas/60 border border-line text-center space-y-3">
              <div className="h-12 w-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mx-auto">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Nenhum equipamento cadastrado</p>
                <p className="text-xs text-muted max-w-lg mx-auto mt-1 leading-relaxed">
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
                      ? 'bg-canvas/50 border-line hover:border-control'
                      : 'bg-canvas/30 border-line opacity-60'
                  }`}
                >
                  {/* Header do card */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                        <Wrench aria-hidden="true" className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ink">
                          {maq.marca} — {maq.modelo}
                        </p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-elevated text-muted border border-control mt-0.5">
                          {TIPO_EQUIPAMENTO_LABELS[maq.tipoEquipamento]}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold ${
                          maq.ativo
                            ? 'bg-ink/5 text-ink border border-line'
                            : 'bg-elevated text-subtle border border-control'
                        }`}
                      >
                        {maq.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes técnicos */}
                  <div className="space-y-1 text-xs">
                    {maq.numeroSerie && (
                      <div className="flex items-center gap-1.5 text-muted">
                        <Hash aria-hidden="true" className="w-3 h-3 text-subtle" />
                        <span>N/S: <span className="text-ink font-mono">{maq.numeroSerie}</span></span>
                      </div>
                    )}
                    {maq.anoFabricacao && (
                      <div className="flex items-center gap-1.5 text-muted">
                        <Calendar aria-hidden="true" className="w-3 h-3 text-subtle" />
                        <span>Fabricação: <span className="text-ink">{maq.anoFabricacao}</span></span>
                      </div>
                    )}
                    {(maq.potencia || maq.tensao) && (
                      <div className="flex items-center gap-1.5 text-muted">
                        <Zap aria-hidden="true" className="w-3 h-3 text-subtle" />
                        <span>
                          {[maq.potencia, maq.tensao].filter(Boolean).join(' / ')}
                        </span>
                      </div>
                    )}
                    {maq.horimetro != null && (
                      <div className="flex items-center gap-1.5 text-muted">
                        <Gauge aria-hidden="true" className="w-3 h-3 text-subtle" />
                        <span>Horímetro: <span className="text-ink">{maq.horimetro}h</span></span>
                      </div>
                    )}
                  </div>

                  {/* Ações do card */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-line">
                    <Link
                      href={`/ordens-servico/nova?clienteId=${cliente.id}&maquinaId=${maq.id}`}
                      className="px-2.5 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-xs font-bold flex items-center justify-center gap-1 border border-accent/30 transition-all cursor-pointer"
                    >
                      <Plus aria-hidden="true" className="w-3 h-3" />
                      <span>Abrir OS</span>
                    </Link>
                    <Link
                      href={`/maquinas/${maq.id}`}
                      className="px-2.5 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-xs font-semibold flex items-center justify-center gap-1 border border-accent/20 transition-all cursor-pointer"
                      title="Ver Histórico Completo do Equipamento"
                    >
                      <History aria-hidden="true" className="w-3 h-3 text-accent" />
                      <span>Ver Histórico</span>
                    </Link>
                    <button
                      onClick={() => { setEditingMaquina(maq); setIsMaquinaModalOpen(true); }}
                      className="px-2.5 py-1.5 rounded-lg bg-elevated/80 hover:bg-ink/5 hover:text-ink text-muted text-xs font-semibold flex items-center justify-center gap-1 border border-control hover:border-line transition-all cursor-pointer"
                    >
                      <Edit2 aria-hidden="true" className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => handleAlterarStatusMaquina(maq)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition-all cursor-pointer ${
                        maq.ativo
                          ? 'bg-elevated/80 hover:bg-danger/20 hover:text-danger text-muted border-control hover:border-danger/30'
                          : 'bg-elevated/80 hover:bg-ink/5 hover:text-ink text-muted border-control hover:border-line'
                      }`}
                    >
                      <Power aria-hidden="true" className="w-3 h-3" />
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
        <div className="p-6 rounded-2xl bg-surface border border-line shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-accent/20 text-accent border border-accent/30 uppercase">
                  Histórico Operacional
                </span>
                <span className="text-xs text-muted font-mono">
                  {ordensCliente.length} {ordensCliente.length === 1 ? 'OS registrada' : 'OS registradas'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-ink mt-1 flex items-center gap-2">
                <FileText aria-hidden="true" className="w-5 h-5 text-accent" />
                <span>Ordens de Serviço do Cliente</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Histórico completo de atendimentos, manutenções e faturamentos vinculados a este cliente.
              </p>
            </div>

            <Link
              href={`/ordens-servico/nova?clienteId=${cliente.id}`}
              className="ui-btn ui-btn-primary inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Plus aria-hidden="true" className="w-4 h-4" />
              <span>Nova Ordem de Serviço</span>
            </Link>
          </div>

          {ordensLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-xs text-muted">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span>Carregando histórico de ordens de serviço...</span>
            </div>
          ) : ordensCliente.length === 0 ? (
            <div className="p-8 rounded-xl bg-canvas/60 border border-line text-center space-y-2">
              <FileText className="w-8 h-8 mx-auto text-subtle" />
              <p className="text-sm font-medium text-ink">Nenhuma Ordem de Serviço aberta para este cliente</p>
              <p className="text-xs text-subtle max-w-sm mx-auto">
                Quando este cliente levar um equipamento para manutenção ou conserto, a OS aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ui-table">
                <thead>
                  <tr className="border-b border-line text-xs font-bold text-muted">
                    <th className="py-2.5 px-3">Nº da OS</th>
                    <th className="py-2.5 px-3">Equipamento</th>
                    <th className="py-2.5 px-3">Data Entrada</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Valor Total</th>
                    <th className="py-2.5 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 text-xs">
                  {ordensCliente.map((os) => {
                    const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                      bg: 'bg-elevated',
                      text: 'text-ink',
                      border: 'border-control',
                    };

                    return (
                      <tr key={os.id} className="hover:bg-elevated/20 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20 text-xs">
                            {os.numeroOs}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-ink">
                            {os.maquinaMarca} {os.maquinaModelo}
                          </div>
                          {os.maquinaNumeroSerie && (
                            <span className="text-xs text-subtle font-mono">
                              Série: {os.maquinaNumeroSerie}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-muted whitespace-nowrap">
                          {formatarDataHora(os.dataEntrada)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {os.statusDescricao}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-ink">
                          {formatarMoeda(os.valorTotal)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Link
                            href={`/ordens-servico/${os.id}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-elevated hover:bg-accent/20 hover:text-accent text-ink text-xs font-semibold border border-control transition-all"
                          >
                            <span>Ver OS</span>
                            <ArrowUpRight aria-hidden="true" className="w-4 h-4" />
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
    </>
  );
}
