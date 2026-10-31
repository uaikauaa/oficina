package com.oficinagestao.config;

import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import java.net.*;
import java.io.*;
import java.util.Properties;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

class SmtpDowngradeAuditTest {
    @Test void productionRequiresTlsEvenWhenSmtpServerOmitsStarttls() throws Exception {
        Properties production = new Properties();
        try (var in = getClass().getResourceAsStream("/application-prod.properties")) { production.load(in); }
        assertEquals("true", production.getProperty("spring.mail.properties.mail.smtp.starttls.required"));
        assertEquals("true", production.getProperty("spring.mail.properties.mail.smtp.ssl.checkserveridentity"));
        // A bounded, loopback-only SMTP peer proves enable=true alone permits downgrade.
        for (boolean required : new boolean[]{false, true}) {
            try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"));
                 ExecutorService executor = Executors.newSingleThreadExecutor()) {
                server.setSoTimeout(3000);
                Future<?> peer = executor.submit(() -> {
                    try (Socket socket = server.accept()) {
                        socket.setSoTimeout(3000);
                        var reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                        var writer = new PrintWriter(socket.getOutputStream(), true);
                        writer.print("220 audit.local ESMTP\r\n"); writer.flush();
                        String command;
                        while ((command = reader.readLine()) != null) {
                            if (command.startsWith("QUIT")) { writer.print("221 bye\r\n"); writer.flush(); break; }
                            writer.print("250 audit.local\r\n"); writer.flush();
                        }
                    } catch (IOException ex) { throw new UncheckedIOException(ex); }
                });
                var sender = new JavaMailSenderImpl();
                sender.setHost("127.0.0.1"); sender.setPort(server.getLocalPort());
                sender.getJavaMailProperties().setProperty("mail.smtp.starttls.enable", "true");
                sender.getJavaMailProperties().setProperty("mail.smtp.starttls.required", Boolean.toString(required));
                sender.getJavaMailProperties().setProperty("mail.smtp.timeout", "2000");
                sender.getJavaMailProperties().setProperty("mail.smtp.connectiontimeout", "2000");
                if (required) assertThrows(jakarta.mail.MessagingException.class, sender::testConnection);
                else assertDoesNotThrow(sender::testConnection);
                peer.get(5, TimeUnit.SECONDS);
            }
        }
    }
}
