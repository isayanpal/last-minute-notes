/**
 * Isometric machine replicas for the flow engine: servers, databases, laptops and so on.
 * Same footprint and API as IsoCube, so a node can swap its cube for a machine with no layout change.
 * Shapes are drawn in local units where the cube half width is 20, then scaled to the node size.
 */
import { shade } from './iso';

export type MachineShape =
  | 'server'
  | 'db'
  | 'laptop'
  | 'phone'
  | 'cache'
  | 'queue'
  | 'lb'
  | 'gateway'
  | 'cloud'
  | 'globe'
  | 'disk';

type Pt = [number, number, number];

/** Iso projection: ground coords (a, b) and height z to screen. Front corner is max a and max b. */
const P = (a: number, b: number, z: number): [number, number] => [a - b, (a + b) * 0.58 - z];
const pts = (list: Pt[]) => list.map(([a, b, z]) => P(a, b, z).map((v) => v.toFixed(2)).join(',')).join(' ');

type Look = { base: string; edge: string; sw: number };

function Prism({ a0, a1, b0, b1, z0, z1, color, look, top }: { a0: number; a1: number; b0: number; b1: number; z0: number; z1: number; color: string; look: Look; top?: string }) {
  const common = { stroke: look.edge, strokeWidth: look.sw, strokeLinejoin: 'round' as const };
  return (
    <g>
      <polygon points={pts([[a0, b1, z1], [a1, b1, z1], [a1, b1, z0], [a0, b1, z0]])} fill={shade(color, -0.25)} {...common} />
      <polygon points={pts([[a1, b0, z1], [a1, b1, z1], [a1, b1, z0], [a1, b0, z0]])} fill={shade(color, -0.45)} {...common} />
      <polygon points={pts([[a0, b0, z1], [a1, b0, z1], [a1, b1, z1], [a0, b1, z1]])} fill={top ?? shade(color, 0.18)} {...common} />
    </g>
  );
}

/** A line drawn on the ground-plane-aligned coordinates. */
function Seg({ from, to, stroke, w = 1 }: { from: Pt; to: Pt; stroke: string; w?: number }) {
  const [x1, y1] = P(...from);
  const [x2, y2] = P(...to);
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={w} strokeLinecap="round" />;
}

function Dot({ at, r = 1.3, fill }: { at: Pt; r?: number; fill: string }) {
  const [x, y] = P(...at);
  return <circle cx={x} cy={y} r={r} fill={fill} />;
}

const LED = '#6ee7a0';

function Server({ color, look, led }: { color: string; look: Look; led: string }) {
  const dark = shade(color, -0.75);
  return (
    <g>
      <Prism a0={-8} a1={8} b0={-7} b1={7} z0={0} z1={19} color={color} look={look} />
      {[3.5, 8.5, 13.5].map((z) => (
        <g key={z}>
          <Seg from={[-6, 7, z + 2.2]} to={[6, 7, z + 2.2]} stroke={dark} w={0.9} />
          <Seg from={[-6, 7, z]} to={[1, 7, z]} stroke={dark} w={1.6} />
          <Dot at={[4, 7, z]} fill={led} />
        </g>
      ))}
    </g>
  );
}

function Database({ color, look }: { color: string; look: Look }) {
  const r = 7.6;
  const rx = r * 1.414;
  const ry = r * 0.82;
  const h = 18;
  const body = shade(color, -0.3);
  const band = (z: number) => `M${-rx},${-z} A${rx},${ry} 0 0 0 ${rx},${-z}`;
  return (
    <g>
      <path d={`M${-rx},${-h} V0 A${rx},${ry} 0 0 0 ${rx},0 V${-h} Z`} fill={body} stroke={look.edge} strokeWidth={look.sw} />
      <path d={band(6)} fill="none" stroke={look.edge} strokeWidth={look.sw} />
      <path d={band(12)} fill="none" stroke={look.edge} strokeWidth={look.sw} />
      <ellipse cx={0} cy={-h} rx={rx} ry={ry} fill={shade(color, 0.18)} stroke={look.edge} strokeWidth={look.sw} />
    </g>
  );
}

