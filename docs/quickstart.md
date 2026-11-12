---
id: quickstart
title: "Quickstart: Spring Boot Outbox with Kafka, RabbitMQ"
sidebar_label: "Quickstart"
description: "Add oncebox to a Spring Boot service: dependencies, tables, an event type, publishing in a transaction and consuming with deduplication through the inbox."
sidebar_position: 2
---

# Quickstart

This page sets up a publisher that writes events through the outbox and a consumer that deduplicates them through
the inbox. Both sides use the same starter; a service can be a publisher, a consumer, or both.

## Publisher

### 1. Add dependencies

The starter, exactly one database dialect and exactly one broker module are required.

```xml
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-starter</artifactId>
    <version>2.0.0</version>
</dependency>

<!-- exactly one of: oncebox-postgresql, oncebox-mysql, oncebox-oracle -->
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-postgresql</artifactId>
    <version>2.0.0</version>
</dependency>

<!-- exactly one of: oncebox-kafka, oncebox-rabbit -->
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-kafka</artifactId>
    <version>2.0.0</version>
</dependency>
```

:::important
The starter does not bundle a database dialect. Without one of `oncebox-postgresql`, `oncebox-mysql` or
`oncebox-oracle` there is no repository implementation to wire, and the application context fails to start.
:::

The tables are created by oncebox's own migrations. This page applies them with Flyway; Liquibase, a dev mode without
a migration tool, and managing them yourself are in [Schema Migrations](reference/schema.md).

```xml
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-flyway</artifactId>
    <version>2.0.0</version>
</dependency>

<!-- the versions come from Spring Boot -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>

<!-- the Flyway module of your database, exactly one of:
     flyway-database-postgresql, flyway-mysql, flyway-database-oracle -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

:::warning
`flyway-core` also switches on Spring Boot's own Flyway. If the application does not use Flyway and its database
already has tables, set `spring.flyway.enabled: false`, or Boot's Flyway refuses the non-empty schema - see
[Schema Migrations](reference/schema.md#flyway).
:::

Optional modules:

```xml
<!-- Micrometer metrics, see Observability -->
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-metrics</artifactId>
    <version>2.0.0</version>
</dependency>

<!-- REST API for the dead letter queue; reuses the dialect added above -->
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-dlq-api</artifactId>
    <version>2.0.0</version>
</dependency>

<!-- AspectJ for the @OutboxPublish annotation; the version comes from Spring Boot -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

`@OutboxPublish` is handled by an AspectJ aspect, which the starter registers only when AspectJ is on the classpath.
Without `spring-boot-starter-aop` the application starts, but annotated methods publish nothing. Publishing through
`OutboxPublisher` does not need it.

### 2. Application class

No annotation is needed: `oncebox-starter` registers itself as a Spring Boot auto-configuration, and the outbox is on
unless `oncebox.outbox.enabled` is `false`.

```java
@SpringBootApplication
@EnableTransactionManagement
@EnableKafka
public class PublisherApplication {

    public static void main(String... args) {
        SpringApplication.run(PublisherApplication.class, args);
    }
}
```

### 3. Configure

Every event type you publish is declared under `oncebox.outbox.events` together with its destination, and
`oncebox.schema.mode` tells oncebox to create its tables.

```yaml
oncebox:
  schema:
    mode: flyway               # default none: no tables are created
  outbox:
    sender:
      type: kafka              # or rabbit
    events:
      create-example-event:
        topic: example-events  # Kafka topic or RabbitMQ exchange
```

:::warning
The dead letter queue is disabled by default. Without it, events that exhaust their retries stay in
`outbox_events` with status `FAILED`. Enable it with `oncebox.outbox.dlq.enabled: true`.
:::

### 4. Publish

Inject `OutboxPublisher` and call it inside your transaction:

