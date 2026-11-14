package com.oficinagestao.maintenance;

import com.oficinagestao.service.EmailService;
import com.oficinagestao.service.InitialSuperAdminProvisioner;
import com.oficinagestao.service.InviteOutbox;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Properties;

/** Explicit maintenance entry point. Does not create a Spring application context or run Flyway. */
public final class InitialSuperAdminCommand {
    private InitialSuperAdminCommand() { }

    public static void main(String[] args) {
        try {
            if (args.length != 2 || !"--execute".equals(args[0]))
                throw new IllegalArgumentException("Use --execute <absolute-private-approval-file>");
            Path approvalPath = Path.of(args[1]);
            if (!approvalPath.isAbsolute() || !Files.isRegularFile(approvalPath))
                throw new IllegalArgumentException("A private approval file is required");
            for (Path directory = approvalPath.toRealPath().getParent(); directory != null;
                    directory = directory.getParent())
                if (Files.exists(directory.resolve(".git")))
                    throw new IllegalArgumentException("Approval file must be outside a Git repository");
            Properties approval = new Properties();
            try (var reader = Files.newBufferedReader(approvalPath)) { approval.load(reader); }
            String url = requiredEnv("DB_URL");
            String username = requiredEnv("DB_USERNAME");
            String password = requiredEnv("DB_PASSWORD");
            String keys = requiredEnv("INVITE_OUTBOX_KEYS");
            String publicUrl = requiredEnv("APP_PUBLIC_URL");
            int keyVersion = Integer.parseInt(requiredEnv("INVITE_OUTBOX_ACTIVE_VERSION"));
            validateApproval(approval, url, username);
            validatePublicOrigin(approval, publicUrl);
            // Only after the authorization and target checks is a connection opened.
            var source = new DriverManagerDataSource(url, username, password);
            var jdbc = new JdbcTemplate(source);
            var transactions = new TransactionTemplate(new DataSourceTransactionManager(source));
            EmailService noMail = new EmailService() {
                public void sendTwoFactorCode(String to, String code) { throw new IllegalStateException("No SMTP in maintenance command"); }
                public void sendInvitation(String to, String link) { throw new IllegalStateException("No SMTP in maintenance command"); }
                public void sendPasswordRecovery(String to, String link) { throw new IllegalStateException("No SMTP in maintenance command"); }
            };
            var outbox = new InviteOutbox(jdbc, transactions, noMail, keys, keyVersion, publicUrl);
            new InitialSuperAdminProvisioner(jdbc, transactions, outbox).provision(
                    approval.getProperty("recipient_email"), approval.getProperty("approval_reference"));
            System.out.println("Initial SUPER_ADMIN invitation committed; delivery requires a separately authorized worker.");
        } catch (Exception error) {
            // Never print exception messages or stack traces: JDBC errors can contain target identifiers.
            System.err.println("Initial SUPER_ADMIN provisioning refused; category=" + error.getClass().getSimpleName());
            System.exit(1);
        }
    }

    static void validateApproval(Properties approval, String jdbcUrl, String username) {
        if (!"INITIAL_SUPER_ADMIN_INVITE".equals(approval.getProperty("operation")))
            throw new IllegalArgumentException("Operation approval mismatch");
        for (String key : new String[] {"organization_id", "project_id", "branch_id", "compute_id",
                "authorized_by", "approval_reference", "recipient_email", "expected_hostname",
                "expected_database", "expected_role", "expected_public_url", "window_start_utc", "window_end_utc"})
            if (approval.getProperty(key) == null || approval.getProperty(key).isBlank())
                throw new IllegalArgumentException("Incomplete private approval");
        if (!approval.getProperty("approval_reference").matches("[A-Za-z0-9._-]{8,100}"))
            throw new IllegalArgumentException("Invalid approval reference");
        Instant now = Instant.now();
        Instant start = Instant.parse(approval.getProperty("window_start_utc"));
        Instant end = Instant.parse(approval.getProperty("window_end_utc"));
        if (!start.isBefore(end) || now.isBefore(start) || !now.isBefore(end))
            throw new IllegalArgumentException("Outside approved window");
        if (!jdbcUrl.startsWith("jdbc:postgresql://")) throw new IllegalArgumentException("JDBC URL required");
        URI uri = URI.create(jdbcUrl.substring(5));
        if (!"postgresql".equals(uri.getScheme()) || uri.getHost() == null || uri.getPort() != 5432
                || !uri.getHost().endsWith(".neon.tech") || uri.getHost().contains("-pooler")
                || uri.getRawUserInfo() != null || uri.getRawFragment() != null
                || !uri.getHost().equals(approval.getProperty("expected_hostname"))
                || !uri.getPath().equals("/" + approval.getProperty("expected_database"))
                || !username.equals(approval.getProperty("expected_role")))
            throw new IllegalArgumentException("Approved target mismatch");
        var query = new java.util.HashMap<String, String>();
        for (String item : (uri.getRawQuery() == null ? "" : uri.getRawQuery()).split("&")) {
            var pair = item.split("=", 2);
            if (pair.length == 2 && query.put(pair[0], pair[1]) != null)
                throw new IllegalArgumentException("Duplicate JDBC option");
        }
        if (!"verify-full".equals(query.get("sslmode"))
                || !(query.containsKey("sslrootcert")
                     || "org.postgresql.ssl.DefaultJavaSSLFactory".equals(query.get("sslfactory"))))
            throw new IllegalArgumentException("Verified TLS and CA required");
    }

    static void validatePublicOrigin(Properties approval, String publicUrl) {
        URI invitationOrigin = URI.create(publicUrl);
        if (!"https".equals(invitationOrigin.getScheme()) || invitationOrigin.getHost() == null
                || invitationOrigin.getUserInfo() != null || invitationOrigin.getQuery() != null
                || invitationOrigin.getFragment() != null || !publicUrl.equals(approval.getProperty("expected_public_url")))
            throw new IllegalArgumentException("Approved public invitation origin required");
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing private configuration");
        return value;
    }
}
