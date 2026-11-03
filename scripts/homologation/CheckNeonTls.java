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
            if (!host.matches("[a-z0-9.-]+\\.neon\\.tech") || !database.matches("[a-z0-9_]+_security_test")
                    || !user.matches("[a-z0-9_]*security_test[a-z0-9_]*")) throw new IllegalArgumentException();
            Properties properties = new Properties();
            properties.setProperty("user", user);
            properties.setProperty("password", required("HML_DB_PASSWORD"));
            properties.setProperty("sslmode", "verify-full");
            properties.setProperty("sslfactory", "org.postgresql.ssl.DefaultJavaSSLFactory");
            properties.setProperty("connectTimeout", "10");
            properties.setProperty("socketTimeout", "10");
            properties.setProperty("options", "-c statement_timeout=5000");
            try (Connection connection = DriverManager.getConnection("jdbc:postgresql://" + host + ":5432/" + database, properties)) {
                connection.setReadOnly(true);
                try (var statement = connection.createStatement(); var rows = statement.executeQuery(
                        "SELECT ssl, version FROM pg_stat_ssl WHERE pid=pg_backend_pid()")) {
                    if (!rows.next() || !rows.getBoolean(1) || !java.util.Set.of("TLSv1.2", "TLSv1.3").contains(rows.getString(2))) throw new IllegalStateException();
                    System.out.println("PASS: isolated Neon connection, verify-full, read-only and TLS negotiated; identifiers omitted.");
                }
            }
        } catch (Exception e) {
            System.err.println("FAIL: isolated Neon TLS/identity check. No connection details or credentials printed.");
            System.exit(1);
        }
    }
}
