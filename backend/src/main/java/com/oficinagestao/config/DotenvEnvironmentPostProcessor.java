package com.oficinagestao.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Carrega variáveis de ambiente a partir de um arquivo .env local caso exista.
 * Prioriza variáveis já existentes no ambiente do sistema operacional.
 */
public class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String PROPERTY_SOURCE_NAME = "dotenvProperties";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        List<Path> candidatePaths = List.of(
                Paths.get(".env"),
                Paths.get("../.env"),
                Paths.get("backend/.env")
        );

        for (Path path : candidatePaths) {
            if (Files.exists(path) && Files.isRegularFile(path)) {
                loadEnvFile(path, environment);
                break;
            }
        }
    }

    private void loadEnvFile(Path path, ConfigurableEnvironment environment) {
        try {
            List<String> lines = Files.readAllLines(path);
            Map<String, Object> props = new HashMap<>();

            for (String line : lines) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                int eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    String key = trimmed.substring(0, eqIdx).trim();
                    String value = trimmed.substring(eqIdx + 1).trim();

                    // Remove aspas simples ou duplas envolventes
                    if ((value.startsWith("\"") && value.endsWith("\"")) ||
                            (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.substring(1, value.length() - 1);
                    }

                    // Somente define se não estiver previamente definida no sistema operacional
                    if (System.getenv(key) == null) {
                        props.put(key, value);
                    }
                }
            }

            if (!props.isEmpty()) {
                environment.getPropertySources().addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, props));
                System.out.println("[Dotenv] Loaded " + props.size() + " properties from " + path.toAbsolutePath());
            }
        } catch (IOException e) {
            // Se falhar a leitura silenciosamente, continua com as variáveis do ambiente
        }
    }
}
