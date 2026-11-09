package com.oficinagestao.controller;

import com.oficinagestao.service.InfrastructureMonitoringService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/resumo")
public class AdminDashboardController {
    private final JdbcTemplate jdbc;
    private final InfrastructureMonitoringService infrastructure;

    public record RecentEvent(String acao, OffsetDateTime ocorridoEm) {}
    public record Summary(long usuarios, long ativos, long inativos, long convitesPendentes,
                          Map<String, Long> usuariosPorPapel, List<RecentEvent> eventosRecentes,
                          String conexaoBanco, String origemBanco, OffsetDateTime atualizadoEm) {}

    public AdminDashboardController(JdbcTemplate jdbc, InfrastructureMonitoringService infrastructure) {
        this.jdbc = jdbc;
        this.infrastructure = infrastructure;
    }

    @GetMapping
    public Summary summary() {
        long total = jdbc.queryForObject("SELECT count(*) FROM usuarios", Long.class);
        long active = jdbc.queryForObject("SELECT count(*) FROM usuarios WHERE ativo=true", Long.class);
        long invites = jdbc.queryForObject("SELECT count(*) FROM convites_usuarios WHERE usado_em IS NULL "
                + "AND revogado_em IS NULL AND expira_em > now()", Long.class);
        Map<String, Long> byRole = new LinkedHashMap<>();
        jdbc.query("SELECT r.nome, count(*) AS quantidade FROM roles r JOIN usuario_roles ur ON ur.role_id=r.id "
                + "GROUP BY r.nome ORDER BY r.nome", (org.springframework.jdbc.core.RowCallbackHandler) rs ->
                byRole.put(rs.getString("nome"), rs.getLong("quantidade")));
        List<RecentEvent> events = jdbc.query("SELECT acao,ocorrido_em FROM eventos_administrativos "
                + "ORDER BY ocorrido_em DESC,id DESC LIMIT 5", (rs, row) ->
                new RecentEvent(rs.getString("acao"), rs.getObject("ocorrido_em", OffsetDateTime.class)));
        var infra = infrastructure.snapshot();
        return new Summary(total, active, total - active, invites, byRole, events,
                infra.connectionStatus(), infra.databaseProvider(), OffsetDateTime.now());
    }
}
