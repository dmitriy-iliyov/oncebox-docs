---
id: observability
title: Observability
sidebar_position: 10
---

# Observability

Metrics come from the `oncebox-metrics` module, through Micrometer:

```xml
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-metrics</artifactId>
    <version>2.0.0</version>
</dependency>
```

```yaml
oncebox:
  outbox:
    metrics:
      enabled: true
      gauge:
        enabled: true
  inbox:
    metrics:
      enabled: true
```

The names below are as Prometheus exports them. "Tasks" are both the per-type event pollers and the background jobs:
`task_type` is the event type for a poller, or one of `outbox-processed-cleanup`, `outbox-stuck-recovery`,
`outbox-dlq-transfer-to`, `outbox-dlq-transfer-from`, `outbox-dlq-cleanup`, `inbox-cleanup`.

## Outbox

### Gauges

| Metric                                       | Description                             | Tags                                                |
|----------------------------------------------|-----------------------------------------|-----------------------------------------------------|
| `outbox_events`                              | Number of outbox events                 | -                                                   |
| `outbox_events_by_status`                    | Outbox events by status                 | `status={pending, in_process}`                      |
| `outbox_events_by_event_type_and_status`     | Outbox events by type and status        | `event_type`, `status={pending, in_process}`        |
| `outbox_dlq_events`                          | Number of DLQ events                    | -                                                   |
| `outbox_dlq_events_by_status`                | DLQ events by status                    | `status={moved, in_process, to_retry}`              |
| `outbox_dlq_events_by_event_type_and_status` | DLQ events by type and status           | `event_type`, `status={moved, in_process, to_retry}`|
| `oncebox_polling_delay_milliseconds`         | Current delay between task iterations   | `task_type`                                         |

Event gauges run `COUNT` queries and show the exact numbers. To keep Prometheus scrapes from loading the database,
their values are cached by default (`gauge.cache.ttls`); `gauge.cache.enabled: false` turns the cache off.

### Counters

| Metric                                       | Description                     | Tags                                                                                  |
|----------------------------------------------|---------------------------------|---------------------------------------------------------------------------------------|
| `outbox_events_rate_total`                   | Processed events                | `event_type`, `status={processed}`                                                    |
| `outbox_events_by_action_type_rate_total`    | Lifecycle actions               | `action_type={attempt_move_to_dlq, recovered, cleaned, success_moved_to_dlq}`         |
| `outbox_dlq_events_by_action_type_rate_total`| DLQ actions                     | `action_type={attempt_move_to_outbox, success_moved_to_outbox, manual_deleted, cleaned}` |
| `oncebox_started_tasks_total`                | Task iterations started         | `task_type`                                                                           |
| `oncebox_skipped_tasks_total`                | Task iterations skipped         | `task_type`                                                                           |
| `oncebox_succeeded_tasks_total`              | Task iterations succeeded       | `task_type`                                                                           |
| `oncebox_failed_tasks_total`                 | Task iterations failed          | `task_type`                                                                           |

### Timers

| Metric                             | Description                   | Tags        |
|------------------------------------|-------------------------------|-------------|
| `oncebox_task_processing_duration` | Duration of a task iteration  | `task_type` |

The timer shows where time goes during bulk recovery or DLQ reprocessing.

## Inbox

| Metric                               | Type    | Description                     | Tags                                                    |
|--------------------------------------|---------|---------------------------------|---------------------------------------------------------|
| `inbox_events_total`                 | counter | Inbox events by outcome         | `type={rejected_duplicates, consumed, cleaned, failed}` |
| `inbox_cache_action_total`           | counter | Inbox cache hits and misses     | `action_type={hit, miss}`                               |
| `oncebox_polling_delay_milliseconds` | gauge   | Current cleanup delay           | `task_type={inbox-cleanup}`                             |
| `oncebox_*_tasks_total`              | counter | Cleanup iterations by state     | `task_type={inbox-cleanup}`                             |
| `oncebox_task_processing_duration`   | timer   | Duration of a cleanup iteration | `task_type={inbox-cleanup}`                             |

## What to alert on

| Signal                                                             | Meaning                                                  |
|--------------------------------------------------------------------|----------------------------------------------------------|
| `outbox_events_by_status{status="pending"}` keeps growing          | Publishing does not keep up, or the broker is down       |
| `outbox_events_by_status{status="in_process"}` stays above zero    | Batches are stuck; check senders and `emergency-timeout`  |
| `outbox_dlq_events_by_status{status="moved"}` above zero           | Events need review                                       |
| `rate(oncebox_failed_tasks_total[5m])` above zero                  | A poller or a background job is failing                  |
| `inbox_events_total{type="failed"}` growing                        | Consumer operations are failing                          |

## Grafana

Ready-made dashboards for the
[outbox](https://github.com/dmitriy-iliyov/oncebox/blob/main/docs/grafana/outbox_dashboard.json) and the
[inbox](https://github.com/dmitriy-iliyov/oncebox/blob/main/docs/grafana/inbox_dashboard.json) are in the
repository. The [example project](../examples.md) starts Prometheus and Grafana with them provisioned.

## Configuration

See [Configuration](configuration.md#metrics) for the outbox and [Configuration](configuration.md#inbox-metrics) for
the inbox.
