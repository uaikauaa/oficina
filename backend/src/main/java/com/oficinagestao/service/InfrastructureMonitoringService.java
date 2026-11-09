package com.oficinagestao.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** Read-only, bounded snapshot. Provider calls are disabled unless explicitly configured. */
@Service
public class InfrastructureMonitoringService {
    private static final Logger log = LoggerFactory.getLogger(InfrastructureMonitoringService.class);
    private static final String UNAVAILABLE = "Métrica indisponível no plano atual ou sem integração configurada";
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    private final String databaseProvider;
    private final String neonProjectId;
    private final String neonApiKey;
    private final String googleProjectId;
    private final String googleService;
    private final long ttlSeconds;
    private volatile Snapshot cached;
    private volatile Instant cacheExpires = Instant.EPOCH;

    public record Metric(Object value, String unit, String status, String source, Instant measuredAt) {}
    public record Snapshot(String databaseProvider, String databaseName, String connectionStatus,
                           Map<String, Metric> database, Map<String, Metric> neon,
                           Map<String, Metric> googleCloud, Instant collectedAt, Instant cacheExpiresAt) {}

    public InfrastructureMonitoringService(JdbcTemplate jdbc, ObjectMapper mapper,
            @Value("${infrastructure.database-provider:local}") String databaseProvider,
            @Value("${infrastructure.neon.project-id:}") String neonProjectId,
            @Value("${infrastructure.neon.api-key:}") String neonApiKey,
            @Value("${infrastructure.google.project-id:}") String googleProjectId,
            @Value("${infrastructure.google.service:}") String googleService,
            @Value("${infrastructure.cache-ttl-seconds:120}") long ttlSeconds) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.databaseProvider = "neon".equalsIgnoreCase(databaseProvider) ? "neon" : "local";
        this.neonProjectId = neonProjectId;
        this.neonApiKey = neonApiKey;
        this.googleProjectId = googleProjectId;
        this.googleService = googleService;
        this.ttlSeconds = Math.max(60, Math.min(ttlSeconds, 3600));
    }

    public synchronized Snapshot snapshot() {
        if (cached != null && Instant.now().isBefore(cacheExpires)) return cached;
        Instant now = Instant.now();
        Map<String, Metric> database = new LinkedHashMap<>();
        Map<String, Metric> neon = new LinkedHashMap<>();
        Map<String, Metric> google = new LinkedHashMap<>();
        String name = null;
        String connection = "indisponível";
        try {
            name = jdbc.queryForObject("SELECT current_database()", String.class);
            connection = "conectado";
            database.put("tamanhoLogicoBytes", measured(jdbc.queryForObject(
                    "SELECT pg_database_size(current_database())", Long.class), "bytes", "PostgreSQL pg_database_size", now));
            database.put("tabelas", measured(jdbc.queryForObject(
                    "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public'", Long.class),
                    "tabelas", "PostgreSQL pg_tables", now));
            // pg_class.reltuples is an estimate from statistics; no full table scans.
            for (String table : new String[]{"clientes", "maquinas", "ordens_servico", "produtos", "usuarios"}) {
                Long estimate = jdbc.queryForObject("SELECT greatest(0, coalesce((SELECT reltuples::bigint "
                        + "FROM pg_catalog.pg_class WHERE oid = to_regclass(?)), 0))", Long.class, "public." + table);
                database.put("registrosEstimados." + table, new Metric(estimate, "registros", "estimado",
                        "PostgreSQL pg_class.reltuples", now));
            }
        } catch (RuntimeException ex) {
            log.warn("Coleta SQL de infraestrutura indisponível: {}", ex.getClass().getSimpleName());
            database.put("tamanhoLogicoBytes", unavailable("PostgreSQL", now));
        }
        neon.put("armazenamentoFaturadoBytes", unavailable("Neon API de consumo", now));
        neon.put("limiteArmazenamentoBytes", unavailable("Plano Neon confirmado pelo operador", now));
        neon.put("computacaoCuHoras", unavailable("Neon API de consumo", now));
        if (validId(neonProjectId) && !neonApiKey.isBlank()) {
            try {
                JsonNode project = getJson("https://console.neon.tech/api/v2/projects/" + neonProjectId,
                        "Bearer " + neonApiKey);
                String projectName = project.path("project").path("name").asText("");
                if (!projectName.isBlank()) neon.put("projeto", measured(projectName, "texto", "Neon Projects API", now));
            } catch (Exception ex) {
                log.warn("Coleta Neon indisponível: {}", ex.getClass().getSimpleName());
            }
        }
        google.put("requisicoes5Min", unavailable("Cloud Monitoring", now));
        google.put("cpu", unavailable("Cloud Monitoring", now));
        google.put("memoria", unavailable("Cloud Monitoring", now));
        google.put("instancias", unavailable("Cloud Monitoring", now));
        google.put("custoEstimado", unavailable("Cloud Billing", now));
        google.put("orcamentoMensal", unavailable("Cloud Billing", now));
        if (validId(googleProjectId) && validId(googleService)) collectGoogleRequests(google, now);
        cacheExpires = now.plusSeconds(ttlSeconds);
        cached = new Snapshot(databaseProvider, name, connection, Map.copyOf(database), Map.copyOf(neon),
                Map.copyOf(google), now, cacheExpires);
        return cached;
    }

    private void collectGoogleRequests(Map<String, Metric> google, Instant now) {
        try {
            // The metadata endpoint supplies the attached Cloud Run service identity; no JSON key file.
            HttpRequest tokenRequest = HttpRequest.newBuilder(URI.create(
                    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"))
                    .header("Metadata-Flavor", "Google").timeout(Duration.ofSeconds(2)).GET().build();
            HttpResponse<String> tokenResponse = http.send(tokenRequest, HttpResponse.BodyHandlers.ofString());
            if (tokenResponse.statusCode() != 200) return;
            String token = mapper.readTree(tokenResponse.body()).path("access_token").asText("");
            if (token.isBlank()) return;
            String filter = "metric.type=\"run.googleapis.com/request_count\" AND "
                    + "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\""
                    + googleService + "\"";
            String url = "https://monitoring.googleapis.com/v3/projects/" + googleProjectId + "/timeSeries?filter="
                    + URLEncoder.encode(filter, StandardCharsets.UTF_8) + "&interval.startTime="
                    + URLEncoder.encode(now.minusSeconds(300).toString(), StandardCharsets.UTF_8)
                    + "&interval.endTime=" + URLEncoder.encode(now.toString(), StandardCharsets.UTF_8)
                    + "&view=FULL&pageSize=100";
            JsonNode result = getJson(url, "Bearer " + token);
            if (result.hasNonNull("nextPageToken")) return; // Never present a truncated total.
            JsonNode series = result.path("timeSeries");
            if (!series.isArray()) return;
            long requests = 0;
            for (JsonNode item : series) for (JsonNode point : item.path("points")) {
                requests += point.path("value").path("int64Value").asLong(0);
            }
            google.put("requisicoes5Min", measured(requests, "requisições", "Cloud Monitoring API", now));
        } catch (Exception ex) {
            log.warn("Coleta Cloud Monitoring indisponível: {}", ex.getClass().getSimpleName());
        }
    }

    private JsonNode getJson(String url, String authorization) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url)).header("Authorization", authorization)
                .header("Accept", "application/json").timeout(Duration.ofSeconds(3)).GET().build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) throw new IllegalStateException("Provider HTTP " + response.statusCode());
        if (response.body().length() > 1_000_000) throw new IllegalStateException("Provider response too large");
        return mapper.readTree(response.body());
    }

    private static boolean validId(String value) {
        return value != null && value.matches("[A-Za-z0-9_-]{1,100}");
    }

    private static Metric measured(Object value, String unit, String source, Instant now) {
        return new Metric(value, unit, "medido", source, now);
    }

    private static Metric unavailable(String source, Instant now) {
        return new Metric(null, null, UNAVAILABLE, source, now);
    }
}
