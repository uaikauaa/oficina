package com.oficinagestao.service;

import com.oficinagestao.entity.Auditoria;
import com.oficinagestao.repository.AuditoriaRepository;
import com.oficinagestao.security.IpAddressResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuditoriaIpSecurityTest {

    @Mock
    private AuditoriaRepository auditoriaRepository;

    @Test
    void directClientCannotForgeAuditIpWithForwardedHeaders() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("198.51.100.10");
        request.addHeader("CF-Connecting-IP", "1.2.3.4");
        request.addHeader("X-Real-IP", "192.0.2.25");
        request.addHeader("X-Forwarded-For", "203.0.113.77");

        AuditoriaService service = new AuditoriaService(auditoriaRepository, new IpAddressResolver());
        service.registrarComRequest(1L, "Usuario", "1", "LOGIN", request);

        ArgumentCaptor<Auditoria> captor = ArgumentCaptor.forClass(Auditoria.class);
        verify(auditoriaRepository).save(captor.capture());
        assertEquals("198.51.100.10", captor.getValue().getIpOrigem());
    }
}
