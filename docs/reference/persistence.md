---
id: persistence
title: Persistence
sidebar_position: 8
---

# Persistence

## Databases

| Database   | Minimum version | Module               | UUID column | Time column                |
|------------|-----------------|----------------------|-------------|----------------------------|
| PostgreSQL | 16              | `oncebox-postgresql` | `UUID`      | `TIMESTAMPTZ`              |
| MySQL      | 8.0.13          | `oncebox-mysql`      | `BINARY(16)`| `DATETIME(6)`, UTC         |
| Oracle     | 23              | `oncebox-oracle`     | `RAW(16)`   | `TIMESTAMP WITH TIME ZONE` |

Add exactly one dialect module. The starter declares all three as optional, so none is on your classpath by default,
and the matching one is selected from the database the `DataSource` points at.

Repositories use Spring's `JdbcTemplate` directly; no JPA or Hibernate is involved, and the outbox works the same
whether your application uses JPA, jOOQ or plain JDBC - as long as they share the transaction manager and
`DataSource`.

## JdbcTemplate

oncebox works through its own template, the bean `onceboxJdbcTemplate`, built from the application's `DataSource`.
It is declared with `defaultCandidate = false`:

- application code that injects a `JdbcTemplate` by type gets Spring Boot's `jdbcTemplate`, and the
  `spring.jdbc.template.*` settings apply to it as usual;
- those settings (`max-rows`, `query-timeout`, `fetch-size`) do not reach oncebox queries;
- oncebox beans get their template by name.

To tune the template oncebox uses, declare your own bean under the same name, also not a default candidate, in any
configuration class of the application:

```java
@Configuration
class OnceboxJdbcConfiguration {

    @Bean(defaultCandidate = false)
    JdbcTemplate onceboxJdbcTemplate(DataSource dataSource) {
        JdbcTemplate template = new JdbcTemplate(dataSource);
        template.setQueryTimeout(30);
        return template;
    }
}
```

:::warning
Build it from the `DataSource` your transaction manager uses. A template on another `DataSource` writes events
outside the business transaction, and the outbox loses its atomicity without an error.
:::

Leave out `defaultCandidate = false` and your bean becomes an ordinary candidate: Spring Boot then backs off from its
own `jdbcTemplate`, and every `JdbcTemplate` injected by type in the application is the oncebox one again.

## Tables

| Table               | Created when                        | Contents                                         |
|---------------------|-------------------------------------|--------------------------------------------------|
| `outbox_events`     | the outbox is enabled               | Events waiting for, in, or after delivery        |
| `oncebox_jobs`      | outbox or inbox cleanup is enabled  | Distributed locks of the cleanup jobs            |
| `outbox_dlq_events` | the outbox and its DLQ are enabled  | Events that exhausted their retries              |
| `inbox_events`      | the inbox is enabled                | Ids of consumed events                           |

