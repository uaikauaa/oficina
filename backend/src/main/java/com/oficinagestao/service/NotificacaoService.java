package com.oficinagestao.service;

import com.oficinagestao.dto.NotificacaoResponseDTO;
import com.oficinagestao.dto.NotificacoesResumoDTO;
import com.oficinagestao.entity.Notificacao;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.StatusOrdemServico;
import com.oficinagestao.entity.TipoNotificacao;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.NotificacaoRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class NotificacaoService {

    private static final Logger log = LoggerFactory.getLogger(NotificacaoService.class);

    private final NotificacaoRepository notificacaoRepository;
    private final OrdemServicoRepository ordemServicoRepository;
    private final ProdutoRepository produtoRepository;

    public NotificacaoService(
            NotificacaoRepository notificacaoRepository,
            OrdemServicoRepository ordemServicoRepository,
            ProdutoRepository produtoRepository
    ) {
        this.notificacaoRepository = notificacaoRepository;
        this.ordemServicoRepository = ordemServicoRepository;
        this.produtoRepository = produtoRepository;
    }

    @Transactional(readOnly = true)
    public NotificacoesResumoDTO listarRecentes() {
        List<Notificacao> lista = notificacaoRepository.findByAtivoTrueOrderByCriadoEmDesc(PageRequest.of(0, 20));
        long total = notificacaoRepository.countByAtivoTrue();
        long naoLidas = notificacaoRepository.countByLidaFalseAndAtivoTrue();

        List<NotificacaoResponseDTO> dtos = lista.stream()
                .map(NotificacaoResponseDTO::fromEntity)
                .toList();

        return new NotificacoesResumoDTO(total, naoLidas, dtos);
    }

    @Transactional
    public NotificacaoResponseDTO marcarComoLida(Long id) {
        Notificacao notificacao = notificacaoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Notificação não encontrada com ID: " + id));

        notificacao.marcarComoLida();
        Notificacao salva = notificacaoRepository.save(notificacao);
        return NotificacaoResponseDTO.fromEntity(salva);
    }

    @Transactional
    public int marcarTodasComoLidas() {
        return notificacaoRepository.marcarTodasComoLidas(OffsetDateTime.now());
    }

    @Transactional
    public Notificacao criarOuAtualizarNotificacao(
            TipoNotificacao tipo,
            String titulo,
            String mensagem,
            String recursoTipo,
            Long recursoId,
            String link,
            String chaveUnica
    ) {
        notificacaoRepository.upsertNotificacao(
                tipo.name(),
                titulo,
                mensagem,
                OffsetDateTime.now(),
                recursoTipo,
                recursoId,
                link,
                chaveUnica
        );
        return notificacaoRepository.findByChaveUnica(chaveUnica)
                .orElseThrow(() -> new IllegalStateException("Falha ao persistir notificação"));
    }

    @Transactional
    public void resolverNotificacao(String chaveUnica) {
        notificacaoRepository.findByChaveUnica(chaveUnica).ifPresent(n -> {
            if (n.isAtivo()) {
                n.setAtivo(false);
                n.setLida(true);
                notificacaoRepository.save(n);
            }
        });
    }

    // Geradores específicos para o domínio

    @Transactional
    public void criarNotificacaoOsAguardandoAprovacao(OrdemServico os) {
        if (os == null || os.getId() == null) return;
        String chave = "OS_AGUARDANDO_APROVACAO_" + os.getId();
        String clienteNome = os.getCliente() != null ? os.getCliente().getNomeRazaoSocial() : "Cliente";
        criarOuAtualizarNotificacao(
                TipoNotificacao.OS_AGUARDANDO_APROVACAO,
                "Aguardando Aprovação: OS " + os.getNumeroOs(),
                "A OS " + os.getNumeroOs() + " (" + clienteNome + ") está aguardando aprovação do orçamento.",
                "ORDEM_SERVICO",
                os.getId(),
                "/ordens-servico?busca=" + os.getNumeroOs(),
                chave
        );
    }

    @Transactional
    public void resolverNotificacaoOsAguardandoAprovacao(Long osId) {
        if (osId == null) return;
        resolverNotificacao("OS_AGUARDANDO_APROVACAO_" + osId);
    }

    @Transactional
    public void criarNotificacaoOsPronta(OrdemServico os) {
        if (os == null || os.getId() == null) return;
        String chave = "OS_PRONTA_" + os.getId();
        String equipamento = os.getMaquina() != null ? (os.getMaquina().getMarca() + " " + os.getMaquina().getModelo()).trim() : "Equipamento";
        criarOuAtualizarNotificacao(
                TipoNotificacao.OS_PRONTA,
                "Pronta para Retirada: OS " + os.getNumeroOs(),
                "A OS " + os.getNumeroOs() + " (" + equipamento + ") está pronta para entrega ao cliente.",
                "ORDEM_SERVICO",
                os.getId(),
                "/ordens-servico?busca=" + os.getNumeroOs(),
                chave
        );
    }

    @Transactional
    public void resolverNotificacaoOsPronta(Long osId) {
        if (osId == null) return;
        resolverNotificacao("OS_PRONTA_" + osId);
    }

    @Transactional
    public void verificarEstoqueProduto(Produto produto) {
        if (produto == null || produto.getId() == null) return;
        String chave = "ESTOQUE_BAIXO_" + produto.getId();
        if (produto.isAtivo() && produto.isEstoqueBaixo()) {
            criarOuAtualizarNotificacao(
                    TipoNotificacao.ESTOQUE_BAIXO,
                    "Estoque Crítico: " + produto.getNome(),
                    "O produto " + produto.getNome() + " atingiu nível crítico (atual: " +
                            produto.getEstoqueAtual() + ", mínimo: " + produto.getEstoqueMinimo() + ").",
                    "PRODUTO",
                    produto.getId(),
                    "/estoque",
                    chave
            );
        } else {
            resolverNotificacao(chave);
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void sincronizarNotificacoesIniciais() {
        try {
            log.info("Sincronizando estado inicial de notificações da oficina...");
            List<OrdemServico> osAprovacao = ordemServicoRepository.findByStatus(StatusOrdemServico.AGUARDANDO_APROVACAO);
            for (OrdemServico os : osAprovacao) {
                criarNotificacaoOsAguardandoAprovacao(os);
            }

            List<OrdemServico> osProntas = ordemServicoRepository.findByStatus(StatusOrdemServico.PRONTA);
            for (OrdemServico os : osProntas) {
                criarNotificacaoOsPronta(os);
            }

            List<Produto> produtosEstoqueBaixo = produtoRepository.findAll().stream()
                    .filter(p -> p.isAtivo() && p.isEstoqueBaixo())
                    .toList();
            for (Produto p : produtosEstoqueBaixo) {
                verificarEstoqueProduto(p);
            }
            log.info("Sincronização de notificações concluída com sucesso.");
        } catch (Exception e) {
            log.warn("Não foi possível sincronizar notificações iniciais na inicialização: {}", e.getMessage());
        }
    }
}
