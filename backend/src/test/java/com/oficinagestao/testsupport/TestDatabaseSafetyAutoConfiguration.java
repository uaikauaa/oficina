package com.oficinagestao.testsupport;

import com.zaxxer.hikari.HikariDataSource;
import jakarta.persistence.EntityManagerFactory;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.FactoryBean;
import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.factory.config.InstantiationAwareBeanPostProcessor;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayConfigurationCustomizer;
import org.springframework.boot.autoconfigure.flyway.FlywayConnectionDetails;
import org.springframework.boot.autoconfigure.jdbc.JdbcConnectionDetails;
import org.springframework.boot.autoconfigure.orm.jpa.EntityManagerFactoryBuilderCustomizer;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.core.ResolvableType;
import org.springframework.core.env.Environment;
import org.springframework.core.type.MethodMetadata;
import org.springframework.orm.jpa.JpaVendorAdapter;
import org.springframework.orm.jpa.persistenceunit.PersistenceUnitManager;
import org.springframework.orm.jpa.persistenceunit.PersistenceUnitPostProcessor;

import javax.sql.DataSource;
import java.util.Map;
import java.util.Set;

import static com.oficinagestao.testsupport.TestDatabaseSafetyGuard.Reason.*;
import static com.oficinagestao.testsupport.TestDatabaseSafetyGuard.rejected;

/**
 * Test-only policy for the project's Boot-managed JDBC stack, not a sandbox for arbitrary Java.
 * Initializer -> early instantiation barrier -> definition audit -> recheck before consumers.
 * The factory provenance below is verified against Boot 3.4.13; review it on Boot upgrades.
 * Requires the test Initializer for every guarded context. It does not govern direct JDBC calls,
 * work already done by an unguarded parent, or code that removes/bypasses Spring's processors.
 * Type contracts must be honest: arbitrary Object-returning methods and mutations after startup
 * are outside this project's supported configuration. No operational connection is made to probe identity.
 */
@AutoConfiguration
public class TestDatabaseSafetyAutoConfiguration {
    private static final String LIFECYCLE = TestDatabaseSafetyAutoConfiguration.class.getName() + ".lifecycle";
    private static final String JPA = "org.springframework.boot.autoconfigure.orm.jpa.JpaBaseConfiguration";
    private static final String FLYWAY = "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration$FlywayConfiguration";
    private record BootFactory(String owner, String method) { }
    private static final Map<Class<?>, BootFactory> BOOT_FACTORIES = Map.of(
            DataSource.class, new BootFactory("org.springframework.boot.autoconfigure.jdbc.DataSourceConfiguration$Hikari", "dataSource"),
            JdbcConnectionDetails.class, new BootFactory("org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration$PooledDataSourceConfiguration", "jdbcConnectionDetails"),
            FlywayConnectionDetails.class, new BootFactory(FLYWAY, "flywayConnectionDetails"),
            Flyway.class, new BootFactory(FLYWAY, "flyway"),
            EntityManagerFactory.class, new BootFactory(JPA, "entityManagerFactory"),
            EntityManagerFactoryBuilder.class, new BootFactory(JPA, "entityManagerFactoryBuilder"),
            JpaVendorAdapter.class, new BootFactory(JPA, "jpaVendorAdapter"),
            FlywayConfigurationCustomizer.class, new BootFactory(FLYWAY + "$PostgresqlConfiguration", "postgresqlFlywayConfigurationCustomizer"));
    private static final Set<Class<?>> UNUSED_EXTENSIONS = Set.of(PersistenceUnitManager.class,
            PersistenceUnitPostProcessor.class, HibernatePropertiesCustomizer.class,
            EntityManagerFactoryBuilderCustomizer.class);

    /** Loaded by SpringApplication (including SpringBootTest), only from test spring.factories. */
    public static final class Initializer implements ApplicationContextInitializer<ConfigurableApplicationContext>, Ordered {
        @Override public int getOrder() { return Ordered.LOWEST_PRECEDENCE; }

        @Override public void initialize(ConfigurableApplicationContext context) {
            TestDatabaseSafetyGuard.validate(context.getEnvironment());
            var factory = context.getBeanFactory();
            if (!factory.containsSingleton(LIFECYCLE)) {
                var state = new SafetyState();
                factory.registerSingleton(LIFECYCLE, state);
                // Installed before registry/factory postprocessors, unlike a @Bean BPP.
                factory.addBeanPostProcessor(new SafetyLifecycle(factory, context.getEnvironment(), state));
            }
        }
    }

    @Bean
    static BeanFactoryPostProcessor testDatabaseSafetyBeanFactoryPostProcessor(Environment environment) {
        TestDatabaseSafetyGuard.validate(environment);
        return factory -> {
            if (!(factory.getSingleton(LIFECYCLE) instanceof SafetyState state)) {
                throw rejected(INITIALIZER_REQUIRED, "the test safety initializer must run before refresh");
            }
            inspectDefinitions(factory);
            state.definitionsInspected = true;
        };
    }

