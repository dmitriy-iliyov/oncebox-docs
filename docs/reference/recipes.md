---
id: recipes
title: "oncebox Configuration Examples"
sidebar_label: "Configuration Recipes"
description: "Ready oncebox configurations: several event types, RabbitMQ, a production outbox, an inbox-only service, both sides in one service, local development."
sidebar_position: 12
---

# Configuration Recipes

Every recipe assumes the dependencies from the [Quickstart](../quickstart.md): the starter, one dialect, a broker
module on the publishing side, and `oncebox-flyway` with Flyway for the tables. Every property and its default is in
[Configuration](configuration.md).

## Outbox, minimal

```yaml
oncebox:
  schema:
    mode: flyway
  outbox:
    sender:
      type: kafka
    events:
      order-created:
        topic: orders
```

One event type, sent to the Kafka topic `orders`. Everything else is a default: batches of `200`, adaptive polling
between `250ms` and `1m` that starts `5m` after startup, `3` retries with backoff from `10s`, stuck recovery and
cleanup of processed events after `24h`. The DLQ is off, so an event that exhausts its retries stays `FAILED` in
`outbox_events`.

## Several event types

```yaml
oncebox:
  schema:
    mode: flyway
  thread-pool-size: 6              # 2 background jobs + 1 per event type, plus spare
  outbox:
    sender:
      type: kafka
    defaults:
      polling:
        initial-delay: 30s
    events:
      order-created:
        topic: orders.created
        batch-size: 500            # the busiest type: bigger batches, faster polling
        polling:
          min-fixed-delay: 100ms
      order-updated:
        topic: orders
      order-deleted:
        topic: orders              # types may share a topic; the event type travels in a header
        max-retries: 10
```

Each type has a poller of its own, so a slow or failing type does not hold the others back. `defaults` applies to
every type, and each entry under `events` overrides it property by property. Count the threads before adding types,
see [Thread pool](polling.md#thread-pool).

## RabbitMQ

```yaml
oncebox:
  schema:
    mode: flyway
  outbox:
    sender:
      type: rabbit
    events:
      order-created:
        topic: orders-exchange     # the exchange; the routing key is the event type
      order-updated:
        topic: orders-exchange
```

With RabbitMQ `topic` names the exchange, and every message is routed by its event type. A message no binding
matches is dropped by the broker and still confirmed, so the event counts as sent - bind every event type before it
is published:

```java
@Bean
Declarables orderBindings() {
    DirectExchange exchange = new DirectExchange("orders-exchange");
    Queue queue = new Queue("orders");
    return new Declarables(
            exchange,
            queue,
            BindingBuilder.bind(queue).to(exchange).with("order-created"),
            BindingBuilder.bind(queue).to(exchange).with("order-updated")
    );
}
```

See [RabbitMQ](messaging.md#rabbitmq).

## Outbox for production

```yaml
oncebox:
  schema:
    mode: flyway
  thread-pool-size: 8              # 5 jobs with the DLQ + 1 per event type
  outbox:
    sender:
      type: kafka
    events:
      order-created:
        topic: orders.created
      order-updated:
        topic: orders
      order-deleted:
        topic: orders
    clean-up:
      ttl: 6h                      # fewer rows to scan on a high write rate
    dlq:
      enabled: true                # failed events move out of outbox_events for review
    metrics:
      enabled: true
      gauge:
        enabled: true
```

The DLQ keeps `outbox_events` free of failed events and gives them a [REST API](dlq.mdx#rest-api) when
`oncebox-dlq-api` is added. Metrics need `oncebox-metrics`. The broker settings that at-least-once depends on are
outside oncebox - go through the [Production Checklist](../production.md).

## Inbox

```yaml
oncebox:
  schema:
    mode: flyway
  outbox:
    enabled: false                 # this service does not publish
  inbox:
    enabled: true
    source:
      type: kafka
    mappings:
      order-created: "com.example.OrderCreatedDto"
      order-deleted: "java.lang.Long"
    cache:
      cache-name: "billing-service:oncebox:inbox"
    metrics:
      enabled: true
```

`mappings` tells the inbox container factories which class each event type deserializes to; the keys are the event
types the publisher uses. Setting `cache-name` turns the cache on, which needs `oncebox-inbox-cache` and a
`CacheManager` bean. The name carries the service: services sharing one cache store under one name skip each other's
events. Cleanup of inbox records after `24h` is on by default. See [Inbox](inbox.md).

## Publisher and consumer in one service

```yaml
oncebox:
  schema:
    mode: flyway
  thread-pool-size: 5              # outbox: 2 jobs + 2 types; inbox: 1 cleanup
  outbox:
    sender:
      type: kafka
    events:
      payment-completed:
        topic: payments
      payment-refunded:
        topic: payments
  inbox:
    enabled: true
    source:
      type: kafka
    mappings:
      order-created: "com.example.OrderCreatedDto"
    cache:
      cache-name: "payment-service:oncebox:inbox"
```

The two halves are independent: `outbox.events` lists what the service publishes, `inbox.mappings` what it consumes.
They share the thread pool and the tables' database.

## Local development and tests

```yaml
oncebox:
  schema:
    mode: dev                      # no Flyway needed, the scripts are idempotent
  outbox:
    defaults:
      polling:
        initial-delay: 1s          # the default 5m looks like a broken outbox in a test
        max-fixed-delay: 1s
```

`dev` runs the table scripts on every startup without a history table, so it fits a throwaway database. A short
`initial-delay` and `max-fixed-delay` make a published event reach the broker within a second or two.
