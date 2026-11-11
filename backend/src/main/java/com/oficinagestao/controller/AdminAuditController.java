package com.oficinagestao.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.ArrayList;
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
                          @RequestParam(defaultValue = "20") int size,
                          @RequestParam(required = false) String acao,
                          @RequestParam(required = false) Long usuarioId,
                          @RequestParam(required = false) OffsetDateTime de,
                          @RequestParam(required = false) OffsetDateTime ate,
                          @RequestParam(defaultValue = "desc") String ordem) {
        if (page < 0 || size < 1 || size > 100 || page > 1_000_000
                || (acao != null && acao.length() > 80)
                || (usuarioId != null && usuarioId < 1)
                || (de != null && ate != null && de.isAfter(ate))
                || !(ordem.equals("asc") || ordem.equals("desc"))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Filtro de auditoria inválido.");
        }
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (acao != null && !acao.isBlank()) {
            where.append(" AND acao ILIKE ? ESCAPE '\\'");
            args.add("%" + acao.trim().replace("\\", "\\\\").replace("%", "\\%")
                    .replace("_", "\\_") + "%");
        }
        if (usuarioId != null) {
            where.append(" AND (ator_id=? OR alvo_usuario_id=?)");
            args.add(usuarioId); args.add(usuarioId);
        }
        if (de != null) { where.append(" AND ocorrido_em>=?"); args.add(de); }
        if (ate != null) { where.append(" AND ocorrido_em<=?"); args.add(ate); }
        long total = jdbc.queryForObject("SELECT count(*) FROM eventos_administrativos" + where,
                Long.class, args.toArray());
        List<Object> pagedArgs = new ArrayList<>(args);
        pagedArgs.add(size);
        pagedArgs.add((long) page * size);
        String direction = ordem.equals("asc") ? "ASC" : "DESC";
        List<Event> content = jdbc.query("SELECT id,ator_id,alvo_usuario_id,acao,motivo,detalhes,ocorrido_em "
                + "FROM eventos_administrativos" + where + " ORDER BY ocorrido_em " + direction
                + ",id " + direction + " LIMIT ? OFFSET ?",
                (rs, row) -> new Event(rs.getLong("id"), rs.getObject("ator_id", Long.class),
                        rs.getObject("alvo_usuario_id", Long.class), rs.getString("acao"),
                        rs.getString("motivo"), rs.getString("detalhes"),
                        rs.getObject("ocorrido_em", OffsetDateTime.class)),
                pagedArgs.toArray());
        return new EventPage(content, total, page, size);
    }
}
