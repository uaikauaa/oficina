package com.oficinagestao.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class InviteOutbox {
    private record Delivery(long id, long inviteId, int version, byte[] nonce, byte[] ciphertext,
                            String email, OffsetDateTime expiresAt, OffsetDateTime usedAt,
                            OffsetDateTime revokedAt, int attempts) { }

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final EmailService mail;
    private final Map<Integer, SecretKeySpec> keys;
    private final int activeVersion;
    private final String publicUrl;
    private final SecureRandom random = new SecureRandom();

    public InviteOutbox(JdbcTemplate jdbc, TransactionTemplate transactions, EmailService mail,
                        @Value("${security.invite-outbox.keys:}") String configuredKeys,
                        @Value("${security.invite-outbox.active-version:1}") int activeVersion,
                        @Value("${app.public-url}") String publicUrl) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.mail = mail;
        this.activeVersion = activeVersion;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
        Map<Integer, SecretKeySpec> parsed = new HashMap<>();
        try {
            for (String item : configuredKeys.split(",")) {
                if (item.isBlank()) continue;
                String[] pair = item.trim().split(":", 2);
                int version = Integer.parseInt(pair[0]);
                byte[] raw = Base64.getDecoder().decode(pair[1]);
                if (version < 1 || raw.length != 32 || parsed.putIfAbsent(version, new SecretKeySpec(raw, "AES")) != null)
                    throw new IllegalArgumentException();
                Arrays.fill(raw, (byte) 0);
            }
            if (!parsed.containsKey(activeVersion)) throw new IllegalArgumentException();
        } catch (RuntimeException error) {
            throw new IllegalStateException("Invalid invitation outbox key configuration");
        }
        this.keys = Map.copyOf(parsed);
    }

    /** Called inside the same transaction that inserts the invitation. */
    public void enqueue(long inviteId, String token) {
        byte[] nonce = new byte[12];
        random.nextBytes(nonce);
        byte[] encrypted = crypt(Cipher.ENCRYPT_MODE, keys.get(activeVersion), nonce, inviteId,
                token.getBytes(StandardCharsets.US_ASCII));
        jdbc.update("INSERT INTO invite_delivery_outbox(invite_id,key_version,nonce,ciphertext) VALUES (?,?,?,?)",
                inviteId, activeVersion, nonce, encrypted);
    }

    /** Workers hold a row lock through SMTP and acknowledgement; peers skip locked rows. */
    @Scheduled(fixedDelayString = "${security.invite-outbox.poll-ms:5000}",
            initialDelayString = "${security.invite-outbox.poll-ms:5000}")
    public void poll() {
        for (int i = 0; i < 10 && dispatchOne(); i++) { /* bounded batch */ }
    }

    public boolean dispatchOne() {
        Boolean processed = transactions.execute(status -> {
            var rows = jdbc.query("SELECT o.id,o.invite_id,o.key_version,o.nonce,o.ciphertext,o.attempts,"
                    + "c.email,c.expira_em,c.usado_em,c.revogado_em FROM invite_delivery_outbox o "
                    + "JOIN convites_usuarios c ON c.id=o.invite_id "
                    + "WHERE o.status='PENDING' AND o.next_attempt_at<=now() ORDER BY o.next_attempt_at,o.id "
                    + "LIMIT 1 FOR UPDATE OF o SKIP LOCKED", (rs, index) -> new Delivery(
                    rs.getLong("id"), rs.getLong("invite_id"), rs.getInt("key_version"),
                    rs.getBytes("nonce"), rs.getBytes("ciphertext"), rs.getString("email"),
                    rs.getObject("expira_em", OffsetDateTime.class),
                    rs.getObject("usado_em", OffsetDateTime.class),
                    rs.getObject("revogado_em", OffsetDateTime.class), rs.getInt("attempts")));
            if (rows.isEmpty()) return false;
            Delivery delivery = rows.getFirst();
            if (delivery.usedAt() != null || delivery.revokedAt() != null
                    || !delivery.expiresAt().isAfter(OffsetDateTime.now())) {
                terminal(delivery, "CANCELLED", "INVITE_INACTIVE");
                return true;
            }
            SecretKeySpec key = keys.get(delivery.version());
            if (key == null) {
                terminal(delivery, "EXHAUSTED", "KEY_UNAVAILABLE");
                return true;
            }
            String token;
            try {
                token = new String(crypt(Cipher.DECRYPT_MODE, key, delivery.nonce(), delivery.inviteId(),
                        delivery.ciphertext()), StandardCharsets.US_ASCII);
            } catch (IllegalStateException error) {
                terminal(delivery, "EXHAUSTED", "DECRYPTION_FAILED");
                return true;
            }
            try {
                mail.sendInvitation(delivery.email(), publicUrl + "/convite?token=" + token);
            } catch (RuntimeException error) {
                if (error instanceof org.springframework.mail.MailAuthenticationException
                        || error instanceof org.springframework.mail.MailParseException)
                    terminal(delivery, "EXHAUSTED", "SMTP_PERMANENT");
                else failure(delivery, "SMTP_FAILURE");
                return true;
            }
            jdbc.update("UPDATE invite_delivery_outbox SET status='SENT',nonce=NULL,ciphertext=NULL,"
                    + "sent_at=now(),attempts=attempts+1,last_failure=NULL WHERE id=?", delivery.id());
            audit(delivery, "CONVITE_ENTREGUE", "SMTP aceito");
            return true;
        });
        return Boolean.TRUE.equals(processed);
    }

    private void failure(Delivery d, String category) {
        int attempts = d.attempts() + 1;
        if (attempts >= 5) {
            terminal(d, "EXHAUSTED", category);
        } else {
            long delay = Math.min(3600, 30L << (attempts - 1));
            jdbc.update("UPDATE invite_delivery_outbox SET attempts=?,last_failure=?,"
                    + "next_attempt_at=now()+(? * interval '1 second') WHERE id=?", attempts, category, delay, d.id());
            audit(d, "CONVITE_ENTREGA_FALHOU", category);
        }
    }

    private void terminal(Delivery d, String state, String category) {
        jdbc.update("UPDATE invite_delivery_outbox SET status=?,nonce=NULL,ciphertext=NULL,"
                + "last_failure=?,attempts=CASE WHEN ?='EXHAUSTED' THEN LEAST(attempts+1,5) ELSE attempts END WHERE id=?",
                state, category, state, d.id());
        audit(d, "EXHAUSTED".equals(state) ? "CONVITE_ENTREGA_ESGOTADA" : "CONVITE_ENTREGA_CANCELADA", category);
    }

    private void audit(Delivery d, String action, String details) {
        jdbc.update("INSERT INTO eventos_administrativos(acao,detalhes) VALUES (?,?)", action,
                "Convite " + d.inviteId() + ": " + details);
    }

    private static byte[] crypt(int mode, SecretKeySpec key, byte[] nonce, long inviteId, byte[] input) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(mode, key, new GCMParameterSpec(128, nonce));
            cipher.updateAAD(Long.toString(inviteId).getBytes(StandardCharsets.US_ASCII));
            return cipher.doFinal(input);
        } catch (Exception error) {
            throw new IllegalStateException("Invitation payload cryptography failed");
        }
    }
}
