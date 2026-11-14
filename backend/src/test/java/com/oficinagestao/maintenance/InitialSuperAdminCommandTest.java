package com.oficinagestao.maintenance;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.Properties;
import static org.junit.jupiter.api.Assertions.*;

class InitialSuperAdminCommandTest {
    private Properties approval() {
        Properties p = new Properties();
        p.setProperty("operation", "INITIAL_SUPER_ADMIN_INVITE");
        p.setProperty("organization_id", "synthetic-org");
        p.setProperty("project_id", "synthetic-project");
        p.setProperty("branch_id", "synthetic-branch");
        p.setProperty("compute_id", "synthetic-compute");
        p.setProperty("authorized_by", "Synthetic operator");
        p.setProperty("approval_reference", "SYNTHETIC-APPROVAL-01");
        p.setProperty("recipient_email", "owner@example.invalid");
        p.setProperty("expected_hostname", "synthetic.neon.tech");
        p.setProperty("expected_database", "synthetic_db");
        p.setProperty("expected_role", "synthetic_writer");
        p.setProperty("expected_public_url", "https://synthetic.example.invalid");
        p.setProperty("window_start_utc", Instant.now().minusSeconds(60).toString());
        p.setProperty("window_end_utc", Instant.now().plusSeconds(60).toString());
        return p;
    }

    @Test void demandsMatchingDirectVerifiedTargetAndWindowBeforeAnyConnection() {
        var p = approval();
        String url = "jdbc:postgresql://synthetic.neon.tech:5432/synthetic_db?sslmode=verify-full"
                + "&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory";
        assertDoesNotThrow(() -> InitialSuperAdminCommand.validateApproval(p, url, "synthetic_writer"));
        assertDoesNotThrow(() -> InitialSuperAdminCommand.validatePublicOrigin(p, "https://synthetic.example.invalid"));
        assertThrows(IllegalArgumentException.class, () -> InitialSuperAdminCommand.validatePublicOrigin(p, "http://localhost:3000"));
        assertThrows(IllegalArgumentException.class, () -> InitialSuperAdminCommand.validateApproval(p,
                url.replace("verify-full", "require"), "synthetic_writer"));
        assertThrows(IllegalArgumentException.class, () -> InitialSuperAdminCommand.validateApproval(p,
                url.replace("synthetic.neon.tech", "synthetic-pooler.neon.tech"), "synthetic_writer"));
        assertThrows(IllegalArgumentException.class, () -> InitialSuperAdminCommand.validateApproval(p,
                url, "different_writer"));
        p.setProperty("window_end_utc", Instant.now().minusSeconds(1).toString());
        assertThrows(IllegalArgumentException.class, () -> InitialSuperAdminCommand.validateApproval(p,
                url, "synthetic_writer"));
    }
}
