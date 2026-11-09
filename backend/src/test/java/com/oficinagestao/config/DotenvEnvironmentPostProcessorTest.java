package com.oficinagestao.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.StandardEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class DotenvEnvironmentPostProcessorTest {

    @org.junit.jupiter.api.io.TempDir
    java.nio.file.Path directory;

    @Test
    void localFileSuppliesDatasourcePlaceholderWithoutOpeningAConnection() throws Exception {
        var file = directory.resolve(".env");
        java.nio.file.Files.writeString(file, "FORENSIC_SYNTHETIC_DB=jdbc:postgresql://127.0.0.1:5433/oficina_gestao_test\n");
        var environment = new StandardEnvironment();
        org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                new DotenvEnvironmentPostProcessor(), "loadEnvFile", file, environment);
        assertThat(environment.resolveRequiredPlaceholders("${FORENSIC_SYNTHETIC_DB}"))
                .isEqualTo("jdbc:postgresql://127.0.0.1:5433/oficina_gestao_test");
    }

    @Test
    void operatingSystemVariableIsNotOverwrittenByLocalFile() throws Exception {
        String key = System.getenv().keySet().stream()
                .filter(k -> k.matches("[A-Za-z_][A-Za-z0-9_]*"))
                .findFirst().orElseThrow();
        var file = directory.resolve(".env");
        java.nio.file.Files.writeString(file, key + "=synthetic-value-that-must-not-win\n");
        var environment = new StandardEnvironment();
        org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                new DotenvEnvironmentPostProcessor(), "loadEnvFile", file, environment);
        assertThat(environment.getPropertySources().contains("dotenvProperties")).isFalse();
    }

    @Test
    void doesNotLoadDotenvForTheDedicatedTestProfile() {
        StandardEnvironment environment = new StandardEnvironment();
        environment.setActiveProfiles("test");

        new DotenvEnvironmentPostProcessor().postProcessEnvironment(environment, null);

        assertThat(environment.getPropertySources().contains("dotenvProperties")).isFalse();
    }
}