    private static void inspectDefinitions(ConfigurableListableBeanFactory factory) {
        inspectAncestors(factory.getParentBeanFactory());
        for (var entry : BOOT_FACTORIES.entrySet()) {
            for (String name : factory.getBeanNamesForType(entry.getKey(), true, false)) {
                requireBootFactory(factory, name, entry.getValue());
            }
        }
        for (Class<?> type : UNUSED_EXTENSIONS) {
            if (factory.getBeanNamesForType(type, true, false).length != 0) {
                throw rejected(JPA_EXTENSION, "custom connection extensions are forbidden: " + type.getSimpleName());
            }
        }
        inspectFactories(factory, false);
    }

    private static void inspectAncestors(BeanFactory parent) {
        while (parent != null) {
            if (!(parent instanceof ConfigurableListableBeanFactory ancestor)) {
                throw rejected(ANCESTOR_CONNECTION, "an uninspectable ancestor may supply a connection");
            }
            for (Class<?> type : BOOT_FACTORIES.keySet()) {
                if (ancestor.getBeanNamesForType(type, true, false).length != 0) {
                    throw rejected(ANCESTOR_CONNECTION, "ancestor connection beans are forbidden");
                }
            }
            for (Class<?> type : UNUSED_EXTENSIONS) {
                if (ancestor.getBeanNamesForType(type, true, false).length != 0) {
                    throw rejected(ANCESTOR_CONNECTION, "ancestor connection extensions are forbidden");
                }
            }
            inspectFactories(ancestor, true);
            parent = ancestor.getParentBeanFactory();
        }
    }

    private static void inspectFactories(ConfigurableListableBeanFactory factory, boolean ancestor) {
        for (String factoryName : factory.getBeanNamesForType(FactoryBean.class, true, false)) {
            String name = factoryName.startsWith("&") ? factoryName.substring(1) : factoryName;
            Class<?> product = factory.getType(name, false);
            // Raw/FactoryBean<Object> products cannot prove that they are unrelated to connections.
            // Typed ordinary factories (including Spring Data repository factories) remain allowed.
            if (product == null || product == Object.class) {
                throw rejected(ancestor ? ANCESTOR_CONNECTION : INDETERMINATE_FACTORY,
                        "an indeterminate FactoryBean product may supply a connection");
            }
        }
    }

    private static void requireBootFactory(ConfigurableListableBeanFactory factory, String name, BootFactory allowed) {
        if (factory.containsBeanDefinition(name)
                && factory.getBeanDefinition(name) instanceof AnnotatedBeanDefinition definition) {
            MethodMetadata metadata = definition.getFactoryMethodMetadata();
            if (metadata != null && allowed.owner().equals(metadata.getDeclaringClassName())
                    && allowed.method().equals(metadata.getMethodName())) {
                return;
            }
        }
        throw rejected(CONNECTION_BEAN, "custom connection beans are forbidden");
    }

    private static boolean connectionType(Class<?> type) {
        return BOOT_FACTORIES.keySet().stream().anyMatch(candidate -> candidate.isAssignableFrom(type))
                || UNUSED_EXTENSIONS.stream().anyMatch(candidate -> candidate.isAssignableFrom(type));
    }

    private static final class SafetyState {
        private boolean definitionsInspected;
    }

    private static final class SafetyLifecycle implements InstantiationAwareBeanPostProcessor {
        private final ConfigurableListableBeanFactory factory;
        private final Environment environment;
        private final SafetyState state;

        private SafetyLifecycle(ConfigurableListableBeanFactory factory, Environment environment, SafetyState state) {
            this.factory = factory;
            this.environment = environment;
            this.state = state;
        }

        @Override public Object postProcessBeforeInstantiation(Class<?> type, String name) {
            boolean connection = connectionType(type);
            if (FactoryBean.class.isAssignableFrom(type)) {
                boolean registered = factory.containsBeanDefinition(name);
                Class<?> product;
                if (registered) {
                    product = factory.getType(name, false);
                } else {
                    // Inner beans have no independently addressable definition. Inspect the
                    // concrete class contract without constructing the factory or its product.
                    var contract = ResolvableType.forClass(type).as(FactoryBean.class);
                    product = contract.hasUnresolvableGenerics() ? null : contract.getGeneric(0).resolve();
                }
                if (product == null || product == Object.class) {
                    throw rejected(INDETERMINATE_FACTORY, "an indeterminate FactoryBean product may supply a connection");
                }
                connection |= connectionType(product);
                if (!registered && connection) {
                    // Definition enumeration cannot establish Boot provenance for an inner factory.
                    throw rejected(CONNECTION_BEAN, "inner connection factories are forbidden");
                }
            }
            if (connection) {
                TestDatabaseSafetyGuard.validate(environment);
                if (!state.definitionsInspected) {
                    throw rejected(EARLY_CONNECTION, "connection beans cannot initialize before the definition audit");
                }
                // Recheck registrations/properties changed by later BFPPs, immediately before use.
                inspectDefinitions(factory);
                for (String datasource : factory.getBeanNamesForType(DataSource.class, true, false)) {
                    if (factory.getSingleton(datasource) instanceof HikariDataSource pool) {
                        TestDatabaseSafetyGuard.validatePool(environment, pool);
                    }
                }
            }
            return null;
        }

        @Override public Object postProcessAfterInitialization(Object bean, String name) {
            if (bean instanceof HikariDataSource pool) {
                TestDatabaseSafetyGuard.validatePool(environment, pool);
            }
            return bean;
        }
    }
}
