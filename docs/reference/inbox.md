---
id: inbox
title: "Inbox Pattern: Idempotent Consumer for Spring"
sidebar_label: "Inbox"
description: "Deduplicate redelivered events with the oncebox inbox: transactional and non-transactional idempotent consumers, deserialization, caching and cleanup."
sidebar_position: 6
---

# Inbox

The inbox is a table of the ids of consumed events, `inbox_events`. An event whose id is already there is skipped when
the broker delivers it again.

It is a deduplication inbox: the message itself is not stored, and it is not processed asynchronously - your listener
handles it right away, through an `IdempotentConsumer`. Ids are kept until cleanup
(`oncebox.inbox.clean-up.ttl`), so a redelivery that arrives later than that is no longer recognised.

```yaml
oncebox:
  inbox:
    enabled: true
    source:
      type: kafka          # or rabbit
```

## IdempotentConsumer

```java
public interface IdempotentConsumer {
    void consume(UUID eventId, Runnable operation);

    <T> void consume(T message, EventIdExtractor<T> idExtractor, Consumer<T> operation);

    void consume(Set<UUID> ids, Consumer<Set<UUID>> operation);

    <T> void consume(List<T> messages, EventIdExtractor<T> idExtractor, Consumer<List<T>> operation);
}
```

The single-message variants run the operation only if the id is new. The batch variants filter out consumed events and
pass only the new ones to the operation; if all of them are known, the operation is not called.

`OnceboxHeadersUtils::extractId` reads the id from the `oncebox_event_id` header and works as an `EventIdExtractor`
for Spring `Message` objects:

```java
@KafkaListener(topics = "orders", containerFactory = "inboxKafkaListenerContainerFactory")
public void listen(Message<OrderDto> message) {
    idempotentConsumer.consume(message, OnceboxHeadersUtils::extractId, m -> handle(m.getPayload()));
}
```

```java
@KafkaListener(topics = "orders", containerFactory = "inboxKafkaListenerContainerFactory", batch = "true")
public void listen(List<Message<OrderDto>> messages) {
    idempotentConsumer.consume(messages, OnceboxHeadersUtils::extractId, batch -> handleAll(batch));
}
```

