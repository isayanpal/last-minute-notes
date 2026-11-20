/**
 * Pure model for the consistent hashing lesson.
 * Angles are degrees on the ring, 0 at the top, increasing clockwise (0..360 stands for 0..2^32).
 */

export type Marker = {
  /** Unique per ring position, e.g. "A" or "A#2". */
  id: string;
  server: string;
  angle: number;
  failing?: boolean;
};

export type Lookup = {
  angle: number;
  /** How many distinct servers to walk to (1 = plain lookup, 3 = replication). */
  replicas?: number;
};

export type RingState = {
  mode: 'ring';
  markers: Marker[];
  showKeys: boolean;
  showArcs: boolean;
  /** Ring before the change, used to count and highlight moved keys. */
  baseline?: Marker[];
  lookups?: Lookup[];
  /** Draw a client in the middle that sends the lookups. */
  client?: boolean;
  /** Draw small vnode cubes instead of full size servers. */
  small?: boolean;
  note?: { text: string; tone?: 'neutral' | 'accent' | 'bad' };
};

export type ModState = {
  mode: 'mod';
  n: number;
  baselineN?: number;
  note?: { text: string; tone?: 'neutral' | 'accent' | 'bad' };
};

export type HashState = RingState | ModState;

/** Deterministic PRNG so keys land in the same spots on server and client. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEY_COUNT = 24;

/** Keys spread around the ring with a little jitter so they look hashed, not even. */
export const KEYS: { id: number; angle: number; hash: number }[] = (() => {
  const rnd = mulberry32(7);
  return Array.from({ length: KEY_COUNT }, (_, i) => {
    const angle = (((i + 0.5) / KEY_COUNT) * 360 + (rnd() - 0.5) * 11 + 360) % 360;
    return { id: i, angle, hash: Math.floor(rnd() * 1_000_003) };
  });
})();

export function sortMarkers(markers: Marker[]): Marker[] {
  return [...markers].sort((a, b) => a.angle - b.angle);
}

/** First marker clockwise from `angle` (inclusive), wrapping past 360. */
export function ownerMarker(markers: Marker[], angle: number): Marker | undefined {
  const live = sortMarkers(markers.filter((m) => !m.failing));
  if (!live.length) return undefined;
  return live.find((m) => m.angle >= angle) ?? live[0];
}

export function ownerOf(markers: Marker[], angle: number): string | undefined {
  return ownerMarker(markers, angle)?.server;
}

/** Clockwise distance from a to b in degrees, in (0, 360]. */
export function cw(a: number, b: number): number {
  const d = (b - a + 360) % 360;
  return d === 0 ? 360 : d;
}

/** Arc owned by each marker: from the previous marker (exclusive) to itself. */
export function arcs(markers: Marker[]): { marker: Marker; from: number; to: number }[] {
  const live = sortMarkers(markers.filter((m) => !m.failing));
  if (live.length === 0) return [];
  if (live.length === 1) return [{ marker: live[0], from: live[0].angle, to: live[0].angle + 360 }];
  return live.map((m, i) => {
    const prev = live[(i - 1 + live.length) % live.length];
    return { marker: m, from: prev.angle, to: prev.angle + cw(prev.angle, m.angle) };
  });
}

/** Share of the ring owned by each physical server, 0..1. */
export function shares(markers: Marker[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of arcs(markers)) {
    out.set(a.marker.server, (out.get(a.marker.server) ?? 0) + (a.to - a.from) / 360);
  }
  return out;
}

/**
 * Walk clockwise from `angle` collecting ring markers until `replicas` distinct servers are found.
 * Markers that belong to an already chosen server are returned with `skipped: true`.
 */
export function walk(markers: Marker[], angle: number, replicas = 1) {
  const live = sortMarkers(markers.filter((m) => !m.failing));
  const servers = new Set(live.map((m) => m.server));
  const want = Math.min(replicas, servers.size);
  const start = live.findIndex((m) => m.angle >= angle);
  const first = start === -1 ? 0 : start;
  const hops: { marker: Marker; skipped: boolean; distance: number }[] = [];
  const picked = new Set<string>();
  for (let i = 0; i < live.length && picked.size < want; i++) {
    const m = live[(first + i) % live.length];
    const skipped = picked.has(m.server);
    if (!skipped) picked.add(m.server);
    hops.push({ marker: m, skipped, distance: (m.angle - angle + 360) % 360 });
  }
  return hops;
}

export function modOwner(hash: number, n: number): number {
  return hash % n;
}

export const MOD_SERVERS = ['A', 'B', 'C', 'D', 'E'];
