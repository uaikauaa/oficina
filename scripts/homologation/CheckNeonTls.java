import java.sql.*;
import java.util.Properties;

/** Read-only certificate/TLS check. Invoke explicitly with the PostgreSQL JDBC jar on the classpath. */
class CheckNeonTls {
    static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Isolated configuration missing");
        return value;
    }
    public static void main(String[] args) {
        try {
            if (!"true".equals(required("HML_NEON_ISOLATED"))) throw new IllegalArgumentException();
            String host = required("HML_DB_HOST"), database = required("HML_DB_NAME"), user = required("HML_DB_USER");
            if (!host.matches("ep-[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.neon\\.tech")
                    || host.contains("-pooler") || !host.endsWith(".sa-east-1.aws.neon.tech")
                    || !host.equals(required("HML_EXPECTED_HOST")) || !database.matches("[a-z][a-z0-9_]*_security_test")
                    || (!database.equals("oficina_security_test") && !database.equals(required("HML_APPROVED_DATABASE")))
                    || !user.matches("[a-z0-9_]*security_test[a-z0-9_]*")) throw new IllegalArgumentException();
            Properties properties = new Properties();
            properties.setProperty("user", user);
            properties.setProperty("password", required("HML_DB_PASSWORD"));
            properties.setProperty("sslmode", "verify-full");
            properties.setProperty("sslfactory", "org.postgresql.ssl.DefaultJavaSSLFactory");
            properties.setProperty("connectTimeout", "10");
            properties.setProperty("socketTimeout", "10");
            properties.setProperty("channelBinding", "require");
            properties.setProperty("readOnly", "true");
            properties.setProperty("readOnlyMode", "always");
            properties.setProperty("options", "-c statement_timeout=5000");
            try (Connection connection = DriverManager.getConnection("jdbc:postgresql://" + host + ":5432/" + database, properties)) {
                connection.setReadOnly(true);
                connection.setAutoCommit(false);
                try (var statement = connection.createStatement(); var rows = statement.executeQuery(
                        "SELECT current_database(), current_user, current_setting('transaction_read_only')")) {
                    if (!rows.next() || !database.equals(rows.getString(1)) || !user.equals(rows.getString(2))
                            || !"on".equals(rows.getString(3))) throw new IllegalStateException();
                }
                try (var statement = connection.createStatement(); var rows = statement.executeQuery(
                        "SELECT ssl, version FROM pg_stat_ssl WHERE pid=pg_backend_pid()")) {
                    if (!rows.next() || !rows.getBoolean(1) || !java.util.Set.of("TLSv1.2", "TLSv1.3").contains(rows.getString(2))) throw new IllegalStateException();
                    String protocol = rows.getString(2);
                    // Empty means no user relations, routines or types in ANY non-system schema.
                    try (var inspection = connection.createStatement(); var objects = inspection.executeQuery("""
                        SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                            WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
                            AND n.nspname NOT LIKE 'pg_temp_%')
                        OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                            WHERE n.nspname NOT IN ('pg_catalog','information_schema'))
                        OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
                            WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
                            AND n.nspname NOT LIKE 'pg_temp_%')
                        """)) {
                        if (!objects.next() || objects.getBoolean(1)) throw new IllegalStateException();
                    }
                    System.out.println("PASS: isolated Neon JDBC, verify-full, certificate/hostname verified, " + protocol
                        + ", read-only transaction, identity matched, database empty. No migrations executed; identifiers omitted.");
                }
                connection.rollback();
            }
        } catch (Exception e) {
            System.err.println("FAIL: isolated Neon TLS/identity check. No connection details or credentials printed.");
            System.exit(1);
        }
    }
}
