import type { Marker } from './model';

const m = (server: string, angle: number, id = server): Marker => ({ id, server, angle });

/** Four servers spread roughly evenly. */
export const BASE4: Marker[] = [m('A', 40), m('B', 130), m('C', 215), m('D', 300)];

/** E joins between B and C. */
export const WITH_E: Marker[] = [...BASE4, m('E', 170)];

/** B is down and still drawn, about to be removed. */
export const B_FAILING: Marker[] = WITH_E.map((x) => (x.server === 'B' ? { ...x, failing: true } : x));

export const WITHOUT_B: Marker[] = WITH_E.filter((x) => x.server !== 'B');

/** Three servers that hashed close together, so A owns most of the ring. */
export const UNEVEN3: Marker[] = [m('A', 30), m('B', 95), m('C', 150)];

/** The same three servers with four virtual nodes each. */
export const VNODES3: Marker[] = (
  [
    ['A', 12], ['B', 41], ['C', 70], ['A', 101], ['B', 128], ['C', 158],
    ['B', 189], ['A', 219], ['C', 246], ['B', 277], ['A', 306], ['C', 335],
  ] as const
).map(([s, a], i) => m(s, a, `${s}#${i}`));

/** Four servers with two virtual nodes each, laid out so a walk hits B twice in a row. */
export const REPLICA_RING: Marker[] = (
  [
    ['A', 20], ['B', 70], ['B', 100], ['C', 150], ['D', 200], ['A', 245], ['C', 290], ['D', 335],
  ] as const
).map(([s, a], i) => m(s, a, `${s}#${i}`));
