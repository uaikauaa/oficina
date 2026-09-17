'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
  Download,
  X,
  Check,
  Info,
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
import { fetchTodosRegistrosRelatorio } from '@/lib/csvExportHelper';
import {
  formatarDataInicioParaApi,
  formatarDataFimParaApi,
  calcularIntervaloPreset,
  identificarPresetAtivo,
  PresetPeriodo,
} from '@/lib/relatorioDateHelper';
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

interface ToastNotificacao {
  id: number;
  tipo: 'sucesso' | 'aviso' | 'erro';
  mensagem: string;
}

export default function RelatoriosPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeTab, setActiveTab] = useState<RelatorioTab>('ordens-servico');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastNotificacao | null>(null);

  // Categorias e Fornecedores carregados sob demanda (Lazy Loading - UX008-03)
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregouAuxiliaresEstoque, setCarregouAuxiliaresEstoque] = useState(false);

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
  // Estados: 3. Movimentações de Estoque (com debounce de 300ms)
  // ----------------------------------------------------
  const [movDataInicio, setMovDataInicio] = useState('');
  const [movDataFim, setMovDataFim] = useState('');
  const [movTipo, setMovTipo] = useState<string>('');
  const [movNumeroOsInput, setMovNumeroOsInput] = useState('');
  const [movNumeroOsDebounced, setMovNumeroOsDebounced] = useState('');
  const [movPage, setMovPage] = useState(0);
  const [movRelatorio, setMovRelatorio] = useState<PageResponse<EstoqueMovimentacao> | null>(null);

  // Debounce de 300ms no campo textual de OS (UX008-06)
  useEffect(() => {
    const timer = setTimeout(() => {
      setMovNumeroOsDebounced(movNumeroOsInput);
      setMovPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [movNumeroOsInput]);

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

  // Auto-dismiss do Toast (UX008-01)
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const mostrarToast = useCallback((mensagem: string, tipo: 'sucesso' | 'aviso' | 'erro' = 'aviso') => {
    setToast({ id: Date.now(), tipo, mensagem });
  }, []);

  // Carrega Usuário no mount
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

  // Lazy Loading de Categorias e Fornecedores (UX008-03 - apenas ao abrir aba 'estoque')
  useEffect(() => {
    if (activeTab === 'estoque' && !carregouAuxiliaresEstoque) {
      async function loadAux() {
        try {
          const [catData, fornData] = await Promise.all([
            apiFetchJson<PageResponse<Categoria>>('/api/categorias?size=100'),
            apiFetchJson<PageResponse<Fornecedor>>('/api/fornecedores?size=100'),
          ]);
          setCategorias(catData.content || []);
          setFornecedores(fornData.content || []);
          setCarregouAuxiliaresEstoque(true);
        } catch {
          // silencia se tabela não tiver dados
        }
      }
      loadAux();
    }
  }, [activeTab, carregouAuxiliaresEstoque]);

  // ----------------------------------------------------
  // FETCHERS DOS RELATÓRIOS
  // ----------------------------------------------------

  const fetchOsRelatorio = useCallback(async (apenasMudancaPagina = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (osDataInicio) params.append('dataInicio', formatarDataInicioParaApi(osDataInicio));
      if (osDataFim) params.append('dataFim', formatarDataFimParaApi(osDataFim));
      if (osStatus) params.append('status', osStatus);
      params.append('page', String(osPage));
      params.append('size', '15');
      // Otimização UX008-08: se apenas mudou a página, evita recalcular 5 queries agregadas
      if (apenasMudancaPagina) {
        params.append('incluirResumo', 'false');
      }

      const data = await apiFetchJson<RelatorioOsResponse>(`/api/relatorios/ordens-servico?${params.toString()}`);
      setOsRelatorio((prev) => ({
        resumo: data.resumo ?? prev?.resumo ?? {
          totalOs: 0,
          concluidas: 0,
          abertas: 0,
          canceladas: 0,
          valorTotalConcluidas: 0,
        },
        itens: data.itens,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar relatório de Ordens de Serviço');
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
      if (movDataInicio) params.append('dataInicio', formatarDataInicioParaApi(movDataInicio));
      if (movDataFim) params.append('dataFim', formatarDataFimParaApi(movDataFim));
      if (movTipo) params.append('tipo', movTipo);
      if (movNumeroOsDebounced.trim()) params.append('numeroOs', movNumeroOsDebounced.trim());
      params.append('page', String(movPage));
      params.append('size', '15');

      const data = await apiFetchJson<PageResponse<EstoqueMovimentacao>>(`/api/relatorios/movimentacoes?${params.toString()}`);
      setMovRelatorio(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar relatório de movimentações');
    } finally {
      setIsLoading(false);
    }
  }, [movDataInicio, movDataFim, movTipo, movNumeroOsDebounced, movPage]);

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
      setError(err instanceof Error ? err.message : 'Erro ao buscar ranking de peças');
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
  // EXPORTAÇÃO CSV — ZERO WINDOW.ALERT() (UX008-01)
  // ----------------------------------------------------

  const handleExportarCsvOs = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const dados = await fetchTodosRegistrosRelatorio<OrdemServico>(async (page, size) => {
        const params = new URLSearchParams();
        if (osDataInicio) params.append('dataInicio', formatarDataInicioParaApi(osDataInicio));
        if (osDataFim) params.append('dataFim', formatarDataFimParaApi(osDataFim));
        if (osStatus) params.append('status', osStatus);
        params.append('incluirResumo', 'false'); // UX008-08: não reexecuta agregações por página
        params.append('page', String(page));
        params.append('size', String(size));

        const res = await apiFetchJson<RelatorioOsResponse>(`/api/relatorios/ordens-servico?${params.toString()}`);
        return res.itens;
      });

      if (dados.length === 0) {
        mostrarToast('Não há dados de Ordens de Serviço para exportar com os filtros atuais.', 'aviso');
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
        { cabecalho: 'Data Conclusão', acessar: (i) => (i.dataConclusao ? formatarDataHora(i.dataConclusao) : '') },
        { cabecalho: 'Valor Peças (R$)', acessar: (i) => (i.valorPecas ?? 0).toFixed(2).replace('.', ',') },
        { cabecalho: 'Valor Mão de Obra (R$)', acessar: (i) => (i.valorMaoObra ?? 0).toFixed(2).replace('.', ',') },
        { cabecalho: 'Desconto (R$)', acessar: (i) => (i.valorDesconto ?? 0).toFixed(2).replace('.', ',') },
        { cabecalho: 'Valor Total (R$)', acessar: (i) => (i.valorTotal ?? 0).toFixed(2).replace('.', ',') },
      ];
      const csv = gerarCsv(colunas, dados);
      baixarArquivoCsv(csv, `relatorio-ordens-servico-${new Date().toISOString().split('T')[0]}`);
      mostrarToast(`Exportação concluída com sucesso (${dados.length} Ordens de Serviço).`, 'sucesso');
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao exportar relatório de Ordens de Serviço.', 'erro');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportarCsvEstoque = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const dados = await fetchTodosRegistrosRelatorio<RelatorioEstoqueItem>(async (page, size) => {
        const params = new URLSearchParams();
        if (estoqueCategoriaId) params.append('categoriaId', estoqueCategoriaId);
        if (estoqueFornecedorId) params.append('fornecedorId', estoqueFornecedorId);
        if (estoqueBaixo) params.append('estoqueBaixo', 'true');
        if (estoqueZerado) params.append('zerado', 'true');
        params.append('page', String(page));
        params.append('size', String(size));

        return await apiFetchJson<PageResponse<RelatorioEstoqueItem>>(`/api/relatorios/estoque?${params.toString()}`);
      });

      if (dados.length === 0) {
        mostrarToast('Não há dados de estoque para exportar com os filtros atuais.', 'aviso');
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
      mostrarToast(`Exportação concluída com sucesso (${dados.length} produtos/peças).`, 'sucesso');
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao exportar relatório de estoque.', 'erro');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportarCsvMovimentacoes = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const dados = await fetchTodosRegistrosRelatorio<EstoqueMovimentacao>(async (page, size) => {
        const params = new URLSearchParams();
        if (movDataInicio) params.append('dataInicio', formatarDataInicioParaApi(movDataInicio));
        if (movDataFim) params.append('dataFim', formatarDataFimParaApi(movDataFim));
        if (movTipo) params.append('tipo', movTipo);
        if (movNumeroOsDebounced.trim()) params.append('numeroOs', movNumeroOsDebounced.trim());
        params.append('page', String(page));
        params.append('size', String(size));

        return await apiFetchJson<PageResponse<EstoqueMovimentacao>>(`/api/relatorios/movimentacoes?${params.toString()}`);
      });

      if (dados.length === 0) {
        mostrarToast('Não há dados de movimentações para exportar com os filtros atuais.', 'aviso');
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
      mostrarToast(`Exportação concluída com sucesso (${dados.length} movimentações).`, 'sucesso');
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao exportar relatório de movimentações.', 'erro');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportarCsvPecas = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const dados = await fetchTodosRegistrosRelatorio<PecaMaisUtilizada>(async (page, size) => {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('size', String(size));

        return await apiFetchJson<PageResponse<PecaMaisUtilizada>>(`/api/relatorios/pecas-mais-utilizadas?${params.toString()}`);
      });

      if (dados.length === 0) {
        mostrarToast('Não há dados de peças para exportar.', 'aviso');
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
      mostrarToast(`Exportação concluída com sucesso (${dados.length} peças ranqueadas).`, 'sucesso');
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao exportar ranking de peças.', 'erro');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportarCsvClientes = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const dados = await fetchTodosRegistrosRelatorio<RelatorioClienteItem>(async (page, size) => {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('size', String(size));

        return await apiFetchJson<PageResponse<RelatorioClienteItem>>(`/api/relatorios/clientes?${params.toString()}`);
      });

      if (dados.length === 0) {
        mostrarToast('Não há dados de clientes para exportar.', 'aviso');
        return;
      }
      const colunas: ColunaCsv<RelatorioClienteItem>[] = [
        { cabecalho: 'ID', acessar: (i) => i.clienteId },
        { cabecalho: 'Nome / Razão Social', acessar: (i) => i.nomeRazaoSocial },
        { cabecalho: 'CPF / CNPJ', acessar: (i) => formatarDocumento(i.cpfCnpj) },
        { cabecalho: 'Telefone', acessar: (i) => formatarTelefone(i.telefone) },
        { cabecalho: 'Qtd Equipamentos', acessar: (i) => i.quantidadeEquipamentos ?? 0 },
        { cabecalho: 'Qtd Ordens de Serviço', acessar: (i) => i.quantidadeOs ?? 0 },
        { cabecalho: 'Última Visita', acessar: (i) => (i.ultimaVisita ? formatarDataHora(i.ultimaVisita) : '') },
        { cabecalho: 'Valor Acumulado (R$)', acessar: (i) => (i.valorAcumulado ?? 0).toFixed(2).replace('.', ',') },
      ];
      const csv = gerarCsv(colunas, dados);
      baixarArquivoCsv(csv, `relatorio-clientes-${new Date().toISOString().split('T')[0]}`);
      mostrarToast(`Exportação concluída com sucesso (${dados.length} clientes).`, 'sucesso');
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao exportar relatório de clientes.', 'erro');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportarCsvEquipamentos = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const dados = await fetchTodosRegistrosRelatorio<RelatorioMaquinaItem>(async (page, size) => {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('size', String(size));

        return await apiFetchJson<PageResponse<RelatorioMaquinaItem>>(`/api/relatorios/equipamentos?${params.toString()}`);
      });

      if (dados.length === 0) {
        mostrarToast('Não há dados de equipamentos para exportar.', 'aviso');
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
        { cabecalho: 'Última Manutenção', acessar: (i) => (i.ultimaManutencao ? formatarDataHora(i.ultimaManutencao) : '') },
        { cabecalho: 'Valor Acumulado (R$)', acessar: (i) => (i.valorAcumulado ?? 0).toFixed(2).replace('.', ',') },
      ];
      const csv = gerarCsv(colunas, dados);
      baixarArquivoCsv(csv, `relatorio-equipamentos-${new Date().toISOString().split('T')[0]}`);
      mostrarToast(`Exportação concluída com sucesso (${dados.length} equipamentos).`, 'sucesso');
    } catch (err: unknown) {
      mostrarToast(err instanceof Error ? err.message : 'Erro ao exportar relatório de equipamentos.', 'erro');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportarCsvAtivo = async () => {
    switch (activeTab) {
      case 'ordens-servico': await handleExportarCsvOs(); break;
      case 'estoque': await handleExportarCsvEstoque(); break;
      case 'movimentacoes': await handleExportarCsvMovimentacoes(); break;
      case 'pecas-mais-utilizadas': await handleExportarCsvPecas(); break;
      case 'clientes': await handleExportarCsvClientes(); break;
      case 'equipamentos': await handleExportarCsvEquipamentos(); break;
    }
  };

  const rotuloExportarAtivo = useMemo(() => {
    switch (activeTab) {
      case 'ordens-servico': return 'Exportar OS (CSV)';
      case 'estoque': return 'Exportar Estoque (CSV)';
      case 'movimentacoes': return 'Exportar Movimentações (CSV)';
      case 'pecas-mais-utilizadas': return 'Exportar Peças (CSV)';
      case 'clientes': return 'Exportar Clientes (CSV)';
      case 'equipamentos': return 'Exportar Equipamentos (CSV)';
    }
  }, [activeTab]);

  // Contagem de filtros ativos para feedback visual (UX008-06)
  const filtrosAtivosContador = useMemo(() => {
    let count = 0;
    if (activeTab === 'ordens-servico') {
      if (osDataInicio) count++;
      if (osDataFim) count++;
      if (osStatus) count++;
    } else if (activeTab === 'estoque') {
      if (estoqueCategoriaId) count++;
      if (estoqueFornecedorId) count++;
      if (estoqueBaixo) count++;
      if (estoqueZerado) count++;
    } else if (activeTab === 'movimentacoes') {
      if (movDataInicio) count++;
      if (movDataFim) count++;
      if (movTipo) count++;
      if (movNumeroOsInput.trim()) count++;
    }
    return count;
  }, [
    activeTab,
    osDataInicio,
    osDataFim,
    osStatus,
    estoqueCategoriaId,
    estoqueFornecedorId,
    estoqueBaixo,
    estoqueZerado,
    movDataInicio,
    movDataFim,
    movTipo,
    movNumeroOsInput,
  ]);

  // Pílulas de Presets de Data (UX008-05)
  const renderPresetsData = (
    dataInicio: string,
    dataFim: string,
    onAplicar: (inicio: string, fim: string) => void
  ) => {
    const presetAtivo = identificarPresetAtivo(dataInicio, dataFim);
    const presets: { id: PresetPeriodo; label: string }[] = [
      { id: 'hoje', label: 'Hoje' },
      { id: '7dias', label: '7 Dias' },
      { id: '30dias', label: '30 Dias' },
      { id: 'mesAtual', label: 'Mês Atual' },
    ];

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mr-0.5">
          Período:
        </span>
        {presets.map((p) => {
          const ativo = presetAtivo === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                const datas = calcularIntervaloPreset(p.id);
                onAplicar(datas.dataInicio, datas.dataFim);
              }}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                ativo
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {p.label}
            </button>
          );
        })}
        {(dataInicio || dataFim) && (
          <button
            type="button"
            onClick={() => onAplicar('', '')}
            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer flex items-center gap-1"
            title="Limpar datas"
          >
            <X className="w-3 h-3 text-slate-400" />
            <span>Limpar</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      {/* Toast Notification (UX008-01 - feedback visual não-bloqueante) */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`p-3.5 rounded-xl shadow-2xl border flex items-center gap-3 text-xs max-w-md ${
              toast.tipo === 'sucesso'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : toast.tipo === 'erro'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                : 'bg-amber-950/90 border-amber-500/40 text-amber-200'
            }`}
          >
            {toast.tipo === 'sucesso' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.tipo === 'erro' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.tipo === 'aviso' && <Info className="w-4 h-4 text-amber-400 shrink-0" />}
            <span className="flex-1 font-medium">{toast.mensagem}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-3.5 sm:p-5 space-y-4">
        {/* CABEÇALHO COMPACTO V1.1 (UX008-02) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Relatórios Gerenciais
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-400">
                Consultas da Oficina
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">
              Indicadores consolidados de ordens de serviço, posição de estoque, consumo de peças, clientes e equipamentos.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Botão de Exportação CSV Unificado Contextual (UX008-04) */}
            <button
              type="button"
              onClick={handleExportarCsvAtivo}
              disabled={isLoading || isExporting}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
              title="Exportar dados filtrados da aba ativa em formato CSV completo"
            >
              <Download className={`w-3.5 h-3.5 text-emerald-400 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Exportando...' : rotuloExportarAtivo}</span>
            </button>

            {/* Botão Atualizar */}
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
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Atualizar dados da aba atual"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* Mensagem de Erro Global */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ABAS SLIM DE NAVEGAÇÃO (6 RELATÓRIOS OFICIAIS) */}
        <div className="border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-px">
          <button
            type="button"
            onClick={() => { setActiveTab('ordens-servico'); setOsPage(0); }}
            className={`px-3 py-2 rounded-t-lg text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ordens-servico'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Ordens de Serviço</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('estoque'); setEstoquePage(0); }}
            className={`px-3 py-2 rounded-t-lg text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'estoque'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Situação do Estoque</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('movimentacoes'); setMovPage(0); }}
            className={`px-3 py-2 rounded-t-lg text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'movimentacoes'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Movimentações</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('pecas-mais-utilizadas'); setPecasPage(0); }}
            className={`px-3 py-2 rounded-t-lg text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pecas-mais-utilizadas'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Peças Mais Utilizadas</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('clientes'); setClientesPage(0); }}
            className={`px-3 py-2 rounded-t-lg text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'clientes'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Clientes</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('equipamentos'); setEquipamentosPage(0); }}
            className={`px-3 py-2 rounded-t-lg text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'equipamentos'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Equipamentos</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* ABA 1: ORDENS DE SERVIÇO                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'ordens-servico' && (
          <div className="space-y-3.5">
            {/* Barra de Filtros Compacta com Presets */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* Presets Rápidos */}
                {renderPresetsData(osDataInicio, osDataFim, (ini, fim) => {
                  setOsDataInicio(ini);
                  setOsDataFim(fim);
                  setOsPage(0);
                })}

                {/* Badge de Filtros Ativos */}
                {filtrosAtivosContador > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {filtrosAtivosContador} {filtrosAtivosContador === 1 ? 'filtro ativo' : 'filtros ativos'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOsDataInicio('');
                        setOsDataFim('');
                        setOsStatus('');
                        setOsPage(0);
                      }}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Limpar todos
                    </button>
                  </div>
                )}
              </div>

              {/* Linha de Inputs de Filtro */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-slate-800/60">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-500" />
                    Data Inicial:
                  </label>
                  <input
                    type="date"
                    value={osDataInicio}
                    onChange={(e) => { setOsDataInicio(e.target.value); setOsPage(0); }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-500" />
                    Data Final:
                  </label>
                  <input
                    type="date"
                    value={osDataFim}
                    onChange={(e) => { setOsDataFim(e.target.value); setOsPage(0); }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-amber-500" />
                    Status da Ordem:
                  </label>
                  <select
                    value={osStatus}
                    onChange={(e) => { setOsStatus(e.target.value); setOsPage(0); }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Todos os Status</option>
                    {Object.entries(STATUS_ORDEM_SERVICO_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* MINI-CARDS DE RESUMO CONDENSADOS (UX008-02 / UX008-08) */}
            {osRelatorio?.resumo && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total OS</span>
                    <span className="text-base font-black text-white">{osRelatorio.resumo.totalOs}</span>
                  </div>
                  <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                </div>

                <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Concluídas</span>
                    <span className="text-base font-black text-emerald-400">{osRelatorio.resumo.concluidas}</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>

                <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Abertas / Curso</span>
                    <span className="text-base font-black text-sky-400">{osRelatorio.resumo.abertas}</span>
                  </div>
                  <Clock className="w-4 h-4 text-sky-500 shrink-0" />
                </div>

                <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Canceladas</span>
                    <span className="text-base font-black text-rose-400">{osRelatorio.resumo.canceladas}</span>
                  </div>
                  <Ban className="w-4 h-4 text-rose-500 shrink-0" />
                </div>

                <div className="col-span-2 sm:col-span-1 px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Faturamento</span>
                    <span className="text-base font-black text-white">
                      {formatarMoeda(osRelatorio.resumo.valorTotalConcluidas)}
                    </span>
                  </div>
                  <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                </div>
              </div>
            )}

            {/* TABELA DE ORDENS DE SERVIÇO */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3">Nº OS</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Equipamento</th>
                      <th className="p-3">Entrada</th>
                      <th className="p-3">Conclusão</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Valor Total</th>
                      <th className="p-3 text-center">Ações</th>
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
                        <td colSpan={8} className="p-8 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                            <FileText className="w-8 h-8 text-slate-600" />
                            <span className="font-semibold text-slate-300">
                              {filtrosAtivosContador > 0
                                ? 'Nenhum resultado encontrado para os filtros atuais.'
                                : 'Nenhuma Ordem de Serviço registrada no sistema.'}
                            </span>
                            {filtrosAtivosContador > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOsDataInicio('');
                                  setOsDataFim('');
                                  setOsStatus('');
                                  setOsPage(0);
                                }}
                                className="mt-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold transition-all cursor-pointer"
                              >
                                Limpar filtros
                              </button>
                            )}
                          </div>
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
                            <td className="p-3 font-mono font-bold text-amber-400">{item.numeroOs}</td>
                            <td className="p-3 font-medium text-white">{item.clienteNome}</td>
                            <td className="p-3 text-slate-300">
                              {item.maquinaMarca} {item.maquinaModelo}
                            </td>
                            <td className="p-3 text-slate-400">{formatarDataHora(item.dataEntrada)}</td>
                            <td className="p-3 text-slate-400">
                              {item.dataConclusao ? formatarDataHora(item.dataConclusao) : '—'}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {item.statusDescricao}
                              </span>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-100">
                              {formatarMoeda(item.valorTotal)}
                            </td>
                            <td className="p-3 text-center">
                              <Link
                                href={`/ordens-servico/${item.id}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-[11px] transition-all"
                                title="Visualizar Cockpit da OS"
                              >
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
                <div className="p-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{osRelatorio.itens.totalElements}</strong> ordens
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={osPage === 0}
                      onClick={() => {
                        setOsPage((prev) => Math.max(0, prev - 1));
                        fetchOsRelatorio(true);
                      }}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span>
                      Página <strong>{osPage + 1}</strong> de <strong>{osRelatorio.itens.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={osPage >= osRelatorio.itens.totalPages - 1}
                      onClick={() => {
                        setOsPage((prev) => prev + 1);
                        fetchOsRelatorio(true);
                      }}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
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
          <div className="space-y-3.5">
            {/* Barra de Filtros de Estoque */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="min-w-[180px] flex-1 sm:flex-initial">
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Categoria:</label>
                  <select
                    value={estoqueCategoriaId}
                    onChange={(e) => { setEstoqueCategoriaId(e.target.value); setEstoquePage(0); }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Todas as Categorias</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="min-w-[180px] flex-1 sm:flex-initial">
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Fornecedor:</label>
                  <select
                    value={estoqueFornecedorId}
                    onChange={(e) => { setEstoqueFornecedorId(e.target.value); setEstoquePage(0); }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Todos os Fornecedores</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>{f.razaoSocial}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-4 sm:pt-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={estoqueBaixo}
                      onChange={(e) => { setEstoqueBaixo(e.target.checked); setEstoquePage(0); }}
                      className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Apenas Estoque Baixo</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={estoqueZerado}
                      onChange={(e) => { setEstoqueZerado(e.target.checked); setEstoquePage(0); }}
                      className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Apenas Zerados</span>
                  </label>
                </div>
              </div>

              {filtrosAtivosContador > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEstoqueCategoriaId('');
                    setEstoqueFornecedorId('');
                    setEstoqueBaixo(false);
                    setEstoqueZerado(false);
                    setEstoquePage(0);
                  }}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer self-center"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {/* TABELA DE ESTOQUE */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3">Código</th>
                      <th className="p-3">Produto / Peça</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Fornecedor</th>
                      <th className="p-3 text-right">Estoque Atual</th>
                      <th className="p-3 text-right">Estoque Mínimo</th>
                      <th className="p-3 text-center">Status</th>
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
                        <td colSpan={7} className="p-8 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                            <Boxes className="w-8 h-8 text-slate-600" />
                            <span className="font-semibold text-slate-300">
                              {filtrosAtivosContador > 0
                                ? 'Nenhum resultado encontrado para os filtros atuais.'
                                : 'Nenhum produto cadastrado no estoque.'}
                            </span>
                            {filtrosAtivosContador > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEstoqueCategoriaId('');
                                  setEstoqueFornecedorId('');
                                  setEstoqueBaixo(false);
                                  setEstoqueZerado(false);
                                  setEstoquePage(0);
                                }}
                                className="mt-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold transition-all cursor-pointer"
                              >
                                Limpar filtros
                              </button>
                            )}
                          </div>
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
                            <td className="p-3 font-mono font-bold text-amber-400">{item.codigo}</td>
                            <td className="p-3 font-medium text-white">
                              {item.nome}
                              {item.marca && <span className="text-slate-400 ml-1.5 text-[11px]">({item.marca})</span>}
                            </td>
                            <td className="p-3 text-slate-300">{item.categoriaNome || '—'}</td>
                            <td className="p-3 text-slate-400">{item.fornecedorNome || '—'}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-100">
                              {Number(item.estoqueAtual).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-400">
                              {Number(item.estoqueMinimo).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}>
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
                <div className="p-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{estoqueRelatorio.totalElements}</strong> itens
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={estoquePage === 0}
                      onClick={() => setEstoquePage((prev) => Math.max(0, prev - 1))}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span>
                      Página <strong>{estoquePage + 1}</strong> de <strong>{estoqueRelatorio.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={estoquePage >= estoqueRelatorio.totalPages - 1}
                      onClick={() => setEstoquePage((prev) => prev + 1)}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
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
          <div className="space-y-3.5">
            {/* Barra de Filtros com Presets de Data e Busca com Debounce (UX008-06) */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {renderPresetsData(movDataInicio, movDataFim, (ini, fim) => {
                  setMovDataInicio(ini);
                  setMovDataFim(fim);
                  setMovPage(0);
                })}

                {filtrosAtivosContador > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {filtrosAtivosContador} {filtrosAtivosContador === 1 ? 'filtro ativo' : 'filtros ativos'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMovDataInicio('');
                        setMovDataFim('');
                        setMovTipo('');
                        setMovNumeroOsInput('');
                        setMovPage(0);
                      }}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Limpar todos
                    </button>
                  </div>
                )}
              </div>

              {/* Inputs de Filtro */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1 border-t border-slate-800/60">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Data Inicial:</label>
                  <input
                    type="date"
                    value={movDataInicio}
                    onChange={(e) => { setMovDataInicio(e.target.value); setMovPage(0); }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Data Final:</label>
                  <input
                    type="date"
                    value={movDataFim}
                    onChange={(e) => { setMovDataFim(e.target.value); setMovPage(0); }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Tipo de Movimentação:</label>
                  <select
                    value={movTipo}
                    onChange={(e) => { setMovTipo(e.target.value); setMovPage(0); }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Todos os Tipos</option>
                    {Object.entries(TIPO_MOVIMENTACAO_ESTOQUE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                    <span>Número da OS:</span>
                    {movNumeroOsInput && movNumeroOsInput !== movNumeroOsDebounced && (
                      <span className="text-[9px] text-amber-400 animate-pulse">buscando...</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ex: OS-2026-0001"
                      value={movNumeroOsInput}
                      onChange={(e) => setMovNumeroOsInput(e.target.value)}
                      className="w-full pl-2.5 pr-7 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                    />
                    {movNumeroOsInput && (
                      <button
                        type="button"
                        onClick={() => setMovNumeroOsInput('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* TABELA DE MOVIMENTAÇÕES */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3">Data / Hora</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Produto</th>
                      <th className="p-3 text-right">Qtd</th>
                      <th className="p-3 text-right">Saldo Ant.</th>
                      <th className="p-3 text-right">Novo Saldo</th>
                      <th className="p-3">OS Vinculada</th>
                      <th className="p-3">Motivo / Obs</th>
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
                        <td colSpan={8} className="p-8 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                            <ArrowLeftRight className="w-8 h-8 text-slate-600" />
                            <span className="font-semibold text-slate-300">
                              {filtrosAtivosContador > 0
                                ? 'Nenhum resultado encontrado para os filtros atuais.'
                                : 'Nenhuma movimentação registrada no estoque.'}
                            </span>
                            {filtrosAtivosContador > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMovDataInicio('');
                                  setMovDataFim('');
                                  setMovTipo('');
                                  setMovNumeroOsInput('');
                                  setMovPage(0);
                                }}
                                className="mt-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold transition-all cursor-pointer"
                              >
                                Limpar filtros
                              </button>
                            )}
                          </div>
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
                            <td className="p-3 text-slate-400 whitespace-nowrap">{formatarDataHora(m.dataMovimentacao)}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {m.tipoDescricao}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-white">
                              <span className="font-mono text-amber-400 mr-1.5">{m.produtoCodigo}</span>
                              {m.produtoNome}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-100">
                              {Number(m.quantidade).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-400">
                              {Number(m.quantidadeAnterior).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-200">
                              {Number(m.quantidadePosterior).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3">
                              {m.ordemServicoNumero ? (
                                <Link
                                  href={`/ordens-servico/${m.ordemServicoId || ''}`}
                                  className="font-mono text-xs text-amber-400 hover:underline font-semibold"
                                >
                                  {m.ordemServicoNumero}
                                </Link>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-400 max-w-xs truncate" title={m.motivo}>
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
                <div className="p-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{movRelatorio.totalElements}</strong> movimentações
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={movPage === 0}
                      onClick={() => setMovPage((prev) => Math.max(0, prev - 1))}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span>
                      Página <strong>{movPage + 1}</strong> de <strong>{movRelatorio.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={movPage >= movRelatorio.totalPages - 1}
                      onClick={() => setMovPage((prev) => prev + 1)}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
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
          <div className="space-y-3.5">
            {/* Banner Compacto com Destaque */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Ranking de Consumo de Peças em Ordens de Serviço</h3>
                  <p className="text-[11px] text-slate-400">Identificação de componentes técnicos de maior giro para compras e reposição preventiva.</p>
                </div>
              </div>
            </div>

            {/* TABELA DE PEÇAS MAIS UTILIZADAS */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3 text-center w-16">Posição</th>
                      <th className="p-3">Código</th>
                      <th className="p-3">Componente / Peça</th>
                      <th className="p-3">Marca</th>
                      <th className="p-3 text-right">Qtd Total Utilizada</th>
                      <th className="p-3 text-right">Qtd de OS Atendidas</th>
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
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <TrendingUp className="w-8 h-8 text-slate-600" />
                            <span className="font-semibold text-slate-300">Nenhuma peça foi aplicada em ordens de serviço até o momento.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pecasRelatorio.content.map((p, idx) => {
                        const rank = pecasPage * 15 + idx + 1;
                        return (
                          <tr key={p.produtoId} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 text-center font-bold">
                              {rank === 1 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[11px]">
                                  1º
                                </span>
                              ) : rank === 2 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-300/20 text-slate-200 border border-slate-400/30 text-[11px]">
                                  2º
                                </span>
                              ) : rank === 3 ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-700/20 text-amber-500 border border-amber-700/30 text-[11px]">
                                  3º
                                </span>
                              ) : (
                                <span className="text-slate-500 font-mono">{rank}º</span>
                              )}
                            </td>
                            <td className="p-3 font-mono font-bold text-amber-400">{p.codigo}</td>
                            <td className="p-3 font-semibold text-white">{p.nome}</td>
                            <td className="p-3 text-slate-400">{p.marca || '—'}</td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-400 text-sm">
                              {Number(p.quantidadeTotalUtilizada).toLocaleString('pt-BR')}
                            </td>
                            <td className="p-3 text-right font-mono font-semibold text-slate-200">
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
                <div className="p-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{pecasRelatorio.totalElements}</strong> peças distintas
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pecasPage === 0}
                      onClick={() => setPecasPage((prev) => Math.max(0, prev - 1))}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span>
                      Página <strong>{pecasPage + 1}</strong> de <strong>{pecasRelatorio.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={pecasPage >= pecasRelatorio.totalPages - 1}
                      onClick={() => setPecasPage((prev) => prev + 1)}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
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
          <div className="space-y-3.5">
            {/* Banner Compacto */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Consolidado Financeiro e Histórico por Cliente</h3>
                  <p className="text-[11px] text-slate-400">Volume de máquinas vinculadas, histórico de ordens de serviço e receita acumulada.</p>
                </div>
              </div>
            </div>

            {/* TABELA DE CLIENTES */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3">Cliente / Razão Social</th>
                      <th className="p-3">CPF / CNPJ</th>
                      <th className="p-3">Telefone</th>
                      <th className="p-3 text-center">Máquinas</th>
                      <th className="p-3 text-center">Total OS</th>
                      <th className="p-3">Última Manutenção</th>
                      <th className="p-3 text-right">Faturamento Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span>Carregando dados de clientes...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !clientesRelatorio?.content || clientesRelatorio.content.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Users className="w-8 h-8 text-slate-600" />
                            <span className="font-semibold text-slate-300">Nenhum cliente cadastrado no sistema.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      clientesRelatorio.content.map((c) => (
                        <tr key={c.clienteId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-bold text-white">{c.nomeRazaoSocial}</td>
                          <td className="p-3 font-mono text-slate-400">{formatarDocumento(c.cpfCnpj)}</td>
                          <td className="p-3 text-slate-400">{formatarTelefone(c.telefone)}</td>
                          <td className="p-3 text-center font-mono font-semibold text-slate-200">
                            {c.quantidadeEquipamentos}
                          </td>
                          <td className="p-3 text-center font-mono font-semibold text-slate-200">
                            {c.quantidadeOs}
                          </td>
                          <td className="p-3 text-slate-400">
                            {c.ultimaVisita ? formatarDataHora(c.ultimaVisita) : '—'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-400 text-sm">
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
                <div className="p-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{clientesRelatorio.totalElements}</strong> clientes
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={clientesPage === 0}
                      onClick={() => setClientesPage((prev) => Math.max(0, prev - 1))}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span>
                      Página <strong>{clientesPage + 1}</strong> de <strong>{clientesRelatorio.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={clientesPage >= clientesRelatorio.totalPages - 1}
                      onClick={() => setClientesPage((prev) => prev + 1)}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
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
          <div className="space-y-3.5">
            {/* Banner Compacto */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Consolidado Técnico e Histórico por Equipamento</h3>
                  <p className="text-[11px] text-slate-400">
                    Máquinas de solda e geradores atendidos na bancada, quantidade de manutenções e faturamento acumulado.
                  </p>
                </div>
              </div>
            </div>

            {/* TABELA DE EQUIPAMENTOS */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Marca / Modelo</th>
                      <th className="p-3">Nº de Série</th>
                      <th className="p-3">Cliente Proprietário</th>
                      <th className="p-3 text-center">Manutenções (OS)</th>
                      <th className="p-3">Última Manutenção</th>
                      <th className="p-3 text-right">Faturamento Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <span>Carregando equipamentos...</span>
                          </div>
                        </td>
                      </tr>
                    ) : !equipamentosRelatorio?.content || equipamentosRelatorio.content.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Wrench className="w-8 h-8 text-slate-600" />
                            <span className="font-semibold text-slate-300">Nenhum equipamento cadastrado no sistema.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      equipamentosRelatorio.content.map((m) => (
                        <tr key={m.maquinaId} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                              {TIPO_EQUIPAMENTO_LABELS[m.tipo] || m.tipo}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-white">
                            {m.marca} {m.modelo}
                          </td>
                          <td className="p-3 font-mono text-slate-400">{m.numeroSerie || 'S/N'}</td>
                          <td className="p-3 font-medium text-slate-200">{m.clienteNome}</td>
                          <td className="p-3 text-center font-mono font-semibold text-slate-200">
                            {m.quantidadeOs}
                          </td>
                          <td className="p-3 text-slate-400">
                            {m.ultimaManutencao ? formatarDataHora(m.ultimaManutencao) : '—'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-400 text-sm">
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
                <div className="p-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Total: <strong>{equipamentosRelatorio.totalElements}</strong> equipamentos
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={equipamentosPage === 0}
                      onClick={() => setEquipamentosPage((prev) => Math.max(0, prev - 1))}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span>
                      Página <strong>{equipamentosPage + 1}</strong> de <strong>{equipamentosRelatorio.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={equipamentosPage >= equipamentosRelatorio.totalPages - 1}
                      onClick={() => setEquipamentosPage((prev) => prev + 1)}
                      className="p-1 rounded-md bg-slate-800 text-slate-200 disabled:opacity-40 hover:bg-slate-700 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
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
