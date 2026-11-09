import React, {createContext, useContext, useEffect, useState} from 'react';

const ACCENT = 'var(--ifm-color-primary)';
const SANS = 'var(--ifm-font-family-base)';
const MONO = 'var(--ifm-font-family-monospace)';

function Box({x, y, w, h, title, sub, mono, dashed}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="currentColor" fillOpacity={0.05}
            stroke="currentColor" strokeOpacity={0.55} strokeDasharray={dashed ? '5 4' : undefined} />
      <text x={x + w / 2} y={sub ? y + h / 2 - 2 : y + h / 2 + 5} textAnchor="middle" fontSize={14}
            fontWeight={600} fontFamily={mono ? MONO : SANS} fill="currentColor">{title}</text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" fontSize={12} fontFamily={SANS}
              fill="currentColor" fillOpacity={0.7}>{sub}</text>
      )}
    </g>
  );
}

function Cylinder({x, y, w, h, label, mono}) {
  const ry = 9;
  const rx = w / 2;
  return (
    <g>
      <path d={`M ${x} ${y + ry} A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} V ${y + h - ry} A ${rx} ${ry} 0 0 1 ${x} ${y + h - ry} Z`}
            fill="currentColor" fillOpacity={0.07} stroke="currentColor" strokeOpacity={0.55} />
      <path d={`M ${x} ${y + ry} A ${rx} ${ry} 0 0 0 ${x + w} ${y + ry}`}
            fill="none" stroke="currentColor" strokeOpacity={0.55} />
      <text x={x + rx} y={y + h / 2 + 9} textAnchor="middle" fontSize={14} fontWeight={600}
            fontFamily={mono ? MONO : SANS} fill="currentColor">{label}</text>
    </g>
  );
}

// The arrows an event travels along; the same strings draw the arrows and move the dots, so a dot never leaves its line.
const PATH = {
  publish: 'M 150 120 V 168',
  capture: 'M 352 232 H 498',
  outcome: 'M 498 262 H 352',
  send: 'M 610 272 V 468',
  deliver: 'M 610 540 V 638',
  consume: 'M 500 665 H 422',
  record: 'M 280 690 V 773',
  run: 'M 380 690 V 712 H 610 V 773',
};

// One event travels the diagram on a 12s loop. Every animation shares the cycle and starts at 0, so they stay in step;
// each step owns a window of it, given as fractions of the cycle.
const CYCLE = '12s';
const STEPS = {
  1: [0.02, 0.10],
  2: [0.14, 0.22],
  3: [0.26, 0.36],
  4: [0.40, 0.48],
  5: [0.40, 0.50],
  6: [0.63, 0.71],
  7: [0.75, 0.86],
};
const TOKENS = [
  {path: PATH.publish, window: STEPS[1]},
  {path: PATH.capture, window: STEPS[2]},
  {path: PATH.send, window: STEPS[3]},
  {path: PATH.outcome, window: STEPS[4]},
  {path: PATH.deliver, window: STEPS[5]},
  {path: PATH.consume, window: [0.54, 0.59], muted: true},
  {path: PATH.record, window: STEPS[6]},
  {path: PATH.run, window: STEPS[7]},
];

// the arrowhead marker is 7 stroke widths long and its tip sits 0.9 of the way along, so the head covers this much
const headLength = (muted) => 7 * (muted ? 1.5 : 2) * 0.9;

// length of a path made of M, H and V commands, the only ones the arrows use
function pathLength(d) {
  const parts = d.trim().split(/\s+/);
  let x = 0;
  let y = 0;
  let length = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const command = parts[i];
    if (command === 'M') {
      x = Number(parts[i + 1]);
      y = Number(parts[i + 2]);
      i += 2;
    } else if (command === 'H') {
      const nx = Number(parts[i + 1]);
      length += Math.abs(nx - x);
      x = nx;
      i += 1;
    } else if (command === 'V') {
      const ny = Number(parts[i + 1]);
      length += Math.abs(ny - y);
      y = ny;
      i += 1;
    }
  }
  return length;
}

const Motion = createContext(false);

// off during server rendering and for readers who ask the system for reduced motion
function useMotion() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setOn(!query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return on;
}

const times = (...fractions) => fractions.map((f) => f.toFixed(3)).join(';');

