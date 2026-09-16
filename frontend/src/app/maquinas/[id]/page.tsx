'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Wrench,
  Zap,
  AlertCircle,
  FileText,
  Plus,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react';
import Header from '@/components/Header';
import {
  CurrentUser,
  Maquina,
  OrdemServico,
  PageResponse,
  STATUS_ORDEM_SERVICO_BADGES,
  TIPO_EQUIPAMENTO_LABELS,
} from '@/lib/types';
import { apiFetch, formatarMoeda, formatarDataHora } from '@/lib/api';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MaquinaDetalhesPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const maquinaId = resolvedParams.id;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [maquina, setMaquina] = useState<Maquina | null>(null);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Carrega dados da Máquina e histórico de Ordens de Serviço
  const carregarDados = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Carrega dados do equipamento
      const resMaq = await apiFetch(`/api/maquinas/${maquinaId}`);
      if (!resMaq.ok) {
        if (resMaq.status === 404) {
          throw new Error('Equipamento não encontrado no sistema.');
        }
        throw new Error('Falha ao carregar equipamento.');
      }
      const dataMaq: Maquina = await resMaq.json();
      setMaquina(dataMaq);

      // 2. Carrega histórico de Ordens de Serviço desta máquina
      const resOs = await apiFetch(`/api/maquinas/${maquinaId}/ordens-servico?size=50`);
      if (resOs.ok) {
        const dataOs: PageResponse<OrdemServico> = await resOs.json();
        setOrdens(dataOs.content || []);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao consultar equipamento.');
    } finally {
      setIsLoading(false);
    }
  }, [maquinaId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarDados();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarDados]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Carregando histórico do equipamento...</span>
        </div>
      </div>
    );
  }

  if (!maquina || errorMessage) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Header user={currentUser} />
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h2 className="text-xl font-bold text-white">Equipamento não localizado</h2>
          <p className="text-sm text-slate-400">{errorMessage}</p>
          <Link
            href="/clientes"
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold"
          >
            Voltar para Clientes
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navegação de Retorno */}
        <div className="flex items-center justify-between">
          <Link
            href={`/clientes/${maquina.clienteId}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Ficha do Cliente ({maquina.clienteNome})</span>
          </Link>
        </div>

        {/* Card do Equipamento Técnico */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <Wrench className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                    {TIPO_EQUIPAMENTO_LABELS[maquina.tipoEquipamento] || maquina.tipoEquipamento}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      maquina.ativo
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {maquina.ativo ? 'Equipamento Ativo' : 'Inativo'}
                  </span>
                </div>
                <h1 className="text-2xl font-black text-white mt-1.5">
                  {maquina.marca} {maquina.modelo}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proprietário:{' '}
                  <Link
                    href={`/clientes/${maquina.clienteId}`}
                    className="font-bold text-white hover:text-amber-400 transition-colors"
                  >
                    {maquina.clienteNome}
                  </Link>
                </p>
              </div>
            </div>

            <Link
              href={`/ordens-servico/nova?clienteId=${maquina.clienteId}&maquinaId=${maquina.id}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Abrir Nova OS para esta Máquina</span>
            </Link>
          </div>

          {/* Ficha Técnica Rápida */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-500 font-medium block">Número de Série:</span>
              <span className="font-mono font-bold text-slate-200 mt-0.5 block">
                {maquina.numeroSerie || 'Não informado'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Potência / Capacidade:</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">
                {maquina.potencia || 'Não informada'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Tensão de Trabalho:</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">
                {maquina.tensao || 'Não informada'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Último Horímetro:</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">
                {maquina.horimetro != null ? `${maquina.horimetro} horas` : 'Não registrado'}
              </span>
            </div>
          </div>
        </div>

        {/* HISTÓRICO DE MANUTENÇÕES E PASSAGENS PELA OFICINA */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-white">Histórico de Manutenções da Máquina</h2>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 border border-slate-800 text-slate-300">
              {ordens.length} {ordens.length === 1 ? 'atendimento registrado' : 'atendimentos registrados'}
            </span>
          </div>

          {ordens.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
              <RotateCcw className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">Nenhum atendimento registrado para este equipamento</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Esta máquina ainda não deu entrada em nenhuma Ordem de Serviço na oficina.
              </p>
              <Link
                href={`/ordens-servico/nova?clienteId=${maquina.clienteId}&maquinaId=${maquina.id}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Registrar Primeira Entrada</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {ordens.map((os) => {
                const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                  bg: 'bg-slate-800',
                  text: 'text-slate-300',
                  border: 'border-slate-700',
                };

                return (
                  <div
                    key={os.id}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 text-xs">
                          {os.numeroOs}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {os.statusDescricao}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>Entrada: {formatarDataHora(os.dataEntrada)}</span>
                        {os.dataConclusao && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400">
                              Conclusão: {formatarDataHora(os.dataConclusao)}
                            </span>
                          </>
                        )}
                        <Link
                          href={`/ordens-servico/${os.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-300 text-xs font-semibold border border-slate-700 transition-all ml-2"
                        >
                          <span>Ver OS</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Problema Relatado:
                        </span>
                        <p className="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                          {os.problemaRelatado}
                        </p>
                      </div>

                      <div>
                        <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Diagnóstico Técnico:
                        </span>
                        <p className="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                          {os.diagnostico || 'Sem diagnóstico registrado'}
                        </p>
                      </div>

                      <div>
                        <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Solução Aplicada:
                        </span>
                        <p className="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                          {os.solucaoAplicada || 'Sem solução registrada'}
                        </p>
                      </div>
                    </div>

                    {os.testesRealizados && (
                      <div className="pt-2 border-t border-slate-800/60 text-xs flex items-start gap-2 text-emerald-300">
                        <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-emerald-400">Testes Validados:</strong> {os.testesRealizados}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80 text-slate-400">
                      <span>Mão de Obra: {formatarMoeda(os.valorMaoObra)} • Peças: {formatarMoeda(os.valorPecas)}</span>
                      <span className="text-sm font-bold text-white">
                        Total:{' '}
                        <strong className="text-emerald-400 font-black">{formatarMoeda(os.valorTotal)}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
