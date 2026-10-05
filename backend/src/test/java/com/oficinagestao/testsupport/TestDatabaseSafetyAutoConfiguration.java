package com.oficinagestao.testsupport;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;

@AutoConfiguration
public class TestDatabaseSafetyAutoConfiguration {

    @Bean
    static BeanFactoryPostProcessor testDatabaseSafetyBeanFactoryPostProcessor(Environment environment) {
        TestDatabaseSafetyGuard.validate(environment);
        return beanFactory -> {
            // Validation intentionally runs while post-processors are created,
            // before DataSource, Flyway, JPA or application runners can start.
        };
    }
}
