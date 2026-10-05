package com.oficinagestao.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.env.StandardEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class DotenvEnvironmentPostProcessorTest {

    @Test
    void doesNotLoadDotenvForTheDedicatedTestProfile() {
        StandardEnvironment environment = new StandardEnvironment();
        environment.setActiveProfiles("test");

        new DotenvEnvironmentPostProcessor().postProcessEnvironment(environment, null);

        assertThat(environment.getPropertySources().contains("dotenvProperties")).isFalse();
    }
}
