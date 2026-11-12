---
id: troubleshooting
title: "Troubleshooting Outbox and Inbox Errors"
sidebar_label: "Troubleshooting"
description: "Startup errors, runtime failures and silent misbehaviour of oncebox with their causes and fixes, searchable by the exact text of the error message."
sidebar_position: 5
---

# Troubleshooting

Symptoms grouped by when they show up, each with its cause and the fix. Search the page for the text of your error.

## The context fails to start

### No database dialect

The starter bundles no database dialect, so without one there is nothing to wire the repositories from, and the error
does not name the missing module. Add exactly one of `oncebox-postgresql`, `oncebox-mysql`, `oncebox-oracle`, see
[Persistence](reference/persistence.md#databases).

### Outbox without a sender

```
'sender' cannot be null
```

An `oncebox.outbox` block is present, so the outbox counts as enabled, but it has no `sender`. A block that is present
with `enabled` unset is on. An inbox-only service either leaves the `outbox` block out or sets
`oncebox.outbox.enabled: false`.

### Inbox cache without a name

```
'cache-name' cannot be null
```

An `oncebox.inbox.cache` block is present without `cache-name`. Set a name unique to the service, see
[Inbox](reference/inbox.md#cache). The name must also match a cache of a `CacheManager` bean the application
provides, and `oncebox-inbox-cache` has to be on the classpath.

### Emergency timeout not below the stuck threshold

```
'sender.emergency-timeout' (...) must be less than 'stuck-recovery.max-batch-processing-time' (...)
```

A batch still being sent would be recovered as stuck and published twice. Lower
`oncebox.outbox.sender.emergency-timeout` or raise `oncebox.outbox.stuck-recovery.max-batch-processing-time`.

### Two idempotent consumers to choose from

```
NoUniqueBeanDefinitionException: ... IdempotentConsumer
```

The inbox registers two consumers and neither is primary. Mark the injection point with `@TransactionalConsumer` or
`@NonTransactionalConsumer`, see [choosing a consumer](reference/inbox.md#choosing-a-consumer). With Lombok's
`@RequiredArgsConstructor` the annotation on the field does not reach the constructor unless `lombok.config` copies
it - the lines are in the same section.

### Kafka inbox without mappings

```
Cannot invoke "java.util.Map.size()" because "m" is null
```

An inbox on Kafka without `oncebox.inbox.mappings`. Map every consumed event type to its payload class:

```yaml
oncebox:
  inbox:
    mappings:
      order-created: "com.example.OrderCreatedDto"
```

### Schema mode without its tool

```
OnceboxSchemaMigratorSupplier not found for mode=FLYWAY
```

`oncebox.schema.mode` is `flyway` (or `liquibase`), but the tool or the oncebox module of that mode is not on the
classpath. The starter declares both modules as optional; add `oncebox-flyway` and `flyway-core` (or
`oncebox-liquibase` and `liquibase-core`), see [Schema Migrations](reference/schema.md#modes).

### A migration fails

```
OnceboxMigrationException: Migration of oncebox feature '...' failed on database '...'
```

The cause is the error of Flyway, Liquibase or JDBC. With `flyway` the usual one is the missing Flyway module of the
database - `flyway-database-postgresql`, `flyway-mysql` or `flyway-database-oracle`. On MySQL older than 8.0.13 the
scripts fail on their expression defaults (`DEFAULT (UTC_TIMESTAMP(6))`).

### Spring Boot's Flyway refuses the database

```
Found non-empty schema(s) ... but no schema history table
```

Thrown by Spring Boot's own Flyway, not by oncebox: adding `flyway-core` switched it on, and the database already has
tables. Set `spring.flyway.enabled: false` if the application has no Flyway migrations of its own, or
`spring.flyway.baseline-on-migrate: true` if it starts using Flyway, see [Schema Migrations](reference/schema.md#flyway).

### Spring Boot's Liquibase finds no changelog

Also Spring Boot's own Liquibase, switched on by `liquibase-core`: it fails when there is no
`db/changelog/db.changelog-master.yaml`. Without a changelog of your own set `spring.liquibase.enabled: false`;
oncebox's Liquibase does not read `spring.liquibase.*`.

## Errors at runtime

### Publishing outside a transaction

```
IllegalTransactionStateException: No existing transaction found for transaction marked with propagation 'mandatory'
```

`OutboxPublisher#publish` - or a method with `@OutboxPublish` - was called outside a transaction. Storing an event
outside the business transaction gives no atomicity, so oncebox refuses it. Call it from a `@Transactional` method,
see [Transactions](reference/publishing.md#transactions).

### A missing oncebox table

A query fails on a missing `outbox_events`, `inbox_events` or `oncebox_jobs`. `oncebox.schema.mode` is not set, and
its default `none` creates nothing; the log says so at startup:

```
'schema.mode' is NONE, oncebox does not create its tables, the application has to create them
```

Set a mode, see [Schema Migrations](reference/schema.md).

## Wrong behaviour without an error

### Nothing is sent for the first minutes

Every poller waits `polling.initial-delay` before its first run, `5m` by default. Until then published events stay
`PENDING` in `outbox_events`. In local runs and tests lower it:

```yaml
oncebox:
  outbox:
    defaults:
      polling:
        initial-delay: 1s
```

### Annotated methods publish nothing

The `@OutboxPublish` aspect is registered only when AspectJ is on the classpath, and the starter does not bring it.
Add `org.springframework.boot:spring-boot-starter-aop`. Publishing through `OutboxPublisher` does not need it.

### Events are sent later than the polling settings promise

The thread pool is shared by all pollers and jobs and defaults to `min(available processors, 5)`. With more tasks than
threads they queue behind each other and every delay stretches. An outbox needs a thread per event type plus its
background jobs; count them in [Thread pool](reference/polling.md#thread-pool) and set `oncebox.thread-pool-size`.

### Pollers deadlock on MySQL

Under InnoDB's default `REPEATABLE READ` the `SKIP LOCKED` polling takes gap locks. Run the datasource at
`READ COMMITTED`, see [MySQL isolation level](reference/persistence.md#mysql-isolation-level).

### A consumer silently skips events another service consumed

Several services share one inbox `cache-name` in one cache store. The cache key is the event id alone, so the first
service to consume an event marks it for all of them. Put the service into the name -
`"<service-name>:oncebox:inbox"`, see [Inbox](reference/inbox.md#cache).

### One of two listeners of the same event never runs

The inbox records an event by its id, whichever consumer recorded it: the first listener to record it handles the
event, the other skips it. Do both in one listener, or publish a separate event for the second action.

### A failed database change is not retried

The operation runs through the `@NonTransactionalConsumer`, which records the id before the operation and keeps it on
failure - at-most-once by design. For a database change use `@TransactionalConsumer`, see
[Inbox guarantees](reference/guarantees.md#inbox-guarantees).

### The payload is not converted to its class

The publisher sends plain JSON; only the inbox container factories turn it into the class from
`oncebox.inbox.mappings`. Check that the listener names `containerFactory = "inboxKafkaListenerContainerFactory"` (or
`"inboxRabbitListenerContainerFactory"`) and that the keys of `mappings` are exactly the event types the outbox
publishes under, see [Deserialization](reference/inbox.md#deserialization).

### Every idempotency check hits the database

The inbox has no `cache` block. The log warns about it once at startup; add a cache if the read load matters, see
[Inbox](reference/inbox.md#cache).

### Failed events pile up in the outbox table

The DLQ is disabled by default, so events that exhausted their retries stay `FAILED` in `outbox_events`. Enable it
with `oncebox.outbox.dlq.enabled: true`, see [Dead Letter Queue](reference/dlq.mdx).

### Events are lost although the outbox reports them sent

The broker side is not set up for at-least-once. oncebox waits for the broker's acknowledgement but does not
configure the broker:

- a Kafka producer without `acks=all` - the starter warns at startup, see
  [Apache Kafka](reference/messaging.md#apache-kafka);
- a RabbitMQ exchange without a binding for the event type - the broker discards the message and still confirms it,
  so the event is marked `PROCESSED`. Bind every event type, see [Routing](reference/messaging.md#routing);
- a Kafka consumer with `enable.auto.commit=true`, or an error handler without a recoverer - offsets are committed for
  events that were never processed, see [Consumer acknowledgement](reference/messaging.md#consumer-acknowledgement).
