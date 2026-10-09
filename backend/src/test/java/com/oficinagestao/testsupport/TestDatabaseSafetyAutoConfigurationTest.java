package com.oficinagestao.testsupport;

import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.FactoryBean;
import org.springframework.beans.factory.support.RootBeanDefinition;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.beans.factory.support.BeanDefinitionRegistryPostProcessor;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.Banner;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.AutoConfigurationPackage;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.data.jpa.JpaRepositoriesAutoConfiguration;
import org.springframework.boot.orm.jpa.EntityManagerFactoryBuilder;
import org.springframework.beans.factory.config.InstantiationAwareBeanPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.annotation.ImportCandidates;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayConfigurationCustomizer;
import org.springframework.boot.autoconfigure.flyway.FlywayConnectionDetails;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.JdbcConnectionDetails;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.boot.autoconfigure.orm.jpa.EntityManagerFactoryBuilderCustomizer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.PriorityOrdered;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.ResourcePropertySource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.persistenceunit.PersistenceUnitManager;
import org.springframework.orm.jpa.persistenceunit.DefaultPersistenceUnitManager;
import org.springframework.orm.jpa.persistenceunit.PersistenceUnitPostProcessor;
import org.springframework.jdbc.datasource.AbstractDataSource;
import org.springframework.test.util.ReflectionTestUtils;

import javax.sql.DataSource;
import jakarta.persistence.EntityManagerFactory;
import java.io.IOException;
import java.sql.Connection;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static com.oficinagestao.testsupport.TestDatabaseSafetyGuard.Reason.*;

/** Minimal contexts only: no application scanning, real migrations, scheduler or database connections. */
class TestDatabaseSafetyAutoConfigurationTest {

