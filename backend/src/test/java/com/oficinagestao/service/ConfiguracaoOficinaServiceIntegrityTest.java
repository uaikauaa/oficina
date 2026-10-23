package com.oficinagestao.service;

import com.oficinagestao.entity.ConfiguracaoOficina;
import com.oficinagestao.dto.ConfiguracaoOficinaUpdateDTO;
import com.oficinagestao.exception.ConfiguracaoOficinaIndisponivelException;
import com.oficinagestao.repository.ConfiguracaoOficinaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;

import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Isolated policy B tests: no Spring application, datasource or real workshop fixtures. */
class ConfiguracaoOficinaServiceIntegrityTest {
    private final ConfiguracaoOficinaRepository repository = mock(ConfiguracaoOficinaRepository.class);
    private final ConfiguracaoOficinaService service = new ConfiguracaoOficinaService(repository);

    @Test
    void existingCustomizedRecordIsReturnedWithoutWriteOrOverwrite() {
        ConfiguracaoOficina customized = new ConfiguracaoOficina();
        customized.setNomeFantasia("Oficina Sintética Editada");
        customized.setTelefone("0000000000");
        when(repository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(customized)));

        ConfiguracaoOficina result = service.obterEntidade();

        assertSame(customized, result);
        assertEquals("Oficina Sintética Editada", result.getNomeFantasia());
        assertEquals("0000000000", result.getTelefone());
        verify(repository, never()).save(any());
        verify(repository).findAll(any(Pageable.class));
        verifyNoMoreInteractions(repository);
    }

    @Test
    void missingRecordFailsWithoutRecreation() {
        when(repository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        var error = assertThrows(ConfiguracaoOficinaIndisponivelException.class, service::obterEntidade);

        assertEquals("OFICINA_CONFIG_MISSING", error.getCode());
        verifyReadOnlyAccess(1);
    }

    @Test
    void missingRecordCannotBeRecreatedByGet() {
        when(repository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        assertThrows(ConfiguracaoOficinaIndisponivelException.class, service::obter);

        verifyReadOnlyAccess(1);
    }

    @Test
    void missingRecordCannotBeCreatedByUpdate() {
        when(repository.findAll(any(Pageable.class))).thenReturn(Page.empty());

        assertThrows(ConfiguracaoOficinaIndisponivelException.class,
                () -> service.atualizar(update("Oficina Sintética", null, null, null)));

        verifyReadOnlyAccess(1);
    }

    @Test
    void updateUsesTheExistingRecordAndPreservesOmittedFields() {
        ConfiguracaoOficina existing = new ConfiguracaoOficina();
        ReflectionTestUtils.setField(existing, "id", 71L);
        existing.setNomeSistema("Sistema Sintético");
        existing.setNomeFantasia("Oficina Sintética Anterior");
        existing.setTelefone("0000000000");
        existing.setEmail("contato@example.invalid");
        when(repository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(existing)));
        when(repository.save(existing)).thenReturn(existing);

        var response = service.atualizar(update("  Oficina Sintética Editada  ", null, null, " sp "));

        assertEquals(71L, response.id());
        assertEquals("Sistema Sintético", response.nomeSistema());
        assertEquals("Oficina Sintética Editada", response.nomeFantasia());
        assertEquals("0000000000", response.telefone());
        assertEquals("contato@example.invalid", response.email());
        assertEquals("SP", response.uf());
        verify(repository).findAll(any(Pageable.class));
        verify(repository).save(same(existing));
        verifyNoMoreInteractions(repository);
    }

    @Test
    void updateStillClearsExplicitlyBlankOptionalFields() {
        ConfiguracaoOficina existing = new ConfiguracaoOficina();
        ReflectionTestUtils.setField(existing, "id", 71L);
        existing.setNomeFantasia("Oficina Sintética");
        existing.setTelefone("0000000000");
        existing.setEmail("contato@example.invalid");
        when(repository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(existing)));
        when(repository.save(existing)).thenReturn(existing);

        var response = service.atualizar(update("Oficina Sintética", "  ", "", null));

        assertEquals(71L, response.id());
        assertNull(response.telefone());
        assertNull(response.email());
        verify(repository).findAll(any(Pageable.class));
        verify(repository).save(same(existing));
        verifyNoMoreInteractions(repository);
    }

    @Test
    void duplicateRecordsAreNotSilentlySelectedOrUpdated() {
        when(repository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(new ConfiguracaoOficina(), new ConfiguracaoOficina())));

        var readError = assertThrows(ConfiguracaoOficinaIndisponivelException.class, service::obterEntidade);
        var updateError = assertThrows(ConfiguracaoOficinaIndisponivelException.class,
                () -> service.atualizar(update("Oficina Sintética", null, null, null)));

        assertEquals("OFICINA_CONFIG_INTEGRITY_ERROR", readError.getCode());
        assertEquals(readError.getCode(), updateError.getCode());
        verifyReadOnlyAccess(2);
    }

    @Test
    void concurrentMissingReadsBothFailWithoutAnyWrite() throws Exception {
        CyclicBarrier readers = new CyclicBarrier(2);
        when(repository.findAll(any(Pageable.class))).thenAnswer(invocation -> {
            readers.await(5, TimeUnit.SECONDS);
            return Page.empty();
        });

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> assertThrows(ConfiguracaoOficinaIndisponivelException.class, service::obterEntidade));
            var second = executor.submit(() -> assertThrows(ConfiguracaoOficinaIndisponivelException.class, service::obterEntidade));
            assertEquals("OFICINA_CONFIG_MISSING", first.get(10, TimeUnit.SECONDS).getCode());
            assertEquals("OFICINA_CONFIG_MISSING", second.get(10, TimeUnit.SECONDS).getCode());
        }

        verifyReadOnlyAccess(2);
    }

    @Test
    void readsDeclareReadOnlyTransactionsWhileUpdateRemainsWritable() throws Exception {
        var attributes = new AnnotationTransactionAttributeSource();
        for (String method : List.of("obter", "obterEntidade")) {
            var transaction = attributes.getTransactionAttribute(
                    ConfiguracaoOficinaService.class.getMethod(method), ConfiguracaoOficinaService.class);
            assertNotNull(transaction);
            assertTrue(transaction.isReadOnly());
        }
        var updateTransaction = attributes.getTransactionAttribute(
                ConfiguracaoOficinaService.class.getMethod("atualizar", ConfiguracaoOficinaUpdateDTO.class),
                ConfiguracaoOficinaService.class);
        assertNotNull(updateTransaction);
        assertFalse(updateTransaction.isReadOnly());
        verifyNoInteractions(repository);
    }

    private void verifyReadOnlyAccess(int reads) {
        verify(repository, times(reads)).findAll(any(Pageable.class));
        verify(repository, never()).save(any());
        verifyNoMoreInteractions(repository);
    }

    private ConfiguracaoOficinaUpdateDTO update(String name, String phone, String email, String state) {
        return new ConfiguracaoOficinaUpdateDTO(name, null, null, null, phone, email,
                null, null, null, null, null, state);
    }
}
