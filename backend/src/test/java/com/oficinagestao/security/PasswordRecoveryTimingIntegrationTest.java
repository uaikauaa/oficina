package com.oficinagestao.security;

import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.PasswordRecoveryService;
import com.oficinagestao.service.EmailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/** Diagnostic experiment, NOT an assertion of timing equivalence or a security gate. */
@SpringBootTest(properties = {"logging.level.org.springframework.jdbc=OFF", "logging.level.org.hibernate.SQL=OFF",
        "security.invite-outbox.poll-ms=3600000"})
@ActiveProfiles("test")
class PasswordRecoveryTimingIntegrationTest {
    @Autowired PasswordRecoveryService recovery;
    @Autowired UsuarioRepository users;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean EmailService mail;

    @Test void randomizedPairedRecoveryTimingExperiment() throws Exception {
        jdbc.update("DELETE FROM security_rate_limits");
        int warmup = 20, pairs = 120;
        Random order = new Random(42026);
        List<String> csv = new ArrayList<>(List.of("pair,existing_first,existing_ns,unknown_ns"));
        String run = UUID.randomUUID().toString();
        // No password hashing, fixture creation, SQL logging or SMTP in the timed region.
        // Each address/IP is used once; verify the existing path did not short circuit.
        for (int i = -warmup; i < pairs; i++) {
            String email = "timing-" + run + "-" + (i + warmup) + "@example.invalid";
            Usuario user = users.saveAndFlush(new Usuario("Synthetic timing", email, "unused", true));
            boolean first = order.nextBoolean();
            String unknown = "absent-" + run + "-" + (i + warmup) + "@example.invalid";
            int suffix = i + warmup + 1;
            try {
                long existingNs, unknownNs;
                if (first) {
                    existingNs = measure(email, "198.51.100." + suffix);
                    unknownNs = measure(unknown, "203.0.113." + suffix);
                } else {
                    unknownNs = measure(unknown, "203.0.113." + suffix);
                    existingNs = measure(email, "198.51.100." + suffix);
                }
                assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM password_reset_requests WHERE usuario_id=?",
                        Integer.class, user.getId()), "existing path must not have been rate limited");
                if (i >= 0) csv.add(i + "," + first + "," + existingNs + "," + unknownNs);
            } finally { users.deleteById(user.getId()); }
        }
        Files.createDirectories(Path.of("target"));
        Files.write(Path.of("target/recovery-timing.csv"), csv);
        assertEquals(pairs + 1, csv.size());
        System.out.println("RECOVERY_TIMING: 120 randomized pairs after 20 warmup pairs; analyze target/recovery-timing.csv");
    }

    private long measure(String email, String ip) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/recuperacao/solicitar");
        request.setRemoteAddr(ip);
        long start = System.nanoTime();
        recovery.request(email, request);
        return System.nanoTime() - start;
    }
}
