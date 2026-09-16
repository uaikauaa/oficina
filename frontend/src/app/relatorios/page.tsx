'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  FileText,
  Boxes,
  ArrowLeftRight,
  TrendingUp,
  Users,
  Wrench,
  Calendar,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  CheckCircle2,
  Clock,
  Ban,
  AlertTriangle,
  Eye,
  Download,
} from 'lucide-react';
import Header from '@/components/Header';
import {
  CurrentUser,
  StatusOrdemServico,
  STATUS_ORDEM_SERVICO_BADGES,
  STATUS_ORDEM_SERVICO_LABELS,
  TIPO_MOVIMENTACAO_ESTOQUE_BADGES,
  TIPO_MOVIMENTACAO_ESTOQUE_LABELS,
  TIPO_EQUIPAMENTO_LABELS,
  RelatorioOsResponse,
  RelatorioEstoqueItem,
  EstoqueMovimentacao,
  PecaMaisUtilizada,
  RelatorioClienteItem,
  RelatorioMaquinaItem,
  Categoria,
  Fornecedor,
  PageResponse,
  OrdemServico,
} from '@/lib/types';
import { gerarCsv, baixarArquivoCsv } from '@/lib/csvHelper';
import type { ColunaCsv } from '@/lib/csvHelper';
import {
  apiFetchJson,
  formatarMoeda,
  formatarDataHora,
  formatarDocumento,
  formatarTelefone,
} from '@/lib/api';

type RelatorioTab =
  | 'ordens-servico'
  | 'estoque'
  | 'movimentacoes'
  | 'pecas-mais-utilizadas'
  | 'clientes'
  | 'equipamentos';