function Laptop({ color, look }: { color: string; look: Look }) {
  const bezel = shade(color, -0.7);
  return (
    <g>
      <polygon points={pts([[-10, -8, 2.5], [10, -8, 2.5], [10, -8, 19], [-10, -8, 19]])} fill={bezel} stroke={look.edge} strokeWidth={look.sw} strokeLinejoin="round" />
      <polygon points={pts([[-8.4, -8, 4.5], [8.4, -8, 4.5], [8.4, -8, 17.2], [-8.4, -8, 17.2]])} fill={shade(color, -0.15)} opacity={0.85} />
      <Prism a0={-10} a1={10} b0={-8} b1={8} z0={0} z1={2.5} color={color} look={look} />
    </g>
  );
}

function Phone({ color, look }: { color: string; look: Look }) {
  return (
    <g>
      <Prism a0={-2.5} a1={2.5} b0={-8} b1={8} z0={0} z1={20} color={shade(color, -0.55)} look={look} />
      <polygon points={pts([[2.5, -6.8, 18.2], [2.5, 6.8, 18.2], [2.5, 6.8, 2.8], [2.5, -6.8, 2.8]])} fill={shade(color, -0.1)} opacity={0.85} />
    </g>
  );
}

function Chip({ color, look }: { color: string; look: Look }) {
  const pin = shade(color, 0.55);
  return (
    <g>
      {[-6, -2, 2, 6].map((v) => (
        <g key={v}>
          <Seg from={[v, 9, 1.4]} to={[v, 12.5, 1.4]} stroke={pin} w={1.6} />
          <Seg from={[9, v, 1.4]} to={[12.5, v, 1.4]} stroke={pin} w={1.6} />
        </g>
      ))}
      <Prism a0={-9} a1={9} b0={-9} b1={9} z0={0} z1={5} color={color} look={look} />
      <Prism a0={-4.5} a1={4.5} b0={-4.5} b1={4.5} z0={5} z1={8.5} color={shade(color, 0.25)} look={look} />
    </g>
  );
}

function Queue({ color, look }: { color: string; look: Look }) {
  return (
    <g>
      <Prism a0={-10} a1={10} b0={-6} b1={6} z0={0} z1={4} color={shade(color, -0.35)} look={look} />
      {[-6.5, 0, 6.5].map((a) => (
        <Prism key={a} a0={a - 2.6} a1={a + 2.6} b0={-3} b1={3} z0={4} z1={10.5} color={color} look={look} />
      ))}
    </g>
  );
}

function Balancer({ color, look }: { color: string; look: Look }) {
  const mark = shade(color, 0.65);
  const z = 8;
  const dark = shade(color, -0.75);
  return (
    <g>
      <Prism a0={-10} a1={10} b0={-6.5} b1={6.5} z0={0} z1={z} color={color} look={look} />
      <Seg from={[-8, 0, z]} to={[-1, 0, z]} stroke={mark} w={1.6} />
      <Seg from={[-1, 0, z]} to={[8, -4, z]} stroke={mark} w={1.6} />
      <Seg from={[-1, 0, z]} to={[8, 0, z]} stroke={mark} w={1.6} />
      <Seg from={[-1, 0, z]} to={[8, 4, z]} stroke={mark} w={1.6} />
      {[-6, 0, 6].map((a) => (
        <Dot key={a} at={[a, 6.5, 3.6]} r={1.4} fill={dark} />
      ))}
    </g>
  );
}

function Gate({ color, look }: { color: string; look: Look }) {
  return (
    <g>
      <Prism a0={-10} a1={-6} b0={-3} b1={3} z0={0} z1={16} color={color} look={look} />
      <Prism a0={6} a1={10} b0={-3} b1={3} z0={0} z1={16} color={color} look={look} />
      <Prism a0={-10} a1={10} b0={-3} b1={3} z0={16} z1={20} color={shade(color, 0.1)} look={look} />
      <Dot at={[0, 3, 18]} r={1.5} fill="#f5d547" />
    </g>
  );
}

