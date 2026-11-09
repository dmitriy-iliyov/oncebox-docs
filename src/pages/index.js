import {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {Highlight} from 'prism-react-renderer';
import styles from './index.module.css';

const ICONS = {
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  ),
  broker: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </>
  ),
  retry: (
    <>
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 6l-10 7L2 6" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  buoy: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24" />
    </>
  ),
  binoculars: (
    <>
      <circle cx="6" cy="16" r="4" />
      <circle cx="18" cy="16" r="4" />
      <path d="M10 16h4M2.4 14.5 5 5h3l1.5 8.5M21.6 14.5 19 5h-3l-1.5 8.5M9.5 9h5" />
    </>
  ),
};

function Icon({name}) {
  return (
    <span className={styles.featureIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        {ICONS[name]}
      </svg>
    </span>
  );
}

const steps = [
  {
    title: 'Write',
    text: 'Your transaction stores the business change and the event in the outbox table. Both commit, or neither does.',
  },
  {
    title: 'Poll',
    text: 'A poller per event type picks up a batch of due events and locks it, so two instances never take the same events.',
  },
  {
    title: 'Send',
    text: 'The batch goes to Kafka or RabbitMQ and counts as sent once the broker confirms it. Failures are retried; events that run out of retries move to a dead letter queue.',
  },
  {
    title: 'Deliver',
    text: 'The broker delivers the message at least once, and the event id travels with it.',
  },
  {
    title: 'Consume once',
    text: 'The inbox remembers the id together with your operation. When the same event arrives again, it is skipped.',
  },
];

const features = [
  {
    icon: 'link',
    title: 'Atomic with your data',
    text: 'Events are written in the same database transaction as the business change. Both commit, or neither does.',
  },
  {
    icon: 'database',
    title: 'Your database',
    text: 'PostgreSQL 16+, MySQL 8.0.13+ and Oracle 23+, each with a dialect module of its own. The tables can be created on startup or left to your migrations.',
  },
  {
    icon: 'broker',
    title: 'Messaging integration',
    text: 'Apache Kafka 3.7+ and RabbitMQ 3.12+ on both sides: the outbox sends through your template, the inbox deduplicates in your listener.',
  },
  {
    icon: 'retry',
    title: 'At-least-once processing',
    text: 'An event is marked processed only after Kafka acks or RabbitMQ confirms it, and failures are retried with per-type backoff, so your listener gets every event at least once.',
  },
  {
    icon: 'shield',
    title: 'Effectively-once processing',
    text: 'The inbox records event ids in the transaction of your handler, so a redelivered event never changes data twice.',
  },
  {
    icon: 'mail',
    title: 'At-most-once processing',
    text: 'The non-transactional consumer commits the event id before your operation runs, so a side effect such as an email is never repeated.',
  },
  {
    icon: 'inbox',
    title: 'Dead letter queue',
    text: 'Events that exhaust their retries move to a DLQ table atomically and are reviewed and retried through a REST API.',
  },
  {
    icon: 'buoy',
    title: 'Safe under failure',
    text: 'Stuck batches are recovered, a late finalization is fenced off by a lock token, and every timestamp comes from the database clock.',
  },
  {
    icon: 'binoculars',
    title: 'Observable',
    text: 'Micrometer gauges, counters and timers for events, background jobs and the inbox cache, with ready Grafana dashboards.',
  },
];

const heroSnippet = `@Transactional
@OutboxPublish(eventType = "order-created")
public OrderDto create(OrderCreateDto dto) {
    Order order = repository.save(mapper.toEntity(dto));
    return mapper.toDto(order);
}`;

// the hero sits on the brand ground in both themes, so its code is coloured from the brand palette, not the site theme
const heroCodeTheme = {
  plain: {color: '#e4e4e7', backgroundColor: 'transparent'},
  styles: [
    {types: ['comment'], style: {color: '#71717a'}},
    {types: ['keyword', 'builtin'], style: {color: '#a1a1aa'}},
    {types: ['annotation'], style: {color: '#a6d982'}},
    {types: ['string'], style: {color: '#d4d4d8'}},
    {types: ['class-name'], style: {color: '#fafafa'}},
    {types: ['function'], style: {color: '#ffffff'}},
    {types: ['operator'], style: {color: '#a1a1aa'}},
  ],
};

function CopyButton({text}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className={styles.copyButton} onClick={copy} aria-label="Copy code">
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function HeroCode() {
  return (
    <div className={styles.heroCode}>
      <div className={styles.heroCodeBar}>
        <span>OrderService.java</span>
        <CopyButton text={heroSnippet} />
      </div>
      <Highlight code={heroSnippet} language="java" theme={heroCodeTheme}>
        {({tokens, getLineProps, getTokenProps}) => (
          <pre className={styles.heroCodeBody}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({line})}>
                {line.map((token, j) => <span key={j} {...getTokenProps({token})} />)}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

function FrogMark({className}) {
  return <img className={className} src={useBaseUrl('/img/logo.svg')} alt="" aria-hidden="true" />;
}

const REPO_URL = 'https://github.com/dmitriy-iliyov/oncebox';

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

// 3D value noise: a hash per lattice point, smoothly interpolated, so the field changes continuously in space and time
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fade = (t) => t * t * (3 - 2 * t);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

const AURORA_GREENS = [[143, 203, 99], [109, 179, 63], [79, 143, 44], [63, 160, 110]];

function auroraColour(mix) {
  const scaled = Math.min(0.999, Math.max(0, mix)) * (AURORA_GREENS.length - 1);
  const i = Math.floor(scaled), t = scaled - i;
  const a = AURORA_GREENS[i], b = AURORA_GREENS[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// the hero ground: formless green clouds drawn from a noise field on a tiny canvas, stretched and blurred by CSS
function Aurora() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const W = 80, H = 40;
    canvas.width = W;
    canvas.height = H;
    const image = ctx.createImageData(W, H);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seed = Math.random() * 1000;
    let frame = 0;
    let last = 0;
    let elapsed = 0;
    const draw = (time) => {
      const t = seed + time * 0.00016;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const n = 0.65 * noise3(x * 0.07, y * 0.1, t) + 0.35 * noise3(x * 0.16 + 31, y * 0.22, t * 1.6);
          const strength = Math.min(1, Math.max(0, (n - 0.44) / 0.4));
          const [r, g, b] = auroraColour(noise3(x * 0.04 + 77, y * 0.05, t * 0.7));
          const k = (y * W + x) * 4;
          image.data[k] = r;
          image.data[k + 1] = g;
          image.data[k + 2] = b;
          image.data[k + 3] = strength * strength * 105;
        }
      }
      ctx.putImageData(image, 0, 0);
    };
    // time advances only while frames are drawn, so a tab coming back from the background continues where it stopped
    const loop = (now) => {
      const step = now - last;
      if (step > 33) {
        elapsed += Math.min(step, 100);
        draw(elapsed);
        last = now;
      }
      frame = requestAnimationFrame(loop);
    };
    if (still) {
      draw(0);
    } else {
      frame = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className={styles.aurora} aria-hidden="true" />;
}

function Hero() {
  return (
    <header className={styles.hero}>
      <Aurora />
      <div className={clsx('container', styles.heroInner)}>
        <div className={styles.heroMain}>
          <Link className={styles.openSource} href={`${REPO_URL}/blob/main/LICENSE`}>
            <span className={styles.openSourceDot} aria-hidden="true" />
            Open source · Apache 2.0
          </Link>
          <div className={styles.brand}>
            <FrogMark className={styles.brandMark} />
            <Heading as="h1" className={styles.brandName}>oncebox</Heading>
          </div>
          <p className={styles.heroTagline}>Transactional Outbox and Inbox for Spring Boot</p>
          <div className={styles.buttons}>
            <Link className={clsx('button button--lg', styles.buttonPrimary)} to="/docs/quickstart/">
              Get started
            </Link>
            <Link className={clsx('button button--lg', styles.buttonGhost, styles.buttonGitHub)} href={REPO_URL}>
              <GitHubMark />
              GitHub
            </Link>
          </div>
        </div>
        <HeroCode />
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <Layout
      title="Transactional Outbox and Inbox for Spring Boot"
      description="oncebox publishes events reliably from a Spring Boot service through a polled outbox table and deduplicates them on the receiving side through an inbox.">
      <Hero />
      <main>
        <section className={styles.steps}>
          <div className="container">
            <Heading as="h2" className={styles.sectionTitle}>From your transaction to your listener</Heading>
            <ol className={styles.stepList}>
              {steps.map((step, i) => (
                <li key={step.title} className={styles.step}>
                  <span className={styles.stepNumber}>{i + 1}</span>
                  <Heading as="h3" className={styles.stepTitle}>{step.title}</Heading>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className={styles.features}>
          <div className="container">
            <Heading as="h2" className={styles.sectionTitle}>What's in the box</Heading>
            <div className={styles.featureGrid}>
              {features.map((f) => (
                <div key={f.title} className={styles.feature}>
                  <div className={styles.featureTitle}>
                    <Icon name={f.icon} />
                    <Heading as="h3">{f.title}</Heading>
                  </div>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