// A dot takes the colour of its arrow and moves along it at a constant speed. Once its front edge touches the arrowhead it starts to shrink, and it
// is gone when its centre reaches the tip, where the arrow meets the component.
function Token({path, window: [t0, t1], muted}) {
  const r = muted ? 5 : 6;
  const shrinkFrom = Math.max(0, 1 - (headLength(muted) + r) / pathLength(path));
  const ts = t0 + shrinkFrom * (t1 - t0);
  return (
    <circle r={0} fill={muted ? 'currentColor' : ACCENT} fillOpacity={muted ? 0.6 : 1}>
      <animateMotion dur={CYCLE} repeatCount="indefinite" path={path} calcMode="linear"
                     keyPoints="0;0;1;1" keyTimes={times(0, t0, t1, 1)} />
      <animate attributeName="r" dur={CYCLE} repeatCount="indefinite" calcMode="linear"
               values={`0;${r};${r};0;0`} keyTimes={times(0, t0, ts, t1, 1)} />
    </circle>
  );
}

function Badge({x, y, n}) {
  const motion = useContext(Motion);
  const [t0, t1] = STEPS[n];
  return (
    <g>
      {motion && (
        <circle cx={x} cy={y} r={8} fill="none" stroke={ACCENT} strokeWidth={2} opacity={0}>
          <animate attributeName="r" dur={CYCLE} repeatCount="indefinite" values="8;8;18;18"
                   keyTimes={times(0, t0, t1, 1)} />
          <animate attributeName="opacity" dur={CYCLE} repeatCount="indefinite" values="0;0;0.6;0;0"
                   keyTimes={times(0, t0, t0 + 0.01, t1, 1)} />
        </circle>
      )}
      <circle cx={x} cy={y} r={8} fill={ACCENT}>
        {motion && (
          <animate attributeName="r" dur={CYCLE} repeatCount="indefinite" values="8;8;10.5;8;8"
                   keyTimes={times(0, t0, (t0 + t1) / 2, t1, 1)} />
        )}
      </circle>
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fontFamily={SANS}
            fill="var(--ob-badge-text)">{n}</text>
    </g>
  );
}

function Label({x, y, anchor = 'start', children, mono, muted}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={13} fontFamily={mono ? MONO : SANS}
          fill="currentColor" fillOpacity={muted ? 0.7 : 0.92}>{children}</text>
  );
}

function Flow({d, accent = true, both}) {
  const marker = accent ? 'url(#ob-arrow-accent)' : 'url(#ob-arrow)';
  return (
    <path d={d} fill="none" stroke={accent ? ACCENT : 'currentColor'} strokeOpacity={accent ? 1 : 0.6}
          strokeWidth={accent ? 2 : 1.5} markerEnd={marker} markerStart={both ? marker : undefined} />
  );
}

function Panel({y, h, title, note}) {
  return (
    <g>
      <rect x={20} y={y} width={720} height={h} rx={10} fill="currentColor" fillOpacity={0.025}
            stroke="currentColor" strokeOpacity={0.3} />
      <text x={36} y={y + 28} fontSize={16} fontWeight={700} fontFamily={SANS} fill="currentColor">{title}</text>
      {note && (
        <text x={724} y={y + 28} textAnchor="end" fontSize={12} fontFamily={SANS} fill="currentColor"
              fillOpacity={0.65}>{note}</text>
      )}
    </g>
  );
}

function Transaction({x, y, w, h, label}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="none" stroke={ACCENT} strokeOpacity={0.85}
            strokeDasharray="6 4" />
      <text x={x + 12} y={y + 19} fontSize={12} fontFamily={SANS} fill={ACCENT}>{label}</text>
    </g>
  );
}

