package com.oficinagestao.service;

import com.oficinagestao.security.TokenHashUtil;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Invoked only by the separately authorized maintenance command, never by startup or HTTP. */
public final class InitialSuperAdminProvisioner {
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final InviteOutbox outbox;
    private final SecureRandom random = new SecureRandom();

    public InitialSuperAdminProvisioner(JdbcTemplate jdbc, TransactionTemplate transactions, InviteOutbox outbox) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.outbox = outbox;
    }

    public void provision(String suppliedEmail, String approvalReference) {
        if (suppliedEmail == null || !suppliedEmail.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+"))
            throw new IllegalArgumentException("Authorized recipient is invalid");
        if (approvalReference == null || !approvalReference.matches("[A-Za-z0-9._-]{8,100}"))
            throw new IllegalArgumentException("Approval reference is required");
        String email = suppliedEmail.trim().toLowerCase(Locale.ROOT);
        transactions.executeWithoutResult(status -> {
            jdbc.queryForList("SELECT pg_advisory_xact_lock(90221026)");
            // Freeze all application tables while checking that only migration seeds exist.
            List<String> tables = jdbc.queryForList("SELECT tablename FROM pg_tables "
                    + "WHERE schemaname='public' ORDER BY tablename", String.class);
            if (tables.isEmpty() || tables.stream().anyMatch(table -> !table.matches("[a-z][a-z0-9_]*")))
                throw new IllegalStateException("Unexpected application table inventory");
            jdbc.execute("LOCK TABLE " + tables.stream().map(table -> "public.\"" + table + "\"")
                    .reduce((left, right) -> left + ", " + right).orElseThrow()
                    + " IN SHARE ROW EXCLUSIVE MODE");
            Map<String, Integer> seeded = Map.of("flyway_schema_history", 6, "categorias", 6,
                    "configuracao_oficina", 1, "dps_numeracao", 1);
            for (String table : tables) {
                if (List.of("roles", "permissoes", "role_permissoes").contains(table)) continue;
                int expected = seeded.getOrDefault(table, 0);
                Integer actual = jdbc.queryForObject("SELECT count(*) FROM public.\"" + table + "\"", Integer.class);
                if (actual == null || actual != expected)
                    throw new IllegalStateException("Initial provisioning requires an untouched new database");
            }
            Integer versions = jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history "
                    + "WHERE version IN ('24','25','26','27','28','29') AND success=true", Integer.class);
            Integer baseline = jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history "
                    + "WHERE version='24' AND type='SQL_BASELINE' AND success=true", Integer.class);
            String current = jdbc.queryForObject("SELECT version FROM flyway_schema_history "
                    + "ORDER BY installed_rank DESC LIMIT 1", String.class);
            Integer users = jdbc.queryForObject("SELECT count(*) FROM usuarios", Integer.class);
            Integer invites = jdbc.queryForObject("SELECT count(*) FROM convites_usuarios", Integer.class);
            Integer deliveries = jdbc.queryForObject("SELECT count(*) FROM invite_delivery_outbox", Integer.class);
            Integer audit = jdbc.queryForObject("SELECT count(*) FROM eventos_administrativos", Integer.class);
            if (versions == null || versions != 6 || baseline == null || baseline != 1 || !"29".equals(current)
                    || users == null || users != 0 || invites == null || invites != 0 || deliveries == null
                    || deliveries != 0 || audit == null || audit != 0)
                throw new IllegalStateException("Initial provisioning requires an untouched B24–V29 database");
            Long roleId = jdbc.queryForObject("SELECT id FROM roles WHERE nome='ROLE_SUPER_ADMIN'", Long.class);
            if (roleId == null) throw new IllegalStateException("SUPER_ADMIN role is missing");
            byte[] bytes = new byte[32];
            random.nextBytes(bytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            Long inviteId = jdbc.queryForObject("INSERT INTO convites_usuarios(email,token_hash,role_id,expira_em) "
                    + "VALUES (?,?,?,now()+interval '24 hours') RETURNING id", Long.class,
                    email, TokenHashUtil.hashStatic(token), roleId);
            outbox.enqueue(inviteId, token);
            jdbc.update("INSERT INTO eventos_administrativos(acao,motivo,detalhes) VALUES (?,?,?)",
                    "SUPER_ADMIN_INICIAL_CONVITE", approvalReference, "convite_id=" + inviteId);
        });
    }
}
