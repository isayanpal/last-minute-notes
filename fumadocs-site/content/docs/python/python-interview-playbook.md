---
title: "Python Interview Playbook"
description: "Python interview rehearsal: what each level is expected to know, a 55-question bank with strong-answer checklists, 20 predict-the-output puzzles with explanations, live-coding tasks, production scenarios, cheat sheets, common mistakes, and a 7-day study plan."
---

# 📘 Python Interview Playbook

The other pages teach the material.
This page is for rehearsal: a question bank with what a strong answer contains, predict-the-output puzzles (every output below was verified on CPython 3.14), coding tasks that come up in live rounds, and a study plan.

## Table of Contents

1. [What Interviewers Look For](#1-what-interviewers-look-for)
2. [Question Bank](#2-question-bank)
3. [Predict the Output](#3-predict-the-output)
4. [Live Coding Tasks](#4-live-coding-tasks)
5. [Production Scenarios](#5-production-scenarios)
6. [Cheat Sheets](#6-cheat-sheets)
7. [Common Mistakes](#7-common-mistakes)
8. [Study Plan](#8-study-plan)

---

## 1. What Interviewers Look For

| Level | Expected |
| --- | --- |
| **New grad / campus** | Built-in types, mutability, list vs tuple vs dict vs set, slicing, comprehensions, functions and `*args`, basic OOP, exceptions, output questions |
| **Mid** | Closures, decorators, generators, context managers, dunder methods, `super()` and MRO, complexity of built-ins, the GIL, threads vs processes, pytest, NumPy basics for data roles |
| **Senior** | Memory management and GC, descriptors, metaclass alternatives, asyncio internals and pitfalls, profiling, packaging, typing with generics and Protocols, API and service design in Python |
| **Staff / platform** | Free-threading and subinterpreter trade-offs, C extension and Rust interop, performance at scale, dependency and supply-chain management, migration strategy across versions |

Signals that raise your rating: explaining **why** (for example, why a mutable default is shared), quoting Big-O of built-ins without hesitation, writing idiomatic code (`enumerate`, `zip`, comprehensions, `with`), and knowing what changed in recent versions.

---

## 2. Question Bank

### 2.1 Language basics (12)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 1 | Is Python compiled or interpreted? | Bytecode compile, VM, `.pyc`, specializing interpreter, JIT | [Fundamentals](/docs/python/python-fundamentals) |
| 2 | Mutable vs immutable types? | Lists, dicts, sets vs ints, strs, tuples; rebinding vs mutation | [Fundamentals](/docs/python/python-fundamentals) |
| 3 | `is` vs `==`? | Identity vs equality, singletons, small int cache trap | [Fundamentals](/docs/python/python-fundamentals) |
| 4 | How are arguments passed? | Object references by value, mutation visible, rebinding not | [Fundamentals](/docs/python/python-fundamentals) |
| 5 | Shallow vs deep copy? | Shared inner objects, `copy.deepcopy`, memo for cycles | [Fundamentals](/docs/python/python-fundamentals) |
| 6 | Mutable default argument bug? | Evaluated once at `def`, `None` sentinel fix | [Fundamentals](/docs/python/python-fundamentals) |
| 7 | What is falsy in Python? | `None`, zeros, empty containers, `__bool__` / `__len__` | [Fundamentals](/docs/python/python-fundamentals) |
| 8 | How does `match` differ from switch? | Structural destructuring, capture patterns, guards | [Fundamentals](/docs/python/python-fundamentals) |
| 9 | Exception hierarchy and best practice? | `BaseException` vs `Exception`, narrow catches, `raise from` | [Fundamentals](/docs/python/python-fundamentals) |
| 10 | EAFP vs LBYL? | Try and handle vs check first, race conditions | [Fundamentals](/docs/python/python-fundamentals) |
| 11 | What does `if __name__ == "__main__"` do? | Module name when run vs imported, multiprocessing spawn | [Fundamentals](/docs/python/python-fundamentals) |
| 12 | How do imports work? | `sys.modules` cache, `sys.path`, circular imports | [Fundamentals](/docs/python/python-fundamentals) |

### 2.2 Data structures (10)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 13 | How is a list implemented? | Array of pointers, over-allocation, amortized append, O(n) front ops | [Data Structures](/docs/python/python-data-structures) |
| 14 | How is a dict implemented? | Compact hash table, open addressing, insertion order since 3.7 | [Data Structures](/docs/python/python-data-structures) |
| 15 | List vs tuple? | Mutability, hashability, memory, intent | [Data Structures](/docs/python/python-data-structures) |
| 16 | What can be a dict key? | Hashable, `__hash__` consistent with `__eq__` | [Data Structures](/docs/python/python-data-structures) |
| 17 | Complexity of `x in list` vs `x in set`? | O(n) vs O(1) average, worst case with collisions | [Data Structures](/docs/python/python-data-structures) |
| 18 | When to use `deque`? | O(1) both ends, BFS, `maxlen` windows | [Data Structures](/docs/python/python-data-structures) |
| 19 | How do you implement a priority queue? | `heapq`, tuples with tie-breakers, max-heap trick, 3.14 max functions | [Data Structures](/docs/python/python-data-structures) |
| 20 | `Counter` and `defaultdict` use cases? | Frequencies, grouping, factory semantics | [Data Structures](/docs/python/python-data-structures) |
| 21 | Comprehension vs generator expression? | Eager vs lazy, memory, single pass | [Data Structures](/docs/python/python-data-structures) |
| 22 | How does sorting work? | Timsort, stable, `key=`, multi-key tuples | [Data Structures](/docs/python/python-data-structures) |

### 2.3 Functions and iteration (8)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 23 | `*args`, `**kwargs`, `/`, `*` in signatures? | Parameter kinds, forwarding, keyword-only design | [Functions](/docs/python/functions-and-functional-python) |
| 24 | Explain LEGB and `nonlocal`. | Compile-time scoping, `UnboundLocalError` | [Functions](/docs/python/functions-and-functional-python) |
| 25 | What is a closure? | Cells, late binding, default-argument fix | [Functions](/docs/python/functions-and-functional-python) |
| 26 | Write a decorator with arguments. | Three levels, `functools.wraps` | [Functions](/docs/python/functions-and-functional-python) |
| 27 | Iterator vs iterable vs generator? | Protocols, single pass, lazy evaluation | [Functions](/docs/python/functions-and-functional-python) |
| 28 | `yield` vs `return`, and `yield from`? | Suspended frames, `send`, delegation, return value | [Functions](/docs/python/functions-and-functional-python) |
| 29 | How does `with` work? | `__enter__` / `__exit__`, exception suppression, `contextmanager` | [Functions](/docs/python/functions-and-functional-python) |
| 30 | `lru_cache` pitfalls? | Hashable args, memory growth, methods keep `self` alive | [Functions](/docs/python/functions-and-functional-python) |

### 2.4 OOP (8)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 31 | `__new__` vs `__init__`? | Creation vs initialization, immutables, singletons | [OOP](/docs/python/python-oop) |
| 32 | Class vs instance attributes? | Lookup order, shared mutable class attribute bug | [OOP](/docs/python/python-oop) |
| 33 | `classmethod` vs `staticmethod`? | Alternative constructors, subclass-friendly | [OOP](/docs/python/python-oop) |
| 34 | How do `super()` and the MRO work? | C3, next in MRO, cooperative inheritance | [OOP](/docs/python/python-oop) |
| 35 | Why does `__eq__` affect hashing? | `__hash__ = None`, equal objects equal hashes | [OOP](/docs/python/python-oop) |
| 36 | What is a descriptor? | `__get__` / `__set__`, property, methods, lookup precedence | [OOP](/docs/python/python-oop) |
| 37 | Dataclass vs NamedTuple vs Pydantic? | Generated methods, immutability, validation | [OOP](/docs/python/python-oop) |
| 38 | What are metaclasses, and alternatives? | `type`, class creation, `__init_subclass__`, decorators | [OOP](/docs/python/python-oop) |

### 2.5 Internals and concurrency (12)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 39 | What is the GIL? | One thread runs bytecode, why it exists, released on I/O | [Internals](/docs/python/python-internals) |
| 40 | Does the GIL make code thread-safe? | No, `+=` interleaving, locks | [Internals](/docs/python/python-internals) |
| 41 | How is memory managed? | Refcounting, cycle GC, generations, pymalloc | [Internals](/docs/python/python-internals) |
| 42 | What is free-threaded Python? | PEP 703, 3.13 experimental, 3.14 supported, costs | [Internals](/docs/python/python-internals) |
| 43 | Why is Python slow, and how do you speed it up? | Boxing, dynamic dispatch; algorithm, built-ins, NumPy, native code | [Internals](/docs/python/python-internals) |
| 44 | How do you profile? | `cProfile`, `py-spy`, `tracemalloc`, measure first | [Internals](/docs/python/python-internals) |
| 45 | Threads vs processes vs asyncio? | I/O vs CPU bound, scale, shared state | [Concurrency](/docs/python/concurrency-and-asyncio) |
| 46 | How does the event loop work? | Cooperative, `await` points, epoll / kqueue | [Concurrency](/docs/python/concurrency-and-asyncio) |
| 47 | `gather` vs `TaskGroup`? | Structured concurrency, cancellation, `ExceptionGroup` | [Concurrency](/docs/python/concurrency-and-asyncio) |
| 48 | Blocking call inside async code? | Loop freezes, `to_thread`, async libraries | [Concurrency](/docs/python/concurrency-and-asyncio) |
| 49 | How do you limit concurrency? | `Semaphore`, bounded queues, worker pools | [Concurrency](/docs/python/concurrency-and-asyncio) |
| 50 | How do you manage dependencies? | venv, `pyproject.toml`, lock files, uv | [Typing and Tooling](/docs/python/typing-tooling-and-modern-python) |

### 2.6 NumPy and data (5)

| # | Question | Strong answer includes | Read |
| --- | --- | --- | --- |
| 51 | Why is NumPy faster than lists? | Contiguous typed buffer, C loops, SIMD, GIL released | [NumPy](/docs/python/numpy-and-data-stack) |
| 52 | Explain broadcasting. | Compare from the right, equal or 1, stride 0, `keepdims` | [NumPy](/docs/python/numpy-and-data-stack) |
| 53 | View vs copy? | Slices and reshapes view, masks and fancy indexing copy, `shares_memory` | [NumPy](/docs/python/numpy-and-data-stack) |
| 54 | What does `axis=0` do? | Collapses rows, one result per column | [NumPy](/docs/python/numpy-and-data-stack) |
| 55 | How do you speed up slow pandas code? | Vectorize instead of `apply` / `iterrows`, dtypes, Copy-on-Write, Polars or DuckDB | [NumPy](/docs/python/numpy-and-data-stack) |

---

## 3. Predict the Output

Say the answer out loud before opening the explanation in your head.

| # | Code | Output | Why |
| --- | --- | --- | --- |
| 1 | `a = [1, 2, 3]; b = a; a = a + [4]; print(b)` | `[1, 2, 3]` | `+` builds a new list and rebinds `a` |
| 2 | `a = [1, 2, 3]; b = a; a += [4]; print(b)` | `[1, 2, 3, 4]` | `+=` on a list mutates in place (`__iadd__`) |
| 3 | `print({True: "a", 1: "b"})` | `{True: 'b'}` | `True == 1` and equal hashes, first key kept, last value wins |
| 4 | `print(round(2.5), round(3.5))` | `2 4` | Banker's rounding |
| 5 | `print(-7 // 2, -7 % 2)` | `-4 1` | Floor toward negative infinity |
| 6 | `g = (x for x in [1, 2]); print(list(g), list(g))` | `[1, 2] []` | Generators are single pass |
| 7 | `x = [1, 2, 2, 3]` then remove every `2` inside `for i in x` | `[1, 2, 3]` | Removing shifts items, so the loop skips the second `2` |
| 8 | `print(bool("False"), [] == False)` | `True False` | Non-empty string is truthy; `[]` is falsy but not equal to `False` |
| 9 | `class A: x = 1` / `class B(A): pass` / `B.x = 2; print(A.x, B.x)` | `1 2` | Assignment on `B` creates `B.x`, shadowing `A.x` |
| 10 | `x = [0, 1, 2]; x[1:2] = [7, 8, 9]; print(x)` | `[0, 7, 8, 9, 2]` | Slice assignment can change length |
| 11 | `print((1) * 3, (1,) * 3)` | `3 (1, 1, 1)` | Parentheses alone do not make a tuple |
| 12 | `it = iter([1, 2, 3]); print(2 in it, list(it))` | `True [3]` | `in` consumed the iterator up to the match |
| 13 | `print([lambda: i for i in range(3)][0]())` | `2` | Late binding: `i` is read at call time |
| 14 | `def f(x, l=[]): l.append(x); return l` / `print(f(1), f(2))` | `[1, 2] [1, 2]` | Shared default, and both prints show the same list |
| 15 | `t = (1, [2]); t[1].append(3); print(t)` | `(1, [2, 3])` | The tuple is immutable, its list is not |
| 16 | `print(0 or [] or {} or "done")` | `done` | `or` returns the first truthy operand |
| 17 | `print([1, 2, 3][-4:10])` | `[1, 2, 3]` | Slices clamp out-of-range bounds |
| 18 | `print({**{"a": 1}, "a": 2})` | `{'a': 2}` | Later keys win |
| 19 | `m = [[0] * 3] * 3; m[0][0] = 1; print(m)` | `[[1, 0, 0], [1, 0, 0], [1, 0, 0]]` | Three references to one inner list |
| 20 | `print([] is [], () is ())` | `False True` | New lists each time; the empty tuple is a shared singleton (implementation detail) |

Diamond MRO, a favorite follow-up:

```python
class A: pass
class B(A): pass
class C(A): pass
class D(B, C): pass
print([k.__name__ for k in D.__mro__])   # ['D', 'B', 'C', 'A', 'object']
```

Exception in `finally`:

```python
def f():
    try:
        return "try"
    finally:
        print("finally runs first")
print(f())          # prints "finally runs first", then "try"
```

---

## 4. Live Coding Tasks

Practice these until you can write them without looking.

| Task | Key idea |
| --- | --- |
| Word frequency, top k | `Counter(words).most_common(k)` or a size-k heap |
| Group anagrams | `defaultdict(list)` keyed by `"".join(sorted(w))` or a count tuple |
| LRU cache | `OrderedDict` with `move_to_end` and `popitem(last=False)` ([example](/docs/python/python-data-structures#9-the-collections-module)) |
| Flatten nested lists | Recursive generator with `yield from` |
| Timing / retry decorator | `functools.wraps`, three-level factory for arguments |
| Rate limiter | Token bucket with `time.monotonic()` and a lock |
| Chunk an iterable | `itertools.batched` (3.12) or `islice` in a loop |
| Read a huge file, count errors | Iterate the file object line by line, generator pipeline |
| Concurrent URL fetcher | `ThreadPoolExecutor` or `asyncio` + `Semaphore` |
| Merge k sorted lists | `heapq.merge` or a heap of `(value, list_index, element_index)` |
| Implement an iterator class | `__iter__` returns `self`, `__next__` raises `StopIteration` |
| Context manager timer | Class with `__enter__` / `__exit__` or `@contextmanager` |

```python
def flatten(items):
    for x in items:
        if isinstance(x, (list, tuple)):
            yield from flatten(x)
        else:
            yield x

list(flatten([1, [2, [3, (4, 5)]], 6]))    # [1, 2, 3, 4, 5, 6]
```

```python
import threading, time

class TokenBucket:
    def __init__(self, rate: float, capacity: int) -> None:
        self.rate, self.capacity = rate, capacity
        self.tokens = float(capacity)
        self.updated = time.monotonic()
        self.lock = threading.Lock()

    def allow(self) -> bool:
        with self.lock:
            now = time.monotonic()
            self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
            self.updated = now
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False
```

For algorithm rounds, see the Python templates on the [Data Structures page](/docs/python/python-data-structures#13-dsa-templates-in-python) and the [DSA patterns](/docs/dsa).

---

## 5. Production Scenarios

| Scenario | Strong answer |
| --- | --- |
| **A FastAPI endpoint is slow under load, CPU is low** | Something blocks the event loop (sync DB driver, `requests`, `time.sleep`); find it with `py-spy dump` or asyncio debug mode; switch to async clients or `to_thread` |
| **Worker memory grows until OOM-killed** | Compare `tracemalloc` or memray snapshots; look for unbounded caches, `lru_cache` on methods, global lists, retained tracebacks; bound or evict |
| **CPU-bound batch job uses one core** | GIL; move to `ProcessPoolExecutor` with sensible `chunksize`, vectorize with NumPy or Polars, or try the free-threaded build if dependencies support it |
| **Works locally, `ModuleNotFoundError` in prod** | Different interpreter or environment; pin with a lock file, build a wheel or container, run `python -m` so `sys.path` is right |
| **Intermittent wrong counters under threads** | Unsynchronized read-modify-write; add a `Lock`, or use a `queue.Queue` and a single writer |
| **Process hangs after `fork` on Linux** | Forked while another thread held a lock; use `spawn` or `forkserver` (default since 3.14) |
| **Service slow to start** | `python -X importtime` to find heavy imports; lazy-import in functions (explicit lazy imports arrive in 3.15) |
| **Upgrading from 3.9 to 3.14** | 3.9 is end-of-life; run tests with warnings as errors, check removed modules (PEP 594), rebuild C extensions, adopt Ruff's pyupgrade rules |

---

## 6. Cheat Sheets

### Built-in complexity

| Operation | Cost |
| --- | --- |
| `list.append`, `list.pop()` | O(1) amortized |
| `list.insert(0, x)`, `list.pop(0)`, `x in list` | O(n) |
| `dict[k]`, `k in dict`, `set.add`, `x in set` | O(1) average |
| `deque.appendleft`, `deque.popleft` | O(1) |
| `heappush`, `heappop` | O(log n) |
| `heapify` | O(n) |
| `sorted`, `list.sort` | O(n log n) |
| `str.join(parts)` | O(total length) |

### Concurrency choice

| Workload | Tool |
| --- | --- |
| Few blocking I/O calls | `ThreadPoolExecutor` |
| Thousands of sockets | `asyncio` |
| CPU-bound pure Python | `ProcessPoolExecutor` / `InterpreterPoolExecutor` |
| Numeric arrays | NumPy (releases the GIL) |

### Dunder quick map

| Syntax | Method |
| --- | --- |
| `len(x)` | `__len__` |
| `x[i]` | `__getitem__` |
| `x()` | `__call__` |
| `with x` | `__enter__`, `__exit__` |
| `for a in x` | `__iter__`, `__next__` |
| `x == y` | `__eq__` |
| `hash(x)` | `__hash__` |
| `repr(x)` | `__repr__` |

---

## 7. Common Mistakes

- Using a mutable default argument.
- Using `is` to compare numbers or strings.
- Saying Python "passes by reference".
- Saying the GIL makes code thread-safe, or that threads never help (they do for I/O).
- Calling `list.sort()` and assigning its `None` result.
- Using `list.pop(0)` in a BFS instead of `deque.popleft()`.
- Forgetting `functools.wraps` in decorators.
- Catching bare `except:` or swallowing `CancelledError`.
- Calling blocking libraries inside `async def`.
- Confusing type hints with runtime validation.
- Iterating a generator twice.
- Defining `__eq__` and being surprised the object is unhashable.

---

## 8. Study Plan

| Day | Focus | Output |
| --- | --- | --- |
| 1 | [Fundamentals](/docs/python/python-fundamentals) | Explain names vs objects and mutability; solve all 20 output puzzles |
| 2 | [Data Structures](/docs/python/python-data-structures) | Recite the complexity table; write BFS, Dijkstra, and LRU from memory |
| 3 | [Functions](/docs/python/functions-and-functional-python) | Write a retry decorator with arguments, a generator pipeline, and a context manager |
| 4 | [OOP](/docs/python/python-oop) | Build a `Vector` with dunders; explain a diamond MRO; write a validating descriptor |
| 5 | [Internals](/docs/python/python-internals) | Explain refcounting, GC, and the GIL in two minutes each; profile a script with cProfile |
| 6 | [Concurrency](/docs/python/concurrency-and-asyncio) and, for data roles, [NumPy](/docs/python/numpy-and-data-stack) | Write a bounded async fetcher and a process-pool job; solve the NumPy output table |
| 7 | [Typing and Tooling](/docs/python/typing-tooling-and-modern-python) and this page | Set up a uv project with pytest and Ruff; answer the question bank out loud |

Related: [Java](/docs/java) for comparing language designs, [OOPS](/docs/oops) for principles, [Backend](/docs/backend) for building services, and [Operating Systems](/docs/operating-systems) for what threads and processes are underneath.
