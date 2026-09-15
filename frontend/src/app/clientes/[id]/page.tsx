'use client';

import React, { useEffect, useState, use } from 'react';
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
} from 'lucide-react';
import Header from '@/components/Header';
import ClienteModal from '@/components/ClienteModal';
import ConfirmModal from '@/components/ConfirmModal';
import { Cliente, CurrentUser } from '@/lib/types';
import { apiFetch, formatarDocumento, formatarTelefone, formatarCep } from '@/lib/api';

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

  // Modais
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

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

        {/* Estrutura Preparada para Histórico Futuro de Equipamentos */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Máquinas & Equipamentos Vinculados</h2>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
              Módulo de Equipamentos — Fase 4B
            </span>
          </div>

          <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                Nenhum equipamento técnico associado no momento
              </p>
              <p className="text-xs text-slate-400 max-w-lg mx-auto mt-1 leading-relaxed">
                A estrutura do cliente está pronta para vincular máquinas de solda (MIG, TIG, Eletrodo, Inversoras) e geradores de energia (diesel e gasolina). O gerenciamento de equipamentos será ativado no módulo seguinte (Fase 4B).
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Edição */}
      <ClienteModal
        isOpen={isEditModalOpen}
        cliente={cliente}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(salvo) => {
          setSuccessMessage(`Cliente "${salvo.nomeRazaoSocial}" atualizado com sucesso!`);
          setCliente(salvo);
        }}
      />

      {/* Modal de Confirmação de Alteração de Status */}
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
