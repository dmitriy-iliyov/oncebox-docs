---
id: production
title: "Production Checklist for the Outbox and Inbox"
sidebar_label: "Production Checklist"
description: "What to check before running oncebox in production: migrations, MySQL isolation, DLQ, thread pool, Kafka and RabbitMQ settings, consumers and alerts."
sidebar_position: 4
---

# Production Checklist

What to check before a service with oncebox goes to production. Each item links to the page that explains it; most
of them fail silently when missed - the service runs, and events are delayed, duplicated or lost.

## Database

- **The tables are created by a migration tool.** `oncebox.schema.mode: flyway` or `liquibase`, not `dev` and not
  the default `none`, unless you create them yourself. See [Schema Migrations](reference/schema.md).
- **Spring Boot's own Flyway or Liquibase is handled.** Switched off with `spring.flyway.enabled: false` /
  `spring.liquibase.enabled: false` if the application does not use it, see
  [Schema Migrations](reference/schema.md#flyway).
- **MySQL runs at `READ COMMITTED`.** Otherwise concurrent pollers deadlock, see
  [MySQL isolation level](reference/persistence.md#mysql-isolation-level).
- **Cleanup TTLs fit the write rate.** `oncebox.outbox.clean-up.ttl` and `oncebox.inbox.clean-up.ttl` decide how many
  rows every query scans, see [Table growth](reference/persistence.md#table-growth).
- **The inbox TTL outlives redelivery.** An id removed by cleanup no longer deduplicates: keep
  `oncebox.inbox.clean-up.ttl` longer than any redelivery you expect from the broker.

## Publishing

- **Every publish runs inside the business transaction.** `OutboxPublisher#publish` or `@OutboxPublish` on a
  `@Transactional` method, see [Transactions](reference/publishing.md#transactions).
- **AspectJ is on the classpath if you use `@OutboxPublish`.** Without `spring-boot-starter-aop` annotated methods
  publish nothing, see [@OutboxPublish](reference/publishing.md#outboxpublish).
- **The DLQ is enabled.** `oncebox.outbox.dlq.enabled: true`; without it failed events stay in `outbox_events` as
  `FAILED`, see [Dead Letter Queue](reference/dlq.mdx).
- **The DLQ REST API is secured.** `oncebox-dlq-api` exposes `/api/outbox-dlq/events` without authentication of its
  own; protect the path with Spring Security, see [REST API](reference/dlq.mdx#rest-api).
- **The thread pool fits the tasks.** `oncebox.thread-pool-size` at least `2 + n` (`5 + n` with the DLQ) for `n`
  event types, see [Thread pool](reference/polling.md#thread-pool).
- **`initial-delay` is a conscious choice.** Pollers start `5m` after startup by default, so every deployment delays
  sending by that much, see [Polling](reference/polling.md#properties).

## Broker

- **Kafka producer: `acks=all` and `enable.idempotence=true`**, and `emergency-timeout` at or above
  `delivery.timeout.ms`, see [Apache Kafka](reference/messaging.md#apache-kafka).
- **RabbitMQ: a binding for every event type.** An unrouted message is confirmed and lost, see
  [Routing](reference/messaging.md#routing).
- **Topics, exchanges and queues exist.** oncebox creates none of them.

## Consuming

- **Listeners use the inbox container factory.** `inboxKafkaListenerContainerFactory` or
  `inboxRabbitListenerContainerFactory`, see [Deserialization](reference/inbox.md#deserialization).
- **The right consumer for each operation.** `@TransactionalConsumer` for database changes,
  `@NonTransactionalConsumer` only for side effects that must not repeat, see
  [Choosing a consumer](reference/inbox.md#choosing-a-consumer).
- **The cache name is unique per service.** `"<service-name>:oncebox:inbox"`; a shared name makes services skip each
  other's events, see [Cache](reference/inbox.md#cache).
- **Kafka: no auto-commit, and a recoverer on the error handler**; RabbitMQ: a dead letter exchange if failed messages
  are not requeued. See [Consumer acknowledgement](reference/messaging.md#consumer-acknowledgement).

## Monitoring

- **Metrics are on.** `oncebox-metrics` with `oncebox.outbox.metrics.enabled: true` (and the inbox's), see
  [Observability](reference/observability.md).
- **Alerts cover the backlog and the DLQ.** The signals worth alerting on are listed in
  [What to alert on](reference/observability.md#what-to-alert-on).
- **The startup warnings are read.** The starter logs a warning for every broker or inbox setting above that it can
  detect; none of them stops the service.
