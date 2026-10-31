package com.oficinagestao.security;

import com.oficinagestao.controller.OrdemServicoController;
import com.oficinagestao.dto.OrdemServicoResponseDTO;
import com.oficinagestao.exception.GlobalExceptionHandler;
import com.oficinagestao.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(OutputCaptureExtension.class)
class SensitiveOutputAuditTest {
    @Test void upstreamExceptionsCannotLeakCodesPasswordsOrDatabaseRows(CapturedOutput output) throws Exception {
        String sentinel = "AUDIT_SYNTHETIC_SECRET_MUST_NOT_APPEAR";
        JavaMailSender mail = mock(JavaMailSender.class);
        doThrow(new MailSendException(sentinel)).when(mail).send(any(SimpleMailMessage.class));
        assertThrows(RuntimeException.class, () -> new EmailServiceImpl(mail, "test@oficina.invalid")
                .sendTwoFactorCode("test@oficina.invalid", "123456"));
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        MockHttpServletRequest request = new MockHttpServletRequest();
        assertEquals(500, handler.handleGeneralException(new RuntimeException(sentinel), request).getStatusCode().value());
        assertEquals(409, handler.handleDataIntegrity(new DataIntegrityViolationException(sentinel), request).getStatusCode().value());
        javax.sql.DataSource source = mock(javax.sql.DataSource.class);
        when(source.getConnection()).thenThrow(new java.sql.SQLException(sentinel));
        assertEquals(503, new com.oficinagestao.controller.HealthController(source).health().getStatusCode().value());
        assertFalse(output.getAll().contains(sentinel));
    }

    @Test void storedOrderNumberCannotInjectPdfDispositionParametersOrHeaders() {
        OrdemServicoService service = mock(OrdemServicoService.class);
        OrdemServicoResponseDTO order = mock(OrdemServicoResponseDTO.class);
        when(order.numeroOs()).thenReturn("A\";x=1\r\nX-Injected: yes");
        when(service.buscarPorId(1L)).thenReturn(order);
        OrdemServicoController controller = new OrdemServicoController(service, mock(OrdemServicoItemService.class));
        for (var response : java.util.List.of(controller.gerarPdf(1L), controller.gerarDocumentoServico(1L), controller.gerarRecibo(1L))) {
            String header = response.getHeaders().getFirst("Content-Disposition");
            assertNotNull(header);
            assertTrue(header.matches("inline; filename=\"[A-Za-z0-9._-]+\\.pdf\""));
            assertFalse(header.contains("\r"));
            assertFalse(header.contains("\n"));
        }
    }
}
