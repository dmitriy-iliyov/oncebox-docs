---
id: configuration
title: "oncebox Configuration Properties"
sidebar_label: "Configuration"
description: "Every oncebox configuration property with its default: outbox sender, events, retries and backoff, stuck recovery, cleanup, DLQ, inbox, cache and metrics."
sidebar_position: 11
---

# Configuration

All properties live under the `oncebox` prefix. Durations take Spring Boot's format (`250ms`, `10s`, `5m`, `24h`).

## Global

```yaml
oncebox:
  thread-pool-size: 5
  schema:
    mode: flyway
  distributed-lock:
    resolve-by-polling-properties: true
    lock-at-least-for: 1s
    lock-at-most-for: 1m
```

| Property                                         | Description                                                                         | Default                        |
|--------------------------------------------------|-------------------------------------------------------------------------------------|--------------------------------|
| `thread-pool-size`                               | Threads shared by all pollers and jobs, see [sizing](polling.md#thread-pool)         | `min(available processors, 5)` |
| `schema.mode`                                    | How the tables are created: `flyway`, `liquibase`, `dev` or `none`, see [Schema Migrations](schema.md) | `none`                         |
| `distributed-lock.resolve-by-polling-properties` | Derive lock times from each job's polling settings                                  | `true`                         |
| `distributed-lock.lock-at-least-for`             | Minimum lock time when not derived                                                  | `1s`                           |
| `distributed-lock.lock-at-most-for`              | Lock expiry when not derived                                                        | `1m`                           |

## Outbox

| Property                 | Description            | Default |
|--------------------------|------------------------|---------|
| `oncebox.outbox.enabled` | Enable the outbox      | `true`  |

### Sender

```yaml
oncebox:
  outbox:
    sender:
      type: kafka
      bean-name: "customKafkaTemplate"
      emergency-timeout: 120s
```

| Property            | Description                                                 | Default                 |
|---------------------|-------------------------------------------------------------|-------------------------|
| `type`              | `kafka` or `rabbit`; required                               | -                       |
| `bean-name`         | Template bean to use when the context has several           | resolved by type        |
| `emergency-timeout` | Maximum wait for the broker to acknowledge a batch          | `120s`                  |

### Defaults and events

`defaults` applies to every event type; each entry under `events` overrides it property by property.

```yaml
oncebox:
  outbox:
    defaults:
      batch-size: 200
      polling:
        type: adaptive
        initial-delay: 5m
        min-fixed-delay: 250ms
        max-fixed-delay: 1m
        multiplier: 1.5
      max-retries: 3
      backoff:
        enabled: true
        delay: 10s
        multiplier: 3.0
    events:
      create-order:
        topic: orders               # Kafka topic, or the exchange for RabbitMQ
        batch-size: 500
        polling:
          min-fixed-delay: 1s
        max-retries: 2
        backoff:
          delay: 5s
          multiplier: 2.0
      update-order:
        topic: orders
        polling:
          type: fixed
          initial-delay: 10m
          fixed-delay: 250ms
        backoff:
          enabled: false            # retry on the next iteration
        # inherits batch-size 200 and max-retries 3
      delete-order:
        topic: orders
        polling:
          max-fixed-delay: 5m
          multiplier: 5.0
        # inherits batch-size 200, the other polling values, max-retries 3 and the backoff
```

| Property                  | Description                                                              | Default    |
|---------------------------|--------------------------------------------------------------------------|------------|
| `topic`                   | Kafka topic or RabbitMQ exchange; per event only, required               | -          |
| `batch-size`              | Events captured per iteration                                            | `200`      |
| `polling.type`            | `fixed` or `adaptive`                                                    | `adaptive` |
| `polling.initial-delay`   | Delay before the first iteration                                         | `5m`       |
| `polling.fixed-delay`     | Delay between iterations, `fixed` only                                   | -          |
| `polling.min-fixed-delay` | Smallest delay, `adaptive` only                                          | `250ms`    |
| `polling.max-fixed-delay` | Largest delay, `adaptive` only                                           | `1m`       |
| `polling.multiplier`      | Idle growth factor, `adaptive` only                                      | `1.5`      |
| `max-retries`             | Send attempts before the event becomes `FAILED`                          | `3`        |
| `backoff.enabled`         | Delay retries exponentially; when `false`, retry on the next iteration   | `true`     |
| `backoff.delay`           | Base delay                                                               | `10s`      |
| `backoff.multiplier`      | Growth factor per failed attempt                                         | `3.0`      |

How the delay is computed is described in [Processing & Resilience](processing.mdx#retries-and-backoff).

### Stuck event recovery

```yaml
oncebox:
  outbox:
    stuck-recovery:
      batch-size: 500
      max-batch-processing-time: 300s
      polling:
        type: adaptive
        initial-delay: 5m
        min-fixed-delay: 1s
        max-fixed-delay: 1m
        multiplier: 4.0
```

| Property                    | Description                                                     | Default    |
|-----------------------------|-----------------------------------------------------------------|------------|
| `batch-size`                | Events recovered per iteration                                  | `500`      |
| `max-batch-processing-time` | Age in `IN_PROCESS` after which an event is considered stuck    | `300s`     |
| `polling.type`              | `fixed` or `adaptive`                                           | `adaptive` |
| `polling.initial-delay`     | Delay before the first iteration                                | `5m`       |
| `polling.min-fixed-delay`   | Smallest delay                                                  | `1s`       |
| `polling.max-fixed-delay`   | Largest delay                                                   | `1m`       |
| `polling.multiplier`        | Idle growth factor                                              | `4.0`      |

### Cleanup

```yaml
oncebox:
  outbox:
    clean-up:
      enabled: true
      batch-size: 500
      ttl: 24h
      polling:
        type: adaptive
        initial-delay: 5m
        min-fixed-delay: 5s
        max-fixed-delay: 1m
        multiplier: 2.0
```

| Property                  | Description                                               | Default    |
|---------------------------|-----------------------------------------------------------|------------|
| `enabled`                 | Delete processed events; when `false` they accumulate     | `true`     |
| `batch-size`              | Events deleted per iteration                              | `500`      |
| `ttl`                     | Age of a `PROCESSED` event after which it is deleted      | `24h`      |
| `polling.type`            | `fixed` or `adaptive`                                     | `adaptive` |
| `polling.initial-delay`   | Delay before the first iteration                          | `5m`       |
| `polling.min-fixed-delay` | Smallest delay                                            | `5s`       |
| `polling.max-fixed-delay` | Largest delay                                             | `1m`       |
| `polling.multiplier`      | Idle growth factor                                        | `2.0`      |

### Dead letter queue

`batch-size` and `polling` at the top of the section are the defaults of `transfer-to` and `transfer-from`.

```yaml
oncebox:
  outbox:
    dlq:
      enabled: true
      batch-size: 500
      polling:
        type: adaptive
        initial-delay: 5m
        min-fixed-delay: 1s
        max-fixed-delay: 2m
        multiplier: 10.0
      transfer-to:
        polling:
          multiplier: 2.5           # everything else is inherited
      transfer-from:                # every value set, nothing inherited
        batch-size: 1000
        polling:
          type: fixed
          initial-delay: 5m
          fixed-delay: 1m
      clean-up:
        enabled: true
        batch-size: 500
        ttl: 24h
```

| Property                  | Description                                                           | Default    |
|---------------------------|-----------------------------------------------------------------------|------------|
| `enabled`                 | Enable the DLQ and its jobs                                           | `false`    |
| `batch-size`              | Events transferred per iteration                                      | `500`      |
| `polling.type`            | `fixed` or `adaptive`                                                 | `adaptive` |
| `polling.initial-delay`   | Delay before the first iteration                                      | `5m`       |
| `polling.min-fixed-delay` | Smallest delay                                                        | `1s`       |
| `polling.max-fixed-delay` | Largest delay                                                         | `2m`       |
| `polling.multiplier`      | Idle growth factor                                                    | `10.0`     |
| `transfer-to`             | Overrides for moving `FAILED` events into the DLQ                     | -          |
| `transfer-from`           | Overrides for moving `TO_RETRY` events back to the outbox             | -          |
| `clean-up`                | Cleanup of `RESOLVED` events; same properties and defaults as [Cleanup](#cleanup) | - |

### Metrics

```yaml
oncebox:
  outbox:
    metrics:
      enabled: true
      gauge:
        enabled: true
        cache:
          ttls: [60s, 60s, 30s]
```

| Property              | Description                                         | Default           |
|-----------------------|-----------------------------------------------------|-------------------|
| `enabled`             | Enable outbox metrics                               | `false`           |
| `gauge.enabled`       | Enable the event count gauges                       | `false`           |
| `gauge.cache.enabled` | Cache gauge values; always `false` when gauges are off | `true` with gauges on |
| `gauge.cache.ttls`    | Cache TTLs of the gauge groups                      | `[60s, 60s, 60s]` |

`metrics.enabled: true` alone collects metrics without the event count gauges; they stay off until `gauge.enabled` is
`true`.

## Inbox

| Property                | Description          | Default |
|-------------------------|----------------------|---------|
| `oncebox.inbox.enabled` | Enable the inbox     | `false` |

### Source

```yaml
oncebox:
  inbox:
    source:
      type: kafka
```

| Property | Description                  |
|----------|------------------------------|
| `type`   | `kafka` or `rabbit`          |

### Mappings

```yaml
oncebox:
  inbox:
    mappings:
      create-order: "com.example.OrderCreatedDto"
      update-order: "com.example.OrderUpdatedDto"
```

A map from event type to the class the payload is deserialized into. Keys must match the event types under
`oncebox.outbox.events` on the publisher side. See [Inbox](inbox.md#deserialization).

### Inbox cleanup

```yaml
oncebox:
  inbox:
    clean-up:
      enabled: true
      batch-size: 500
      ttl: 24h
      polling:
        type: adaptive
        initial-delay: 5m
        min-fixed-delay: 5s
        max-fixed-delay: 1m
        multiplier: 2.0
```

Same properties and defaults as the outbox [Cleanup](#cleanup); `ttl` is the age of an inbox record after which it is
deleted.

### Cache

```yaml
oncebox:
  inbox:
    cache:
      enabled: true
      cache-name: "<service-name>:oncebox:inbox"
```

| Property     | Description                                                                                           | Default |
|--------------|-------------------------------------------------------------------------------------------------------|---------|
| `enabled`    | Cache consumed ids. `false` when the section is absent, `true` when it is present without `enabled`   | `false` |
| `cache-name` | Name of a cache your `CacheManager` provides; required when the cache is enabled, unique per service  | -       |

Requires `oncebox-inbox-cache`. See [Inbox](inbox.md#cache).

### Inbox metrics

```yaml
oncebox:
  inbox:
    metrics:
      enabled: true
```

| Property  | Description          | Default |
|-----------|----------------------|---------|
| `enabled` | Enable inbox metrics | `false` |

## Full examples

Configurations for common setups - several event types, RabbitMQ, production, inbox, both sides in one service,
local development - are in [Configuration Recipes](recipes.md).
