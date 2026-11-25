---
title: "Memory, Linked Lists, Buffers and Bitsets"
description: "Memory and pointers, doubly linked lists, circular buffers, and bitsets with simulated memory, dry runs, LRU and sieve examples, pitfalls, and JavaScript and Java code."
---

# 📘 Memory, Linked Lists, Buffers and Bitsets

This page covers the low-level building blocks that the pattern pages assume you already know.
It starts with what a pointer really is, then builds three structures on top of that idea: the doubly linked list, the circular buffer, and the bitset.
Each section has recognition signals, a core idea, a worked problem with a dry run, pitfalls, and a **Java Implementation** subsection.
JavaScript and Java code is included, and every snippet on this page was executed against test cases.
Java conventions: all methods are `static` members of one `Solution` class, `import java.util.*;` is assumed, helper classes are top-level package-private classes in the same file, and the trailing `//` comments show a sample call and its result.
It pairs with [Arrays, Strings and Linked Lists](/docs/dsa/arrays-and-linked-lists), which uses the singly linked `ListNode`.

## Table of Contents

1. [Memory and Pointers](#1-memory-and-pointers)
2. [Doubly Linked Lists](#2-doubly-linked-lists)
3. [Circular Buffer](#3-circular-buffer)
4. [Bitsets](#4-bitsets)
5. [Java Pitfalls](#5-java-pitfalls)
6. [Quick Recap](#6-quick-recap)

---

## 1. Memory and Pointers

### 1.1 When to Use

- You need to explain **why** array indexing is O(1) but linked list indexing is O(n).
- A bug involves **aliasing**: two names point at one object and a change through one name shows up through the other.
- An interviewer asks what `null`, a reference, or a pointer is, or why a linked list is slow to scan in practice.
- You are designing a structure by hand (list, buffer, hash table) and need to reason about where each piece lives.

### 1.2 Core Idea

Memory is one long row of numbered cells.
The number of a cell is its **address**.
A **pointer** (or reference) is a value that stores an address, so reading through it means "go to that cell".
`null` is the agreed value that means "points nowhere".

| Region | What lives there | Lifetime | Typical cost |
| --- | --- | --- | --- |
| Stack | Local variables, function arguments, return addresses | Freed automatically when the function returns | Very fast, small (recursion depth is limited) |
| Heap | Objects, arrays, anything created with `new` or a literal | Lives while something still points at it, then the garbage collector reclaims it | Slower to allocate, large |

An array is one **contiguous block**.
Element `i` lives at `base + i * elementSize`, so the machine computes the address with one multiply and one add.
That arithmetic is the reason `a[i]` is O(1).

A linked list node is a small block somewhere on the heap holding a value and the address of the next node.
Nodes can be anywhere, so reaching node `i` means following `i` pointers, which is O(n).

| | Array | Linked list |
| --- | --- | --- |
| Layout | One contiguous block | Scattered nodes joined by pointers |
| Index `i` | O(1), address arithmetic | O(n), follow `i` pointers |
| Insert or remove given the position | O(n), shift the tail | O(1) once you hold the node |
| Cache behavior | Neighbors are loaded together, fast scans | Each hop may miss the cache |
| Extra memory per element | None | One or two pointers |

Value versus reference semantics decide what a copy means.

| | Primitive (`number`, `int`) | Object or array |
| --- | --- | --- |
| Assignment `b = a` | Copies the value | Copies the **address**, both names reach one object |
| Equality `==` | Compares values | JavaScript `===` and Java `==` compare addresses |
| Function argument | Callee gets its own copy | Callee gets a copy of the address, so it can mutate the shared object but cannot rebind the caller's name |

Both JavaScript and Java are pass by value, and for objects the value passed is the reference.

### 1.3 Problem: Simulate Memory and Reverse a List by Address

Build a tiny memory out of a typed array, store a three-node list in it at scattered addresses, then reverse the list by rewriting the `next` cells.
This is exactly what `reverseList` does on real objects, with the addresses made visible.

Each node takes two cells: `[value, next]`.
`-1` plays the role of `null`.

```js
const NULL = -1;

class Memory {
  constructor(size) {
    this.cells = new Int32Array(size);
    this.top = 0;                       // next free address
  }
  alloc(n) {
    const addr = this.top;
    this.top += n;
    if (this.top > this.cells.length) throw new Error("out of memory");
    return addr;
  }
  read(addr) {
    return this.cells[addr];
  }
  write(addr, value) {
    this.cells[addr] = value;
  }
}

function newNode(mem, value, next) {
  const addr = mem.alloc(2);
  mem.write(addr, value);               // cell 0: value
  mem.write(addr + 1, next);            // cell 1: address of next node
  return addr;
}

function walk(mem, head) {
  const out = [];
  for (let p = head; p !== NULL; p = mem.read(p + 1)) out.push(mem.read(p));
  return out;
}

function reverseList(mem, head) {
  let prev = NULL;
  let curr = head;
  while (curr !== NULL) {
    const next = mem.read(curr + 1);    // 1. remember the rest of the list
    mem.write(curr + 1, prev);          // 2. turn this pointer around
    prev = curr;                        // 3. advance both pointers
    curr = next;
  }
  return prev;                          // old tail is the new head
}

const mem = new Memory(16);
const c = newNode(mem, 30, NULL);       // address 0
mem.alloc(3);                           // something else lives at 2..4
const b = newNode(mem, 20, c);          // address 5
mem.alloc(1);                           // something else lives at 7
const a = newNode(mem, 10, b);          // address 8
walk(mem, a); // [10,20,30]
const newHead = reverseList(mem, a);
walk(mem, newHead); // [30,20,10]
newHead; // 0
```

Memory layout before the reversal.
The head is address `8`, and the list is `8 -> 5 -> 0`.

| Address | 0 | 1 | 2-4 | 5 | 6 | 7 | 8 | 9 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Content | value 30 | next -1 | other data | value 20 | next 0 | other data | value 10 | next 5 |

Dry run of `reverseList`:

| Step | curr | next (read) | Write | prev after | Resulting links |
| --- | --- | --- | --- | --- | --- |
| 1 | 8 | 5 | cell 9 = -1 | 8 | 8 -> null |
| 2 | 5 | 0 | cell 6 = 8 | 5 | 5 -> 8 -> null |
| 3 | 0 | -1 | cell 1 = 5 | 0 | 0 -> 5 -> 8 -> null |
| 4 | -1 | - | loop ends | 0 | return 0 |

The three reads and writes per node are the only work, so the cost is O(n) time and O(1) extra space.
Notice that no values moved.
Only the pointer cells changed.

Aliasing is the same idea on real objects:

```js
const x = [1, 2, 3];
const y = x;                            // y holds the same address as x
y.push(4);
x.join(","); // 1,2,3,4
const z = [...x];                       // a new block with copied values
z.push(5);
x.join(","); // 1,2,3,4
x === y; // true
x === z; // false
```

### 1.4 Pitfalls

- **Shallow copy surprises.** `[...grid]` copies the outer array only, so every row is still shared.
  Copy each row, or use `grid.map(row => [...row])`.
- **Reading through `null`.** JavaScript throws `TypeError: Cannot read properties of null`, and Java throws `NullPointerException`.
  Guard every `node.next.next` access, or use a dummy head.
- **Comparing objects with `===` or `==`.** Two equal-looking arrays are different addresses.
  Compare element by element, or use `equals` in Java.
- **Mutating a default argument or shared constant.** Every caller shares the one object.
- **Memory leaks in a garbage-collected language.** A cache or listener list that keeps a reference stops the collector from freeing the object.
  Remove the reference when you are done.
- **Dangling pointers and double free** exist only in languages without a collector.
  Mention them if the interviewer asks what a pointer can do wrong in C or C++.
- **Recursion eats stack.** Each call adds a frame on the stack, so very deep recursion overflows even when the heap is empty.

### 1.5 Java Implementation

The same simulation in Java.
`Memory` is a top-level helper class.

```java
class Memory {
    final int[] cells;
    int top = 0;

    Memory(int size) {
        cells = new int[size];
    }

    int alloc(int n) {
        int addr = top;
        top += n;
        if (top > cells.length) throw new IllegalStateException("out of memory");
        return addr;
    }
}
```

```java
static final int NULL = -1;

static int newNode(Memory mem, int value, int next) {
    int addr = mem.alloc(2);
    mem.cells[addr] = value;
    mem.cells[addr + 1] = next;
    return addr;
}

static List<Integer> walk(Memory mem, int head) {
    List<Integer> out = new ArrayList<>();
    for (int p = head; p != NULL; p = mem.cells[p + 1]) out.add(mem.cells[p]);
    return out;
}

static int reverseList(Memory mem, int head) {
    int prev = NULL;
    int curr = head;
    while (curr != NULL) {
        int next = mem.cells[curr + 1];
        mem.cells[curr + 1] = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}

static List<Integer> memoryDemo() {
    Memory mem = new Memory(16);
    int c = newNode(mem, 30, NULL);
    mem.alloc(3);
    int b = newNode(mem, 20, c);
    mem.alloc(1);
    int a = newNode(mem, 10, b);
    return walk(mem, reverseList(mem, a));
}
// memoryDemo() -> [30, 20, 10]
```

Java arrays and objects are references, so aliasing works the same way.
Strings show the difference between `==` and `equals`.

```java
static int[] aliasDemo() {
    int[] a = {1, 2, 3};
    int[] b = a;                           // same array
    b[0] = 99;
    return a;
}
// aliasDemo() -> [99, 2, 3]

static boolean[] equalityDemo() {
    String x = new String("hi");
    String y = new String("hi");
    return new boolean[]{x == y, x.equals(y)};
}
// equalityDemo() -> [false, true]

static int[] copyDemo() {
    int[] a = {1, 2, 3};
    int[] copy = Arrays.copyOf(a, a.length);  // a new block
    copy[0] = 99;
    return a;
}
// copyDemo() -> [1, 2, 3]
```

---

## 2. Doubly Linked Lists

### 2.1 When to Use

- You must **remove a node you already hold in O(1)**, without walking from the head to find its predecessor.
- You need to traverse **both directions**: browser history, text editor cursor, undo and redo.
- You maintain an **ordering that changes on every access**: LRU cache, move-to-front lists.
- You need O(1) push and pop at **both ends**, which is what a deque is.

### 2.2 Core Idea

Each node stores both `prev` and `next`.
The price is one extra pointer per node and more pointer writes per operation.
The reward is that `remove(node)` needs no search.

Use two **sentinel nodes**, a dummy `head` and a dummy `tail`, that never hold data.
The real nodes always sit between them, so every real node has a non-null `prev` and `next`.
Insert and remove then need no special case for an empty list, the first node, or the last node.

```text
head <-> A <-> B <-> C <-> tail

insertAfter(A, X):

head <-> A <-> X <-> B <-> C <-> tail
```

Insert a new node `n` after `node`.
The order of the four writes matters, because the first two read the old `node.next` and the last two overwrite it.

| Step | Write | Why this order |
| --- | --- | --- |
| 1 | `n.prev = node` | Reads only `node` |
| 2 | `n.next = node.next` | Must run before `node.next` changes |
| 3 | `node.next.prev = n` | Still reads the old `node.next` |
| 4 | `node.next = n` | Last, now nothing needs the old link |

Remove a node with two writes, then clear its own pointers so it cannot keep the list alive or be reused by mistake.

```text
node.prev.next = node.next
node.next.prev = node.prev
node.prev = node.next = null
```

| Operation | Cost |
| --- | --- |
| `pushFront`, `pushBack`, `popFront`, `popBack` | O(1) |
| `remove(node)` given the node | O(1) |
| `moveToFront(node)` | O(1) |
| Find by value or by index | O(n) |

### 2.3 Problem: Build the List, Then Use It for an LRU Cache

First the list, with the private `#unlink` and `#linkAfter` helpers that every other method reuses.

```js
class DNode {
  constructor(val) {
    this.val = val;
    this.prev = null;
    this.next = null;
  }
}

class DoublyLinkedList {
  constructor() {
    this.head = new DNode(null);          // sentinels
    this.tail = new DNode(null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }

  #linkAfter(anchor, node) {
    node.prev = anchor;
    node.next = anchor.next;
    anchor.next.prev = node;
    anchor.next = node;
    this.size++;
  }

  #unlink(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    node.prev = node.next = null;
    this.size--;
  }

  pushFront(val) {
    const node = new DNode(val);
    this.#linkAfter(this.head, node);
    return node;
  }

  pushBack(val) {
    const node = new DNode(val);
    this.#linkAfter(this.tail.prev, node);
    return node;
  }

  remove(node) {
    this.#unlink(node);
    return node.val;
  }

  popFront() {
    return this.size === 0 ? undefined : this.remove(this.head.next);
  }

  popBack() {
    return this.size === 0 ? undefined : this.remove(this.tail.prev);
  }

  moveToFront(node) {
    this.#unlink(node);
    this.#linkAfter(this.head, node);
  }

  toArray() {
    const out = [];
    for (let n = this.head.next; n !== this.tail; n = n.next) out.push(n.val);
    return out;
  }

  toArrayReversed() {
    const out = [];
    for (let n = this.tail.prev; n !== this.head; n = n.prev) out.push(n.val);
    return out;
  }
}

const list = new DoublyLinkedList();
list.pushBack(2);
const three = list.pushBack(3);
list.pushFront(1);
list.pushBack(4);
list.toArray(); // [1,2,3,4]
list.toArrayReversed(); // [4,3,2,1]
list.remove(three); // 3
list.toArray(); // [1,2,4]
list.moveToFront(list.tail.prev);
list.toArray(); // [4,1,2]
list.popBack(); // 2
list.size; // 2
```

Dry run of `pushBack(3)` when the list is `head <-> 2 <-> tail`:

| Step | Write | State afterwards |
| --- | --- | --- |
| 1 | `n.prev = 2` | `n` knows its left neighbor |
| 2 | `n.next = tail` | `n` knows its right neighbor |
| 3 | `tail.prev = n` | `tail` now points back at `n` |
| 4 | `2.next = n` | `head <-> 2 <-> 3 <-> tail` |

**LRU cache** (LeetCode 146) is the classic use.
A hash map gives O(1) lookup from key to node, and the list keeps the keys ordered from most recently used at the front to least recently used at the back.
Each `get` and `put` moves a node to the front, and eviction removes `tail.prev`.

```js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();                   // key -> node, node.val = [key, value]
    this.list = new DoublyLinkedList();
  }

  get(key) {
    const node = this.map.get(key);
    if (node === undefined) return -1;
    this.list.moveToFront(node);
    return node.val[1];
  }

  put(key, value) {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      existing.val[1] = value;
      this.list.moveToFront(existing);
      return;
    }
    if (this.map.size === this.capacity) {
      const [oldKey] = this.list.popBack();   // evict least recently used
      this.map.delete(oldKey);
    }
    this.map.set(key, this.list.pushFront([key, value]));
  }
}

const lru = new LRUCache(2);
lru.put(1, 1);
lru.put(2, 2);
lru.get(1); // 1
// put(3, 3) evicts key 2, the least recently used
lru.put(3, 3);
lru.get(2); // -1
lru.put(4, 4);
lru.get(1); // -1
lru.get(3); // 3
lru.get(4); // 4
```

The node stores the key as well as the value, because eviction starts from the list and must know which map entry to delete.
Both `get` and `put` are O(1).

### 2.4 Pitfalls

- **Wrong write order in `insertAfter`.** Setting `node.next = n` before reading `node.next` loses the old successor.
- **Updating only one direction.** Every link has two ends.
  If `a.next === b`, then `b.prev === a` must also hold, and a traversal check in both directions catches the bug.
- **Forgetting the sentinels exist.** `popFront` on an empty list would otherwise remove the dummy head.
  Guard with `size`.
- **Not clearing a removed node.** A stale `prev` and `next` on a removed node keeps the old neighbors reachable and invites double removal.
- **Storing only the value in an LRU node.** Eviction needs the key to delete the map entry.
- **A cycle after a bad splice.** If a traversal never ends, print a few `next` steps and check which link points backwards.

### 2.5 Java Implementation

```java
class DNode {
    int key;
    int val;
    DNode prev;
    DNode next;

    DNode(int key, int val) {
        this.key = key;
        this.val = val;
    }
}

class DoublyLinkedList {
    final DNode head = new DNode(0, 0);       // sentinels
    final DNode tail = new DNode(0, 0);
    int size = 0;

    DoublyLinkedList() {
        head.next = tail;
        tail.prev = head;
    }

    private void linkAfter(DNode anchor, DNode node) {
        node.prev = anchor;
        node.next = anchor.next;
        anchor.next.prev = node;
        anchor.next = node;
        size++;
    }

    private void unlink(DNode node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
        node.prev = null;
        node.next = null;
        size--;
    }

    DNode pushFront(int key, int val) {
        DNode node = new DNode(key, val);
        linkAfter(head, node);
        return node;
    }

    DNode pushBack(int key, int val) {
        DNode node = new DNode(key, val);
        linkAfter(tail.prev, node);
        return node;
    }

    void remove(DNode node) {
        unlink(node);
    }

    DNode popBack() {
        if (size == 0) return null;
        DNode node = tail.prev;
        unlink(node);
        return node;
    }

    void moveToFront(DNode node) {
        unlink(node);
        linkAfter(head, node);
    }

    List<Integer> toList() {
        List<Integer> out = new ArrayList<>();
        for (DNode n = head.next; n != tail; n = n.next) out.add(n.val);
        return out;
    }

    List<Integer> toListReversed() {
        List<Integer> out = new ArrayList<>();
        for (DNode n = tail.prev; n != head; n = n.prev) out.add(n.val);
        return out;
    }
}
```

```java
class LRUCache {
    private final int capacity;
    private final Map<Integer, DNode> map = new HashMap<>();
    private final DoublyLinkedList list = new DoublyLinkedList();

    LRUCache(int capacity) {
        this.capacity = capacity;
    }

    int get(int key) {
        DNode node = map.get(key);
        if (node == null) return -1;
        list.moveToFront(node);
        return node.val;
    }

    void put(int key, int value) {
        DNode existing = map.get(key);
        if (existing != null) {
            existing.val = value;
            list.moveToFront(existing);
            return;
        }
        if (map.size() == capacity) {
            DNode evicted = list.popBack();
            map.remove(evicted.key);
        }
        map.put(key, list.pushFront(key, value));
    }
}
```

```java
static List<Integer> listDemo() {
    DoublyLinkedList list = new DoublyLinkedList();
    list.pushBack(0, 2);
    DNode three = list.pushBack(0, 3);
    list.pushFront(0, 1);
    list.pushBack(0, 4);
    list.remove(three);
    list.moveToFront(list.tail.prev);
    return list.toList();
}
// listDemo() -> [4, 1, 2]

static List<Integer> lruDemo() {
    LRUCache cache = new LRUCache(2);
    cache.put(1, 1);
    cache.put(2, 2);
    int a = cache.get(1);
    cache.put(3, 3);
    int b = cache.get(2);
    cache.put(4, 4);
    return List.of(a, b, cache.get(1), cache.get(3), cache.get(4));
}
// lruDemo() -> [1, -1, -1, 3, 4]
```

Java's own `LinkedHashMap` with `accessOrder = true` and an overridden `removeEldestEntry` is a ready-made LRU cache.
In an interview, build the list by hand unless the interviewer says the library is fine.

---

## 3. Circular Buffer

### 3.1 When to Use

- The structure has a **fixed capacity** and works as a queue: producer and consumer, streaming data, keyboard input, audio buffers.
- You only ever need the **last k items**: a sliding log, a moving average, the last k events.
- Keywords: "circular queue", "ring buffer", "fixed-size queue", "overwrite the oldest".
- You want O(1) enqueue and dequeue with **no shifting** and no allocation after the start.

### 3.2 Core Idea

Store the queue in a fixed array and let the indices wrap around the end with the modulo operator.
Keep two numbers: `head`, the index of the oldest item, and `size`, how many items are stored.
The next free slot is always `(head + size) % capacity`.

```text
capacity 5, head = 3, size = 4:

index:   0    1    2    3    4
       [ c ][ d ][   ][ a ][ b ]
                       ^head      tail slot = (3 + 4) % 5 = 2
```

| Operation | Effect | Cost |
| --- | --- | --- |
| `enqueue(x)` | `buf[(head + size) % cap] = x`, `size++`, fails if full | O(1) |
| `dequeue()` | `head = (head + 1) % cap`, `size--`, fails if empty | O(1) |
| `front()` | `buf[head]` | O(1) |
| `rear()` | `buf[(head + size - 1) % cap]` | O(1) |
| `isFull()` / `isEmpty()` | `size === cap` / `size === 0` | O(1) |

**Why store `size` and not just `head` and `tail`.**
With only two indices, `head === tail` happens both when the buffer is empty and when it is full.
A stored `size` removes the ambiguity.
The alternative is to leave one slot unused and treat `(tail + 1) % cap === head` as full.

Two policies when the buffer is full:

| Policy | Behavior | Use for |
| --- | --- | --- |
| Reject | `enqueue` returns `false` | Bounded work queues, back pressure |
| Overwrite | The oldest item is dropped to make room | Logs, "last k" windows |

### 3.3 Problem: Design Circular Queue

LeetCode 622: implement `enqueue`, `dequeue`, `front`, `rear`, `isEmpty`, `isFull` for a queue of capacity `k`.

```js
class CircularQueue {
  constructor(k) {
    this.buf = new Array(k);
    this.cap = k;
    this.head = 0;
    this.size = 0;
  }

  enqueue(x) {
    if (this.isFull()) return false;
    this.buf[(this.head + this.size) % this.cap] = x;
    this.size++;
    return true;
  }

  dequeue() {
    if (this.isEmpty()) return false;
    this.head = (this.head + 1) % this.cap;
    this.size--;
    return true;
  }

  front() {
    return this.isEmpty() ? -1 : this.buf[this.head];
  }

  rear() {
    return this.isEmpty() ? -1 : this.buf[(this.head + this.size - 1) % this.cap];
  }

  isEmpty() {
    return this.size === 0;
  }

  isFull() {
    return this.size === this.cap;
  }
}

const q = new CircularQueue(3);
q.enqueue(1); // true
q.enqueue(2); // true
q.enqueue(3); // true
q.enqueue(4); // false
q.rear(); // 3
q.isFull(); // true
q.dequeue(); // true
q.enqueue(4); // true
q.rear(); // 4
q.front(); // 2
```

Dry run with capacity 3.
Slots are shown as indices `0 1 2`, and `.` means unused.

| Call | head | size | Slots | Result |
| --- | --- | --- | --- | --- |
| enqueue(1) | 0 | 1 | `1 . .` | true |
| enqueue(2) | 0 | 2 | `1 2 .` | true |
| enqueue(3) | 0 | 3 | `1 2 3` | true |
| enqueue(4) | 0 | 3 | `1 2 3` | false, full |
| dequeue() | 1 | 2 | `. 2 3` | true |
| enqueue(4) | 1 | 3 | `4 2 3` | true, wrote to slot `(1 + 2) % 3 = 0` |

The last row is the wrap-around.
The queue still reads `2, 3, 4` from the head, even though `4` sits at the lowest index.

### 3.4 Extra Variants

**Overwrite mode ring buffer.**
When full, a push drops the oldest item by advancing `head` instead of failing.

```js
class RingBuffer {
  constructor(cap) {
    this.buf = new Array(cap);
    this.cap = cap;
    this.head = 0;
    this.size = 0;
  }

  push(x) {
    const slot = (this.head + this.size) % this.cap;
    this.buf[slot] = x;
    if (this.size === this.cap) {
      this.head = (this.head + 1) % this.cap;   // overwrote the oldest item
    } else {
      this.size++;
    }
  }

  toArray() {
    const out = [];
    for (let i = 0; i < this.size; i++) out.push(this.buf[(this.head + i) % this.cap]);
    return out;
  }
}

const ring = new RingBuffer(3);
for (const x of [1, 2, 3, 4, 5]) ring.push(x);
ring.toArray(); // [3,4,5]
```

**Moving average from a data stream** (LeetCode 346).
Keep the last `k` values in a ring buffer and a running sum, so each `next` is O(1).

```js
class MovingAverage {
  constructor(k) {
    this.buf = new Array(k).fill(0);
    this.k = k;
    this.count = 0;
    this.sum = 0;
  }

  next(x) {
    const slot = this.count % this.k;           // the oldest value lives here once full
    this.sum += x - this.buf[slot];             // buf[slot] is 0 until the window fills
    this.buf[slot] = x;
    this.count++;
    return this.sum / Math.min(this.count, this.k);
  }
}

const avg = new MovingAverage(3);
avg.next(1); // 1
avg.next(10); // 5.5
avg.next(3); // 4.666666666666667
avg.next(5); // 6
```

**Power-of-two capacity.**
When the capacity is a power of two, `i % cap` equals `i & (cap - 1)`, which avoids a division.
Real ring buffers in drivers and logging libraries use this trick and let `head` and `tail` grow without bound, masking them only when they index the array.

### 3.5 Pitfalls

- **Full versus empty.** `head === tail` is ambiguous without a `size` counter or a spare slot.
- **Modulo of a negative number.** In both JavaScript and Java `-1 % 5` is `-1`, not `4`.
  Compute `(i - 1 + cap) % cap` when stepping backwards, and use `Math.floorMod` in Java.
- **Computing `rear` as `(head + size) % cap`.** That is the next free slot, not the last item.
  The last item is one slot earlier.
- **Dequeue without clearing the slot** keeps a reference alive in a garbage-collected language.
  Set `buf[head] = null` when the items are objects.
- **Moving average on the first `k` calls.** Divide by the number of items seen so far, not by `k`.
- **Capacity zero.** `% 0` is `NaN` in JavaScript and an `ArithmeticException` in Java.
  Reject it in the constructor.

### 3.6 Java Implementation

```java
class CircularQueue {
    private final int[] buf;
    private final int cap;
    private int head = 0;
    private int size = 0;

    CircularQueue(int k) {
        buf = new int[k];
        cap = k;
    }

    boolean enqueue(int x) {
        if (isFull()) return false;
        buf[(head + size) % cap] = x;
        size++;
        return true;
    }

    boolean dequeue() {
        if (isEmpty()) return false;
        head = (head + 1) % cap;
        size--;
        return true;
    }

    int front() {
        return isEmpty() ? -1 : buf[head];
    }

    int rear() {
        return isEmpty() ? -1 : buf[(head + size - 1) % cap];
    }

    boolean isEmpty() {
        return size == 0;
    }

    boolean isFull() {
        return size == cap;
    }
}
```

```java
class RingBuffer {
    private final int[] buf;
    private final int cap;
    private int head = 0;
    private int size = 0;

    RingBuffer(int cap) {
        this.buf = new int[cap];
        this.cap = cap;
    }

    void push(int x) {
        buf[(head + size) % cap] = x;
        if (size == cap) head = (head + 1) % cap;
        else size++;
    }

    List<Integer> toList() {
        List<Integer> out = new ArrayList<>();
        for (int i = 0; i < size; i++) out.add(buf[(head + i) % cap]);
        return out;
    }
}

class MovingAverage {
    private final int[] buf;
    private final int k;
    private int count = 0;
    private long sum = 0;

    MovingAverage(int k) {
        this.buf = new int[k];
        this.k = k;
    }

    double next(int x) {
        int slot = count % k;
        sum += x - buf[slot];
        buf[slot] = x;
        count++;
        return (double) sum / Math.min(count, k);
    }
}
```

```java
static List<Object> queueDemo() {
    CircularQueue q = new CircularQueue(3);
    q.enqueue(1);
    q.enqueue(2);
    q.enqueue(3);
    boolean fourth = q.enqueue(4);
    q.dequeue();
    q.enqueue(4);
    return List.of(fourth, q.front(), q.rear(), q.isFull());
}
// queueDemo() -> [false, 2, 4, true]

static List<Integer> ringDemo() {
    RingBuffer ring = new RingBuffer(3);
    for (int x = 1; x <= 5; x++) ring.push(x);
    return ring.toList();
}
// ringDemo() -> [3, 4, 5]

static List<Double> averageDemo() {
    MovingAverage avg = new MovingAverage(3);
    return List.of(avg.next(1), avg.next(10), avg.next(3), avg.next(5));
}
// averageDemo() -> [1.0, 5.5, 4.666666666666667, 6.0]
```

---

## 4. Bitsets

### 4.1 When to Use

- You store **many yes or no flags indexed by a small integer**: visited sets, primes, seen ids, permissions.
- Memory is the constraint: a boolean array spends 8 bits (or a whole word) per flag, a bitset spends **1 bit**.
- You need fast **set algebra** over whole collections: union, intersection, difference, count.
- Keywords: "sieve", "visited flags for up to 10^7 ids", "bitmask", "which of these 20 items are chosen".

### 4.2 Core Idea

Pack bits into machine words.
With 32-bit words, flag `i` lives in word `i >> 5` (that is `i / 32`) at bit `i & 31` (that is `i % 32`).

```text
flag 37 -> word 37 >> 5 = 1, bit 37 & 31 = 5

word 0: bits  0..31
word 1: bits 32..63   <- bit 5 of this word is flag 37
```

| Operation | Expression | Meaning |
| --- | --- | --- |
| Set bit `b` | `w \|= 1 << b` | Turn it on |
| Clear bit `b` | `w &= ~(1 << b)` | Turn it off |
| Test bit `b` | `(w & (1 << b)) !== 0` | Read it |
| Flip bit `b` | `w ^= 1 << b` | Toggle it |
| Union | `a \|= b` word by word | In either set |
| Intersection | `a &= b` word by word | In both sets |
| Difference | `a &= ~b` word by word | In `a` but not `b` |
| Count | popcount of every word | Number of set bits |

**Popcount with Kernighan's trick.**
`x & (x - 1)` clears the lowest set bit, so looping until `x` is zero counts the set bits in as many steps as there are ones.

| Property | Boolean array | Bitset |
| --- | --- | --- |
| Memory for 10^8 flags | About 100 MB (one byte each) | About 12.5 MB |
| Single flag access | O(1) | O(1), plus a shift and a mask |
| Union of two sets | O(n) | O(n / 32) |
| Count of set flags | O(n) | O(n / 32) words, plus the popcount per word |

### 4.3 Problem: Sieve of Eratosthenes with a Bitset

Count and list the primes up to `n`.
Mark every multiple of each prime as composite.
Start crossing out at `p * p`, because smaller multiples were already marked by smaller primes.

```js
class Bitset {
  constructor(n) {
    this.n = n;
    this.words = new Uint32Array((n + 31) >>> 5);
  }

  #check(i) {
    if (i < 0 || i >= this.n) throw new RangeError(`index ${i} out of range`);
  }

  set(i) {
    this.#check(i);
    this.words[i >>> 5] |= 1 << (i & 31);
  }

  clear(i) {
    this.#check(i);
    this.words[i >>> 5] &= ~(1 << (i & 31));
  }

  test(i) {
    this.#check(i);
    return (this.words[i >>> 5] & (1 << (i & 31))) !== 0;
  }

  count() {
    let total = 0;
    for (let x of this.words) {
      while (x !== 0) {
        x &= x - 1;                       // clear the lowest set bit
        total++;
      }
    }
    return total;
  }

  union(other) {
    for (let i = 0; i < this.words.length; i++) this.words[i] |= other.words[i];
  }

  intersect(other) {
    for (let i = 0; i < this.words.length; i++) this.words[i] &= other.words[i];
  }
}

function primesUpTo(n) {
  const composite = new Bitset(n + 1);
  const primes = [];
  for (let p = 2; p <= n; p++) {
    if (composite.test(p)) continue;
    primes.push(p);
    for (let m = p * p; m <= n; m += p) composite.set(m);
  }
  return primes;
}

primesUpTo(30); // [2,3,5,7,11,13,17,19,23,29]
primesUpTo(50).length; // 15
primesUpTo(1); // []

const bits = new Bitset(100);
bits.set(37);
bits.set(5);
bits.set(99);
bits.test(37); // true
bits.test(36); // false
bits.count(); // 3
bits.clear(37);
bits.count(); // 2
const other = new Bitset(100);
other.set(5);
other.set(6);
bits.intersect(other);
bits.count(); // 1
```

Dry run for `n = 30`.
Only the primes up to `sqrt(30)`, which are 2, 3, and 5, ever start a crossing-out pass.

| p | Already composite? | Marks (starting at p * p) | Result |
| --- | --- | --- | --- |
| 2 | no | 4, 6, 8, ..., 30 | prime |
| 3 | no | 9, 12, 15, 18, 21, 24, 27, 30 | prime |
| 4 | yes | skipped | - |
| 5 | no | 25, 30 | prime |
| 7 | no | 49 is above 30, nothing to mark | prime |
| 11 to 29 | no | `p * p` is above 30 | all prime |

The primes that remain are `[2, 3, 5, 7, 11, 13, 17, 19, 23, 29]`.
Time is O(n log log n), and memory is `n / 8` bytes.

### 4.4 Extra Variants

**A whole subset in one integer.**
When there are at most 31 items, one `int` is already a bitset.
Bit `i` means "item `i` is chosen".
Dynamic programming over subsets (traveling salesman, assignment problems) uses this as the state.

```js
function subsetSums(nums) {
  const n = nums.length;
  const sums = [];
  for (let mask = 0; mask < (1 << n); mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sum += nums[i];     // item i is in this subset
    }
    sums.push(sum);
  }
  return sums;
}

subsetSums([1, 2, 4]); // [0,1,2,3,4,5,6,7]
```

**Count set bits in a number** (LeetCode 191), the same Kernighan loop on a single word.

```js
function hammingWeight(x) {
  let count = 0;
  while (x !== 0) {
    x &= x - 1;
    count++;
  }
  return count;
}

hammingWeight(11); // 3
hammingWeight(128); // 1
```

**Visited set for dense integer ids.**
A graph with ids `0..n-1` and `n` in the millions can use a bitset for `visited` and fit in cache.

### 4.5 Pitfalls

- **Shift count wraps.** In JavaScript `1 << 32` is `1`, because the count is taken modulo 32.
  In Java `1 << 32` is also `1`, and `1L << 64` is `1L`.
  Never shift by a value that can reach the word size.
- **Bit 31 is the sign bit.** In JavaScript `1 << 31` is a negative number.
  It still works with `|`, `&`, and `!== 0`, but never compare against `> 0`, and use `>>>` when you need an unsigned value.
- **Out-of-range indexes are silent.** A typed array ignores writes past its end and returns `undefined` on reads.
  Check the index, as the class above does.
- **Precedence.** `w & 1 << b` parses as `w & (1 << b)`, but `w & mask === 0` parses as `w & (mask === 0)`.
  Wrap bit tests in parentheses.
- **Using `%` and `/` on negative numbers.** `i >> 5` rounds toward negative infinity and `i / 32` does not.
  Bitsets only accept non-negative indexes.
- **Sieve inner loop starting at `2 * p`.** It works but repeats earlier work, and `p * p` can overflow a 32-bit `int` when `n` is near 2^31.
  Use `long` in Java for `p * p`.

### 4.6 Java Implementation

A hand-written bitset over `long` words.
`1L << i` already uses only the low 6 bits of `i`, so `bit & 63` is implicit, but writing it keeps the intent clear.

```java
class Bitset {
    private final int n;
    private final long[] words;

    Bitset(int n) {
        this.n = n;
        this.words = new long[(n + 63) >>> 6];
    }

    private void check(int i) {
        if (i < 0 || i >= n) throw new IndexOutOfBoundsException("index " + i);
    }

    void set(int i) {
        check(i);
        words[i >>> 6] |= 1L << (i & 63);
    }

    void clear(int i) {
        check(i);
        words[i >>> 6] &= ~(1L << (i & 63));
    }

    boolean test(int i) {
        check(i);
        return (words[i >>> 6] & (1L << (i & 63))) != 0;
    }

    int count() {
        int total = 0;
        for (long w : words) total += Long.bitCount(w);
        return total;
    }

    void intersect(Bitset other) {
        for (int i = 0; i < words.length; i++) words[i] &= other.words[i];
    }
}
```

```java
static List<Integer> primesUpTo(int n) {
    Bitset composite = new Bitset(n + 1);
    List<Integer> primes = new ArrayList<>();
    for (int p = 2; p <= n; p++) {
        if (composite.test(p)) continue;
        primes.add(p);
        for (long m = (long) p * p; m <= n; m += p) composite.set((int) m);
    }
    return primes;
}
// primesUpTo(30) -> [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]

static int primeCount(int n) {
    return primesUpTo(n).size();
}
// primeCount(50) -> 15

static int bitsetDemo() {
    Bitset bits = new Bitset(100);
    bits.set(37);
    bits.set(5);
    bits.set(99);
    bits.clear(37);
    Bitset other = new Bitset(100);
    other.set(5);
    other.set(6);
    bits.intersect(other);
    return bits.count();
}
// bitsetDemo() -> 1

static int hammingWeight(int x) {
    int count = 0;
    while (x != 0) {
        x &= x - 1;
        count++;
    }
    return count;
}
// hammingWeight(11) -> 3
```

Java ships `java.util.BitSet`, which grows on demand.
Use it when a library is allowed.

```java
static List<Object> bitSetDemo() {
    BitSet bits = new BitSet();
    bits.set(5);
    bits.set(37);
    bits.set(99);
    BitSet other = new BitSet();
    other.set(5);
    other.set(6);
    boolean had37 = bits.get(37);
    bits.and(other);                 // intersection, in place
    return List.of(had37, bits.cardinality(), bits.nextSetBit(0));
}
// bitSetDemo() -> [true, 1, 5]
```

| `BitSet` method | Meaning |
| --- | --- |
| `set(i)`, `clear(i)`, `get(i)`, `flip(i)` | Single bit operations |
| `set(from, to)` | Set a half-open range |
| `cardinality()` | Number of set bits |
| `nextSetBit(i)`, `nextClearBit(i)` | Scan forward, `-1` when none |
| `and`, `or`, `xor`, `andNot` | In-place set algebra |

---

## 5. Java Pitfalls

- **`==` on objects compares addresses.** Use `equals` for `String`, `List`, and boxed numbers.
  `Integer` values from -128 to 127 are cached, so `==` appears to work for small values and then fails.
- **Arrays are references.** `int[] b = a` aliases.
  Use `Arrays.copyOf`, `clone`, or `System.arraycopy` for a real copy.
- **`NullPointerException` from unboxing.** `int x = map.get(key)` throws when the key is missing.
  Use `getOrDefault`.
- **Modulo of a negative.** `(head - 1) % cap` can be negative.
  Use `Math.floorMod(head - 1, cap)`.
- **`int` overflow in `p * p` or `(1 << 31)`.** Promote to `long` before multiplying and shift a `1L`.
- **`Queue` interface and `null`.** `ArrayDeque` rejects `null`, which matters when a circular buffer stores optional values.
- **`LinkedList` is a doubly linked list.** It supports O(1) `removeFirst` and `removeLast`, but `get(i)` is O(n), and its nodes are scattered in memory.
  Prefer `ArrayDeque` for plain queues and stacks.

---

## 6. Quick Recap

| Topic | Signal in the problem | Core tool | Time | Space |
| --- | --- | --- | --- | --- |
| Memory and pointers | Aliasing bugs, why indexing is O(1), `null` errors | Address arithmetic, references, copy versus share | - | - |
| Doubly linked list | Remove a held node in O(1), traverse both ways, LRU | Sentinels plus four-write `insertAfter` | O(1) per operation | O(n) |
| Circular buffer | Fixed capacity queue, last k items | `head` and `size`, wrap with `%` | O(1) per operation | O(k) |
| Bitset | Dense integer flags, sieve, set algebra | Word `i >> 5`, bit `i & 31`, Kernighan popcount | O(1) per flag, O(n / w) per scan | O(n / 8) bytes |

Next: [Subarrays and String Matching](/docs/dsa/subarrays-and-string-matching) for Kadane, naive and Rabin-Karp matching, and KMP, or the [Hashing Deep Dive](/docs/dsa/hashing-deep-dive), which reuses the bitset for Bloom filters.
