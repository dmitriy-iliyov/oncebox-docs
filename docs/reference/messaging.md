---
id: messaging
title: "Kafka and RabbitMQ Integration"
sidebar_label: "Messaging Integration"
description: "How oncebox publishes to Apache Kafka and RabbitMQ: headers, routing, acknowledgements, recommended producer settings and consumer acknowledgement."
sidebar_position: 7
---

# Messaging Integration

The outbox publishes through an `OutboxSender`. Two implementations are provided, one per broker module:

| Module           | Sender               | Uses                              | `topic` of an event means |
|------------------|----------------------|-----------------------------------|---------------------------|
| `oncebox-kafka`  | `KafkaOutboxSender`  | a `KafkaTemplate<String, String>` | Kafka topic               |
| `oncebox-rabbit` | `RabbitOutboxSender` | a `RabbitTemplate`                | RabbitMQ exchange         |

```yaml
oncebox:
  outbox:
    sender:
      type: kafka                       # or rabbit
      bean-name: "outboxKafkaTemplate"  # only if there are several templates
      emergency-timeout: 120s
```

The template is looked up by type. If the context has more than one, name the one to use with `bean-name`; without it
the context fails to start.

`emergency-timeout` is how long a batch waits for broker acknowledgements. Events that are not acknowledged in time
are counted as failed and retried. It must be less than `oncebox.outbox.stuck-recovery.max-batch-processing-time`,
otherwise the application fails to start: a batch still being sent would be recovered as stuck and published twice.

## Headers

Every message carries three headers:

| Header                       | Constant                            | Type   | Value                                                          |
|------------------------------|-------------------------------------|--------|----------------------------------------------------------------|
| `oncebox_event_id`           | `OnceboxHeaders.EVENT_ID`           | UUID   | Event id, used by the inbox for deduplication                  |
| `oncebox_event_type`         | `OnceboxHeaders.EVENT_TYPE`         | String | Event type, to dispatch when several types share a destination |
| `oncebox_event_payload_type` | `OnceboxHeaders.EVENT_PAYLOAD_TYPE` | String | Class name of the published payload, for further dispatching   |

`OnceboxHeadersUtils` reads them from a Spring `Message` (`extractId`, `extractEventType`).

The body is the payload as stored, JSON by default.

## Apache Kafka

- The message goes to the event's `topic`, with no key: records spread across partitions.
- An event is acknowledged when its send future completes.
- A record that fails asynchronously (its send future completes exceptionally) fails only that event.
- A record that the template rejects synchronously fails only that event if the error is about the record itself
  (`RecordTooLargeException`, `SerializationException`, `InvalidTopicException`,
  `UnknownTopicOrPartitionException`); any other synchronous Kafka exception, such as a metadata timeout, fails the
  whole batch.

Recommended producer settings:

```yaml
spring:
  kafka:
    producer:
      acks: all
      properties:
        enable.idempotence: true
```

The starter logs a warning at startup when the template's producer has no `acks=all` or is not idempotent.

Keep `emergency-timeout` at or above the producer's `delivery.timeout.ms` (default `120s`). A shorter timeout marks
events as failed while the producer may still deliver them, which produces duplicates.

## RabbitMQ

- The message is published to the event's `topic` as the exchange, with the **event type as the routing key**.
- Messages are persistent (`deliveryMode=2`).
- The sender enables publisher confirms on the channel itself; an event is acknowledged by a broker `ack` and failed
  by a `nack`.

### Routing

:::danger Bind every event type
Messages are published with the `mandatory` flag off. If the exchange has no binding for an event type, RabbitMQ
discards the message and still confirms it, so the event is marked `PROCESSED` although no queue received it.
Declare a binding for every event type before publishing it.
:::

The starter logs an error at startup if the `RabbitTemplate` is not `mandatory`; the sender currently publishes with
`mandatory=false` regardless, so the binding is what protects you.

## Consumer acknowledgement

The inbox relies on the broker redelivering an event that was not processed. The default listener settings already
acknowledge a message only after the handler returns; a few settings break that.

**Apache Kafka.** The default `AckMode` (`BATCH`) commits offsets after the listener returns, so manual acks are not
needed. Two settings lose events:

- `enable.auto.commit=true` - the client commits offsets on a timer, possibly before the event was processed. Spring
  Kafka disables it unless set explicitly; the starter logs a warning when it is on.
- the default `DefaultErrorHandler` retries a failing record a few times, then logs it and commits its offset. To keep
  such events, configure a recoverer, for example a `DeadLetterPublishingRecoverer`.

**RabbitMQ.** The default `AUTO` acknowledge mode acknowledges after the listener returns and requeues the message when
it throws. `defaultRequeueRejected=false` without a dead letter exchange drops a failed message.


## Custom sender

To publish somewhere else, provide your own `OutboxSender`:

```java
public interface OutboxSender {
    SenderResult sendEvents(String topic, List<OutboxEvent> events);
}
```

`SenderResult` holds the ids that were acknowledged and the ids that failed. Return an id as processed only after the
destination has durably accepted the event. Ids in neither set stay `IN_PROCESS` and are returned to `PENDING` by
[stuck event recovery](processing.mdx#stuck-event-recovery).

Any `OutboxSender` bean of the application replaces the built-in one, wherever it is declared - a `@Component`, a
`@Bean` in any configuration class, the main class included.

`oncebox.outbox.sender.type` is still required: the starter fails to start without it, even with a custom sender.