With `oncebox.tables.auto-create: true` (the default) the tables and indexes are created at startup if they do not
exist. Set it to `false` to manage the schema with Flyway or Liquibase; the reference DDL for every dialect is in
[`oncebox-starter/src/main/resources`](https://github.com/dmitriy-iliyov/oncebox/tree/main/oncebox-starter/src/main/resources).

### outbox_events

PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS outbox_events (
    id            UUID PRIMARY KEY,
    status        VARCHAR(50)  NOT NULL,
    event_type    VARCHAR(255) NOT NULL,
    payload_type  VARCHAR(255) NOT NULL,
    payload       TEXT         NOT NULL,
    retry_count   INTEGER      NOT NULL,
    next_retry_at TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp(),
    lock_token    UUID
);

CREATE INDEX IF NOT EXISTS idx_outbox_by_event_type_and_next_retry_at
    ON outbox_events(event_type, next_retry_at)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_outbox_by_status_and_updated_at
    ON outbox_events(status, updated_at)
    WHERE status IN ('IN_PROCESS', 'FAILED', 'PROCESSED');
```

| Column          | Meaning                                                                   |
|-----------------|---------------------------------------------------------------------------|
| `id`            | UUIDv7 event id, sent as `oncebox_event_id`                                |
| `status`        | `PENDING`, `IN_PROCESS`, `PROCESSED`, `FAILED`                             |
| `event_type`    | Event type from `oncebox.outbox.events`                                    |
| `payload_type`  | Class name of the payload                                                  |
| `payload`       | Serialized payload, JSON by default                                        |
| `retry_count`   | Failed attempts so far                                                     |
| `next_retry_at` | When the event is due; set on insert and after each failure                |
| `created_at`    | When the event was stored                                                  |
| `updated_at`    | Last status change; the age used by stuck recovery and cleanup             |
| `lock_token`    | Token of the capture that holds the event, see [fencing](core.mdx#fencing-with-a-lock-token) |

### outbox_dlq_events

PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS outbox_dlq_events (
    id            UUID PRIMARY KEY,
    status        VARCHAR(50)  NOT NULL,
    dlq_status    VARCHAR(50)  NOT NULL,
    event_type    VARCHAR(255) NOT NULL,
    payload_type  VARCHAR(255) NOT NULL,
    payload       TEXT         NOT NULL,
    retry_count   INTEGER      NOT NULL,
    next_retry_at TIMESTAMPTZ  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL,
    moved_at      TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_outbox_dlq_by_moved_at
    ON outbox_dlq_events(moved_at)
    WHERE dlq_status = 'TO_RETRY';
```

| Column          | Meaning                                                   |
|-----------------|-----------------------------------------------------------|
| `id`            | The event id, the same as in `outbox_events`              |
| `status`        | The outbox status the event was moved with, `FAILED`      |
| `dlq_status`    | `MOVED`, `IN_PROCESS`, `TO_RETRY`, `RESOLVED`             |
| `event_type`    | Event type from `oncebox.outbox.events`                   |
| `payload_type`  | Class name of the payload                                 |
| `payload`       | Serialized payload, JSON by default                       |
| `retry_count`   | Failed attempts before the event was moved                |
| `next_retry_at` | Copied from `outbox_events`                               |
| `created_at`    | When the event was first stored in `outbox_events`        |
| `updated_at`    | Last status change in the DLQ; the age used by cleanup    |
| `moved_at`      | When the event entered the DLQ; the order of the DLQ      |

### inbox_events

```sql
CREATE TABLE IF NOT EXISTS inbox_events (
    id          UUID PRIMARY KEY,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_inbox_by_consumed_at ON inbox_events(consumed_at);
```

| Column        | Meaning                                                    |
|---------------|------------------------------------------------------------|
| `id`          | Id of a consumed event, read from `oncebox_event_id`       |
| `consumed_at` | When the event was consumed; the age used by cleanup       |

The primary key on `id` is what makes deduplication safe under concurrency: two instances that receive the same event
at once cannot both insert it.

### oncebox_jobs

```sql
CREATE TABLE IF NOT EXISTS oncebox_jobs (
    job_name          VARCHAR(255) PRIMARY KEY,
    lock_until        TIMESTAMPTZ NOT NULL,
    locked_by         UUID,
    locked_at         TIMESTAMPTZ NOT NULL,
    lock_at_least_for BIGINT      NOT NULL,
    lock_at_most_for  BIGINT      NOT NULL
);
```

One row per cleanup job: `outbox-processed-cleanup`, `outbox-dlq-cleanup` and `inbox-cleanup`. A row is inserted when
the job is enabled, with a lock that has already expired.

| Column              | Meaning                                                                                  |
|---------------------|------------------------------------------------------------------------------------------|
| `job_name`          | Name of the cleanup job                                                                  |
| `lock_until`        | Until when the lock is held; an instance takes the lock only once this moment has passed |
| `locked_by`         | Id of the instance that took the lock last; `NULL` until the job first runs              |
| `locked_at`         | When the lock was taken last                                                             |
| `lock_at_least_for` | Milliseconds the lock is held at least, even when the job finishes earlier               |
| `lock_at_most_for`  | Milliseconds after which a lock its holder did not release expires                       |

Taking the lock sets `lock_until` to `lock_at_most_for` from now. Releasing it sets `lock_until` to the later of now and
`locked_at` plus `lock_at_least_for`, so a job that finishes quickly is not started again by another instance right
away. See [distributed lock](polling.md#distributed-lock) for the settings.

## Time

All timestamps are written and compared by the database, see [Core Concepts](core.mdx#the-database-clock). MySQL
stores UTC wall time in `DATETIME(6)` columns and needs 8.0.13+ for expression defaults.

## MySQL isolation level

:::important Run the outbox at READ COMMITTED on MySQL
Under InnoDB's default `REPEATABLE READ`, the `SELECT ... FOR UPDATE SKIP LOCKED` polling query takes next-key (gap)
locks, and several instances polling the same table deadlock instead of each taking a disjoint batch.
`READ COMMITTED` disables gap locking. The outbox never needs repeatable reads, so this is safe.
:::

```yaml
spring:
  datasource:
    hikari:
      transaction-isolation: TRANSACTION_READ_COMMITTED
```

PostgreSQL and Oracle are not affected.

## Table growth

`outbox_events` holds processed events until cleanup removes them (`oncebox.outbox.clean-up.ttl`, default `24h`), and
`inbox_events` holds ids for `oncebox.inbox.clean-up.ttl`. Size the TTLs to your write rate: a high-volume service
with a long TTL keeps millions of rows, and every capture and cleanup query pays for them.
