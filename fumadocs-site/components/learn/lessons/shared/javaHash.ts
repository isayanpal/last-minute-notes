/*
 * Java's HashMap indexing, reproduced with 32 bit integer maths so the lessons show real bucket numbers.
 * String.hashCode is s[0]*31^(n-1) + ... + s[n-1], spread() is h ^ (h >>> 16), the index is (n - 1) & hash.
 */

export const stringHash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
};

export const spread = (h: number): number => (h ^ (h >>> 16)) | 0;

export const indexFor = (hash: number, capacity: number): number => spread(hash) & (capacity - 1);

/** Objects.hash(a, b) is 31 * (31 * 1 + a) + b. */
export const objectsHash2 = (a: number, b: number): number => (Math.imul(31, (Math.imul(31, 1) + a) | 0) + b) | 0;

/** A tiny HashMap that only tracks keys: chained buckets, doubles at size > 0.75 * capacity. */
export class SimMap {
  capacity = 16;
  size = 0;
  table: string[][] = Array.from({ length: 16 }, () => []);

  put(key: string): { index: number; resized: boolean } {
    const index = indexFor(stringHash(key), this.capacity);
    this.table[index].push(key);
    this.size++;
    const resized = this.size > this.capacity * 0.75;
    if (resized) this.resize();
    return { index, resized };
  }

  private resize() {
    const old = this.table;
    this.capacity *= 2;
    this.table = Array.from({ length: this.capacity }, () => []);
    for (const bucket of old) for (const k of bucket) this.table[indexFor(stringHash(k), this.capacity)].push(k);
  }
}
