import React from 'react';

export const ACCENT = 'var(--ifm-color-primary)';
const SANS = 'var(--ifm-font-family-base)';
const MONO = 'var(--ifm-font-family-monospace)';

export const STATE_W = 150;
export const STATE_H = 44;

// marker ids are prefixed per diagram, so two diagrams on one page never share them
export function Markers({id}) {
  return (
    <defs>
      <marker id={`${id}-accent`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"
              orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={ACCENT} />
      </marker>
      <marker id={`${id}-muted`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7"
              orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" fillOpacity={0.6} />
      </marker>
    </defs>
  );
}

export function State({x, y, name, terminal}) {
  return (
    <g>
      <rect x={x} y={y} width={STATE_W} height={STATE_H} rx={22} fill="currentColor"
            fillOpacity={terminal ? 0.02 : 0.07} stroke="currentColor" strokeOpacity={terminal ? 0.45 : 0.6}
            strokeDasharray={terminal ? '5 4' : undefined} />
      <text x={x + STATE_W / 2} y={y + STATE_H / 2 + 5} textAnchor="middle" fontSize={14} fontWeight={600}
            fontFamily={terminal ? SANS : MONO} fill="currentColor" fillOpacity={terminal ? 0.75 : 1}>{name}</text>
    </g>
  );
}

export function Cylinder({x, y, w, h, label}) {
  const ry = 8;
  return (
    <g>
      <path d={`M ${x} ${y + ry} A ${w / 2} ${ry} 0 0 1 ${x + w} ${y + ry} V ${y + h - ry} A ${w / 2} ${ry} 0 0 1 ${x} ${y + h - ry} Z`}
            fill="currentColor" fillOpacity={0.07} stroke="currentColor" strokeOpacity={0.55} />
      <path d={`M ${x} ${y + ry} A ${w / 2} ${ry} 0 0 0 ${x + w} ${y + ry}`}
            fill="none" stroke="currentColor" strokeOpacity={0.55} />
      <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" fontSize={13} fontWeight={600} fontFamily={MONO}
            fill="currentColor">{label}</text>
    </g>
  );
}

export function Flow({markers, d, accent, dashed, both}) {
  const marker = `url(#${markers}-${accent ? 'accent' : 'muted'})`;
  return (
    <path d={d} fill="none" stroke={accent ? ACCENT : 'currentColor'} strokeOpacity={accent ? 1 : 0.6}
          strokeWidth={accent ? 2 : 1.5} strokeDasharray={dashed ? '5 4' : undefined}
          markerEnd={marker} markerStart={both ? marker : undefined} />
  );
}

export function Label({x, y, anchor = 'middle', children, muted, mono}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={13} fontFamily={mono ? MONO : SANS} fill="currentColor"
          fillOpacity={muted ? 0.7 : 0.92}>{children}</text>
  );
}

export function Diagram({claim, viewBox, caption, children}) {
  return (
    <figure style={{margin: '1.5rem 0'}}>
      <svg viewBox={viewBox} role="img" aria-label={claim}
           style={{width: '100%', height: 'auto', color: 'var(--ifm-font-color-base)'}}>
        {children}
      </svg>
      <figcaption style={{fontSize: '0.9rem', opacity: 0.85, marginTop: '0.5rem'}}>{caption}</figcaption>
    </figure>
  );
}
