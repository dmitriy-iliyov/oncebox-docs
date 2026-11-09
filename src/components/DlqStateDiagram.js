import React from 'react';
import {Cylinder, Diagram, Flow, Label, Markers, State} from './StateDiagramParts';

const M = 'ob-dlq-state';

export default function DlqStateDiagram() {
  const claim = 'The transfer-to job moves FAILED outbox events into the DLQ as MOVED; through the REST API an event '
    + 'is marked TO_RETRY or RESOLVED; the transfer-from job returns TO_RETRY events to outbox_events as PENDING, and '
    + 'cleanup deletes RESOLVED events after their retention.';
  const caption = (
    <>
      Accent arrows are background jobs, the others are status changes made through the{' '}
      <a href="#rest-api">REST API</a>. The API sets any status except <code>IN_PROCESS</code> on any event that is
      not <code>IN_PROCESS</code>, so <code>TO_RETRY</code> and <code>RESOLVED</code> can also be changed back, and an
      event can be deleted by hand. <code>IN_PROCESS</code> exists only inside the transfer-from transaction, which
      locks a <code>TO_RETRY</code> batch, inserts it into <code>outbox_events</code> as <code>PENDING</code> under the
      same id and deletes it from the DLQ.
    </>
  );
  return (
    <Diagram claim={claim} viewBox="0 0 760 400" caption={caption}>
      <Markers id={M} />

      <Cylinder x={20} y={150} w={160} h={64} label="outbox_events" />
      <State x={260} y={160} name="MOVED" />
      <State x={500} y={70} name="TO_RETRY" />
      <State x={500} y={250} name="RESOLVED" />
      <State x={500} y={340} name="deleted" terminal />

      {/* transfer to */}
      <Flow markers={M} d="M 180 182 H 258" accent />
      <Label x={220} y={173}>transfer to</Label>
      <Label x={220} y={202} mono muted>FAILED</Label>

      {/* review through the API */}
      <Flow markers={M} d="M 410 182 H 450 V 92 H 498" />
      <Label x={458} y={135} anchor="start" muted>retry</Label>
      <Flow markers={M} d="M 410 182 H 450 V 272 H 498" />
      <Label x={458} y={237} anchor="start" muted>give up</Label>
      <Flow markers={M} d="M 620 116 V 248" dashed both />
      <Label x={632} y={180} anchor="start" muted>API,</Label>
      <Label x={632} y={196} anchor="start" muted>either way</Label>

      {/* transfer from */}
      <Flow markers={M} d="M 575 70 V 36 H 100 V 148" accent />
      <Label x={338} y={28}>transfer from · locked as IN_PROCESS, back as PENDING</Label>

      {/* cleanup */}
      <Flow markers={M} d="M 575 294 V 338" dashed />
      <Label x={587} y={320} anchor="start" muted>cleanup after ttl</Label>
    </Diagram>
  );
}