function Cloud({ color, look }: { color: string; look: Look }) {
  const fill = shade(color, 0.12);
  return (
    <g>
      <ellipse cx={0} cy={-3} rx={13} ry={4.6} fill="rgba(0,0,0,0.3)" />
      <g fill={fill} stroke={look.edge} strokeWidth={look.sw}>
        <circle cx={-8} cy={-13} r={6.5} />
        <circle cx={-1} cy={-19} r={8.5} />
        <circle cx={8} cy={-14} r={6.5} />
        <rect x={-8.5} y={-13} width={17} height={7} />
      </g>
      <g fill={fill}>
        <circle cx={-8} cy={-13} r={5.6} />
        <circle cx={-1} cy={-19} r={7.6} />
        <circle cx={8} cy={-14} r={5.6} />
        <rect x={-8.5} y={-13.4} width={17} height={6.8} />
      </g>
    </g>
  );
}

function Globe({ color, look }: { color: string; look: Look }) {
  const line = shade(color, 0.5);
  return (
    <g>
      <ellipse cx={0} cy={2} rx={12} ry={4.2} fill="none" stroke={look.edge} strokeWidth={look.sw} />
      <circle cx={0} cy={-12} r={11.5} fill={shade(color, -0.2)} stroke={look.edge} strokeWidth={look.sw} />
      <ellipse cx={0} cy={-12} rx={11.5} ry={4} fill="none" stroke={line} strokeWidth={0.9} />
      <ellipse cx={0} cy={-12} rx={4.6} ry={11.5} fill="none" stroke={line} strokeWidth={0.9} />
      <path d="M-8 -19 A11.5 11.5 0 0 1 3 -22.8" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

function Disk({ color, look }: { color: string; look: Look }) {
  const plate = shade(color, -0.6);
  const [cx, cy] = P(0, 0, 7);
  return (
    <g>
      <Prism a0={-9} a1={9} b0={-9} b1={9} z0={0} z1={7} color={color} look={look} />
      <ellipse cx={cx} cy={cy} rx={9.6} ry={5.6} fill={plate} stroke={look.edge} strokeWidth={look.sw} />
      <ellipse cx={cx} cy={cy} rx={3.4} ry={2} fill={shade(color, 0.3)} />
      <Seg from={[6, -6, 7]} to={[-1, 1, 7]} stroke={shade(color, 0.6)} w={1.3} />
    </g>
  );
}

/** Machine whose base centre sits on (x, y). `size` is the same half width an IsoCube takes. */
export function Machine({ shape, x, y, color, size = 20, failing, className }: { shape: MachineShape; x: number; y: number; color: string; size?: number; failing?: boolean; className?: string }) {
  const u = size / 20;
  const base = failing ? '#5a2424' : color;
  const look: Look = { base, edge: failing ? '#e24b4a' : shade(color, -0.55), sw: 1.2 / u };
  const led = failing ? '#e24b4a' : LED;
  const t = size * 0.58;
  let body;
  switch (shape) {
    case 'server': body = <Server color={base} look={look} led={led} />; break;
    case 'db': body = <Database color={base} look={look} />; break;
    case 'laptop': body = <Laptop color={base} look={look} />; break;
    case 'phone': body = <Phone color={base} look={look} />; break;
    case 'cache': body = <Chip color={base} look={look} />; break;
    case 'queue': body = <Queue color={base} look={look} />; break;
    case 'lb': body = <Balancer color={base} look={look} />; break;
    case 'gateway': body = <Gate color={base} look={look} />; break;
    case 'cloud': body = <Cloud color={base} look={look} />; break;
    case 'globe': body = <Globe color={base} look={look} />; break;
    case 'disk': body = <Disk color={base} look={look} />; break;
  }
  return (
    <g className={className} style={{ transformOrigin: `${x}px ${y}px` }}>
      <ellipse cx={x} cy={y + t * 0.7} rx={size * 1.15} ry={t * 0.9} fill="rgba(0,0,0,0.45)" />
      <g transform={`translate(${x} ${y}) scale(${u})`}>{body}</g>
      {failing ? (
        <text x={x} y={y - size * 1.5 - 10} textAnchor="middle" fontSize="16" fontWeight={700} fill="#e24b4a">
          ×
        </text>
      ) : null}
    </g>
  );
}
