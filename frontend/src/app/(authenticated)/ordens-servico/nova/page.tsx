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
import ClienteModal from '@/components/ClienteModal';
import MaquinaModal from '@/components/MaquinaModal';
import FeedbackNotice from '@/components/ui/FeedbackNotice';
import {
  Cliente,
  Maquina,
  OrdemServicoFormData,
  TIPO_EQUIPAMENTO_LABELS,
} from '@/lib/types';
import { apiFetch, formatarDocumento, formatarTelefone } from '@/lib/api';
import {
  obterAgoraLocalDatetimeInput,
  converterDatetimeLocalParaIsoComOffset,
} from '@/lib/relatorioDateHelper';

function NovaOrdemServicoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preClienteId = searchParams.get('clienteId');
  const preMaquinaId = searchParams.get('maquinaId');

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
    dataEntrada: obterAgoraLocalDatetimeInput(), // YYYY-MM-DDTHH:mm no fuso de São Paulo
    problemaRelatado: '',
    horimetroAtual: '',
    observacoes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);



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
        dataEntrada: converterDatetimeLocalParaIsoComOffset(formData.dataEntrada),
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
    <>
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navegação de Retorno */}
        <div className="flex items-center justify-between">
          <Link
            href="/ordens-servico"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft aria-hidden="true" className="w-4 h-4" />
            <span>Voltar para Lista de Ordens de Serviço</span>
          </Link>
        </div>

        {/* Notificação de Sucesso */}
        <h1 className="ui-page-title">Nova Ordem de Serviço</h1>
        {toastSucesso && (
          <FeedbackNotice message={toastSucesso} variant="success" onDismiss={() => setToastSucesso(null)} />
        )}

        {/* Mensagem de Erro Geral */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/40 text-danger text-xs sm:text-sm flex items-start gap-3">
            <AlertCircle aria-hidden="true" className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold text-ink">Não foi possível abrir a OS:</strong>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ETAPA 1: LOCALIZAR CLIENTE */}
          <div className="p-6 rounded-2xl bg-surface/80 border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center border border-accent/30">
                  1
                </div>
                <h2 className="text-base font-bold text-ink">Cliente Proprietário</h2>
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
                  className="text-xs text-accent hover:text-accent font-semibold cursor-pointer underline"
                >
                  Alterar Cliente
                </button>
              )}
            </div>

            {!clienteSelecionado ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label htmlFor="field-src-app-authenticated-ordens-servico-nova-page-tsx-1" className="block text-xs font-semibold text-ink">
                    Pesquise o cliente por Nome, Razão Social, CPF ou CNPJ:
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsNovoClienteModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent font-semibold cursor-pointer py-1 px-2.5 rounded-lg bg-accent/10 border border-accent/20 hover:bg-accent/20 transition-all self-start sm:self-auto"
                  >
                    <Plus aria-hidden="true" className="w-4 h-4" />
                    <span>Cadastrar novo cliente</span>
                  </button>
                </div>

                <div className="relative">
                  <Search aria-hidden="true" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
                  <input id="field-src-app-authenticated-ordens-servico-nova-page-tsx-1"
                    type="text"
                    value={termoCliente}
                    onChange={(e) => setTermoCliente(e.target.value)}
                    placeholder="Digite pelo menos 2 caracteres para buscar..."
                    className="ui-field w-full pl-10 pr-4 border placeholder-subtle focus:outline-none focus:border-accent/50 transition-all"
                  />
                  {buscandoClientes && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Lista de Resultados de Clientes */}
                {clientesEncontrados.length > 0 && (
                  <div className="border border-line rounded-xl bg-canvas divide-y divide-line/60 overflow-hidden max-h-56 overflow-y-auto">
                    {clientesEncontrados.map((cli) => (
                      <div
                        key={cli.id}
                        onClick={() => setClienteSelecionado(cli)}
                        className="p-3 hover:bg-surface/80 cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-sm text-ink">{cli.nomeRazaoSocial}</p>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                            {cli.cpfCnpj && <span>{formatarDocumento(cli.cpfCnpj)}</span>}
                            {cli.celular && (
                              <>
                                <span>•</span>
                                <span>{formatarTelefone(cli.celular)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-accent font-semibold px-2.5 py-1 rounded bg-accent/10 border border-accent/20">
                          Selecionar
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {termoCliente.trim().length >= 2 && !buscandoClientes && clientesEncontrados.length === 0 && (
                  <div className="p-4 rounded-xl bg-canvas/60 border border-line text-center text-xs text-muted space-y-2">
                    <p>Cliente não encontrado com o termo digitado.</p>
                    <button
                      type="button"
                      onClick={() => setIsNovoClienteModalOpen(true)}
                      className="ui-btn ui-btn-primary inline-flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus aria-hidden="true" className="w-4 h-4" />
                      <span>Cadastrar novo cliente</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Card do Cliente Selecionado */
              <div className="p-4 rounded-xl bg-canvas border border-line flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                    <User aria-hidden="true" className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">{clienteSelecionado.nomeRazaoSocial}</h3>
                    <p className="text-xs text-muted">
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
                <span className="inline-flex items-center gap-1 text-xs text-ink bg-ink/5 px-2.5 py-1 rounded border border-line font-semibold">
                  <CheckCircle2 aria-hidden="true" className="w-4 h-4" />
                  Cliente Vinculado
                </span>
              </div>
            )}
          </div>

          {/* ETAPA 2: SELECIONAR EQUIPAMENTO DO CLIENTE */}
          {clienteSelecionado && (
            <div className="p-6 rounded-2xl bg-surface/80 border border-line space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center border border-accent/30">
                    2
                  </div>
                  <h2 className="text-base font-bold text-ink">Equipamento da Oficina</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNovaMaquinaModalOpen(true)}
                  className="text-xs text-accent hover:text-accent font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus aria-hidden="true" className="w-4 h-4" />
                  <span>Cadastrar Máquina para este Cliente</span>
                </button>
              </div>

              {carregandoMaquinas ? (
                <div className="p-6 flex items-center justify-center gap-2 text-xs text-muted">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span>Carregando máquinas do cliente...</span>
                </div>
              ) : maquinasCliente.length === 0 ? (
                <div className="p-6 rounded-xl bg-canvas border border-line text-center space-y-2">
                  <Wrench className="w-8 h-8 mx-auto text-subtle" />
                  <p className="text-sm font-semibold text-ink">
                    Este cliente ainda não possui máquinas cadastradas
                  </p>
                  <p className="text-xs text-muted max-w-md mx-auto">
                    Para abrir uma Ordem de Serviço, o equipamento técnico deve estar cadastrado na ficha do cliente.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsNovaMaquinaModalOpen(true)}
                    className="ui-btn ui-btn-primary inline-flex items-center gap-1.5 transition-all mt-2 cursor-pointer"
                  >
                    <Plus aria-hidden="true" className="w-4 h-4" />
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
                            ? 'bg-accent/10 border-accent shadow-md shadow-none ring-1 ring-accent'
                            : 'bg-canvas border-line hover:border-control'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                              {TIPO_EQUIPAMENTO_LABELS[m.tipoEquipamento] || m.tipoEquipamento}
                            </span>
                            {isSelected && (
                              <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-accent" />
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-ink mt-2">
                            {m.marca} {m.modelo}
                          </h4>
                          <div className="text-xs text-muted mt-1 space-y-0.5">
                            {m.numeroSerie && (
                              <p className="font-mono">
                                Série: <strong className="text-ink">{m.numeroSerie}</strong>
                              </p>
                            )}
                            {m.potencia && <p>Potência: {m.potencia}</p>}
                            {m.tensao && <p>Tensão: {m.tensao}</p>}
                          </div>
                        </div>

                        {m.horimetro != null && (
                          <div className="mt-3 pt-2 border-t border-line text-xs text-muted">
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
            <div className="p-6 rounded-2xl bg-surface/80 border border-line space-y-4">
              <div className="flex items-center gap-2.5 border-b border-line pb-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 text-accent font-bold text-xs flex items-center justify-center border border-accent/30">
                  3
                </div>
                <h2 className="text-base font-bold text-ink">Dados do Atendimento e Defeito</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Data e Hora de Entrada */}
                <div>
                  <label htmlFor="field-src-app-authenticated-ordens-servico-nova-page-tsx-2" className="block text-xs font-semibold text-ink mb-1">
                    Data e Hora de Entrada:
                  </label>
                  <input id="field-src-app-authenticated-ordens-servico-nova-page-tsx-2"
                    type="datetime-local"
                    value={formData.dataEntrada}
                    onChange={(e) => setFormData({ ...formData, dataEntrada: e.target.value })}
                    className="ui-field w-full border focus:outline-none focus:border-accent/50"
                  />
                </div>

                {/* Horímetro Atual */}
                <div>
                  <label htmlFor="field-src-app-authenticated-ordens-servico-nova-page-tsx-3" className="block text-xs font-semibold text-ink mb-1">
                    Horímetro Atual (Horas de Uso):
                  </label>
                  <input id="field-src-app-authenticated-ordens-servico-nova-page-tsx-3"
                    type="text"
                    value={formData.horimetroAtual}
                    onChange={(e) => setFormData({ ...formData, horimetroAtual: e.target.value })}
                    placeholder="Ex: 1250.5 (para geradores ou máquinas com marcador)"
                    className="ui-field w-full border placeholder-subtle focus:outline-none focus:border-accent/50"
                  />
                </div>

                {/* Número da OS (Opcional) */}
                <div className="sm:col-span-2">
                  <label htmlFor="field-src-app-authenticated-ordens-servico-nova-page-tsx-4" className="block text-xs font-semibold text-ink mb-1">
                    Número da OS (Opcional):
                  </label>
                  <input id="field-src-app-authenticated-ordens-servico-nova-page-tsx-4"
                    type="text"
                    value={formData.numeroOs}
                    onChange={(e) => setFormData({ ...formData, numeroOs: e.target.value })}
                    placeholder="Deixe em branco para gerar automaticamente (Ex: OS-2026-0001)"
                    className="ui-field w-full border placeholder-subtle focus:outline-none focus:border-accent/50"
                  />
                </div>

                {/* Problema Relatado */}
                <div className="sm:col-span-2">
                  <label htmlFor="field-src-app-authenticated-ordens-servico-nova-page-tsx-5" className="block text-xs font-semibold text-ink mb-1">
                    Problema Relatado pelo Cliente <strong className="text-accent">*</strong>:
                  </label>
                  <textarea id="field-src-app-authenticated-ordens-servico-nova-page-tsx-5"
                    rows={3}
                    required
                    value={formData.problemaRelatado}
                    onChange={(e) => setFormData({ ...formData, problemaRelatado: e.target.value })}
                    placeholder="Descreva detalhadamente o sintoma informado pelo cliente (ex: não estabiliza arco, desarmando disjuntor em 180A, sem tensão nas tomadas 220V do gerador)..."
                    className="ui-field w-full border placeholder-subtle focus:outline-none focus:border-accent/50 resize-y"
                  />
                </div>

                {/* Observações de Recepção */}
                <div className="sm:col-span-2">
                  <label htmlFor="field-src-app-authenticated-ordens-servico-nova-page-tsx-6" className="block text-xs font-semibold text-ink mb-1">
                    Observações de Recepção e Acessórios Deixados:
                  </label>
                  <textarea id="field-src-app-authenticated-ordens-servico-nova-page-tsx-6"
                    rows={2}
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Ex: Acompanha cabos de solda 25mm², grampo terra e tocha TIG. Carcaça com marcas de impacto na lateral direita."
                    className="ui-field w-full border placeholder-subtle focus:outline-none focus:border-accent/50 resize-y"
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
                className="px-4 py-2.5 rounded-xl bg-elevated hover:bg-hover text-ink text-xs sm:text-sm font-semibold transition-all"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={isSubmitting}
                className="ui-btn ui-btn-primary disabled:opacity-50 sm:text-sm transition-all cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin" />
                    <span>Abrindo OS...</span>
                  </>
                ) : (
                  <>
                    <FileText aria-hidden="true" className="w-4 h-4" />
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
    </>
  );
}

export default function NovaOrdemServicoPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex items-center justify-center text-muted">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <NovaOrdemServicoContent />
    </Suspense>
  );
}