export default function RelatoriosPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeTab, setActiveTab] = useState<RelatorioTab>('ordens-servico');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Categorias e Fornecedores para filtros
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  // ----------------------------------------------------
  // Estados: 1. Ordens de Serviço
  // ----------------------------------------------------
  const [osDataInicio, setOsDataInicio] = useState('');
  const [osDataFim, setOsDataFim] = useState('');
  const [osStatus, setOsStatus] = useState<string>('');
  const [osPage, setOsPage] = useState(0);
  const [osRelatorio, setOsRelatorio] = useState<RelatorioOsResponse | null>(null);

  // ----------------------------------------------------
  // Estados: 2. Situação do Estoque
  // ----------------------------------------------------
  const [estoqueCategoriaId, setEstoqueCategoriaId] = useState('');
  const [estoqueFornecedorId, setEstoqueFornecedorId] = useState('');
  const [estoqueBaixo, setEstoqueBaixo] = useState(false);
  const [estoqueZerado, setEstoqueZerado] = useState(false);
  const [estoquePage, setEstoquePage] = useState(0);
  const [estoqueRelatorio, setEstoqueRelatorio] = useState<PageResponse<RelatorioEstoqueItem> | null>(null);

  // ----------------------------------------------------
  // Estados: 3. Movimentações de Estoque
  // ----------------------------------------------------
  const [movDataInicio, setMovDataInicio] = useState('');
  const [movDataFim, setMovDataFim] = useState('');
  const [movTipo, setMovTipo] = useState<string>('');
  const [movNumeroOs, setMovNumeroOs] = useState('');
  const [movPage, setMovPage] = useState(0);
  const [movRelatorio, setMovRelatorio] = useState<PageResponse<EstoqueMovimentacao> | null>(null);

  // ----------------------------------------------------
  // Estados: 4. Peças Mais Utilizadas
  // ----------------------------------------------------
  const [pecasPage, setPecasPage] = useState(0);
  const [pecasRelatorio, setPecasRelatorio] = useState<PageResponse<PecaMaisUtilizada> | null>(null);

  // ----------------------------------------------------
  // Estados: 5. Clientes
  // ----------------------------------------------------
  const [clientesPage, setClientesPage] = useState(0);
  const [clientesRelatorio, setClientesRelatorio] = useState<PageResponse<RelatorioClienteItem> | null>(null);

  // ----------------------------------------------------
  // Estados: 6. Equipamentos
  // ----------------------------------------------------
  const [equipamentosPage, setEquipamentosPage] = useState(0);
  const [equipamentosRelatorio, setEquipamentosRelatorio] = useState<PageResponse<RelatorioMaquinaItem> | null>(null);

  // Carrega Usuário
  useEffect(() => {
    async function loadUser() {
      try {
        const u = await apiFetchJson<CurrentUser>('/api/auth/me');
        setCurrentUser(u);
      } catch {
        // Ignora erro
      }
    }
    loadUser();
  }, []);

  // Carrega Categorias e Fornecedores para os filtros
  useEffect(() => {
    async function loadAux() {
      try {
        const [catData, fornData] = await Promise.all([
          apiFetchJson<PageResponse<Categoria>>('/api/categorias?size=100'),
          apiFetchJson<PageResponse<Fornecedor>>('/api/fornecedores?size=100'),
        ]);
        setCategorias(catData.content || []);
        setFornecedores(fornData.content || []);
      } catch {
        // silencia se tabela ainda não tiver dados
      }
    }
    loadAux();
  }, []);

  // ----------------------------------------------------
  // FETCHERS DOS RELATÓRIOS
  // ----------------------------------------------------

  const fetchOsRelatorio = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (osDataInicio) params.append('dataInicio', `${osDataInicio}T00:00:00Z`);
      if (osDataFim) params.append('dataFim', `${osDataFim}T23:59:59Z`);
      if (osStatus) params.append('status', osStatus);
      params.append('page', String(osPage));
      params.append('size', '15');

      const data = await apiFetchJson<RelatorioOsResponse>(`/api/relatorios/ordens-servico?${params.toString()}`);
      setOsRelatorio(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar relatório de OS');
    } finally {
      setIsLoading(false);
    }
  }, [osDataInicio, osDataFim, osStatus, osPage]);

  const fetchEstoqueRelatorio = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (estoqueCategoriaId) params.append('categoriaId', estoqueCategoriaId);
      if (estoqueFornecedorId) params.append('fornecedorId', estoqueFornecedorId);
      if (estoqueBaixo) params.append('estoqueBaixo', 'true');
      if (estoqueZerado) params.append('zerado', 'true');
      params.append('page', String(estoquePage));
      params.append('size', '15');

      const data = await apiFetchJson<PageResponse<RelatorioEstoqueItem>>(`/api/relatorios/estoque?${params.toString()}`);
      setEstoqueRelatorio(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar relatório de estoque');
    } finally {
      setIsLoading(false);
    }
  }, [estoqueCategoriaId, estoqueFornecedorId, estoqueBaixo, estoqueZerado, estoquePage]);

  const fetchMovimentacoesRelatorio = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (movDataInicio) params.append('dataInicio', `${movDataInicio}T00:00:00Z`);
      if (movDataFim) params.append('dataFim', `${movDataFim}T23:59:59Z`);
      if (movTipo) params.append('tipo', movTipo);
      if (movNumeroOs.trim()) params.append('numeroOs', movNumeroOs.trim());
      params.append('page', String(movPage));
      params.append('size', '15');

      const data = await apiFetchJson<PageResponse<EstoqueMovimentacao>>(`/api/relatorios/movimentacoes?${params.toString()}`);
      setMovRelatorio(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar relatório de movimentações');
    } finally {
      setIsLoading(false);
    }
  }, [movDataInicio, movDataFim, movTipo, movNumeroOs, movPage]);

  const fetchPecasRelatorio = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', String(pecasPage));
      params.append('size', '15');

      const data = await apiFetchJson<PageResponse<PecaMaisUtilizada>>(`/api/relatorios/pecas-mais-utilizadas?${params.toString()}`);
      setPecasRelatorio(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar peças mais utilizadas');
    } finally {
      setIsLoading(false);
    }
  }, [pecasPage]);

  const fetchClientesRelatorio = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', String(clientesPage));
      params.append('size', '15');

      const data = await apiFetchJson<PageResponse<RelatorioClienteItem>>(`/api/relatorios/clientes?${params.toString()}`);
      setClientesRelatorio(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar relatório de clientes');
    } finally {
      setIsLoading(false);
    }
  }, [clientesPage]);

  const fetchEquipamentosRelatorio = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', String(equipamentosPage));
      params.append('size', '15');

      const data = await apiFetchJson<PageResponse<RelatorioMaquinaItem>>(`/api/relatorios/equipamentos?${params.toString()}`);
      setEquipamentosRelatorio(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar relatório de equipamentos');
    } finally {
      setIsLoading(false);
    }
  }, [equipamentosPage]);

  // Disparo conforme aba ativa
  useEffect(() => {
    const timer = setTimeout(() => {
      switch (activeTab) {
        case 'ordens-servico':
          fetchOsRelatorio();
          break;
        case 'estoque':
          fetchEstoqueRelatorio();
          break;
        case 'movimentacoes':
          fetchMovimentacoesRelatorio();
          break;
        case 'pecas-mais-utilizadas':
          fetchPecasRelatorio();
          break;
        case 'clientes':
          fetchClientesRelatorio();
          break;
        case 'equipamentos':
          fetchEquipamentosRelatorio();
          break;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [
    activeTab,
    fetchOsRelatorio,
    fetchEstoqueRelatorio,
    fetchMovimentacoesRelatorio,
    fetchPecasRelatorio,
    fetchClientesRelatorio,
    fetchEquipamentosRelatorio,
  ]);

  // ----------------------------------------------------
  // EXPORTAÇÃO CSV (FEATURE-004)
  // ----------------------------------------------------
  const handleExportarCsvOs = () => {
    const dados = osRelatorio?.itens.content || [];
    if (dados.length === 0) {
      alert('Não há dados de Ordens de Serviço para exportar com os filtros atuais.');
      return;
    }
    const colunas: ColunaCsv<OrdemServico>[] = [
      { cabecalho: 'Número OS', acessar: (i) => i.numeroOs },
      { cabecalho: 'Cliente', acessar: (i) => i.clienteNome },
      { cabecalho: 'Documento', acessar: (i) => formatarDocumento(i.clienteCpfCnpj) },
      { cabecalho: 'Telefone', acessar: (i) => formatarTelefone(i.clienteTelefone) },
      { cabecalho: 'Tipo Equipamento', acessar: (i) => i.maquinaTipoDescricao || '' },
      { cabecalho: 'Marca', acessar: (i) => i.maquinaMarca || '' },
      { cabecalho: 'Modelo', acessar: (i) => i.maquinaModelo || '' },
      { cabecalho: 'Nº Série', acessar: (i) => i.maquinaNumeroSerie || '' },
      { cabecalho: 'Status', acessar: (i) => i.statusDescricao },
      { cabecalho: 'Data Entrada', acessar: (i) => formatarDataHora(i.dataEntrada) },
      { cabecalho: 'Data Conclusão', acessar: (i) => i.dataConclusao ? formatarDataHora(i.dataConclusao) : '' },
      { cabecalho: 'Valor Peças (R$)', acessar: (i) => (i.valorPecas ?? 0).toFixed(2).replace('.', ',') },
      { cabecalho: 'Valor Mão de Obra (R$)', acessar: (i) => (i.valorMaoObra ?? 0).toFixed(2).replace('.', ',') },
      { cabecalho: 'Desconto (R$)', acessar: (i) => (i.valorDesconto ?? 0).toFixed(2).replace('.', ',') },
      { cabecalho: 'Valor Total (R$)', acessar: (i) => (i.valorTotal ?? 0).toFixed(2).replace('.', ',') },
    ];
    const csv = gerarCsv(colunas, dados);
    baixarArquivoCsv(csv, `relatorio-ordens-servico-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportarCsvEstoque = () => {
    const dados = estoqueRelatorio?.content || [];
    if (dados.length === 0) {
      alert('Não há dados de estoque para exportar com os filtros atuais.');
      return;
    }
    const colunas: ColunaCsv<RelatorioEstoqueItem>[] = [
      { cabecalho: 'ID', acessar: (i) => i.produtoId },
      { cabecalho: 'Código', acessar: (i) => i.codigo || '' },
      { cabecalho: 'Produto / Peça', acessar: (i) => i.nome },
      { cabecalho: 'Marca', acessar: (i) => i.marca || '' },
      { cabecalho: 'Categoria', acessar: (i) => i.categoriaNome || '' },
      { cabecalho: 'Fornecedor', acessar: (i) => i.fornecedorNome || '' },
      { cabecalho: 'Estoque Atual', acessar: (i) => (i.estoqueAtual ?? 0).toFixed(2).replace('.', ',') },
      { cabecalho: 'Estoque Mínimo', acessar: (i) => (i.estoqueMinimo ?? 0).toFixed(2).replace('.', ',') },
      { cabecalho: 'Situação Estoque', acessar: (i) => i.statusEstoque },
    ];
    const csv = gerarCsv(colunas, dados);
    baixarArquivoCsv(csv, `relatorio-estoque-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportarCsvMovimentacoes = () => {
    const dados = movRelatorio?.content || [];
    if (dados.length === 0) {
      alert('Não há dados de movimentações para exportar com os filtros atuais.');
      return;
    }
    const colunas: ColunaCsv<EstoqueMovimentacao>[] = [
      { cabecalho: 'ID', acessar: (i) => i.id },
      { cabecalho: 'Data/Hora', acessar: (i) => formatarDataHora(i.dataMovimentacao) },
      { cabecalho: 'Tipo', acessar: (i) => i.tipoDescricao || TIPO_MOVIMENTACAO_ESTOQUE_LABELS[i.tipoMovimentacao] || i.tipoMovimentacao },
      { cabecalho: 'Código Peça', acessar: (i) => i.produtoCodigo || '' },
      { cabecalho: 'Peça / Produto', acessar: (i) => i.produtoNome },
      { cabecalho: 'Quantidade', acessar: (i) => (i.quantidade ?? 0).toFixed(2).replace('.', ',') },
      { cabecalho: 'Saldo Anterior', acessar: (i) => (i.quantidadeAnterior ?? 0).toFixed(2).replace('.', ',') },
      { cabecalho: 'Novo Saldo', acessar: (i) => (i.quantidadePosterior ?? 0).toFixed(2).replace('.', ',') },
      { cabecalho: 'OS Vinculada', acessar: (i) => i.ordemServicoNumero || '' },
      { cabecalho: 'Motivo / Justificativa', acessar: (i) => i.motivo || '' },
      { cabecalho: 'Usuário', acessar: (i) => i.usuarioNome || '' },
    ];
    const csv = gerarCsv(colunas, dados);
    baixarArquivoCsv(csv, `relatorio-movimentacoes-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportarCsvPecas = () => {
    const dados = pecasRelatorio?.content || [];
    if (dados.length === 0) {
      alert('Não há dados de peças para exportar com os filtros atuais.');
      return;
    }
    const colunas: ColunaCsv<PecaMaisUtilizada>[] = [
      { cabecalho: 'ID', acessar: (i) => i.produtoId },
      { cabecalho: 'Código', acessar: (i) => i.codigo || '' },
      { cabecalho: 'Peça', acessar: (i) => i.nome },
      { cabecalho: 'Marca', acessar: (i) => i.marca || '' },
      { cabecalho: 'Total Utilizado em OS', acessar: (i) => (i.quantidadeTotalUtilizada ?? 0).toFixed(2).replace('.', ',') },
      { cabecalho: 'Qtd de OS Atendidas', acessar: (i) => i.quantidadeOs ?? 0 },
    ];
    const csv = gerarCsv(colunas, dados);
    baixarArquivoCsv(csv, `relatorio-pecas-mais-utilizadas-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportarCsvClientes = () => {
    const dados = clientesRelatorio?.content || [];
    if (dados.length === 0) {
      alert('Não há dados de clientes para exportar com os filtros atuais.');
      return;
    }
    const colunas: ColunaCsv<RelatorioClienteItem>[] = [
      { cabecalho: 'ID', acessar: (i) => i.clienteId },
      { cabecalho: 'Nome / Razão Social', acessar: (i) => i.nomeRazaoSocial },
      { cabecalho: 'CPF / CNPJ', acessar: (i) => formatarDocumento(i.cpfCnpj) },
      { cabecalho: 'Telefone', acessar: (i) => formatarTelefone(i.telefone) },
      { cabecalho: 'Qtd Equipamentos', acessar: (i) => i.quantidadeEquipamentos ?? 0 },
      { cabecalho: 'Qtd Ordens de Serviço', acessar: (i) => i.quantidadeOs ?? 0 },
      { cabecalho: 'Última Visita', acessar: (i) => i.ultimaVisita ? formatarDataHora(i.ultimaVisita) : '' },
      { cabecalho: 'Valor Acumulado (R$)', acessar: (i) => (i.valorAcumulado ?? 0).toFixed(2).replace('.', ',') },
    ];
    const csv = gerarCsv(colunas, dados);
    baixarArquivoCsv(csv, `relatorio-clientes-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportarCsvEquipamentos = () => {
    const dados = equipamentosRelatorio?.content || [];
    if (dados.length === 0) {
      alert('Não há dados de equipamentos para exportar com os filtros atuais.');
      return;
    }
    const colunas: ColunaCsv<RelatorioMaquinaItem>[] = [
      { cabecalho: 'ID', acessar: (i) => i.maquinaId },
      { cabecalho: 'Cliente', acessar: (i) => i.clienteNome },
      { cabecalho: 'Tipo', acessar: (i) => TIPO_EQUIPAMENTO_LABELS[i.tipo] || i.tipo },
      { cabecalho: 'Marca', acessar: (i) => i.marca || '' },
      { cabecalho: 'Modelo', acessar: (i) => i.modelo || '' },
      { cabecalho: 'Nº Série', acessar: (i) => i.numeroSerie || '' },
      { cabecalho: 'Qtd Ordens de Serviço', acessar: (i) => i.quantidadeOs ?? 0 },
      { cabecalho: 'Última Manutenção', acessar: (i) => i.ultimaManutencao ? formatarDataHora(i.ultimaManutencao) : '' },
      { cabecalho: 'Valor Acumulado (R$)', acessar: (i) => (i.valorAcumulado ?? 0).toFixed(2).replace('.', ',') },
    ];
    const csv = gerarCsv(colunas, dados);
    baixarArquivoCsv(csv, `relatorio-equipamentos-${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportarCsvAtivo = () => {
    switch (activeTab) {
      case 'ordens-servico': handleExportarCsvOs(); break;
      case 'estoque': handleExportarCsvEstoque(); break;
      case 'movimentacoes': handleExportarCsvMovimentacoes(); break;
      case 'pecas-mais-utilizadas': handleExportarCsvPecas(); break;
      case 'clientes': handleExportarCsvClientes(); break;
      case 'equipamentos': handleExportarCsvEquipamentos(); break;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <BarChart3 className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Módulo Gerencial & Operacional</span>
            </div>
            <h1 className="text-2xl font-black text-white">Relatórios da Oficina</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Consultas consolidadas de ordens de serviço, posição de estoque, peças aplicadas, clientes e equipamentos.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleExportarCsvAtivo}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              title="Exportar dados filtrados da aba atual em formato CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                switch (activeTab) {
                  case 'ordens-servico': fetchOsRelatorio(); break;
                  case 'estoque': fetchEstoqueRelatorio(); break;
                  case 'movimentacoes': fetchMovimentacoesRelatorio(); break;
                  case 'pecas-mais-utilizadas': fetchPecasRelatorio(); break;
                  case 'clientes': fetchClientesRelatorio(); break;
                  case 'equipamentos': fetchEquipamentosRelatorio(); break;
                }
              }}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Atualizar Dados</span>
            </button>
          </div>
        </div>

        {/* Mensagem de Erro Global */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Abas de Relatórios */}
        <div className="border-b border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar pb-px">
          <button
            type="button"
            onClick={() => { setActiveTab('ordens-servico'); setOsPage(0); }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ordens-servico'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Ordens de Serviço</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('estoque'); setEstoquePage(0); }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'estoque'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Situação do Estoque</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('movimentacoes'); setMovPage(0); }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'movimentacoes'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Movimentações de Estoque</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('pecas-mais-utilizadas'); setPecasPage(0); }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pecas-mais-utilizadas'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Peças Mais Utilizadas</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('clientes'); setClientesPage(0); }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'clientes'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Clientes</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('equipamentos'); setEquipamentosPage(0); }}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'equipamentos'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Equipamentos</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: ORDENS DE SERVIÇO                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'ordens-servico' && (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-end gap-3.5">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Data Inicial:
                </label>
                <input
                  type="date"
                  value={osDataInicio}
                  onChange={(e) => { setOsDataInicio(e.target.value); setOsPage(0); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Data Final:
                </label>
                <input
                  type="date"
                  value={osDataFim}
                  onChange={(e) => { setOsDataFim(e.target.value); setOsPage(0); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-amber-500" />
                  Filtrar por Status:
                </label>
                <select
                  value={osStatus}
                  onChange={(e) => { setOsStatus(e.target.value); setOsPage(0); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">Todos os Status</option>
                  {Object.entries(STATUS_ORDEM_SERVICO_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              {(osDataInicio || osDataFim || osStatus) && (
                <button
                  type="button"
                  onClick={() => {
                    setOsDataInicio('');
                    setOsDataFim('');
                    setOsStatus('');
                    setOsPage(0);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}

              <button
                type="button"
                onClick={handleExportarCsvOs}
                className="px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ml-auto"
                title="Exportar dados de Ordens de Serviço filtradas para CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>
            </div>

            {/* Cards de Resumo */}
            {osRelatorio?.resumo && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Total de OS</span>
                    <FileText className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-black text-white">{osRelatorio.resumo.totalOs}</div>
                  <span className="text-[10px] text-slate-500">No período selecionado</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Concluídas</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-black text-emerald-400">{osRelatorio.resumo.concluidas}</div>
                  <span className="text-[10px] text-slate-500">Ordens finalizadas</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Abertas / Em Curso</span>
                    <Clock className="w-4 h-4 text-sky-500" />
                  </div>
                  <div className="text-xl font-black text-sky-400">{osRelatorio.resumo.abertas}</div>
                  <span className="text-[10px] text-slate-500">Na oficina</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span>Canceladas</span>
                    <Ban className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-xl font-black text-rose-400">{osRelatorio.resumo.canceladas}</div>
                  <span className="text-[10px] text-slate-500">Sem faturamento</span>
                </div>

                <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-slate-900 border border-amber-500/30">
                  <div className="flex items-center justify-between text-amber-400 text-xs mb-1">
                    <span className="font-bold">Faturamento (Concluídas)</span>
                    <DollarSign className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-xl font-black text-white">
                    {formatarMoeda(osRelatorio.resumo.valorTotalConcluidas)}
                  </div>
                  <span className="text-[10px] text-amber-400/70">Receita efetivada</span>
                </div>
              </div>
            )}

            {/* Tabela de OS */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3.5">Nº OS</th>
                      <th className="p-3.5">Cliente</th>
                      <th className="p-3.5">Equipamento</th>
                      <th className="p-3.5">Entrada</th>
                      <th className="p-3.5">Conclusão</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Valor Total</th>
                      <th className="p-3.5 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span>Carregando ordens de serviço...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !osRelatorio?.itens.content || osRelatorio.itens.content.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          Nenhuma Ordem de Serviço encontrada com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      osRelatorio.itens.content.map((item) => {
                        const badge = STATUS_ORDEM_SERVICO_BADGES[item.status as StatusOrdemServico] || {
                          bg: 'bg-slate-800',
                          text: 'text-slate-300',
                          border: 'border-slate-700',
                        };
                        return (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-amber-400">{item.numeroOs}</td>
                            <td className="p-3.5 font-medium text-white">{item.clienteNome}</td>
                            <td className="p-3.5 text-slate-300">
                              {item.maquinaMarca} {item.maquinaModelo}
                            </td>
                            <td className="p-3.5 text-slate-400">{formatarDataHora(item.dataEntrada)}</td>
                            <td className="p-3.5 text-slate-400">
                              {item.dataConclusao ? formatarDataHora(item.dataConclusao) : '—'}
                            </td>
                            <td className="p-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {item.statusDescricao}
                              </span>
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-100">
                              {formatarMoeda(item.valorTotal)}
                            </td>
                            <td className="p-3.5 text-center">
                              <Link
                                href={`/ordens-servico/${item.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-semibold transition-all"
                                title="Visualizar e Imprimir OS"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Ver OS</span>
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {osRelatorio?.itens && osRelatorio.itens.totalPages > 1 && (
                <div className="p-3.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{osRelatorio.itens.totalElements}</strong> registros
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={osPage === 0}
                      onClick={() => setOsPage((prev) => Math.max(0, prev - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      Página <strong>{osPage + 1}</strong> de <strong>{osRelatorio.itens.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={osPage >= osRelatorio.itens.totalPages - 1}
                      onClick={() => setOsPage((prev) => prev + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: SITUAÇÃO DO ESTOQUE                                               */}
        {/* ========================================================================= */}
        {activeTab === 'estoque' && (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filtrar por Categoria:</label>
                <select
                  value={estoqueCategoriaId}
                  onChange={(e) => { setEstoqueCategoriaId(e.target.value); setEstoquePage(0); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">Todas as Categorias</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filtrar por Fornecedor:</label>
                <select
                  value={estoqueFornecedorId}
                  onChange={(e) => { setEstoqueFornecedorId(e.target.value); setEstoquePage(0); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">Todos os Fornecedores</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>{f.razaoSocial}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4 pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                  <input
                    type="checkbox"
                    checked={estoqueBaixo}
                    onChange={(e) => { setEstoqueBaixo(e.target.checked); setEstoquePage(0); }}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Apenas Estoque Baixo</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                  <input
                    type="checkbox"
                    checked={estoqueZerado}
                    onChange={(e) => { setEstoqueZerado(e.target.checked); setEstoquePage(0); }}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Apenas Zerados</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleExportarCsvEstoque}
                className="px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ml-auto"
                title="Exportar dados de Estoque filtrados para CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>
            </div>

            {/* Tabela de Estoque */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3.5">Código</th>
                      <th className="p-3.5">Produto / Peça</th>
                      <th className="p-3.5">Categoria</th>
                      <th className="p-3.5">Fornecedor</th>
                      <th className="p-3.5 text-right">Estoque Atual</th>
                      <th className="p-3.5 text-right">Estoque Mínimo</th>
                      <th className="p-3.5 text-center">Status do Estoque</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span>Carregando situação de estoque...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !estoqueRelatorio?.content || estoqueRelatorio.content.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          Nenhum produto localizado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      estoqueRelatorio.content.map((item) => {
                        let statusBadge = { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'NORMAL' };
                        if (item.statusEstoque === 'ZERADO') {
                          statusBadge = { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', label: 'ZERADO' };
                        } else if (item.statusEstoque === 'BAIXO') {
                          statusBadge = { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'BAIXO' };
                        }

                        return (
                          <tr key={item.produtoId} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-amber-400">{item.codigo}</td>
                            <td className="p-3.5 font-medium text-white">
                              {item.nome}
                              {item.marca && <span className="text-slate-400 ml-1.5 text-[11px]">({item.marca})</span>}
                            </td>
                            <td className="p-3.5 text-slate-300">{item.categoriaNome || '—'}</td>
                            <td className="p-3.5 text-slate-400">{item.fornecedorNome || '—'}</td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-100">
                              {Number(item.estoqueAtual).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3.5 text-right font-mono text-slate-400">
                              {Number(item.estoqueMinimo).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
                                {statusBadge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {estoqueRelatorio && estoqueRelatorio.totalPages > 1 && (
                <div className="p-3.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{estoqueRelatorio.totalElements}</strong> itens
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={estoquePage === 0}
                      onClick={() => setEstoquePage((prev) => Math.max(0, prev - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      Página <strong>{estoquePage + 1}</strong> de <strong>{estoqueRelatorio.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={estoquePage >= estoqueRelatorio.totalPages - 1}
                      onClick={() => setEstoquePage((prev) => prev + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 3: MOVIMENTAÇÕES DE ESTOQUE                                          */}
        {/* ========================================================================= */}
        {activeTab === 'movimentacoes' && (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-end gap-3.5">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Data Inicial:</label>
                <input
                  type="date"
                  value={movDataInicio}
                  onChange={(e) => { setMovDataInicio(e.target.value); setMovPage(0); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Data Final:</label>
                <input
                  type="date"
                  value={movDataFim}
                  onChange={(e) => { setMovDataFim(e.target.value); setMovPage(0); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tipo de Movimentação:</label>
                <select
                  value={movTipo}
                  onChange={(e) => { setMovTipo(e.target.value); setMovPage(0); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">Todos os Tipos</option>
                  {Object.entries(TIPO_MOVIMENTACAO_ESTOQUE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Número da OS:</label>
                <input
                  type="text"
                  placeholder="Ex: OS-2026-0001"
                  value={movNumeroOs}
                  onChange={(e) => { setMovNumeroOs(e.target.value); setMovPage(0); }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {(movDataInicio || movDataFim || movTipo || movNumeroOs) && (
                <button
                  type="button"
                  onClick={() => {
                    setMovDataInicio('');
                    setMovDataFim('');
                    setMovTipo('');
                    setMovNumeroOs('');
                    setMovPage(0);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Limpar
                </button>
              )}

              <button
                type="button"
                onClick={handleExportarCsvMovimentacoes}
                className="px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ml-auto"
                title="Exportar dados de Movimentações para CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>
            </div>

            {/* Tabela de Movimentações */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3.5">Data / Hora</th>
                      <th className="p-3.5">Tipo</th>
                      <th className="p-3.5">Produto</th>
                      <th className="p-3.5 text-right">Qtd</th>
                      <th className="p-3.5 text-right">Saldo Ant.</th>
                      <th className="p-3.5 text-right">Novo Saldo</th>
                      <th className="p-3.5">OS Relacionada</th>
                      <th className="p-3.5">Motivo / Obs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span>Carregando movimentações...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !movRelatorio?.content || movRelatorio.content.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          Nenhuma movimentação registrada no período selecionado.
                        </td>
                      </tr>
                    ) : (
                      movRelatorio.content.map((m) => {
                        const badge = TIPO_MOVIMENTACAO_ESTOQUE_BADGES[m.tipoMovimentacao] || {
                          bg: 'bg-slate-800',
                          text: 'text-slate-300',
                          border: 'border-slate-700',
                        };
                        return (
                          <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 text-slate-400 whitespace-nowrap">{formatarDataHora(m.dataMovimentacao)}</td>
                            <td className="p-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {m.tipoDescricao}
                              </span>
                            </td>
                            <td className="p-3.5 font-medium text-white">
                              <span className="font-mono text-amber-400 mr-1.5">{m.produtoCodigo}</span>
                              {m.produtoNome}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-100">
                              {Number(m.quantidade).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3.5 text-right font-mono text-slate-400">
                              {Number(m.quantidadeAnterior).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-200">
                              {Number(m.quantidadePosterior).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3.5">
                              {m.ordemServicoNumero ? (
                                <span className="font-mono text-xs text-amber-400 font-semibold">
                                  {m.ordemServicoNumero}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="p-3.5 text-slate-400 max-w-xs truncate" title={m.motivo}>
                              {m.motivo || '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {movRelatorio && movRelatorio.totalPages > 1 && (
                <div className="p-3.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{movRelatorio.totalElements}</strong> movimentações
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={movPage === 0}
                      onClick={() => setMovPage((prev) => Math.max(0, prev - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      Página <strong>{movPage + 1}</strong> de <strong>{movRelatorio.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={movPage >= movRelatorio.totalPages - 1}
                      onClick={() => setMovPage((prev) => prev + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 4: PEÇAS MAIS UTILIZADAS                                             */}
        {/* ========================================================================= */}
        {activeTab === 'pecas-mais-utilizadas' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Ranking de Consumo de Peças em Ordens de Serviço</h3>
                  <p className="text-xs text-slate-400">Identifique os componentes de maior giro para reposição preventiva de estoque.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportarCsvPecas}
                className="px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                title="Exportar ranking de peças para CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>
            </div>

            {/* Tabela Ranking */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3.5 text-center w-16">Posição</th>
                      <th className="p-3.5">Código</th>
                      <th className="p-3.5">Nome do Componente / Peça</th>
                      <th className="p-3.5">Marca</th>
                      <th className="p-3.5 text-right">Qtd Total Utilizada</th>
                      <th className="p-3.5 text-right">Qtd de OS Aplicadas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span>Calculando ranking de peças...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !pecasRelatorio?.content || pecasRelatorio.content.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          Nenhuma peça foi aplicada em ordens de serviço até o momento.
                        </td>
                      </tr>
                    ) : (
                      pecasRelatorio.content.map((p, idx) => {
                        const rank = pecasPage * 15 + idx + 1;
                        return (
                          <tr key={p.produtoId} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 text-center font-bold">
                              {rank === 1 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs">
                                  1º
                                </span>
                              ) : rank === 2 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-200 border border-slate-400/30 text-xs">
                                  2º
                                </span>
                              ) : rank === 3 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/30 text-xs">
                                  3º
                                </span>
                              ) : (
                                <span className="text-slate-500">{rank}º</span>
                              )}
                            </td>
                            <td className="p-3.5 font-mono font-bold text-amber-400">{p.codigo}</td>
                            <td className="p-3.5 font-semibold text-white">{p.nome}</td>
                            <td className="p-3.5 text-slate-400">{p.marca || '—'}</td>
                            <td className="p-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                              {Number(p.quantidadeTotalUtilizada).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3.5 text-right font-mono font-semibold text-slate-200">
                              {p.quantidadeOs} {p.quantidadeOs === 1 ? 'OS' : 'OSs'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {pecasRelatorio && pecasRelatorio.totalPages > 1 && (
                <div className="p-3.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{pecasRelatorio.totalElements}</strong> peças distintas
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pecasPage === 0}
                      onClick={() => setPecasPage((prev) => Math.max(0, prev - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      Página <strong>{pecasPage + 1}</strong> de <strong>{pecasRelatorio.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={pecasPage >= pecasRelatorio.totalPages - 1}
                      onClick={() => setPecasPage((prev) => prev + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 5: CLIENTES                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'clientes' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Consolidado Financeiro e Histórico por Cliente</h3>
                  <p className="text-xs text-slate-400">Volume de máquinas, total de atendimentos e receita gerada por cliente.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportarCsvClientes}
                className="px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                title="Exportar dados de Clientes para CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>
            </div>

            {/* Tabela de Clientes */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3.5">Cliente / Razão Social</th>
                      <th className="p-3.5">CPF / CNPJ</th>
                      <th className="p-3.5">Telefone</th>
                      <th className="p-3.5 text-center">Máquinas</th>
                      <th className="p-3.5 text-center">Total OS</th>
                      <th className="p-3.5">Última Visita / OS</th>
                      <th className="p-3.5 text-right">Faturamento Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span>Carregando dados consolidados de clientes...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !clientesRelatorio?.content || clientesRelatorio.content.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          Nenhum cliente cadastrado no sistema.
                        </td>
                      </tr>
                    ) : (
                      clientesRelatorio.content.map((c) => (
                        <tr key={c.clienteId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-bold text-white">{c.nomeRazaoSocial}</td>
                          <td className="p-3.5 font-mono text-slate-400">{formatarDocumento(c.cpfCnpj)}</td>
                          <td className="p-3.5 text-slate-400">{formatarTelefone(c.telefone)}</td>
                          <td className="p-3.5 text-center font-mono font-semibold text-slate-200">
                            {c.quantidadeEquipamentos}
                          </td>
                          <td className="p-3.5 text-center font-mono font-semibold text-slate-200">
                            {c.quantidadeOs}
                          </td>
                          <td className="p-3.5 text-slate-400">
                            {c.ultimaVisita ? formatarDataHora(c.ultimaVisita) : '—'}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-amber-400 text-sm">
                            {formatarMoeda(c.valorAcumulado)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {clientesRelatorio && clientesRelatorio.totalPages > 1 && (
                <div className="p-3.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{clientesRelatorio.totalElements}</strong> clientes
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={clientesPage === 0}
                      onClick={() => setClientesPage((prev) => Math.max(0, prev - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      Página <strong>{clientesPage + 1}</strong> de <strong>{clientesRelatorio.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={clientesPage >= clientesRelatorio.totalPages - 1}
                      onClick={() => setClientesPage((prev) => prev + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 6: EQUIPAMENTOS                                                      */}
        {/* ========================================================================= */}
        {activeTab === 'equipamentos' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Consolidado Técnico e Histórico por Equipamento</h3>
                  <p className="text-xs text-slate-400">
                    Histórico de máquinas de solda, geradores e outros equipamentos com faturamento acumulado.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportarCsvEquipamentos}
                className="px-3.5 py-2 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
                title="Exportar dados de Equipamentos para CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>
            </div>

            {/* Tabela de Equipamentos */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="p-3.5">Tipo</th>
                      <th className="p-3.5">Marca / Modelo</th>
                      <th className="p-3.5">Nº de Série</th>
                      <th className="p-3.5">Cliente Proprietário</th>
                      <th className="p-3.5 text-center">Manutenções (OS)</th>
                      <th className="p-3.5">Última Manutenção</th>
                      <th className="p-3.5 text-right">Faturamento Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span>Carregando dados dos equipamentos...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !equipamentosRelatorio?.content || equipamentosRelatorio.content.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          Nenhum equipamento cadastrado no sistema.
                        </td>
                      </tr>
                    ) : (
                      equipamentosRelatorio.content.map((m) => (
                        <tr key={m.maquinaId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {TIPO_EQUIPAMENTO_LABELS[m.tipo] || m.tipo}
                            </span>
                          </td>
                          <td className="p-3.5 font-bold text-white">
                            {m.marca} {m.modelo}
                          </td>
                          <td className="p-3.5 font-mono text-slate-400">{m.numeroSerie || 'S/N'}</td>
                          <td className="p-3.5 font-medium text-slate-200">{m.clienteNome}</td>
                          <td className="p-3.5 text-center font-mono font-semibold text-slate-200">
                            {m.quantidadeOs}
                          </td>
                          <td className="p-3.5 text-slate-400">
                            {m.ultimaManutencao ? formatarDataHora(m.ultimaManutencao) : '—'}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-amber-400 text-sm">
                            {formatarMoeda(m.valorAcumulado)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {equipamentosRelatorio && equipamentosRelatorio.totalPages > 1 && (
                <div className="p-3.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{equipamentosRelatorio.totalElements}</strong> equipamentos
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={equipamentosPage === 0}
                      onClick={() => setEquipamentosPage((prev) => Math.max(0, prev - 1))}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      Página <strong>{equipamentosPage + 1}</strong> de <strong>{equipamentosRelatorio.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={equipamentosPage >= equipamentosRelatorio.totalPages - 1}
                      onClick={() => setEquipamentosPage((prev) => prev + 1)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
