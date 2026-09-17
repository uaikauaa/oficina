'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  Search,
  User,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import Header from '@/components/Header';
import ClienteModal from '@/components/ClienteModal';
import MaquinaModal from '@/components/MaquinaModal';
import {
  Cliente,
  CurrentUser,
  Maquina,
  OrdemServicoFormData,
  TIPO_EQUIPAMENTO_LABELS,
} from '@/lib/types';
import { apiFetch, formatarDocumento, formatarTelefone } from '@/lib/api';

function NovaOrdemServicoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preClienteId = searchParams.get('clienteId');
  const preMaquinaId = searchParams.get('maquinaId');

  // Usuário da Sessão
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Estados do Cliente
  const [termoCliente, setTermoCliente] = useState('');
  const [clientesEncontrados, setClientesEncontrados] = useState<Cliente[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

  // Estados dos Equipamentos do Cliente Selecionado
  const [maquinasCliente, setMaquinasCliente] = useState<Maquina[]>([]);
  const [carregandoMaquinas, setCarregandoMaquinas] = useState(false);
  const [maquinaSelecionadaId, setMaquinaSelecionadaId] = useState<string>('');

  // Modais de Criação Rápida
  const [isNovoClienteModalOpen, setIsNovoClienteModalOpen] = useState(false);
  const [isNovaMaquinaModalOpen, setIsNovaMaquinaModalOpen] = useState(false);
  const [toastSucesso, setToastSucesso] = useState<string | null>(null);

  // Formulário de Abertura
  const [formData, setFormData] = useState<{
    numeroOs: string;
    dataEntrada: string;
    problemaRelatado: string;
    horimetroAtual: string;
    observacoes: string;
  }>({
    numeroOs: '',
    dataEntrada: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    problemaRelatado: '',
    horimetroAtual: '',
    observacoes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Se veio clienteId na URL, busca e pré-seleciona
  useEffect(() => {
    if (!preClienteId) return;

    let ignore = false;
    async function carregarClientePreDefinido() {
      try {
        const res = await apiFetch(`/api/clientes/${preClienteId}`);
        if (res.ok && !ignore) {
          const cli: Cliente = await res.json();
          setClienteSelecionado(cli);
        }
      } catch {
        // Ignora
      }
    }
    carregarClientePreDefinido();
    return () => {
      ignore = true;
    };
  }, [preClienteId]);

  // Busca clientes por termo digitado (debounce)
  useEffect(() => {
    if (clienteSelecionado) return; // Se já selecionou, não busca

    if (!termoCliente.trim() || termoCliente.trim().length < 2) {
      const resetTimer = setTimeout(() => {
        setClientesEncontrados([]);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    const timer = setTimeout(async () => {
      setBuscandoClientes(true);
      try {
        const res = await apiFetch(`/api/clientes?termo=${encodeURIComponent(termoCliente.trim())}&size=6`);
        if (res.ok) {
          const data = await res.json();
          setClientesEncontrados(data.content || []);
        }
      } catch {
        // Ignora
      } finally {
        setBuscandoClientes(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [termoCliente, clienteSelecionado]);

  // Ao selecionar um cliente, busca reativamente os equipamentos cadastrados daquele cliente
  useEffect(() => {
    if (!clienteSelecionado) {
      const resetTimer = setTimeout(() => {
        setMaquinasCliente([]);
        setMaquinaSelecionadaId('');
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    let ignore = false;
    async function carregarEquipamentosDoCliente() {
      setCarregandoMaquinas(true);
      try {
        const res = await apiFetch(`/api/clientes/${clienteSelecionado!.id}/maquinas?size=100&ativo=true`);
        if (res.ok && !ignore) {
          const data = await res.json();
          const lista: Maquina[] = data.content || [];
          setMaquinasCliente(lista);

          // Se veio pré-selecionada maquinaId daquele cliente, seleciona
          if (preMaquinaId && lista.some((m) => m.id.toString() === preMaquinaId)) {
            setMaquinaSelecionadaId(preMaquinaId);
          } else if (lista.length === 1) {
            // Se o cliente tem apenas 1 equipamento, já seleciona automaticamente
            setMaquinaSelecionadaId(lista[0].id.toString());
          }
        }
      } catch {
        // Ignora
      } finally {
        if (!ignore) {
          setCarregandoMaquinas(false);
        }
      }
    }

    const fetchTimer = setTimeout(() => {
      carregarEquipamentosDoCliente();
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(fetchTimer);
    };
  }, [clienteSelecionado, preMaquinaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!clienteSelecionado) {
      setErrorMessage('Por favor, selecione o cliente proprietário do equipamento.');
      return;
    }

    if (!maquinaSelecionadaId) {
      setErrorMessage('Por favor, selecione qual equipamento do cliente passará pela manutenção.');
      return;
    }

    if (!formData.problemaRelatado.trim()) {
      setErrorMessage('Por favor, informe a descrição do defeito ou problema relatado.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: OrdemServicoFormData = {
        clienteId: clienteSelecionado.id,
        maquinaId: Number(maquinaSelecionadaId),
        problemaRelatado: formData.problemaRelatado.trim(),
        dataEntrada: formData.dataEntrada ? new Date(formData.dataEntrada).toISOString() : undefined,
        observacoes: formData.observacoes.trim() || undefined,
        horimetroAtual: formData.horimetroAtual ? formData.horimetroAtual.replace(/\s+/g, '').replace(',', '.') : undefined,
        numeroOs: formData.numeroOs.trim() || undefined,
      };

      const res = await apiFetch('/api/ordens-servico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao abrir Ordem de Serviço.');
      }

      const osCriada = await res.json();
      router.push(`/ordens-servico/${osCriada.id}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro inesperado ao registrar Ordem de Serviço.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navegação de Retorno */}
        <div className="flex items-center justify-between">
          <Link
            href="/ordens-servico"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Lista de Ordens de Serviço</span>
          </Link>
        </div>

        {/* Título Principal */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                  Recepção Técnica
                </span>
                <span className="text-xs text-slate-400">Status Inicial: ABERTA</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
                Abertura de Ordem de Serviço
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Localize o cliente, selecione o equipamento cadastrado e registre o problema relatado.
              </p>
            </div>
          </div>
        </div>

        {/* Notificação de Sucesso */}
        {toastSucesso && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold">{toastSucesso}</span>
            </div>
            <button
              onClick={() => setToastSucesso(null)}
              className="text-emerald-400 hover:text-emerald-200 font-bold ml-4 cursor-pointer text-base"
            >
              ×
            </button>
          </div>
        )}

        {/* Mensagem de Erro Geral */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs sm:text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold text-white">Não foi possível abrir a OS:</strong>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ETAPA 1: LOCALIZAR CLIENTE */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                  1
                </div>
                <h2 className="text-base font-bold text-white">Cliente Proprietário</h2>
              </div>
              {clienteSelecionado && (
                <button
                  type="button"
                  onClick={() => {
                    setClienteSelecionado(null);
                    setTermoCliente('');
                    setMaquinasCliente([]);
                    setMaquinaSelecionadaId('');
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline"
                >
                  Alterar Cliente
                </button>
              )}
            </div>

            {!clienteSelecionado ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Pesquise o cliente por Nome, Razão Social, CPF ou CNPJ:
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNovoClienteModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer py-1 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Cadastrar novo cliente</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={termoCliente}
                    onChange={(e) => setTermoCliente(e.target.value)}
                    placeholder="Digite pelo menos 2 caracteres para buscar..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all"
                  />
                  {buscandoClientes && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Lista de Resultados de Clientes */}
                {clientesEncontrados.length > 0 && (
                  <div className="border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-800/60 overflow-hidden max-h-56 overflow-y-auto">
                    {clientesEncontrados.map((cli) => (
                      <div
                        key={cli.id}
                        onClick={() => setClienteSelecionado(cli)}
                        className="p-3 hover:bg-slate-900/80 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-sm text-white">{cli.nomeRazaoSocial}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            {cli.cpfCnpj && <span>{formatarDocumento(cli.cpfCnpj)}</span>}
                            {cli.celular && (
                              <>
                                <span>•</span>
                                <span>{formatarTelefone(cli.celular)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-amber-400 font-semibold px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20">
                          Selecionar
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {termoCliente.trim().length >= 2 && !buscandoClientes && clientesEncontrados.length === 0 && (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400 space-y-2">
                    <p>Cliente não encontrado com o termo digitado.</p>
                    <button
                      type="button"
                      onClick={() => setIsNovoClienteModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Cadastrar novo cliente</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Card do Cliente Selecionado */
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{clienteSelecionado.nomeRazaoSocial}</h3>
                    <p className="text-xs text-slate-400">
                      {clienteSelecionado.cpfCnpj
                        ? formatarDocumento(clienteSelecionado.cpfCnpj)
                        : 'Documento não informado'}{' '}
                      •{' '}
                      {clienteSelecionado.celular
                        ? formatarTelefone(clienteSelecionado.celular)
                        : clienteSelecionado.telefone
                        ? formatarTelefone(clienteSelecionado.telefone)
                        : 'Sem telefone'}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Cliente Vinculado
                </span>
              </div>
            )}
          </div>

          {/* ETAPA 2: SELECIONAR EQUIPAMENTO DO CLIENTE */}
          {clienteSelecionado && (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                    2
                  </div>
                  <h2 className="text-base font-bold text-white">Equipamento da Oficina</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNovaMaquinaModalOpen(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Máquina para este Cliente</span>
                </button>
              </div>

              {carregandoMaquinas ? (
                <div className="p-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span>Carregando máquinas do cliente...</span>
                </div>
              ) : maquinasCliente.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                  <Wrench className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-sm font-semibold text-white">
                    Este cliente ainda não possui máquinas cadastradas
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Para abrir uma Ordem de Serviço, o equipamento técnico deve estar cadastrado na ficha do cliente.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsNovaMaquinaModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all mt-2 cursor-pointer shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Cadastrar Equipamento Agora</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {maquinasCliente.map((m) => {
                    const isSelected = maquinaSelecionadaId === m.id.toString();

                    return (
                      <div
                        key={m.id}
                        onClick={() => setMaquinaSelecionadaId(m.id.toString())}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10 ring-1 ring-amber-500'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              {TIPO_EQUIPAMENTO_LABELS[m.tipoEquipamento] || m.tipoEquipamento}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-amber-400" />
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-white mt-2">
                            {m.marca} {m.modelo}
                          </h4>
                          <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                            {m.numeroSerie && (
                              <p className="font-mono">
                                Série: <strong className="text-slate-200">{m.numeroSerie}</strong>
                              </p>
                            )}
                            {m.potencia && <p>Potência: {m.potencia}</p>}
                            {m.tensao && <p>Tensão: {m.tensao}</p>}
                          </div>
                        </div>

                        {m.horimetro != null && (
                          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                            Último horímetro: <strong>{m.horimetro} h</strong>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ETAPA 3: DADOS DO ATENDIMENTO */}
          {clienteSelecionado && maquinaSelecionadaId && (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                  3
                </div>
                <h2 className="text-base font-bold text-white">Dados do Atendimento e Defeito</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Data e Hora de Entrada */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Data e Hora de Entrada:
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.dataEntrada}
                    onChange={(e) => setFormData({ ...formData, dataEntrada: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Horímetro Atual */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Horímetro Atual (Horas de Uso):
                  </label>
                  <input
                    type="text"
                    value={formData.horimetroAtual}
                    onChange={(e) => setFormData({ ...formData, horimetroAtual: e.target.value })}
                    placeholder="Ex: 1250.5 (para geradores ou máquinas com marcador)"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Número da OS (Opcional) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Número da OS (Opcional):
                  </label>
                  <input
                    type="text"
                    value={formData.numeroOs}
                    onChange={(e) => setFormData({ ...formData, numeroOs: e.target.value })}
                    placeholder="Deixe em branco para gerar automaticamente (Ex: OS-2026-0001)"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Problema Relatado */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Problema Relatado pelo Cliente <strong className="text-amber-400">*</strong>:
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formData.problemaRelatado}
                    onChange={(e) => setFormData({ ...formData, problemaRelatado: e.target.value })}
                    placeholder="Descreva detalhadamente o sintoma informado pelo cliente (ex: não estabiliza arco, desarmando disjuntor em 180A, sem tensão nas tomadas 220V do gerador)..."
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-y"
                  />
                </div>

                {/* Observações de Recepção */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Observações de Recepção e Acessórios Deixados:
                  </label>
                  <textarea
                    rows={2}
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Ex: Acompanha cabos de solda 25mm², grampo terra e tocha TIG. Carcaça com marcas de impacto na lateral direita."
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-y"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Botão de Envio */}
          {clienteSelecionado && maquinaSelecionadaId && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <Link
                href="/ordens-servico"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition-all"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Abrindo OS...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Abrir Ordem de Serviço</span>
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </main>

      {/* Modal de Cadastro Integrado: Cliente + Equipamento */}
      <ClienteModal
        isOpen={isNovoClienteModalOpen}
        incluirEquipamento={true}
        nomePreDefinido={termoCliente.trim()}
        onClose={() => setIsNovoClienteModalOpen(false)}
        onSuccessComEquipamento={(novoCliente, novaMaquina) => {
          setClienteSelecionado(novoCliente);
          setMaquinasCliente([novaMaquina]);
          setMaquinaSelecionadaId(novaMaquina.id.toString());
          setToastSucesso(
            `Cliente "${novoCliente.nomeRazaoSocial}" e equipamento "${novaMaquina.marca} ${novaMaquina.modelo}" vinculados à Ordem de Serviço!`
          );
        }}
      />

      {/* Modal de Cadastro de Máquina para Cliente Já Existente */}
      {clienteSelecionado && (
        <MaquinaModal
          isOpen={isNovaMaquinaModalOpen}
          clienteId={clienteSelecionado.id}
          clienteNome={clienteSelecionado.nomeRazaoSocial}
          onClose={() => setIsNovaMaquinaModalOpen(false)}
          onSuccess={(novaMaquina) => {
            setMaquinasCliente((prev) => [
              novaMaquina,
              ...prev.filter((m) => m.id !== novaMaquina.id),
            ]);
            setMaquinaSelecionadaId(novaMaquina.id.toString());
            setIsNovaMaquinaModalOpen(false);
            setToastSucesso(
              `Equipamento "${novaMaquina.marca} ${novaMaquina.modelo}" cadastrado com sucesso!`
            );
          }}
        />
      )}
    </div>
  );
}

export default function NovaOrdemServicoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <NovaOrdemServicoContent />
    </Suspense>
  );
}
