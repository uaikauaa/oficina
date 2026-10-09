package com.oficinagestao.testsupport;

import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.springframework.beans.factory.FactoryBean;
import org.springframework.beans.factory.support.RootBeanDefinition;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.beans.factory.support.BeanDefinitionRegistryPostProcessor;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.beans.factory.config.BeanDefinitionHolder;
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
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
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
import org.springframework.web.context.support.GenericWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockServletContext;

import javax.sql.DataSource;
import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.Filter;
import java.io.IOException;
import java.sql.Connection;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static com.oficinagestao.testsupport.TestDatabaseSafetyGuard.Reason.*;

/** Minimal contexts only: no application scanning, real migrations, scheduler or database connections. */
class TestDatabaseSafetyAutoConfigurationTest {

    @Test
    void permitsInnerStringFactoryWithoutLookingUpItsSyntheticName() {
        var tracking = new InnerFactoryTracking();
        AtomicInteger products = new AtomicInteger();
        innerRunner(tracking)
                .withInitializer(context -> {
                    var inner = new RootBeanDefinition(StringFactory.class);
                    inner.getConstructorArgumentValues().addIndexedArgumentValue(0, products);
                    var holder = new RootBeanDefinition(ProductHolder.class);
                    holder.getConstructorArgumentValues().addIndexedArgumentValue(0, inner);
                    ((BeanDefinitionRegistry) context.getBeanFactory()).registerBeanDefinition("holder", holder);
                })
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context.getBean(ProductHolder.class).product).isEqualTo("ordinary product");
                    assertEquals(1, products.get());
                    assertThat(tracking.types).containsExactly(StringFactory.class);
                    assertEquals(0, tracking.invalidLookups.get());
                });
    }

    @Test
    void permitsInnerFilterFactoryWithoutConstructingItForInspection() {
        var tracking = new InnerFactoryTracking();
        var probe = new FactoryProbe();
        innerRunner(tracking).withInitializer(context -> registerInnerFactory(
                        context.getBeanFactory(), FilterFactory.class, probe, "ordinary-looking-inner"))
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    Filter filter = (Filter) context.getBean(ProductHolder.class).product;
                    AtomicInteger calls = new AtomicInteger();
                    filter.doFilter(new MockHttpServletRequest(), new MockHttpServletResponse(),
                            (request, response) -> calls.incrementAndGet());
                    assertEquals(1, calls.get());
                    assertEquals(1, probe.factories.get());
                    assertEquals(1, probe.products.get());
                    assertEquals(0, probe.typeQueries.get());
                    assertThat(tracking.types).containsExactly(FilterFactory.class);
                    assertEquals(0, tracking.invalidLookups.get());
                });
    }

    @ParameterizedTest
    @MethodSource("unsafeInnerFactories")
    void rejectsUnsafeInnerFactoriesBeforeConstruction(Class<?> type, TestDatabaseSafetyGuard.Reason reason,
                                                       String innerName) {
        var tracking = new InnerFactoryTracking();
        var probe = new FactoryProbe();
        innerRunner(tracking).withInitializer(context -> registerInnerFactory(
                        context.getBeanFactory(), type, probe, innerName))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), reason);
                    assertThat(tracking.types).containsExactly(type);
                    assertEquals(0, tracking.invalidLookups.get());
                    probe.assertUntouched();
                });
    }

    static Stream<Arguments> unsafeInnerFactories() {
        return Stream.of("(inner bean)#untrusted", "ordinary-looking-inner").flatMap(name -> Stream.of(
                Arguments.of(InnerDataSourceFactory.class, CONNECTION_BEAN, name),
                Arguments.of(InnerJdbcDetailsFactory.class, CONNECTION_BEAN, name),
                Arguments.of(InnerFlywayDetailsFactory.class, CONNECTION_BEAN, name),
                Arguments.of(InnerFlywayFactory.class, CONNECTION_BEAN, name),
                Arguments.of(InnerEntityManagerFactory.class, CONNECTION_BEAN, name),
                Arguments.of(InnerPersistenceUnitManagerFactory.class, CONNECTION_BEAN, name),
                Arguments.of(InnerObjectFactory.class, INDETERMINATE_FACTORY, name),
                Arguments.of(InnerRawFactory.class, INDETERMINATE_FACTORY, name),
                Arguments.of(UnknownProductFactory.class, INDETERMINATE_FACTORY, name),
                Arguments.of(BoundedUnknownFilterFactory.class, INDETERMINATE_FACTORY, name)));
    }

    @Test
    void rejectsNamedDataSourceFactoryBeforeConstruction() {
        var probe = new FactoryProbe();
        runner().withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                .withBean("namedFactory", InnerDataSourceFactory.class, () -> new InnerDataSourceFactory(probe))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertReason(context.getStartupFailure(), CONNECTION_BEAN);
                    probe.assertUntouched();
                });
    }

    @Test
    void rejectsAncestorDataSourceFactoryBeforeConstruction() {
        var probe = new FactoryProbe();
        try (var parent = new AnnotationConfigApplicationContext()) {
            parent.registerBean("parentFactory", InnerDataSourceFactory.class,
                    () -> new InnerDataSourceFactory(probe), definition -> definition.setLazyInit(true));
            parent.refresh();
            runner().withParent(parent)
                    .withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                    .run(context -> {
                        assertThat(context).hasFailed();
                        assertReason(context.getStartupFailure(), ANCESTOR_CONNECTION);
                        probe.assertUntouched();
                    });
        }
    }

    @Test
    void permitsRealSpringSecurityInnerFilterAndEnforcesSecurityWithoutDatabase() {
        var tracking = new InnerFactoryTracking();
        AtomicInteger connectionConsumers = new AtomicInteger();
        new WebApplicationContextRunner(() -> {
                    var context = new GenericWebApplicationContext(tracking.factory());
                    context.setServletContext(new MockServletContext());
                    return context;
                })
                .withInitializer(context -> {
                    context.setEnvironment(TestDatabaseSafetyGuardTest.validEnvironment());
                    context.getBeanFactory().addBeanPostProcessor(tracking.observer(context.getBeanFactory()));
                    context.getBeanFactory().addBeanPostProcessor(tripwire(connectionConsumers));
                })
                .withInitializer(new TestDatabaseSafetyAutoConfiguration.Initializer())
                .withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class))
                .withUserConfiguration(SecurityOnlyConfiguration.class)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(tracking.types).extracting(Class::getName).containsExactly(
                            "org.springframework.security.config.annotation.web.configuration."
                                    + "WebMvcSecurityConfiguration$HandlerMappingIntrospectorCacheFilterFactoryBean");
                    assertEquals(0, tracking.invalidLookups.get());
                    assertEquals(0, connectionConsumers.get());
                    assertThat(context).doesNotHaveBean(DataSource.class).doesNotHaveBean(Flyway.class)
                            .doesNotHaveBean(EntityManagerFactory.class);
                    var filter = context.getBean("springSecurityFilterChain", FilterChainProxy.class);
                    assertThat(filter.getFilterChains()).hasSize(1);
                    assertSecurityResponse(filter, "GET", "/public", 204, 1);
                    assertSecurityResponse(filter, "GET", "/private", 403, 0);
                    assertSecurityResponse(filter, "POST", "/public", 403, 0); // CSRF still enforced.
                });
    }

    private static void assertSecurityResponse(Filter filter, String method, String path, int status,
                                               int expectedTerminalCalls) throws Exception {
        var request = new MockHttpServletRequest(method, path);
        request.setServletPath(path);
        var response = new MockHttpServletResponse();
        AtomicInteger terminalCalls = new AtomicInteger();
        filter.doFilter(request, response, (req, res) -> {
            terminalCalls.incrementAndGet();
            response.setStatus(204);
        });
        assertEquals(status, response.getStatus());
        assertEquals(expectedTerminalCalls, terminalCalls.get());
    }

    @Configuration(proxyBeanMethods = false)
    @EnableWebMvc
    @EnableWebSecurity
    static class SecurityOnlyConfiguration {
        @Bean SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
            return http.authorizeHttpRequests(authorize -> authorize
                    .requestMatchers("/public").permitAll().anyRequest().denyAll()).build();
        }
    }

    private static void registerInnerFactory(ConfigurableListableBeanFactory factory, Class<?> type,
                                             FactoryProbe probe, String name) {
        var inner = new RootBeanDefinition(type);
        inner.getConstructorArgumentValues().addIndexedArgumentValue(0, probe);
        var holder = new RootBeanDefinition(ProductHolder.class);
        holder.getConstructorArgumentValues().addIndexedArgumentValue(0, new BeanDefinitionHolder(inner, name));
        ((BeanDefinitionRegistry) factory).registerBeanDefinition("holder", holder);
    }

    static class FactoryProbe {
        final AtomicInteger factories = new AtomicInteger();
        final AtomicInteger products = new AtomicInteger();
        final AtomicInteger typeQueries = new AtomicInteger();
        void assertUntouched() {
            assertEquals(0, factories.get(), "Factory must not be constructed");
            assertEquals(0, products.get(), "Product must not be constructed");
            assertEquals(0, typeQueries.get(), "Inspection must use metadata only");
        }
    }

    static class FilterFactory implements FactoryBean<Filter> {
        private final FactoryProbe probe;
        FilterFactory(FactoryProbe probe) { this.probe = probe; probe.factories.incrementAndGet(); }
        @Override public Filter getObject() {
            probe.products.incrementAndGet();
            return (request, response, chain) -> chain.doFilter(request, response);
        }
        @Override public Class<?> getObjectType() {
            probe.typeQueries.incrementAndGet();
            throw new AssertionError("Inspection must not invoke getObjectType");
        }
    }

    // No network/migration implementation exists in these sentinels, even if the guard regresses.
    static class UnknownProductFactory<T> implements FactoryBean<T> {
        private final FactoryProbe probe;
        UnknownProductFactory(FactoryProbe probe) { this.probe = probe; probe.factories.incrementAndGet(); }
        @Override public T getObject() {
            probe.products.incrementAndGet();
            throw new AssertionError("SENTINEL_INNER_PRODUCT");
        }
        @Override public Class<?> getObjectType() {
            probe.typeQueries.incrementAndGet();
            throw new AssertionError("SENTINEL_INNER_TYPE_QUERY");
        }
    }
    static class InnerDataSourceFactory extends UnknownProductFactory<DataSource> {
        InnerDataSourceFactory(FactoryProbe probe) { super(probe); }
    }
    static class InnerJdbcDetailsFactory extends UnknownProductFactory<JdbcConnectionDetails> {
        InnerJdbcDetailsFactory(FactoryProbe probe) { super(probe); }
    }
    static class InnerFlywayDetailsFactory extends UnknownProductFactory<FlywayConnectionDetails> {
        InnerFlywayDetailsFactory(FactoryProbe probe) { super(probe); }
    }
    static class InnerFlywayFactory extends UnknownProductFactory<Flyway> {
        InnerFlywayFactory(FactoryProbe probe) { super(probe); }
    }
    static class InnerEntityManagerFactory extends UnknownProductFactory<EntityManagerFactory> {
        InnerEntityManagerFactory(FactoryProbe probe) { super(probe); }
    }
    static class InnerPersistenceUnitManagerFactory extends UnknownProductFactory<PersistenceUnitManager> {
        InnerPersistenceUnitManagerFactory(FactoryProbe probe) { super(probe); }
    }
    static class InnerObjectFactory extends UnknownProductFactory<Object> {
        InnerObjectFactory(FactoryProbe probe) { super(probe); }
    }
    @SuppressWarnings("rawtypes")
    static class InnerRawFactory extends UnknownProductFactory {
        InnerRawFactory(FactoryProbe probe) { super(probe); }
    }
    static class BoundedUnknownFilterFactory<T extends Filter> extends UnknownProductFactory<T> {
        BoundedUnknownFilterFactory(FactoryProbe probe) { super(probe); }
    }

    private ApplicationContextRunner innerRunner(InnerFactoryTracking tracking) {
        return new ApplicationContextRunner(() -> new AnnotationConfigApplicationContext(tracking.factory()))
                .withInitializer(context -> {
                    context.setEnvironment(TestDatabaseSafetyGuardTest.validEnvironment());
                    context.getBeanFactory().addBeanPostProcessor(tracking.observer(context.getBeanFactory()));
                })
                .withInitializer(new TestDatabaseSafetyAutoConfiguration.Initializer())
                .withConfiguration(AutoConfigurations.of(TestDatabaseSafetyAutoConfiguration.class));
    }

    static class ProductHolder {
        final Object product;
        ProductHolder(Object product) { this.product = product; }
    }

    private static final class InnerFactoryTracking {
        final java.util.List<Class<?>> types = new java.util.ArrayList<>();
        final java.util.Set<String> names = new java.util.HashSet<>();
        final AtomicInteger invalidLookups = new AtomicInteger();

        DefaultListableBeanFactory factory() {
            return new DefaultListableBeanFactory() {
                @Override public Class<?> getType(String name, boolean allowFactoryBeanInit) {
                    if (names.contains(name) && !containsBeanDefinition(name)) invalidLookups.incrementAndGet();
                    return super.getType(name, allowFactoryBeanInit);
                }
            };
        }

        InstantiationAwareBeanPostProcessor observer(ConfigurableListableBeanFactory factory) {
            return new InstantiationAwareBeanPostProcessor() {
                @Override public Object postProcessBeforeInstantiation(Class<?> type, String name) {
                    if (FactoryBean.class.isAssignableFrom(type) && !factory.containsBeanDefinition(name)) {
                        types.add(type);
                        names.add(name);
                    }
                    return null;
                }
            };
        }
    }

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
