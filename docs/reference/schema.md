---
id: schema
title: "Outbox Schema Migrations with Flyway and Liquibase"
sidebar_label: "Schema Migrations"
description: "Create and upgrade the oncebox tables with Flyway, Liquibase or a dev mode, next to the application's own migrations, and the rules for writing new ones."
sidebar_position: 9
---

# Schema Migrations

oncebox ships the DDL of its tables as versioned migrations and can apply them at startup with Flyway or Liquibase,
next to the application's own migrations and without touching them. Which tool runs them is set by
`oncebox.schema.mode`.

:::warning Nothing is created by default
The default mode is `NONE`: oncebox creates no tables, and the first query to a missing table fails. Set
`oncebox.schema.mode`, or create the tables yourself from the [reference DDL](persistence.md#tables).
:::

## Modes

| Mode        | What runs                                              | History                                   | Needs on the classpath                                    |
|-------------|--------------------------------------------------------|-------------------------------------------|-----------------------------------------------------------|
| `FLYWAY`    | A Flyway instance of oncebox's own, one per feature    | `oncebox_<feature>_schema_history`        | `oncebox-flyway`, `flyway-core`, the Flyway database module |
| `LIQUIBASE` | Liquibase, one changelog per migration script          | `oncebox_<feature>_changelog` (+ `_lock`) | `oncebox-liquibase`, `liquibase-core`                     |
| `DEV`       | The scripts straight through JDBC, on every startup    | none                                      | nothing extra                                             |
| `NONE`      | Nothing; the application owns the tables               | -                                         | -                                                         |

`FLYWAY` or `LIQUIBASE` is the choice for anything that runs beyond a laptop: every applied migration is recorded,
and a later oncebox release brings its schema changes as new migrations. `DEV` needs no extra dependency and is
meant for local development and tests; it keeps no record and relies on every oncebox script being idempotent.

The value binds relaxed, so `flyway` and `FLYWAY` are the same. An unknown value fails startup naming
`'oncebox.schema.mode'`. `FLYWAY` or `LIQUIBASE` without its tool or its oncebox module on the classpath fails
startup with `OnceboxSchemaMigratorSupplier not found for mode=...`, rather than silently creating nothing. The
starter declares both modules as optional, so add the one of your mode yourself.

## Flyway

```xml
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-flyway</artifactId>
    <version>2.0.0</version>
</dependency>

<!-- versions come from Spring Boot -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>

<!-- exactly one, matching your database:
     flyway-database-postgresql, flyway-mysql, flyway-database-oracle -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

```yaml
oncebox:
  schema:
    mode: flyway
```

:::important The Flyway database module is required
Flyway 11 supports PostgreSQL, MySQL and Oracle only through separate modules - `flyway-database-postgresql`,
`flyway-mysql`, `flyway-database-oracle`. Without the one for your database the migration fails at startup.
:::

Each feature is migrated by its own Flyway instance with its own history table, so oncebox's versions never meet the
application's `flyway_schema_history`. The instance runs with `baselineOnMigrate(true)` and baseline version `0`: on a
schema that already holds other tables it records a baseline and still applies `V1`.

:::warning An existing database that does not use Flyway yet
Adding `flyway-core` also switches on Spring Boot's own Flyway. On a schema that already has tables - your business
tables, or oncebox tables created by an earlier release - but no `flyway_schema_history`, that Flyway refuses to start
with `Found non-empty schema(s) ... but no schema history table`. If the application does not use Flyway itself, turn
Boot's off; if it is about to adopt Flyway, let Boot baseline the existing schema:

```yaml
spring:
  flyway:
    enabled: false              # the application has no Flyway migrations of its own
    # baseline-on-migrate: true # or: the application starts using Flyway on this database
```

oncebox's own Flyway is not affected by `spring.flyway.*`.
:::

## Liquibase

```xml
<dependency>
    <groupId>io.github.dmitriy-iliyov</groupId>
    <artifactId>oncebox-liquibase</artifactId>
    <version>2.0.0</version>
</dependency>

<!-- version comes from Spring Boot -->
<dependency>
    <groupId>org.liquibase</groupId>
    <artifactId>liquibase-core</artifactId>
</dependency>
```

```yaml
oncebox:
  schema:
    mode: liquibase
```

Each migration script is applied as a changelog of its own, in version order, and recorded in the feature's
`oncebox_<feature>_changelog` table under the lock table `oncebox_<feature>_changelog_lock` - separate from the
application's `databasechangelog`. You do not include anything into your master changelog.

:::warning An application that does not use Liquibase itself
Adding `liquibase-core` also switches on Spring Boot's own Liquibase, which fails startup when there is no
`db/changelog/db.changelog-master.yaml`. Without a changelog of your own, turn it off:

```yaml
spring:
  liquibase:
    enabled: false
```

oncebox's Liquibase is not affected by `spring.liquibase.*`.
:::

## Dev

```yaml
oncebox:
  schema:
    mode: dev
```

Runs every script of every enabled feature through JDBC at each startup, with no history table. Every oncebox script
creates only what is missing (`CREATE TABLE IF NOT EXISTS` and the like), so a second run on an up-to-date schema
changes nothing. Good for a local database and for integration tests; for a shared database prefer `FLYWAY` or
`LIQUIBASE`, which record what was applied.

## Which tables

Only the tables of the features that are enabled are migrated:

| Feature  | Table               | Migrated when                                           |
|----------|---------------------|---------------------------------------------------------|
| `outbox` | `outbox_events`     | the outbox is enabled                                   |
| `dlq`    | `outbox_dlq_events` | the outbox and its DLQ are enabled                      |
| `inbox`  | `inbox_events`      | the inbox is enabled                                    |
| `jobs`   | `oncebox_jobs`      | the cleanup of an enabled outbox or inbox is enabled    |

The feature name is the one in the history table names, for example `oncebox_inbox_schema_history`. The order in
which features are migrated is not part of the contract. Enabling a feature later, say the DLQ, creates its table on
the next startup.

## Order at startup

oncebox migrations run:

1. after the application's own Flyway or Liquibase, so their check for a non-empty schema without a history table
   does not see the oncebox tables of a first start;
2. before the `spring.sql.init` scripts, so a `data.sql` may refer to oncebox tables;
3. before any oncebox bean that uses the tables.

## Scripts

The migrations live in the starter jar under `db/oncebox/<vendor>/<feature>/`, where `<vendor>` is `postgresql`,
`mysql` or `oracle`:

```
db/oncebox/postgresql/outbox/V1__create_outbox_table.sql
db/oncebox/postgresql/dlq/V1__create_outbox_dlq_table.sql
db/oncebox/postgresql/inbox/V1__create_inbox_table.sql
db/oncebox/postgresql/jobs/V1__create_oncebox_jobs_table.sql
```

They are written as Liquibase formatted SQL, which Flyway and plain JDBC read as ordinary SQL with comments. Versions
are whole numbers - `V1`, `V2`, ..., `V10` - applied in numeric order. To manage the schema yourself with
`NONE`, copy them into your own migrations; browse them in
[`oncebox-starter/src/main/resources/db/oncebox`](https://github.com/dmitriy-iliyov/oncebox/tree/main/oncebox-starter/src/main/resources/db/oncebox).

## Errors

Any failure of a migration is reported as `io.github.dmitriyiliyov.oncebox.core.OnceboxMigrationException` with the
feature and the database in the message, and whatever Flyway, Liquibase or JDBC threw as its cause. The context does
not start.

## Customization

- A bean named `onceboxSchemaMigrator` replaces the whole migration step.
- A bean named `flywayOnceboxSchemaMigratorSupplier`, `liquibaseOnceboxSchemaMigratorSupplier` or
  `devOnceboxSchemaMigratorSupplier`, of type `OnceboxSchemaMigratorSupplier`, replaces that built-in mode.

## Writing a migration

For contributors. One script is run by three tools - Flyway, Liquibase and the plain JDBC runner of `DEV` - so it has
to satisfy all three at once. A script that works under one of them can break an installation that uses another.

A schema change is a new file, `V<n+1>__<what>.sql`, in `db/oncebox/<vendor>/<feature>/` of the starter, for every
one of the three dialects, and the same change in the test copy in `oncebox-tests/oncebox-test-fixtures`.

### A released script is never edited, comments and header included

The tools notice different edits, and none of them is harmless:

| Edit to a released script                                  | Flyway                              | Liquibase                                  |
|------------------------------------------------------------|-------------------------------------|--------------------------------------------|
| The SQL, or a comment inside the changeset                 | checksum mismatch, startup fails    | checksum mismatch, startup fails           |
| An attribute in the `-- changeset` line (`runInTransaction:false`) | checksum mismatch, startup fails | not noticed                                |
| The changeset id or author                                 | checksum mismatch, startup fails    | a new changeset, the script runs again     |

Flyway checksums the whole file; Liquibase checksums the body of the changeset and identifies it by id, author and
file. An edit that passes on one tool therefore still breaks every installation in the other mode - a fix is always
a new version.

### One file, one changeset

For Flyway a file is one migration, and on PostgreSQL one transaction. Liquibase allows several changesets in a file
and applies each atomically on its own. With exactly one changeset per file, the unit that succeeds or fails as a
whole is the same for both tools: on PostgreSQL a script that fails halfway leaves nothing behind under either.

```sql
-- liquibase formatted sql

-- changeset oncebox:<feature>-<n> dbms:<vendor>
...
```

### Every statement is idempotent

Each script creates only what is missing and can run any number of times - not just `V1`. `DEV` requires it, since
it runs every script on every startup, and it makes the other modes robust:

- MySQL and Oracle commit DDL statement by statement, so a migration that failed halfway leaves part of its changes
  in place; an idempotent script finishes on the next run instead of failing on what already exists;
- switching between `FLYWAY` and `LIQUIBASE` is safe although their histories live in different tables: the new tool
  replays every script over the existing tables;
- tables that already exist without a history entry are left as they are.

The dialects differ in how much it costs. PostgreSQL has `IF NOT EXISTS` for tables, columns and indexes. MySQL has no
`ADD COLUMN IF NOT EXISTS` and no `CREATE INDEX IF NOT EXISTS`: the scripts check `INFORMATION_SCHEMA` and run the
statement through `PREPARE`. The Oracle scripts wrap every statement in `BEGIN ... EXCEPTION ... END`.

### Three SQL parsers split the script

Flyway parses SQL properly. Liquibase splits a formatted SQL changeset on its delimiter, and `DEV` runs the script
through Spring's `ScriptUtils`, the weakest of the three. A script has to split the same way under all of them:

- **Oracle.** `DEV` splits on `/` wherever it stands outside quotes and comments, and Liquibase on the changeset's
  `endDelimiter:/`. The scripts are safe because all DDL sits inside `EXECUTE IMMEDIATE '...'` within a PL/SQL block
  that a `/` line ends. A `/` outside a string literal - a division, say - would cut the script in two.
- **PostgreSQL.** A function or trigger body in `$$ ... $$` fails under `DEV` (`Unterminated dollar quote`) and under
  Liquibase's default splitting; Liquibase needs `splitStatements:false` for it, and `DEV` cannot run it at all.
  Flyway handles it.
- **MySQL.** `SET @x` and `PREPARE` work everywhere, because every tool runs a script on one connection. A stored
  routine that needs `DELIMITER` works only under Flyway.
