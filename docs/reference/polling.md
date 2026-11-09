---
id: polling
title: Polling
sidebar_position: 9
---

# Polling

Every scheduled task - one per event type, plus stuck recovery, cleanups and DLQ transfers - has its own `polling`
section and runs on its own schedule.

## Strategies

### Fixed

A constant delay between iterations, whatever the last iteration found.

```yaml
polling:
  type: fixed
  initial-delay: 300s
  fixed-delay: 2s
```

Predictable and easy to reason about. It issues the same number of queries when idle as under load, so use it when a
maximum delivery delay matters more than database load.

### Adaptive

The delay grows while there is nothing to do and drops back as soon as work appears:

- an iteration that finds no events multiplies the delay by `multiplier`, up to `max-fixed-delay`;
- an iteration that finds events resets the delay to `min-fixed-delay`.

```yaml
polling:
  type: adaptive
  initial-delay: 300s
  min-fixed-delay: 1s
  max-fixed-delay: 1m
  multiplier: 2.0
```

Adaptive polling keeps an idle service almost silent on the database while reacting within `min-fixed-delay` once
traffic resumes. The worst-case latency of the first event after a quiet period is `max-fixed-delay`.

### Properties

| Property          | Meaning                                                |
|-------------------|--------------------------------------------------------|
| `type`            | `fixed` or `adaptive`                                  |
| `initial-delay`   | Delay before the first iteration after startup         |
| `fixed-delay`     | Delay between iterations, `fixed` only                 |
| `min-fixed-delay` | Smallest delay, `adaptive` only                        |
| `max-fixed-delay` | Largest delay, `adaptive` only                         |
| `multiplier`      | Growth factor of the delay while idle, `adaptive` only |

There are no global polling defaults: each group (event defaults, stuck recovery, cleanup, DLQ) has its own, listed in
[Configuration](configuration.md).

:::tip initial-delay
The defaults delay every task by 5 minutes after startup. Lower `initial-delay` in development and tests, or nothing
is published for the first minutes after the application starts.
:::

## Thread pool

All tasks share one scheduler pool, `oncebox.thread-pool-size` (default `min(available processors, 5)`). Size it so
that every task can run at once:

| Side   | Threads needed                                                            |
|--------|---------------------------------------------------------------------------|
| Outbox | 2 (stuck recovery, cleanup) + 3 with the DLQ (transfer to, from, cleanup) + 1 per event type |
| Inbox  | 1 (cleanup)                                                               |

That is `2 + n` without the DLQ and `5 + n` with it, where `n` is the number of event types, plus `1` if the service
also runs the inbox. A smaller pool still works, but tasks queue behind each other and polling delays stretch.

## Distributed lock

Cleanup jobs run on one instance at a time. They take a lock in the `oncebox_jobs` table:

```yaml
oncebox:
  distributed-lock:
    resolve-by-polling-properties: true
    lock-at-least-for: 1s
    lock-at-most-for: 1m
```

| Property                        | Meaning                                                                                       | Default |
|---------------------------------|-----------------------------------------------------------------------------------------------|---------|
| `resolve-by-polling-properties` | Derive the lock times from each job's polling settings (`fixed-delay`, or `min-fixed-delay` and `max-fixed-delay`) | `true`  |
| `lock-at-least-for`             | Minimum time a lock is held, used when `resolve-by-polling-properties` is `false`              | `1s`    |
| `lock-at-most-for`              | Time after which another instance may take a lock its holder did not release, used when `resolve-by-polling-properties` is `false` | `1m`    |

Event pollers and stuck recovery do not need the lock: they share the work through `SKIP LOCKED`.