export default function ArchitectureDiagram() {
  const motion = useMotion();
  const claim = 'An event is written with the business data in one transaction, captured and sent by a poller, '
    + 'and deduplicated by its id in the consumer inbox.';
  return (
    <Motion.Provider value={motion}>
      <figure style={{margin: '0.5rem 0 1.5rem'}}>
        <svg viewBox="0 16 760 948" role="img" aria-label={claim}
             style={{width: '100%', height: 'auto', color: 'var(--ifm-font-color-base)'}}>
          <defs>
            <marker id="ob-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"
                    orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={ACCENT} />
            </marker>
            <marker id="ob-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"
                    orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" fillOpacity={0.6} />
            </marker>
          </defs>

          {/* publishing service */}
          <Panel y={20} h={410} title="Publishing service"
                 note="background jobs: stuck recovery · cleanup · DLQ transfer" />
          <Box x={40} y={70} w={220} h={50} title="@Transactional method" sub="your code" mono />
          <Transaction x={40} y={170} w={320} h={160} label="one local transaction" />
          <Cylinder x={55} y={205} w={140} h={100} label="business tables" />
          <Cylinder x={210} y={205} w={140} h={100} label="outbox_events" mono />
          <Box x={500} y={222} w={220} h={50} title="Poller" sub="one per event type" />
          <Cylinder x={190} y={360} w={180} h={56} label="outbox_dlq_events" mono />

          {/* 1: data and event in one transaction */}
          <Flow d={PATH.publish} />
          <Badge x={150} y={134} n={1} />
          <Label x={170} y={139}>saves its data and calls publish()</Label>

          {/* 2: capture, 4: outcome */}
          <Flow d={PATH.capture} />
          <Badge x={386} y={232} n={2} />
          <Label x={440} y={222} anchor="middle">captures a batch</Label>
          <Flow d={PATH.outcome} />
          <Badge x={386} y={262} n={4} />
          <Label x={440} y={284} anchor="middle" mono muted>PROCESSED / PENDING</Label>

          {/* failed events to the DLQ */}
          <Flow d="M 280 307 V 358" accent={false} />
          <Label x={292} y={350} muted>retries exhausted</Label>

          {/* 3: send and wait for ack */}
          <Flow d={PATH.send} />
          <Badge x={610} y={340} n={3} />
          <Label x={630} y={336}>sends,</Label>
          <Label x={630} y={352} muted>waits for ack</Label>

          {/* broker */}
          <rect x={470} y={470} width={270} height={70} rx={8} fill="currentColor" fillOpacity={0.07}
                stroke="currentColor" strokeOpacity={0.55} />
          <text x={605} y={498} textAnchor="middle" fontSize={14} fontWeight={600} fontFamily={SANS}
                fill="currentColor">Kafka topic / RabbitMQ exchange</text>
          <text x={605} y={522} textAnchor="middle" fontSize={12} fontFamily={MONO} fill="currentColor"
                fillOpacity={0.7}>header oncebox_event_id</text>
          <Label x={456} y={510} anchor="end" muted>broker</Label>

          {/* 5: delivery */}
          <Flow d={PATH.deliver} />
          <Badge x={610} y={600} n={5} />
          <Label x={630} y={596}>delivers,</Label>
          <Label x={630} y={612} muted>at least once</Label>

          {/* consuming service */}
          <Panel y={570} h={390} title="Consuming service" />
          <Box x={500} y={640} w={220} h={50} title="Listener" sub="your code" />
          <Box x={210} y={640} w={210} h={50} title="IdempotentConsumer" sub="transactional" mono />
          <Box x={40} y={640} w={110} h={50} title="id cache" sub="optional" dashed />
          <Flow d={PATH.consume} accent={false} />
          <Label x={461} y={653} anchor="middle" mono muted>consume()</Label>
          <Flow d="M 208 665 H 152" accent={false} both />
          <Label x={180} y={653} anchor="middle" muted>checks</Label>

          <Transaction x={170} y={740} w={550} h={160} label="one transaction" />
          <Cylinder x={190} y={775} w={180} h={100} label="inbox_events" mono />
          <Cylinder x={520} y={775} w={180} h={100} label="business tables" />

          {/* 6: record the id, 7: run the operation, both in one transaction */}
          <Flow d={PATH.record} />
          <Badge x={280} y={712} n={6} />
          <Label x={268} y={717} anchor="end">records the id</Label>
          <Flow d={PATH.run} />
          <Badge x={380} y={712} n={7} />
          <Label x={505} y={704} anchor="middle">runs your operation</Label>

          <Label x={40} y={935} muted>A known id: the operation is skipped, nothing is thrown, the message is acknowledged.</Label>

          {motion && TOKENS.map((token) => <Token key={token.path} {...token} />)}
        </svg>
        <figcaption style={{fontSize: '0.9rem', opacity: 0.85, marginTop: '0.5rem'}}>
          <div>① The method saves its data and calls <code>publish()</code>; both commit in one local transaction.</div>
          <div>② A poller for the event type captures a due batch with <code>FOR UPDATE SKIP LOCKED</code> in a
            transaction of its own.</div>
          <div>③ It sends the batch and waits for the broker to acknowledge it.</div>
          <div>④ Acknowledged events become <code>PROCESSED</code>, failed ones return to <code>PENDING</code> with a
            later retry time; once retries are exhausted they move to the DLQ, when it is enabled.</div>
          <div>⑤ The broker delivers the message with the event id in its headers.</div>
          <div>⑥ The transactional idempotent consumer records the event id in <code>inbox_events</code>.</div>
          <div>⑦ It runs your operation in the same transaction, so the id and the effect commit together.</div>
        </figcaption>
      </figure>
    </Motion.Provider>
  );
}
