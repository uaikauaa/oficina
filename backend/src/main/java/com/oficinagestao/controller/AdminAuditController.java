package com.oficinagestao.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/admin/auditoria")
public class AdminAuditController {
    private final JdbcTemplate jdbc;
    public AdminAuditController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Event(Long id, Long atorId, Long alvoUsuarioId, String acao, String motivo,
                        String detalhes, OffsetDateTime ocorridoEm) {}
    public record EventPage(List<Event> content, long totalElements, int page, int size) {}

    @GetMapping
    public EventPage list(@RequestParam(defaultValue = "0") int page,
                          @RequestParam(defaultValue = "20") int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        long total = jdbc.queryForObject("SELECT count(*) FROM eventos_administrativos", Long.class);
        List<Event> content = jdbc.query("SELECT id,ator_id,alvo_usuario_id,acao,motivo,detalhes,ocorrido_em "
                + "FROM eventos_administrativos ORDER BY ocorrido_em DESC,id DESC LIMIT ? OFFSET ?",
                (rs, row) -> new Event(rs.getLong("id"), rs.getObject("ator_id", Long.class),
                        rs.getObject("alvo_usuario_id", Long.class), rs.getString("acao"),
                        rs.getString("motivo"), rs.getString("detalhes"),
                        rs.getObject("ocorrido_em", OffsetDateTime.class)),
                safeSize, (long) safePage * safeSize);
        return new EventPage(content, total, safePage, safeSize);
    }
}