More examples are in the
[consumer example](https://github.com/dmitriy-iliyov/oncebox/tree/main/oncebox-example/oncebox-consumer-example).

## Choosing a consumer

When the inbox is enabled, two implementations are registered:

| Qualifier                   | Guarantee        | When the operation throws                                                |
|-----------------------------|------------------|--------------------------------------------------------------------------|
| `@TransactionalConsumer`    | Effectively-once | The id is rolled back with the operation; a redelivered event is processed again |
| `@NonTransactionalConsumer` | At-most-once     | The id stays recorded; a redelivered event is skipped and never processed again  |

**Transactional** - records the id and runs the operation in one transaction. Take it when the operation writes to the
same database: the id and the effect commit together or not at all, and a failed event is processed again on
redelivery. The transaction stays open while the operation runs, so a slow external call holds a connection.

**Non-transactional** - commits the id first, then runs the operation outside any transaction opened by the library.
Take it for operations that cannot be undone and must not repeat, such as sending an email. An event whose operation
fails is not processed again: the exception still reaches the listener and the broker redelivers the event, but the
id is already recorded and the event is skipped. The failure is logged at `ERROR` with the ids that are given up. If
you call it inside your own transaction, the id joins that transaction and it behaves like the transactional one.

Neither is primary. Choose one with the qualifier on a constructor or method parameter, a field or a setter:

```java
public EmailListener(@NonTransactionalConsumer IdempotentConsumer idempotentConsumer) {
    this.idempotentConsumer = idempotentConsumer;
}
```

The qualifiers carry the bean names, `inboxTransactionalIdempotentConsumer` and `inboxNonTransactionalIdempotentConsumer`
(implementations `TransactionalIdempotentConsumer` and `NonTransactionalIdempotentConsumer`), so
`@Qualifier("inboxNonTransactionalIdempotentConsumer")` is equivalent.
Injecting `IdempotentConsumer` without a qualifier fails the context with `NoUniqueBeanDefinitionException`, unless
the field or parameter is named exactly like one of the beans.

:::tip Lombok
`@RequiredArgsConstructor` does not copy the qualifiers from a field to the constructor unless they are listed in
`lombok.config`:

```properties
lombok.copyableAnnotations += io.github.dmitriyiliyov.oncebox.starter.inbox.TransactionalConsumer
lombok.copyableAnnotations += io.github.dmitriyiliyov.oncebox.starter.inbox.NonTransactionalConsumer
```

The same goes for `@Qualifier`, listed as `org.springframework.beans.factory.annotation.Qualifier`.
:::

:::caution One consumer per event in a service
The inbox records an event by its id alone, whichever consumer recorded it. If two listeners of the same service handle
the same event - for example one writing to the database and another sending an email - the first to record the id
handles the event and the other silently skips it.
:::

## Replacing an implementation

Define a bean named `inboxUndecoratedTransactionalIdempotentConsumer` or
`inboxUndecoratedNonTransactionalIdempotentConsumer`. It is wrapped with the cache and metrics decorators like the
default one. Declare it with `@Bean(defaultCandidate = false)`, as the library does; otherwise it is also injected
wherever `IdempotentConsumer` is injected by type, for example into a `List<IdempotentConsumer>`.

## Deserialization

The publisher sends the payload as stored: JSON, without a type the consumer can use. The inbox container factories
(`inboxKafkaListenerContainerFactory`, `inboxRabbitListenerContainerFactory`) resolve the target class from the
`oncebox_event_type` header through `mappings`:

```yaml
oncebox:
  inbox:
    mappings:
      create-order: "com.example.OrderCreatedDto"
      update-order: "com.example.OrderUpdatedDto"
```

The keys must match the event types declared on the publisher side under `oncebox.outbox.events`. Several event types
can share one topic or exchange; the header tells them apart, and a listener can dispatch on it:

```java
private final Map<String, Consumer<Object>> handlers;

@KafkaListener(topics = "orders", containerFactory = "inboxKafkaListenerContainerFactory")
public void listen(Message<Object> message) {
    idempotentConsumer.consume(
            message,
            OnceboxHeadersUtils::extractId,
            m -> handlers.get(OnceboxHeadersUtils.extractEventType(m)).accept(m.getPayload())
    );
}
```

## Cache

With `oncebox-inbox-cache` on the classpath, consumed ids are also kept in a cache from Spring's `CacheManager`, so
most duplicate checks do not reach the database:

```yaml
oncebox:
  inbox:
    cache:
      cache-name: "<service-name>:oncebox:inbox"
```

The cache is enabled as soon as the section is present (or with `enabled: true`), and `cache-name` is then required.
The cache itself - Redis or anything else - is configured by you, through a `CacheManager` bean, and `cache-name`
must match a cache that `CacheManager` provides.

:::note
Without the cache, every duplicate check is a query against `inbox_events`.
:::

An id is put into the cache only after the operation succeeded, so a rolled-back event is not cached.

:::danger The cache name must be unique per service
A cache hit skips the operation without reaching the database, and the cache key is the event id alone. Services that
consume the same event and share a cache store under the same `cache-name` see each other's entries: the first service
to consume an event marks it for all of them, and the others silently skip it. Prefix the name with the service name,
or give each service its own key prefix (`spring.cache.redis.key-prefix`) or its own store.
:::

Keep the cache TTL shorter than `oncebox.inbox.clean-up.ttl`, so that an id leaves the cache before it leaves the
table.

## Cleanup

Inbox records older than `oncebox.inbox.clean-up.ttl` (default `24h`) are deleted in batches under a
[distributed lock](polling.md#distributed-lock). Choose the TTL longer than the longest time the broker may take to
redeliver an event.

## Configuration

See [Configuration](configuration.md#inbox).
