---
id: guarantees
title: Delivery Guarantees
sidebar_position: 2
---

# Delivery Guarantees

## Summary

| Side      | Setup                                   | Guarantee            |
|-----------|-----------------------------------------|----------------------|
| Publisher | outbox                                  | At-least-once        |
| Consumer  | `TransactionalIdempotentConsumer`       | Effectively-once     |
| Consumer  | `NonTransactionalIdempotentConsumer`    | At-most-once         |
| Consumer  | plain listener, no inbox                | Duplicates possible  |

## Transactional writes

An event is stored in the same database transaction as your business change: both commit, or neither does. This
removes the dual-write problem - there is no window in which the data is saved and the event is lost, or the other
way round.

The methods that store events require an existing transaction (`Propagation.MANDATORY`); calling them outside one
fails with `IllegalTransactionStateException`.

## At-least-once publishing

An event is marked `PROCESSED` only after the broker acknowledges it: a completed send future for Kafka, a publisher
confirm for RabbitMQ. Nothing has to be configured on the consumer side for this. Every other outcome keeps the event
for another attempt:

| What happens                                   | Result                                                            |
|------------------------------------------------|-------------------------------------------------------------------|
| The broker rejects or does not confirm in time | The event is retried with backoff                                 |
| The instance crashes before or during sending  | The event stays `IN_PROCESS` and is [recovered](processing.mdx#stuck-event-recovery) without counting an attempt |
| Retries are exhausted                          | The event becomes `FAILED` and, with the DLQ enabled, moves to the [DLQ](dlq.mdx) |

:::warning
oncebox does not create or configure topics, exchanges, queues or bindings - the broker is yours to set up. The
guarantee holds only if it is configured to acknowledge durably: `acks=all` for Kafka (the default of the
Kafka client since 3.0), publisher confirms and durable queues for RabbitMQ. If the producer buffers records, tune
the buffer for the expected load. See [Messaging Integration](messaging.md).
:::

## Duplicates

At-least-once means an event can reach the broker more than once:

- the broker accepted the event, but the instance crashed before writing `PROCESSED`;
- the send timed out on the client (`emergency-timeout`) although the broker accepted it;
- a batch outlived the stuck threshold and was recovered and sent again by another instance.

Each copy carries the same event id in the `oncebox_event_id` header. Use the inbox, or make the consumer idempotent
some other way.

## Inbox guarantees

| Implementation                       | Guarantee        | When the operation throws                                                  |
|--------------------------------------|------------------|----------------------------------------------------------------------------|
| `TransactionalIdempotentConsumer`    | Effectively-once | The id is rolled back with the operation; a redelivered event runs again   |
| `NonTransactionalIdempotentConsumer` | At-most-once     | The id stays recorded; a redelivered event is skipped and never runs again |

**Effectively-once** rather than exactly-once: the broker still delivers duplicates, the inbox makes sure that only one
of them changes your data. It holds for effects written to the same database as the inbox. An external call inside
the operation (an email, an HTTP request) is not part of the transaction and can repeat if the transaction does not
commit after it.

**At-most-once** is for operations that cannot be undone and must not be repeated. Its price is that an event whose
operation failed is not processed again; the failure is logged at `ERROR` with the ids that are given up.

The inbox relies on the broker redelivering an event that was not acknowledged. Settings that acknowledge too early
break this - see [Messaging Integration](messaging.md#consumer-acknowledgement).

How the two consumers work and how to choose one is described in [Inbox](inbox.md).

## Ordering

There is no ordering guarantee:

- event types are processed in parallel;
- within a type, a batch is selected in `next_retry_at` order, but several instances send several batches at once,
  and a failed event is retried after the events behind it;
- Kafka records are sent without a key, so they spread across partitions.

If consumers need order, carry a version or timestamp in the payload and let the consumer resolve it.

## Event loss

oncebox does not drop an event it has stored, with these exceptions that depend on configuration:

- **DLQ disabled** - not a loss, but `FAILED` events stay in `outbox_events` until handled manually.
- **Unroutable RabbitMQ messages** - an exchange without a binding for the event type accepts and discards the
  message, and the broker still confirms it. See [Messaging Integration](messaging.md#routing).
- **Inbox TTL** - inbox records are deleted after `oncebox.inbox.clean-up.ttl`; a duplicate that arrives later is not
  recognised.
- **Non-transactional consumer** - a failed operation is not retried, by design.

## Limitations

- **Latency.** Delivery is asynchronous and polling-based; latency is bounded by the polling delay of the event type.
- **Horizontal scaling.** See [Core Concepts](core.mdx#scaling).
- **No ordering.** See above.
