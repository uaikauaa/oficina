package com.oficinagestao.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class ResourceLimitsFailureTest {
    @Test void limiterOutageFailsClosedWithoutLeakingDatabaseDetails() throws Exception {
        var store = mock(SharedRateLimitService.class);
        when(store.consume(anyString(), anyString(), anyInt(), any())).thenThrow(
                new org.springframework.dao.DataAccessResourceFailureException("synthetic-private-database-details"));
        var filter = new ResourceLimitsConfiguration().boundedPayload(new ObjectMapper().findAndRegisterModules(), store, new IpAddressResolver()).getFilter();
        var response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/api/clientes"), response, (req, res) -> fail("Must not bypass limiter"));
        assertEquals(503, response.getStatus());
        assertEquals("5", response.getHeader("Retry-After"));
        assertFalse(response.getContentAsString().contains("synthetic-private"));
    }

    @Test void invalidServiceContextCannotFallBackToUntrustedForwardedHeaders() throws Exception {
        var store = mock(SharedRateLimitService.class);
        var ips = mock(IpAddressResolver.class);
        when(ips.extrairIp(any())).thenThrow(new SecurityException("synthetic-signature-details"));
        var filter = new ResourceLimitsConfiguration().boundedPayload(new ObjectMapper().findAndRegisterModules(), store, ips).getFilter();
        var response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/api/clientes"), response, (req, res) -> fail("Must not bypass signature"));
        assertEquals(403, response.getStatus());
        assertFalse(response.getContentAsString().contains("signature-details"));
        verifyNoInteractions(store);
    }
}
