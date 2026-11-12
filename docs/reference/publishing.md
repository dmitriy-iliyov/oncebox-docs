---
id: publishing
title: "Publishing Events with OutboxPublisher"
sidebar_label: "Publishing Events"
description: "Store events in the business transaction with OutboxPublisher or the @OutboxPublish annotation: transactions, SpEL payloads, serialization and event ids."
sidebar_position: 3
---

# Publishing Events

## OutboxPublisher

```java
public interface OutboxPublisher {
    <T> void publish(String eventType, T event);

    <T> void publish(String eventType, List<T> events);
}
```

Call it inside the transaction that changes your data:

```java
@Transactional
public OrderDto create(OrderCreateDto dto) {
    OrderDto order = mapper.toDto(repository.save(mapper.toEntity(dto)));
    outboxPublisher.publish("order-created", order);
    return order;
}
```

The list overload stores the whole batch in one statement; each element becomes a separate event with its own id.

The event type must be declared under `oncebox.outbox.events`; an undeclared, `null` or blank event type is rejected
with an exception, which rolls back your transaction. An empty list is ignored with a warning.

## @OutboxPublish

The annotation publishes after the method returns, from inside the method's transaction:

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@Documented
public @interface OutboxPublish {
    String eventType();

    String payload() default "#result";
}
```

By default the return value is the payload. `payload` is a SpEL expression over the method parameters (by name) and
`#result`:

```java
@Transactional
@OutboxPublish(eventType = "order-cancelled", payload = "#command.orderId()")
public void cancel(CancelOrderCommand command) {
    // ...
}

@Transactional
@OutboxPublish(eventType = "order-created")          // a List result is published as a batch
public List<OrderDto> importOrders(List<OrderCreateDto> dtos) {
    // ...
}
```

Rules:

- the method must be `public` and called through the Spring proxy (not from the same class);
- a `null` payload fails the call;
- a `List` payload is published as a batch;
- parameter names are available when the code is compiled with `-parameters`, which the Spring Boot Maven and Gradle
  plugins enable by default;
- AspectJ has to be on the classpath: add `spring-boot-starter-aop`. The starter registers the aspect only when
  AspectJ is present, so without it the application starts, but annotated methods publish nothing.

:::warning
With `@OutboxPublish` and `@Transactional` on the same method, the event is stored by an aspect that has to run
before the transaction commits. This holds under Spring Boot's default transaction advisor order. If the application
sets `@EnableTransactionManagement(order = ...)` to a higher precedence, the aspect runs after the commit and
publishing fails with `IllegalTransactionStateException`. In that case call `OutboxPublisher#publish()` inside the
method instead.
:::

More usage examples are in the
[producer example](https://github.com/dmitriy-iliyov/oncebox/blob/main/oncebox-example/oncebox-producer-example/src/main/java/io/github/dmitriyiliyov/oncebox/example/producer/OrderService.java).

## Transactions

`publish` joins the caller's transaction and requires one (`Propagation.MANDATORY`). If the transaction rolls back,
the event is rolled back with it; nothing is sent.

Use the same `DataSource` for your data and the outbox: the guarantee comes from a single local transaction.

## Serialization

By default `JacksonOutboxSerializer` writes the payload as JSON with the application's `ObjectMapper` and stores the
payload class name in `payload_type`. To change the format, register your own `OutboxSerializer` bean:

```java
public interface OutboxSerializer {
    <T> OutboxEvent serialize(String eventType, T event);

    <T> List<OutboxEvent> serialize(String eventType, List<T> rowEvents);
}
```

A serialization error throws `OutboxSerializationException` and rolls back the caller's transaction.

Jackson is an optional dependency of `oncebox-core`; it is brought in by `oncebox-starter` through
`spring-boot-starter-json`. With your own serializer and that starter excluded, Jackson stays off the classpath.

## Event ids

Every event gets a **UUIDv7** id: time-ordered, so inserts land at the tail of the primary key index instead of
scattering across it.

```java
public interface UuidGenerator {
    UUID generate();
}
```

The default implementation delegates to [`com.github.f4b6a3:uuid-creator`](https://github.com/f4b6a3/uuid-creator),
a small (about 140 KB) MIT-licensed library with no dependencies of its own. It is a required dependency of
`oncebox-core` and reaches your classpath transitively. A `UuidGenerator` bean of your own replaces the generation, but
does not remove the dependency.

The id is sent in the `oncebox_event_id` header and is what the inbox deduplicates by, so a custom generator must
still produce globally unique values.