    @Test
    void rejectsPersistenceUnitManagerBeforeItsFactoryRuns() {
        AtomicInteger factories = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                .withBean("alternativeManager", PersistenceUnitManager.class, () -> {
                    factories.incrementAndGet();
                    throw new AssertionError("SENTINEL_MANAGER_FACTORY");
                })
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), JPA_EXTENSION);
                    assertThat(context.getStartupFailure()).hasStackTraceContaining("PersistenceUnitManager");
                    assertEquals(0, factories.get());
                });
    }

    @Test
    void rejectsIndeterminateFactoryWithoutConstructingIt() {
        AtomicInteger factories = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                .withBean("unknownFactory", RawConnectionFactory.class, () -> {
                    factories.incrementAndGet();
                    throw new AssertionError("SENTINEL_UNKNOWN_FACTORY");
                })
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), INDETERMINATE_FACTORY);
                    assertThat(context.getStartupFailure()).hasStackTraceContaining("indeterminate");
                    assertEquals(0, factories.get());
                });
    }

    @Test
    void rejectsParentDatasourceWithoutInvokingItsFactory() {
        AtomicInteger factories = new AtomicInteger();
        try (var parent = new AnnotationConfigApplicationContext()) {
            parent.registerBean("parentDatasource", DataSource.class, () -> {
                factories.incrementAndGet();
                throw new AssertionError("SENTINEL_PARENT_FACTORY");
            }, definition -> definition.setLazyInit(true));
            parent.refresh();
            runner(true).withParent(parent)
                    .withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                    .run(context -> {
                        assertThat(context).hasFailed();
                        assertReason(context.getStartupFailure(), ANCESTOR_CONNECTION);
                        assertThat(context.getStartupFailure()).hasStackTraceContaining("ancestor");
                        assertEquals(0, factories.get());
                    });
        }
    }

    @Test
    void rejectsEarlyPostprocessorBeforeDatasourceFactoryRuns() {
        AtomicInteger factories = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                .withInitializer(context -> context.addBeanFactoryPostProcessor(factory -> {
                    var definition = new RootBeanDefinition(DataSource.class, () -> {
                        factories.incrementAndGet();
                        throw new AssertionError("SENTINEL_EARLY_FACTORY");
                    });
                    ((BeanDefinitionRegistry) factory).registerBeanDefinition("earlyDatasource", definition);
                    factory.getBean("earlyDatasource");
                }))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), EARLY_CONNECTION);
                    assertThat(context.getStartupFailure()).hasStackTraceContaining("Test database safety guard:");
                    assertEquals(0, factories.get());
                });
    }

    @SuppressWarnings("rawtypes")
    static class RawConnectionFactory implements FactoryBean {
        @Override public Object getObject() { throw new AssertionError("SENTINEL_FACTORY_PRODUCT"); }
        @Override public Class<?> getObjectType() { return null; }
    }

    @Test
    void rejectsPriorityOrderedRegistryProcessorBeforeConnectionConstruction() {
        AtomicInteger processors = new AtomicInteger();
        AtomicInteger factories = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                .withBean("earlyRegistryProcessor", EarlyRegistryProcessor.class,
                        () -> new EarlyRegistryProcessor(processors, factories))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), EARLY_CONNECTION);
                    assertEquals(1, processors.get());
                    assertEquals(0, factories.get());
                });
    }

    static class EarlyRegistryProcessor implements BeanDefinitionRegistryPostProcessor, PriorityOrdered {
        private final AtomicInteger processors;
        private final AtomicInteger factories;
        EarlyRegistryProcessor(AtomicInteger processors, AtomicInteger factories) {
            this.processors = processors;
            this.factories = factories;
        }
        @Override public int getOrder() { return PriorityOrdered.HIGHEST_PRECEDENCE; }
        @Override public void postProcessBeanDefinitionRegistry(BeanDefinitionRegistry registry) {
            processors.incrementAndGet();
            registry.registerBeanDefinition("registryDatasource", new RootBeanDefinition(DataSource.class, () -> {
                factories.incrementAndGet();
                throw new AssertionError("SENTINEL_REGISTRY_FACTORY");
            }));
            ((ConfigurableListableBeanFactory) registry).getBean("registryDatasource");
        }
        @Override public void postProcessBeanFactory(ConfigurableListableBeanFactory factory) { }
    }

    @Test
    void invalidEnvironmentStopsBeforeEvenTheEarlyRegistryProcessor() {
        AtomicInteger processors = new AtomicInteger();
        AtomicInteger factories = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                .withPropertyValues("TEST_DB_URL=jdbc:postgresql://remote.invalid/unused")
                .withBean("earlyRegistryProcessor", EarlyRegistryProcessor.class,
                        () -> new EarlyRegistryProcessor(processors, factories))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), DATABASE_IDENTITY);
                    assertEquals(0, processors.get());
                    assertEquals(0, factories.get());
                });
    }

    @Test
    void requiresEarlyInitializerRatherThanSilentlyOfferingOnlyLateProtection() {
        unguardedRunner(true).withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), INITIALIZER_REQUIRED);
                });
    }

    @Test
    void rejectsIndeterminateFactoryInParentWithoutInstantiatingIt() {
        AtomicInteger factories = new AtomicInteger();
        try (var parent = new AnnotationConfigApplicationContext()) {
            parent.refresh();
            // Audit a still-uninstantiated parent definition. A child's guard cannot protect
            // operations already performed while an independently unguarded parent refreshed.
            parent.registerBean("unknownParentFactory", RawConnectionFactory.class, () -> {
                factories.incrementAndGet();
                throw new AssertionError("SENTINEL_PARENT_UNKNOWN_FACTORY");
            }, definition -> definition.setLazyInit(true));
            runner(true).withParent(parent)
                    .withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                    .run(context -> {
                        assertThat(context).hasFailed();
                        assertReason(context.getStartupFailure(), ANCESTOR_CONNECTION);
                        assertEquals(0, factories.get());
                    });
        }
    }

    @Test
    void demonstratesBootBuilderAcceptsExternalPersistenceUnitWithoutOpeningConnections() {
        AtomicInteger connections = new AtomicInteger();
        var alternative = new NoNetworkDataSource(connections);
        var manager = externalManager(alternative);
        unguardedRunner(true).withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                        HibernateJpaAutoConfiguration.class))
                .withBean("externalManager", PersistenceUnitManager.class, () -> manager)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    var builder = context.getBean(EntityManagerFactoryBuilder.class);
                    var metadata = builder.dataSource(context.getBean(DataSource.class)).build();
                    assertThat(ReflectionTestUtils.getField(metadata, "persistenceUnitManager")).isSameAs(manager);
                    assertThat(manager.obtainDefaultPersistenceUnitInfo().getNonJtaDataSource()).isSameAs(alternative);
                    assertThat(context.getBean(HikariDataSource.class).isRunning()).isFalse();
                    assertEquals(0, connections.get());
                });
    }

    @Test
    void rejectsManagerThatWouldSupplyAlternativeDatasourceBeforeConstructionOrUse() {
        AtomicInteger factories = new AtomicInteger();
        AtomicInteger connections = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                        HibernateJpaAutoConfiguration.class, TestDatabaseSafetyAutoConfiguration.class))
                .withBean("externalManager", PersistenceUnitManager.class, () -> {
                    factories.incrementAndGet();
                    return externalManager(new NoNetworkDataSource(connections));
                })
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), JPA_EXTENSION);
                    assertEquals(0, factories.get());
                    assertEquals(0, connections.get());
                });
    }

    private static DefaultPersistenceUnitManager externalManager(DataSource datasource) {
        var manager = new DefaultPersistenceUnitManager();
        manager.setDefaultDataSource(datasource);
        manager.setPackagesToScan("com.oficinagestao.testsupport");
        manager.afterPropertiesSet(); // Persistence metadata only; no provider or EntityManagerFactory.
        return manager;
    }

    private static final class NoNetworkDataSource extends AbstractDataSource {
        private final AtomicInteger connections;
        private NoNetworkDataSource(AtomicInteger connections) { this.connections = connections; }
        @Override public Connection getConnection() {
            connections.incrementAndGet();
            throw new AssertionError("SENTINEL_CONNECTION_ATTEMPT; no network implementation exists");
        }
        @Override public Connection getConnection(String username, String password) { return getConnection(); }
    }

    @Test
    void rejectsTypedFactoryEvenWhenGetObjectTypeWouldReturnNull() {
        AtomicInteger factories = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                .withBean("nullTypeFactory", NullTypeDataSourceFactory.class, () -> {
                    factories.incrementAndGet();
                    throw new AssertionError("SENTINEL_NULL_TYPE_FACTORY");
                })
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), CONNECTION_BEAN);
                    assertEquals(0, factories.get());
                });
    }

    static class NullTypeDataSourceFactory implements FactoryBean<DataSource> {
        @Override public DataSource getObject() { throw new AssertionError("SENTINEL_FACTORY_PRODUCT"); }
        @Override public Class<?> getObjectType() { return null; }
    }

    @Test
    void permitsOrdinaryTypedFactoryAndAnUnrelatedParent() {
        AtomicInteger products = new AtomicInteger();
        try (var parent = new AnnotationConfigApplicationContext()) {
            parent.registerBean("parentString", String.class, () -> "ordinary parent");
            parent.refresh();
            runner(true).withParent(parent)
                    .withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                    .withBean("ordinaryFactory", StringFactory.class, () -> new StringFactory(products))
                    .run(context -> {
                        assertThat(context).hasNotFailed();
                        assertEquals(0, products.get(), "Inspection must not call getObject");
                        assertThat(context.getBean("ordinaryFactory")).isEqualTo("ordinary product");
                        assertEquals(1, products.get());
                        assertThat(context.getBean("parentString")).isEqualTo("ordinary parent");
                    });
        }
    }

    static class StringFactory implements FactoryBean<String> {
        private final AtomicInteger products;
        StringFactory(AtomicInteger products) { this.products = products; }
        @Override public String getObject() { products.incrementAndGet(); return "ordinary product"; }
        @Override public Class<?> getObjectType() { return String.class; }
    }

    @Test
    void rejectsDefinitionRegisteredByPostprocessorAfterTheAudit() {
        AtomicInteger mutations = new AtomicInteger();
        AtomicInteger factories = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                .withInitializer(context -> context.addBeanFactoryPostProcessor(factory -> {
                    // Added after configuration parsing, so this non-ordered BFPP follows the guard.
                    ((BeanDefinitionRegistry) factory).registerBeanDefinition("lateMutation",
                            new RootBeanDefinition(BeanFactoryPostProcessor.class, () -> (BeanFactoryPostProcessor) beans -> {
                                mutations.incrementAndGet();
                                ((BeanDefinitionRegistry) beans).registerBeanDefinition("lateDatasource",
                                        new RootBeanDefinition(DataSource.class, () -> {
                                            factories.incrementAndGet();
                                            throw new AssertionError("SENTINEL_LATE_FACTORY");
                                        }));
                                beans.getBean("lateDatasource");
                            }));
                }))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), CONNECTION_BEAN); // Not EARLY_CONNECTION.
                    assertEquals(1, mutations.get());
                    assertEquals(0, factories.get());
                });
    }

    @Test
    void revalidatesEnvironmentChangedByPostprocessorAfterTheAudit() {
        AtomicInteger mutations = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                        TestDatabaseSafetyAutoConfiguration.class))
                .withInitializer(context -> context.addBeanFactoryPostProcessor(factory ->
                        ((BeanDefinitionRegistry) factory).registerBeanDefinition("lateEnvironmentMutation",
                                new RootBeanDefinition(BeanFactoryPostProcessor.class, () -> (BeanFactoryPostProcessor) beans -> {
                                    mutations.incrementAndGet();
                                    context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("late-setting",
                                            java.util.Map.of("spring.datasource.url", "jdbc:postgresql://remote.invalid/unused")));
                                    beans.getBean("dataSource");
                                }))))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), EFFECTIVE_DATASOURCE);
                    assertEquals(1, mutations.get());
                });
    }

    @Test
    void revalidatesActualPoolBeforeFlywayCanBeConstructed() {
        AtomicInteger flywayAttempts = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                        FlywayAutoConfiguration.class, TestDatabaseSafetyAutoConfiguration.class))
                .withBean("latePoolMutation", BeanPostProcessor.class, () -> new BeanPostProcessor() {
                    @Override public Object postProcessAfterInitialization(Object bean, String name) {
                        if (bean instanceof HikariDataSource pool) pool.setJdbcUrl("jdbc:postgresql://remote.invalid/unused");
                        return bean;
                    }
                })
                .withInitializer(context -> context.getBeanFactory().addBeanPostProcessor(new InstantiationAwareBeanPostProcessor() {
                    @Override public Object postProcessBeforeInstantiation(Class<?> type, String name) {
                        if (Flyway.class.isAssignableFrom(type)) {
                            flywayAttempts.incrementAndGet();
                            throw new AssertionError("SENTINEL_FLYWAY; must never initialize");
                        }
                        return null;
                    }
                }))
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    var pool = context.getBean(HikariDataSource.class);
                    assertFalse(pool.isRunning());
                    assertReason(assertThrows(RuntimeException.class, () -> context.getBean(Flyway.class)), EFFECTIVE_DATASOURCE);
                    assertEquals(0, flywayAttempts.get());
                    assertFalse(pool.isRunning());
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"test", "test,dev", "test,prod"})
    void discoversInitializerThroughSpringApplicationAndAcceptsOfficialMetadata(String profiles) {
        var environment = TestDatabaseSafetyGuardTest.validEnvironment();
        environment.setActiveProfiles(profiles.split(","));
        var application = new SpringApplication(MetadataOnlyConfiguration.class);
        application.setEnvironment(environment);
        application.setWebApplicationType(WebApplicationType.NONE);
        application.setRegisterShutdownHook(false);
        application.setLogStartupInfo(false);
        application.setBannerMode(Banner.Mode.OFF);
        application.setApplicationContextFactory(type -> new AnnotationConfigApplicationContext() {
            @Override protected void finishBeanFactoryInitialization(ConfigurableListableBeanFactory factory) { }
        });
        AtomicInteger attempts = new AtomicInteger();
        application.addInitializers(context -> context.getBeanFactory().addBeanPostProcessor(tripwire(attempts)));
        try (var context = application.run()) {
            for (String name : new String[] {"dataSource", "flyway", "flywayInitializer", "entityManagerFactory", "clienteRepository"}) {
                assertThat(context.getBeanFactory().containsBeanDefinition(name)).as(name).isTrue();
                assertThat(context.getBeanFactory().containsSingleton(name)).as(name).isFalse();
            }
            assertEquals(0, attempts.get());
        }
    }

    @Configuration(proxyBeanMethods = false)
    @AutoConfigurationPackage(basePackages = "com.oficinagestao")
    @ImportAutoConfiguration({DataSourceAutoConfiguration.class, FlywayAutoConfiguration.class,
            HibernateJpaAutoConfiguration.class, JpaRepositoriesAutoConfiguration.class,
            TestDatabaseSafetyAutoConfiguration.class})
    static class MetadataOnlyConfiguration { }

    @Test
    void safetyAutoConfigurationIsRegisteredOnTheTestClasspath() {
        assertThat(ImportCandidates.load(AutoConfiguration.class, getClass().getClassLoader()).getCandidates())
                .contains(TestDatabaseSafetyAutoConfiguration.class.getName());
    }

    private ApplicationContextRunner runner() {
        return runner(false);
    }

    private ApplicationContextRunner runner(boolean definitionsOnly) {
        return unguardedRunner(definitionsOnly).withInitializer(new TestDatabaseSafetyAutoConfiguration.Initializer());
    }

    private ApplicationContextRunner unguardedRunner(boolean definitionsOnly) {
        return new ApplicationContextRunner(() -> definitionsOnly ? new AnnotationConfigApplicationContext() {
            @Override
            protected void finishBeanFactoryInitialization(ConfigurableListableBeanFactory factory) {
                // Definition compatibility only. All factory post-processors (including the guard)
                // have completed, but no connection-capable singleton may be initialized.
            }
        } : new AnnotationConfigApplicationContext()).withInitializer(context -> {
            // Do not inherit workstation configuration or credentials in these unit tests.
            var environment = context.getEnvironment();
            environment.getPropertySources().remove("systemEnvironment");
            environment.getPropertySources().remove("systemProperties");
            environment.setActiveProfiles("test");
            environment.getPropertySources().addLast(new MapPropertySource(
                    "dedicated-settings", TestDatabaseSafetyGuardTest.settings()));
            try {
                environment.getPropertySources().addLast(new ResourcePropertySource(
                        new ClassPathResource("application-test.properties")));
            } catch (IOException exception) {
                throw new AssertionError(exception);
            }
        });
    }

    @Test
    void reproducesBootHikariBindingOverrideWithoutStartingThePool() {
        unguardedRunner(false).withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class))
                .withPropertyValues("spring.datasource.hikari.jdbc-url=jdbc:postgresql://synthetic.neon.tech/unused")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    HikariDataSource pool = context.getBean(HikariDataSource.class);
                    assertEquals("jdbc:postgresql://synthetic.neon.tech/unused", pool.getJdbcUrl());
                    assertFalse(pool.isRunning()); // Reading configuration never calls getConnection().
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {"5433", "5432"})
    void permitsOnlyTheStandardBootPoolWithoutOpeningIt(String port) {
        runner().withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                        TestDatabaseSafetyAutoConfiguration.class))
                .withPropertyValues("TEST_DB_EXPECTED_PORT=" + port,
                        "TEST_DB_URL=jdbc:postgresql://localhost:" + port + "/oficina_gestao_test")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    HikariDataSource pool = context.getBean(HikariDataSource.class);
                    assertEquals("jdbc:postgresql://localhost:" + port + "/oficina_gestao_test", pool.getJdbcUrl());
                    assertFalse(pool.isRunning());
                });
    }

    @Test
    void acceptsStandardFlywayAndJpaDefinitionsWithoutInstantiatingConnectionConsumers() {
        AtomicInteger attempts = new AtomicInteger();
        runner(true).withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                        FlywayAutoConfiguration.class, HibernateJpaAutoConfiguration.class,
                        TestDatabaseSafetyAutoConfiguration.class))
                .withInitializer(context -> context.getBeanFactory().addBeanPostProcessor(tripwire(attempts)))
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    var factory = context.getBeanFactory();
                    for (String name : new String[] {"dataSource", "flyway", "flywayInitializer", "entityManagerFactory"}) {
                        assertThat(factory.containsBeanDefinition(name)).as(name).isTrue();
                        assertThat(factory.containsSingleton(name)).as(name).isFalse();
                    }
                    assertEquals(0, attempts.get());
                });
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "spring.datasource.hikari.jdbc-url=jdbc:postgresql://synthetic.neon.tech/unused",
            "spring.datasource.url=jdbc:postgresql://synthetic.neon.tech/unused",
            "spring.flyway.url=jdbc:postgresql://synthetic.neon.tech/unused",
            "spring.datasource.jndi-name=java:comp/env/jdbc/untrusted",
            "TEST_DB_EXPECTED_PORT=5432",
            "TEST_DB_PASSWORD="
    })
    void failsBeforeAnyPoolFlywayOrHibernateInstantiation(String unsafeSetting) {
        AtomicInteger attempts = new AtomicInteger();
        runner().withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                        FlywayAutoConfiguration.class, HibernateJpaAutoConfiguration.class,
                        TestDatabaseSafetyAutoConfiguration.class))
                .withInitializer(context -> context.getBeanFactory().addBeanPostProcessor(tripwire(attempts)))
                .withPropertyValues(unsafeSetting)
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure()).hasStackTraceContaining("Test database safety guard:");
                    var reasons = java.util.Map.of(
                            "spring.datasource.hikari.jdbc-url", DATASOURCE_OVERRIDE,
                            "spring.datasource.url", EFFECTIVE_DATASOURCE,
                            "spring.flyway.url", FLYWAY_OVERRIDE,
                            "spring.datasource.jndi-name", DATASOURCE_OVERRIDE,
                            "TEST_DB_EXPECTED_PORT", DATABASE_IDENTITY,
                            "TEST_DB_PASSWORD", REQUIRED_SETTING);
                    assertReason(context.getStartupFailure(), reasons.get(unsafeSetting.split("=", 2)[0]));
                    assertEquals(0, attempts.get(), "No pool, migration engine or JPA factory may be constructed");
                });
    }

    @ParameterizedTest
    @ValueSource(classes = {CustomDataSource.class, CustomJdbcDetails.class, CustomFlywayDetails.class,
            CustomFlyway.class, CustomFlywayCustomizer.class, CustomDataSourceFactory.class,
            CustomHibernateCustomizer.class, CustomJpaBuilderCustomizer.class, CustomEntityManagerFactory.class,
            ImportedDatasource.class, CustomPersistenceUnitPostProcessor.class, CustomJpaBuilder.class})
    void rejectsCustomConnectionBeansBeforeTheirFactoryCanConnect(Class<?> configuration) {
        runner().withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                        TestDatabaseSafetyAutoConfiguration.class))
                .withUserConfiguration(configuration)
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure()).hasStackTraceContaining("Test database safety guard:");
                    assertThat(context.getStartupFailure()).hasStackTraceContaining("custom");
                    assertThat(context.getStartupFailure()).hasStackTraceContaining("forbidden");
                    assertThat(rootCause(context.getStartupFailure())).isInstanceOf(TestDatabaseSafetyGuard.SafetyViolation.class);
                    assertReason(context.getStartupFailure(), configuration == CustomHibernateCustomizer.class
                            || configuration == CustomJpaBuilderCustomizer.class
                            || configuration == CustomPersistenceUnitPostProcessor.class ? JPA_EXTENSION : CONNECTION_BEAN);
                });
    }

    private static Throwable rootCause(Throwable failure) {
        while (failure.getCause() != null) failure = failure.getCause();
        return failure;
    }

    private static void assertReason(Throwable failure, TestDatabaseSafetyGuard.Reason expected) {
        assertThat(rootCause(failure)).isInstanceOf(TestDatabaseSafetyGuard.SafetyViolation.class);
        var rejection = (TestDatabaseSafetyGuard.SafetyViolation) rootCause(failure);
        assertThat(rejection.reason()).isEqualTo(expected);
        assertThat(rejection.getCause()).isNull();
        assertThat(rejection.getMessage()).startsWith("Test database safety guard:")
                .doesNotContain("synthetic-test-password", "synthetic-test-user", "remote.invalid", "jdbc:postgresql:");
    }

    private InstantiationAwareBeanPostProcessor tripwire(AtomicInteger attempts) {
        return new InstantiationAwareBeanPostProcessor() {
            @Override
            public Object postProcessBeforeInstantiation(Class<?> type, String name) {
                if (DataSource.class.isAssignableFrom(type) || Flyway.class.isAssignableFrom(type)
                        || LocalContainerEntityManagerFactoryBean.class.isAssignableFrom(type)) {
                    attempts.incrementAndGet();
                    throw new AssertionError("Connection-capable bean reached the tripwire; no connection was opened");
                }
                return null;
            }
        };
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomDataSource {
        @Bean DataSource unexpectedDataSource() {
            throw new AssertionError("A custom DataSource factory must never execute");
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomJdbcDetails {
        @Bean JdbcConnectionDetails unexpectedJdbcDetails() {
            throw new AssertionError("A custom JDBC details factory must never execute");
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomFlywayDetails {
        @Bean FlywayConnectionDetails unexpectedFlywayDetails() {
            throw new AssertionError("A custom Flyway details factory must never execute");
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomFlyway {
        @Bean Flyway unexpectedFlyway() {
            throw new AssertionError("A custom Flyway factory must never execute");
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomFlywayCustomizer {
        @Bean FlywayConfigurationCustomizer unexpectedFlywayCustomizer() {
            throw new AssertionError("A custom Flyway customizer factory must never execute");
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomDataSourceFactory {
        @Bean FactoryBean<DataSource> unexpectedFactory() {
            throw new AssertionError("A custom DataSource FactoryBean must never execute");
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomHibernateCustomizer {
        @Bean HibernatePropertiesCustomizer unexpectedHibernateCustomizer() {
            throw new AssertionError("A custom Hibernate customizer factory must never execute");
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomJpaBuilderCustomizer {
        @Bean EntityManagerFactoryBuilderCustomizer unexpectedJpaBuilderCustomizer() {
            throw new AssertionError("A custom JPA customizer factory must never execute");
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomEntityManagerFactory {
        @Bean EntityManagerFactory unexpectedEntityManagerFactory() {
            throw new AssertionError("A custom EntityManagerFactory factory must never execute");
        }
    }

    @Configuration(proxyBeanMethods = false)
    @Import(CustomDataSource.class)
    static class ImportedDatasource { }

    @Configuration(proxyBeanMethods = false)
    static class CustomPersistenceUnitPostProcessor {
        @Bean PersistenceUnitPostProcessor unexpectedPersistenceUnitPostProcessor() {
            throw new AssertionError("SENTINEL_PERSISTENCE_UNIT_POSTPROCESSOR");
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class CustomJpaBuilder {
        @Bean EntityManagerFactoryBuilder unexpectedBuilder() {
            throw new AssertionError("SENTINEL_JPA_BUILDER");
        }
    }
}
