package com.oficinagestao.service;

import org.junit.jupiter.api.Test;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class SmtpNetwork5xxTest {
    @Test void realTcpRecipientRejectionCarriesPermanentSmtpCode() throws Exception {
        try (ServerSocket server = new ServerSocket(0, 1, java.net.InetAddress.getLoopbackAddress());
             var executor = Executors.newSingleThreadExecutor()) {
            server.setSoTimeout(5000);
            var exchange = executor.submit(() -> {
                try (var socket = server.accept();
                     var in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
                     var out = new PrintWriter(socket.getOutputStream(), true, StandardCharsets.US_ASCII)) {
                    socket.setSoTimeout(5000);
                    out.print("220 localhost synthetic SMTP\r\n"); out.flush();
                    boolean rejected = false;
                    for (String line; (line = in.readLine()) != null;) {
                        String command = line.toUpperCase(java.util.Locale.ROOT);
                        if (command.startsWith("EHLO") || command.startsWith("HELO")) out.print("250 localhost\r\n");
                        else if (command.startsWith("MAIL FROM")) out.print("250 sender accepted\r\n");
                        else if (command.startsWith("RCPT TO")) { out.print("550 5.1.1 synthetic recipient rejection\r\n"); rejected = true; }
                        else if (command.startsWith("QUIT")) { out.print("221 bye\r\n"); out.flush(); break; }
                        else out.print("250 ok\r\n");
                        out.flush();
                    }
                    return rejected;
                }
            });
            JavaMailSenderImpl sender = new JavaMailSenderImpl();
            sender.setHost("127.0.0.1"); sender.setPort(server.getLocalPort());
            sender.getJavaMailProperties().put("mail.smtp.connectiontimeout", "3000");
            sender.getJavaMailProperties().put("mail.smtp.timeout", "3000");
            MailException error = assertThrows(MailException.class, () ->
                    new EmailServiceImpl(sender, "sender@example.invalid")
                            .sendInvitation("recipient@example.invalid", "https://example.invalid/convite#token=synthetic"));
            assertTrue(exchange.get(5, TimeUnit.SECONDS));
            assertTrue(contains550(error), "SMTP 550 must survive the transport exception chain");
        }
    }

    private boolean contains550(Throwable error) {
        var queue = new java.util.ArrayDeque<Throwable>();
        var seen = new java.util.IdentityHashMap<Throwable, Boolean>();
        queue.add(error);
        while (!queue.isEmpty()) {
            var current = queue.removeFirst();
            if (seen.put(current, true) != null) continue;
            if (current instanceof org.eclipse.angus.mail.smtp.SMTPAddressFailedException failed
                    && failed.getReturnCode() == 550) return true;
            if (current.getCause() != null) queue.add(current.getCause());
            if (current instanceof jakarta.mail.MessagingException mail && mail.getNextException() != null)
                queue.add(mail.getNextException());
            if (current instanceof org.springframework.mail.MailSendException send)
                for (Exception nested : send.getMessageExceptions()) queue.add(nested);
        }
        return false;
    }
}
