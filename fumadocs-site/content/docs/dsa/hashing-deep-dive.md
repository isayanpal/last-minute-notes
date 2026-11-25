---
title: "Hashing Deep Dive"
description: "Collision handling with chaining and open addressing, resizing and rehashing with amortized cost, and Bloom filters with sizing math, dry runs, pitfalls, and JavaScript and Java code."
---

# 📘 Hashing Deep Dive

A hash map answers "is this key here, and what is its value?" in O(1) on average.
This page opens the box: what happens when two keys land in the same slot, why the table must grow, and how a probabilistic structure called a Bloom filter trades a little certainty for a lot of memory.
Each section has recognition signals, a core idea, a worked problem with a dry run, pitfalls, and a **Java Implementation** subsection.
JavaScript and Java code is included, and every snippet on this page was executed against test cases.
Java conventions: all methods are `static` members of one `Solution` class, `import java.util.*;` is assumed, helper classes are top-level package-private classes in the same file, and the trailing `//` comments show a sample call and its result.
The everyday use of maps for counting and lookup is in [Prefix Sum and Hash Map](/docs/dsa/pattern-playbook#61-prefix-sum-and-hash-map), and the costs are in the [complexity cheat sheet](/docs/dsa/pattern-playbook#5-complexity-cheat-sheet).
The bit array in the Bloom filter works like the [Bitset](/docs/dsa/memory-and-linear-structures#4-bitsets).

## Table of Contents

1. [Collision Handling](#1-collision-handling)
2. [Resizing and Rehashing](#2-resizing-and-rehashing)
3. [Bloom Filters](#3-bloom-filters)
4. [Java Pitfalls](#4-java-pitfalls)
5. [Quick Recap](#5-quick-recap)

---

## 1. Collision Handling

### 1.1 When to Use

- An interviewer asks "how does a hash map work inside?" or "what happens when two keys hash to the same index?".
- You are asked to **design a hash map or hash set** from scratch (LeetCode 705 and 706).
- A hash-based solution is slower than expected, and you suspect many keys share a bucket.
- You need to choose between chaining and open addressing for a memory or cache constraint.

### 1.2 Core Idea

A hash table is an array of **buckets**.
A **hash function** turns a key into an integer, and the bucket index is that integer modulo the array size.

```text
index = hash(key) mod capacity
```

There are more possible keys than buckets, so two different keys sometimes get the same index.
That is a **collision**, and it cannot be avoided, only handled.
A good hash function spreads keys evenly, so collisions stay rare and short.

**Load factor** `alpha = size / capacity` measures how full the table is.
Almost every cost below is a function of `alpha`.

| Strategy | Where a colliding key goes | Delete | Cost at load `alpha` |
| --- | --- | --- | --- |
| **Chaining** | Into a list kept in the same bucket | Remove from the list | About `1 + alpha` steps, works above `alpha = 1` |
| **Linear probing** | The next free slot: `i, i+1, i+2, ...` | Leave a **tombstone** marker | Unsuccessful search near `0.5 * (1 + 1 / (1 - alpha)^2)` |
| **Quadratic probing** | Slots `i, i+1, i+4, i+9, ...` | Tombstone | Avoids long runs, can miss free slots |
| **Double hashing** | Step size from a second hash: `i + j * h2(key)` | Tombstone | Closest to ideal probing |

**Chaining** is simple and degrades gracefully.
**Open addressing** keeps everything in one array, which is friendlier to the CPU cache and uses no per-node pointers, but must stay below `alpha = 1`.

Linear probing suffers from **primary clustering**: runs of occupied slots grow, and a key that hashes anywhere into a run must walk to its end.
At `alpha = 0.5` an unsuccessful search averages 2.5 probes, and at `alpha = 0.75` it is already 8.5.
That is why open addressing tables resize early.

**Why tombstones.**
A probe sequence ends at the first empty slot, which means "the key is not here".
If delete marked a slot empty, keys that had been pushed past it would become unreachable.
A tombstone says "something was here, keep probing", and an insert may reuse it.

### 1.3 Problem: Design a Hash Map

Both versions below map integer keys to values.
First, the hash and the index helper shared by every example in this page.
The string recipe is the same one `String.hashCode` uses in Java.

```js
function hashKey(key) {
  if (typeof key === "number") return key | 0;
  const s = String(key);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

function bucketIndex(key, capacity) {
  return ((hashKey(key) % capacity) + capacity) % capacity;   // never negative
}

hashKey("hi"); // 3329
hashKey(42); // 42
bucketIndex(-7, 5); // 3
bucketIndex("hi", 5); // 4
```

`3329` is `104 * 31 + 105`, the codes of `h` and `i`.
The `+ capacity` step matters: `-7 % 5` is `-2` in JavaScript, which is not a valid array index.

**Version one: chaining.**

```js
class ChainedMap {
  constructor(capacity = 8) {
    this.capacity = capacity;
    this.buckets = Array.from({ length: capacity }, () => []);
    this.size = 0;
  }

  put(key, value) {
    const bucket = this.buckets[bucketIndex(key, this.capacity)];
    for (const entry of bucket) {
      if (entry[0] === key) {
        entry[1] = value;                       // key exists: overwrite
        return;
      }
    }
    bucket.push([key, value]);
    this.size++;
  }

  get(key) {
    const bucket = this.buckets[bucketIndex(key, this.capacity)];
    for (const entry of bucket) {
      if (entry[0] === key) return entry[1];
    }
    return undefined;
  }

  delete(key) {
    const bucket = this.buckets[bucketIndex(key, this.capacity)];
    const i = bucket.findIndex(entry => entry[0] === key);
    if (i < 0) return false;
    bucket.splice(i, 1);
    this.size--;
    return true;
  }

  bucketSizes() {
    return this.buckets.map(bucket => bucket.length);
  }
}

const map = new ChainedMap(5);
for (const k of [10, 15, 20, 7, 12]) map.put(k, k * 10);
map.bucketSizes(); // [3,0,2,0,0]
map.get(20); // 200
map.get(99); // undefined
map.delete(15); // true
map.bucketSizes(); // [2,0,2,0,0]
map.size; // 4
```

Dry run with capacity 5 (index is `key mod 5`):

| Key | Index | Bucket contents after insert | Collision? |
| --- | --- | --- | --- |
| 10 | 0 | `0: [10]` | no |
| 15 | 0 | `0: [10, 15]` | yes, joins the chain |
| 20 | 0 | `0: [10, 15, 20]` | yes, chain of 3 |
| 7 | 2 | `2: [7]` | no |
| 12 | 2 | `2: [7, 12]` | yes |

`get(20)` hashes to bucket 0 and scans three entries.
If every key landed in one bucket the structure would be a linked list, and all operations would cost O(n).

**Version two: open addressing with linear probing.**
Each slot is `EMPTY`, `FULL`, or `DELETED` (a tombstone).

```js
const EMPTY = 0;
const FULL = 1;
const DELETED = 2;

class ProbingMap {
  constructor(capacity = 8) {
    this.capacity = capacity;
    this.keys = new Array(capacity);
    this.values = new Array(capacity);
    this.state = new Uint8Array(capacity);
    this.size = 0;
  }

  indexOf(key) {
    let i = bucketIndex(key, this.capacity);
    for (let probes = 0; probes < this.capacity; probes++) {
      if (this.state[i] === EMPTY) return -1;                 // end of the probe run
      if (this.state[i] === FULL && this.keys[i] === key) return i;
      i = (i + 1) % this.capacity;                            // skip FULL others and tombstones
    }
    return -1;
  }

  get(key) {
    const i = this.indexOf(key);
    return i < 0 ? undefined : this.values[i];
  }

  put(key, value) {
    let i = bucketIndex(key, this.capacity);
    let reusable = -1;                                        // first tombstone seen
    for (let probes = 0; probes < this.capacity; probes++) {
      if (this.state[i] === FULL && this.keys[i] === key) {
        this.values[i] = value;
        return true;
      }
      if (this.state[i] === DELETED && reusable < 0) reusable = i;
      if (this.state[i] === EMPTY) break;
      i = (i + 1) % this.capacity;
    }
    const slot = reusable >= 0 ? reusable : (this.state[i] === EMPTY ? i : -1);
    if (slot < 0) return false;                               // table is full
    this.keys[slot] = key;
    this.values[slot] = value;
    this.state[slot] = FULL;
    this.size++;
    return true;
  }

  delete(key) {
    const i = this.indexOf(key);
    if (i < 0) return false;
    this.state[i] = DELETED;                                  // tombstone, not EMPTY
    this.keys[i] = undefined;
    this.values[i] = undefined;
    this.size--;
    return true;
  }
}

const probing = new ProbingMap(7);
for (const k of [10, 17, 24, 3]) probing.put(k, k * 10);
probing.indexOf(10); // 3
probing.indexOf(17); // 4
probing.indexOf(24); // 5
probing.indexOf(3); // 6
probing.delete(17); // true
probing.get(24); // 240
probing.put(31, 310); // true
probing.indexOf(31); // 4
```

Dry run with capacity 7 (index is `key mod 7`):

| Operation | Probe sequence | Result |
| --- | --- | --- |
| put 10 | slot 3 is empty | stored at 3 |
| put 17 | 3 full, 4 empty | stored at 4 |
| put 24 | 3, 4 full, 5 empty | stored at 5 |
| put 3 | 3, 4, 5 full, 6 empty | stored at 6 (3 mod 7 is 3, so it was displaced three slots) |
| delete 17 | find at 4 | slot 4 becomes a **tombstone** |
| get 24 | 3 full (not 24), 4 tombstone (keep going), 5 match | `240` |
| put 31 | 3 full, 4 tombstone (remember it), 5 full, 6 full, 0 empty | reuses slot 4 |

Had `delete` marked slot 4 as `EMPTY`, then `get(24)` would stop at slot 4 and wrongly report "not found".
The key 31 also proves a subtle point: `put` keeps probing past the tombstone until it reaches an empty slot, so it first confirms the key is not already stored further along, and only then reuses the tombstone.

### 1.4 Extra Variants

**Hash set** (LeetCode 705) is the same structure without values.
Store only keys, or store `true` as the value.

**Counting collisions to pick a better hash.**
`bucketSizes()` above is the diagnostic.
A good hash gives bucket sizes close to the load factor, and one huge bucket means the hash function or the keys have a pattern, such as every key being a multiple of the capacity.

**Group anagrams as a collision problem.**
Two words are anagrams exactly when they should collide.
The sorted word, or a 26-count signature, is a hash function chosen so that anagrams share a key.

**Hash flooding.**
If an attacker knows the hash function, they can send keys that all collide and turn O(1) lookups into O(n), which is a denial-of-service attack.
Languages defend with a random per-process seed and with tree-shaped buckets once a chain gets long.

### 1.5 Pitfalls

- **A bad hash function.** `key % 10` on keys that are all multiples of 10 puts everything in one bucket.
  Prefer a capacity that is a prime or a power of two combined with a mixing step, as real libraries do.
- **Negative index.** `%` keeps the sign of the dividend in JavaScript and Java.
  Use `Math.floorMod(hash, capacity)` in Java, or the `((h % n) + n) % n` form shown above.
- **Marking a deleted slot `EMPTY` in open addressing.** Use a tombstone.
- **Never reusing tombstones.** The table fills with them, and searches slow to O(n) even though `size` is small.
  Reuse them on insert and rebuild the table when there are too many.
- **Mutating a key after inserting it.** The stored index was computed from the old hash, so the entry becomes unreachable.
  Keys should be immutable, or at least their hashed fields should be.
- **Breaking `equals` and `hashCode` in Java.** Equal objects must return equal hash codes.
  Override both or neither.
- **Probing an exactly full table forever.** Cap the number of probes at `capacity`, as the code above does.

### 1.6 Java Implementation

```java
class ChainedMap {
    private final List<List<int[]>> buckets = new ArrayList<>();
    private final int capacity;
    int size = 0;

    ChainedMap(int capacity) {
        this.capacity = capacity;
        for (int i = 0; i < capacity; i++) buckets.add(new ArrayList<>());
    }

    private List<int[]> bucketFor(int key) {
        return buckets.get(Math.floorMod(Integer.hashCode(key), capacity));
    }

    void put(int key, int value) {
        List<int[]> bucket = bucketFor(key);
        for (int[] entry : bucket) {
            if (entry[0] == key) {
                entry[1] = value;
                return;
            }
        }
        bucket.add(new int[]{key, value});
        size++;
    }

    Integer get(int key) {
        for (int[] entry : bucketFor(key)) {
            if (entry[0] == key) return entry[1];
        }
        return null;
    }

    boolean delete(int key) {
        List<int[]> bucket = bucketFor(key);
        for (int i = 0; i < bucket.size(); i++) {
            if (bucket.get(i)[0] == key) {
                bucket.remove(i);
                size--;
                return true;
            }
        }
        return false;
    }

    List<Integer> bucketSizes() {
        List<Integer> out = new ArrayList<>();
        for (List<int[]> bucket : buckets) out.add(bucket.size());
        return out;
    }
}
```

```java
class ProbingMap {
    private static final byte EMPTY = 0;
    private static final byte FULL = 1;
    private static final byte DELETED = 2;

    private final int capacity;
    private final int[] keys;
    private final int[] values;
    private final byte[] state;
    int size = 0;

    ProbingMap(int capacity) {
        this.capacity = capacity;
        this.keys = new int[capacity];
        this.values = new int[capacity];
        this.state = new byte[capacity];
    }

    int indexOf(int key) {
        int i = Math.floorMod(Integer.hashCode(key), capacity);
        for (int probes = 0; probes < capacity; probes++) {
            if (state[i] == EMPTY) return -1;
            if (state[i] == FULL && keys[i] == key) return i;
            i = (i + 1) % capacity;
        }
        return -1;
    }

    Integer get(int key) {
        int i = indexOf(key);
        return i < 0 ? null : values[i];
    }

    boolean put(int key, int value) {
        int i = Math.floorMod(Integer.hashCode(key), capacity);
        int reusable = -1;
        for (int probes = 0; probes < capacity; probes++) {
            if (state[i] == FULL && keys[i] == key) {
                values[i] = value;
                return true;
            }
            if (state[i] == DELETED && reusable < 0) reusable = i;
            if (state[i] == EMPTY) break;
            i = (i + 1) % capacity;
        }
        int slot = reusable >= 0 ? reusable : (state[i] == EMPTY ? i : -1);
        if (slot < 0) return false;
        keys[slot] = key;
        values[slot] = value;
        state[slot] = FULL;
        size++;
        return true;
    }

    boolean delete(int key) {
        int i = indexOf(key);
        if (i < 0) return false;
        state[i] = DELETED;
        size--;
        return true;
    }
}
```

```java
static List<Object> chainedDemo() {
    ChainedMap map = new ChainedMap(5);
    for (int k : new int[]{10, 15, 20, 7, 12}) map.put(k, k * 10);
    List<Object> out = new ArrayList<>();
    out.add(map.bucketSizes());
    out.add(map.get(20));
    out.add(map.get(99));
    out.add(map.delete(15));
    out.add(map.bucketSizes());
    return out;
}
// chainedDemo() -> [[3, 0, 2, 0, 0], 200, null, true, [2, 0, 2, 0, 0]]

static List<Object> probingDemo() {
    ProbingMap map = new ProbingMap(7);
    for (int k : new int[]{10, 17, 24, 3}) map.put(k, k * 10);
    int before = map.indexOf(3);
    map.delete(17);
    Integer got = map.get(24);
    map.put(31, 310);
    return List.of(before, got, map.indexOf(31));
}
// probingDemo() -> [6, 240, 4]

static int stringHash() {
    return "hi".hashCode();
}
// stringHash() -> 3329
```

---

## 2. Resizing and Rehashing

### 2.1 When to Use

- Someone asks "why is `put` O(1) if the table sometimes has to grow?" and expects the word **amortized**.
- You are choosing the **initial capacity** of a `HashMap` or `HashSet` because you know roughly how many items are coming.
- A latency graph shows rare, large spikes in an otherwise fast hash table, and you suspect a resize.
- You are implementing a hash table and must decide **when** to grow and **how**.

### 2.2 Core Idea

A fixed number of buckets and a growing number of keys means the load factor only rises, and with it the chain length or probe length.
The fix is to **resize** when `alpha` crosses a threshold (the **max load factor**, commonly `0.75`): allocate a table with double the capacity and move every entry into it.

**Why a plain copy is not enough.**
The index is `hash mod capacity`, and the capacity just changed.
An entry that lived in bucket 3 of 4 may belong in bucket 3 or 7 of 8.
Every key must be **rehashed**, meaning its bucket is recomputed against the new capacity.

```text
1. newTable = array of 2 * capacity empty buckets
2. for every entry (key, value) in the old table:
       newTable[hash(key) mod newCapacity].add(entry)
3. replace the old table, capacity = 2 * capacity
```

**Why doubling is amortized O(1).**
A resize at size `n` costs O(n), but after it the table has room for `n` more inserts before the next one.
With doubling, the resizes cost `1 + 2 + 4 + ... + n`, which is less than `2n` in total.
Spread over `n` inserts that is under 2 extra moves per insert, a constant.

| Growth rule | Total copy work for `n` inserts | Verdict |
| --- | --- | --- |
| Double each time | Under `2n` | Amortized O(1) per insert |
| Add a fixed amount `c` | About `n^2 / (2c)` | Amortized O(n), too slow |
| Never grow | None, but chains reach length `n / capacity` | O(n) per operation |

| Detail | Common choice |
| --- | --- |
| Max load factor | `0.75` for chaining (Java `HashMap`), lower for linear probing |
| Growth factor | `2` |
| Initial capacity | `16` in Java `HashMap`, a power of two |
| Shrinking | Rare, many tables never shrink |

**The power-of-two trick.**
When the capacity is a power of two, the index is `hash & (capacity - 1)`.
Doubling the capacity adds exactly one more bit to that mask, so each entry either **stays** at its index `i` or moves to `i + oldCapacity`, depending on one bit of the hash: `hash & oldCapacity`.
Java's `HashMap` uses this to split each bucket in two without recomputing a modulo.

**Pausing for a resize.**
One resize is a single long O(n) operation.
Latency-sensitive stores, such as the Redis dictionary, rehash **incrementally**: they keep the old and new tables for a while and move a few buckets on each operation.

### 2.3 Problem: Grow the Table and Count the Moves

Extend the chained map with automatic growth.
It records how many resizes happened and how many entries were moved, so the amortized claim can be checked.

```js
class ResizingMap {
  constructor(capacity = 4, maxLoad = 0.75) {
    this.capacity = capacity;
    this.maxLoad = maxLoad;
    this.buckets = Array.from({ length: capacity }, () => []);
    this.size = 0;
    this.resizes = 0;
    this.moves = 0;
  }

  get loadFactor() {
    return this.size / this.capacity;
  }

  put(key, value) {
    const bucket = this.buckets[bucketIndex(key, this.capacity)];
    for (const entry of bucket) {
      if (entry[0] === key) {
        entry[1] = value;
        return;
      }
    }
    bucket.push([key, value]);
    this.size++;
    if (this.size > this.capacity * this.maxLoad) this.#grow();
  }

  get(key) {
    const bucket = this.buckets[bucketIndex(key, this.capacity)];
    for (const entry of bucket) {
      if (entry[0] === key) return entry[1];
    }
    return undefined;
  }

  #grow() {
    const old = this.buckets;
    this.capacity *= 2;
    this.buckets = Array.from({ length: this.capacity }, () => []);
    for (const bucket of old) {
      for (const entry of bucket) {
        this.buckets[bucketIndex(entry[0], this.capacity)].push(entry);   // rehash
        this.moves++;
      }
    }
    this.resizes++;
  }

  bucketSizes() {
    return this.buckets.map(bucket => bucket.length);
  }
}

const small = new ResizingMap(4);
for (const k of [10, 15, 20]) small.put(k, k);
small.capacity; // 4
small.put(7, 7);
small.capacity; // 8
small.bucketSizes(); // [0,0,1,0,1,0,0,2]
small.get(15); // 15

const big = new ResizingMap(4);
for (let k = 0; k < 1000; k++) big.put(k, k);
big.capacity; // 2048
big.resizes; // 9
big.moves; // 1542
```

Dry run of the first resize.
The table has capacity 4 and a threshold of `4 * 0.75 = 3`, so the fourth key trips it.

| Step | Key | Index (cap 4) | Size | Size above 3? |
| --- | --- | --- | --- | --- |
| 1 | 10 | 2 | 1 | no |
| 2 | 15 | 3 | 2 | no |
| 3 | 20 | 0 | 3 | no, `3 > 3` is false |
| 4 | 7 | 3 | 4 | **yes**, resize to 8 |

During the resize every entry is rehashed with `mod 8`:

| Key | Old index (mod 4) | New index (mod 8) | Moved? |
| --- | --- | --- | --- |
| 20 | 0 | 4 | yes, `0 + 4` |
| 10 | 2 | 2 | stays |
| 15 | 3 | 7 | yes, `3 + 4` |
| 7 | 3 | 7 | yes, `3 + 4` |

Every key landed at either its old index or the old index plus 4, which is the power-of-two split.
The new table is `[], [], [10], [], [20], [], [], [15, 7]`, and the previously crowded bucket 3 is now at 7, still holding two keys because 15 and 7 differ by 8.

For 1000 inserts starting from capacity 4, there are 9 resizes (4 to 2048) and 1542 entry moves.
That is under `2 * 1000`, so the average extra work per insert is below 2.

The power-of-two split as code:

```js
function indexAfterDoubling(hash, oldCapacity) {
  // oldCapacity must be a power of two
  const stays = (hash & oldCapacity) === 0;
  return stays ? (hash & (oldCapacity - 1)) : (hash & (oldCapacity - 1)) + oldCapacity;
}

indexAfterDoubling(21, 8); // 5
indexAfterDoubling(29, 8); // 13
indexAfterDoubling(29, 8) === (29 & 15); // true
```

`21 = 0b10101`: the bit worth 8 is `0`, so the entry stays at index `21 & 7 = 5`.
`29 = 0b11101`: the bit worth 8 is `1`, so it moves to `5 + 8 = 13`.

### 2.4 Pitfalls

- **Testing the threshold before inserting** and **after inserting** differ by one element.
  Decide which, and check the boundary where `size == capacity * maxLoad`.
- **Copying buckets as they are.** Entries must be re-indexed with the new capacity.
- **Growing by a constant.** That makes the total work quadratic.
- **Rehashing in the middle of iteration.** Adding a key while looping over the table can trigger a resize that invalidates the loop.
  Java throws `ConcurrentModificationException` for this.
- **Capacity that is not a power of two while using the mask trick.** `hash & (capacity - 1)` only works for powers of two.
- **Ignoring the cost in latency-sensitive code.** One resize of a million entries is one long pause.
  Pre-size the table or rehash incrementally.
- **Pre-sizing with the wrong formula.** To hold `n` entries without a resize in Java, the capacity must be at least `n / 0.75`, so use `new HashMap<>((int) (n / 0.75f) + 1)`.

### 2.5 Java Implementation

```java
class ResizingMap {
    private List<List<int[]>> buckets = new ArrayList<>();
    private int capacity;
    private final double maxLoad;
    int size = 0;
    int resizes = 0;
    int moves = 0;

    ResizingMap(int capacity, double maxLoad) {
        this.capacity = capacity;
        this.maxLoad = maxLoad;
        for (int i = 0; i < capacity; i++) buckets.add(new ArrayList<>());
    }

    int capacity() {
        return capacity;
    }

    void put(int key, int value) {
        List<int[]> bucket = buckets.get(Math.floorMod(Integer.hashCode(key), capacity));
        for (int[] entry : bucket) {
            if (entry[0] == key) {
                entry[1] = value;
                return;
            }
        }
        bucket.add(new int[]{key, value});
        size++;
        if (size > capacity * maxLoad) grow();
    }

    private void grow() {
        List<List<int[]>> old = buckets;
        capacity *= 2;
        buckets = new ArrayList<>();
        for (int i = 0; i < capacity; i++) buckets.add(new ArrayList<>());
        for (List<int[]> bucket : old) {
            for (int[] entry : bucket) {
                buckets.get(Math.floorMod(Integer.hashCode(entry[0]), capacity)).add(entry);
                moves++;
            }
        }
        resizes++;
    }

    List<Integer> bucketSizes() {
        List<Integer> out = new ArrayList<>();
        for (List<int[]> bucket : buckets) out.add(bucket.size());
        return out;
    }
}
```

```java
static List<Object> resizeDemo() {
    ResizingMap small = new ResizingMap(4, 0.75);
    for (int k : new int[]{10, 15, 20, 7}) small.put(k, k);
    ResizingMap big = new ResizingMap(4, 0.75);
    for (int k = 0; k < 1000; k++) big.put(k, k);
    return List.of(small.capacity(), small.bucketSizes(), big.capacity(), big.resizes, big.moves);
}
// resizeDemo() -> [8, [0, 0, 1, 0, 1, 0, 0, 2], 2048, 9, 1542]

static int indexAfterDoubling(int hash, int oldCapacity) {
    boolean stays = (hash & oldCapacity) == 0;
    int low = hash & (oldCapacity - 1);
    return stays ? low : low + oldCapacity;
}
// indexAfterDoubling(21, 8) -> 5
// indexAfterDoubling(29, 8) -> 13
```

Java's own `HashMap` starts at capacity 16, resizes at load factor 0.75, doubles each time, and, once a single bucket grows past 8 entries in a table of at least 64 buckets, converts that chain to a balanced tree.
Pre-sizing is the only tuning you get:

```java
static int presizedCapacity(int expectedEntries) {
    return (int) (expectedEntries / 0.75f) + 1;
}
// presizedCapacity(1000) -> 1334
```

`new HashMap<>(presizedCapacity(1000))` avoids every intermediate resize.
Java rounds the requested capacity up to the next power of two internally, so that map starts at 2048 buckets.

---

## 3. Bloom Filters

### 3.1 When to Use

- You must answer **"have I seen this before?"** for a huge set, and memory is the constraint.
- A **false "maybe"** is acceptable, but a false "no" is not.
- You want to avoid an expensive lookup (a disk read, a network call, a database query) for keys that are almost certainly absent.
- Typical uses: a storage engine checking whether a key can be in a file before reading it, a crawler skipping URLs it has already seen, a cache that rejects requests for keys that were never stored, a browser's malicious-URL pre-check.
- Keywords: "probabilistic", "space efficient set membership", "no false negatives", "approximate".

### 3.2 Core Idea

A Bloom filter is a bit array of `m` bits, all zero at the start, plus `k` independent hash functions.

- **Add** an item: compute its `k` positions and set those `k` bits to 1.
- **Query** an item: compute its `k` positions.
  If **any** bit is 0, the item was **definitely never added**.
  If **all** are 1, the item is **probably** present.

Two different items can set overlapping bits, so after many insertions an item that was never added may find all its bits already set.
That is a **false positive**.
A false negative cannot happen, because adding an item sets exactly the bits the query will check, and bits are never cleared.

```text
m = 16 bits, k = 3

add "apple"   -> sets 6, 13, 15
add "banana"  -> sets 0, 7, 14
add "cherry"  -> sets 8, 11, 14        (14 was already set)

bits set: 0 6 7 8 11 13 14 15
```

**Sizing math.**
After inserting `n` items, the chance that a given bit is still zero is about `e^(-kn/m)`.
A query for an absent item gets a false positive when all `k` of its bits are set:

```text
p ≈ (1 - e^(-k n / m))^k
```

For a fixed `m` and `n`, the best number of hash functions is `k = (m / n) * ln 2`, and the bits needed for a target rate `p` are `m = -n * ln(p) / (ln 2)^2`.

| Bits per item (`m / n`) | Best `k` | False positive rate |
| --- | --- | --- |
| 4 | 3 | about 14.7% |
| 8 | 6 | about 2.2% |
| 10 | 7 | about 0.82% |
| 16 | 11 | about 0.046% |

Remember the rule of thumb: **about 10 bits per item gives about a 1% false positive rate**, regardless of how big the items are.
Storing a million 100-byte URLs exactly takes 100 MB, and a Bloom filter for them takes about 1.2 MB.

Getting `k` hash functions cheaply: compute two base hashes `h1` and `h2`, and derive the `i`-th as `h1 + i * h2` (mod `m`).
This **double hashing** gives the same false positive rate in practice.

| Operation | Cost |
| --- | --- |
| `add` | O(k) |
| `mightContain` | O(k) |
| Delete | **Not supported** |
| List the members | **Not supported** |
| Merge two filters (same `m`, `k`, hashes) | Bitwise OR |

### 3.3 Problem: Build a Bloom Filter and Measure It

```js
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) | 0;
  return (h | 1) >>> 0;                          // force odd so every step moves
}

class BloomFilter {
  constructor(m, k) {
    this.m = m;
    this.k = k;
    this.bits = new Uint32Array((m + 31) >>> 5);
  }

  static forCapacity(n, p) {
    const m = Math.ceil((-n * Math.log(p)) / (Math.LN2 * Math.LN2));
    const k = Math.max(1, Math.round((m / n) * Math.LN2));
    return new BloomFilter(m, k);
  }

  positions(item) {
    const h1 = fnv1a(item);
    const h2 = djb2(item);
    const out = [];
    for (let i = 0; i < this.k; i++) out.push(((h1 + Math.imul(i, h2)) >>> 0) % this.m);
    return out;
  }

  add(item) {
    for (const p of this.positions(item)) this.bits[p >>> 5] |= 1 << (p & 31);
  }

  mightContain(item) {
    return this.positions(item).every(p => (this.bits[p >>> 5] & (1 << (p & 31))) !== 0);
  }

  setBits() {
    const out = [];
    for (let i = 0; i < this.m; i++) {
      if (this.bits[i >>> 5] & (1 << (i & 31))) out.push(i);
    }
    return out;
  }
}

const tiny = new BloomFilter(16, 3);
for (const fruit of ["apple", "banana", "cherry"]) tiny.add(fruit);
tiny.positions("apple"); // [15,6,13]
tiny.setBits(); // [0,6,7,8,11,13,14,15]
tiny.mightContain("banana"); // true
tiny.mightContain("grape"); // false
tiny.positions("grape"); // [0,5,10]
tiny.mightContain("fruit21"); // true
tiny.positions("fruit21"); // [8,11,14]
```

Dry run on the 16-bit filter:

| Query | Positions | Bits at those positions | Answer |
| --- | --- | --- | --- |
| banana | 0, 7, 14 | 1, 1, 1 | probably present, and truly was added |
| grape | 0, 5, 10 | 1, **0**, 0 | **definitely absent**, one zero bit is enough |
| fruit21 | 8, 11, 14 | 1, 1, 1 | probably present, but it was **never added**: a false positive |

`fruit21` collided because bit 8 and bit 11 came from `cherry`, and bit 14 came from `banana` and `cherry`.
Nothing in the filter can tell that those three bits were set by different items.

Now measure it at scale.
Size the filter for 1000 items at a 1% target, add 1000 items, then query 10000 items that were never added.

```js
function missedCount(filter, n) {
  let missed = 0;
  for (let i = 0; i < n; i++) {
    if (!filter.mightContain("user" + i)) missed++;
  }
  return missed;
}

function falsePositiveCount(filter, n) {
  let hits = 0;
  for (let i = 0; i < n; i++) {
    if (filter.mightContain("other" + i)) hits++;
  }
  return hits;
}

const filter = BloomFilter.forCapacity(1000, 0.01);
filter.m; // 9586
filter.k; // 7
for (let i = 0; i < 1000; i++) filter.add("user" + i);
missedCount(filter, 1000); // 0
falsePositiveCount(filter, 10000); // 104
```

There are **0 false negatives**, as guaranteed.
There are 104 false positives in 10000 queries, about **1.04%**, which matches the 1% target.
The filter uses `9586` bits, about 1.2 KB, for 1000 items.

### 3.4 Extra Variants

**Counting Bloom filter.**
Replace each bit with a small counter.
`add` increments `k` counters, `remove` decrements them, and a query checks that all are above zero.
That supports deletion at several times the memory.

**Cuckoo filter.**
Stores short fingerprints in a cuckoo hash table.
It supports deletion and can use less space than a Bloom filter at low false positive rates.

**Cache penetration guard.**
Put a Bloom filter of all existing ids in front of a database.
A request for an id the filter rejects returns "not found" immediately and never touches the database.
A "maybe" falls through to the database, which gives the real answer.

**Union of filters.**
Two filters with the same `m`, `k`, and hash functions merge with a bitwise OR of their arrays.
This is how distributed workers combine what each of them has seen.

### 3.5 Pitfalls

- **Expecting deletion.** Clearing a bit may erase evidence of other items and create false negatives.
  Use a counting Bloom filter if deletes are needed.
- **Treating "maybe" as "yes".** A positive answer must go to the authoritative store.
  Only the negative answer is final.
- **Under-sizing.** The false positive rate rises sharply once `n` exceeds the number the filter was built for.
  Size for the largest expected `n`, or use a scalable variant that chains filters.
- **Weak or correlated hashes.** If the `k` positions are not independent, the false positive rate is worse than the formula.
  Double hashing needs a good `h1` and an `h2` that is not zero or a divisor of `m`.
- **Using `% m` on a negative hash.** Convert to unsigned first, as `>>> 0` does here, or use `Math.floorMod` in Java.
- **Storing it as a set of objects.** The point is the bit array.
  If you need the members back, a Bloom filter cannot give them.
- **Different `m` or `k` on two machines.** The bits then mean different things, and a merge produces nonsense.

### 3.6 Java Implementation

```java
class BloomFilter {
    final int m;
    final int k;
    private final long[] bits;

    BloomFilter(int m, int k) {
        this.m = m;
        this.k = k;
        this.bits = new long[(m + 63) >>> 6];
    }

    static BloomFilter forCapacity(int n, double p) {
        int m = (int) Math.ceil(-n * Math.log(p) / (Math.log(2) * Math.log(2)));
        int k = Math.max(1, (int) Math.round((double) m / n * Math.log(2)));
        return new BloomFilter(m, k);
    }

    private static int fnv1a(String s) {
        int h = 0x811c9dc5;
        for (int i = 0; i < s.length(); i++) {
            h ^= s.charAt(i);
            h *= 0x01000193;
        }
        return h;
    }

    private static int djb2(String s) {
        int h = 5381;
        for (int i = 0; i < s.length(); i++) h = h * 33 + s.charAt(i);
        return h | 1;
    }

    List<Integer> positions(String item) {
        int h1 = fnv1a(item);
        int h2 = djb2(item);
        List<Integer> out = new ArrayList<>();
        for (int i = 0; i < k; i++) out.add(Integer.remainderUnsigned(h1 + i * h2, m));
        return out;
    }

    void add(String item) {
        for (int p : positions(item)) bits[p >>> 6] |= 1L << (p & 63);
    }

    boolean mightContain(String item) {
        for (int p : positions(item)) {
            if ((bits[p >>> 6] & (1L << (p & 63))) == 0) return false;
        }
        return true;
    }

    List<Integer> setBits() {
        List<Integer> out = new ArrayList<>();
        for (int i = 0; i < m; i++) {
            if ((bits[i >>> 6] & (1L << (i & 63))) != 0) out.add(i);
        }
        return out;
    }
}
```

```java
static List<Object> tinyDemo() {
    BloomFilter tiny = new BloomFilter(16, 3);
    for (String fruit : new String[]{"apple", "banana", "cherry"}) tiny.add(fruit);
    return List.of(tiny.positions("apple"), tiny.setBits(),
            tiny.mightContain("banana"), tiny.mightContain("grape"), tiny.mightContain("fruit21"));
}
// tinyDemo() -> [[15, 6, 13], [0, 6, 7, 8, 11, 13, 14, 15], true, false, true]

static List<Integer> measureDemo() {
    BloomFilter filter = BloomFilter.forCapacity(1000, 0.01);
    for (int i = 0; i < 1000; i++) filter.add("user" + i);
    int missed = 0;
    for (int i = 0; i < 1000; i++) {
        if (!filter.mightContain("user" + i)) missed++;
    }
    int falsePositives = 0;
    for (int i = 0; i < 10000; i++) {
        if (filter.mightContain("other" + i)) falsePositives++;
    }
    return List.of(filter.m, filter.k, missed, falsePositives);
}
// measureDemo() -> [9586, 7, 0, 104]
```

`Integer.remainderUnsigned` treats the 32-bit `int` as an unsigned value, which gives the same result as the `>>> 0` in the JavaScript version.
Guava ships a production `BloomFilter`, and Redis offers one through the RedisBloom module.
Both are the answer when you may use a library.

---

## 4. Java Pitfalls

- **`hashCode` and `equals` come as a pair.** If two keys are `equals`, their `hashCode` must match, otherwise `HashMap` loses them.
  Records and `Objects.hash(...)` handle this for you.
- **`Math.abs(hash) % n` is not safe.** `Math.abs(Integer.MIN_VALUE)` is still negative.
  Use `Math.floorMod(hash, n)`.
- **Mutable keys.** A `List` used as a key and changed afterwards makes the entry unreachable.
- **`HashMap` iteration order is unspecified,** and it can change after a resize.
  Use `LinkedHashMap` for insertion order or `TreeMap` for sorted order.
- **`ConcurrentModificationException`.** Do not call `put` or `remove` on a map while iterating it, except through the iterator.
- **`int` overflow in `h1 + i * h2`.** In hash code this wrapping is intended, and `Integer.remainderUnsigned` makes the result safe.
  In normal arithmetic it is a bug.
- **`new HashMap<>(n)` is not "room for `n` entries".** It is the initial bucket count, so size it as `n / 0.75`.
- **`HashMap` is not thread safe.** Use `ConcurrentHashMap` for shared access.

---

## 5. Quick Recap

| Topic | Signal in the problem | Core tool | Time | Space |
| --- | --- | --- | --- | --- |
| Collision handling | Design a hash map, many keys in one bucket | Chaining, or probing with tombstones | O(1) average, O(n) worst | O(n) |
| Resizing and rehashing | "Why is `put` O(1)?", pre-sizing a map | Double at load 0.75, rehash every entry | O(1) amortized | O(n) |
| Bloom filter | Huge set, false "maybe" is fine, no false "no" | `m` bits, `k` hashes, `~10` bits per item for 1% | O(k) per operation | `m` bits |

Next: [Advanced Trees](/docs/dsa/advanced-trees) for the ordered structures that hashing cannot give you (range queries, sorted order, guaranteed worst case), or the [Pattern Playbook](/docs/dsa/pattern-playbook) for where hash maps fit among the other patterns.
