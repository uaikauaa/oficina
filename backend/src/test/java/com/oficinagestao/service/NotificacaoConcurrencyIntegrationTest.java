package com.oficinagestao.service;

import com.oficinagestao.entity.Notificacao;
import com.oficinagestao.entity.TipoNotificacao;
import com.oficinagestao.repository.NotificacaoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class NotificacaoConcurrencyIntegrationTest {

    @Autowired
    private NotificacaoService notificacaoService;

    @Autowired
    private NotificacaoRepository notificacaoRepository;

    private static final String CHAVE_TESTE = "CONCORRENCIA_OS_9999";

    @AfterEach
    void tearDown() {
        notificacaoRepository.findByChaveUnica(CHAVE_TESTE)
                .ifPresent(notificacaoRepository::delete);
    }

    @Test
    @DisplayName("Concorrência: Múltiplas threads criando notificação com mesma chave única devem gerar EXATAMENTE UM registro")
    void concorrenciaCriacaoNotificacao_chaveUnica_geraExatamenteUmRegistro() throws Exception {
        int threads = 8;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threads);

        List<Notificacao> resultados = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> erros = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threads; i++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    Notificacao n = notificacaoService.criarOuAtualizarNotificacao(
                            TipoNotificacao.OS_AGUARDANDO_APROVACAO,
                            "Aguardando Aprovação Concorrente",
                            "Mensagem concorrente",
                            "ORDEM_SERVICO",
                            9999L,
                            "/ordens-servico?busca=OS-9999",
                            CHAVE_TESTE
                    );
                    resultados.add(n);
                } catch (Throwable t) {
                    erros.add(t);
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        // Disparo simultâneo
        startLatch.countDown();
        boolean completed = doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(completed, "Todas as threads devem concluir em até 10 segundos");
        assertTrue(erros.isEmpty(), "Nenhum erro de integridade deve vazar para as chamadas: " + erros);
        assertEquals(threads, resultados.size(), "Todas as threads devem receber uma instância de notificação");

        // Validação no banco de dados real (PostgreSQL/Neon)
        Long idEsperado = resultados.get(0).getId();
        assertNotNull(idEsperado);

        for (Notificacao n : resultados) {
            assertEquals(idEsperado, n.getId(), "Todas as threads devem ter retornado a mesma notificação idêntica");
        }

        // Garante que existe estritamente 1 registro na tabela
        long count = notificacaoRepository.findAll().stream()
                .filter(n -> CHAVE_TESTE.equals(n.getChaveUnica()))
                .count();
        assertEquals(1, count, "Deve existir exatamente um registro persistido no banco com esta chave única");
    }
}
