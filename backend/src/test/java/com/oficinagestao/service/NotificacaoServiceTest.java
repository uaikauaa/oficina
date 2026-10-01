package com.oficinagestao.service;

import com.oficinagestao.dto.NotificacaoResponseDTO;
import com.oficinagestao.dto.NotificacoesResumoDTO;
import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.Notificacao;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.TipoNotificacao;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.NotificacaoRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificacaoServiceTest {

    @Mock
    private NotificacaoRepository notificacaoRepository;

    @Mock
    private OrdemServicoRepository ordemServicoRepository;

    @Mock
    private ProdutoRepository produtoRepository;

    @InjectMocks
    private NotificacaoService notificacaoService;

    private Notificacao notificacao;

    @BeforeEach
    void setUp() {
        notificacao = new Notificacao(
                TipoNotificacao.OS_AGUARDANDO_APROVACAO,
                "Aguardando Aprovação: OS OS-2026-0001",
                "A OS OS-2026-0001 aguarda aprovação",
                "ORDEM_SERVICO",
                1L,
                "/ordens-servico?busca=OS-2026-0001",
                "OS_AGUARDANDO_APROVACAO_1"
        );
        notificacao.setCriadoEm(OffsetDateTime.now());
    }

    @Test
    @DisplayName("Deve criar notificação com sucesso e invocar upsert atômico")
    void deveCriarNotificacaoComSucesso() {
        when(notificacaoRepository.findByChaveUnica("OS_AGUARDANDO_APROVACAO_1")).thenReturn(Optional.of(notificacao));

        Notificacao criada = notificacaoService.criarOuAtualizarNotificacao(
                TipoNotificacao.OS_AGUARDANDO_APROVACAO,
                "Aguardando Aprovação: OS OS-2026-0001",
                "Mensagem de teste",
                "ORDEM_SERVICO",
                1L,
                "/ordens-servico?busca=OS-2026-0001",
                "OS_AGUARDANDO_APROVACAO_1"
        );

        assertNotNull(criada);
        assertEquals(TipoNotificacao.OS_AGUARDANDO_APROVACAO, criada.getTipo());
        verify(notificacaoRepository, times(1)).upsertNotificacao(
                eq("OS_AGUARDANDO_APROVACAO"),
                eq("Aguardando Aprovação: OS OS-2026-0001"),
                eq("Mensagem de teste"),
                any(OffsetDateTime.class),
                eq("ORDEM_SERVICO"),
                eq(1L),
                eq("/ordens-servico?busca=OS-2026-0001"),
                eq("OS_AGUARDANDO_APROVACAO_1")
        );
    }

    @Test
    @DisplayName("Deve resolver notificação inativando e marcando como lida")
    void deveResolverNotificacaoInativando() {
        when(notificacaoRepository.findByChaveUnica("OS_AGUARDANDO_APROVACAO_1")).thenReturn(Optional.of(notificacao));

        notificacaoService.resolverNotificacao("OS_AGUARDANDO_APROVACAO_1");

        assertFalse(notificacao.isAtivo());
        assertTrue(notificacao.isLida());
        verify(notificacaoRepository, times(1)).save(notificacao);
    }

    @Test
    @DisplayName("Deve listar notificações recentes com resumo e contadores")
    void deveListarRecentesComResumo() {
        when(notificacaoRepository.findByAtivoTrueOrderByCriadoEmDesc(any(Pageable.class))).thenReturn(List.of(notificacao));
        when(notificacaoRepository.countByAtivoTrue()).thenReturn(1L);
        when(notificacaoRepository.countByLidaFalseAndAtivoTrue()).thenReturn(1L);

        NotificacoesResumoDTO resumo = notificacaoService.listarRecentes();

        assertNotNull(resumo);
        assertEquals(1L, resumo.total());
        assertEquals(1L, resumo.naoLidas());
        assertEquals(1, resumo.notificacoes().size());
        assertEquals("OS_AGUARDANDO_APROVACAO", resumo.notificacoes().get(0).tipo().name());
    }

    @Test
    @DisplayName("Deve marcar notificação específica como lida")
    void deveMarcarComoLidaComSucesso() {
        when(notificacaoRepository.findById(1L)).thenReturn(Optional.of(notificacao));
        when(notificacaoRepository.save(any(Notificacao.class))).thenAnswer(inv -> inv.getArgument(0));

        NotificacaoResponseDTO dto = notificacaoService.marcarComoLida(1L);

        assertTrue(dto.lida());
        assertNotNull(dto.lidoEm());
        verify(notificacaoRepository, times(1)).save(notificacao);
    }

    @Test
    @DisplayName("Deve lançar ResourceNotFoundException ao tentar marcar notificação inexistente como lida")
    void deveLancarExceptionAoMarcarInexistenteComoLida() {
        when(notificacaoRepository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> notificacaoService.marcarComoLida(99L));
        verify(notificacaoRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve marcar todas as notificações ativas como lidas")
    void deveMarcarTodasComoLidas() {
        when(notificacaoRepository.marcarTodasComoLidas(any(OffsetDateTime.class))).thenReturn(5);

        int afetadas = notificacaoService.marcarTodasComoLidas();

        assertEquals(5, afetadas);
        verify(notificacaoRepository, times(1)).marcarTodasComoLidas(any(OffsetDateTime.class));
    }

    @Test
    @DisplayName("Deve criar notificação de OS Aguardando Aprovação com cliente e número de OS")
    void deveCriarNotificacaoOsAguardandoAprovacao() {
        Cliente cliente = new Cliente();
        cliente.setNomeRazaoSocial("Cliente Metalúrgica");

        OrdemServico os = new OrdemServico();
        os.setId(50L);
        os.setNumeroOs("OS-2026-0050");
        os.setCliente(cliente);

        Notificacao notif = new Notificacao();
        notif.setTipo(TipoNotificacao.OS_AGUARDANDO_APROVACAO);
        notif.setChaveUnica("OS_AGUARDANDO_APROVACAO_50");
        notif.setTitulo("Aguardando Aprovação: OS OS-2026-0050");
        notif.setMensagem("A OS OS-2026-0050 (Cliente Metalúrgica) está aguardando aprovação do orçamento.");

        when(notificacaoRepository.findByChaveUnica("OS_AGUARDANDO_APROVACAO_50")).thenReturn(Optional.of(notif));

        notificacaoService.criarNotificacaoOsAguardandoAprovacao(os);

        verify(notificacaoRepository, times(1)).upsertNotificacao(
                eq("OS_AGUARDANDO_APROVACAO"),
                contains("OS-2026-0050"),
                contains("Cliente Metalúrgica"),
                any(OffsetDateTime.class),
                eq("ORDEM_SERVICO"),
                eq(50L),
                eq("/ordens-servico?busca=OS-2026-0050"),
                eq("OS_AGUARDANDO_APROVACAO_50")
        );
    }

    @Test
    @DisplayName("Deve criar notificação de OS Pronta para retirada com equipamento e número de OS")
    void deveCriarNotificacaoOsPronta() {
        Maquina maquina = new Maquina();
        maquina.setMarca("Bosch");
        maquina.setModelo("GWS 850");

        OrdemServico os = new OrdemServico();
        os.setId(60L);
        os.setNumeroOs("OS-2026-0060");
        os.setMaquina(maquina);

        Notificacao notif = new Notificacao();
        notif.setTipo(TipoNotificacao.OS_PRONTA);
        notif.setChaveUnica("OS_PRONTA_60");
        notif.setTitulo("Pronta para Retirada: OS OS-2026-0060");
        notif.setMensagem("A OS OS-2026-0060 (Bosch GWS 850) está pronta para entrega ao cliente.");

        when(notificacaoRepository.findByChaveUnica("OS_PRONTA_60")).thenReturn(Optional.of(notif));

        notificacaoService.criarNotificacaoOsPronta(os);

        verify(notificacaoRepository, times(1)).upsertNotificacao(
                eq("OS_PRONTA"),
                contains("OS-2026-0060"),
                contains("Bosch GWS 850"),
                any(OffsetDateTime.class),
                eq("ORDEM_SERVICO"),
                eq(60L),
                eq("/ordens-servico?busca=OS-2026-0060"),
                eq("OS_PRONTA_60")
        );
    }

    @Test
    @DisplayName("Deve verificar produto e criar notificação quando atingir estoque baixo")
    void deveCriarNotificacaoQuandoEstoqueBaixo() {
        Produto produto = new Produto();
        produto.setId(15L);
        produto.setNome("Broca HSS 10mm");
        produto.setEstoqueAtual(new BigDecimal("2.000"));
        produto.setEstoqueMinimo(new BigDecimal("5.000"));
        produto.setAtivo(true);

        Notificacao notif = new Notificacao();
        notif.setTipo(TipoNotificacao.ESTOQUE_BAIXO);
        notif.setChaveUnica("ESTOQUE_BAIXO_15");
        notif.setTitulo("Estoque Crítico: Broca HSS 10mm");

        when(notificacaoRepository.findByChaveUnica("ESTOQUE_BAIXO_15")).thenReturn(Optional.of(notif));

        notificacaoService.verificarEstoqueProduto(produto);

        verify(notificacaoRepository, times(1)).upsertNotificacao(
                eq("ESTOQUE_BAIXO"),
                contains("Broca HSS 10mm"),
                contains("2.000"),
                any(OffsetDateTime.class),
                eq("PRODUTO"),
                eq(15L),
                eq("/estoque"),
                eq("ESTOQUE_BAIXO_15")
        );
    }

    @Test
    @DisplayName("Deve resolver notificação de estoque quando saldo for normalizado")
    void deveResolverNotificacaoQuandoEstoqueForNormalizado() {
        Produto produto = new Produto();
        produto.setId(15L);
        produto.setNome("Broca HSS 10mm");
        produto.setEstoqueAtual(new BigDecimal("10.000"));
        produto.setEstoqueMinimo(new BigDecimal("5.000"));
        produto.setAtivo(true);

        Notificacao notifEstoque = new Notificacao();
        notifEstoque.setChaveUnica("ESTOQUE_BAIXO_15");
        notifEstoque.setAtivo(true);

        when(notificacaoRepository.findByChaveUnica("ESTOQUE_BAIXO_15")).thenReturn(Optional.of(notifEstoque));

        notificacaoService.verificarEstoqueProduto(produto);

        assertFalse(notifEstoque.isAtivo());
        assertTrue(notifEstoque.isLida());
        verify(notificacaoRepository).save(notifEstoque);
    }
}
