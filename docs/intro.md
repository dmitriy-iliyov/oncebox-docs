---
id: intro
title: "What is oncebox: Outbox and Inbox for Spring Boot"
sidebar_label: "Introduction"
description: "oncebox is a Spring Boot library for the transactional outbox and inbox patterns: reliable event publishing to Kafka or RabbitMQ and deduplicated consumption."
slug: /
sidebar_position: 1
---

# Introduction

oncebox is a Spring Boot library that implements the
[Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html) pattern on the
publishing side and the inbox (idempotent consumer) pattern on the receiving side.

On the publishing side, events are stored in an `outbox_events` table in the same transaction as your business data.
Background pollers read them by event type and publish them to Apache Kafka or RabbitMQ, retrying failures with a
per-type backoff and moving events that exhaust their retries to a dead letter queue.

On the receiving side, the inbox records the id of every consumed event, so a message that the broker delivers again
is recognised and skipped.

No log-based CDC (Debezium) is involved: everything runs inside your application on plain SQL, which keeps the setup
simple, portable and explicit.

## Key features

- **Atomic persistence** - events are stored in the same transaction as the business change.
- **At-least-once delivery** - a batch is marked processed only after the broker acknowledges it; failures are retried
  with configurable backoff per event type.
- **Effectively-once processing** - the transactional inbox records an event id in the same transaction as its
  handling, so a redelivered event never changes data twice.
- **At-most-once processing** - the non-transactional inbox records the id before handling, so a side effect such as
  sending an email is never repeated.
- **Dead letter queue** - events that fail after all retries are moved to a DLQ table and managed through a REST API.
- **Adaptive polling** - the polling delay grows while there is nothing to do and drops as soon as work appears.
- **Self-healing** - batches stuck after a crash are returned to the queue, and their late outcome is fenced off.
- **Background maintenance** - processed outbox events, resolved DLQ events and old inbox records are cleaned up.
- **Observability** - Micrometer metrics with ready-made Grafana dashboards.

## Supported infrastructure

| Component      | Supported versions                                 |
|----------------|----------------------------------------------------|
| Databases      | PostgreSQL 16+, MySQL 8.0.13+, Oracle 23+          |
| Brokers        | Apache Kafka 3.7+, RabbitMQ 3.12+                  |
| Inbox cache    | Any Spring `CacheManager`, Redis 7+ is tested      |
| Runtime        | Java 21, Spring Boot 3.5                           |

## Modules

| Artifact              | Required | Purpose                                                              |
|-----------------------|:--------:|----------------------------------------------------------------------|
| `oncebox-starter`     |   yes    | Auto-configuration of the outbox and the inbox                        |
| `oncebox-postgresql`  | one of   | PostgreSQL repositories                                              |
| `oncebox-mysql`       | one of   | MySQL repositories                                                   |
| `oncebox-oracle`      | one of   | Oracle repositories                                                  |
| `oncebox-kafka`       | one of   | Kafka sender (publisher side)                                        |
| `oncebox-rabbit`      | one of   | RabbitMQ sender (publisher side)                                     |
| `oncebox-flyway`      | no       | Applies the oncebox migrations with Flyway, see [Schema Migrations](reference/schema.md) |
| `oncebox-liquibase`   | no       | Applies the oncebox migrations with Liquibase                         |
| `oncebox-aop`         | no       | `@OutboxPublish` support, pulled in by the starter; needs `spring-boot-starter-aop` |
| `oncebox-dlq-api`     | no       | REST API for the dead letter queue                                   |
| `oncebox-inbox-cache` | no       | Caching of consumed event ids through Spring's `CacheManager`         |
| `oncebox-metrics`     | no       | Micrometer metrics                                                   |

The core types live in `oncebox-core`, which comes in transitively.

## When not to use it

- **You need ordering.** Events are processed in parallel by type; there is no ordering guarantee within or across
  event types. See [Delivery Guarantees](reference/guarantees.md#ordering).
- **You scale to many instances polling one table.** `SKIP LOCKED` polling degrades as the number of instances grows.
  See [Core Concepts](reference/core.mdx#scaling).

## Next steps

- [Quickstart](quickstart.md) - publish and consume your first event.
- [Core Concepts](reference/core.mdx) - how events move from the table to the broker.
- [Delivery Guarantees](reference/guarantees.md) - what is guaranteed, and under which configuration.
