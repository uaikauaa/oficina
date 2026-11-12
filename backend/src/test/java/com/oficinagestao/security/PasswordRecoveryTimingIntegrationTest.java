package com.oficinagestao.security;

import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.PasswordRecoveryService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Timing evidence for the generic recovery response path.  The test uses only
 * disposable accounts and distinct RFC-5737 source addresses so the shared
 * limiter does not turn the sample into a false comparison.
 */
@SpringBootTest
@ActiveProfiles("test")
class PasswordRecoveryTimingIntegrationTest {
    @Autowired PasswordRecoveryService recovery;
    @Autowired UsuarioRepository users;
    @Autowired PasswordEncoder passwords;

    @Test
    void existingAndUnknownAddressesStayWithinBoundedTimingEnvelope() {
        List<Long> existing = new ArrayList<>();
        List<Long> unknown = new ArrayList<>();
        for (int i = 0; i < 20; i++) {
            Usuario user = users.saveAndFlush(new Usuario("Synthetic timing " + i,
                    "timing-" + UUID.randomUUID() + "@example.invalid",
                    passwords.encode("SyntheticPassword1!"), true));
            try {
                existing.add(measure(user.getEmail(), "198.51.100." + (10 + i)));
                unknown.add(measure("unknown-" + UUID.randomUUID() + "@example.invalid",
                        "203.0.113." + (10 + i)));
            } finally {
                users.deleteById(user.getId());
            }
        }

        long existingMedian = median(existing);
        long unknownMedian = median(unknown);
        long slower = Math.max(existingMedian, unknownMedian);
        long faster = Math.max(1L, Math.min(existingMedian, unknownMedian));
        double ratio = (double) slower / faster;
        System.out.printf("RECOVERY_TIMING existing_median_us=%d unknown_median_us=%d ratio=%.2f existing_p95_us=%d unknown_p95_us=%d%n",
                existingMedian / 1_000, unknownMedian / 1_000, ratio,
                percentile(existing, .95) / 1_000, percentile(unknown, .95) / 1_000);
        assertTrue(ratio < 30.0, "recovery paths diverged beyond the broad diagnostic envelope");
    }

    private long measure(String email, String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/recuperacao/solicitar");
        request.setRemoteAddr(ip);
        long start = System.nanoTime();
        recovery.request(email, request);
        return System.nanoTime() - start;
    }

    private static long median(List<Long> values) {
        return percentile(values, .50);
    }

    private static long percentile(List<Long> values, double fraction) {
        List<Long> sorted = values.stream().sorted(Comparator.naturalOrder()).toList();
        int index = Math.min(sorted.size() - 1, (int) Math.ceil(sorted.size() * fraction) - 1);
        return sorted.get(index);
    }
}