```java
@Service
@RequiredArgsConstructor
public class ExampleService {

    private final ExampleRepository repository;
    private final ExampleMapper mapper;
    private final OutboxPublisher outboxPublisher;

    @Transactional
    public ExampleDto save(ExampleCreateDto dto) {
        ExampleEntity entity = repository.save(mapper.toEntity(dto));
        ExampleDto response = mapper.toDto(entity);
        outboxPublisher.publish("create-example-event", response);
        return response;
    }
}
```

Or annotate the method; by default the return value becomes the payload:

```java
@Transactional
@OutboxPublish(eventType = "create-example-event")
public ExampleDto save(ExampleCreateDto dto) {
    ExampleEntity entity = repository.save(mapper.toEntity(dto));
    return mapper.toDto(entity);
}
```

The event is committed with `ExampleEntity`. A poller picks it up and sends it to `example-events`.
See [Publishing Events](reference/publishing.md) for the details.

## Consumer

### 1. Add dependencies

```xml
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-starter</artifactId>
    <version>2.0.0</version>
</dependency>

<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-postgresql</artifactId>
    <version>2.0.0</version>
</dependency>

<!-- creates inbox_events, as on the publisher side -->
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-flyway</artifactId>
    <version>2.0.0</version>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>

<!-- optional: cache consumed ids through Spring's CacheManager -->
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-inbox-cache</artifactId>
    <version>2.0.0</version>
</dependency>
```

### 2. Configure

The inbox is off by default; switch it on and turn the outbox off if this service does not publish:

```yaml
oncebox:
  schema:
    mode: flyway
  outbox:
    enabled: false
  inbox:
    enabled: true
    source:
      type: kafka                  # or rabbit
    mappings:
      create-example-event: "com.example.ExampleDto"
    cache:
      cache-name: "<service-name>:oncebox:inbox"
```

Cleanup of inbox records is enabled by default. The cache is enabled as soon as `cache.cache-name` is set; the name
must be unique per service, see [Inbox](reference/inbox.md#cache).

### 3. Consume

Inject an `IdempotentConsumer`, choosing the implementation with `@TransactionalConsumer` or
`@NonTransactionalConsumer`:

```java
@Component
public class ExampleKafkaListener {

    private final IdempotentConsumer idempotentConsumer;

    public ExampleKafkaListener(@TransactionalConsumer IdempotentConsumer idempotentConsumer) {
        this.idempotentConsumer = idempotentConsumer;
    }

    @KafkaListener(
            topics = "example-events",
            groupId = "example-group",
            containerFactory = "inboxKafkaListenerContainerFactory"
    )
    public void listen(Message<ExampleDto> message) {
        idempotentConsumer.consume(
                message,
                OnceboxHeadersUtils::extractId,
                m -> handle(m.getPayload())
        );
    }
}
```

For RabbitMQ:

```java
@Component
public class ExampleRabbitListener {

    private final IdempotentConsumer idempotentConsumer;

    public ExampleRabbitListener(@TransactionalConsumer IdempotentConsumer idempotentConsumer) {
        this.idempotentConsumer = idempotentConsumer;
    }

    @RabbitListener(queues = "example-events", containerFactory = "inboxRabbitListenerContainerFactory")
    public void listen(Message<ExampleDto> message) {
        idempotentConsumer.consume(
                message,
                OnceboxHeadersUtils::extractId,
                m -> handle(m.getPayload())
        );
    }
}
```

The event id, type and payload class travel in message headers, see [Messaging Integration](reference/messaging.md#headers).

:::important
There is no default `IdempotentConsumer`. The inbox registers two of them, and injecting one without either
annotation fails the context with `NoUniqueBeanDefinitionException`. Which one to take is explained in
[Inbox](reference/inbox.md#choosing-a-consumer).
:::

## What next

- Run the [example project](examples.md) - producer, consumer and traffic generator in Docker Compose.
- Read [Delivery Guarantees](reference/guarantees.md) and go through the [Production Checklist](production.md) before
  going to production.
- Something does not work? See [Troubleshooting](troubleshooting.md).
- Tune retries and polling in the [Configuration](reference/configuration.md) reference.
