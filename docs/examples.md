---
id: examples
title: Examples
sidebar_position: 3
---

# Examples

## Example project

[`oncebox-example`](https://github.com/dmitriy-iliyov/oncebox/tree/main/oncebox-example) is a complete setup in Docker
Compose:

| Service                      | Role                                                         |
|------------------------------|--------------------------------------------------------------|
| `oncebox-producer-example`   | Publishes order events through the outbox                    |
| `oncebox-consumer-example`   | Consumes them through the inbox                              |
| `oncebox-traffic-generator`  | Generates load against the producer                          |
| `oncebox-shared-contract`    | Event DTOs shared by both sides                              |
| Prometheus and Grafana       | Metrics, with the oncebox dashboards provisioned             |

Start it by following the [example README](https://github.com/dmitriy-iliyov/oncebox/tree/main/oncebox-example).

## Outbox-only

Minimal - the DLQ and metrics stay disabled, everything else uses defaults:

```yaml
oncebox:
  outbox:
    sender:
      type: kafka
    events:
      order-created:
        topic: orders
```

All features:

```yaml
oncebox:
  outbox:
    sender:
      type: kafka
    events:
      order-created:
        topic: orders
    dlq:
      enabled: true
    metrics:
      enabled: true
      gauge:
        enabled: true
```

Full, with every default spelled out:

```yaml
oncebox:
  thread-pool-size: 5
  tables:
    auto-create: true

  outbox:
    sender:
      type: kafka
      emergency-timeout: 120s

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
      order-created:
        topic: orders

    stuck-recovery:
      batch-size: 500
      max-batch-processing-time: 300s
      polling:
        type: adaptive
        initial-delay: 5m
        min-fixed-delay: 1s
        max-fixed-delay: 1m
        multiplier: 4.0

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

    dlq:
      enabled: true
      batch-size: 500
      polling:
        type: adaptive
        initial-delay: 5m
        min-fixed-delay: 1s
        max-fixed-delay: 2m
        multiplier: 10.0

    metrics:
      enabled: true
      gauge:
        enabled: true
        cache:
          ttls: [60s, 60s, 60s]
```

## Inbox-only

Minimal - cleanup is on, the cache is on once `cache-name` is set, metrics are off:

```yaml
oncebox:
  outbox:
    enabled: false
  inbox:
    enabled: true
    source:
      type: kafka
    mappings:
      order-created: "com.example.OrderCreatedDto"
    cache:
      cache-name: "<service-name>:oncebox:inbox"
```

All features:

```yaml
oncebox:
  outbox:
    enabled: false
  inbox:
    enabled: true
    source:
      type: kafka
    mappings:
      order-created: "com.example.OrderCreatedDto"
    cache:
      cache-name: "<service-name>:oncebox:inbox"
    metrics:
      enabled: true
```

Full:

```yaml
oncebox:
  thread-pool-size: 2
  tables:
    auto-create: true

  outbox:
    enabled: false

  inbox:
    enabled: true
    source:
      type: kafka
    mappings:
      order-created: "com.example.OrderCreatedDto"
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
    cache:
      enabled: true
      cache-name: "<service-name>:oncebox:inbox"
    metrics:
      enabled: true
```

## Publisher and consumer in one service

Both halves can run in the same application: declare `outbox.events` for what the service publishes and
`inbox.mappings` for what it consumes. Size `thread-pool-size` for both, see [Polling](reference/polling.md#thread-pool).
