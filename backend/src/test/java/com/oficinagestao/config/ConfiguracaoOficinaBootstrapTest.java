package com.oficinagestao.config;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.oficinagestao.repository.ConfiguracaoOficinaRepository;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.slf4j.LoggerFactory;
import org.springframework.boot.DefaultApplicationArguments;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Invokes the runner directly, without starting Spring or a datasource. */
class ConfiguracaoOficinaBootstrapTest {
    @ParameterizedTest
    @CsvSource({
            "1, INFO, Validação da configuração da oficina concluída com sucesso.",
            "0, ERROR, OFICINA_CONFIG_MISSING",
            "2, ERROR, OFICINA_CONFIG_INTEGRITY_ERROR"
    })
    void validatesCardinalityWithoutWritingOrStoppingStartup(long count, String level, String message) {
        ConfiguracaoOficinaRepository repository = mock(ConfiguracaoOficinaRepository.class);
        when(repository.count()).thenReturn(count);
        var bootstrap = new ConfiguracaoOficinaBootstrap(repository);
        Logger logger = (Logger) LoggerFactory.getLogger(ConfiguracaoOficinaBootstrap.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            assertDoesNotThrow(() -> bootstrap.run(new DefaultApplicationArguments()));

            verify(repository).count();
            verifyNoMoreInteractions(repository);
            assertEquals(1, appender.list.size());
            ILoggingEvent event = appender.list.getFirst();
            assertEquals(Level.valueOf(level), event.getLevel());
            assertTrue(event.getFormattedMessage().contains(message));
            assertNull(event.getThrowableProxy());
            if (count != 1) {
                assertTrue(event.getFormattedMessage().contains("administrativa"));
                assertTrue(event.getFormattedMessage().contains("Operação degradada"));
                assertArrayEquals(new Object[] { message }, event.getArgumentArray());
            }
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
    }
}
