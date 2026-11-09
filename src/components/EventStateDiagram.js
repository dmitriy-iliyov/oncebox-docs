import React from 'react';
import {Cylinder, Diagram, Flow, Label, Markers, State} from './StateDiagramParts';

const M = 'ob-event-state';

export default function EventStateDiagram() {
  const claim = 'An outbox event moves from PENDING to IN_PROCESS when a poller captures it and to PROCESSED when the '
    + 'broker acknowledges it; a failed send returns it to PENDING while retries are left and makes it FAILED when '
    + 'they are exhausted, and stuck recovery returns long IN_PROCESS events to PENDING.';
  const caption = (
    <>
      Solid accent arrows are the normal path. A failed send counts an attempt: with attempts left the event returns
      to <code>PENDING</code> with a later <code>next_retry_at</code>, otherwise it becomes <code>FAILED</code> and,
      when the DLQ is enabled, moves to <code>outbox_dlq_events</code>. Stuck recovery returns events held in{' '}
      <code>IN_PROCESS</code> longer than <code>max-batch-processing-time</code> without counting an attempt.
    </>
  );
  return (
    <Diagram claim={claim} viewBox="0 0 760 330" caption={caption}>
      <Markers id={M} />

      {/* states */}
      <State x={30} y={130} name="PENDING" />
      <State x={300} y={130} name="IN_PROCESS" />
      <State x={570} y={130} name="PROCESSED" />
      <State x={300} y={260} name="FAILED" />
      <State x={570} y={260} name="deleted" terminal />
      <Cylinder x={20} y={252} w={170} h={60} label="outbox_dlq_events" />

      {/* happy path */}
      <Flow markers={M} d="M 180 152 H 298" accent />
      <Label x={239} y={143}>captured</Label>
      <Flow markers={M} d="M 450 152 H 568" accent />
      <Label x={509} y={143}>acknowledged</Label>

      {/* back to PENDING: a failed send with retries left, and stuck recovery */}
      <Flow markers={M} d="M 375 130 V 92 H 105 V 128" />
      <Label x={240} y={84} muted>send failed, retries left · waits for next_retry_at</Label>
      <Flow markers={M} d="M 420 130 V 40 H 60 V 128" dashed />
      <Label x={240} y={32} muted>stuck recovery · IN_PROCESS too long, no attempt counted</Label>

      {/* retries exhausted */}
      <Flow markers={M} d="M 375 174 V 258" />
      <Label x={387} y={212} anchor="start" muted>send failed,</Label>
      <Label x={387} y={228} anchor="start" muted>retries exhausted</Label>

      {/* to the DLQ */}
      <Flow markers={M} d="M 300 282 H 192" dashed />
      <Label x={246} y={273} muted>if DLQ enabled</Label>

      {/* cleanup */}
      <Flow markers={M} d="M 645 174 V 258" dashed />
      <Label x={657} y={212} anchor="start" muted>cleanup after</Label>
      <Label x={657} y={228} anchor="start" mono muted>ttl</Label>
    </Diagram>
  );
}
