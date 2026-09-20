---
title: "Java Collections, Generics, and Streams"
description: "Java Collections Framework, HashMap internals, generics, lambdas, functional interfaces, streams, and Optional for interviews."
---

# 📘 Java Collections, Generics, and Streams

## Table of Contents

1. [Collections Framework Overview](#1-collections-framework-overview)
2. [List](#2-list)
3. [Set](#3-set)
4. [Queue and Deque](#4-queue-and-deque)
5. [Map](#5-map)
6. [HashMap Internals](#6-hashmap-internals)
7. [Complexity Cheat Sheet](#7-complexity-cheat-sheet)
8. [Sorting: Comparable vs Comparator](#8-sorting-comparable-vs-comparator)
9. [Iteration and Fail-Fast Behavior](#9-iteration-and-fail-fast-behavior)
10. [Immutable and Unmodifiable Collections](#10-immutable-and-unmodifiable-collections)
11. [Generics](#11-generics)
12. [Lambdas and Functional Interfaces](#12-lambdas-and-functional-interfaces)
13. [Streams](#13-streams)
14. [Optional](#14-optional)
15. [Common Pitfalls](#15-common-pitfalls)
16. [Common Interview Questions](#16-common-interview-questions)
17. [One-Line Senior Summary](#17-one-line-senior-summary)

---

## 1. Collections Framework Overview

```text
Iterable
  |- Collection
       |- List           ordered, allows duplicates       (ArrayList, LinkedList)
       |- Set            no duplicates                    (HashSet, LinkedHashSet, TreeSet)
       |- Queue          FIFO-style processing            (ArrayDeque, PriorityQueue, LinkedList)
            |- Deque     double-ended queue               (ArrayDeque, LinkedList)

Map (NOT a Collection)   key -> value pairs               (HashMap, LinkedHashMap, TreeMap)
```

- Always **program to the interface**: `List<String> names = new ArrayList<>();`, so the implementation can change without touching callers.
- `Collection` is the interface, `Collections` is a utility class with static helpers (`sort`, `reverse`, `unmodifiableList`, ...).
- Collections hold **objects only**, so primitives are autoboxed (`List<Integer>`).

---

## 2. List

An ordered collection that allows duplicates and access by index.

### 2.1 ArrayList

Backed by a **resizable array**.

```java
List<String> names = new ArrayList<>();
names.add("Ann");
names.add("Bob");
names.add(1, "Cat");          // insert at index, shifts elements right
names.get(0);                 // O(1)
names.remove("Bob");          // remove by object, O(n)
names.remove(0);              // remove by index, O(n)
names.contains("Ann");        // O(n)
names.indexOf("Ann");
```

- **Random access is O(1)**, and appending is **amortized O(1)**.
- Inserting or removing in the middle is **O(n)** because elements shift.
- The default capacity is 10 (allocated lazily on first add), and when full the array grows by about **1.5x** and is copied.
- If you know the size, pass it up front: `new ArrayList<>(10_000)` avoids repeated resizing.

Watch out for the `remove` overload trap on `List<Integer>`:

```java
List<Integer> nums = new ArrayList<>(List.of(10, 20, 30));
nums.remove(1);                    // removes the element at INDEX 1 (20)
nums.remove(Integer.valueOf(10));  // removes the VALUE 10
```

### 2.2 LinkedList

A **doubly linked list** that implements both `List` and `Deque`.

- Adding or removing at the ends is O(1), and `get(i)` is **O(n)** because it must walk the nodes.
- Each element costs an extra node object with two pointers, so it uses more memory and has poor cache locality.
- In practice `ArrayList` (or `ArrayDeque` for queues) is faster in almost every real workload, so `LinkedList` is rarely the right choice.

### 2.3 Other Lists

| Class | Notes |
| --- | --- |
| `Vector` | Legacy, synchronized methods, avoid. |
| `Stack` | Legacy, extends `Vector`. Use `ArrayDeque` as a stack instead. |
| `CopyOnWriteArrayList` | Thread-safe, copies the array on every write. Good for many reads and few writes (listeners). |

---

## 3. Set

A collection with **no duplicates**, where uniqueness is decided by `equals` and `hashCode` (or the comparator for tree sets).

| Implementation | Ordering | Backing structure | add / contains |
| --- | --- | --- | --- |
| `HashSet` | None | `HashMap` | O(1) average |
| `LinkedHashSet` | **Insertion order** | `HashMap` + linked list | O(1) |
| `TreeSet` | **Sorted** (natural order or comparator) | Red-black tree | O(log n) |

```java
Set<String> set = new HashSet<>();
set.add("a");
set.add("a");                     // returns false, duplicate ignored
System.out.println(set.size());   // 1

Set<Integer> sorted = new TreeSet<>(List.of(5, 1, 3));
System.out.println(sorted);       // [1, 3, 5]

TreeSet<Integer> ts = new TreeSet<>(List.of(10, 20, 30, 40));
ts.first();          // 10
ts.floor(25);        // 20 (greatest element <= 25)
ts.ceiling(25);      // 30 (smallest element >= 25)
ts.headSet(30);      // [10, 20]
```

Common set operations:

```java
Set<Integer> a = new HashSet<>(Set.of(1, 2, 3));
Set<Integer> b = Set.of(2, 3, 4);

a.retainAll(b);   // intersection: [2, 3]
a.addAll(b);      // union
a.removeAll(b);   // difference
```

A `HashSet` of custom objects only works correctly if the class overrides **both** `equals` and `hashCode`.

---

## 4. Queue and Deque

`Queue` is FIFO: `offer` adds at the tail, `poll` removes from the head.

| Operation | Throws on failure | Returns special value |
| --- | --- | --- |
| Insert | `add(e)` | `offer(e)` |
| Remove head | `remove()` | `poll()` (null if empty) |
| Examine head | `element()` | `peek()` (null if empty) |

```java
Queue<String> queue = new ArrayDeque<>();
queue.offer("a");
queue.offer("b");
queue.poll();       // "a"
queue.peek();       // "b"

// Deque as a stack (LIFO), preferred over the legacy Stack class
Deque<Integer> stack = new ArrayDeque<>();
stack.push(1);
stack.push(2);
stack.pop();        // 2
```

`ArrayDeque` is a resizable circular array, it is faster than both `LinkedList` and `Stack`, and it does not allow `null`.

### 4.1 PriorityQueue

A **binary min-heap**: `poll()` always returns the smallest element (by natural order or a comparator).
`offer`/`poll` are O(log n), and `peek` is O(1).
Iterating over it does **not** give sorted order, only the head is guaranteed to be the smallest.

```java
PriorityQueue<Integer> minHeap = new PriorityQueue<>();
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());

minHeap.addAll(List.of(5, 1, 3));
minHeap.poll();   // 1

// Top-K style problems
PriorityQueue<Task> tasks = new PriorityQueue<>(Comparator.comparingInt(Task::getPriority));
```

---

## 5. Map

A `Map<K, V>` stores **unique keys** mapped to values.
It is not part of the `Collection` hierarchy.

| Implementation | Ordering | Null keys/values | Get / put |
| --- | --- | --- | --- |
| `HashMap` | None | 1 null key, null values | O(1) average |
| `LinkedHashMap` | Insertion order (or access order) | Yes | O(1) |
| `TreeMap` | Sorted by key | No null key | O(log n) |
| `Hashtable` | None | **No nulls** | Legacy, synchronized, avoid |
| `ConcurrentHashMap` | None | **No nulls** | Thread-safe, scalable |

```java
Map<String, Integer> stock = new HashMap<>();
stock.put("apple", 5);
stock.get("apple");                       // 5
stock.get("pear");                        // null
stock.getOrDefault("pear", 0);            // 0
stock.containsKey("apple");
stock.remove("apple");

// Modern helpers, prefer these over manual get/put
stock.putIfAbsent("kiwi", 1);
stock.computeIfAbsent("mango", k -> 10);          // compute only when key is missing
stock.merge("kiwi", 1, Integer::sum);             // increment or insert
stock.compute("kiwi", (k, v) -> v == null ? 1 : v + 1);
```

### 5.1 Iterating a Map

```java
for (Map.Entry<String, Integer> e : stock.entrySet()) {     // best: one pass, key and value together
    System.out.println(e.getKey() + " = " + e.getValue());
}

stock.forEach((k, v) -> System.out.println(k + " = " + v));

for (String key : stock.keySet()) { /* ... */ }
for (int value : stock.values()) { /* ... */ }
```

### 5.2 Word Frequency Example

```java
String text = "to be or not to be";
Map<String, Integer> freq = new HashMap<>();
for (String word : text.split(" ")) {
    freq.merge(word, 1, Integer::sum);
}
System.out.println(freq);   // {not=1, or=1, be=2, to=2}  (HashMap order is unspecified)
```

### 5.3 LinkedHashMap as an LRU Cache

Constructing with `accessOrder = true` moves each accessed entry to the end, and `removeEldestEntry` evicts the least-recently-used entry.

```java
class LruCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;

    LruCache(int capacity) {
        super(16, 0.75f, true);          // true = access order
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }
}

LruCache<String, Integer> cache = new LruCache<>(2);
cache.put("a", 1);
cache.put("b", 2);
cache.get("a");          // "a" becomes most recently used
cache.put("c", 3);       // evicts "b"
System.out.println(cache.keySet());   // [a, c]
```

### 5.4 TreeMap Navigation

```java
TreeMap<Integer, String> grades = new TreeMap<>();
grades.put(90, "A");
grades.put(80, "B");
grades.put(70, "C");

grades.floorEntry(85);      // 80=B  (greatest key <= 85)
grades.ceilingEntry(85);    // 90=A
grades.firstKey();          // 70
grades.headMap(90);         // {70=C, 80=B}
```

---

## 6. HashMap Internals

This is the single most asked Java collections interview topic.

### 6.1 Structure

A `HashMap` is an **array of buckets** (the table).
Each bucket holds a linked list of nodes, or a red-black tree when it gets long.

### 6.2 put(key, value) Step by Step

1. Compute `key.hashCode()`, then **spread** it: `h ^ (h >>> 16)`, so high bits influence the index.
2. Compute the bucket index: `(n - 1) & hash`, where `n` is the table length (always a **power of two**, so this is a fast modulo).
3. If the bucket is empty, place a new node there.
4. Otherwise, walk the bucket. If a node has an equal hash **and** `key.equals(existingKey)`, replace its value. If not, append a new node.
5. If the bucket now has **8 or more** nodes **and** the table has at least **64** buckets, convert the bucket to a **red-black tree** (worst case drops from O(n) to O(log n)). If the table is smaller than 64, it resizes instead.
6. If `size > capacity * loadFactor`, **resize**.

### 6.3 Key Numbers

| Parameter | Value |
| --- | --- |
| Default initial capacity | 16 |
| Default load factor | **0.75** |
| Resize | Doubles the table and redistributes entries, **rehashing** each node |
| Treeify threshold | 8 nodes in a bucket (and table size at least 64) |
| Untreeify threshold | 6 nodes |

A load factor of 0.75 is a trade-off between memory (lower means more wasted space) and lookup speed (higher means more collisions).
If you know the expected size, pre-size the map: `new HashMap<>((int) (expected / 0.75f) + 1)`, or use `HashMap.newHashMap(expected)` on Java 19+.

### 6.4 Why equals and hashCode Matter

```java
Map<Point, String> map = new HashMap<>();
Point key = new Point(1, 2);
map.put(key, "A");

key.setX(99);              // mutated a key used in hashCode!
map.get(key);              // null: hash changed, we now look in the wrong bucket
```

- Lookup goes hash to bucket first, then `equals` inside the bucket.
- **Use immutable keys** (`String`, `Integer`, records) whenever possible.
- Bad hash functions (for example returning a constant) put everything in one bucket, giving O(n), or O(log n) with treeification.

### 6.5 Thread Safety

`HashMap` is **not thread-safe**.
Concurrent writes can lose updates, and in older versions a concurrent resize could even produce an infinite loop.
Use `ConcurrentHashMap` (see the concurrency notes) or wrap with `Collections.synchronizedMap`.

### 6.6 HashMap vs Hashtable vs ConcurrentHashMap

| | HashMap | Hashtable | ConcurrentHashMap |
| --- | --- | --- | --- |
| Thread-safe | No | Yes (locks the whole table) | Yes (fine-grained: CAS and per-bucket locking) |
| Null key/value | Allowed | Not allowed | Not allowed |
| Performance | Fastest single-threaded | Slow under contention | Scales well with many threads |
| Status | Default choice | Legacy | Default for concurrent use |

---

## 7. Complexity Cheat Sheet

| Structure | get / access | add | remove | contains |
| --- | --- | --- | --- | --- |
| `ArrayList` | O(1) | O(1) amortized (end) | O(n) | O(n) |
| `LinkedList` | O(n) | O(1) at ends | O(1) at ends (O(n) to find) | O(n) |
| `HashSet` / `HashMap` | O(1) avg | O(1) avg | O(1) avg | O(1) avg |
| `TreeSet` / `TreeMap` | O(log n) | O(log n) | O(log n) | O(log n) |
| `ArrayDeque` | O(1) at ends | O(1) at ends | O(1) at ends | O(n) |
| `PriorityQueue` | O(1) peek | O(log n) | O(log n) poll | O(n) |

---

## 8. Sorting: Comparable vs Comparator

| | `Comparable<T>` | `Comparator<T>` |
| --- | --- | --- |
| Where | Implemented **by the class itself** | A separate object |
| Method | `int compareTo(T other)` | `int compare(T a, T b)` |
| Ordering | One **natural** order | Any number of custom orders |
| Use when | There is an obvious default (dates, numbers, names) | Sorting by different fields, or you cannot edit the class |

The return value is negative, zero, or positive when the first is less than, equal to, or greater than the second.

```java
public class Employee implements Comparable<Employee> {
    private final String name;
    private final int salary;

    Employee(String name, int salary) { this.name = name; this.salary = salary; }
    String getName() { return name; }
    int getSalary() { return salary; }

    @Override
    public int compareTo(Employee other) {
        return Integer.compare(this.salary, other.salary);   // natural order: salary ascending
    }
}

List<Employee> staff = new ArrayList<>(/* ... */);
Collections.sort(staff);        // uses compareTo

staff.sort(Comparator.comparing(Employee::getName));                       // by name
staff.sort(Comparator.comparingInt(Employee::getSalary).reversed());       // salary descending
staff.sort(Comparator
        .comparing(Employee::getSalary, Comparator.reverseOrder())
        .thenComparing(Employee::getName));                                // salary desc, then name asc
staff.sort(Comparator.comparing(Employee::getName, Comparator.nullsLast(Comparator.naturalOrder())));
```

Don't compute a comparison with subtraction (`a.salary - b.salary`), it can overflow.
Use `Integer.compare(a, b)` instead.

`Collections.sort` and `List.sort` use **TimSort**: stable, O(n log n) worst case, and close to O(n) on nearly sorted data.

---

## 9. Iteration and Fail-Fast Behavior

Structurally modifying most collections while iterating them throws **`ConcurrentModificationException`**.

```java
List<Integer> nums = new ArrayList<>(List.of(1, 2, 3, 4));

for (Integer n : nums) {
    if (n % 2 == 0) nums.remove(n);          // ConcurrentModificationException
}

// Fix 1: iterator.remove()
Iterator<Integer> it = nums.iterator();
while (it.hasNext()) {
    if (it.next() % 2 == 0) it.remove();
}

// Fix 2 (best): removeIf
nums.removeIf(n -> n % 2 == 0);

// Fix 3: iterate a copy, or collect to a new list with streams
```

`ArrayList`, `HashMap`, and friends are **fail-fast** (they detect changes via an internal `modCount`, on a best-effort basis).
Concurrent collections such as `CopyOnWriteArrayList` and `ConcurrentHashMap` are **weakly consistent** and never throw this exception.

---

## 10. Immutable and Unmodifiable Collections

```java
List<String> a = List.of("x", "y");                  // Java 9+: truly immutable, no nulls allowed
Set<Integer> s = Set.of(1, 2, 3);
Map<String, Integer> m = Map.of("a", 1, "b", 2);
Map<String, Integer> big = Map.ofEntries(Map.entry("a", 1), Map.entry("b", 2));

List<String> copy = List.copyOf(source);             // immutable snapshot copy

List<String> view = Collections.unmodifiableList(source);   // read-only VIEW of source
source.add("new");                                          // the view now shows "new" too!

List<String> fixed = Arrays.asList("a", "b");        // fixed size, set allowed, add/remove throws
```

| | Mutates through it? | Reflects changes to the original? |
| --- | --- | --- |
| `List.of` / `List.copyOf` | No | No (independent) |
| `Collections.unmodifiableList` | No | **Yes** (it is a view) |
| `Arrays.asList` | `set` only | Writes through to the array |

Iteration order of `Set.of` and `Map.of` is deliberately randomized per JVM run, never depend on it.

---

## 11. Generics

Generics add **compile-time type safety** and remove casts.

```java
// Before generics: unsafe
List raw = new ArrayList();
raw.add("text");
Integer i = (Integer) raw.get(0);      // ClassCastException at runtime

// With generics: caught at compile time
List<String> safe = new ArrayList<>();
safe.add("text");
// safe.add(42);                       // compile error
```

### 11.1 Generic Classes and Methods

```java
public class Box<T> {
    private T value;
    public Box(T value) { this.value = value; }
    public T get() { return value; }
}

Box<String> box = new Box<>("hi");

// Generic method: the type parameter is declared before the return type
public static <T> T firstOrDefault(List<T> list, T fallback) {
    return list.isEmpty() ? fallback : list.get(0);
}

// Bounded type: T must be Comparable to itself
public static <T extends Comparable<T>> T max(T a, T b) {
    return a.compareTo(b) >= 0 ? a : b;
}

max(3, 7);           // 7
max("pear", "apple"); // pear
```

### 11.2 Wildcards and PECS

Generics are **invariant**: `List<Integer>` is **not** a `List<Number>`, even though `Integer` extends `Number`.
Wildcards relax that:

| Syntax | Meaning | You can |
| --- | --- | --- |
| `List<?>` | Unknown type | Read as `Object`, add nothing (except `null`) |
| `List<? extends Number>` | Number or any subtype (**upper bound**) | **Read** as `Number`, cannot add |
| `List<? super Integer>` | Integer or any supertype (**lower bound**) | **Add** `Integer`, read only as `Object` |

**PECS: Producer Extends, Consumer Super.**

```java
// src PRODUCES values we read, dest CONSUMES values we write
public static <T> void copy(List<? extends T> src, List<? super T> dest) {
    for (T item : src) {
        dest.add(item);
    }
}

double sum(List<? extends Number> numbers) {     // works for List<Integer>, List<Double>, ...
    double total = 0;
    for (Number n : numbers) total += n.doubleValue();
    return total;
}
```

### 11.3 Type Erasure

Generic type information exists only at **compile time**.
The compiler erases it to the bound (or `Object`) and inserts casts, so at runtime `List<String>` and `List<Integer>` are both just `List`.

Consequences:

- `new T()`, `new T[n]`, and `T.class` are not allowed.
- `instanceof List<String>` is not allowed (only `instanceof List<?>`).
- You cannot overload `void f(List<String>)` and `void f(List<Integer>)`, they have the same erasure.
- Primitives cannot be type arguments (`List<int>` is illegal).

```java
List<String> a = new ArrayList<>();
List<Integer> b = new ArrayList<>();
System.out.println(a.getClass() == b.getClass());   // true
```

Avoid **raw types** (`List` with no type argument), they disable type checking and exist only for legacy code.

---

## 12. Lambdas and Functional Interfaces

A **functional interface** has exactly one abstract method.
A **lambda** is a concise implementation of it.

```java
// Anonymous class
Comparator<String> c1 = new Comparator<>() {
    @Override public int compare(String a, String b) { return a.length() - b.length(); }
};

// Lambda
Comparator<String> c2 = (a, b) -> Integer.compare(a.length(), b.length());

Runnable r = () -> System.out.println("hi");
```

### 12.1 Core Functional Interfaces (java.util.function)

| Interface | Method | Meaning | Example |
| --- | --- | --- | --- |
| `Function<T, R>` | `R apply(T)` | Transform | `s -> s.length()` |
| `Predicate<T>` | `boolean test(T)` | Test a condition | `n -> n > 0` |
| `Consumer<T>` | `void accept(T)` | Use a value, return nothing | `s -> System.out.println(s)` |
| `Supplier<T>` | `T get()` | Produce a value | `() -> new ArrayList<>()` |
| `BiFunction<T, U, R>` | `R apply(T, U)` | Two inputs | `(a, b) -> a + b` |
| `UnaryOperator<T>` | `T apply(T)` | `Function<T, T>` | `s -> s.trim()` |
| `BinaryOperator<T>` | `T apply(T, T)` | `BiFunction<T, T, T>` | `Integer::sum` |

Primitive specializations (`IntPredicate`, `ToIntFunction`, `IntSupplier`, ...) avoid boxing.

```java
Function<Integer, Integer> doubler = x -> x * 2;
Function<Integer, Integer> plusOne = x -> x + 1;
doubler.andThen(plusOne).apply(5);    // (5 * 2) + 1 = 11
doubler.compose(plusOne).apply(5);    // (5 + 1) * 2 = 12

Predicate<String> notEmpty = s -> !s.isEmpty();
Predicate<String> shortStr = s -> s.length() < 5;
notEmpty.and(shortStr).test("java");   // true
notEmpty.negate().test("");            // true
```

Your own functional interfaces should be annotated `@FunctionalInterface` so the compiler enforces the single-abstract-method rule.

### 12.2 Method References

| Kind | Syntax | Equivalent lambda |
| --- | --- | --- |
| Static method | `Integer::parseInt` | `s -> Integer.parseInt(s)` |
| Instance method of a particular object | `System.out::println` | `x -> System.out.println(x)` |
| Instance method of an arbitrary object of a type | `String::toUpperCase` | `s -> s.toUpperCase()` |
| Constructor | `ArrayList::new` | `() -> new ArrayList<>()` |

### 12.3 Capturing Variables

Lambdas can only use local variables that are **effectively final**.

```java
int base = 10;
Function<Integer, Integer> add = x -> x + base;   // OK
// base++;                                        // would make the lambda above a compile error
```

To accumulate state across calls, use an `AtomicInteger`, an array, or (better) a stream reduction instead of a mutable captured variable.

---

## 13. Streams

A **stream** is a lazily evaluated pipeline of operations over a data source.
It is not a data structure, and it does not modify the source.

Pipeline shape: **source -> zero or more intermediate operations -> one terminal operation**.

```java
List<String> result = people.stream()          // source
        .filter(p -> p.getAge() >= 18)         // intermediate (lazy)
        .map(Person::getName)                  // intermediate (lazy)
        .sorted()                              // intermediate
        .collect(Collectors.toList());         // terminal: triggers execution
```

- **Intermediate operations** are lazy and return a new stream: `filter`, `map`, `flatMap`, `distinct`, `sorted`, `limit`, `skip`, `peek`.
- **Terminal operations** trigger the pipeline and consume the stream: `collect`, `forEach`, `reduce`, `count`, `min`, `max`, `findFirst`, `anyMatch`, `toList`.
- Elements flow **one at a time through the whole pipeline** (not stage by stage), and short-circuiting ops like `limit` and `findFirst` stop early.
- A stream can be consumed **once**. Reusing it throws `IllegalStateException`.

### 13.1 Creating Streams

```java
List.of(1, 2, 3).stream();
Arrays.stream(new int[]{1, 2, 3});                // IntStream
Stream.of("a", "b", "c");
IntStream.range(0, 5);                            // 0..4
IntStream.rangeClosed(1, 5);                      // 1..5
Stream.iterate(1, x -> x * 2).limit(5);           // 1, 2, 4, 8, 16
Stream.generate(Math::random).limit(3);
"hello".chars();                                  // IntStream of char codes
```

### 13.2 Common Intermediate Operations

```java
List<Integer> nums = List.of(1, 2, 3, 4, 5, 6);

nums.stream().filter(n -> n % 2 == 0).toList();              // [2, 4, 6]
nums.stream().map(n -> n * n).toList();                      // [1, 4, 9, 16, 25, 36]
nums.stream().skip(2).limit(3).toList();                     // [3, 4, 5]
List.of(3, 1, 3, 2).stream().distinct().sorted().toList();   // [1, 2, 3]

// flatMap: flatten nested collections into one stream
List<List<Integer>> nested = List.of(List.of(1, 2), List.of(3), List.of(4, 5));
nested.stream().flatMap(List::stream).toList();              // [1, 2, 3, 4, 5]
```

`map` is one-to-one, while `flatMap` is one-to-many and flattens the result.

### 13.3 Terminal Operations

```java
nums.stream().count();                                        // 6
nums.stream().anyMatch(n -> n > 5);                           // true
nums.stream().allMatch(n -> n > 0);                           // true
nums.stream().noneMatch(n -> n > 10);                         // true
nums.stream().findFirst();                                    // Optional[1]
nums.stream().max(Integer::compare);                          // Optional[6]
nums.stream().reduce(0, Integer::sum);                        // 21
nums.stream().mapToInt(Integer::intValue).sum();              // 21  (primitive stream, no boxing)
nums.stream().mapToInt(Integer::intValue).average();          // OptionalDouble[3.5]
nums.stream().mapToInt(Integer::intValue).summaryStatistics(); // count, sum, min, avg, max
nums.forEach(System.out::println);
```

### 13.4 Collectors

```java
record Employee(String name, String dept, int salary) {}

List<Employee> emps = List.of(
    new Employee("Ann", "ENG", 120),
    new Employee("Bob", "ENG", 100),
    new Employee("Cat", "HR", 80)
);

// To collections
emps.stream().map(Employee::name).collect(Collectors.toList());
emps.stream().map(Employee::dept).collect(Collectors.toSet());
emps.stream().collect(Collectors.toMap(Employee::name, Employee::salary));
// toMap throws IllegalStateException on duplicate keys unless you pass a merge function:
emps.stream().collect(Collectors.toMap(Employee::dept, Employee::salary, Integer::sum));

// Joining strings
emps.stream().map(Employee::name).collect(Collectors.joining(", ", "[", "]"));   // [Ann, Bob, Cat]

// Grouping
Map<String, List<Employee>> byDept =
    emps.stream().collect(Collectors.groupingBy(Employee::dept));

Map<String, Long> countByDept =
    emps.stream().collect(Collectors.groupingBy(Employee::dept, Collectors.counting()));
// {HR=1, ENG=2}  (groupingBy returns a HashMap, so key order is unspecified)

Map<String, Integer> totalByDept =
    emps.stream().collect(Collectors.groupingBy(Employee::dept, Collectors.summingInt(Employee::salary)));
// {HR=80, ENG=220}

Map<String, Double> avgByDept =
    emps.stream().collect(Collectors.groupingBy(Employee::dept, Collectors.averagingInt(Employee::salary)));

// Map each group to a different value
Map<String, List<String>> namesByDept = emps.stream().collect(
    Collectors.groupingBy(Employee::dept, Collectors.mapping(Employee::name, Collectors.toList())));

// Partition into exactly two groups: true and false
Map<Boolean, List<Employee>> highLow =
    emps.stream().collect(Collectors.partitioningBy(e -> e.salary() >= 100));
```

`Stream.toList()` (Java 16+) returns an **unmodifiable** list, while `Collectors.toList()` makes no such guarantee.

### 13.5 Worked Example: Top 2 Earners

```java
List<String> top2 = emps.stream()
        .sorted(Comparator.comparingInt(Employee::salary).reversed())
        .limit(2)
        .map(Employee::name)
        .toList();
// [Ann, Bob]
```

### 13.6 Parallel Streams

`list.parallelStream()` or `stream.parallel()` splits the work across the common `ForkJoinPool`.

Use it only when **all** of these are true:

- The data set is large and the per-element work is CPU-heavy.
- The source splits well (`ArrayList`, arrays, `IntStream.range`, not `LinkedList`).
- The operations are **stateless, non-interfering, and side-effect free**.

Do not use it for I/O or blocking calls, small collections, or code that mutates shared state.
It also shares one common pool across the whole JVM, so a slow task can starve others.
Measure before adopting it.

```java
// BUG: mutating a shared, non-thread-safe list from a parallel stream
List<Integer> out = new ArrayList<>();
IntStream.range(0, 1000).parallel().forEach(out::add);   // lost updates or exceptions

// Fix: let the stream collect
List<Integer> ok = IntStream.range(0, 1000).parallel().boxed().toList();
```

### 13.7 Stream Gotchas

- Avoid side effects in `map` and `filter`, and never rely on `peek` for logic (it is for debugging).
- Nothing happens until a terminal operation runs: a pipeline with only intermediate ops does nothing.
- `Stream` is not a replacement for a plain `for` loop when the loop is simpler, needs early `break` with state, or throws checked exceptions.

---

## 14. Optional

`Optional<T>` is a container that may or may not hold a value, used as a **return type** to make "no result" explicit.

```java
Optional<User> findUser(String id) { /* ... */ }

Optional<User> maybe = findUser("42");

maybe.isPresent();                                  // true or false
maybe.orElse(defaultUser);                          // value or fallback (fallback ALWAYS evaluated)
maybe.orElseGet(() -> createDefaultUser());         // fallback computed lazily
maybe.orElseThrow(() -> new NotFoundException("42"));
maybe.ifPresent(u -> System.out.println(u.getName()));
maybe.ifPresentOrElse(u -> log(u), () -> log("missing"));   // Java 9+

// Transform without null checks
String city = findUser("42")
        .map(User::getAddress)
        .map(Address::getCity)
        .orElse("Unknown");

Optional.of(value);          // throws NullPointerException if value is null
Optional.ofNullable(value);  // empty if null
Optional.empty();
```

Guidelines:

- Use `Optional` for **return types**, not for fields, method parameters, or collections (return an empty collection instead).
- Never call `get()` without checking, prefer `orElseThrow()` or `map`/`orElse`.
- Do not return `null` from a method that returns `Optional`.
- Primitive versions `OptionalInt`, `OptionalDouble`, `OptionalLong` avoid boxing.

---

## 15. Common Pitfalls

- Using a mutable object as a `HashMap` key or `HashSet` element and then changing it.
- Removing from a list inside an enhanced `for` loop.
- `list.remove(int)` vs `list.remove(Object)` confusion with `List<Integer>`.
- Assuming `HashMap`, `HashSet`, `Set.of`, or `Map.of` iteration order is stable.
- Using `LinkedList` for random access or as a general default.
- Treating `Collections.unmodifiableList` as immutable when the underlying list can still change.
- Reusing a stream, or forgetting the terminal operation.
- Using parallel streams for tiny or blocking workloads.
- Using `Collectors.toMap` without a merge function when keys can repeat.
- Calling `Optional.get()` blindly, or using `Optional` as a field or parameter type.
- Comparators that subtract integers, which can overflow.
- Using raw types, which turn off generic type checking.

---

## 16. Common Interview Questions

- **"How does HashMap work internally?"** See [Section 6](#6-hashmap-internals): bucket array, hash spreading, index by `(n - 1) & hash`, linked list to tree at 8, resize at 0.75 load.
- **"What happens with hash collisions?"** Entries chain in the same bucket, compared by `equals`, and the bucket becomes a red-black tree at 8 nodes (with a table of at least 64).
- **"HashMap vs ConcurrentHashMap vs Hashtable?"** See [Section 6.6](#66-hashmap-vs-hashtable-vs-concurrenthashmap).
- **"ArrayList vs LinkedList?"** ArrayList wins on random access, memory, and cache locality, LinkedList only helps for frequent end operations, and even then `ArrayDeque` is usually better.
- **"HashSet vs TreeSet vs LinkedHashSet?"** Unordered O(1), sorted O(log n), and insertion-ordered O(1).
- **"Comparable vs Comparator?"** Natural order in the class vs external, composable orders (see [Section 8](#8-sorting-comparable-vs-comparator)).
- **"What is fail-fast vs fail-safe?"** Fail-fast iterators throw `ConcurrentModificationException`, while concurrent collections use weakly consistent iterators.
- **"What is type erasure?"** Generics exist only at compile time, so the runtime sees raw types (see [Section 11.3](#113-type-erasure)).
- **"Explain PECS."** Use `? extends T` to read (producer) and `? super T` to write (consumer).
- **"map vs flatMap?"** One-to-one transformation vs flattening one-to-many.
- **"Are streams lazy?"** Yes, nothing runs until a terminal operation.
- **"When would you avoid parallel streams?"** Small data, blocking I/O, shared mutable state, poorly splittable sources.
- **"Why not use `Optional` as a field?"** It is not `Serializable` and adds overhead, it is designed as a return type.
- **"How would you implement an LRU cache?"** `LinkedHashMap` with access order and `removeEldestEntry` (see [Section 5.3](#53-linkedhashmap-as-an-lru-cache)).

---

## 17. One-Line Senior Summary

> Pick the collection by access pattern and complexity, keep keys immutable with a correct `equals` and `hashCode`, program to interfaces, let generics and streams express intent, and remember that HashMap's speed rests entirely on a good hash function and a sensible load factor.
