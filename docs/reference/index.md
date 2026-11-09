---
id: index
title: Reference
slug: /reference/
---

# Reference

The reference describes how oncebox works and every setting it exposes.

| Page | What it covers |
|------|----------------|
| [Core Concepts](core.mdx) | Architecture, event lifecycle, batch capture, fencing, the database clock, background jobs |
| [Delivery Guarantees](guarantees.md) | At-least-once, effectively-once and at-most-once, duplicates, ordering, limitations |
| [Publishing Events](publishing.md) | `OutboxPublisher`, `@OutboxPublish`, transactions, serialization, event ids |
| [Processing & Resilience](processing.mdx) | State machine, retries and backoff, stuck event recovery, cleanup |
| [Dead Letter Queue](dlq.mdx) | DLQ state machine, transfer semantics, `OutboxDlqHandler`, REST API |
| [Inbox](inbox.md) | Idempotent consumers, choosing between them, cache, deserialization |
| [Messaging Integration](messaging.md) | Kafka and RabbitMQ senders, headers, routing, broker settings on both sides |
| [Persistence](persistence.md) | Databases, dialect modules, table schemas, MySQL isolation level |
| [Polling](polling.md) | Fixed and adaptive strategies, thread pool sizing, distributed lock |
| [Observability](observability.md) | Metrics and Grafana dashboards |
| [Configuration](configuration.md) | Every property with its default |
