---
id: examples
title: "Example Project: Outbox and Inbox in Docker Compose"
sidebar_label: "Examples"
description: "A runnable oncebox example: an order service publishing through the outbox, a consumer deduplicating through the inbox, Kafka or RabbitMQ, Grafana."
sidebar_position: 3
---

# Examples

## Example project

[`oncebox-example`](https://github.com/dmitriy-iliyov/oncebox/tree/main/oncebox-example) runs a publisher, a consumer
and a load generator in Docker Compose, on any of the three databases and either broker:

| Service                      | Role                                                         |
|------------------------------|--------------------------------------------------------------|
| `oncebox-producer-example`   | An order API that publishes order events through the outbox  |
| `oncebox-consumer-example`   | Consumes them through the inbox                              |
| `oncebox-traffic-generator`  | A Gatling scenario that generates load against the producer  |
| `oncebox-shared-contract`    | Event DTOs shared by both sides                              |
| Prometheus and Grafana       | Metrics, with the oncebox dashboards provisioned             |

### What it shows

The producer's `OrderService` publishes in each of the three ways oncebox offers:

```java
// the return value is the payload; a List result becomes one event per element
@Transactional
@OutboxPublish(eventType = "create-order")
public OrderDto save(OrderCreateDto dto) { ... }

// the payload is picked from the arguments with SpEL
@Transactional
@OutboxPublish(eventType = "delete-order", payload = "#id")
public void delete(Long id) { ... }

// programmatic, for a payload the method does not return
@Transactional
public OrderDto update(OrderUpdateDto dto) {
    ...
    outboxPublisher.publish("update-order", mapper.toDto(order));
    return mapper.toDto(order);
}
```

On Kafka the consumer reads `orders` one message at a time and `orders.created` in batches, both through
`@TransactionalConsumer`; Redis backs the inbox cache.

Both services use `oncebox.schema.mode: flyway`, in the two situations an application can be in. The producer has
Flyway migrations of its own for the orders table, and its Flyway and oncebox's run side by side with separate
history tables. The consumer has none, so it switches Spring Boot's Flyway off with `spring.flyway.enabled: false`.

### Running it

From `oncebox-example`, build once, then start the stack with one broker and one database profile:

```bash
docker compose build
COMPOSE_PROFILES=kafka,postgres,test docker compose up
```

Use `rabbit` instead of `kafka`, and `mysql` or `oracle` instead of `postgres`. The `test` profile adds the traffic
generator, Prometheus and Grafana. Keep the same `COMPOSE_PROFILES` for every `docker compose` command of one run:
the profiles are passed to the services, so a different value recreates the producer and consumer containers.

The services take a minute or two to start. Grafana is at http://localhost:3000 (`admin` / `admin`) with the outbox
and inbox dashboards loaded; the producer API is on port `8080`. The
[example README](https://github.com/dmitriy-iliyov/oncebox/tree/main/oncebox-example) lists every port.

To check that nothing was lost, compare counters rather than table rows - both services clean up after `10m`:
requests the generator completed, `outbox_events_rate_total{status="processed"}` on the producer and
`inbox_events_total{type="consumed"}` on the consumer should be equal, with the DLQ empty.

## Configuration recipes

Ready configurations for common setups - several event types, RabbitMQ, production, an inbox, both sides in one
service, local development - are in [Configuration Recipes](reference/recipes.md).
