package com.oficinagestao.testsupport;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Test-only location policy. Production migrations and SG-01 are unchanged. */
public final class SyntheticMigrations {
    private SyntheticMigrations() { }

    public static String location(Environment environment) {
        try {
            String location = environment.getRequiredProperty("TEST_FLYWAY_LOCATION");
            require(location.startsWith("filesystem:") && !location.contains(","), "single filesystem location required");
            require(location.equals(environment.getRequiredProperty("spring.flyway.locations")), "location override rejected");
            Path directory = Path.of(location.substring("filesystem:".length()));
            require(directory.isAbsolute() && directory.normalize().equals(directory), "absolute normalized path required");
            for (Path ancestor = directory; ancestor != null; ancestor = ancestor.getParent()) {
                require(!Files.isSymbolicLink(ancestor), "linked path rejected");
            }
            require(Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS), "migration directory required");
            Map<String, String> expected = expectedHashes();
            try (var entries = Files.list(directory)) {
                Set<String> actual = entries.map(p -> p.getFileName().toString()).collect(Collectors.toSet());
                require(actual.equals(expected.keySet()), "exactly the 22 approved files required");
            }
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (var entry : expected.entrySet()) {
                Path file = directory.resolve(entry.getKey());
                require(Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS), "regular migration file required");
                String actual = HexFormat.of().formatHex(digest.digest(Files.readAllBytes(file)));
                require(actual.equalsIgnoreCase(entry.getValue()), "synthetic migration hash mismatch");
            }
            return location;
        } catch (IOException | NoSuchAlgorithmException | IllegalArgumentException exception) {
            // Do not attach configuration exceptions: their messages may contain sensitive values.
            throw new IllegalStateException("Synthetic test migrations: invalid configuration or unreadable files");
        }
    }

    private static Map<String, String> expectedHashes() throws IOException {
        try (var input = SyntheticMigrations.class.getResourceAsStream("/synthetic-migrations.sha256")) {
            require(input != null, "trusted checksum resource required");
            Map<String, String> hashes = new LinkedHashMap<>();
            for (String line : new String(input.readAllBytes(), StandardCharsets.UTF_8).lines().toList()) {
                require(line.matches("[A-F0-9]{64}  V[1-9][0-9]*__[a-z0-9_]+\\.sql"), "invalid checksum entry");
                String name = line.substring(66);
                require(name.startsWith("V" + (hashes.size() + 1) + "__"), "continuous versions required");
                hashes.put(name, line.substring(0, 64));
            }
            require(hashes.size() == 22, "22 trusted checksums required");
            return hashes;
        }
    }

    private static void require(boolean condition, String reason) {
        if (!condition) throw new IllegalStateException("Synthetic test migrations: " + reason);
    }

    @AutoConfiguration
    public static class Configuration {
        @Bean
        static BeanFactoryPostProcessor verifySyntheticMigrations(Environment environment) {
            return factory -> location(environment);
        }

        @Bean
        static BeanPostProcessor verifyEffectiveFlywayLocation(Environment environment) {
            return new BeanPostProcessor() {
                @Override
                public Object postProcessBeforeInitialization(Object bean, String name) {
                    if (bean instanceof Flyway flyway) {
                        String expected = location(environment);
                        String[] actual = Arrays.stream(flyway.getConfiguration().getLocations())
                                .map(org.flywaydb.core.api.Location::getDescriptor).toArray(String[]::new);
                        String descriptor = new org.flywaydb.core.api.Location(expected).getDescriptor();
                        require(Arrays.equals(actual, new String[] { descriptor }), "effective Flyway location rejected");
                    }
                    return bean;
                }
            };
        }
    }
}
