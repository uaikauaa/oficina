package com.oficinagestao.controller;

import com.oficinagestao.dto.PasswordRecoveryRequest;
import com.oficinagestao.service.PasswordRecoveryService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class PasswordRecoveryExposureTest {
    @Test
    void disabledRequestReturnsUnavailableWithoutLookingUpAccount() {
        PasswordRecoveryService service = mock(PasswordRecoveryService.class);
        PasswordRecoveryController controller = new PasswordRecoveryController(service);
        HttpServletRequest http = mock(HttpServletRequest.class);

        assertEquals(503, controller.request(new PasswordRecoveryRequest("someone@example.test"), http).getStatusCode().value());
        verifyNoInteractions(service);
    }

    @Test
    void testProfileMayExerciseExistingRecoveryFlow() {
        PasswordRecoveryService service = mock(PasswordRecoveryService.class);
        PasswordRecoveryController controller = new PasswordRecoveryController(service);
        ReflectionTestUtils.setField(controller, "requestsEnabled", true);
        HttpServletRequest http = mock(HttpServletRequest.class);

        assertEquals(202, controller.request(new PasswordRecoveryRequest("someone@example.test"), http).getStatusCode().value());
        verify(service).request("someone@example.test", http);
    }
}
